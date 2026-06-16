(function(global) {
    'use strict';

    /**
     * Feature flag keys — used by server entitlements and UI gating.
     * Never embed license keys or validation secrets here.
     */
    const FEATURES = {
        SIGNAL_LAB_EXPORT_PNG: 'signalLab.exportPng',
        SIGNAL_LAB_EXPORT_BATCH: 'signalLab.exportBatch',
        SIGNAL_LAB_POPOUT_LIVE: 'signalLab.popoutLiveSync',
        SIGNAL_LAB_PREMIUM_PATTERNS: 'signalLab.premiumPatterns',
        LED_WALL_SAVE_PROJECT: 'ledWall.saveProject',
        LED_WALL_EXPORT_REPORT: 'ledWall.exportReport',
        DESKTOP_OFFLINE: 'platform.desktopOffline',
        DESKTOP_MULTI_DISPLAY: 'platform.multiDisplay'
    };

    const TIERS = {
        free: {
            label: 'Free Web',
            features: [
                FEATURES.SIGNAL_LAB_EXPORT_PNG
            ]
        },
        standard: {
            label: 'Standard',
            features: [
                FEATURES.SIGNAL_LAB_EXPORT_PNG,
                FEATURES.LED_WALL_SAVE_PROJECT,
                FEATURES.LED_WALL_EXPORT_REPORT
            ]
        },
        professional: {
            label: 'Professional',
            features: Object.values(FEATURES)
        }
    };

    const api = { FEATURES, TIERS };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.CommercialFeatures = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
