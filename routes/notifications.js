function registerNotificationRoutes(app, { getPool, requireSelfOrAdmin }) {
    // Get user notifications
    app.get(
        "/user/:userId/notifications",
        requireSelfOrAdmin,
        async (req, res) => {
            try {
                const userId = parseInt(req.params.userId);
                const limit = parseInt(req.query.limit) || 20;
                const offset = parseInt(req.query.offset) || 0;
                const unreadOnly = req.query.unread === "true";

                let query = `
                SELECT id, title, message, type, data, is_read, read_at, created_at
                FROM notifications
                WHERE user_id = ?
            `;
                const params = [userId];

                if (unreadOnly) {
                    query += " AND is_read = 0";
                }

                query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
                params.push(limit, offset);

                const [notifications] = await getPool().query(query, params);

                // Parse JSON data for each notification
                const parsed = notifications.map((n) => ({
                    ...n,
                    data: n.data ? JSON.parse(n.data) : null,
                }));

                res.json(parsed);
            } catch (error) {
                console.error("Get notifications error:", error);
                res.status(500).json({
                    error: "Failed to fetch notifications",
                });
            }
        }
    );

    // Get unread notification count
    app.get(
        "/user/:userId/notifications/unread/count",
        requireSelfOrAdmin,
        async (req, res) => {
            try {
                const userId = parseInt(req.params.userId);

                const [result] = await getPool().query(
                    "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
                    [userId]
                );

                res.json({ unreadCount: result[0].count });
            } catch (error) {
                console.error("Get unread count error:", error);
                res.status(500).json({ error: "Failed to fetch unread count" });
            }
        }
    );

    // Mark notification as read
    app.put("/notifications/:notificationId/read", async (req, res) => {
        try {
            const notificationId = parseInt(req.params.notificationId);
            const requesterId = parseInt(req.headers.userid);

            // Verify notification belongs to user
            const [notifications] = await getPool().query(
                "SELECT user_id FROM notifications WHERE id = ?",
                [notificationId]
            );

            if (
                !notifications.length ||
                notifications[0].user_id !== requesterId
            ) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            await getPool().query(
                "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?",
                [notificationId]
            );

            res.json({ ok: true });
        } catch (error) {
            console.error("Mark as read error:", error);
            res.status(500).json({
                error: "Failed to mark notification as read",
            });
        }
    });

    // Mark all notifications as read
    app.put(
        "/user/:userId/notifications/read-all",
        requireSelfOrAdmin,
        async (req, res) => {
            try {
                const userId = parseInt(req.params.userId);

                await getPool().query(
                    "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0",
                    [userId]
                );

                res.json({ ok: true });
            } catch (error) {
                console.error("Mark all as read error:", error);
                res.status(500).json({ error: "Failed to mark all as read" });
            }
        }
    );

    // Delete notification
    app.delete("/notifications/:notificationId", async (req, res) => {
        try {
            const notificationId = parseInt(req.params.notificationId);
            const requesterId = parseInt(req.headers.userid);

            // Verify notification belongs to user
            const [notifications] = await getPool().query(
                "SELECT user_id FROM notifications WHERE id = ?",
                [notificationId]
            );

            if (
                !notifications.length ||
                notifications[0].user_id !== requesterId
            ) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            await getPool().query("DELETE FROM notifications WHERE id = ?", [
                notificationId,
            ]);

            res.json({ ok: true });
        } catch (error) {
            console.error("Delete notification error:", error);
            res.status(500).json({ error: "Failed to delete notification" });
        }
    });

    // Clear all notifications
    app.delete(
        "/user/:userId/notifications/clear-all",
        requireSelfOrAdmin,
        async (req, res) => {
            try {
                const userId = parseInt(req.params.userId);

                await getPool().query(
                    "DELETE FROM notifications WHERE user_id = ?",
                    [userId]
                );

                res.json({ ok: true });
            } catch (error) {
                console.error("Clear all notifications error:", error);
                res.status(500).json({
                    error: "Failed to clear notifications",
                });
            }
        }
    );

    // Send notification (internal helper for other endpoints)
    async function sendNotification(userId, title, message, type, data = null) {
        try {
            await getPool().query(
                `INSERT INTO notifications (user_id, title, message, type, data, is_read, created_at)
                 VALUES (?, ?, ?, ?, ?, 0, NOW())`,
                [
                    userId,
                    title,
                    message,
                    type,
                    data ? JSON.stringify(data) : null,
                ]
            );
        } catch (error) {
            console.error("Send notification error:", error);
        }
    }

    // Export helper for use in other routes
    return { sendNotification };
}

module.exports = registerNotificationRoutes;
