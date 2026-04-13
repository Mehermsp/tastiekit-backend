function createRestaurantMiddleware(getPool) {
    return async function requireRestaurantPartner(req, res, next) {
        const userId = req.headers.userid;
        
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        try {
            const [users] = await getPool().query(
                "SELECT id, name, email, phone, role FROM users WHERE id = ?",
                [userId]
            );

            if (!users.length) {
                return res.status(401).json({ error: "User not found" });
            }

            const user = users[0];

            if (user.role !== 'restaurant_partner') {
                return res.status(403).json({ 
                    error: "Access denied. Restaurant partner account required.",
                    yourRole: user.role
                });
            }

            req.user = user;
            next();
        } catch (err) {
            console.error("Restaurant middleware error:", err);
            res.status(500).json({ error: "Server error" });
        }
    };
}

module.exports = createRestaurantMiddleware;
