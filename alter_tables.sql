-- =====================================================
-- ALTER QUERIES FOR EXISTING TABLES
-- =====================================================
-- Run these to modify your existing database to match the new schema
-- IMPORTANT: Backup your database before running!
-- =====================================================

-- =====================================================
-- 1. MODIFY USERS TABLE
-- =====================================================

-- Add role column with enum values (if not exists)
-- First check if column exists
ALTER TABLE users MODIFY COLUMN role ENUM('customer', 'restaurant_partner', 'delivery_partner', 'admin') DEFAULT 'customer';

-- Add profile_image column
ALTER TABLE users ADD COLUMN profile_image VARCHAR(1024) AFTER is_available;

-- Make phone unique (if not already)
ALTER TABLE users MODIFY COLUMN phone VARCHAR(30) UNIQUE NOT NULL;

-- Add index on role for faster queries
ALTER TABLE users ADD INDEX idx_role (role);


-- =====================================================
-- 2. MODIFY RESTAURANTS TABLE
-- =====================================================

-- Add missing columns to restaurants
ALTER TABLE restaurants ADD COLUMN cover_image VARCHAR(1024) AFTER logo;
ALTER TABLE restaurants ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER status;
ALTER TABLE restaurants ADD COLUMN total_revenue DECIMAL(12,2) DEFAULT 0 AFTER total_orders;

-- Add Cloudinary public_ids for image management
ALTER TABLE restaurants ADD COLUMN logo_public_id VARCHAR(512) AFTER logo;
ALTER TABLE restaurants ADD COLUMN cover_public_id VARCHAR(512) AFTER cover_image;

-- Add public_id to menu_items for image management
ALTER TABLE menu_items ADD COLUMN image_public_id VARCHAR(512) AFTER image;

-- Modify status enum
ALTER TABLE restaurants MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'pending';

-- Expand base64 logo storage for existing restaurants
ALTER TABLE restaurants MODIFY COLUMN logo LONGTEXT;
ALTER TABLE restaurant_applications MODIFY COLUMN logo LONGTEXT;

-- Add index on city
ALTER TABLE restaurants ADD INDEX idx_city (city);

-- Add index on owner_id if not exists
ALTER TABLE restaurants ADD INDEX idx_owner_id (owner_id);


-- =====================================================
-- 3. MODIFY/RENAME MENU TABLE TO MENU_ITEMS
-- =====================================================

-- Rename menu to menu_items
ALTER TABLE menu RENAME TO menu_items;

-- Add missing columns
ALTER TABLE menu_items ADD COLUMN cuisine_type VARCHAR(50) AFTER meal_type;
ALTER TABLE menu_items ADD COLUMN is_available TINYINT(1) DEFAULT 1 AFTER popularity;
ALTER TABLE menu_items ADD COLUMN preparation_time_mins INT DEFAULT 20 AFTER is_available;

-- Modify category enum
ALTER TABLE menu_items MODIFY COLUMN category ENUM('Veg', 'Non-Veg', 'Egg') DEFAULT 'Veg';

-- Modify meal_type enum
ALTER TABLE menu_items MODIFY COLUMN meal_type ENUM('Breakfast', 'Lunch', 'Dinner', 'Snacks') DEFAULT 'Lunch';

-- Add indexes
ALTER TABLE menu_items ADD INDEX idx_category (category);
ALTER TABLE menu_items ADD INDEX idx_is_available (is_available);


-- =====================================================
-- 4. MODIFY ORDERS TABLE
-- =====================================================

-- Add order_number column (unique)
ALTER TABLE orders ADD COLUMN order_number VARCHAR(50) UNIQUE NOT NULL AFTER id;

-- Add address_id column (replace address fields)
ALTER TABLE orders ADD COLUMN address_id INT AFTER delivery_partner_id;

-- Add delivery_partner_id if not exists
-- (Check if column exists first - it might already exist as delivery_boy_id)

-- Rename delivery_boy_id to delivery_partner_id if needed
-- ALTER TABLE orders CHANGE COLUMN delivery_boy_id delivery_partner_id INT;

-- Add financial columns
ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER address_id;
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0 AFTER subtotal;
ALTER TABLE orders ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0 AFTER discount_amount;
ALTER TABLE orders ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0 AFTER delivery_fee;

