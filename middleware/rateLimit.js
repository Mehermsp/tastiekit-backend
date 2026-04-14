const { rateLimit } = require("express-rate-limit");

// Using memory store for simplicity - works without Redis dependency
const ipLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === "production" ? 1200 : 6000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many requests from this IP. Try again later.",
    },
    statusCode: 429,
    skip: (req) => {
        return (
            req.path === "/healthz" ||
            req.path.startsWith("/uploads") ||
            req.path === "/notifications/stream"
        );
    },
});

// User-based: 200 req/15min (auth required)
const userLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === "production" ? 1800 : 8000,
    keyGenerator: (req) => {
        return req.headers.userid
            ? `user:${String(req.headers.userid)}`
            : "anonymous";
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many requests from this user. Slow down.",
    },
    skip: (req) =>
        !req.headers.userid || req.path === "/notifications/stream",
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 60 : 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many auth attempts. Please try again later.",
    },
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 40 : 120,
    keyGenerator: (req) =>
        req.headers.userid
            ? `user:${String(req.headers.userid)}`
            : "anonymous-upload",
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many upload requests. Please wait a few minutes.",
    },
});

module.exports = {
    ipLimiter,
    userLimiter,
    authLimiter,
    uploadLimiter,
};
