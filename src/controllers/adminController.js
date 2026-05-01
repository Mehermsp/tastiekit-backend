const db = require('../config/database');

// Get Dashboard Statistics
exports.getStatistics = async (req, res) => {
  try {
    const [restaurants] = await db.query('SELECT COUNT(*) as total FROM restaurants WHERE status = "active"');
    const [applications] = await db.query('SELECT COUNT(*) as total FROM restaurant_applications WHERE status = "pending"');
    const [orders] = await db.query('SELECT COUNT(*) as total FROM orders');
    const [partners] = await db.query('SELECT COUNT(*) as total FROM delivery_partners WHERE status = "active"');
    
    // Get revenue (sum of all delivered orders)
    const [revenue] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total 
      FROM orders 
      WHERE status = 'delivered'
    `);

    res.json({
      total_restaurants: restaurants[0]?.total || 0,
      pending_applications: applications[0]?.total || 0,
      total_orders: orders[0]?.total || 0,
      total_revenue: revenue[0]?.total || 0,
      active_delivery_partners: partners[0]?.total || 0,
      orders_today: 0 // Can be calculated with date filter
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
    let query = 'SELECT * FROM restaurant_applications ORDER BY created_at DESC';
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
    const [applications] = await db.query('SELECT * FROM restaurant_applications WHERE id = ?', [id]);
    
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
    const [applications] = await db.query('SELECT * FROM restaurant_applications WHERE id = ?', [id]);
    if (applications.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const app = applications[0];
    
    // Start transaction
    await db.query('START TRANSACTION');
    
    // Update application status
    await db.query('UPDATE restaurant_applications SET status = "approved" WHERE id = ?', [id]);
    
    // Create restaurant record
    await db.query(`
      INSERT INTO restaurants (
        user_id, restaurant_name, cuisine_type, address, city, state, pincode,
        phone_number, email, license_number, gst_number, opening_time, closing_time,
        delivery_radius, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      app.user_id, app.restaurant_name, app.cuisine_type, app.address, app.city, app.state, app.pincode,
      app.phone_number, app.email, app.license_number, app.gst_number, app.opening_time, app.closing_time,
      app.delivery_radius, app.description
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
    
    await db.query(
      'UPDATE restaurant_applications SET status = "rejected", rejection_reason = ? WHERE id = ?',
      [rejection_reason, id]
    );
    
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
      SELECT r.*, u.name as owner_name, u.email, u.phone 
      FROM restaurants r
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);
    res.json(restaurants);
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
      SELECT r.*, u.name as owner_name, u.email, u.phone 
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
    
    await db.query('UPDATE restaurants SET status = ? WHERE id = ?', [status, id]);
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
      SELECT o.*, 
             c.name as customer_name, c.phone as customer_phone,
             r.restaurant_name, r.phone as restaurant_phone, r.address as restaurant_address,
             d.name as delivery_partner_name, d.phone as delivery_partner_phone
      FROM orders o
      LEFT JOIN users c ON o.user_id = c.id
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN delivery_partners d ON o.delivery_partner_id = d.id
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
    res.json(orders);
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
      SELECT o.*, 
             c.name as customer_name, c.phone as customer_phone,
             r.restaurant_name, r.phone as restaurant_phone, r.address as restaurant_address,
             d.name as delivery_partner_name, d.phone as delivery_partner_phone
      FROM orders o
      LEFT JOIN users c ON o.user_id = c.id
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN delivery_partners d ON o.delivery_partner_id = d.id
      WHERE o.id = ?
    `, [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get order items
    const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
    orders[0].items = items;
    
    res.json(orders[0]);
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
    
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
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
    
    await db.query(
      'UPDATE orders SET delivery_partner_id = ?, status = "out_for_delivery" WHERE id = ?',
      [delivery_partner_id, id]
    );
    
    // Update delivery partner status to busy
    await db.query('UPDATE delivery_partners SET status = "busy" WHERE id = ?', [delivery_partner_id]);
    
    res.json({ message: 'Delivery partner assigned successfully' });
  } catch (error) {
    console.error('Error assigning delivery partner:', error);
    res.status(500).json({ error: 'Failed to assign delivery partner' });
  }
};

// Get Delivery Partners
exports.getDeliveryPartners = async (req, res) => {
  try {
    const [partners] = await db.query(`
      SELECT *, 
             (SELECT COUNT(*) FROM orders WHERE delivery_partner_id = dp.id AND status = 'delivered') as total_deliveries,
             (SELECT COUNT(*) FROM orders WHERE delivery_partner_id = dp.id) as completed_orders
      FROM delivery_partners dp
      ORDER BY created_at DESC
    `);
    res.json(partners);
  } catch (error) {
    console.error('Error fetching delivery partners:', error);
    res.status(500).json({ error: 'Failed to fetch delivery partners' });
  }
};

// Get Delivery Partner by ID
exports.getDeliveryPartnerById = async (req, res) => {
  try {
    const { id } = req.params;
    const [partners] = await db.query('SELECT * FROM delivery_partners WHERE id = ?', [id]);
    
    if (partners.length === 0) {
      return res.status(404).json({ error: 'Delivery partner not found' });
    }
    
    res.json(partners[0]);
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
    
    await db.query('UPDATE delivery_partners SET status = ? WHERE id = ?', [status, id]);
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
    
    await db.query(`UPDATE delivery_partners SET ${fields} WHERE id = ?`, [...values, id]);
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
    res.status(500).json({ error: 'Failed to fetch general settings' });
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
    res.status(500).json({ error: 'Failed to fetch notification settings' });
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
    res.status(500).json({ error: 'Failed to fetch security settings' });
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
    res.status(500).json({ error: 'Failed to fetch commission settings' });
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
    res.status(500).json({ error: 'Failed to fetch delivery settings' });
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