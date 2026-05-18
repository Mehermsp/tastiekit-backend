import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signAccessToken = (payload) => {
    const secret = env.jwtAccessSecret?.trim();

    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is missing or empty");
    }

    return jwt.sign(payload, secret, {
        expiresIn: env.jwtAccessTtl || "7d",
    });
};

export const verifyAccessToken = (token) => {
    const secret = env.jwtAccessSecret?.trim();

    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is missing");
    }

    return jwt.verify(token, secret);
};
