-- Adds payment_confirmed to delivery_assignments.status enum
-- Run this once on existing databases.

ALTER TABLE delivery_assignments
MODIFY COLUMN status ENUM(
    'assigned',
    'accepted',
    'payment_confirmed',
    'rejected',
    'picked_up',
    'delivered'
) NOT NULL DEFAULT 'assigned';
