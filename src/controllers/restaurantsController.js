import { buildPagination, getPagination } from "../utils/pagination.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendPaginated, sendSuccess, AppError } from "../utils/http.js";
import {
    getRestaurantById,
    getRestaurantMenu,
    listApprovedRestaurants,
    getHomeFeedRestaurants,
    getHomeFeedMenuItems,
} from "../models/restaurantModel.js";

export const listRestaurants = asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req.query);
    const { search, city, sort } = req.query;
    const { items, total } = await listApprovedRestaurants({
        limit,
        offset,
        search,
        city,
        sort,
    });

    sendPaginated(
        res,
        items,
        buildPagination(page, limit, total),
        "Restaurants fetched successfully"
    );
});

export const getRestaurantDetails = asyncHandler(async (req, res) => {
    const restaurant = await getRestaurantById(req.params.restaurantId);
    if (!restaurant) {
        throw new AppError(404, "Restaurant not found");
    }

    const menu = await getRestaurantMenu(req.params.restaurantId, {
        includeUnavailable: false,
    });
    sendSuccess(
        res,
        { restaurant, menu },
        "Restaurant details fetched successfully"
    );
});

export const getRestaurantMenuItems = asyncHandler(async (req, res) => {
    const restaurant = await getRestaurantById(req.params.restaurantId);
    if (!restaurant) {
        throw new AppError(404, "Restaurant not found");
    }

    const { page, limit, offset } = getPagination(req.query);
    const menuResponse = await getRestaurantMenu(req.params.restaurantId, {
        includeUnavailable: false,
        category: req.query.category,
        search: req.query.q,
        limit,
        offset,
    });

    sendPaginated(
        res,
        menuResponse.items,
        buildPagination(page, limit, menuResponse.total),
        "Menu fetched successfully"
    );
});

export const getRestaurantsHomeFeed = asyncHandler(async (req, res) => {
    const restaurantLimit = Math.min(
        12,
        Math.max(1, Number(req.query.restaurantLimit || 8))
    );
    const featuredLimit = Math.min(
        24,
        Math.max(1, Number(req.query.featuredLimit || 18))
    );
    const discountedLimit = Math.min(
        24,
        Math.max(1, Number(req.query.discountedLimit || 8))
    );

    const restaurants = await getHomeFeedRestaurants({
        limit: restaurantLimit,
    });
    const featuredItems = await getHomeFeedMenuItems({ limit: featuredLimit });
    const discountedItems = await getHomeFeedMenuItems({
        limit: discountedLimit,
        discountOnly: true,
    });

    sendSuccess(
        res,
        { restaurants, featuredItems, discountedItems },
        "Home feed fetched successfully"
    );
});

export const searchRestaurantMenuItems = asyncHandler(async (req, res) => {
    const restaurant = await getRestaurantById(req.params.restaurantId);
    if (!restaurant) {
        throw new AppError(404, "Restaurant not found");
    }

    const menu = await getRestaurantMenu(req.params.restaurantId, {
        includeUnavailable: false,
        search: req.query.q,
    });
    sendSuccess(res, menu, "Menu search results fetched successfully");
});
