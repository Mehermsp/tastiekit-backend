const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const helmet = require("helmet");
const { rateLimit } = require("./middleware/rateLimit");
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
const deps = {
    getPool,
    ensureAvailabilityColumn,
    ensureMealTypeColumn,
    sendEmail,
    formatDeliveryPartnerHtml,
    isAdmin,
    requireSelfOrAdmin,
    redis: redisClient,
    io, // Socket instance for emitters
    logger,
};

registerSystemRoutes(app, deps);
registerAuthRoutes(app, deps);
registerMenuRoutes(app, deps);
registerOrderRoutes(app, deps);
registerCartRoutes(app, deps);
registerWishlistRoutes(app, deps);
registerUserRoutes(app, deps);
registerAdminRoutes(app, deps);
registerDeliveryRoutes(app, deps);
registerAddressRoutes(app, deps);
registerReviewRoutes(app, deps);

app.use("/uploads", express.static("uploads"));

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

async function start() {
    try {
        await initDb();
        const httpServer = require("http").createServer(app);
        const { createAdapter } = require("socket.io-redis");
        const io = require("socket.io")(httpServer, {
            cors: {
                origin: ["http://localhost:3000", "http://localhost:19006"], // Web + Expo
                methods: ["GET", "POST"],
                credentials: true,
            },
            pingTimeout: 20000,
            pingInterval: 25000,
        });

        // Redis adapter for horizontal scaling
        io.adapter(
            createAdapter({
                host: process.env.REDIS_HOST || "localhost",
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
            })
        );

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

        // Test event
        io.on("connection", (socket) => {
            logger.info(
                `Socket connected: ${socket.id} (user:${socket.userId})`
            );
            socket.emit("connected", { message: "Real-time enabled" });

            socket.on("disconnect", () => {
                logger.info(`Socket disconnected: ${socket.id}`);
            });
        });

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
