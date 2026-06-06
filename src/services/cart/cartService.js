import {
    findMenuItemForCart,
    getCartForUser,
    getCartRestaurant,
    upsertCartItem,
} from "../../models/cartModel.js";

import { AppError } from "../../utils/http.js";

export const buildCartResponse = (items = []) => {
    const subtotal = items.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0
    );

    const discountAmount = items.reduce((sum, item) => {
        const itemSubtotal =
            Number(item.unit_price || 0) * Number(item.quantity || 0);

        const discountPercent = Number(item.discount_percent || 0);

        return sum + (itemSubtotal * discountPercent) / 100;
    }, 0);

    const deliveryFee = subtotal >= 400 || subtotal === 0 ? 0 : 40;

    const taxAmount = Number((subtotal * 0.05).toFixed(2));

    const total = Number(
        (subtotal - discountAmount + deliveryFee + taxAmount).toFixed(2)
    );

    return {
        items,
        summary: {
            subtotal,
            discountAmount: Number(discountAmount.toFixed(2)),
            deliveryFee,
            taxAmount,
            total,
        },
    };
};

export const validateMenuItemForCart = async ({ userId, menuItemId }) => {
    const menuItem = await findMenuItemForCart(menuItemId);

    if (!menuItem || !menuItem.is_available || !menuItem.is_active) {
        throw new AppError(400, "Menu item is not available");
    }

    if (!menuItem.is_open) {
        throw new AppError(400, "Restaurant is currently closed");
    }

    if (!menuItem.delivery_enabled) {
        throw new AppError(400, "Restaurant is not accepting delivery orders");
    }

    if (menuItem.is_busy || !menuItem.peak_hour_available) {
        throw new AppError(400, "Restaurant is temporarily not accepting orders");
    }

    const existingCartRestaurant = await getCartRestaurant(userId);

    if (
        existingCartRestaurant &&
        Number(existingCartRestaurant.restaurant_id) !==
            Number(menuItem.restaurant_id)
    ) {
        throw new AppError(
            409,
            "Cart already contains items from another restaurant"
        );
    }

    return menuItem;
};

export const addOrUpdateCartItem = async ({
    userId,
    menuItemId,
    quantity,
    unitPrice,
    restaurantId,
}) => {
    const safeQuantity = Math.max(1, Number(quantity));

    await upsertCartItem({
        userId,

        restaurantId,

        menuItemId,

        quantity: safeQuantity,

        unitPrice,

        totalPrice: Number((unitPrice * safeQuantity).toFixed(2)),
    });

    const items = await getCartForUser(userId);

    return buildCartResponse(items);
};
