'use strict';

const {
    SESSION_COOKIE,
    readAdminAuthConfig,
    isAdminAuthConfigured,
    verifySessionToken
} = require('../admin/auth-service');

let adminAuthConfig = readAdminAuthConfig();

function initAdminAuth(appConfig) {
    adminAuthConfig = readAdminAuthConfig(appConfig);
}

function parseRequestCookies(req) {
    const header = req.headers.cookie || '';
    return header.split(';').reduce((cookies, part) => {
        const [name, ...rest] = part.trim().split('=');
        if (!name) {
            return cookies;
        }
        cookies[name] = decodeURIComponent(rest.join('='));
        return cookies;
    }, {});
}

function getAdminSession(req) {
    if (!isAdminAuthConfigured(adminAuthConfig)) {
        return null;
    }

    const token = parseRequestCookies(req)[SESSION_COOKIE];
    if (!token) {
        return null;
    }

    return verifySessionToken(token, adminAuthConfig);
}

function isAdminRequest(req) {
    return getAdminSession(req) !== null;
}

function requireAdmin(req, res, next) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (!isAdminAuthConfigured(adminAuthConfig)) {
        return res.status(503).json({ error: 'admin_auth_not_configured' });
    }

    if (isAdminRequest(req)) {
        return next();
    }

    return res.status(401).json({ error: 'admin_auth_required' });
}

module.exports = {
    SESSION_COOKIE,
    initAdminAuth,
    parseRequestCookies,
    getAdminSession,
    isAdminRequest,
    requireAdmin,
    getAdminAuthConfig: () => adminAuthConfig
};
