function registerMenuRoutes(app, { getPool, ensureMealTypeColumn }) {
    app.get("/menu", async (req, res) => {
        try {
            const [rows] = await getPool().query(
                `SELECT mi.id, mi.name, mi.description, mi.price, mi.image, mi.category, 
                        mi.meal_type, mi.season, mi.rating, mi.discount, mi.popularity,
                        mi.restaurant_id, r.name as restaurant_name,
                        mi.available, mi.is_available, mi.food_type
                 FROM menu_items mi
                 LEFT JOIN restaurants r ON mi.restaurant_id = r.id
                 WHERE (mi.available = 1 OR mi.is_available = 1 OR mi.available IS NULL)
                 ORDER BY mi.popularity DESC`
            );
            res.json(rows);
        } catch (err) {
            console.error("Menu fetch error:", err);
            res.status(500).json({ error: "Failed to fetch menu" });
        }
    });

    app.get("/menu/debug", async (req, res) => {
        try {
            const [allItems] = await getPool().query("SELECT * FROM menu_items ORDER BY id DESC LIMIT 50");
            const [availableCount] = await getPool().query("SELECT COUNT(*) as cnt FROM menu_items WHERE available = 1 OR is_available = 1");
            const [restaurants] = await getPool().query("SELECT id, name, status FROM restaurants");
            res.json({
                totalItems: allItems.length,
                availableItems: availableCount[0].cnt,
                items: allItems,
                restaurants: restaurants
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = registerMenuRoutes;
