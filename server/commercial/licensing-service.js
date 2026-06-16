'use strict';

const { readCommercialConfig, hasLicenseBackend } = require('./config');

/**
 * Server-side license verification placeholder.
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

    if (!hasLicenseBackend(config)) {
        return {
            valid: false,
            tier: 'free',
            source: 'license-backend-unconfigured',
            message: 'License server is not configured. Set OKAMI_LICENSE_SERVER_URL and OKAMI_LICENSE_API_KEY.'
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

    // Placeholder: integrate with Stripe/LemonSqueezy/custom license API via server-side fetch.
    // Do NOT embed validation algorithms or shared secrets in frontend code.
    return {
        valid: false,
        tier: 'free',
        source: 'license-verification-not-implemented',
        message: 'License verification endpoint is stubbed. Implement server-side verification before production.'
    };
}

module.exports = {
    verifyLicense
};
