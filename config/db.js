const mysql = require("mysql2/promise");

let pool;
let availabilityColumnReady = false;
let mealTypeColumnReady = false;
let orderColumnsReady = false;

async function ensureColumn(tableName, columnName, definition) {
    const [rows] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
        [process.env.DB_NAME, tableName, columnName]
    );

    if (!rows.length) {
        await pool.query(
            `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
        );
        console.log(`Added ${tableName}.${columnName} column`);
    }
}

async function ensureAvailabilityColumn() {
    if (availabilityColumnReady) {
        return;
    }

    const [availabilityColumn] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'is_available'
    `,
        [process.env.DB_NAME]
    );

    if (!availabilityColumn.length) {
        await pool.query(
            "ALTER TABLE users ADD COLUMN is_available TINYINT(1) NOT NULL DEFAULT 1"
        );
        console.log("Added users.is_available column");
    }

    availabilityColumnReady = true;
}

async function ensureMealTypeColumn() {
    if (mealTypeColumnReady) {
        return;
    }

    const [mealTypeColumn] = await pool.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'menu'
        AND COLUMN_NAME = 'meal_type'
    `,
        [process.env.DB_NAME]
    );

    if (!mealTypeColumn.length) {
        await pool.query(
            "ALTER TABLE menu ADD COLUMN meal_type VARCHAR(30) NOT NULL DEFAULT 'Lunch' AFTER category"
        );
        console.log("Added menu.meal_type column");

        await pool.query(`
            UPDATE menu
            SET meal_type = CASE
                WHEN LOWER(name) REGEXP 'dosa|idli|uttapam|vada|sambhar|sambar|chai|coffee|lassi|sandwich'
                    OR category = 'South Indian'
                THEN 'Breakfast'
                WHEN LOWER(name) REGEXP 'samosa|roll|fries|65|tikka|vada pav|spring|brownie|jamun|jalebi|kulfi|rasmalai|ice cream|soda|lemonade'
                    OR category IN ('Street Food', 'Street', 'Starters', 'Dessert', 'Drinks')
                THEN 'Snacks'
                WHEN LOWER(name) REGEXP 'pizza|noodles|fried rice|chicken|fish|mutton|prawn|chettinad|tandoori|butter chicken'
                THEN 'Dinner'
                ELSE 'Lunch'
            END
        `);
    }

    mealTypeColumnReady = true;
}

async function ensureOrderColumns() {
    if (orderColumnsReady) {
        return;
    }

    const orderColumns = [
        ["restaurant_id", "INT AFTER user_id"],
        ["payment_method", "VARCHAR(50) AFTER status"],
        ["payment_status", "VARCHAR(50) DEFAULT 'pending' AFTER payment_method"],
        ["payment_id", "VARCHAR(255) AFTER payment_status"],
        ["address_id", "INT AFTER delivery_partner_id"],
        ["subtotal", "DECIMAL(10,2) DEFAULT 0 AFTER address_id"],
        ["delivery_fee", "DECIMAL(10,2) DEFAULT 0 AFTER discount_amount"],
        ["order_number", "VARCHAR(50) AFTER delivered_at"],
        ["door_no", "VARCHAR(255) AFTER driver"],
        ["street", "VARCHAR(255) AFTER door_no"],
        ["area", "VARCHAR(255) AFTER street"],
        ["city", "VARCHAR(100) AFTER area"],
        ["state", "VARCHAR(100) AFTER city"],
        ["zip_code", "VARCHAR(20) AFTER state"],
        ["phone", "VARCHAR(30) AFTER address"],
        ["notes", "TEXT AFTER phone"],
    ];

    for (const [columnName, definition] of orderColumns) {
        await ensureColumn("orders", columnName, definition);
    }

    orderColumnsReady = true;
}

async function initDb() {
    const config = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 10000,
    };

    if (process.env.DB_SSL === "true") {
        config.ssl = {
            rejectUnauthorized: process.env.DB_SSL_REJECT !== "false",
        };
        console.log("SSL enabled for DB connection");
    }

    pool = await mysql.createPool(config);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS wishlists (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            menu_id INT,
            name VARCHAR(255),
            price DECIMAL(10,2),
            image VARCHAR(1024),
            description TEXT,
            category VARCHAR(50),
            discount INT DEFAULT 0,
            KEY idx_user_id (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Reviews table for customer feedback
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            restaurant_id INT,
            menu_item_id INT,
            order_id INT,
            rating DECIMAL(3,1) NOT NULL,
            comment TEXT,
            delivery_rating DECIMAL(3,1),
            delivery_comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_user_id (user_id),
            KEY idx_restaurant_id (restaurant_id),
            KEY idx_menu_item_id (menu_item_id),
            KEY idx_order_id (order_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
        )
    `);

    await ensureAvailabilityColumn();
    await ensureMealTypeColumn();
    await ensureOrderColumns();
}

function getPool() {
    return pool;
}

module.exports = {
    initDb,
    getPool,
    ensureAvailabilityColumn,
    ensureMealTypeColumn,
    ensureOrderColumns,
};
