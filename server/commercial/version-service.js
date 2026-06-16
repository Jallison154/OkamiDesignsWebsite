'use strict';

const productVersion = require('../../shared/commercial/product-version');
const { readCommercialConfig } = require('./config');

async function checkForUpdates(query = {}) {
    const channel = query.channel === 'desktop' ? 'desktop' : 'web';
    const currentVersion = query.version
        || (channel === 'desktop' ? productVersion.DESKTOP_APP_VERSION : productVersion.WEB_APP_VERSION);

    const config = readCommercialConfig();
    const response = {
        channel,
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        updateUrl: null,
        releaseNotesUrl: null,
        checkedAt: new Date().toISOString()
    };

    if (!config.updateFeedUrl) {
        response.source = 'update-feed-unconfigured';
        response.message = 'Set OKAMI_UPDATE_FEED_URL to enable remote update checks.';
        return response;
    }

    // Placeholder: fetch semver manifest from OKAMI_UPDATE_FEED_URL server-side.
    response.source = 'update-check-not-implemented';
    response.message = 'Update feed integration is stubbed. Implement server-side fetch before production.';
    return response;
}

function getPublicVersionInfo() {
    return {
        web: productVersion.WEB_APP_VERSION,
        desktop: productVersion.DESKTOP_APP_VERSION,
        channels: productVersion.RELEASE_CHANNELS
    };
}

module.exports = {
    checkForUpdates,
    getPublicVersionInfo
};
