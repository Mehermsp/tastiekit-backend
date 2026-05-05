-- Expands orders.payment_status enum to support legacy + new values.
-- Run once on existing databases if payment-status updates fail with truncation.

ALTER TABLE orders
MODIFY COLUMN payment_status ENUM(
    'pending',
    'completed',
    'paid',
    'confirmed',
    'success',
    'failed',
    'refunded'
) NOT NULL DEFAULT 'pending';
