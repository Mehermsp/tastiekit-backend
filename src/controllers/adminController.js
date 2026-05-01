const db = require('../config/database');

// Get Dashboard Statistics
exports.getStatistics = async (req, res) => {
  try {
    const [restaurants] = await db.query('SELECT COUNT(*) as total FROM restaurants WHERE is_approved = 1 OR status = "active"');
    const [applications] = await db.query('SELECT COUNT(*) as total FROM restaurant_applications WHERE status = "pending"');
    const [orders] = await db.query('SELECT COUNT(*) as total FROM orders');
    
    // Count active delivery partners (users with role that can deliver)
    const [partners] = await db.query(`
      SELECT COUNT(*) as total FROM users 
      WHERE role = 'delivery' AND is_available = 1
    `);
    
    // Get revenue (sum of all orders)
    const [revenue] = await db.query(`
      SELECT COALESCE(SUM(total), 0) as total 
      FROM orders 
      WHERE status = 'delivered'
    `);

    // Orders today
    const [ordersToday] = await db.query(`
      SELECT COUNT(*) as total FROM orders 
      WHERE DATE(created_at) = CURDATE()
    `);

    res.json({
      total_restaurants: restaurants[0]?.total || 0,
      pending_applications: applications[0]?.total || 0,
      total_orders: orders[0]?.total || 0,
      total_revenue: revenue[0]?.total || 0,
      active_delivery_partners: partners[0]?.total || 0,
      orders_today: ordersToday[0]?.total || 0
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// Get Restaurant Applications
exports.getApplications = async (req, res) => {
  try {
    const { limit } = req.query;
    let query = `
      SELECT 
        id,
        owner_id as user_id,
        owner_name,
        email,
        phone,
        restaurant_name,
        address,
        city,
        pincode,
        state,
        cuisines as cuisine_type,
        open_time as opening_time,
        close_time as closing_time,
        fssai as license_number,
        gst as gst_number,
        pan,
        status,
        review_notes as rejection_reason,
        created_at,
        updated_at
      FROM restaurant_applications 
      ORDER BY created_at DESC
    `;
    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    
    const [applications] = await db.query(query);
    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

// Get Application by ID
exports.getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const [applications] = await db.query(`
      SELECT 
        id,
        owner_id as user_id,
        owner_name,
        email,
        phone,
        restaurant_name,
        address,
        city,
        pincode,
        state,
        landmark,
        cuisines as cuisine_type,
        open_time as opening_time,
        close_time as closing_time,
        days_open,
        fssai as license_number,
        gst as gst_number,
        pan,
        logo,
        status,
        review_notes as rejection_reason,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      FROM restaurant_applications 
      WHERE id = ?
    `, [id]);
    
    if (applications.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json(applications[0]);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
};

// Approve Application
exports.approveApplication = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get application details
    const [applications] = await db.query(`
      SELECT * FROM restaurant_applications WHERE id = ?
    `, [id]);
    
    if (applications.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const app = applications[0];
    
    // Start transaction
    await db.query('START TRANSACTION');
    
    // Update application status
    await db.query(`
      UPDATE restaurant_applications 
      SET status = 'approved', reviewed_at = NOW()
      WHERE id = ?
    `, [id]);
    
    // Create restaurant record
    await db.query(`
      INSERT INTO restaurants (
        user_id, owner_id, name as restaurant_name, email, phone, 
        description, address, city, state, pincode, landmark,
        cuisines, open_time, close_time, days_open,
        fssai, gst, pan, logo, is_approved, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active')
    `, [
      app.owner_id, app.owner_id, app.restaurant_name, app.email, app.phone,
      app.description || '', app.address, app.city, app.state || '', app.pincode, app.landmark || '',
      app.cuisines, app.open_time, app.close_time, app.days_open || '',
      app.fssai, app.gst, app.pan, app.logo || ''
    ]);
    
    await db.query('COMMIT');
    
    res.json({ message: 'Application approved and restaurant created successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error approving application:', error);
    res.status(500).json({ error: 'Failed to approve application' });
  }
};

// Reject Application
exports.rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    
    await db.query(`
      UPDATE restaurant_applications 
      SET status = 'rejected', review_notes = ?, reviewed_at = NOW()
      WHERE id = ?
    `, [rejection_reason, id]);
    
    res.json({ message: 'Application rejected successfully' });
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({ error: 'Failed to reject application' });
  }
};

// Get Restaurants
exports.getRestaurants = async (req, res) => {
  try {
    const [restaurants] = await db.query(`
      SELECT 
        r.id,
        r.name as restaurant_name,
        r.user_id,
        r.owner_id,
        r.email,
        r.phone,
        r.description,
        r.image_url,
        r.logo,
        r.cover_image,
        r.address,
        r.city,
        r.state,
        r.pincode,
        r.landmark,
        r.cuisines as cuisine_type,
        r.open_time as opening_time,
        r.close_time as closing_time,
        r.days_open,
        r.fssai as license_number,
        r.gst as gst_number,
        r.pan,
        r.rating,
        r.is_approved,
        r.is_open,
        r.is_active as status,
        r.total_orders,
        r.total_revenue,
        r.platform_fee_percent,
        r.created_at,
        r.updated_at,
        u.name as owner_name,
        u.email as owner_email,
        u.phone as owner_phone
      FROM restaurants r
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);
    
    // Map is_approved to status for consistency
    const result = restaurants.map(r => ({
      ...r,
      status: r.is_active !== null ? (r.is_active ? 'active' : 'inactive') : 
              (r.is_approved ? 'active' : 'inactive')
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
};

// Get Restaurant by ID
exports.getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const [restaurants] = await db.query(`
      SELECT 
        r.id,
        r.name as restaurant_name,
        r.user_id,
        r.owner_id,
        r.email,
        r.phone,
        r.description,
        r.image_url,
        r.logo,
        r.cover_image,
        r.address,
        r.city,
        r.state,
        r.pincode,
        r.landmark,
        r.cuisines as cuisine_type,
        r.open_time as opening_time,
        r.close_time as closing_time,
        r.days_open,
        r.fssai as license_number,
        r.gst as gst_number,
        r.pan,
        r.rating,
        r.is_approved,
        r.is_open,
        r.is_active,
        r.total_orders,
        r.total_revenue,
        r.created_at,
        r.updated_at,
        u.name as owner_name,
        u.email as owner_email,
        u.phone as owner_phone
      FROM restaurants r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, [id]);
    
    if (restaurants.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    res.json(restaurants[0]);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
};

// Update Restaurant Status
exports.updateRestaurantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const isActive = status === 'active' ? 1 : 0;
    await db.query('UPDATE restaurants SET is_active = ? WHERE id = ?', [isActive, id]);
    res.json({ message: 'Restaurant status updated successfully' });
  } catch (error) {
    console.error('Error updating restaurant status:', error);
    res.status(500).json({ error: 'Failed to update restaurant status' });
  }
};

// Update Restaurant
exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    await db.query(`UPDATE restaurants SET ${fields} WHERE id = ?`, [...values, id]);
    res.json({ message: 'Restaurant updated successfully' });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
};

// Get Orders
exports.getOrders = async (req, res) => {
  try {
    const { status, limit } = req.query;
    let query = `
      SELECT 
        o.id,
        o.order_number,
        o.user_id,
        o.restaurant_id,
        o.total,
        o.subtotal,
        o.discount_amount,
        o.delivery_fee,
        o.tax_amount,
        o.status,
        o.payment_method,
        o.payment_status,
        o.payment_id,
        o.delivery_partner_id,
        o.address_id,
        o.delivery_notes,
        o.estimated_delivery_time,
        o.actual_delivery_time,
        o.created_at,
        o.updated_at,
        o.delivered_at,
        -- Customer details
        cu.name as customer_name,
        cu.phone as customer_phone,
        -- Restaurant details
        r.name as restaurant_name,
        r.phone as restaurant_phone,
        r.address as restaurant_address,
        -- Delivery partner details
        dp.name as delivery_partner_name,
        dp.phone as delivery_partner_phone,
        -- Delivery address
        a.door_no,
        a.street,
        a.area,
        a.city,
        a.state,
        a.pincode,
        a.landmark
      FROM orders o
      LEFT JOIN users cu ON o.user_id = cu.id
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN users dp ON o.delivery_partner_id = dp.id
      LEFT JOIN addresses a ON o.address_id = a.id
      WHERE 1=1
    `;
    
    const params = [];
    if (status && status !== 'all') {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY o.created_at DESC';
    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    
    const [orders] = await db.query(query, params);
    
    // Format delivery address
    const formattedOrders = orders.map(o => ({
      ...o,
      delivery_address: [o.door_no, o.street, o.area, o.city, o.state, o.pincode]
        .filter(Boolean).join(', ')
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// Get Order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const [orders] = await db.query(`
      SELECT 
        o.id,
        o.order_number,
        o.user_id,
        o.restaurant_id,
        o.total,
        o.subtotal,
        o.discount_amount,
        o.delivery_fee,
        o.tax_amount,
        o.status,
        o.payment_method,
        o.payment_status,
        o.payment_id,
        o.delivery_partner_id,
        o.delivery_notes,
        o.estimated_delivery_time,
        o.actual_delivery_time,
        o.created_at,
        o.updated_at,
        o.delivered_at,
        -- Customer details
        cu.name as customer_name,
        cu.phone as customer_phone,
        -- Restaurant details
        r.name as restaurant_name,
        r.phone as restaurant_phone,
        r.address as restaurant_address,
        -- Delivery partner details
        dp.name as delivery_partner_name,
        dp.phone as delivery_partner_phone,
        -- Delivery address
        a.door_no,
        a.street,
        a.area,
        a.city,
        a.state,
        a.pincode,
        a.landmark
      FROM orders o
      LEFT JOIN users cu ON o.user_id = cu.id
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN users dp ON o.delivery_partner_id = dp.id
      LEFT JOIN addresses a ON o.address_id = a.id
      WHERE o.id = ?
    `, [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get order items
    const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
    
    const order = orders[0];
    order.items = items;
    order.delivery_address = [order.door_no, order.street, order.area, order.city, order.state, order.pincode]
      .filter(Boolean).join(', ');
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

// Update Order Status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    let updateData = { status };
    
    // If delivered, set delivered_at
    if (status === 'delivered') {
      updateData.delivered_at = new Date();
    }
    
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData);
    
    await db.query(`UPDATE orders SET ${fields} WHERE id = ?`, [...values, id]);
    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

// Assign Delivery Partner to Order
exports.assignDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_partner_id } = req.body;
    
    await db.query('START TRANSACTION');
    
    // Update order with delivery partner
    await db.query(
      'UPDATE orders SET delivery_partner_id = ?, status = "out_for_delivery" WHERE id = ?',
      [delivery_partner_id, id]
    );
    
    // Create delivery assignment record
    await db.query(`
      INSERT INTO delivery_assignments (
        order_id, delivery_partner_id, status, assigned_at
      ) VALUES (?, ?, "assigned", NOW())
    `, [id, delivery_partner_id]);
    
    await db.query('COMMIT');
    
    res.json({ message: 'Delivery partner assigned successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error assigning delivery partner:', error);
    res.status(500).json({ error: 'Failed to assign delivery partner' });
  }
};

// Get Delivery Partners
exports.getDeliveryPartners = async (req, res) => {
  try {
    const [partners] = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.profile_image,
        u.is_available,
        u.role,
        u.created_at,
        -- Calculate stats
        (SELECT COUNT(*) FROM orders WHERE delivery_partner_id = u.id AND status = 'delivered') as total_deliveries,
        (SELECT COUNT(*) FROM orders WHERE delivery_partner_id = u.id) as completed_orders,
        (SELECT AVG(rating) FROM reviews WHERE delivery_rating IS NOT NULL AND user_id = u.id) as rating,
        (SELECT COUNT(*) FROM delivery_assignments WHERE delivery_partner_id = u.id AND status = "assigned") as pending_assignments,
        u.delivery_fee_per_order
      FROM users u
      WHERE u.role = 'delivery'
      ORDER BY u.created_at DESC
    `);
    
    // Map is_available to status
    const result = partners.map(p => ({
      ...p,
      status: p.is_available ? 'active' : 'inactive',
      vehicle_type: 'bike', // Default value, can be extended if you have a vehicle table
      total_deliveries: p.total_deliveries || 0,
      completed_orders: p.completed_orders || 0,
      rating: p.rating ? parseFloat(p.rating).toFixed(1) : 'N/A',
      pending_assignments: p.pending_assignments || 0
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching delivery partners:', error);
    res.status(500).json({ error: 'Failed to fetch delivery partners' });
  }
};

// Get Delivery Partner by ID
exports.getDeliveryPartnerById = async (req, res) => {
  try {
    const { id } = req.params;
    const [partners] = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.profile_image,
        u.is_available,
        u.role,
        u.created_at,
        u.delivery_fee_per_order,
        (SELECT COUNT(*) FROM orders WHERE delivery_partner_id = u.id AND status = 'delivered') as total_deliveries,
        (SELECT COUNT(*) FROM orders WHERE delivery_partner_id = u.id) as completed_orders,
        (SELECT AVG(rating) FROM reviews WHERE delivery_rating IS NOT NULL AND user_id = u.id) as rating
      FROM users u
      WHERE u.id = ? AND u.role = 'delivery'
    `, [id]);
    
    if (partners.length === 0) {
      return res.status(404).json({ error: 'Delivery partner not found' });
    }
    
    const partner = partners[0];
    partner.status = partner.is_available ? 'active' : 'inactive';
    partner.total_deliveries = partner.total_deliveries || 0;
    partner.completed_orders = partner.completed_orders || 0;
    partner.rating = partner.rating ? parseFloat(partner.rating).toFixed(1) : 'N/A';
    
    res.json(partner);
  } catch (error) {
    console.error('Error fetching delivery partner:', error);
    res.status(500).json({ error: 'Failed to fetch delivery partner' });
  }
};

// Update Delivery Partner Status
exports.updateDeliveryPartnerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const isAvailable = status === 'active' ? 1 : 0;
    await db.query('UPDATE users SET is_available = ? WHERE id = ? AND role = "delivery"', [isAvailable, id]);
    res.json({ message: 'Delivery partner status updated successfully' });
  } catch (error) {
    console.error('Error updating delivery partner status:', error);
    res.status(500).json({ error: 'Failed to update delivery partner status' });
  }
};

// Update Delivery Partner
exports.updateDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    await db.query(`UPDATE users SET ${fields} WHERE id = ?`, [...values, id]);
    res.json({ message: 'Delivery partner updated successfully' });
  } catch (error) {
    console.error('Error updating delivery partner:', error);
    res.status(500).json({ error: 'Failed to update delivery partner' });
  }
};

// Settings - General
exports.getGeneralSettings = async (req, res) => {
  try {
    const [settings] = await db.query('SELECT * FROM admin_settings WHERE setting_key LIKE "general_%"');
    const result = {};
    settings.forEach(s => {
      result[s.setting_key.replace('general_', '')] = s.setting_value;
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching general settings:', error);
    // Return defaults if table doesn't exist
    res.json({
      platform_name: 'TastieKit',
      support_email: 'support@tastiekit.com',
      support_phone: '+91 9876543210',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });
  }
};

exports.updateGeneralSettings = async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await db.query(`
        INSERT INTO admin_settings (setting_key, setting_value) 
        VALUES ('general_${key}', ?)
        ON DUPLICATE KEY UPDATE setting_value = ?
      `, [value, value]);
    }
    
    res.json({ message: 'General settings updated successfully' });
  } catch (error) {
    console.error('Error updating general settings:', error);
    res.status(500).json({ error: 'Failed to update general settings' });
  }
};

// Settings - Notifications
exports.getNotificationSettings = async (req, res) => {
  try {
    const [settings] = await db.query('SELECT * FROM admin_settings WHERE setting_key LIKE "notification_%"');
    const result = {};
    settings.forEach(s => {
      result[s.setting_key.replace('notification_', '')] = s.setting_value === 'true';
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.json({
      email_notifications: true,
      sms_notifications: false,
      push_notifications: true,
      new_order_alert: true,
      new_application_alert: true,
      low_stock_alert: false
    });
  }
};

exports.updateNotificationSettings = async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await db.query(`
        INSERT INTO admin_settings (setting_key, setting_value) 
        VALUES ('notification_${key}', ?)
        ON DUPLICATE KEY UPDATE setting_value = ?
      `, [value.toString(), value.toString()]);
    }
    
    res.json({ message: 'Notification settings updated successfully' });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
};

// Settings - Security
exports.getSecuritySettings = async (req, res) => {
  try {
    const [settings] = await db.query('SELECT * FROM admin_settings WHERE setting_key LIKE "security_%"');
    const result = {};
    settings.forEach(s => {
      const key = s.setting_key.replace('security_', '');
      result[key] = key === 'two_factor_auth' ? s.setting_value === 'true' : parseInt(s.setting_value);
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching security settings:', error);
    res.json({
      two_factor_auth: false,
      session_timeout: 30,
      password_expiry_days: 90,
      max_login_attempts: 5
    });
  }
};

exports.updateSecuritySettings = async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await db.query(`
        INSERT INTO admin_settings (setting_key, setting_value) 
        VALUES ('security_${key}', ?)
        ON DUPLICATE KEY UPDATE setting_value = ?
      `, [value.toString(), value.toString()]);
    }
    
    res.json({ message: 'Security settings updated successfully' });
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
};

// Settings - Restaurant Commission
exports.getRestaurantCommission = async (req, res) => {
  try {
    const [settings] = await db.query('SELECT * FROM admin_settings WHERE setting_key LIKE "commission_%"');
    const result = {
      percentage: 15,
      fixed_fee: 0,
      min_order_amount: 100,
      max_commission: 500
    };
    settings.forEach(s => {
      const key = s.setting_key.replace('commission_', '');
      result[key] = parseFloat(s.setting_value);
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching commission settings:', error);
    res.json({
      percentage: 15,
      fixed_fee: 0,
      min_order_amount: 100,
      max_commission: 500
    });
  }
};

exports.updateRestaurantCommission = async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await db.query(`
        INSERT INTO admin_settings (setting_key, setting_value) 
        VALUES ('commission_${key}', ?)
        ON DUPLICATE KEY UPDATE setting_value = ?
      `, [value.toString(), value.toString()]);
    }
    
    res.json({ message: 'Commission settings updated successfully' });
  } catch (error) {
    console.error('Error updating commission settings:', error);
    res.status(500).json({ error: 'Failed to update commission settings' });
  }
};

// Settings - Delivery
exports.getDeliverySettings = async (req, res) => {
  try {
    const [settings] = await db.query('SELECT * FROM admin_settings WHERE setting_key LIKE "delivery_%"');
    const result = {
      base_delivery_fee: 30,
      per_km_rate: 10,
      min_delivery_fee: 25,
      max_delivery_fee: 100,
      peak_hour_multiplier: 1.5,
      peak_hours: '12:00-14:00,19:00-22:00'
    };
    settings.forEach(s => {
      const key = s.setting_key.replace('delivery_', '');
      result[key] = key === 'peak_hours' ? s.setting_value : parseFloat(s.setting_value);
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching delivery settings:', error);
    res.json({
      base_delivery_fee: 30,
      per_km_rate: 10,
      min_delivery_fee: 25,
      max_delivery_fee: 100,
      peak_hour_multiplier: 1.5,
      peak_hours: '12:00-14:00,19:00-22:00'
    });
  }
};

exports.updateDeliverySettings = async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await db.query(`
        INSERT INTO admin_settings (setting_key, setting_value) 
        VALUES ('delivery_${key}', ?)
        ON DUPLICATE KEY UPDATE setting_value = ?
      `, [value.toString(), value.toString()]);
    }
    
    res.json({ message: 'Delivery settings updated successfully' });
  } catch (error) {
    console.error('Error updating delivery settings:', error);
    res.status(500).json({ error: 'Failed to update delivery settings' });
  }
};