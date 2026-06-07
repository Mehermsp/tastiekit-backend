import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,     // 15 minutes
    max: 10,                       // allow 10 attempts
    message: {
        success: false,
        message: "Too many login attempts. Please try again later.",
    },
    standardHeaders: true,         // Return rate limit info in headers
    legacyHeaders: false,

    // Important improvements:
    skipSuccessfulRequests: true,  // Only count failed login attempts
    keyGenerator: (req) => {
        // Better key: combine IP + email/username (prevents locking entire networks)
        const ip = req.ip || req.connection.remoteAddress;
        const email = req.body?.email || req.body?.username || '';
        return `${ip}:${email}`;
    },
    
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many login attempts from this device. Please wait a few minutes before trying again.",
        });
    }
});
