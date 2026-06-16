(function(global) {
    'use strict';

    /** Set true when commercial API + UI gating is ready for production. */
    const COMMERCIAL_ENABLED = false;

    const API_BASE = '/api/commercial';

    const MOCK_CONFIG = {
        companyName: 'Okami Designs',
        legal: global.OkamiShared?.CommercialPublic?.LEGAL_LINKS || {},
        commercialEnabled: false
    };

    const MOCK_ENTITLEMENTS = {
        tier: 'professional',
        tierLabel: 'Development',
        featureMap: {},
        authenticated: false,
        license: { valid: true, source: 'mock', message: null }
    };

    let configCache = null;
    let entitlementsCache = new Map();

    function buildAllFeaturesMap() {
        const features = global.OkamiShared?.CommercialFeatures?.FEATURES;
        if (!features) {
            return { all: true };
        }
        return Object.values(features).reduce((acc, key) => {
            acc[key] = true;
            return acc;
        }, {});
    }

    MOCK_ENTITLEMENTS.featureMap = buildAllFeaturesMap();

    async function fetchJson(path, options = {}) {
        if (!COMMERCIAL_ENABLED) {
            if (path === '/config' || path.startsWith('/config?')) {
                return { ...MOCK_CONFIG, featureMap: MOCK_ENTITLEMENTS.featureMap };
            }
            if (path.startsWith('/entitlements')) {
                return { ...MOCK_ENTITLEMENTS, featureMap: buildAllFeaturesMap() };
            }
            if (path.startsWith('/account/session')) {
                return { authenticated: false, user: null, tier: 'professional' };
            }
            if (path.startsWith('/version')) {
                return { updateAvailable: false, currentVersion: '1.0.0' };
            }
        }

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
            console.warn('Commercial config unavailable, using mock:', error.message || error);
            configCache = { ...MOCK_CONFIG, featureMap: buildAllFeaturesMap() };
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
            console.warn('Commercial entitlements unavailable, using mock:', error.message || error);
            entitlements = {
                ...MOCK_ENTITLEMENTS,
                productId: productId || null,
                featureMap: buildAllFeaturesMap()
            };
        }
        entitlementsCache.set(cacheKey, entitlements);
        return entitlements;
    }

    async function fetchAccountSession() {
        try {
            return await fetchJson('/account/session');
        } catch {
            return { authenticated: false, user: null, tier: 'professional' };
        }
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
        try {
            return await fetchJson(`/version${suffix}`);
        } catch {
            return { updateAvailable: false, currentVersion: currentVersion || '1.0.0' };
        }
    }

    function hasFeature(entitlements, featureKey) {
        if (!COMMERCIAL_ENABLED) {
            return true;
        }
        return Boolean(entitlements?.featureMap?.[featureKey]);
    }

    function clearCache() {
        configCache = null;
        entitlementsCache.clear();
    }

    global.OkamiCommercialClient = {
        COMMERCIAL_ENABLED,
        fetchConfig,
        fetchEntitlements,
        fetchAccountSession,
        checkVersion,
        hasFeature,
        clearCache
    };
})(typeof window !== 'undefined' ? window : globalThis);
