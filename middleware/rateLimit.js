const { rateLimit } = require("express-rate-limit");

// IP-based rate limiter: 100 req/15min
// Using memory store for simplicity - works without Redis dependency
const ipLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many requests from this IP. Try again later.",
    },
    statusCode: 429,
    skip: (req) => {
        // Skip health checks and static files
        return req.path === "/healthz" || req.path.startsWith("/uploads");
    },
});

// User-based: 200 req/15min (auth required)
const userLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    keyGenerator: (req) => {
        return req.headers.userid || "anonymous";
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many requests from this user. Slow down.",
    },
    skip: (req) => !req.headers.userid, // Only authenticated
});

module.exports = {
    ipLimiter,
    userLimiter,
};
