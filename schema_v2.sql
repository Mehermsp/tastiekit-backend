-- =====================================================
-- TASTIEKIT PRODUCTION DATABASE SCHEMA
-- =====================================================
-- Database: tastiekit (use your existing DB name)
-- =====================================================

-- =====================================================
-- 1. USERS TABLE (Single table for all roles)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30) UNIQUE NOT NULL,
    password VARCHAR(255), -- Nullable for OTP-only users
    role ENUM('customer', 'restaurant_partner', 'delivery_partner', 'admin') DEFAULT 'customer',
    is_available TINYINT(1) DEFAULT 1, -- For delivery partners
    profile_image VARCHAR(1024),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_phone (phone)
);

-- =====================================================
-- 2. ADDRESSES TABLE (Customer addresses)
-- =====================================================
CREATE TABLE IF NOT EXISTS addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    label VARCHAR(50) DEFAULT 'Home', -- Home, Work, Other
    door_no VARCHAR(100),
    street VARCHAR(255),
    area VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    landmark VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_default TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- =====================================================
-- 3. RESTAURANTS TABLE (Restaurant partner profiles)
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL, -- FK to users (restaurant_partner role)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo LONGTEXT,
    cover_image VARCHAR(1024),
    city VARCHAR(100) NOT NULL,
    area VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    pincode VARCHAR(20),
    landmark VARCHAR(255),
    cuisines JSON, -- Array of cuisines
    open_time TIME,
    close_time TIME,
    days_open JSON, -- Array of days
    fssai_number VARCHAR(100),
    gst_number VARCHAR(100),
    pan_number VARCHAR(100),
    status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'pending',
    is_active TINYINT(1) DEFAULT 1,
    rating DECIMAL(3,1) DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_owner_id (owner_id),
    INDEX idx_city (city),
    INDEX idx_status (status)
);

-- =====================================================
-- 4. MENU_ITEMS TABLE (Dishes from restaurants)
-- =====================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    image VARCHAR(1024),
    category ENUM('Veg', 'Non-Veg', 'Egg') DEFAULT 'Veg',
    meal_type ENUM('Breakfast', 'Lunch', 'Dinner', 'Snacks') DEFAULT 'Lunch',
    cuisine_type VARCHAR(50),
    season VARCHAR(50) DEFAULT 'All',
    rating DECIMAL(3,1) DEFAULT 4.0,
    discount_percent INT DEFAULT 0,
    popularity INT DEFAULT 0,
    is_available TINYINT(1) DEFAULT 1,
    preparation_time_mins INT DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    INDEX idx_restaurant_id (restaurant_id),
    INDEX idx_category (category),
    INDEX idx_is_available (is_available)
);

-- =====================================================
-- 5. ORDERS TABLE (Customer orders)
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL, -- TK-2024-00001 format
    user_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    delivery_partner_id INT,
    address_id INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    status ENUM(
        'placed',           -- Order placed by customer
        'confirmed',        -- Restaurant confirmed
        'preparing',        -- Being prepared
        'ready',            -- Ready for pickup
        'picked_up',        -- Delivery partner picked up
        'on_the_way',       -- En route to customer
        'delivered',        -- Successfully delivered
        'cancelled'         -- Cancelled
    ) DEFAULT 'placed',
    payment_method ENUM('cash', 'card', 'upi', 'wallet') DEFAULT 'cash',
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    payment_id VARCHAR(255),
    notes TEXT,
    delivery_notes TEXT,
    estimated_delivery_time TIMESTAMP,
    actual_delivery_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE RESTRICT,
    FOREIGN KEY (delivery_partner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE RESTRICT,
    INDEX idx_user_id (user_id),
    INDEX idx_restaurant_id (restaurant_id),
    INDEX idx_delivery_partner_id (delivery_partner_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- 6. ORDER_ITEMS TABLE (Items in each order)
-- =====================================================
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    discount_percent INT DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL,
    INDEX idx_order_id (order_id),
    INDEX idx_menu_item_id (menu_item_id)
);

-- =====================================================
-- 7. CARTS TABLE (User's active cart)
-- =====================================================
CREATE TABLE IF NOT EXISTS carts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_menu (user_id, menu_item_id),
    INDEX idx_user_id (user_id)
);

-- =====================================================
-- 8. WISHLISTS TABLE (Saved items)
-- =====================================================
CREATE TABLE IF NOT EXISTS wishlists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_item (user_id, menu_item_id),
    INDEX idx_user_id (user_id)
);

