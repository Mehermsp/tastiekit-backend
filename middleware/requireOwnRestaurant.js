function createRestaurantRouteMiddleware(getPool) {
    return async function requireOwnRestaurant(req, res, next) {
        const userId = req.headers.userid;
        const restaurantId = req.params.restaurantId || req.params.id;
        
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!restaurantId) {
            return res.status(400).json({ error: "Restaurant ID required" });
        }

        try {
            // Check user is a restaurant partner
            const [users] = await getPool().query(
                "SELECT role FROM users WHERE id = ?",
                [userId]
            );

            if (!users.length || users[0].role !== 'restaurant_partner') {
                return res.status(403).json({ error: "Access denied" });
            }

            // Check restaurant belongs to this user
            const [restaurants] = await getPool().query(
                "SELECT id FROM restaurants WHERE id = ? AND owner_id = ?",
                [restaurantId, userId]
            );

            if (!restaurants.length) {
                return res.status(403).json({ error: "You don't own this restaurant" });
            }

            next();
        } catch (err) {
            console.error("Restaurant route middleware error:", err);
            res.status(500).json({ error: "Server error" });
        }
    };
}

module.exports = createRestaurantRouteMiddleware;
