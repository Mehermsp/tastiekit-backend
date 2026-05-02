import { AppError } from "../utils/http.js";

const normalizeRole = (role) => {
    const raw = String(role || "")
        .trim()
        .toLowerCase();

    const aliases = {
        delivery: "delivery_partner",
        deliveryboy: "delivery_partner",
        delivery_boy: "delivery_partner",
        rider: "delivery_partner",
        restaurant: "restaurant_partner",
        vendor: "restaurant_partner",
        user: "customer",
    };

    return aliases[raw] || raw;
};

export const authorize =
    (...roles) =>
    (req, res, next) => {
        if (!req.user) {
            return next(new AppError(401, "Authentication required"));
        }

        const allowedRoles = roles.map(normalizeRole);
        const userRole = normalizeRole(req.user.role);

        if (!allowedRoles.includes(userRole)) {
            return next(new AppError(403, "Forbidden for this role"));
        }

        return next();
    };
