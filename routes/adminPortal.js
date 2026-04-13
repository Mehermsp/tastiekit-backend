const MENU_INTERVENTION_REASONS = new Set([
    "policy_violation",
    "temporary_unavailable",
    "seasonal_adjustment",
    "catalog_quality",
    "emergency_fix",
]);

function parseNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeJsonField(value, fallback = []) {
    if (value == null) return fallback;
    if (Array.isArray(value)) return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

async function logAdminAction(pool, adminId, entityType, entityId, action, details) {
    try {
        await pool.query(
            `INSERT INTO admin_activity_log (admin_id, entity_type, entity_id, action, details, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
                adminId,
                entityType,
                entityId || null,
                action,
                details ? JSON.stringify(details) : null,
            ]
        );
    } catch (error) {
        console.error("Admin activity log failed:", error.message);
    }
}

async function sendBulkNotifications(pool, userIds, title, message, type, data = null) {
    if (!userIds.length) return 0;
    const values = userIds.map((userId) => [
        userId,
        title,
        message,
        type,
        data ? JSON.stringify(data) : null,
        0,
        new Date(),
    ]);
    await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, data, is_read, created_at)
         VALUES ?`,
        [values]
    );
    return userIds.length;
}

function registerAdminPortalRoutes(app, { getPool, isAdmin, ensureColumns }) {
    app.get("/admin/portal/overview", isAdmin, async (_req, res) => {
        try {
            await ensureColumns();
            const [[counts]] = await getPool().query(`
                SELECT
                    (SELECT COUNT(*) FROM restaurant_applications WHERE LOWER(status) = 'pending') AS pending_applications,
                    (SELECT COUNT(*) FROM restaurants) AS restaurants_count,
                    (SELECT COUNT(*) FROM orders WHERE delivery_partner_id IS NULL AND LOWER(status) NOT IN ('delivered', 'cancelled')) AS unassigned_orders,
                    (SELECT COUNT(*) FROM users WHERE LOWER(TRIM(role)) = 'delivery_partner') AS delivery_partners_count
            `);
            const [[income]] = await getPool().query(`
                SELECT
                    COALESCE(SUM(o.total), 0) AS gross_income,
                    COALESCE(SUM(o.total * (r.platform_fee_percent / 100)), 0) AS platform_income,
                    COALESCE(SUM(o.total - (o.total * (r.platform_fee_percent / 100))), 0) AS restaurant_income,
                    COALESCE(SUM(CASE WHEN o.delivery_partner_id IS NOT NULL THEN dp.delivery_fee_per_order ELSE 0 END), 0) AS delivery_income
                FROM orders o
                JOIN restaurants r ON o.restaurant_id = r.id
                LEFT JOIN users dp ON o.delivery_partner_id = dp.id
                WHERE LOWER(o.status) = 'delivered'
            `);

            res.json({
                ...counts,
                gross_income: Number(parseNumber(income.gross_income).toFixed(2)),
                platform_income: Number(parseNumber(income.platform_income).toFixed(2)),
                restaurant_income: Number(parseNumber(income.restaurant_income).toFixed(2)),
                delivery_income: Number(parseNumber(income.delivery_income).toFixed(2)),
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to load admin portal overview" });
        }
    });

    app.get("/admin/portal/applications", isAdmin, async (req, res) => {
        try {
            const { status } = req.query;
            let query = `
                SELECT
                    ra.*,
                    reviewer.name AS reviewer_name
                FROM restaurant_applications ra
                LEFT JOIN users reviewer ON reviewer.id = ra.reviewed_by
            `;
            const params = [];

            if (status) {
                query += " WHERE LOWER(ra.status) = LOWER(?)";
                params.push(status);
            }

            query += " ORDER BY ra.created_at DESC";
            const [applications] = await getPool().query(query, params);
            res.json(applications);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch applications" });
        }
    });

    app.put("/admin/portal/applications/:id/decision", isAdmin, async (req, res) => {
        try {
            await ensureColumns();
            const applicationId = parseInt(req.params.id, 10);
            const adminId = parseInt(req.headers.userid, 10);
            const { decision, reviewNotes, platformFeePercent } = req.body;
            const normalizedDecision = String(decision || "").trim().toLowerCase();

            if (!["approved", "rejected"].includes(normalizedDecision)) {
                return res.status(400).json({ error: "Decision must be approved or rejected" });
            }

            const [rows] = await getPool().query(
                "SELECT * FROM restaurant_applications WHERE id = ?",
                [applicationId]
            );

            if (!rows.length) {
                return res.status(404).json({ error: "Application not found" });
            }

            const application = rows[0];
            if (String(application.status || "").toLowerCase() !== "pending") {
                return res.status(400).json({ error: "Application is already processed" });
            }

            if (normalizedDecision === "approved") {
                const [result] = await getPool().query(
                    `INSERT INTO restaurants (
                        owner_id, user_id, name, description, logo, city, address, pincode, landmark,
                        cuisines, open_time, close_time, days_open, fssai, gst, pan, email, phone,
                        status, is_approved, platform_fee_percent, rating, total_orders, total_revenue
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [
                        application.owner_id,
                        application.owner_id,
                        application.restaurant_name,
                        "",
                        application.logo || null,
                        application.city || null,
                        application.address || null,
                        application.pincode || null,
                        application.landmark || null,
                        application.cuisines || "[]",
                        application.open_time || null,
                        application.close_time || null,
                        application.days_open || "[]",
                        application.fssai || null,
                        application.gst || null,
                        application.pan || null,
                        application.email || null,
                        application.phone || null,
                        "approved",
                        1,
                        parseNumber(platformFeePercent, 18),
                        0,
                        0,
                        0,
                    ]
                );

                await getPool().query(
                    `UPDATE restaurant_applications
                     SET status = 'approved',
                         restaurant_id = ?,
                         review_notes = ?,
                         reviewed_by = ?,
                         reviewed_at = NOW(),
                         approved_at = NOW(),
                         updated_at = NOW()
                     WHERE id = ?`,
                    [result.insertId, reviewNotes || null, adminId, applicationId]
                );

                await sendBulkNotifications(
                    getPool(),
                    [application.owner_id],
                    "Restaurant approved",
                    "Your restaurant is now approved and live on TastieKit.",
                    "restaurant_application",
                    { applicationId, restaurantId: result.insertId, decision: normalizedDecision }
                );
            } else {
                await getPool().query(
                    `UPDATE restaurant_applications
                     SET status = 'rejected',
                         review_notes = ?,
                         reviewed_by = ?,
                         reviewed_at = NOW(),
                         updated_at = NOW()
                     WHERE id = ?`,
                    [reviewNotes || null, adminId, applicationId]
                );

                await sendBulkNotifications(
                    getPool(),
                    [application.owner_id],
                    "Restaurant application update",
                    "Your restaurant application was not approved. Please review the feedback and resubmit.",
                    "restaurant_application",
                    { applicationId, decision: normalizedDecision, reviewNotes: reviewNotes || null }
                );
            }

            await logAdminAction(
                getPool(),
                adminId,
                "restaurant_application",
                applicationId,
                `decision_${normalizedDecision}`,
                { reviewNotes: reviewNotes || null, platformFeePercent: platformFeePercent || null }
            );

            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to update application decision" });
        }
    });

    app.get("/admin/portal/restaurants", isAdmin, async (req, res) => {
        try {
            await ensureColumns();
            const { status } = req.query;
            let query = `
                SELECT
                    r.*,
                    owner.name AS owner_name,
                    owner.email AS owner_email,
                    owner.phone AS owner_phone,
                    COUNT(DISTINCT CASE WHEN LOWER(o.status) = 'delivered' THEN o.id END) AS delivered_orders,
                    COALESCE(SUM(CASE WHEN LOWER(o.status) = 'delivered' THEN o.total ELSE 0 END), 0) AS gross_income,
                    COUNT(DISTINCT mi.id) AS menu_items_count
                FROM restaurants r
                LEFT JOIN users owner ON owner.id = r.owner_id
                LEFT JOIN orders o ON o.restaurant_id = r.id
                LEFT JOIN menu_items mi ON mi.restaurant_id = r.id
                WHERE 1 = 1
            `;
            const params = [];

            if (status) {
                query += " AND LOWER(r.status) = LOWER(?)";
                params.push(status);
            }

            query += " GROUP BY r.id ORDER BY r.created_at DESC";
            const [restaurants] = await getPool().query(query, params);

            res.json(
                restaurants.map((restaurant) => {
                    const grossIncome = parseNumber(restaurant.gross_income);
                    const platformPercent = parseNumber(
                        restaurant.platform_fee_percent,
                        18
                    );
                    const platformIncome = grossIncome * (platformPercent / 100);
                    return {
                        ...restaurant,
                        cuisines: normalizeJsonField(restaurant.cuisines, []),
                        days_open: normalizeJsonField(restaurant.days_open, []),
                        gross_income: Number(grossIncome.toFixed(2)),
                        platform_income: Number(platformIncome.toFixed(2)),
                        restaurant_income: Number(
                            Math.max(grossIncome - platformIncome, 0).toFixed(2)
                        ),
                    };
                })
            );
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch restaurants" });
        }
    });

    app.put("/admin/portal/restaurants/:id/financials", isAdmin, async (req, res) => {
        try {
            await ensureColumns();
            const restaurantId = parseInt(req.params.id, 10);
            const adminId = parseInt(req.headers.userid, 10);
            const { platformFeePercent, payoutNotes, isOpen, isActive } = req.body;
            const updates = [];
            const params = [];

            if (platformFeePercent !== undefined) {
                const parsedPercent = parseNumber(platformFeePercent, NaN);
                if (!Number.isFinite(parsedPercent) || parsedPercent < 0 || parsedPercent > 100) {
                    return res.status(400).json({
                        error: "Platform fee percent must be between 0 and 100",
                    });
                }
                updates.push("platform_fee_percent = ?");
                params.push(parsedPercent);
            }
            if (payoutNotes !== undefined) {
                updates.push("payout_notes = ?");
                params.push(String(payoutNotes || "").trim() || null);
            }
            if (isOpen !== undefined) {
                updates.push("is_open = ?");
                params.push(isOpen ? 1 : 0);
            }
            if (isActive !== undefined) {
                updates.push("is_active = ?");
                params.push(isActive ? 1 : 0);
            }

            if (!updates.length) {
                return res.status(400).json({ error: "No restaurant updates were provided" });
            }

            params.push(restaurantId);
            const [result] = await getPool().query(
                `UPDATE restaurants SET ${updates.join(", ")} WHERE id = ?`,
                params
            );

            if (!result.affectedRows) {
                return res.status(404).json({ error: "Restaurant not found" });
            }

            await logAdminAction(
                getPool(),
                adminId,
                "restaurant",
                restaurantId,
                "financials_updated",
                { platformFeePercent, payoutNotes, isOpen, isActive }
            );

            const [[restaurant]] = await getPool().query(
                "SELECT * FROM restaurants WHERE id = ?",
                [restaurantId]
            );
            res.json(restaurant);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to update restaurant financials" });
        }
    });

    app.get("/admin/portal/restaurants/:id/menu", isAdmin, async (req, res) => {
        try {
            const restaurantId = parseInt(req.params.id, 10);
            const [[restaurant]] = await getPool().query(
                "SELECT id, name, status, is_approved FROM restaurants WHERE id = ?",
                [restaurantId]
            );

            if (!restaurant) {
                return res.status(404).json({ error: "Restaurant not found" });
            }

            const [menuItems] = await getPool().query(
                `SELECT id, name, description, price, category, food_type, available, is_available,
                        preparation_time_mins, popularity, discount, image
                 FROM menu_items
                 WHERE restaurant_id = ?
                 ORDER BY available DESC, popularity DESC, id DESC`,
                [restaurantId]
            );

            res.json({
                restaurant,
                allowedReasons: Array.from(MENU_INTERVENTION_REASONS),
                menuItems,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch restaurant menu" });
        }
    });

    app.put(
        "/admin/portal/restaurants/:restaurantId/menu/:menuId/intervention",
        isAdmin,
        async (req, res) => {
            try {
                const restaurantId = parseInt(req.params.restaurantId, 10);
                const menuId = parseInt(req.params.menuId, 10);
                const adminId = parseInt(req.headers.userid, 10);
                const { reason, note, changes } = req.body;
                const normalizedReason = String(reason || "").trim();

                if (!MENU_INTERVENTION_REASONS.has(normalizedReason)) {
                    return res.status(400).json({
                        error: "A valid intervention reason is required",
                    });
                }

                if (!changes || typeof changes !== "object") {
                    return res.status(400).json({ error: "Changes are required" });
                }

                const allowedFields = [
                    "name",
                    "description",
                    "price",
                    "category",
                    "food_type",
                    "preparation_time_mins",
                    "available",
                    "is_available",
                ];
                const updates = [];
                const params = [];

                for (const field of allowedFields) {
                    if (changes[field] === undefined) continue;
                    updates.push(`${field} = ?`);
                    if (field === "available" || field === "is_available") {
                        params.push(changes[field] ? 1 : 0);
                    } else if (field === "price" || field === "preparation_time_mins") {
                        params.push(parseNumber(changes[field]));
                    } else {
                        params.push(changes[field]);
                    }
                }

                if (!updates.length) {
                    return res.status(400).json({
                        error: "No permitted menu changes were provided",
                    });
                }

                params.push(restaurantId, menuId);
                const [result] = await getPool().query(
                    `UPDATE menu_items
                     SET ${updates.join(", ")}
                     WHERE restaurant_id = ? AND id = ?`,
                    params
                );

                if (!result.affectedRows) {
                    return res.status(404).json({ error: "Menu item not found" });
                }

                await logAdminAction(
                    getPool(),
                    adminId,
                    "menu_item",
                    menuId,
                    "admin_intervention",
                    { reason: normalizedReason, note: note || null, changes }
                );

                const [[menuItem]] = await getPool().query(
                    "SELECT * FROM menu_items WHERE id = ?",
                    [menuId]
                );
                res.json(menuItem);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: "Failed to update menu item" });
            }
        }
    );

    app.get("/admin/portal/notification-targets", isAdmin, async (_req, res) => {
        try {
            const [users] = await getPool().query(
                `SELECT id, name, email, phone, role
                 FROM users
                 WHERE LOWER(TRIM(role)) IN ('customer', 'restaurant_partner', 'delivery_partner', 'admin')
                 ORDER BY FIELD(role, 'customer', 'restaurant_partner', 'delivery_partner', 'admin'), name ASC`
            );
            res.json(users);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch notification targets" });
        }
    });

    app.post("/admin/portal/notifications", isAdmin, async (req, res) => {
        try {
            const adminId = parseInt(req.headers.userid, 10);
            const { title, message, type, role, userIds } = req.body;

            if (!title || !message) {
                return res.status(400).json({
                    error: "Notification title and message are required",
                });
            }

            let recipients = [];
            if (Array.isArray(userIds) && userIds.length) {
                recipients = userIds.map((value) => parseInt(value, 10)).filter(Boolean);
            } else if (role) {
                const [rows] = await getPool().query(
                    "SELECT id FROM users WHERE LOWER(TRIM(role)) = LOWER(?)",
                    [role]
                );
                recipients = rows.map((row) => row.id);
            } else {
                return res.status(400).json({
                    error: "Choose either a role or specific recipients",
                });
            }

            if (!recipients.length) {
                return res.status(400).json({ error: "No recipients found" });
            }

            const delivered = await sendBulkNotifications(
                getPool(),
                recipients,
                title,
                message,
                type || "admin_broadcast",
                { senderRole: "admin" }
            );

            await logAdminAction(
                getPool(),
                adminId,
                "notification",
                null,
                "broadcast_sent",
                { delivered, role: role || null, userIds: recipients }
            );

            res.json({ success: true, delivered });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to send notifications" });
        }
    });

    app.get("/admin/portal/delivery-partners", isAdmin, async (_req, res) => {
        try {
            await ensureColumns();
            const [rows] = await getPool().query(`
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.phone,
                    u.is_available,
                    u.delivery_fee_per_order,
                    COUNT(CASE WHEN o.status IN ('confirmed', 'preparing', 'prepared', 'picked_up') THEN 1 END) AS active_orders,
                    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) AS completed_orders,
                    COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN u.delivery_fee_per_order ELSE 0 END), 0) AS estimated_income
                FROM users u
                LEFT JOIN orders o ON o.delivery_partner_id = u.id
                WHERE LOWER(TRIM(u.role)) = 'delivery_partner'
                GROUP BY u.id
                ORDER BY u.created_at DESC
            `);
            res.json(rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch delivery partners" });
        }
    });

    app.put("/admin/portal/delivery-partners/:id/compensation", isAdmin, async (req, res) => {
        try {
            await ensureColumns();
            const deliveryPartnerId = parseInt(req.params.id, 10);
            const adminId = parseInt(req.headers.userid, 10);
            const parsedValue = parseNumber(req.body.deliveryFeePerOrder, NaN);

            if (!Number.isFinite(parsedValue) || parsedValue < 0) {
                return res.status(400).json({
                    error: "Delivery income per order must be a positive number",
                });
            }

            const [result] = await getPool().query(
                `UPDATE users
                 SET delivery_fee_per_order = ?
                 WHERE id = ? AND LOWER(TRIM(role)) = 'delivery_partner'`,
                [parsedValue, deliveryPartnerId]
            );

            if (!result.affectedRows) {
                return res.status(404).json({ error: "Delivery partner not found" });
            }

            await logAdminAction(
                getPool(),
                adminId,
                "delivery_partner",
                deliveryPartnerId,
                "compensation_updated",
                { deliveryFeePerOrder: parsedValue }
            );

            res.json({ success: true, deliveryFeePerOrder: parsedValue });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to update delivery compensation" });
        }
    });
}

module.exports = registerAdminPortalRoutes;
