'use strict';

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

function isAdminRequest(req) {
    return parseRequestCookies(req).okami_admin === '1';
}

function requireAdmin(req, res, next) {
    if (isAdminRequest(req)) {
        return next();
    }
    return res.status(401).json({ error: 'admin_auth_required' });
}

module.exports = {
    parseRequestCookies,
    isAdminRequest,
    requireAdmin
};
