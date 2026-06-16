'use strict';

const { readCommercialConfig } = require('./config');

/**
 * Account/session placeholder — replace with OAuth, magic links, or desktop token exchange.
 */
async function getSession(req) {
    const config = readCommercialConfig();

    if (!config.commercialEnabled) {
        return {
            authenticated: false,
            user: null,
            tier: 'free',
            source: 'commercial-disabled'
        };
    }

    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        return {
            authenticated: false,
            user: null,
            tier: 'free',
            source: 'anonymous'
        };
    }

    // Placeholder: validate JWT/session token using OKAMI_SESSION_SECRET on the server.
    return {
        authenticated: false,
        user: null,
        tier: 'free',
        source: 'account-service-not-implemented',
        message: 'Account authentication is not wired yet.'
    };
}

async function getAccountProfile(req) {
    const session = await getSession(req);
    return {
        ...session,
        accountServiceUrl: readCommercialConfig().accountServiceUrl || null
    };
}

module.exports = {
    getSession,
    getAccountProfile
};
