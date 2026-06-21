(function() {
    'use strict';

    const settingsApi = window.OkamiShared?.Settings;
    const visibilityApi = window.OkamiShared?.Visibility;
    const registryApi = window.OkamiShared?.Registry || window.OkamiPageRegistry;

    const DEFAULT_SITE_SETTINGS = settingsApi?.DEFAULT_SITE_SETTINGS || {
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

    const PAGE_PATHS = registryApi?.getVisibilityPagePaths?.() || {
        home: ['home.html'],
        services: ['services.html'],
        support: ['support.html'],
        contact: ['contact.html'],
        tools: ['tools/index.html'],
        ledVideoWallCalculator: ['tools/led-wall-visualizer.html'],
        okamiSignalLab: ['tools/signal-lab.html']
    };

    const TOOL_PAGE_KEYS = registryApi?.TOOL_PAGE_KEYS || [
        'ledVideoWallCalculator',
        'okamiSignalLab'
    ];

    const SYSTEM_PAGES = visibilityApi?.SYSTEM_PAGES || new Set(['404.html', '50x.html']);
    const ADMIN_LOGIN_PAGE = visibilityApi?.ADMIN_LOGIN_PAGE || 'admin.html';
    const ADMIN_ANALYTICS_PAGE = visibilityApi?.ADMIN_ANALYTICS_PAGE || 'admin-analytics.html';

    let settingsCache = null;
    let settingsPromise = null;
    let settingsLoading = false;
    let lastAppliedSettingsSignature = null;
    let lastSettingsSource = 'config';
    let initialRouteApplied = false;
    let redirectInFlight = false;

    let adminSessionActive = false;

    async function refreshAdminSession() {
        try {
            const response = await fetch('/api/admin/session', {
                credentials: 'include',
                cache: 'no-store'
            });
            if (!response.ok) {
                adminSessionActive = false;
                return false;
            }

            const data = await response.json();
            adminSessionActive = data.authenticated === true;
            return adminSessionActive;
        } catch {
            adminSessionActive = false;
            return false;
        }
    }

    function isAdminUser() {
        return adminSessionActive;
    }

    function getUserRole() {
        return isAdminUser() ? 'admin' : 'public';
    }

    function normalizePath(pathname) {
        if (visibilityApi?.normalizePath) {
            return visibilityApi.normalizePath(pathname);
        }
        const path = (pathname || '').replace(/^\//, '').toLowerCase();
        if (!path || path === 'index.html') {
            return '';
        }
        return path;
    }

    function normalizePathname(pathname) {
        if (visibilityApi?.normalizePathname) {
            return visibilityApi.normalizePathname(pathname);
        }
        return (pathname || '/').split('?')[0].replace(/\\/g, '/').toLowerCase().replace(/\/$/, '') || '/';
    }

    function isSplashPage(pathname) {
        if (visibilityApi?.isConstructionLandingPath) {
            return visibilityApi.isConstructionLandingPath(pathname);
        }
        const normalized = normalizePathname(pathname);
        return normalized === '/' || normalized === '/index.html';
    }

    function isSystemPage(pathname) {
        return SYSTEM_PAGES.has(normalizePath(pathname));
    }

    function isAdminLoginPage(pathname) {
        return normalizePath(pathname) === ADMIN_LOGIN_PAGE;
    }

    function isAdminAnalyticsPage(pathname) {
        return normalizePath(pathname) === ADMIN_ANALYTICS_PAGE;
    }

    function isAdminRoute(pathname) {
        if (visibilityApi?.isAdminRoutePath) {
            return visibilityApi.isAdminRoutePath(pathname);
        }
        const path = normalizePath(pathname);
        return path === ADMIN_LOGIN_PAGE || path === ADMIN_ANALYTICS_PAGE;
    }

    function getPageKeyFromPath(pathname) {
        const path = normalizePath(pathname);
        if (registryApi?.getPageKeyFromPathValue) {
            return registryApi.getPageKeyFromPathValue(path);
        }

        for (const [key, paths] of Object.entries(PAGE_PATHS)) {
            if (paths.some((candidate) => candidate.toLowerCase() === path)) {
                return key;
            }
        }

        return null;
    }

    function getPageKeyFromUrl(url) {
        try {
            const parsed = new URL(url, window.location.origin);
            return getPageKeyFromPath(parsed.pathname);
        } catch {
            return null;
        }
    }

    function isToolsPath(pathname) {
        return normalizePath(pathname).startsWith('tools/');
    }

    function resolveRelativeUrl(targetPath) {
        if (!targetPath) {
            return null;
        }

        if (/^https?:\/\//i.test(targetPath)) {
            return targetPath;
        }

        if (targetPath.startsWith('/')) {
            return targetPath;
        }

        if (window.location.pathname.includes('/tools/')) {
            if (targetPath.startsWith('../')) {
                return targetPath;
            }
            return `../${targetPath}`;
        }

        return targetPath;
    }

    function getSettingsSignature(settings) {
        return JSON.stringify({
            constructionMode: Boolean(settings?.constructionMode),
            pages: settings?.pages || {}
        });
    }

    async function fetchSiteSettings(forceRefresh = false) {
        if (forceRefresh) {
            settingsCache = null;
            settingsPromise = null;
        }

        if (settingsCache) {
            return settingsCache;
        }

        if (!settingsPromise) {
            settingsLoading = true;
            settingsPromise = (async () => {
                try {
                    const response = await fetch('/api/site-settings', { cache: 'no-store' });
                    if (response.ok) {
                        lastSettingsSource = 'server';
                        settingsCache = mergeSettings(await response.json());
                        return settingsCache;
                    }
                } catch (error) {
                    console.warn('Site settings API unavailable:', error.message || error);
                }

                try {
                    const staticPrefix = window.location.pathname.includes('/tools/')
                        ? '../files/site-settings.json'
                        : 'files/site-settings.json';
                    const response = await fetch(`${staticPrefix}?t=${Date.now()}`, { cache: 'no-store' });
                    if (response.ok) {
                        lastSettingsSource = 'static';
                        settingsCache = mergeSettings(await response.json());
                        return settingsCache;
                    }
                } catch (error) {
                    console.warn('Static site settings unavailable:', error.message || error);
                }

                lastSettingsSource = 'config';
                settingsCache = mergeSettings(DEFAULT_SITE_SETTINGS);
                return settingsCache;
            })().finally(() => {
                settingsLoading = false;
            });
        }

        return settingsPromise;
    }

    function getLastSettingsSource() {
        return lastSettingsSource;
    }

    function isSettingsLoading() {
        return settingsLoading;
    }

    function logRouteDecision(details) {
        console.info('[Okami Route Guard]', {
            path: window.location.pathname,
            ...details,
            timestamp: new Date().toISOString()
        });
    }

    function logVisibilityDebug(settings, context = 'init') {
        const landing = settings?.constructionMode ? 'construction (/)' : 'home (/)';
        console.info('[Okami Site Visibility]', {
            context,
            constructionMode: Boolean(settings?.constructionMode),
            settingsSource: lastSettingsSource,
            path: window.location.pathname,
            isAdmin: isAdminUser(),
            selectedLandingPage: landing
        });
    }

    function mergeSettings(raw) {
        if (settingsApi?.mergeSettings) {
            return settingsApi.mergeSettings(raw);
        }

        const pages = { ...DEFAULT_SITE_SETTINGS.pages, ...(raw?.pages || {}) };
        Object.keys(DEFAULT_SITE_SETTINGS.pages).forEach((key) => {
            pages[key] = pages[key] !== false;
        });

        return {
            constructionMode: Boolean(raw?.constructionMode),
            pages,
            updatedAt: raw?.updatedAt || null
        };
    }

    function resolveRouteDecision(settings, pathname) {
        const role = getUserRole();

        if (visibilityApi?.resolveRouteDecision) {
            return visibilityApi.resolveRouteDecision({
                pathname,
                settings,
                role
            });
        }

        const access = canAccessPage(pathname, role, settings);
        if (access.allowed) {
            return {
                action: 'none',
                reason: null,
                target: null,
                pathname
            };
        }

        const pathValue = normalizePath(pathname);
        let target = '/';

        if (access.reason === 'home') {
            target = resolveRelativeUrl('/');
        } else if (access.reason === 'construction') {
            target = resolveRelativeUrl('/');
        } else if (access.reason === 'hidden') {
            target = settings?.constructionMode
                ? resolveRelativeUrl('/')
                : resolveRelativeUrl('404.html');
        } else if (access.reason === 'admin-auth') {
            target = resolveRelativeUrl('admin.html');
        }

        return {
            action: 'redirect',
            reason: access.reason,
            target,
            pathname
        };
    }

    function normalizeComparablePath(urlOrPath) {
        try {
            const parsed = new URL(urlOrPath, window.location.origin);
            return parsed.pathname.toLowerCase().replace(/\/$/, '') || '/';
        } catch {
            return normalizePathname(urlOrPath);
        }
    }

    function safeRedirect(target, decision, settings) {
        if (!target || redirectInFlight) {
            logRouteDecision({
                constructionMode: Boolean(settings?.constructionMode),
                routeDecision: decision?.action || 'none',
                reason: decision?.reason || null,
                redirectTarget: target || null,
                skipped: 'redirect-in-flight-or-empty-target'
            });
            return false;
        }

        const currentPath = normalizeComparablePath(window.location.href);
        const targetPath = normalizeComparablePath(target);

        logRouteDecision({
            constructionMode: Boolean(settings?.constructionMode),
            routeDecision: decision?.action || 'redirect',
            reason: decision?.reason || null,
            redirectTarget: targetPath,
            currentPath,
            skipped: currentPath === targetPath
        });

        if (currentPath === targetPath) {
            revealPage();
            return false;
        }

        redirectInFlight = true;
        window.location.replace(target);
        return true;
    }

    /**
     * Central route visibility check.
     * @param {string} pathname
     * @param {'admin'|'public'} userRole
     * @param {object} settings
     * @returns {{ allowed: boolean, reason: string|null }}
     */
    function canAccessPage(pathname, userRole, settings) {
        if (visibilityApi?.getAccessDecision) {
            return visibilityApi.getAccessDecision({
                pathname,
                settings,
                role: userRole
            });
        }

        if (isSystemPage(pathname) || isAdminLoginPage(pathname) || isAdminRoute(pathname)) {
            return { allowed: true, reason: null };
        }

        if (isAdminAnalyticsPage(pathname)) {
            return userRole === 'admin'
                ? { allowed: true, reason: null }
                : { allowed: false, reason: 'admin-auth' };
        }

        if (userRole === 'admin') {
            return { allowed: true, reason: null };
        }

        if (settings.constructionMode) {
            if (isSplashPage(pathname)) {
                return { allowed: true, reason: null };
            }
            return { allowed: false, reason: 'construction' };
        }

        const pathValue = normalizePath(pathname);
        const explicitIndex = visibilityApi?.isExplicitIndexPath
            ? visibilityApi.isExplicitIndexPath(pathname)
            : normalizePathname(pathname).endsWith('/index.html');

        if (pathValue === '' && !explicitIndex) {
            return { allowed: true, reason: null };
        }

        if (explicitIndex) {
            return { allowed: false, reason: 'home' };
        }

        if (isToolsPath(pathname) && settings.pages.tools === false) {
            return { allowed: false, reason: 'hidden' };
        }

        const pageKey = getPageKeyFromPath(pathname);
        if (pageKey && settings.pages[pageKey] === false) {
            return { allowed: false, reason: 'hidden' };
        }

        return { allowed: true, reason: null };
    }

    function revealPage() {
        document.documentElement.classList.remove('site-visibility-pending');
    }

    function hidePageUntilCheck() {
        if (getUserRole() !== 'admin' && !isAdminRoute(window.location.pathname)) {
            document.documentElement.classList.add('site-visibility-pending');
        }
    }

    async function applyRouteGuard(settings, context = 'init') {
        if (settingsLoading) {
            logRouteDecision({
                constructionMode: Boolean(settings?.constructionMode),
                routeDecision: 'wait',
                reason: 'settings-loading',
                redirectTarget: null
            });
            return true;
        }

        if (isAdminRoute(window.location.pathname)) {
            revealPage();
            logRouteDecision({
                constructionMode: Boolean(settings?.constructionMode),
                routeDecision: 'none',
                reason: 'admin-route',
                redirectTarget: null,
                context
            });
            return true;
        }

        const decision = resolveRouteDecision(settings, window.location.pathname);

        if (decision.action === 'redirect') {
            const redirected = safeRedirect(decision.target, decision, settings);
            return !redirected;
        }

        revealPage();
        logRouteDecision({
            constructionMode: Boolean(settings?.constructionMode),
            routeDecision: 'none',
            reason: null,
            redirectTarget: null,
            context
        });
        return true;
    }

    async function enforceCurrentPage() {
        const settings = await fetchSiteSettings();
        return applyRouteGuard(settings, 'enforce-current');
    }

    async function canAccessUrl(url) {
        const settings = await fetchSiteSettings();

        try {
            const parsed = new URL(url, window.location.origin);
            if (parsed.origin !== window.location.origin) {
                return true;
            }

            return canAccessPage(parsed.pathname, getUserRole(), settings).allowed;
        } catch {
            return true;
        }
    }

    async function enforceUrlAccess(url) {
        if (settingsLoading) {
            return true;
        }

        const settings = await fetchSiteSettings();

        try {
            const parsed = new URL(url, window.location.origin);
            const decision = resolveRouteDecision(settings, parsed.pathname);
            if (decision.action !== 'redirect') {
                return true;
            }

            safeRedirect(decision.target, decision, settings);
            return false;
        } catch {
            return true;
        }
    }

    function setNavItemVisible(element, visible) {
        if (!element) {
            return;
        }

        element.hidden = !visible;
        element.style.display = visible ? '' : 'none';
        element.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    function applyNavigation(settings) {
        const pages = settings.pages;
        const skipNavKeys = new Set(['tools', ...TOOL_PAGE_KEYS]);

        Object.entries(PAGE_PATHS).forEach(([pageKey, paths]) => {
            if (skipNavKeys.has(pageKey)) {
                return;
            }

            paths.forEach((path) => {
                document.querySelectorAll(`a[href="${path}"], a[href="../${path}"]`).forEach((link) => {
                    if (link.classList.contains('nav-dropdown-item') || link.classList.contains('nav-sublink')) {
                        return;
                    }
                    setNavItemVisible(link, pages[pageKey] !== false);
                });
            });
        });

        document.querySelectorAll('[data-tool-key]').forEach((link) => {
            const pageKey = link.dataset.toolKey;
            if (!pageKey || !Object.prototype.hasOwnProperty.call(pages, pageKey)) {
                return;
            }
            setNavItemVisible(link, pages[pageKey] !== false);
        });

        document.querySelectorAll('[data-tools-hub]').forEach((link) => {
            setNavItemVisible(link, pages.tools !== false);
        });

        const anyToolVisible = TOOL_PAGE_KEYS.some((key) => pages[key] !== false);
        const showToolsMenu = pages.tools !== false && anyToolVisible;

        document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
            setNavItemVisible(dropdown, showToolsMenu);
        });
        document.querySelectorAll('.nav-mobile-group').forEach((group) => {
            setNavItemVisible(group, showToolsMenu);
        });

        document.querySelectorAll('[data-tools-card]').forEach((card) => {
            const pageKey = card.dataset.toolsCard;
            if (!pageKey) {
                return;
            }
            const visible = pageKey === 'tools'
                ? pages.tools !== false
                : pages[pageKey] !== false;
            card.hidden = !visible;
            card.style.display = visible ? '' : 'none';
        });
    }

    async function applyLiveSettingsUpdate(settings) {
        applyNavigation(settings);

        if (getUserRole() === 'admin' || isAdminRoute(window.location.pathname)) {
            return;
        }

        await applyRouteGuard(settings, 'settings-update');
    }

    function listenForSettingsUpdates() {
        window.addEventListener('storage', (event) => {
            if (event.key !== 'okami-site-settings-updated') {
                return;
            }

            fetchSiteSettings(true).then((settings) => {
                const nextSignature = getSettingsSignature(settings);
                if (lastAppliedSettingsSignature === nextSignature) {
                    return;
                }
                lastAppliedSettingsSignature = nextSignature;
                applyLiveSettingsUpdate(settings);
            }).catch((error) => {
                console.warn('Site settings refresh failed:', error.message || error);
            });
        });
    }

    async function initSiteVisibility() {
        if (initialRouteApplied) {
            return;
        }

        hidePageUntilCheck();

        try {
            await refreshAdminSession();
            const settings = await fetchSiteSettings();

            if (settingsLoading) {
                await settingsPromise;
            }

            const allowed = await applyRouteGuard(settings, 'init');
            if (!allowed) {
                initialRouteApplied = true;
                return;
            }

            logVisibilityDebug(settings, 'init');
            lastAppliedSettingsSignature = getSettingsSignature(settings);
            applyNavigation(settings);
            listenForSettingsUpdates();
            initialRouteApplied = true;
        } catch (error) {
            console.warn('Site visibility init failed, showing page:', error.message || error);
            revealPage();
            initialRouteApplied = true;
        }
    }

    function refreshSiteVisibility() {
        settingsCache = null;
        settingsPromise = null;
        initialRouteApplied = false;
        redirectInFlight = false;
        return initSiteVisibility();
    }

    window.SiteVisibility = {
        DEFAULT_SITE_SETTINGS,
        fetchSiteSettings,
        applyNavigation,
        enforceCurrentPage,
        canAccessPage,
        canAccessUrl,
        enforceUrlAccess,
        refreshSiteVisibility,
        refreshAdminSession,
        isAdminUser,
        getUserRole,
        getPageKeyFromUrl,
        isAdminRoute,
        isSplashPage,
        isSettingsLoading,
        getLastSettingsSource,
        logVisibilityDebug,
        resolveRouteDecision
    };

    initSiteVisibility();
})();
