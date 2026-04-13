function createRequireSelfOrAdmin(getPool, paramName = "userId") {
    return async (req, res, next) => {
        const requesterId = parseInt(req.headers.userid, 10);
        const targetId = parseInt(req.params[paramName], 10);

        if (!requesterId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (requesterId === targetId) {
            return next();
        }

        const [rows] = await getPool().query("SELECT role FROM users WHERE id = ?", [
            requesterId,
        ]);

        if (!rows.length || rows[0].role !== "admin") {
            return res.status(403).json({ error: "Forbidden" });
        }

        next();
    };
}

module.exports = createRequireSelfOrAdmin;
