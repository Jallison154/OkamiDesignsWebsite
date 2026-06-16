'use strict';

/**
 * Configurable CORS — permissive in development, allowlist in production.
 */
function createCorsMiddleware(config) {
    return function corsMiddleware(req, res, next) {
        const origin = req.headers.origin;
        const allowed = config.corsAllowedOrigins || [];

        if (origin) {
            if (allowed.length > 0) {
                if (allowed.includes(origin)) {
                    res.header('Access-Control-Allow-Origin', origin);
                    res.header('Vary', 'Origin');
                }
            } else if (!config.isProduction) {
                res.header('Access-Control-Allow-Origin', '*');
            }
        }

        res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Access-Control-Allow-Credentials', 'true');

        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }

        return next();
    };
}

module.exports = {
    createCorsMiddleware
};