-- Modify total column position
-- (total already exists, ensure it's in right position after tax_amount)

-- Modify status enum to include all order states
ALTER TABLE orders MODIFY COLUMN status ENUM(
    'placed', 'confirmed', 'preparing', 'ready', 
    'picked_up', 'on_the_way', 'delivered', 'cancelled'
) DEFAULT 'placed';

-- Add payment-related columns
ALTER TABLE orders ADD COLUMN payment_method ENUM('cash', 'card', 'upi', 'wallet') DEFAULT 'cash' AFTER status;
ALTER TABLE orders ADD COLUMN payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending' AFTER payment_method;

-- Add delivery tracking columns
ALTER TABLE orders ADD COLUMN estimated_delivery_time TIMESTAMP NULL AFTER delivery_notes;
ALTER TABLE orders ADD COLUMN actual_delivery_time TIMESTAMP NULL AFTER estimated_delivery_time;

-- Add updated_at column
ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER actual_delivery_time;

-- Add foreign key for address_id (will need to create addresses table first)
-- ALTER TABLE orders ADD FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE RESTRICT;

-- Add foreign key for delivery_partner_id (if pointing to users)
-- ALTER TABLE orders ADD FOREIGN KEY (delivery_partner_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add indexes
ALTER TABLE orders ADD INDEX idx_delivery_partner_id (delivery_partner_id);
ALTER TABLE orders ADD INDEX idx_restaurant_id (restaurant_id);
ALTER TABLE orders ADD INDEX idx_created_at (created_at);


-- =====================================================
-- 5. CREATE ADDRESSES TABLE (NEW)
-- =====================================================
CREATE TABLE IF NOT EXISTS addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    label VARCHAR(50) DEFAULT 'Home',
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

-- Migration: Copy existing address data from orders to addresses
-- Run this after addresses table is created (one-time migration)
-- INSERT INTO addresses (user_id, door_no, street, area, city, state, pincode, landmark)
-- SELECT DISTINCT user_id, door_no, street, area, city, state, zip_code, NULL
-- FROM orders WHERE user_id IS NOT NULL;


-- =====================================================
-- 6. CREATE DELIVERY_ASSIGNMENTS TABLE (NEW)
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
-- 7. MODIFY OTP_CODES TABLE
-- =====================================================

-- Rename to otp_verifications
ALTER TABLE otp_codes RENAME TO otp_verifications;

-- Modify columns
ALTER TABLE otp_verifications MODIFY COLUMN type ENUM('login', 'registration', 'password_reset') NOT NULL;
ALTER TABLE otp_verifications ADD COLUMN is_used TINYINT(1) DEFAULT 0 AFTER expires_at;

-- Add indexes
ALTER TABLE otp_verifications ADD INDEX idx_email_phone (email, phone);
ALTER TABLE otp_verifications ADD INDEX idx_otp_type (otp, type);

-- Drop unused columns if any
-- ALTER TABLE otp_verifications DROP COLUMN temp_name;
-- ALTER TABLE otp_verifications DROP COLUMN temp_password;
-- ALTER TABLE otp_verifications DROP COLUMN reset_token;
-- ALTER TABLE otp_verifications DROP COLUMN reset_expires;


-- =====================================================
-- 8. CREATE REVIEWS TABLE (NEW)
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
-- 9. CREATE NOTIFICATIONS TABLE (NEW)
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
-- 10. CREATE ADMIN_ACTIVITY_LOG TABLE (NEW)
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
-- 11. DROP UNUSED TABLES (if exists)
-- =====================================================
-- DROP TABLE IF EXISTS restaurant_applications; -- If you want to recreate with new structure

-- =====================================================
-- 12. RECREATE RESTAURANT_APPLICATIONS (if needed)
-- =====================================================
-- Drop and recreate with new structure
DROP TABLE IF EXISTS restaurant_applications;

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
-- MIGRATION: Generate order numbers for existing orders
-- =====================================================
-- UPDATE orders SET order_number = CONCAT('TK-', DATE_FORMAT(created_at, '%Y'), '-', LPAD(id, 5, '0'));


-- =====================================================
-- MIGRATION: Update user roles (if needed)
-- =====================================================
-- UPDATE users SET role = 'restaurant_partner' WHERE role = 'restaurant_owner';
-- UPDATE users SET role = 'delivery_partner' WHERE role = 'delivery';
-- UPDATE users SET role = 'customer' WHERE role = 'user';


-- =====================================================
-- MIGRATION: Link orders to addresses
-- =====================================================
-- After creating addresses and populating them from existing orders:
-- UPDATE orders o 
-- SET address_id = (
--     SELECT id FROM addresses a 
--     WHERE a.user_id = o.user_id 
--     ORDER BY is_default DESC, id ASC 
--     LIMIT 1
-- )
-- WHERE address_id IS NULL;