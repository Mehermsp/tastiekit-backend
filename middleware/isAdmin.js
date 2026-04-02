function createIsAdmin(getPool) {
    return async (req, res, next) => {
        const userId = req.headers.userid;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const [rows] = await getPool().query("SELECT role FROM users WHERE id = ?", [
            userId,
        ]);

        if (!rows.length || rows[0].role !== "admin") {
            return res.status(403).json({ error: "Admin access required" });
        }

        next();
    };
}

module.exports = createIsAdmin;
