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
        sessionSecret: process.env.OKAMI_SESSION_SECRET || '',
        commercialEnabled: process.env.OKAMI_COMMERCIAL_ENABLED === 'true'
    };
}

function hasLicenseBackend(config) {
    return Boolean(config.licenseServerUrl && config.licenseApiKey);
}

module.exports = {
    readCommercialConfig,
    hasLicenseBackend
};
