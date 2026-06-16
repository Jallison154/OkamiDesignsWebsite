'use strict';

const crypto = require('crypto');
const { parseRequestCookies } = require('../middleware/admin-auth');
const { readCommercialConfig } = require('./config');

const LICENSE_COOKIE = 'okami_license';
const LICENSE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

function getSigningSecret(config = readCommercialConfig()) {
    if (config.sessionSecret) {
        return config.sessionSecret;
    }
    if (!config.commercialEnabled) {
        return 'okami-commercial-off-dev';
    }
    return 'okami-insecure-dev-fallback';
}

function signLicensePayload(payload, secret) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${signature}`;
}

function verifyLicenseToken(token, secret) {
    if (!token || typeof token !== 'string') {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return null;
    }

    const [body, signature] = parts;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function readLicenseSession(req) {
    const cookies = parseRequestCookies(req);
    const token = cookies[LICENSE_COOKIE];
    if (!token) {
        return null;
    }

    const payload = verifyLicenseToken(token, getSigningSecret());
    if (!payload?.tier) {
        return null;
    }

    return {
        tier: payload.tier,
        productId: payload.productId || null,
        source: payload.source || 'license-cookie'
    };
}

function buildLicenseCookie(token, maxAgeSec = LICENSE_MAX_AGE_SEC) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${LICENSE_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

function setLicenseCookie(res, data = {}) {
    const now = Date.now();
    const payload = {
        tier: data.tier || 'free',
        productId: data.productId || null,
        source: data.source || 'license-activation',
        iat: now,
        exp: now + LICENSE_MAX_AGE_SEC * 1000
    };
    const token = signLicensePayload(payload, getSigningSecret());
    res.setHeader('Set-Cookie', buildLicenseCookie(token));
    return payload;
}

function clearLicenseCookie(res) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${LICENSE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

module.exports = {
    LICENSE_COOKIE,
    LICENSE_MAX_AGE_SEC,
    readLicenseSession,
    setLicenseCookie,
    clearLicenseCookie,
    signLicensePayload,
    verifyLicenseToken,
    getSigningSecret
};
