-- Add missing timestamp columns to delivery_assignments table
-- This SQL fixes the API error: Unknown column 'da.picked_up_at' in 'field list'

-- First, check if columns exist and add them if they don't
-- For picked_up_at column
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP NULL;

-- For delivered_at column  
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL;

-- Alternative: If above doesn't work (MySQL doesn't support ADD COLUMN IF NOT EXISTS)
-- Run these one by one:

-- ALTER TABLE delivery_assignments ADD COLUMN picked_up_at TIMESTAMP NULL;
-- ALTER TABLE delivery_assignments ADD COLUMN delivered_at TIMESTAMP NULL;

-- If columns already exist but need to be renamed from old names:
-- ALTER TABLE delivery_assignments CHANGE COLUMN pickup_time picked_up_at TIMESTAMP NULL;
-- ALTER TABLE delivery_assignments CHANGE COLUMN delivery_time delivered_at TIMESTAMP NULL;

-- Verify columns were added:
-- DESCRIBE delivery_assignments;
