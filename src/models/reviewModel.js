import { getOne, withTransaction } from "../config/db.js";

export const getReviewByOrderId = async (orderId) =>
    getOne(`SELECT * FROM reviews WHERE order_id = ? LIMIT 1`, [orderId]);

export const createReview = async ({
    orderId,
    customerId,
    restaurantId,
    deliveryPartnerId,
    restaurantRating,
    restaurantComment,
    deliveryRating,
    deliveryComment,
}) =>
    withTransaction(async (connection) => {
        await connection.execute(
            `
            INSERT INTO reviews (
                order_id,
                user_id,
                restaurant_id,
                rating,
                comment,
                delivery_rating,
                delivery_comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                orderId,
                customerId,
                restaurantId,
                restaurantRating ?? null,
                restaurantComment || null,
                deliveryRating ?? null,
                deliveryComment || null,
            ]
        );

        if (restaurantRating != null) {
            await connection.execute(
                `
                UPDATE restaurants r
                JOIN (
                    SELECT restaurant_id, AVG(rating) AS avg_rating
                    FROM reviews
                    WHERE restaurant_id = ?
                      AND rating IS NOT NULL
                ) agg ON agg.restaurant_id = r.id
                SET r.rating = ROUND(agg.avg_rating, 2)
                WHERE r.id = ?
                `,
                [restaurantId, restaurantId]
            );
        }

        if (deliveryPartnerId && deliveryRating != null) {
            await connection.execute(
                `
                UPDATE users u
                JOIN (
                    SELECT o.delivery_partner_id, AVG(rv.delivery_rating) AS avg_rating
                    FROM reviews rv
                    INNER JOIN orders o ON o.id = rv.order_id
                    WHERE o.delivery_partner_id = ?
                      AND rv.delivery_rating IS NOT NULL
                ) agg ON agg.delivery_partner_id = u.id
                SET u.rating = ROUND(agg.avg_rating, 2)
                WHERE u.id = ?
                  AND u.role = 'delivery_partner'
                `,
                [deliveryPartnerId, deliveryPartnerId]
            );
        }
    });
