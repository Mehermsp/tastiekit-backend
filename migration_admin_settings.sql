-- Migration: Add admin_settings table for storing admin configuration
-- Run this on your database to add the settings table

CREATE TABLE IF NOT EXISTS admin_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO admin_settings (setting_key, setting_value) VALUES
  -- General Settings
  ('general_platform_name', 'TastieKit'),
  ('general_support_email', 'support@tastiekit.com'),
  ('general_support_phone', '+91 9876543210'),
  ('general_currency', 'INR'),
  ('general_timezone', 'Asia/Kolkata'),
  
  -- Notification Settings
  ('notification_email_notifications', 'true'),
  ('notification_sms_notifications', 'false'),
  ('notification_push_notifications', 'true'),
  ('notification_new_order_alert', 'true'),
  ('notification_new_application_alert', 'true'),
  ('notification_low_stock_alert', 'false'),
  
  -- Security Settings
  ('security_two_factor_auth', 'false'),
  ('security_session_timeout', '30'),
  ('security_password_expiry_days', '90'),
  ('security_max_login_attempts', '5'),
  
  -- Restaurant Commission Settings
  ('commission_percentage', '15'),
  ('commission_fixed_fee', '0'),
  ('commission_min_order_amount', '100'),
  ('commission_max_commission', '500'),
  
  -- Delivery Settings
  ('delivery_base_delivery_fee', '30'),
  ('delivery_per_km_rate', '10'),
  ('delivery_min_delivery_fee', '25'),
  ('delivery_max_delivery_fee', '100'),
  ('delivery_peak_hour_multiplier', '1.5'),
  ('delivery_peak_hours', '12:00-14:00,19:00-22:00')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);