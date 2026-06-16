'use strict';

const { readCommercialConfig } = require('./config');

/**
 * Staging-only magic link placeholder — no email is sent.
 * Enable with OKAMI_ACCOUNT_MAGIC_LINK_STUB=true for UI integration tests.
 */
async function requestMagicLink(payload = {}) {
    const config = readCommercialConfig();

    if (!config.commercialEnabled) {
        return {
            ok: false,
            error: 'commercial_disabled',
            message: 'Account sign-in is not available while commercial mode is off.'
        };
    }

    if (!config.accountMagicLinkStub) {
        return {
            ok: false,
            error: 'magic_link_unavailable',
            message: 'Magic link sign-in is not configured on this server.'
        };
    }

    const email = String(payload.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return {
            ok: false,
            error: 'invalid_email',
            message: 'Enter a valid email address.'
        };
    }

    return {
        ok: true,
        sent: true,
        stub: true,
        email,
        message: 'Magic link stub accepted. No email was sent — wire OKAMI_ACCOUNT_SERVICE_URL for production.'
    };
}

module.exports = {
    requestMagicLink
};
