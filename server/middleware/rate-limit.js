'use strict';

/**
 * Simple in-memory rate limiter for public write endpoints.
 */
function createRateLimiter({ windowMs = 60_000, max = 60, keyPrefix = '' } = {}) {
    const hits = new Map();

    return function rateLimitMiddleware(req, res, next) {
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        const key = `${keyPrefix}:${ip}`;
        const now = Date.now();

        let bucket = hits.get(key);
        if (!bucket || now - bucket.start > windowMs) {
            bucket = { start: now, count: 0 };
            hits.set(key, bucket);
        }

        bucket.count += 1;

        if (bucket.count > max) {
            return res.status(429).json({ error: 'rate_limit_exceeded' });
        }

        return next();
    };
}

module.exports = {
    createRateLimiter
};
