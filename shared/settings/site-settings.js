(function(global) {
    'use strict';

    const DEFAULT_PAGE_CONFIG = {
        home: { visible: true, navOrder: 1 },
        tools: { visible: true, navOrder: 2 },
        prints: { visible: true, navOrder: 3 },
        support: { visible: true, navOrder: 4 },
        contact: { visible: true, navOrder: 5 },
        donate: { visible: true, navOrder: 6 },
        services: { visible: true, navOrder: 7 },
        ledVideoWallCalculator: { visible: true, navOrder: 8 },
        okamiSignalLab: { visible: true, navOrder: 9 }
    };

    const DEFAULT_PAGE_ORDER = Object.keys(DEFAULT_PAGE_CONFIG);

    const LEGACY_PAGE_ORDER = [
        'home',
        'services',
        'support',
        'contact',
        'tools',
        'ledVideoWallCalculator',
        'okamiSignalLab'
    ];

    function cloneDefaultPageConfig() {
        return JSON.parse(JSON.stringify(DEFAULT_PAGE_CONFIG));
    }

    function asBoolean(value, fallback = false) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (value == null) {
            return fallback;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
                return true;
            }
            if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off' || normalized === '') {
                return false;
            }
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        return Boolean(value);
    }

    function normalizePageEntry(raw, fallback) {
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            return {
                visible: raw.visible == null ? fallback.visible : asBoolean(raw.visible, fallback.visible),
                navOrder: Number.isFinite(Number(raw.navOrder))
                    ? Number(raw.navOrder)
                    : fallback.navOrder
            };
        }

        if (typeof raw === 'boolean' || typeof raw === 'string' || typeof raw === 'number') {
            return {
                visible: asBoolean(raw, fallback.visible),
                navOrder: fallback.navOrder
            };
        }

        return {
            visible: fallback.visible,
            navOrder: fallback.navOrder
        };
    }

    function normalizePages(rawPages, legacyPageOrder) {
        const pages = cloneDefaultPageConfig();

        Object.keys(DEFAULT_PAGE_CONFIG).forEach((key) => {
            pages[key] = normalizePageEntry(rawPages?.[key], DEFAULT_PAGE_CONFIG[key]);
        });

        const orderSource = Array.isArray(legacyPageOrder) && legacyPageOrder.length
            ? legacyPageOrder
            : null;

        if (orderSource) {
            const seen = new Set();
            orderSource.forEach((key, index) => {
                if (!pages[key]) {
                    return;
                }
                pages[key].navOrder = index + 1;
                seen.add(key);
            });

            let nextOrder = orderSource.length + 1;
            Object.keys(pages).forEach((key) => {
                if (seen.has(key)) {
                    return;
                }
                pages[key].navOrder = nextOrder;
                nextOrder += 1;
            });
        }

        return pages;
    }

    function isPageVisible(settings, key) {
        const entry = settings?.pages?.[key];
        if (entry == null) {
            return true;
        }
        if (typeof entry === 'boolean' || typeof entry === 'string' || typeof entry === 'number') {
            return asBoolean(entry, true);
        }
        if (entry.visible == null) {
            return true;
        }
        return asBoolean(entry.visible, true);
    }

    function getPageNavOrder(settings, key) {
        const entry = settings?.pages?.[key];
        if (entry && typeof entry === 'object' && Number.isFinite(Number(entry.navOrder))) {
            return Number(entry.navOrder);
        }
        if (DEFAULT_PAGE_CONFIG[key]) {
            return DEFAULT_PAGE_CONFIG[key].navOrder;
        }
        return 999;
    }

    function getNavKeysSorted(settings, keys) {
        return [...keys].sort((left, right) => {
            const orderDiff = getPageNavOrder(settings, left) - getPageNavOrder(settings, right);
            if (orderDiff !== 0) {
                return orderDiff;
            }
            return left.localeCompare(right);
        });
    }

    function getAdminItemKeysSorted(settings, keys) {
        return getNavKeysSorted(settings, keys);
    }

    function resetNavigationOrder(pages) {
        const reset = cloneDefaultPageConfig();
        Object.keys(reset).forEach((key) => {
            if (pages?.[key] && typeof pages[key] === 'object') {
                reset[key].visible = pages[key].visible !== false;
            } else if (typeof pages?.[key] === 'boolean') {
                reset[key].visible = pages[key] !== false;
            }
        });
        return reset;
    }

    function buildPagesFromOrderedRows(rows) {
        const pages = cloneDefaultPageConfig();
        rows.forEach((row, index) => {
            if (!pages[row.key]) {
                return;
            }
            pages[row.key].visible = row.visible !== false;
            pages[row.key].navOrder = index + 1;
        });
        return pages;
    }

    function mergeSettings(raw, options = {}) {
        const legacyPageOrder = Array.isArray(raw?.pageOrder) ? raw.pageOrder : null;
        const pages = normalizePages(raw?.pages, legacyPageOrder);

        const merged = {
            constructionMode: asBoolean(raw?.constructionMode, false),
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

    const DEFAULT_SITE_SETTINGS = mergeSettings({
        constructionMode: false,
        pages: DEFAULT_PAGE_CONFIG
    });

    function normalizePageOrder(rawOrder) {
        const keys = Array.isArray(rawOrder) ? rawOrder : DEFAULT_PAGE_ORDER;
        return getNavKeysSorted({ pages: normalizePages(null, keys) }, DEFAULT_PAGE_ORDER);
    }

    const api = {
        DEFAULT_SITE_SETTINGS,
        DEFAULT_PAGE_CONFIG,
        DEFAULT_PAGE_ORDER,
        LEGACY_PAGE_ORDER,
        cloneDefaultPageConfig,
        normalizePageEntry,
        normalizePages,
        isPageVisible,
        getPageNavOrder,
        getNavKeysSorted,
        getAdminItemKeysSorted,
        resetNavigationOrder,
        buildPagesFromOrderedRows,
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
