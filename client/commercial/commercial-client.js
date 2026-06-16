(function(global) {
    'use strict';

    const API_BASE = '/api/commercial';

    let configCache = null;
    let entitlementsCache = new Map();

    function buildAllFeaturesMap() {
        const features = global.OkamiShared?.CommercialFeatures?.FEATURES;
        if (!features) {
            return {};
        }
        return Object.values(features).reduce((acc, key) => {
            acc[key] = true;
            return acc;
        }, {});
    }

    function isGatingActive(config = configCache) {
        return Boolean(config?.commercialEnabled || config?.featureGatingEnabled);
    }

    function isUiActive(config = configCache) {
        return Boolean(config?.clientCommercialUiEnabled);
    }

    async function fetchJson(path, options = {}) {
        const response = await fetch(`${API_BASE}${path}`, {
            credentials: 'same-origin',
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            throw new Error(`Commercial API ${path} failed (${response.status})`);
        }

        return response.json();
    }

    async function fetchConfig(forceRefresh = false) {
        if (configCache && !forceRefresh) {
            return configCache;
        }

        try {
            configCache = await fetchJson('/config');
        } catch (error) {
            console.warn('Commercial config unavailable:', error.message || error);
            configCache = {
                commercialEnabled: false,
                clientCommercialUiEnabled: false,
                featureGatingEnabled: false,
                legal: global.OkamiShared?.CommercialPublic?.LEGAL_LINKS || {}
            };
        }

        return configCache;
    }

    async function fetchEntitlements(productId, options = {}) {
        const cacheKey = productId || '__default__';
        if (!options.forceRefresh && entitlementsCache.has(cacheKey)) {
            return entitlementsCache.get(cacheKey);
        }

        const query = productId ? `?productId=${encodeURIComponent(productId)}` : '';
        let entitlements;

        try {
            entitlements = await fetchJson(`/entitlements${query}`);
        } catch (error) {
            console.warn('Commercial entitlements unavailable:', error.message || error);
            entitlements = {
                productId: productId || null,
                tier: 'professional',
                featureMap: buildAllFeaturesMap(),
                license: { valid: true, source: 'fallback' }
            };
        }

        if (!isGatingActive(configCache)) {
            entitlements = {
                ...entitlements,
                tier: 'professional',
                featureMap: buildAllFeaturesMap()
            };
        }

        entitlementsCache.set(cacheKey, entitlements);
        return entitlements;
    }

    async function activateLicense(productId, licenseKey) {
        const entitlements = await fetchJson('/entitlements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, licenseKey })
        });
        entitlementsCache.set(productId || '__default__', entitlements);
        global.OkamiCommercialEntitlements = entitlements;
        return entitlements;
    }

    async function clearLicense() {
        await fetchJson('/license/clear', { method: 'POST' });
        clearCache();
        global.OkamiCommercialEntitlements = null;
    }

    async function fetchAccountSession() {
        return fetchJson('/account/session');
    }

    async function checkVersion(channel, currentVersion) {
        const params = new URLSearchParams();
        if (channel) {
            params.set('channel', channel);
        }
        if (currentVersion) {
            params.set('version', currentVersion);
        }
        const suffix = params.toString() ? `?${params.toString()}` : '';
        return fetchJson(`/version${suffix}`);
    }

    function hasFeature(entitlements, featureKey) {
        if (!isGatingActive()) {
            return true;
        }
        return Boolean(entitlements?.featureMap?.[featureKey]);
    }

    function clearCache() {
        configCache = null;
        entitlementsCache.clear();
    }

    global.OkamiCommercialClient = {
        fetchConfig,
        fetchEntitlements,
        activateLicense,
        clearLicense,
        fetchAccountSession,
        checkVersion,
        hasFeature,
        isGatingActive,
        isUiActive,
        clearCache,
        getFeatureKeys() {
            return global.OkamiShared?.CommercialFeatures?.FEATURES || {};
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
