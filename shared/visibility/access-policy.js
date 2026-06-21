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
        const registry = getRegistry();
        if (registry?.resolveVisibilityPathValue) {
            return registry.resolveVisibilityPathValue(requestPath);
        }

        let normalized = (requestPath || '/').split('?')[0].replace(/\\/g, '/').toLowerCase();
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1) || '/';
        }
        if (normalized === '/' || normalized === '/index.html') {
            return '';
        }
        return normalized.replace(/^\//, '');
    }

    function normalizePathname(pathname) {
        return (pathname || '/').split('?')[0].replace(/\\/g, '/').toLowerCase().replace(/\/$/, '') || '/';
    }

    function isExplicitIndexPath(pathname) {
        const normalized = normalizePathname(pathname);
        return normalized === '/index.html' || normalized.endsWith('/index.html');
    }

    function isConstructionLandingPath(pathname) {
        const normalized = normalizePathname(pathname);
        return normalized === '/' || normalized === '/index.html';
    }

    function isAdminRoutePath(pathname) {
        const pathValue = normalizePath(pathname);
        return pathValue === ADMIN_LOGIN_PAGE || pathValue === ADMIN_ANALYTICS_PAGE;
    }

    function getSettingsHelpers() {
        if (typeof module !== 'undefined' && module.exports) {
            try {
                return require('../settings/site-settings');
            } catch {
                return null;
            }
        }
        return global.OkamiShared?.Settings || null;
    }

    function isPageVisible(settings, pageKey) {
        const helpers = getSettingsHelpers();
        if (helpers?.isPageVisible) {
            return helpers.isPageVisible(settings, pageKey);
        }

        const entry = settings?.pages?.[pageKey];
        if (entry == null) {
            return true;
        }
        if (typeof entry === 'boolean') {
            return entry !== false;
        }
        return entry.visible !== false;
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

    function resolvePathname(input) {
        if (input.pathname) {
            return input.pathname;
        }
        if (input.pathValue === '' || input.pathValue == null) {
            return '/';
        }
        if (String(input.pathValue).startsWith('/')) {
            return input.pathValue;
        }
        return `/${input.pathValue}`;
    }

    /**
     * Shared visibility decision for server middleware and browser routing.
     * @param {{ pathValue?: string, pathname?: string, settings: object, role?: string, isAdmin?: boolean }} input
     */
    function getAccessDecision(input) {
        const settings = input.settings || {};
        const pathname = resolvePathname(input);
        const indexCheckPath = input.pathname || pathname;
        const pathValue = input.pathValue != null
            ? input.pathValue
            : normalizePath(pathname);

        if (pathValue === '404.html' || pathValue === '50x.html' || pathValue === ADMIN_LOGIN_PAGE) {
            return { allowed: true, reason: null };
        }

        if (pathValue === ADMIN_ANALYTICS_PAGE) {
            return isAdminRole(input)
                ? { allowed: true, reason: null }
                : { allowed: false, reason: 'admin-auth' };
        }

        if (isAdminRoutePath(pathname)) {
            return isAdminRole(input)
                ? { allowed: true, reason: null }
                : { allowed: false, reason: 'admin-auth' };
        }

        if (settings.constructionMode) {
            if (isConstructionLandingPath(pathname)) {
                return { allowed: true, reason: null };
            }
            if (isAdminRole(input)) {
                return { allowed: true, reason: null };
            }
            return { allowed: false, reason: 'construction' };
        }

        // Live site: "/" is the public home landing — not the construction splash.
        if (pathValue === '' && !isExplicitIndexPath(indexCheckPath)) {
            return { allowed: true, reason: null };
        }

        if (isExplicitIndexPath(indexCheckPath) || pathValue === 'index.html') {
            return { allowed: false, reason: 'home' };
        }

        if (pathValue.startsWith('tools/') && !isPageVisible(settings, 'tools')) {
            return { allowed: false, reason: 'hidden' };
        }

        let pageKey = getPageKeyFromPath(pathValue);
        if (!pageKey && input.pathname) {
            pageKey = getPageKeyFromPath(normalizeVisibilityPath(input.pathname));
        }
        if (pageKey && !isPageVisible(settings, pageKey)) {
            return { allowed: false, reason: 'hidden' };
        }

        return { allowed: true, reason: null };
    }

    function resolvePublicLandingPage(settings) {
        return settings?.constructionMode ? 'construction' : 'home';
    }

    function buildVisibilityRedirect(pathValue, reason, settings) {
        const constructionActive = Boolean(settings?.constructionMode);

        if (reason === 'home') {
            return '/';
        }
        if (reason === 'construction') {
            return '/';
        }
        if (reason === 'hidden') {
            if (constructionActive) {
                return '/';
            }
            return '/404.html';
        }
        if (reason === 'admin-auth') {
            return '/admin.html';
        }
        return '/';
    }

    function resolveRouteDecision(input) {
        const pathname = resolvePathname(input);
        const pathValue = input.pathValue != null
            ? input.pathValue
            : normalizePath(pathname);
        const access = getAccessDecision(input);

        if (access.allowed) {
            return {
                action: 'none',
                reason: null,
                target: null,
                pathname,
                pathValue
            };
        }

        return {
            action: 'redirect',
            reason: access.reason,
            target: buildVisibilityRedirect(pathValue, access.reason, input.settings),
            pathname,
            pathValue
        };
    }

    function isSystemPage(pathname) {
        return SYSTEM_PAGES.has(normalizePath(pathname));
    }

    const api = {
        SYSTEM_PAGES,
        ADMIN_LOGIN_PAGE,
        ADMIN_ANALYTICS_PAGE,
        normalizePath,
        normalizePathname,
        normalizeVisibilityPath,
        isExplicitIndexPath,
        isConstructionLandingPath,
        isAdminRoutePath,
        isPageVisible,
        getAccessDecision,
        resolvePublicLandingPage,
        resolveRouteDecision,
        buildVisibilityRedirect,
        isSystemPage
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.Visibility = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
