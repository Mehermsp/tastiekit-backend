const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("./middleware/rateLimit");
const winston = require("winston");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const {
    initDb,
    getPool,
    ensureAvailabilityColumn,
    ensureMealTypeColumn,
} = require("./config/db");
const { sendEmail, formatDeliveryPartnerHtml } = require("./services/email");
const createIsAdmin = require("./middleware/isAdmin");
const createRequireSelfOrAdmin = require("./middleware/requireSelfOrAdmin");
const registerSystemRoutes = require("./routes/system");
const registerAuthRoutes = require("./routes/auth");
const registerMenuRoutes = require("./routes/menu");
const registerOrderRoutes = require("./routes/orders");
const registerCartRoutes = require("./routes/cart");
const registerWishlistRoutes = require("./routes/wishlist");
const registerUserRoutes = require("./routes/users");
const registerAdminRoutes = require("./routes/admin");
const registerDeliveryRoutes = require("./routes/delivery");
const registerAddressRoutes = require("./routes/addresses");
const registerReviewRoutes = require("./routes/reviews");

const app = express();
app.use(helmet()); // Security headers
app.use(rateLimit.ipLimiter);
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 8000;
const isAdmin = createIsAdmin(getPool);
const requireSelfOrAdmin = createRequireSelfOrAdmin(getPool);

const redisClient = require("./lib/redis");

// Winston logger
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
        new winston.transports.File({ filename: "error.log", level: "error" }),
        new winston.transports.File({ filename: "combined.log" }),
    ],
});

// Health check
app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Create deps object with logger (io will be added after socket setup)
const depsBase = {
    getPool,
    ensureAvailabilityColumn,
    ensureMealTypeColumn,
    sendEmail,
    formatDeliveryPartnerHtml,
    isAdmin,
    requireSelfOrAdmin,
    redis: redisClient,
    logger,
};

// Register routes that don't need io
registerSystemRoutes(app, depsBase);
registerAuthRoutes(app, depsBase);
registerMenuRoutes(app, depsBase);
registerCartRoutes(app, depsBase);
registerWishlistRoutes(app, depsBase);
registerUserRoutes(app, depsBase);
registerAddressRoutes(app, depsBase);
registerReviewRoutes(app, depsBase);

// Routes that need io will be registered after socket setup

app.use("/uploads", express.static("uploads"));

async function start() {
    try {
        await initDb();
        const httpServer = require("http").createServer(app);
        
        const io = require("socket.io")(httpServer, {
            cors: {
                origin: ["http://localhost:3000", "http://localhost:19006"], // Web + Expo
                methods: ["GET", "POST"],
                credentials: true,
            },
            pingTimeout: 20000,
            pingInterval: 25000,
        });

        // Redis adapter (optional - only if Redis is configured)
        if (process.env.REDIS_HOST) {
            try {
                const { createAdapter } = require("@socket.io/redis-adapter");
                const { createClient } = require("redis");
                
                const pubClient = createClient({ url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` });
                const subClient = pubClient.duplicate();
                
                await Promise.all([pubClient.connect(), subClient.connect()]);
                io.adapter(createAdapter(pubClient, subClient));
                logger.info("✅ Redis adapter connected");
            } catch (redisError) {
                logger.warn("⚠️ Redis not available, running without Redis adapter");
            }
        }

        // Socket auth & rooms
        io.use((socket, next) => {
            const userId =
                socket.handshake.auth.userId || socket.handshake.headers.userid;
            if (!userId) return next(new Error("Authentication required"));

            socket.userId = userId;
            socket.join(`user:${userId}`); // Per-user room

            // Get role for role-based rooms
            getPool().query(
                "SELECT role FROM users WHERE id = ?",
                [userId],
                (err, rows) => {
                    if (rows[0]) socket.join(`role:${rows[0].role}`);
                    next();
                }
            );
        });

        io.on("connection", (socket) => {
            logger.info(
                `Socket connected: ${socket.id} (user:${socket.userId})`
            );
            socket.emit("connected", { message: "Real-time enabled" });

            socket.on("disconnect", () => {
                logger.info(`Socket disconnected: ${socket.id}`);
            });
        });

        // Create full deps object with io for routes that need it
        const deps = {
            ...depsBase,
            io,
        };

        // Register routes that need io
        registerOrderRoutes(app, deps);
        registerAdminRoutes(app, deps);
        registerDeliveryRoutes(app, deps);

        const PORT_NUM = PORT;
        httpServer.listen(PORT_NUM, () => {
            logger.info(`🚀 Server + Socket.IO on port ${PORT_NUM}`);
        });
        logger.info(`✅ Health at /healthz | Sockets ready`);
    } catch (e) {
        logger.error(`Failed to start server: ${e.message}`);
        process.exit(1);
    }
}

start();
