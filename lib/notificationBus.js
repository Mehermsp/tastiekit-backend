const { EventEmitter } = require("events");

const bus = new EventEmitter();
bus.setMaxListeners(2000);

/**
 * Push a realtime signal to connected clients for this user (SSE + optional future WS).
 * Call after rows are persisted in `notifications`.
 */
function notifyUser(userId, payload = {}) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return;
    bus.emit(`user:${id}`, {
        type: "notifications_updated",
        at: Date.now(),
        ...payload,
    });
}

module.exports = { bus, notifyUser };
