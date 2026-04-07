function registerMenuRoutes(app, { getPool, ensureMealTypeColumn }) {
    app.get("/menu", async (req, res) => {
        try {
            console.log("Fetching menu from menu_items table...");
            const [rows] = await getPool().query(
                "SELECT * FROM menu_items ORDER BY popularity DESC LIMIT 100"
            );
            console.log("Menu query returned:", rows.length, "items");
            res.json(rows);
        } catch (err) {
            console.error("Menu fetch error:", err);
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/restaurants", async (req, res) => {
        try {
            const [rows] = await getPool().query(
                `SELECT id, owner_id, name, description, logo, cover_image, city, area, address,
                        pincode, landmark, cuisines, open_time, close_time, days_open,
                        fssai, gst, pan, status, is_approved, is_active, rating, total_orders,
                        total_revenue, created_at, updated_at
                 FROM restaurants
                 ORDER BY rating DESC, id ASC`
            );

            res.json(rows);
        } catch (err) {
            console.error("Restaurants fetch error:", err);
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/menu/debug", async (req, res) => {
        try {
            const [allItems] = await getPool().query(
                "SELECT * FROM menu_items ORDER BY id DESC LIMIT 50"
            );
            const [restaurants] = await getPool().query(
                "SELECT id, name, status FROM restaurants"
            );
            res.json({
                totalItems: allItems.length,
                items: allItems,
                restaurants: restaurants,
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/restaurants/:id", async (req, res) => {
        try {
            const restaurantId = parseInt(req.params.id, 10);
            if (isNaN(restaurantId)) {
                return res.status(400).json({ error: "Invalid restaurant ID" });
            }

            const [rows] = await getPool().query(
                `SELECT id, owner_id, name, description, logo, cover_image, city, area, address,
                        pincode, landmark, cuisines, open_time, close_time, days_open,
                        fssai, gst, pan, status, is_approved, is_active, rating, total_orders,
                        total_revenue, created_at, updated_at
                 FROM restaurants
                 WHERE id = ?`,
                [restaurantId]
            );

            if (!rows.length) {
                return res.status(404).json({ error: "Restaurant not found" });
            }

            res.json(rows[0]);
        } catch (err) {
            console.error("Restaurant fetch error:", err);
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/restaurants/:id/menu", async (req, res) => {
        try {
            const restaurantId = parseInt(req.params.id, 10);
            if (isNaN(restaurantId)) {
                return res.status(400).json({ error: "Invalid restaurant ID" });
            }

            const [restaurantRows] = await getPool().query(
                "SELECT id FROM restaurants WHERE id = ?",
                [restaurantId]
            );

            if (!restaurantRows.length) {
                return res.status(404).json({ error: "Restaurant not found" });
            }

            const [rows] = await getPool().query(
                `SELECT *
                 FROM menu_items
                 WHERE restaurant_id = ?
                 ORDER BY popularity DESC, id DESC`,
                [restaurantId]
            );

            res.json(rows);
        } catch (err) {
            console.error("Restaurant menu fetch error:", err);
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = registerMenuRoutes;
