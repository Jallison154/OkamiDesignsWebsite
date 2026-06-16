'use strict';

const { readCommercialConfig, hasLicenseBackend } = require('./config');

/**
 * Upstream license provider — replace body with Stripe / LemonSqueezy / custom API.
 */
async function verifyWithUpstream(config, payload) {
    const licenseKey = payload.licenseKey || payload.key || '';
    const productId = payload.productId || null;

    // Placeholder fetch — never call from browser.
    void config.licenseServerUrl;
    void config.licenseApiKey;
    void productId;

    return {
        valid: false,
        tier: 'free',
        source: 'license-verification-not-implemented',
        message: 'License verification endpoint is stubbed. Implement server-side verification before production.'
    };
}

/**
 * Staging-only dev key (OKAMI_LICENSE_DEV_ACCEPT_KEY). Never expose the key to clients.
 */
function verifyDevLicenseKey(config, licenseKey) {
    const devKey = config.licenseDevAcceptKey || '';
    if (!devKey || !licenseKey || licenseKey !== devKey) {
        return null;
    }

    return {
        valid: true,
        tier: 'standard',
        source: 'dev-accept-key',
        message: 'Development license key accepted.'
    };
}

/**
 * Server-side license verification.
 * Real validation must run here or on an upstream license service — never in the browser.
 */
async function verifyLicense(payload = {}) {
    const config = readCommercialConfig();

    if (!config.commercialEnabled) {
        return {
            valid: true,
            tier: 'professional',
            source: 'commercial-disabled',
            message: 'Commercial licensing is not enabled on this deployment.'
        };
    }

    const licenseKey = payload.licenseKey || payload.key || '';
    if (!licenseKey) {
        return {
            valid: false,
            tier: 'free',
            source: 'missing-license-key',
            message: 'License key is required.'
        };
    }

    const devResult = verifyDevLicenseKey(config, licenseKey);
    if (devResult) {
        return devResult;
    }

    if (!hasLicenseBackend(config)) {
        return {
            valid: false,
            tier: 'free',
            source: 'license-backend-unconfigured',
            message: 'License server is not configured. Set OKAMI_LICENSE_SERVER_URL and OKAMI_LICENSE_API_KEY.'
        };
    }

    return verifyWithUpstream(config, payload);
}

module.exports = {
    verifyLicense,
    verifyWithUpstream,
    verifyDevLicenseKey
};
