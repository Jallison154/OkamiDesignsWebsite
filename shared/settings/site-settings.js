(function(global) {
    'use strict';

    const DEFAULT_SITE_SETTINGS = {
        constructionMode: false,
        pages: {
            home: true,
            services: true,
            tools: true,
            support: true,
            contact: true,
            ledVideoWallCalculator: true,
            okamiSignalLab: true
        }
    };

    function mergeSettings(raw, options = {}) {
        const pages = { ...DEFAULT_SITE_SETTINGS.pages, ...(raw?.pages || {}) };
        Object.keys(DEFAULT_SITE_SETTINGS.pages).forEach((key) => {
            pages[key] = pages[key] !== false;
        });

        const merged = {
            constructionMode: Boolean(raw?.constructionMode),
            pages,
            updatedAt: raw?.updatedAt || null
        };

        if (options.includeUpdatedAtDefault && !merged.updatedAt) {
            merged.updatedAt = new Date().toISOString();
        }

        return merged;
    }

    function normalizeSiteSettings(raw) {
        return mergeSettings(raw, { includeUpdatedAtDefault: true });
    }

    const api = {
        DEFAULT_SITE_SETTINGS,
        mergeSettings,
        normalizeSiteSettings
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.Settings = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
