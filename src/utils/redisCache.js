// Redis cache utility for get/set with error fallback
import redis from "./redisClient.js";

export async function getCache(key) {
    try {
        const value = await redis.get(key);
        return value ? JSON.parse(value) : null;
    } catch (err) {
        // Redis error, treat as cache miss
        return null;
    }
}

export async function setCache(key, value, ttl = 300) {
    try {
        await redis.set(key, JSON.stringify(value), "EX", ttl);
    } catch (err) {
        // Ignore Redis errors
    }
}
