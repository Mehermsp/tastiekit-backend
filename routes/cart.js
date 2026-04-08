function registerCartRoutes(app, { getPool }) {
    app.post("/cart", async (req, res) => {
        const { userId, items } = req.body;
        if (!userId) return res.status(400).json({ error: "Missing userId" });

        await getPool().query("DELETE FROM carts WHERE user_id = ?", [userId]);
        if (items && items.length) {
            const promises = items.map((it) =>
                getPool().query(
                    "INSERT INTO carts (user_id, menu_id, name, price, qty, restaurant_id) VALUES (?,?,?,?,?,?)",
                    [userId, it.id, it.name, it.price, it.qty, it.restaurantId || null]
                )
            );
            await Promise.all(promises);
        }
        res.json({ ok: true });
    });

    app.get("/cart/:userId", async (req, res) => {
        const userId = req.params.userId;
        const [rows] = await getPool().query(
            `SELECT c.menu_id as id, c.name, c.price, c.qty, c.restaurant_id,
                    m.restaurant_id as menu_restaurant_id,
                    r.name as restaurant_name
             FROM carts c
             LEFT JOIN menu_items m ON c.menu_id = m.id
             LEFT JOIN restaurants r ON COALESCE(c.restaurant_id, m.restaurant_id) = r.id
             WHERE c.user_id = ?`,
            [userId]
        );
        res.json(rows.map(row => ({
            ...row,
            restaurant_id: row.restaurant_id || row.menu_restaurant_id,
            restaurant_name: row.restaurant_name
        })));
    });
}

module.exports = registerCartRoutes;
