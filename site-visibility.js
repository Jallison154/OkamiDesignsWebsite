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
    let toolsDesktopTemplate = null;
    let toolsMobileTemplate = null;
    let navTemplatesCaptured = false;

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
        if (registryApi?.resolveVisibilityPathValue) {
            return registryApi.resolveVisibilityPathValue(pathname);
        }
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
        const pathValue = normalizePath(pathname);
        if (pathValue.startsWith('tools/')) {
            return true;
        }
        const normalized = normalizePathname(pathname);
        return normalized === '/tools' || normalized.startsWith('/tools/');
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

    function isPageVisible(settings, pageKey) {
        if (settingsApi?.isPageVisible) {
            return settingsApi.isPageVisible(settings, pageKey);
        }
        if (visibilityApi?.isPageVisible) {
            return visibilityApi.isPageVisible(settings, pageKey);
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

    function getSortedNavKeys(settings, keys) {
        if (settingsApi?.getNavKeysSorted) {
            return settingsApi.getNavKeysSorted(settings, keys);
        }
        return [...keys];
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

                    console.warn('Site settings API error:', response.status);
                    lastSettingsSource = 'server-error';
                    settingsCache = mergeSettings({});
                    return settingsCache;
                } catch (error) {
                    console.warn('Site settings API unavailable:', error.message || error);
                }

                if (window.location.protocol === 'file:') {
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

    function isLocalDevelopmentHost() {
        const host = (window.location.hostname || '').toLowerCase();
        return host === 'localhost'
            || host === '127.0.0.1'
            || host === '[::1]'
            || host.endsWith('.local');
    }

    function isRoutingDebugEnabled() {
        const params = new URLSearchParams(window.location.search);
        const flag = params.get('routingDebug');
        if (flag === '1' || flag === 'true') {
            return true;
        }
        if (flag === '0' || flag === 'false') {
            return false;
        }
        return isLocalDevelopmentHost();
    }

    function removeRoutingDebugBar() {
        document.getElementById('site-routing-debug')?.remove();
    }

    function logRouteDecision(details) {
        if (!isRoutingDebugEnabled()) {
            return;
        }

        console.info('[Okami Route Guard]', {
            path: window.location.pathname,
            ...details,
            timestamp: new Date().toISOString()
        });
    }

    function logVisibilityDebug(settings, context = 'init') {
        if (!isRoutingDebugEnabled()) {
            return;
        }

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

        const pages = settingsApi?.normalizePages
            ? settingsApi.normalizePages(raw?.pages, raw?.pageOrder)
            : { ...DEFAULT_SITE_SETTINGS.pages, ...(raw?.pages || {}) };

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

        if (settings.constructionMode) {
            if (isSplashPage(pathname)) {
                return { allowed: true, reason: null };
            }
            if (userRole === 'admin') {
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

        if (isToolsPath(pathname) && !isPageVisible(settings, 'tools')) {
            return { allowed: false, reason: 'hidden' };
        }

        const pageKey = getPageKeyFromPath(pathname);
        if (pageKey && !isPageVisible(settings, pageKey)) {
            return { allowed: false, reason: 'hidden' };
        }

        return { allowed: true, reason: null };
    }

    function detectRenderedPage() {
        if (document.querySelector('.under-construction') || /Coming Soon|Under Construction/i.test(document.title)) {
            return 'construction (index.html splash)';
        }
        if (document.querySelector('.hero-headline') || document.querySelector('.hero-title') || document.querySelector('.hero-section')) {
            return 'home.html';
        }
        return window.location.pathname || 'unknown';
    }

    function renderRoutingDebug(settings) {
        if (!isRoutingDebugEnabled()) {
            removeRoutingDebugBar();
            return;
        }

        const payload = {
            currentPath: window.location.pathname,
            constructionMode: Boolean(settings?.constructionMode),
            settingsSource: lastSettingsSource,
            renderedPage: detectRenderedPage()
        };

        console.info('[Okami Route Debug]', payload);

        let el = document.getElementById('site-routing-debug');
        if (!el) {
            el = document.createElement('div');
            el.id = 'site-routing-debug';
            el.setAttribute('aria-hidden', 'true');
            el.style.cssText = [
                'position:fixed',
                'bottom:0',
                'left:0',
                'right:0',
                'z-index:99999',
                'padding:6px 10px',
                'font:11px/1.4 monospace',
                'background:#111',
                'color:#0f0',
                'border-top:1px solid #333',
                'opacity:0.92',
                'pointer-events:none'
            ].join(';');
            document.body.appendChild(el);
        }

        el.textContent = [
            `path=${payload.currentPath}`,
            `constructionMode=${payload.constructionMode}`,
            `source=${payload.settingsSource}`,
            `rendered=${payload.renderedPage}`
        ].join(' | ');
    }

    /** Fallback when static index.html is served at / but constructionMode is off */
    function escapeConstructionPageWhenDisabled(settings) {
        if (settings?.constructionMode || !document.querySelector('.under-construction')) {
            return false;
        }

        const target = '/';
        logRouteDecision({
            constructionMode: false,
            routeDecision: 'redirect',
            reason: 'construction-html-with-mode-off',
            redirectTarget: target,
            currentPath: window.location.pathname
        });

        if (normalizeComparablePath(window.location.pathname) !== normalizeComparablePath(target)) {
            window.location.replace(target);
            return true;
        }

        return false;
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
        renderRoutingDebug(settings);
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

    function captureNavTemplates() {
        if (navTemplatesCaptured) {
            return;
        }

        const desktopTools = document.querySelector('nav.nav .nav-dropdown');
        const mobileTools = document.querySelector('nav.nav-mobile .nav-mobile-group');

        if (desktopTools) {
            toolsDesktopTemplate = desktopTools.cloneNode(true);
        }
        if (mobileTools) {
            toolsMobileTemplate = mobileTools.cloneNode(true);
        }

        navTemplatesCaptured = Boolean(toolsDesktopTemplate || toolsMobileTemplate);
    }

    function createTopNavLink(item, isMobile) {
        const link = document.createElement('a');
        link.href = item.url;
        link.dataset.navPageKey = item.key;
        link.textContent = item.navLabel;

        if (item.isContactBtn || item.key === 'contact') {
            link.className = 'nav-link contact-btn';
        } else if (item.isDonateBtn || item.key === 'donate') {
            link.className = 'nav-link nav-donate-link';
        } else {
            link.className = 'nav-link';
        }

        if (item.external) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }

        return link;
    }

    function buildToolsNavNode(settings, isMobile) {
        const template = isMobile ? toolsMobileTemplate : toolsDesktopTemplate;
        if (!template) {
            return null;
        }

        const anyToolVisible = TOOL_PAGE_KEYS.some((key) => isPageVisible(settings, key));
        if (!isPageVisible(settings, 'tools') || !anyToolVisible) {
            return null;
        }

        const node = template.cloneNode(true);
        const menu = node.querySelector(isMobile ? '.nav-mobile-submenu' : '.nav-dropdown-menu');
        if (!menu) {
            return node;
        }

        menu.querySelectorAll('[data-tools-hub]').forEach((link) => {
            if (!isPageVisible(settings, 'tools')) {
                link.remove();
            }
        });

        const sortedToolKeys = getSortedNavKeys(settings, TOOL_PAGE_KEYS);
        sortedToolKeys.forEach((key) => {
            const link = menu.querySelector(`[data-tool-key="${key}"]`);
            if (!link) {
                return;
            }
            if (!isPageVisible(settings, key)) {
                link.remove();
                return;
            }
            menu.appendChild(link);
        });

        return node;
    }

    function renderPublicNavigation(settings) {
        captureNavTemplates();

        const topNavKeys = registryApi?.getTopNavItemKeys?.() || [];
        const sortedKeys = getSortedNavKeys(settings, topNavKeys);

        document.querySelectorAll('nav.nav, nav.nav-mobile').forEach((navRoot) => {
            const isMobile = navRoot.classList.contains('nav-mobile');
            navRoot.innerHTML = '';

            sortedKeys.forEach((key) => {
                if (!isPageVisible(settings, key)) {
                    return;
                }

                if (key === 'tools') {
                    const toolsNode = buildToolsNavNode(settings, isMobile);
                    if (toolsNode) {
                        navRoot.appendChild(toolsNode);
                    }
                    return;
                }

                const item = registryApi?.getNavItemDefinition?.(key);
                if (!item) {
                    return;
                }

                navRoot.appendChild(createTopNavLink({
                    ...item,
                    isContactBtn: item.isContactBtn || key === 'contact',
                    isDonateBtn: key === 'donate'
                }, isMobile));
            });
        });

        document.querySelectorAll('[data-tools-card]').forEach((card) => {
            const pageKey = card.dataset.toolsCard;
            if (!pageKey) {
                return;
            }
            const visible = pageKey === 'tools'
                ? isPageVisible(settings, 'tools')
                : isPageVisible(settings, pageKey);
            card.hidden = !visible;
            card.style.display = visible ? '' : 'none';
        });

        document.querySelectorAll('.okami-site-footer').forEach((footer) => {
            footer.hidden = !isPageVisible(settings, 'donate');
            footer.style.display = isPageVisible(settings, 'donate') ? '' : 'none';
        });

        document.dispatchEvent(new CustomEvent('okami:nav-rendered'));
    }

    function applyNavigation(settings) {
        renderPublicNavigation(settings);
    }

    function getLoadedNavItems(settings) {
        const topNavKeys = registryApi?.getTopNavItemKeys?.() || [];
        return getSortedNavKeys(settings, topNavKeys)
            .filter((key) => isPageVisible(settings, key))
            .map((key, index) => {
                const item = registryApi?.getNavItemDefinition?.(key);
                return {
                    order: index + 1,
                    key,
                    label: item?.navLabel || item?.title || key,
                    url: item?.url || '/',
                    external: Boolean(item?.external)
                };
            });
    }

    async function applyLiveSettingsUpdate(settings) {
        applyNavigation(settings);

        if (isAdminRoute(window.location.pathname)) {
            return;
        }

        await applyRouteGuard(settings, 'settings-update');
    }

    function getNavigationPagePaths() {
        if (registryApi?.getVisibilityPagePaths) {
            return registryApi.getVisibilityPagePaths();
        }
        return PAGE_PATHS;
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

    async function refreshNavigationSettings(forceRefresh = false) {
        const settings = await fetchSiteSettings(forceRefresh);
        applyNavigation(settings);
        return settings;
    }

    async function initSiteVisibility() {
        if (initialRouteApplied) {
            return;
        }

        removeRoutingDebugBar();
        hidePageUntilCheck();

        try {
            await refreshAdminSession();
            const settings = await fetchSiteSettings(true);

            if (settingsLoading) {
                await settingsPromise;
            }

            if (escapeConstructionPageWhenDisabled(settings)) {
                initialRouteApplied = true;
                return;
            }

            const allowed = await applyRouteGuard(settings, 'init');
            if (!allowed) {
                initialRouteApplied = true;
                return;
            }

            logVisibilityDebug(settings, 'init');
            lastAppliedSettingsSignature = getSettingsSignature(settings);
            applyNavigation(settings);
            renderRoutingDebug(settings);
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
        refreshNavigationSettings,
        refreshAdminSession,
        isAdminUser,
        getUserRole,
        getPageKeyFromUrl,
        isAdminRoute,
        isSplashPage,
        isSettingsLoading,
        getLastSettingsSource,
        logVisibilityDebug,
        resolveRouteDecision,
        getLoadedNavItems,
        isRoutingDebugEnabled,
        removeRoutingDebugBar
    };

    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) {
            return;
        }

        refreshSiteVisibility();
    });

    window.addEventListener('focus', () => {
        refreshNavigationSettings(true).catch(() => {});
    });

    initSiteVisibility();
})();
