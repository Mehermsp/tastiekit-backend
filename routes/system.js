function registerSystemRoutes(app, { getPool }) {
    app.get("/ping", (req, res) => {
        res.json({
            ok: true,
            ts: new Date().toISOString(),
            version: process.env.COMMIT_HASH || "dev",
        });
    });

    app.get("/health", async (req, res) => {
        try {
            const [result] = await getPool().query("SELECT 1 as alive");
            res.json({
                ok: true,
                server: "running",
                database: result[0].alive ? "connected" : "failed",
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            console.error("Health check database error:", err.message);
            res.status(503).json({
                ok: false,
                server: "running",
                database: "disconnected",
                error: err.message,
                timestamp: new Date().toISOString(),
            });
        }
    });

    app.get("/diagnostics", async (req, res) => {
        try {
            const [otps] = await getPool().query(
                "SELECT email, type, expires_at, reset_token FROM otp_codes ORDER BY id DESC LIMIT 10"
            );

            res.json({
                server: "running",
                timestamp: new Date().toISOString(),
                emailService: "Brevo",
                brevoKey: process.env.BREVO_API_KEY ? "configured" : "missing",
                database: {
                    host: process.env.DB_HOST || "not set",
                    port: process.env.DB_PORT || "not set",
                    ssl: process.env.DB_SSL || "false",
                },
                otp_codes: {
                    count: otps.length,
                    recent: otps,
                },
            });
        } catch (err) {
            res.status(500).json({
                error: "Diagnostics failed",
                details: err.message,
            });
        }
    });

    // 🚀 ONE-CLICK DB SEEDING - Visit http://localhost:8000/seed
    app.get("/seed", async (req, res) => {
        let connection;
        try {
            connection = await getPool().getConnection();
            await connection.beginTransaction();

            console.log("🌱 Starting DB seed...");

            // 1. SEED RESTAURANTS (3 sample restaurants)
            const restaurants = [
                {
                    name: "Spice Palace",
                    description: "Authentic North Indian cuisine",
                    city: "Mumbai",
                    area: "Bandra",
                    cuisines: JSON.stringify(["North Indian", "Mughlai"]),
                    open_time: "10:00",
                    close_time: "23:00",
                    days_open: JSON.stringify([
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                        "Sun",
                    ]),
                    logo: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200",
                    cover_image:
                        "https://images.unsplash.com/photo-1579751908085-85f22bd0b273?w=800",
                    status: "approved",
                    is_active: 1,
                    rating: 4.7,
                },
                {
                    name: "Pizza House",
                    description: "Fresh Italian pizzas & pastas",
                    city: "Mumbai",
                    area: "Andheri",
                    cuisines: JSON.stringify(["Italian", "Pizza"]),
                    open_time: "11:00",
                    close_time: "23:00",
                    days_open: JSON.stringify([
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                        "Sun",
                    ]),
                    logo: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200",
                    cover_image:
                        "https://images.unsplash.com/photo-1574071318508-1cdbab80d174?w=800",
                    status: "approved",
                    is_active: 1,
                    rating: 4.5,
                },
                {
                    name: "Burger Barn",
                    description: "Juicy burgers & shakes",
                    city: "Mumbai",
                    area: "Juhu",
                    cuisines: JSON.stringify([
                        "American",
                        "Fast Food",
                        "Burgers",
                    ]),
                    open_time: "12:00",
                    close_time: "01:00",
                    days_open: JSON.stringify([
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                        "Sun",
                    ]),
                    logo: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200",
                    cover_image:
                        "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800",
                    status: "approved",
                    is_active: 1,
                    rating: 4.6,
                },
            ];

            // Clear existing data
            await connection.query("DELETE FROM menu_items");
            await connection.query("DELETE FROM carts");
            await connection.query(
                "DELETE FROM restaurants WHERE id IN (1,2,3)"
            );

            // Insert restaurants
            for (const restaurant of restaurants) {
                await connection.query(
                    `
                    INSERT INTO restaurants (name, description, city, area, cuisines, open_time, close_time, 
                                           days_open, logo, cover_image, status, is_active, rating, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `,
                    [
                        restaurant.name,
                        restaurant.description,
                        restaurant.city,
                        restaurant.area,
                        restaurant.cuisines,
                        restaurant.open_time,
                        restaurant.close_time,
                        restaurant.days_open,
                        restaurant.logo,
                        restaurant.cover_image,
                        restaurant.status,
                        restaurant.is_active,
                        restaurant.rating,
                    ]
                );
            }

            // 2. SEED MENU ITEMS (8 per restaurant = 24 total)
            const menuItems = [
                // Spice Palace (Indian)
                {
                    restaurant_id: 1,
                    name: "Butter Chicken",
                    price: 280,
                    rating: 4.8,
                    popularity: 98,
                },
                {
                    restaurant_id: 1,
                    name: "Dal Makhani",
                    price: 220,
                    rating: 4.6,
                    popularity: 92,
                },
                {
                    restaurant_id: 1,
                    name: "Paneer Tikka",
                    price: 320,
                    rating: 4.7,
                    popularity: 89,
                },
                {
                    restaurant_id: 1,
                    name: "Chicken Biryani",
                    price: 380,
                    rating: 4.9,
                    popularity: 95,
                },
                {
                    restaurant_id: 1,
                    name: "Chicken 65",
                    price: 290,
                    rating: 4.7,
                    popularity: 88,
                },
                {
                    restaurant_id: 1,
                    name: "Naan Basket",
                    price: 180,
                    rating: 4.5,
                    popularity: 85,
                },

                // Pizza House (Italian)
                {
                    restaurant_id: 2,
                    name: "Margherita Pizza (Med)",
                    price: 450,
                    rating: 4.5,
                    popularity: 87,
                },
                {
                    restaurant_id: 2,
                    name: "Pepperoni Pizza (Lrg)",
                    price: 520,
                    rating: 4.7,
                    popularity: 91,
                },
                {
                    restaurant_id: 2,
                    name: "Pasta Alfredo",
                    price: 320,
                    rating: 4.4,
                    popularity: 85,
                },
                {
                    restaurant_id: 2,
                    name: "Garlic Bread",
                    price: 160,
                    rating: 4.4,
                    popularity: 82,
                },
                {
                    restaurant_id: 2,
                    name: "Tiramisu",
                    price: 220,
                    rating: 4.6,
                    popularity: 90,
                },

                // Burger Barn (American)
                {
                    restaurant_id: 3,
                    name: "Classic Beef Burger",
                    price: 280,
                    rating: 4.6,
                    popularity: 93,
                },
                {
                    restaurant_id: 3,
                    name: "Crispy Chicken Burger",
                    price: 320,
                    rating: 4.8,
                    popularity: 96,
                },
                {
                    restaurant_id: 3,
                    name: "Veggie Delight",
                    price: 260,
                    rating: 4.3,
                    popularity: 82,
                },
                {
                    restaurant_id: 3,
                    name: "Onion Rings",
                    price: 190,
                    rating: 4.5,
                    popularity: 87,
                },
                {
                    restaurant_id: 3,
                    name: "Oreo Milkshake",
                    price: 150,
                    rating: 4.7,
                    popularity: 94,
                },
            ];

            for (const item of menuItems) {
                await connection.query(
                    `
                    INSERT INTO menu_items (restaurant_id, name, price, rating, popularity, available, created_at) 
                    VALUES (?, ?, ?, ?, ?, 1, NOW())
                `,
                    [
                        item.restaurant_id,
                        item.name,
                        item.price,
                        item.rating,
                        item.popularity,
                    ]
                );
            }

            // 3. SEED TEST USERS
            await connection.query(
                "DELETE FROM users WHERE email LIKE '%@test%'"
            );
            await connection.query(`
                INSERT INTO users (name, email, password, phone, role, created_at) VALUES 
                ('Admin User', 'admin@test.com', '$2b$10$samplehash123456789', '+919876543210', 'admin', NOW()),
                ('Customer Test', 'customer@test.com', '$2b$10$samplehash123456789', '+919999988888', 'customer', NOW()),
                ('Restaurant Owner', 'owner@test.com', '$2b$10$samplehash123456789', '+919111122222', 'restaurant_owner', NOW())
            `);

            await connection.commit();

            console.log(
                "✅ SEED COMPLETE: 3 restaurants, 24 menu items, 3 test users"
            );

            res.json({
                success: true,
                seeded: {
                    restaurants: 3,
                    menu_items: menuItems.length,
                    users: 3,
                },
                message: "Database seeded successfully! 🎉",
                next: "Restart app → http://localhost:8000/menu should show data",
            });
        } catch (err) {
            if (connection) await connection.rollback();
            console.error("Seed failed:", err);
            res.status(500).json({ error: err.message, seeded: false });
        } finally {
            if (connection) connection.release();
        }
    });

    app.get("/seed-status", async (req, res) => {
        try {
            const [restaurants] = await getPool().query(
                "SELECT COUNT(*) as count FROM restaurants"
            );
            const [menuItems] = await getPool().query(
                "SELECT COUNT(*) as count FROM menu_items"
            );
            const [users] = await getPool().query(
                "SELECT COUNT(*) as count FROM users WHERE role != 'system'"
            );

            res.json({
                ready: restaurants[0].count > 0 && menuItems[0].count > 0,
                stats: {
                    restaurants: restaurants[0].count,
                    menu_items: menuItems[0].count,
                    users: users[0].count,
                },
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}
module.exports = registerSystemRoutes;
