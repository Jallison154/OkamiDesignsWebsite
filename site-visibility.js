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
            ledVideoWallCalculator: true
        }
    };

    const PAGE_PATHS = {
        home: ['home.html'],
        services: ['services.html'],
        support: ['support.html'],
        contact: ['contact.html'],
        ledVideoWallCalculator: ['tools/led-wall-visualizer.html']
    };

    const EXEMPT_PATHS = new Set([
        'admin.html',
        '404.html',
        '50x.html'
    ]);

    let settingsCache = null;
    let settingsPromise = null;

    function isAdminUser() {
        return sessionStorage.getItem('adminAuthenticated') === 'true';
    }

    function normalizePath(pathname) {
        const path = (pathname || '').replace(/^\//, '').toLowerCase();
        if (!path || path === 'index.html') {
            return '';
        }
        return path;
    }

    function isSplashPage(pathname) {
        const path = normalizePath(pathname);
        return path === '';
    }

    function isAdminPage(pathname) {
        const path = normalizePath(pathname);
        return path === 'admin.html';
    }

    function isExemptPage(pathname) {
        const path = normalizePath(pathname);
        return EXEMPT_PATHS.has(path);
    }

    function getPageKeyFromPath(pathname) {
        const path = normalizePath(pathname);

        if (path === 'home.html') {
            return 'home';
        }

        for (const [key, paths] of Object.entries(PAGE_PATHS)) {
            if (paths.includes(path)) {
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

    function getSplashUrl() {
        const path = window.location.pathname;
        if (path.includes('/tools/')) {
            return '../index.html';
        }
        return 'index.html';
    }

    function getNotFoundUrl() {
        const path = window.location.pathname;
        if (path.includes('/tools/')) {
            return '../404.html';
        }
        return '404.html';
    }

    async function fetchSiteSettings() {
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
                    const staticPrefix = window.location.pathname.includes('/tools/') ? '../files/site-settings.json' : 'files/site-settings.json';
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

    function getAccessBlockReason(settings, pathname) {
        if (isAdminUser() || isAdminPage(pathname) || isExemptPage(pathname)) {
            return null;
        }

        const splash = isSplashPage(pathname);

        if (settings.constructionMode) {
            return splash ? null : 'construction';
        }

        if (splash) {
            return 'home';
        }

        const path = normalizePath(pathname);
        if (path.startsWith('tools/') && settings.pages.tools === false) {
            return 'hidden';
        }

        const pageKey = getPageKeyFromPath(pathname);
        if (pageKey && settings.pages[pageKey] === false) {
            return 'hidden';
        }

        return null;
    }

    function redirectForReason(reason) {
        if (reason === 'construction') {
            window.location.replace(getSplashUrl());
            return;
        }

        if (reason === 'home') {
            const homeUrl = window.location.pathname.includes('/tools/') ? '../home.html' : 'home.html';
            window.location.replace(homeUrl);
            return;
        }

        if (reason === 'hidden') {
            window.location.replace(getNotFoundUrl());
        }
    }

    async function enforceCurrentPage() {
        const settings = await fetchSiteSettings();
        const reason = getAccessBlockReason(settings, window.location.pathname);
        if (reason) {
            redirectForReason(reason);
            return false;
        }
        return true;
    }

    async function canAccessUrl(url) {
        if (isAdminUser()) {
            return true;
        }

        const settings = await fetchSiteSettings();

        try {
            const parsed = new URL(url, window.location.origin);
            if (parsed.origin !== window.location.origin) {
                return true;
            }
            return getAccessBlockReason(settings, parsed.pathname) === null;
        } catch {
            return true;
        }
    }

    async function enforceUrlAccess(url) {
        if (isAdminUser()) {
            return true;
        }

        const settings = await fetchSiteSettings();

        try {
            const parsed = new URL(url, window.location.origin);
            const reason = getAccessBlockReason(settings, parsed.pathname);
            if (!reason) {
                return true;
            }

            if (reason === 'construction') {
                window.location.href = parsed.pathname.includes('/tools/') ? '../index.html' : 'index.html';
            } else if (reason === 'home') {
                window.location.href = parsed.pathname.includes('/tools/') ? '../home.html' : 'home.html';
            } else {
                window.location.href = parsed.pathname.includes('/tools/') ? '../404.html' : '404.html';
            }

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

        Object.entries(PAGE_PATHS).forEach(([pageKey, paths]) => {
            if (pageKey === 'ledVideoWallCalculator') {
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

        document.querySelectorAll('a[href*="led-wall-visualizer"]').forEach((link) => {
            setNavItemVisible(link, pages.ledVideoWallCalculator !== false);
        });

        const showToolsMenu = pages.tools !== false && pages.ledVideoWallCalculator !== false;
        // Tools menu requires both the Tools section and at least one visible tool page.
        document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
            setNavItemVisible(dropdown, showToolsMenu);
        });
        document.querySelectorAll('.nav-mobile-group').forEach((group) => {
            setNavItemVisible(group, showToolsMenu);
        });
    }

    async function initSiteVisibility() {
        const allowed = await enforceCurrentPage();
        if (!allowed) {
            return;
        }

        const settings = await fetchSiteSettings();
        applyNavigation(settings);
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
        canAccessUrl,
        enforceUrlAccess,
        refreshSiteVisibility,
        isAdminUser,
        getPageKeyFromUrl
    };

    initSiteVisibility();
})();
