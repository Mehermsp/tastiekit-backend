import redis from "./redisClient.js";

export const invalidateOrderCache = async (orderId) => {
    try {
        await redis.del(`order:${orderId}`);
    } catch (err) {
        // ignore cache failures
    }
};
