(function(global) {
    'use strict';

    const SYSTEM_PAGES = new Set(['404.html', '50x.html']);
    const ADMIN_LOGIN_PAGE = 'admin.html';
    const ADMIN_ANALYTICS_PAGE = 'admin-analytics.html';

    function normalizePath(pathname) {
        const path = (pathname || '').replace(/^\//, '').toLowerCase();
        if (!path || path === 'index.html') {
            return '';
        }
        return path;
    }

    function normalizeVisibilityPath(requestPath) {
        let normalized = (requestPath || '/').split('?')[0].replace(/\\/g, '/').toLowerCase();
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1) || '/';
        }
        if (normalized === '/' || normalized === '/index.html') {
            return '';
        }
        return normalized.replace(/^\//, '');
    }

    function getRegistry() {
        if (typeof module !== 'undefined' && module.exports) {
            try {
                return require('../registry/pages');
            } catch {
                return null;
            }
        }
        return global.OkamiShared?.Registry || global.OkamiPageRegistry || null;
    }

    function getPageKeyFromPath(pathValue) {
        const registry = getRegistry();
        if (registry?.getPageKeyFromPathValue) {
            return registry.getPageKeyFromPathValue(pathValue);
        }
        return null;
    }

    function isAdminRole(input) {
        if (typeof input.isAdmin === 'boolean') {
            return input.isAdmin;
        }
        return input.role === 'admin';
    }

    /**
     * Shared visibility decision for server middleware and browser routing.
     * @param {{ pathValue?: string, pathname?: string, settings: object, role?: string, isAdmin?: boolean }} input
     */
    function getAccessDecision(input) {
        const settings = input.settings || {};
        const pathValue = input.pathValue != null
            ? input.pathValue
            : normalizePath(input.pathname);

        if (pathValue === '404.html' || pathValue === '50x.html' || pathValue === ADMIN_LOGIN_PAGE) {
            return { allowed: true, reason: null };
        }

        if (pathValue === ADMIN_ANALYTICS_PAGE) {
            return isAdminRole(input)
                ? { allowed: true, reason: null }
                : { allowed: false, reason: 'admin-auth' };
        }

        if (isAdminRole(input)) {
            return { allowed: true, reason: null };
        }

        if (settings.constructionMode) {
            if (pathValue === '') {
                return { allowed: true, reason: null };
            }
            return { allowed: false, reason: 'construction' };
        }

        if (pathValue === '') {
            return { allowed: false, reason: 'home' };
        }

        if (pathValue.startsWith('tools/') && settings.pages?.tools === false) {
            return { allowed: false, reason: 'hidden' };
        }

        const pageKey = getPageKeyFromPath(pathValue);
        if (pageKey && settings.pages?.[pageKey] === false) {
            return { allowed: false, reason: 'hidden' };
        }

        return { allowed: true, reason: null };
    }

    function resolvePublicLandingPage(settings) {
        return settings?.constructionMode ? 'construction' : 'home';
    }

    function buildVisibilityRedirect(pathValue, reason) {
        const inTools = pathValue.startsWith('tools/');
        if (reason === 'home') {
            return inTools ? '/' : '/';
        }
        if (reason === 'construction') {
            return inTools ? '/index.html' : '/';
        }
        if (reason === 'hidden') {
            return inTools ? '/404.html' : '/404.html';
        }
        if (reason === 'admin-auth') {
            return inTools ? '/admin.html' : '/admin.html';
        }
        return '/index.html';
    }

    function isSystemPage(pathname) {
        return SYSTEM_PAGES.has(normalizePath(pathname));
    }

    const api = {
        SYSTEM_PAGES,
        ADMIN_LOGIN_PAGE,
        ADMIN_ANALYTICS_PAGE,
        normalizePath,
        normalizeVisibilityPath,
        getAccessDecision,
        resolvePublicLandingPage,
        buildVisibilityRedirect,
        isSystemPage
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.Visibility = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