-- =====================================================
-- 9. DELIVERY_ASSIGNMENTS TABLE (Delivery partner assignments)
-- =====================================================
CREATE TABLE IF NOT EXISTS delivery_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    delivery_partner_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL,
    rejection_reason VARCHAR(255),
    status ENUM('assigned', 'accepted', 'rejected', 'completed') DEFAULT 'assigned',
    pickup_time TIMESTAMP NULL,
    delivery_time TIMESTAMP NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (delivery_partner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_delivery_partner_id (delivery_partner_id),
    INDEX idx_status (status)
);

-- =====================================================
-- 10. RESTAURANT_APPLICATIONS TABLE (Onboarding)
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurant_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    restaurant_name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    pincode VARCHAR(20),
    landmark VARCHAR(255),
    cuisines JSON,
    open_time TIME,
    close_time TIME,
    days_open JSON,
    fssai_number VARCHAR(100),
    gst_number VARCHAR(100),
    pan_number VARCHAR(100),
    logo LONGTEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_owner_id (owner_id),
    INDEX idx_status (status)
);

-- =====================================================
-- 11. OTP_VERIFICATIONS TABLE (OTP for login/registration)
-- =====================================================
CREATE TABLE IF NOT EXISTS otp_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255),
    phone VARCHAR(30),
    otp VARCHAR(10) NOT NULL,
    type ENUM('login', 'registration', 'password_reset') NOT NULL,
    user_id INT,
    expires_at TIMESTAMP NOT NULL,
    is_used TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_email_phone (email, phone),
    INDEX idx_otp_type (otp, type)
);

-- =====================================================
-- 12. REVIEWS TABLE (Customer reviews)
-- =====================================================
CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE KEY uk_order (order_id),
    INDEX idx_restaurant_id (restaurant_id),
    INDEX idx_user_id (user_id)
);

-- =====================================================
-- 13. NOTIFICATIONS TABLE (In-app notifications)
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('order', 'payment', 'delivery', 'promotion', 'system') DEFAULT 'system',
    data JSON,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- 14. ADMIN_ACTIVITY_LOG (Admin actions tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_admin_id (admin_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- RELATIONSHIP SUMMARY
-- =====================================================
/*
users (id) ─────┬──> addresses.user_id (1-to-many)
                ├──> orders.user_id (1-to-many)
                ├──> restaurants.owner_id (1-to-many)
                ├──> carts.user_id (1-to-many)
                ├──> wishlists.user_id (1-to-many)
                ├──> reviews.user_id (1-to-many)
                ├──> notifications.user_id (1-to-many)
                ├──> orders.delivery_partner_id (1-to-many)
                ├──> delivery_assignments.delivery_partner_id (1-to-many)
                └──> restaurant_applications.owner_id (1-to-many)

restaurants (id) ─> menu_items.restaurant_id (1-to-many)
                 ─> orders.restaurant_id (1-to-many)
                 ─> reviews.restaurant_id (1-to-many)

orders (id) ─────┬──> order_items.order_id (1-to-many)
                ├──> delivery_assignments.order_id (1-to-many)
                └──> reviews.order_id (1-to-many)

menu_items (id) ─> order_items.menu_item_id (1-to-many)
                 ─> carts.menu_item_id (1-to-many)
                 ─> wishlists.menu_item_id (1-to-many)

addresses (id) ─> orders.address_id (1-to-many)
*/