'use strict';

/**
 * Server-only commercial configuration.
 * Secrets are read from environment variables — never ship to the browser.
 */
function readCommercialConfig() {
    return {
        licenseServerUrl: process.env.OKAMI_LICENSE_SERVER_URL || '',
        licenseApiKey: process.env.OKAMI_LICENSE_API_KEY || '',
        accountServiceUrl: process.env.OKAMI_ACCOUNT_SERVICE_URL || '',
        updateFeedUrl: process.env.OKAMI_UPDATE_FEED_URL || '',
        updateFeedTimeoutMs: Number(process.env.OKAMI_UPDATE_FEED_TIMEOUT_MS) || 10000,
        sessionSecret: process.env.OKAMI_SESSION_SECRET || '',
        commercialEnabled: process.env.OKAMI_COMMERCIAL_ENABLED === 'true',
        clientCommercialUiEnabled: process.env.OKAMI_CLIENT_COMMERCIAL_UI === 'true',
        strictValidation: process.env.OKAMI_COMMERCIAL_STRICT === 'true',
        licenseDevAcceptKey: process.env.OKAMI_LICENSE_DEV_ACCEPT_KEY || '',
        licenseVerifyPath: process.env.OKAMI_LICENSE_VERIFY_PATH || '/verify',
        licenseVerifyTimeoutMs: Number(process.env.OKAMI_LICENSE_VERIFY_TIMEOUT_MS) || 10000,
        licenseDevAcceptTier: process.env.OKAMI_LICENSE_DEV_ACCEPT_TIER || 'standard',
        accountMagicLinkStub: process.env.OKAMI_ACCOUNT_MAGIC_LINK_STUB === 'true'
    };
}

function hasLicenseBackend(config) {
    return Boolean(config.licenseServerUrl && config.licenseApiKey);
}

/**
 * Validate commercial env when enabled. Warnings by default; strict mode exits startup.
 */
function validateCommercialConfig(config = readCommercialConfig()) {
    const issues = [];

    if (!config.commercialEnabled) {
        return { ok: true, issues, commercialEnabled: false };
    }

    if (!config.sessionSecret) {
        issues.push({
            level: 'warn',
            code: 'missing_session_secret',
            message: 'OKAMI_SESSION_SECRET is not set — account sessions cannot be signed securely.'
        });
    }

    if (!hasLicenseBackend(config)) {
        issues.push({
            level: 'warn',
            code: 'license_backend_unconfigured',
            message: 'OKAMI_LICENSE_SERVER_URL and OKAMI_LICENSE_API_KEY are not set — license verify will fail.'
        });
    }

    if (!config.updateFeedUrl) {
        issues.push({
            level: 'info',
            code: 'update_feed_unconfigured',
            message: 'OKAMI_UPDATE_FEED_URL is not set — version checks return stub responses.'
        });
    }

    const blocking = issues.filter((issue) => issue.level === 'error');
    const ok = !config.strictValidation || blocking.length === 0;

    return { ok, issues, commercialEnabled: true };
}

function logCommercialValidation(result) {
    if (!result.commercialEnabled) {
        return;
    }

    result.issues.forEach((issue) => {
        const prefix = `[commercial:${issue.code}]`;
        if (issue.level === 'error') {
            console.error(prefix, issue.message);
        } else if (issue.level === 'warn') {
            console.warn(prefix, issue.message);
        } else {
            console.log(prefix, issue.message);
        }
    });

    if (!result.ok) {
        throw new Error('Commercial configuration validation failed (OKAMI_COMMERCIAL_STRICT=true).');
    }
}

module.exports = {
    readCommercialConfig,
    hasLicenseBackend,
    validateCommercialConfig,
    logCommercialValidation
};
