'use strict';

/**
 * Application-level server configuration (non-secret).
 */
function readAppConfig() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';

    const corsRaw = (process.env.OKAMI_CORS_ALLOWED_ORIGINS || '').trim();
    const corsAllowedOrigins = corsRaw
        ? corsRaw.split(',').map((entry) => entry.trim()).filter(Boolean)
        : [];

    const analyticsWindowMs = Number(process.env.OKAMI_ANALYTICS_RATE_WINDOW_MS) || 60_000;
    const analyticsMaxPerWindow = Number(process.env.OKAMI_ANALYTICS_RATE_MAX) || 60;

    return {
        nodeEnv,
        isProduction,
        port: Number(process.env.PORT) || 3000,
        corsAllowedOrigins,
        analyticsRateLimit: {
            windowMs: analyticsWindowMs,
            max: analyticsMaxPerWindow
        }
    };
}

module.exports = {
    readAppConfig
};
