function registerReviewRoutes(app, { getPool, requireSelfOrAdmin }) {
    // Middleware to ensure only customers can create/modify reviews
    const requireCustomer = async (req, res, next) => {
        const requesterId = parseInt(req.headers.userid, 10);

        if (!requesterId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const [users] = await getPool().query("SELECT role FROM users WHERE id = ?", [requesterId]);

        if (!users.length) {
            return res.status(401).json({ error: "User not found" });
        }

        if (users[0].role !== 'customer') {
            return res.status(403).json({ error: "Only customers can create or modify reviews" });
        }

        next();
    };

    // Middleware to ensure only restaurant owners can view their reviews
    const requireRestaurantOwner = async (req, res, next) => {
        const requesterId = parseInt(req.headers.userid, 10);

        if (!requesterId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const [users] = await getPool().query("SELECT role FROM users WHERE id = ?", [requesterId]);

        if (!users.length) {
            return res.status(401).json({ error: "User not found" });
        }

        if (users[0].role === 'restaurant') {
            // Allow restaurant owners to proceed
            next();
        } else if (users[0].role === 'admin') {
            // Allow admins
            next();
        } else {
            return res.status(403).json({ error: "Only restaurant owners can access this endpoint" });
        }
    };
    // Add review for an order (restaurant & delivery review) - Only customers
    app.post(
        "/orders/:orderId/review",
        requireCustomer,
        async (req, res) => {
            try {
                const orderId = parseInt(req.params.orderId);
                const { rating, comment, delivery_rating, delivery_comment } =
                    req.body;

                const requesterId = parseInt(req.headers.userid);

                // Get order details
                const [orders] = await getPool().query(
                    "SELECT user_id, restaurant_id FROM orders WHERE id = ?",
                    [orderId]
                );

                if (!orders.length) {
                    return res.status(404).json({ error: "Order not found" });
                }

                const order = orders[0];

                // Verify user is the order creator
                if (order.user_id !== requesterId) {
                    return res.status(403).json({ error: "Unauthorized" });
                }

                // Check if review already exists
                const [existing] = await getPool().query(
                    "SELECT id FROM reviews WHERE order_id = ?",
                    [orderId]
                );

                if (existing.length) {
                    return res
                        .status(400)
                        .json({
                            error: "Review already exists for this order",
                        });
                }

                // Create review
                const [result] = await getPool().query(
                    `INSERT INTO reviews 
                 (order_id, user_id, restaurant_id, rating, comment, delivery_rating, delivery_comment) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        requesterId,
                        order.restaurant_id,
                        rating || null,
                        comment || null,
                        delivery_rating || null,
                        delivery_comment || null,
                    ]
                );

                // Update restaurant rating
                await updateRestaurantRating(order.restaurant_id);

                const [rows] = await getPool().query(
                    "SELECT id, order_id, user_id, restaurant_id, rating, comment, delivery_rating, delivery_comment, created_at FROM reviews WHERE id = ?",
                    [result.insertId]
                );

                res.json(rows[0]);
            } catch (error) {
                console.error("Create review error:", error);
                res.status(500).json({ error: "Failed to create review" });
            }
        }
    );

    // Add review for a menu item (food item review) - Only customers
    app.post(
        "/menu/:menuItemId/review",
        requireCustomer,
        async (req, res) => {
            try {
                const menuItemId = parseInt(req.params.menuItemId);
                const { rating, comment, order_id } = req.body;
                const requesterId = parseInt(req.headers.userid);

                if (!rating) {
                    return res.status(400).json({ error: "Rating is required" });
                }

                // Get menu item and restaurant
                const [menuItems] = await getPool().query(
                    "SELECT id, restaurant_id FROM menu_items WHERE id = ?",
                    [menuItemId]
                );

                if (!menuItems.length) {
                    return res.status(404).json({ error: "Menu item not found" });
                }

                const menuItem = menuItems[0];

                // If order_id provided, verify user owns the order (optional)
                if (order_id) {
                    const [orders] = await getPool().query(
                        "SELECT user_id FROM orders WHERE id = ?",
                        [order_id]
                    );
                    if (orders.length && orders[0].user_id !== requesterId) {
                        return res.status(403).json({ error: "Unauthorized - order doesn't belong to user" });
                    }
                }

                // Create review for menu item
                // First check if menu_item_id column exists, if not, use restaurant review
                let insertQuery, insertParams;
                try {
                    await getPool().query("SELECT menu_item_id FROM reviews LIMIT 1");
                    // Column exists, use it
                    insertQuery = `INSERT INTO reviews
                        (order_id, user_id, restaurant_id, menu_item_id, rating, comment)
                        VALUES (?, ?, ?, ?, ?, ?)`;
                    insertParams = [
                        order_id || null,
                        requesterId,
                        menuItem.restaurant_id,
                        menuItemId,
                        rating,
                        comment || null,
                    ];
                } catch (e) {
                    // Column doesn't exist, use restaurant review
                    insertQuery = `INSERT INTO reviews
                        (order_id, user_id, restaurant_id, rating, comment)
                        VALUES (?, ?, ?, ?, ?)`;
                    insertParams = [
                        order_id || null,
                        requesterId,
                        menuItem.restaurant_id,
                        rating,
                        comment || null,
                    ];
                }

                const [result] = await getPool().query(insertQuery, insertParams);

                // Update menu item rating
                await updateMenuItemRating(menuItemId);

                // Update restaurant rating
                await updateRestaurantRating(menuItem.restaurant_id);

                const [rows] = await getPool().query(
                    "SELECT id, order_id, user_id, restaurant_id, rating, comment, created_at FROM reviews WHERE id = ?",
                    [result.insertId]
                );

                res.json(rows[0]);
            } catch (error) {
                console.error("Create menu item review error:", error);
                res.status(500).json({ error: "Failed to create review" });
            }
        }
    );

    // Get reviews for a menu item (public - anyone can read)
    app.get("/menu/:menuItemId/reviews", async (req, res) => {
        try {
            const menuItemId = parseInt(req.params.menuItemId);
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;



            // Check if menu_item_id column exists
            let whereClause, countWhereClause, avgWhereClause;
            try {
                await getPool().query("SELECT menu_item_id FROM reviews LIMIT 1");
                // Column exists, filter by menu_item_id
                whereClause = "r.menu_item_id = ?";
                countWhereClause = "menu_item_id = ?";
                avgWhereClause = "menu_item_id = ? AND rating IS NOT NULL";
            } catch (e) {
                // Column doesn't exist, filter by restaurant_id
                whereClause = "r.restaurant_id = (SELECT restaurant_id FROM menu_items WHERE id = ?)";
                countWhereClause = "restaurant_id = (SELECT restaurant_id FROM menu_items WHERE id = ?)";
                avgWhereClause = "restaurant_id = (SELECT restaurant_id FROM menu_items WHERE id = ?) AND rating IS NOT NULL";
            }

            const [rows] = await getPool().query(
                `SELECT r.id, r.order_id, r.user_id, r.rating, r.comment, r.created_at,
                        u.name as user_name, u.profile_image
                 FROM reviews r
                 JOIN users u ON u.id = r.user_id
                 WHERE ${whereClause}
                 ORDER BY r.created_at DESC
                 LIMIT ? OFFSET ?`,
                [menuItemId, limit, offset]
            );

            const [countResult] = await getPool().query(
                `SELECT COUNT(*) as count FROM reviews WHERE ${countWhereClause}`,
                [menuItemId]
            );

            const [avgResult] = await getPool().query(
                `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE ${avgWhereClause}`,
                [menuItemId]
            );

            res.json({
                reviews: rows,
                total: countResult[0].count,
                averageRating: avgResult[0].avg_rating || 0,
                reviewCount: avgResult[0].review_count || 0,
                limit,
                offset,
            });
        } catch (error) {
            console.error("Get menu item reviews error:", error);
            res.status(500).json({ error: "Failed to fetch reviews" });
        }
    });

    // Get reviews for restaurant's menu items (for restaurant owners)
    app.get("/restaurant/reviews", requireRestaurantOwner, async (req, res) => {
        try {
            const requesterId = parseInt(req.headers.userid);
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;

            // Get restaurant owned by this user
            const [restaurants] = await getPool().query(
                "SELECT id FROM restaurants WHERE owner_id = ? AND is_approved = 1",
                [requesterId]
            );

            if (!restaurants.length) {
                return res.status(404).json({ error: "Restaurant not found" });
            }

            const restaurantId = restaurants[0].id;

            // Get all reviews for this restaurant's menu items
            let whereClause = "r.restaurant_id = ?";
            let params = [restaurantId, limit, offset];

            // Check if menu_item_id column exists for filtering
            try {
                await getPool().query("SELECT menu_item_id FROM reviews LIMIT 1");
                // If column exists, we can filter by restaurant_id (which includes all reviews)
            } catch (e) {
                // Column doesn't exist, whereClause is fine as is
            }

            const [rows] = await getPool().query(
                `SELECT r.id, r.order_id, r.user_id, r.menu_item_id, r.rating, r.comment, r.created_at,
                        u.name as user_name, u.profile_image,
                        m.name as menu_item_name
                 FROM reviews r
                 JOIN users u ON u.id = r.user_id
                 LEFT JOIN menu_items m ON m.id = r.menu_item_id
                 WHERE ${whereClause}
                 ORDER BY r.created_at DESC
                 LIMIT ? OFFSET ?`,
                params
            );

            const [countResult] = await getPool().query(
                `SELECT COUNT(*) as count FROM reviews WHERE ${whereClause}`,
                [restaurantId]
            );

            res.json({
                reviews: rows,
                total: countResult[0].count,
                limit,
                offset,
            });
        } catch (error) {
            console.error("Get restaurant reviews error:", error);
            res.status(500).json({ error: "Failed to fetch reviews" });
        }
    });

    // Get reviews for an order
    app.get("/orders/:orderId/review", async (req, res) => {
        try {
            const orderId = parseInt(req.params.orderId);

            const [rows] = await getPool().query(
                `SELECT id, order_id, user_id, restaurant_id, rating, comment, delivery_rating, delivery_comment, created_at 
                 FROM reviews 
                 WHERE order_id = ?`,
                [orderId]
            );

            if (!rows.length) {
                return res.json(null);
            }

            res.json(rows[0]);
        } catch (error) {
            console.error("Get review error:", error);
            res.status(500).json({ error: "Failed to fetch review" });
        }
    });

    // Get reviews for a restaurant (public - anyone can read)
    app.get("/restaurants/:restaurantId/reviews", async (req, res) => {
        try {
            const restaurantId = parseInt(req.params.restaurantId);
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;

            const [rows] = await getPool().query(
                `SELECT r.id, r.order_id, r.user_id, r.rating, r.comment, r.delivery_rating, r.delivery_comment, r.created_at,
                        u.name as user_name, u.profile_image
                 FROM reviews r
                 JOIN users u ON u.id = r.user_id
                 WHERE r.restaurant_id = ?
                 ORDER BY r.created_at DESC
                 LIMIT ? OFFSET ?`,
                [restaurantId, limit, offset]
            );

            const [countResult] = await getPool().query(
                "SELECT COUNT(*) as count FROM reviews WHERE restaurant_id = ?",
                [restaurantId]
            );

            res.json({
                reviews: rows,
                total: countResult[0].count,
                limit,
                offset,
            });
        } catch (error) {
            console.error("Get restaurant reviews error:", error);
            res.status(500).json({ error: "Failed to fetch reviews" });
        }
    });

    // Get reviews by a user
    app.get("/user/:userId/reviews", requireSelfOrAdmin, async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);

            const [rows] = await getPool().query(
                `SELECT id, order_id, restaurant_id, rating, comment, delivery_rating, delivery_comment, created_at 
                 FROM reviews 
                 WHERE user_id = ?
                 ORDER BY created_at DESC`,
                [userId]
            );

            res.json(rows);
        } catch (error) {
            console.error("Get user reviews error:", error);
            res.status(500).json({ error: "Failed to fetch reviews" });
        }
    });

    // Update review - Only customers who own the review
    app.put("/reviews/:reviewId", requireCustomer, async (req, res) => {
        try {
            const reviewId = parseInt(req.params.reviewId);
            const requesterId = parseInt(req.headers.userid);
            const { rating, comment, delivery_rating, delivery_comment } =
                req.body;

            // Get review
            const [reviews] = await getPool().query(
                "SELECT user_id, restaurant_id FROM reviews WHERE id = ?",
                [reviewId]
            );

            if (!reviews.length) {
                return res.status(404).json({ error: "Review not found" });
            }

            const review = reviews[0];

            // Verify user is review owner
            if (review.user_id !== requesterId) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            const updates = [];
            const params = [];

            if (rating !== undefined) {
                updates.push("rating = ?");
                params.push(rating);
            }
            if (comment !== undefined) {
                updates.push("comment = ?");
                params.push(comment);
            }
            if (delivery_rating !== undefined) {
                updates.push("delivery_rating = ?");
                params.push(delivery_rating);
            }
            if (delivery_comment !== undefined) {
                updates.push("delivery_comment = ?");
                params.push(delivery_comment);
            }

            if (!updates.length) {
                return res.status(400).json({ error: "No fields to update" });
            }

            params.push(reviewId);

            await getPool().query(
                `UPDATE reviews SET ${updates.join(", ")} WHERE id = ?`,
                params
            );

            // Update restaurant rating
            await updateRestaurantRating(review.restaurant_id);

            const [rows] = await getPool().query(
                "SELECT id, order_id, user_id, restaurant_id, rating, comment, delivery_rating, delivery_comment, created_at FROM reviews WHERE id = ?",
                [reviewId]
            );

            res.json(rows[0]);
        } catch (error) {
            console.error("Update review error:", error);
            res.status(500).json({ error: "Failed to update review" });
        }
    });

    // Helper function to update restaurant rating
    async function updateRestaurantRating(restaurantId) {
        try {
            const [result] = await getPool().query(
                `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count 
                 FROM reviews 
                 WHERE restaurant_id = ? AND rating IS NOT NULL`,
                [restaurantId]
            );

            if (result.length && result[0].avg_rating) {
                const avgRating = Math.round(result[0].avg_rating * 10) / 10;
                await getPool().query(
                    "UPDATE restaurants SET rating = ? WHERE id = ?",
                    [avgRating, restaurantId]
                );
            }
        } catch (error) {
            console.error("Update restaurant rating error:", error);
        }
    }

    // Helper function to update menu item rating
    async function updateMenuItemRating(menuItemId) {
        try {
            // Check if menu_item_id column exists
            try {
                await getPool().query("SELECT menu_item_id FROM reviews LIMIT 1");
                // Column exists, update menu item rating
                const [result] = await getPool().query(
                    `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
                     FROM reviews
                     WHERE menu_item_id = ? AND rating IS NOT NULL`,
                    [menuItemId]
                );

                if (result.length && result[0].avg_rating) {
                    const avgRating = Math.round(result[0].avg_rating * 10) / 10;
                    await getPool().query(
                        "UPDATE menu_items SET rating = ? WHERE id = ?",
                        [avgRating, menuItemId]
                    );
                }
            } catch (e) {
                // Column doesn't exist, just update restaurant rating
                const [menuItem] = await getPool().query(
                    "SELECT restaurant_id FROM menu_items WHERE id = ?",
                    [menuItemId]
                );

                if (menuItem.length) {
                    await updateRestaurantRating(menuItem[0].restaurant_id);
                }
            }
        } catch (error) {
            console.error("Update menu item rating error:", error);
        }
    }
}

module.exports = registerReviewRoutes;
