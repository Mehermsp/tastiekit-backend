require("dotenv").config();
const { initDb, getPool } = require("../config/db");
const DB_NAME = process.env.DB_NAME;

async function migrateToV2() {
    await initDb();
    const pool = getPool();

    console.log("🚀 Starting TastieKit Schema Migration v2...\n");

    try {
        // ========================================
        // 1. Update users table
        // ========================================
        console.log("📝 Updating users table...");

        // Check and add is_available column
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available TINYINT(1) DEFAULT 1
        `).catch(() => {});

        // Check and add profile_image column
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(1024)
        `).catch(() => {});

        console.log("   ✓ users table updated");

        // ========================================
        // 2. Rename menu to menu_items
        // ========================================
        console.log("📝 Renaming menu to menu_items...");

        // Check if menu_items exists
        const [menuItemsCheck] = await pool.query(`
            SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${DB_NAME}' AND TABLE_NAME = 'menu_items'
        `);

        if (menuItemsCheck[0].cnt === 0) {
            await pool.query(`RENAME TABLE menu TO menu_items`);
            console.log("   ✓ Renamed menu to menu_items");
        }

        // Add restaurant_id foreign key if missing
        try {
            await pool.query(`
                ALTER TABLE menu_items 
                ADD CONSTRAINT fk_menu_restaurant 
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
            `);
            console.log("   ✓ Added menu_items foreign key");
        } catch (e) {
            console.log("   - Foreign key already exists or skipped");
        }

        // ========================================
        // 3. Ensure restaurants table has all columns
        // ========================================
        console.log("📝 Updating restaurants table...");

        const restaurantCols = [
            { name: "cover_image", def: "VARCHAR(1024)" },
            { name: "is_active", def: "TINYINT(1) DEFAULT 1" },
            { name: "total_revenue", def: "DECIMAL(12,2) DEFAULT 0" }
        ];

        for (const col of restaurantCols) {
            try {
                await pool.query(`
                    ALTER TABLE restaurants ADD COLUMN ${col.name} ${col.def}
                `);
                console.log(`   ✓ Added ${col.name}`);
            } catch (e) {
                console.log(`   - ${col.name} already exists`);
            }
        }

        // ========================================
        // 4. Update orders table
        // ========================================
        console.log("📝 Updating orders table...");

        const orderCols = [
            { name: "order_number", def: "VARCHAR(50) UNIQUE" },
            { name: "address_id", def: "INT" },
            { name: "delivery_partner_id", def: "INT" },
            { name: "subtotal", def: "DECIMAL(10,2) DEFAULT 0" },
            { name: "discount_amount", def: "DECIMAL(10,2) DEFAULT 0" },
            { name: "delivery_fee", def: "DECIMAL(10,2) DEFAULT 0" },
            { name: "tax_amount", def: "DECIMAL(10,2) DEFAULT 0" },
            { name: "payment_method", def: "ENUM('cash','card','upi','wallet') DEFAULT 'cash'" },
            { name: "payment_status", def: "ENUM('pending','paid','failed','refunded') DEFAULT 'pending'" },
            { name: "estimated_delivery_time", def: "TIMESTAMP NULL" },
            { name: "actual_delivery_time", def: "TIMESTAMP NULL" },
            { name: "delivery_notes", def: "TEXT" },
            { name: "updated_at", def: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" }
        ];

        for (const col of orderCols) {
            try {
                await pool.query(`
                    ALTER TABLE orders ADD COLUMN ${col.name} ${col.def}
                `);
                console.log(`   ✓ Added ${col.name}`);
            } catch (e) {
                console.log(`   - ${col.name} already exists`);
            }
        }

        // Generate order numbers for existing orders
        console.log("   Generating order numbers...");
        const [ordersWithoutNumber] = await pool.query(`
            SELECT id, created_at FROM orders WHERE order_number IS NULL
        `);

        for (const order of ordersWithoutNumber) {
            const orderNum = `TK-${new Date(order.created_at).getFullYear()}-${String(order.id).padStart(5, '0')}`;
            await pool.query(`UPDATE orders SET order_number = ? WHERE id = ?`, [orderNum, order.id]);
        }
        console.log(`   ✓ Generated ${ordersWithoutNumber.length} order numbers`);

        // ========================================
        // 5. Create addresses table (if not exists)
        // ========================================
        console.log("📝 Creating addresses table...");

        const [addrTable] = await pool.query(`
            SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${DB_NAME}' AND TABLE_NAME = 'addresses'
        `);

        if (addrTable[0].cnt === 0) {
            await pool.query(`
                CREATE TABLE addresses (
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
                )
            `);
            console.log("   ✓ Created addresses table");

            // Migrate existing addresses from orders
            console.log("   Migrating existing address data...");
            const [ordersWithAddr] = await pool.query(`
                SELECT DISTINCT user_id, door_no, street, area, city, state, zip_code
                FROM orders 
                WHERE user_id IS NOT NULL AND door_no IS NOT NULL
            `);

            for (const addr of ordersWithAddr) {
                await pool.query(`
                    INSERT INTO addresses (user_id, door_no, street, area, city, state, pincode, is_default)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                `, [addr.user_id, addr.door_no, addr.street, addr.area, addr.city, addr.state, addr.zip_code]);
            }
            console.log(`   ✓ Migrated ${ordersWithAddr.length} addresses`);

            // Link orders to addresses
            console.log("   Linking orders to addresses...");
            const [ordersToLink] = await pool.query(`
                SELECT o.id, o.user_id FROM orders o WHERE o.address_id IS NULL
            `);

            for (const ord of ordersToLink) {
                const [addr] = await pool.query(`
                    SELECT id FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC LIMIT 1
                `, [ord.user_id]);
                if (addr.length > 0) {
                    await pool.query(`UPDATE orders SET address_id = ? WHERE id = ?`, [addr[0].id, ord.id]);
                }
            }
            console.log(`   ✓ Linked ${ordersToLink.length} orders to addresses`);
        }

        // ========================================
        // 6. Create delivery_assignments table
        // ========================================
        console.log("📝 Creating delivery_assignments table...");

        const [daTable] = await pool.query(`
            SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${DB_NAME}' AND TABLE_NAME = 'delivery_assignments'
        `);

        if (daTable[0].cnt === 0) {
            await pool.query(`
                CREATE TABLE delivery_assignments (
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
                )
            `);
            console.log("   ✓ Created delivery_assignments table");

            // Migrate existing delivery assignments
            console.log("   Migrating existing delivery data...");
            const [ordersWithDelivery] = await pool.query(`
                SELECT id, delivery_boy_id, delivery_partner_id, delivered_at
                FROM orders 
                WHERE delivery_boy_id IS NOT NULL OR delivery_partner_id IS NOT NULL
            `);

            for (const ord of ordersWithDelivery) {
                const partnerId = ord.delivery_partner_id || ord.delivery_boy_id;
                if (partnerId) {
                    await pool.query(`
                        INSERT INTO delivery_assignments (order_id, delivery_partner_id, status, delivery_time)
                        VALUES (?, ?, 'completed', ?)
                    `, [ord.id, partnerId, ord.delivered_at]);
                }
            }
            console.log(`   ✓ Migrated ${ordersWithDelivery.length} delivery assignments`);
        }

        // ========================================
        // 7. Create reviews table
        // ========================================
        console.log("📝 Creating reviews table...");

        const [revTable] = await pool.query(`
            SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${DB_NAME}' AND TABLE_NAME = 'reviews'
        `);

        if (revTable[0].cnt === 0) {
            await pool.query(`
                CREATE TABLE reviews (
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
                )
            `);
            console.log("   ✓ Created reviews table");
        }

        // ========================================
        // 8. Create notifications table
        // ========================================
        console.log("📝 Creating notifications table...");

        const [notifTable] = await pool.query(`
            SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${DB_NAME}' AND TABLE_NAME = 'notifications'
        `);

        if (notifTable[0].cnt === 0) {
            await pool.query(`
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
                )
            `);
            console.log("   ✓ Created notifications table");
        }

        // ========================================
        // 9. Rename otp_codes to otp_verifications
        // ========================================
        console.log("📝 Updating otp_codes table...");

        const [otpCheck] = await pool.query(`
            SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${DB_NAME}' AND TABLE_NAME = 'otp_verifications'
        `);

        if (otpCheck[0].cnt === 0) {
            await pool.query(`RENAME TABLE otp_codes TO otp_verifications`);
            console.log("   ✓ Renamed otp_codes to otp_verifications");
        }

        // Add is_used column
        try {
            await pool.query(`
                ALTER TABLE otp_verifications ADD COLUMN is_used TINYINT(1) DEFAULT 0
            `);
            console.log("   ✓ Added is_used column");
        } catch (e) {
            console.log("   - is_used column already exists");
        }

        // ========================================
        // 10. Update user roles
        // ========================================
        console.log("📝 Updating user roles...");

        await pool.query(`UPDATE users SET role = 'customer' WHERE role = 'user'`);
        await pool.query(`UPDATE users SET role = 'restaurant_partner' WHERE role = 'restaurant_owner'`);
        await pool.query(`UPDATE users SET role = 'delivery_partner' WHERE role = 'delivery'`);

        const [roleCount] = await pool.query(`
            SELECT role, COUNT(*) as cnt FROM users GROUP BY role
        `);
        console.log("   ✓ User roles updated");
        console.table(roleCount);

        // ========================================
        // FINAL: Show summary
        // ========================================
        console.log("\n📊 Database Migration Summary:\n");

        const tables = [
            'users', 'addresses', 'restaurants', 'menu_items', 
            'orders', 'order_items', 'carts', 'wishlists',
            'delivery_assignments', 'restaurant_applications', 
            'otp_verifications', 'reviews', 'notifications'
        ];

        for (const table of tables) {
            try {
                const [count] = await pool.query(`SELECT COUNT(*) as cnt FROM ${table}`);
                console.log(`   ${table}: ${count[0].cnt} rows`);
            } catch (e) {
                console.log(`   ${table}: table not found`);
            }
        }

        console.log("\n✅ Migration completed successfully!");
        console.log("\n⚠️  IMPORTANT NEXT STEPS:");
        console.log("   1. Test user login with new role-based system");
        console.log("   2. Test restaurant partner access");
        console.log("   3. Test order placement flow");
        console.log("   4. Verify delivery assignment workflow");
        console.log("   5. Update frontend API calls if needed");

    } catch (error) {
        console.error("\n❌ Migration failed:", error.message);
        console.error(error.stack);
        process.exit(1);
    }

    process.exit(0);
}

// Run if called directly
if (require.main === module) {
    migrateToV2();
}

module.exports = { migrateToV2 };