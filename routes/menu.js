function registerMenuRoutes(app, { getPool, ensureMealTypeColumn }) {
    app.get("/menu", async (req, res) => {
        try {
            console.log("Fetching menu from menu_items table...");
            const [rows] = await getPool().query("SELECT * FROM menu_items ORDER BY popularity DESC LIMIT 100");
            console.log("Menu query returned:", rows.length, "items");
            res.json(rows);
        } catch (err) {
            console.error("Menu fetch error:", err);
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/menu/debug", async (req, res) => {
        try {
            const [allItems] = await getPool().query("SELECT * FROM menu_items ORDER BY id DESC LIMIT 50");
            const [restaurants] = await getPool().query("SELECT id, name, status FROM restaurants");
            res.json({
                totalItems: allItems.length,
                items: allItems,
                restaurants: restaurants
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = registerMenuRoutes;
