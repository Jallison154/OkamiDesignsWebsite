'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');

const SESSION_COOKIE = 'okami_admin_session';
const DEFAULT_SESSION_MAX_AGE_MS = 30 * 60 * 1000;

const DEV_SESSION_FALLBACK = 'okami-local-dev-session-secret-not-for-production';

function looksLikeBcryptHash(value) {
    return typeof value === 'string' && /^\$2[aby]\$\d{2}\$.{53}$/.test(value);
}

function readAdminAuthConfig(appConfig = {}) {
    const isProduction = appConfig.isProduction ?? process.env.NODE_ENV === 'production';
    let passwordHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
    let sessionSecret = (
        process.env.ADMIN_SESSION_SECRET
        || process.env.OKAMI_SESSION_SECRET
        || ''
    ).trim();
    let usingDevPasswordFallback = false;

    if (!passwordHash && !isProduction) {
        const devPassword = (process.env.ADMIN_DEV_PASSWORD || '').trim();
        if (devPassword) {
            passwordHash = bcrypt.hashSync(devPassword, 12);
            usingDevPasswordFallback = true;
        }
    }

    if (!sessionSecret && !isProduction && passwordHash) {
        sessionSecret = DEV_SESSION_FALLBACK;
    }

    return {
        passwordHash,
        sessionSecret,
        isProduction,
        sessionMaxAgeMs: Number(process.env.ADMIN_SESSION_MAX_AGE_MS) || DEFAULT_SESSION_MAX_AGE_MS,
        usingDevPasswordFallback
    };
}

function isAdminAuthConfigured(config) {
    return Boolean(config?.passwordHash && config?.sessionSecret);
}

function getAdminAuthDiagnostics(config) {
    const resolved = config || readAdminAuthConfig();
    const missing = [];
    const warnings = [];

    if (!resolved.passwordHash) {
        missing.push('ADMIN_PASSWORD_HASH');
    } else if (!looksLikeBcryptHash(resolved.passwordHash)) {
        warnings.push(
            'ADMIN_PASSWORD_HASH looks corrupted — wrap the hash in single quotes in .env (bcrypt contains $)'
        );
        missing.push('ADMIN_PASSWORD_HASH');
    }

    if (!resolved.sessionSecret) {
        missing.push('ADMIN_SESSION_SECRET');
    }

    return {
        configured: isAdminAuthConfigured(resolved) && looksLikeBcryptHash(resolved.passwordHash || ''),
        isProduction: Boolean(resolved.isProduction),
        usingDevPasswordFallback: Boolean(resolved.usingDevPasswordFallback),
        missing,
        warnings
    };
}

async function verifyAdminPassword(password, config) {
    if (!config?.passwordHash || typeof password !== 'string') {
        return false;
    }

    try {
        return await bcrypt.compare(password, config.passwordHash);
    } catch {
        return false;
    }
}

function createSessionToken(config) {
    const payload = {
        exp: Date.now() + config.sessionMaxAgeMs,
        iat: Date.now()
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', config.sessionSecret)
        .update(body)
        .digest('base64url');

    return `${body}.${signature}`;
}

function verifySessionToken(token, config) {
    if (!token || !config?.sessionSecret) {
        return null;
    }

    const [body, signature] = token.split('.');
    if (!body || !signature) {
        return null;
    }

    const expected = crypto
        .createHmac('sha256', config.sessionSecret)
        .update(body)
        .digest('base64url');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (signatureBuffer.length !== expectedBuffer.length) {
        return null;
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!payload?.exp || Date.now() > payload.exp) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function buildSessionCookie(token, config) {
    const maxAgeSec = Math.floor(config.sessionMaxAgeMs / 1000);
    const parts = [
        `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${maxAgeSec}`
    ];

    if (config.isProduction) {
        parts.push('Secure');
    }

    return parts.join('; ');
}

function buildClearSessionCookie(config) {
    const parts = [
        `${SESSION_COOKIE}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        'Max-Age=0'
    ];

    if (config?.isProduction) {
        parts.push('Secure');
    }

    return parts.join('; ');
}

module.exports = {
    SESSION_COOKIE,
    DEFAULT_SESSION_MAX_AGE_MS,
    readAdminAuthConfig,
    isAdminAuthConfigured,
    looksLikeBcryptHash,
    getAdminAuthDiagnostics,
    verifyAdminPassword,
    createSessionToken,
    verifySessionToken,
    buildSessionCookie,
    buildClearSessionCookie
};
