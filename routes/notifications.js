const { notifyUser, bus } = require("../lib/notificationBus");

function parseNotificationData(raw) {
    if (raw == null) return null;
    if (typeof raw === "object") return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function registerNotificationRoutes(app, { getPool, requireSelfOrAdmin }) {
    // Realtime stream (SSE). Uses session userId or `userid` header (same as other APIs).
    app.get("/notifications/stream", (req, res) => {
        const sessionUid = req.session && req.session.userId;
        const headerUid = parseInt(req.headers.userid, 10);
        const userId = sessionUid || (Number.isFinite(headerUid) ? headerUid : null);

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }

        const channel = `user:${userId}`;
        const onPush = (payload) => {
            try {
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            } catch {
                /* client gone */
            }
        };

        bus.on(channel, onPush);
        res.write(`data: ${JSON.stringify({ type: "connected", at: Date.now() })}\n\n`);

        const ping = setInterval(() => {
            try {
                res.write(`: ping ${Date.now()}\n\n`);
            } catch {
                clearInterval(ping);
            }
        }, 25000);

        req.on("close", () => {
            clearInterval(ping);
            bus.off(channel, onPush);
        });
    });

    // Lightweight poll helper (mobile / clients without SSE)
    app.get(
        "/user/:userId/notifications/summary",
        requireSelfOrAdmin,
        async (req, res) => {
            try {
                const userId = parseInt(req.params.userId, 10);
                const [[row]] = await getPool().query(
                    `SELECT
                        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unreadCount,
                        COALESCE(MAX(id), 0) AS maxId
                     FROM notifications WHERE user_id = ?`,
                    [userId]
                );
                res.json({
                    unreadCount: Number(row?.unreadCount || 0),
                    maxId: Number(row?.maxId || 0),
                });
            } catch (error) {
                console.error("Notification summary error:", error);
                res.status(500).json({ error: "Failed to fetch summary" });
            }
        }
    );

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
                const afterId = parseInt(req.query.afterId, 10);

                let query = `
                SELECT id, title, message, type, data, is_read, read_at, created_at
                FROM notifications
                WHERE user_id = ?
            `;
                const params = [userId];

                if (unreadOnly) {
                    query += " AND is_read = 0";
                }

                if (Number.isFinite(afterId) && afterId > 0) {
                    query += " AND id > ?";
                    params.push(afterId);
                }

                query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
                params.push(limit, offset);

                const [notifications] = await getPool().query(query, params);

                const parsed = notifications.map((n) => ({
                    ...n,
                    data: parseNotificationData(n.data),
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
            notifyUser(userId, { title, message, type });
        } catch (error) {
            console.error("Send notification error:", error);
        }
    }

    // Export helper for use in other routes
    return { sendNotification };
}

module.exports = registerNotificationRoutes;
