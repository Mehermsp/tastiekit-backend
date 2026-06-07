import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/http.js";
import { getCustomerCheckoutSummary } from "../models/orderModel.js";

export const getCheckoutSummary = asyncHandler(async (req, res) => {
    const summary = await getCustomerCheckoutSummary(req.user.id);

    sendSuccess(res, { summary }, "Checkout summary fetched successfully");
});
