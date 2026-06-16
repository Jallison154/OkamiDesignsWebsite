'use strict';

const productVersion = require('../../shared/commercial/product-version');
const { readCommercialConfig } = require('./config');

function parseVersionParts(version = '') {
    return String(version)
        .replace(/^v/i, '')
        .split(/[.-]/)
        .map((part) => parseInt(part, 10))
        .map((num) => (Number.isFinite(num) ? num : 0));
}

function compareVersions(a, b) {
    const left = parseVersionParts(a);
    const right = parseVersionParts(b);
    const length = Math.max(left.length, right.length);

    for (let index = 0; index < length; index += 1) {
        const diff = (left[index] || 0) - (right[index] || 0);
        if (diff !== 0) {
            return diff > 0 ? 1 : -1;
        }
    }

    return 0;
}

function pickChannelManifest(manifest, channel) {
    if (!manifest || typeof manifest !== 'object') {
        return null;
    }

    if (manifest[channel] && typeof manifest[channel] === 'object') {
        return manifest[channel];
    }

    if (manifest.latestVersion || manifest.version) {
        return manifest;
    }

    return null;
}

async function fetchUpdateManifest(config) {
    const timeoutMs = Number(config.updateFeedTimeoutMs) || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(config.updateFeedUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Update feed responded with ${response.status}`);
        }

        return response.json();
    } finally {
        clearTimeout(timer);
    }
}

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

    try {
        const manifest = await fetchUpdateManifest(config);
        const channelManifest = pickChannelManifest(manifest, channel);

        if (!channelManifest) {
            response.source = 'update-feed-invalid';
            response.message = `Update feed did not include a ${channel} manifest.`;
            return response;
        }

        const latestVersion = channelManifest.latestVersion
            || channelManifest.version
            || currentVersion;

        response.latestVersion = latestVersion;
        response.updateUrl = channelManifest.updateUrl || channelManifest.downloadUrl || null;
        response.releaseNotesUrl = channelManifest.releaseNotesUrl || channelManifest.notesUrl || null;
        response.updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
        response.source = 'update-feed';
        response.message = response.updateAvailable
            ? `Version ${latestVersion} is available.`
            : 'You are on the latest version.';
        return response;
    } catch (error) {
        const aborted = error.name === 'AbortError';
        response.source = aborted ? 'update-feed-timeout' : 'update-feed-error';
        response.message = aborted
            ? 'Update feed request timed out.'
            : (error.message || 'Update feed request failed.');
        return response;
    }
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
    getPublicVersionInfo,
    compareVersions
};
