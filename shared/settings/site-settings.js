(function(global) {
    'use strict';

    const DEFAULT_PAGE_ORDER = [
        'home',
        'services',
        'support',
        'contact',
        'tools',
        'ledVideoWallCalculator',
        'okamiSignalLab'
    ];

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
        },
        pageOrder: DEFAULT_PAGE_ORDER.slice()
    };

    function normalizePageOrder(rawOrder) {
        const order = Array.isArray(rawOrder)
            ? rawOrder.filter((key) => Object.prototype.hasOwnProperty.call(DEFAULT_SITE_SETTINGS.pages, key))
            : [];

        DEFAULT_PAGE_ORDER.forEach((key) => {
            if (!order.includes(key)) {
                order.push(key);
            }
        });

        return order;
    }

    function mergeSettings(raw, options = {}) {
        const pages = { ...DEFAULT_SITE_SETTINGS.pages, ...(raw?.pages || {}) };
        Object.keys(DEFAULT_SITE_SETTINGS.pages).forEach((key) => {
            pages[key] = pages[key] !== false;
        });

        const merged = {
            constructionMode: Boolean(raw?.constructionMode),
            pages,
            pageOrder: normalizePageOrder(raw?.pageOrder),
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
        DEFAULT_PAGE_ORDER,
        normalizePageOrder,
        mergeSettings,
        normalizeSiteSettings
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.Settings = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
