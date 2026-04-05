function registerMenuRoutes(app, { getPool, ensureMealTypeColumn }) {
    app.get("/menu", async (req, res) => {
        await ensureMealTypeColumn();
        const [rows] = await getPool().query(
            "SELECT id, name, description, price, image, category, meal_type, season, rating, discount, popularity FROM menu_items"
        );
        res.json(rows);
    });
}

module.exports = registerMenuRoutes;
