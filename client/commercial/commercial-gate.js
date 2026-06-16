(function(global) {
    'use strict';

    let productId = null;
    let config = null;
    let entitlements = null;
    let initPromise = null;

    function getClient() {
        return global.OkamiCommercialClient || null;
    }

    function getFeatures() {
        return global.OkamiShared?.CommercialFeatures?.FEATURES
            || getClient()?.getFeatureKeys?.()
            || {};
    }

    async function initForProduct(id) {
        if (initPromise && productId === id) {
            return initPromise;
        }

        productId = id;
        initPromise = (async () => {
            const client = getClient();
            if (!client) {
                return { gatingActive: false, uiActive: false };
            }

            config = await client.fetchConfig();
            const gatingActive = client.isGatingActive(config);
            const uiActive = client.isUiActive(config);

            if (gatingActive) {
                entitlements = await client.fetchEntitlements(id);
                global.OkamiCommercialEntitlements = entitlements;
            } else {
                entitlements = {
                    tier: 'professional',
                    featureMap: Object.values(getFeatures()).reduce((acc, key) => {
                        acc[key] = true;
                        return acc;
                    }, {})
                };
            }

            if (uiActive && global.OkamiCommercialUi) {
                await global.OkamiCommercialUi.initCommercialUi({
                    productId: id,
                    footer: false
                });
            }

            if (uiActive && global.OkamiCommercialLicensePanel) {
                global.OkamiCommercialLicensePanel.mount({
                    productId: id,
                    onActivated: refreshEntitlements
                });
            }

            return { gatingActive, uiActive, entitlements, config };
        })();

        return initPromise;
    }

    async function refreshEntitlements() {
        const client = getClient();
        if (!client || !productId) {
            return entitlements;
        }
        client.clearCache();
        config = await client.fetchConfig();
        entitlements = await client.fetchEntitlements(productId, { forceRefresh: true });
        global.OkamiCommercialEntitlements = entitlements;
        return entitlements;
    }

    async function canUseFeature(featureKey) {
        if (!productId) {
            await initForProduct('okami-signal-lab');
        }

        const client = getClient();
        if (!client || !client.isGatingActive(config)) {
            return true;
        }

        if (!entitlements) {
            entitlements = await client.fetchEntitlements(productId);
        }

        return client.hasFeature(entitlements, featureKey);
    }

    function exportNeedsPremium(state = {}) {
        const preset = state.resolutionPreset || '1920x1080';
        const format = state.format || 'png';
        return format === 'jpg'
            || preset === '3840x2160'
            || preset === '7680x4320'
            || preset === 'custom';
    }

    async function checkExportAllowed(state) {
        const features = getFeatures();
        if (!exportNeedsPremium(state)) {
            return { allowed: true };
        }

        const allowed = await canUseFeature(features.SIGNAL_LAB_EXPORT_BATCH);
        return {
            allowed,
            featureKey: features.SIGNAL_LAB_EXPORT_BATCH,
            reason: allowed ? null : 'premium_export'
        };
    }

    function isPremiumPattern(moduleId, patternId) {
        return Boolean(global.OkamiShared?.CommercialPremiumPatterns?.isPremiumPattern?.(moduleId, patternId));
    }

    function canUsePremiumPatternSync(moduleId, patternId) {
        if (!isPremiumPattern(moduleId, patternId)) {
            return true;
        }

        const client = getClient();
        if (!client?.isGatingActive(config)) {
            return true;
        }

        const activeEntitlements = entitlements || global.OkamiCommercialEntitlements;
        const features = getFeatures();
        return client.hasFeature(activeEntitlements, features.SIGNAL_LAB_PREMIUM_PATTERNS);
    }

    async function checkPopoutAllowed() {
        const features = getFeatures();
        const allowed = await canUseFeature(features.SIGNAL_LAB_POPOUT_LIVE);
        return {
            allowed,
            featureKey: features.SIGNAL_LAB_POPOUT_LIVE,
            reason: allowed ? null : 'premium_popout'
        };
    }

    function showUpgradeNotice(message) {
        const container = document.getElementById('signal-lab-module-options')
            || document.querySelector('.signal-lab-controls-scroll');
        if (global.OkamiCommercialUi?.renderUpgradePlaceholder && container) {
            global.OkamiCommercialUi.renderUpgradePlaceholder(container, productId || 'okami-signal-lab');
        }
        if (message && container && !container.querySelector('[data-okami-upgrade-notice]')) {
            const note = document.createElement('p');
            note.className = 'okami-upgrade-notice';
            note.setAttribute('data-okami-upgrade-notice', 'true');
            note.textContent = message;
            container.prepend(note);
        }
    }

    global.OkamiCommercialGate = {
        initForProduct,
        refreshEntitlements,
        canUseFeature,
        checkExportAllowed,
        checkPopoutAllowed,
        exportNeedsPremium,
        isPremiumPattern,
        canUsePremiumPatternSync,
        showUpgradeNotice,
        getFeatures,
        isGatingActive() {
            return Boolean(getClient()?.isGatingActive(config));
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
