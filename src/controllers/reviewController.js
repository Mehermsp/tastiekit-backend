import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError, sendSuccess } from "../utils/http.js";
import { getOrderById } from "../models/orderModel.js";
import { createReview, getReviewByOrderId } from "../models/reviewModel.js";

export const submitReview = asyncHandler(async (req, res) => {
    const { restaurantRating, deliveryRating } = req.body;
    const hasRestaurantRating =
        restaurantRating !== undefined && restaurantRating !== null;
    const hasDeliveryRating =
        deliveryRating !== undefined && deliveryRating !== null;

    const order = await getOrderById(req.body.orderId);
    if (!order || Number(order.customer_id) !== Number(req.user.id)) {
        throw new AppError(404, "Delivered order not found");
    }

    if (order.status !== "delivered") {
        throw new AppError(400, "Reviews are allowed only after delivery");
    }

    const existing = await getReviewByOrderId(order.id);
    if (existing) {
        throw new AppError(409, "A review already exists for this order");
    }

    if (!hasRestaurantRating && !hasDeliveryRating) {
        throw new AppError(400, "Invalid rating");
    }

    if (hasRestaurantRating && !isValidRating(restaurantRating)) {
        throw new AppError(400, "Invalid rating");
    }

    if (hasDeliveryRating && !isValidRating(deliveryRating)) {
        throw new AppError(400, "Invalid rating");
    }

    await createReview({
        orderId: order.id,
        customerId: req.user.id,
        restaurantId: order.restaurant_id,
        deliveryPartnerId: order.delivery_partner_id,
        restaurantRating,
        restaurantComment: req.body.restaurantComment,
        deliveryRating,
        deliveryComment: req.body.deliveryComment,
    });

    sendSuccess(res, null, "Review submitted successfully", 201);
});

const isValidRating = (rating) =>
    Number.isInteger(rating) && rating >= 1 && rating <= 5;
