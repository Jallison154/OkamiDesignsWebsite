'use strict';

const { TIERS } = require('../../shared/commercial/features');
const { readCommercialConfig, hasLicenseBackend } = require('./config');
const { verifyWithUpstream } = require('./license-upstream');

/**
 * Staging-only dev key (OKAMI_LICENSE_DEV_ACCEPT_KEY). Never expose the key to clients.
 */
function verifyDevLicenseKey(config, licenseKey) {
    const devKey = config.licenseDevAcceptKey || '';
    if (!devKey || !licenseKey || licenseKey !== devKey) {
        return null;
    }

    const tier = TIERS[config.licenseDevAcceptTier] ? config.licenseDevAcceptTier : 'standard';

    return {
        valid: true,
        tier,
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
