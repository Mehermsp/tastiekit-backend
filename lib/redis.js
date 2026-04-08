const Redis = require("ioredis");

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    commandTimeout: 5000,
});

redis.on("error", (err) => console.error("Redis Client Error:", err));
redis.on("connect", () => console.log("✅ Redis Connected"));
redis.on("ready", () => console.log("🚀 Redis Ready for pub/sub"));
redis.on("close", () => console.log("Redis Connection Closed"));

module.exports = redis;
