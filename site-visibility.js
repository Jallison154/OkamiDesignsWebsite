(function() {
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

    const PAGE_PATHS = window.OkamiPageRegistry?.getVisibilityPagePaths?.() || {
        home: ['home.html'],
        services: ['services.html'],
        support: ['support.html'],
        contact: ['contact.html'],
        tools: ['tools/index.html'],
        ledVideoWallCalculator: ['tools/led-wall-visualizer.html'],
        okamiSignalLab: ['tools/signal-lab.html']
    };

    const TOOL_PAGE_KEYS = window.OkamiPageRegistry?.TOOL_PAGE_KEYS || [
        'ledVideoWallCalculator',
        'okamiSignalLab'
    ];

    const SYSTEM_PAGES = new Set(['404.html', '50x.html']);
    const ADMIN_LOGIN_PAGE = 'admin.html';
    const ADMIN_ANALYTICS_PAGE = 'admin-analytics.html';
    const SETTINGS_POLL_INTERVAL_MS = 15000;

    let settingsCache = null;
    let settingsPromise = null;
    let settingsPollTimer = null;
    let lastAppliedSettingsSignature = null;

    function isAdminUser() {
        return sessionStorage.getItem('adminAuthenticated') === 'true';
    }

    function getUserRole() {
        return isAdminUser() ? 'admin' : 'public';
    }

    function normalizePath(pathname) {
        const path = (pathname || '').replace(/^\//, '').toLowerCase();
        if (!path || path === 'index.html') {
            return '';
        }
        return path;
    }

    function isSplashPage(pathname) {
        return normalizePath(pathname) === '';
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
        const path = normalizePath(pathname);
        return path === ADMIN_LOGIN_PAGE || path === ADMIN_ANALYTICS_PAGE;
    }

    function getPageKeyFromPath(pathname) {
        const path = normalizePath(pathname);

        if (path === 'home.html') {
            return 'home';
        }

        if (path === 'tools/index.html') {
            return 'tools';
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

    function getSplashUrl() {
        return window.location.pathname.includes('/tools/') ? '../index.html' : 'index.html';
    }

    function getNotFoundUrl() {
        return window.location.pathname.includes('/tools/') ? '../404.html' : '404.html';
    }

    function getHomeUrl() {
        return window.location.pathname.includes('/tools/') ? '../home.html' : 'home.html';
    }

    function getAdminLoginUrl() {
        return window.location.pathname.includes('/tools/') ? '../admin.html' : 'admin.html';
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
            settingsPromise = (async () => {
                try {
                    const response = await fetch('/api/site-settings', { cache: 'no-store' });
                    if (response.ok) {
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
                        settingsCache = mergeSettings(await response.json());
                        return settingsCache;
                    }
                } catch (error) {
                    console.warn('Static site settings unavailable:', error.message || error);
                }

                settingsCache = mergeSettings(DEFAULT_SITE_SETTINGS);
                return settingsCache;
            })();
        }

        return settingsPromise;
    }

    function mergeSettings(raw) {
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

    /**
     * Central route visibility check.
     * @param {string} pathname
     * @param {'admin'|'public'} userRole
     * @param {object} settings
     * @returns {{ allowed: boolean, reason: string|null }}
     */
    function canAccessPage(pathname, userRole, settings) {
        if (isSystemPage(pathname)) {
            return { allowed: true, reason: null };
        }

        if (isAdminLoginPage(pathname)) {
            return { allowed: true, reason: null };
        }

        if (isAdminAnalyticsPage(pathname)) {
            if (userRole === 'admin') {
                return { allowed: true, reason: null };
            }
            return { allowed: false, reason: 'admin-auth' };
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

        if (isSplashPage(pathname)) {
            return { allowed: true, reason: null };
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

    function getAccessBlockReason(settings, pathname) {
        const access = canAccessPage(pathname, getUserRole(), settings);
        return access.allowed ? null : access.reason;
    }

    function redirectForReason(reason, settings) {
        if (reason === 'construction') {
            window.location.replace(getSplashUrl());
            return;
        }

        if (reason === 'hidden') {
            if (settings?.constructionMode) {
                window.location.replace(getSplashUrl());
            } else {
                window.location.replace(getNotFoundUrl());
            }
            return;
        }

        if (reason === 'admin-auth') {
            window.location.replace(getAdminLoginUrl());
        }
    }

    function revealPage() {
        document.documentElement.classList.remove('site-visibility-pending');
    }

    function hidePageUntilCheck() {
        if (getUserRole() !== 'admin') {
            document.documentElement.classList.add('site-visibility-pending');
        }
    }

    async function enforceCurrentPage() {
        const settings = await fetchSiteSettings();
        const reason = getAccessBlockReason(settings, window.location.pathname);
        if (reason) {
            redirectForReason(reason, settings);
            return false;
        }

        revealPage();
        return true;
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
        const settings = await fetchSiteSettings();

        try {
            const parsed = new URL(url, window.location.origin);
            const access = canAccessPage(parsed.pathname, getUserRole(), settings);
            if (access.allowed) {
                return true;
            }

            redirectForReason(access.reason, settings);
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

        if (getUserRole() === 'admin') {
            return;
        }

        const reason = getAccessBlockReason(settings, window.location.pathname);
        if (reason) {
            redirectForReason(reason, settings);
        }
    }

    function startSettingsPolling() {
        if (settingsPollTimer) {
            return;
        }

        settingsPollTimer = window.setInterval(async () => {
            await pollSettingsUpdate();
        }, SETTINGS_POLL_INTERVAL_MS);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                pollSettingsUpdate();
            }
        });

        window.addEventListener('storage', (event) => {
            if (event.key === 'okami-site-settings-updated') {
                pollSettingsUpdate();
            }
        });
    }

    async function pollSettingsUpdate() {
        const previousSignature = lastAppliedSettingsSignature;
        const settings = await fetchSiteSettings(true);
        const nextSignature = getSettingsSignature(settings);

        if (previousSignature === nextSignature) {
            return;
        }

        lastAppliedSettingsSignature = nextSignature;
        await applyLiveSettingsUpdate(settings);
    }

    async function initSiteVisibility() {
        hidePageUntilCheck();

        const allowed = await enforceCurrentPage();
        if (!allowed) {
            return;
        }

        const settings = await fetchSiteSettings();
        lastAppliedSettingsSignature = getSettingsSignature(settings);
        applyNavigation(settings);
        startSettingsPolling();
    }

    function refreshSiteVisibility() {
        settingsCache = null;
        settingsPromise = null;
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
        isAdminUser,
        getUserRole,
        getPageKeyFromUrl,
        isAdminRoute,
        isSplashPage
    };

    initSiteVisibility();
})();
