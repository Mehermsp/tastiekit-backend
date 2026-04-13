-- Quick fix: Run these SQL queries on your production database
-- to rename menu_id to menu_item_id and delivery_boy_id to delivery_partner_id

-- 1. Fix carts table
ALTER TABLE carts CHANGE COLUMN menu_id menu_item_id INT;

-- 2. Fix wishlists table  
ALTER TABLE wishlists CHANGE COLUMN menu_id menu_item_id INT;

-- 3. Fix order_items table
ALTER TABLE order_items CHANGE COLUMN menu_id menu_item_id INT;

-- 4. Fix orders table
ALTER TABLE orders CHANGE COLUMN delivery_boy_id delivery_partner_id INT;

-- 5. Rename menu to menu_items
RENAME TABLE menu TO menu_items;

-- 6. Rename menu_items.restaurant_id to ensure it exists (may already exist)
-- ALTER TABLE menu_items ADD COLUMN restaurant_id INT AFTER category;

-- 7. Add foreign key if needed
-- ALTER TABLE menu_items ADD FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
