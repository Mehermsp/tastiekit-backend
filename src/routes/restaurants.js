import { Router } from "express";
import {
    getRestaurantDetails,
    getRestaurantMenuItems,
    getRestaurantsHomeFeed,
    listRestaurants,
    searchRestaurantMenuItems,
} from "../controllers/restaurantsController.js";

const router = Router();

router.get("/", listRestaurants);
router.get("/home-feed", getRestaurantsHomeFeed);
router.get("/:restaurantId", getRestaurantDetails);
router.get("/:restaurantId/menu", getRestaurantMenuItems);
router.get("/:restaurantId/search", searchRestaurantMenuItems);

export default router;
