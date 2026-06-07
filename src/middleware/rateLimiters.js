import rateLimit from "express-rate-limit";
import { ipKeyGenerator } from "express-rate-limit";   // ← Import this

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,     // 15 minutes
    max: 10,
    message: {
        success: false,
        message: "Too many login attempts. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,

    skipSuccessfulRequests: true,   // Only count failed attempts

    // Fixed keyGenerator with proper IPv6 support
    keyGenerator: (req) => {
        const ip = req.ip || req.connection?.remoteAddress || "unknown";
        
        // Use the official helper for IPv6 subnet masking
        const processedIp = ipKeyGenerator(ip);
        
        const identifier = req.body?.email || req.body?.username || req.body?.phone || "anonymous";
        
        return `${processedIp}:${identifier}`;
    },

    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many login attempts. Please wait before trying again.",
        });
    }
});
