(function(global) {
    'use strict';

    const PUBLIC_PAGES = [
        {
            key: 'home',
            title: 'Home',
            filePaths: ['home.html'],
            publicPath: '/',
            analyticsPath: '/',
            canonicalPath: '/',
            trackAnalytics: true,
            isPublicLanding: true
        },
        {
            key: 'services',
            title: 'Services',
            filePaths: ['services.html'],
            publicPath: '/services',
            analyticsPath: '/services',
            canonicalPath: '/services',
            trackAnalytics: true
        },
        {
            key: 'support',
            title: 'Support',
            filePaths: ['support.html'],
            publicPath: '/support',
            analyticsPath: '/support',
            canonicalPath: '/support',
            trackAnalytics: true
        },
        {
            key: 'contact',
            title: 'Contact',
            filePaths: ['contact.html'],
            publicPath: '/contact',
            analyticsPath: '/contact',
            canonicalPath: '/contact',
            trackAnalytics: true
        },
        {
            key: 'tools',
            title: 'Tools',
            filePaths: ['tools/index.html'],
            publicPath: '/tools',
            analyticsPath: '/tools',
            canonicalPath: '/tools',
            trackAnalytics: true
        },
        {
            key: 'prints',
            title: '3D Prints',
            navLabel: '3D PRINTS',
            filePaths: ['3d-prints.html'],
            publicPath: '/3d-prints',
            analyticsPath: '/3d-prints',
            canonicalPath: '/3d-prints',
            trackAnalytics: true
        },
        {
            key: 'ledVideoWallCalculator',
            title: 'LED Video Wall Calculator',
            filePaths: ['tools/led-wall-visualizer.html'],
            publicPath: '/tools/led-video-wall-calculator',
            analyticsPath: '/tools/led-video-wall-calculator',
            canonicalPath: '/tools/led-video-wall-calculator',
            trackAnalytics: true,
            productId: 'okami-led-wall-calculator'
        },
        {
            key: 'okamiSignalLab',
            title: 'Okami Signal Lab',
            filePaths: ['tools/signal-lab.html'],
            publicPath: '/tools/signal-lab',
            analyticsPath: '/tools/signal-lab',
            canonicalPath: '/tools/signal-lab',
            trackAnalytics: true,
            productId: 'okami-signal-lab'
        }
    ];

    const EXTRA_PUBLIC_ROUTES = [];

    const DONATE_NAV_ITEM = {
        key: 'donate',
        title: 'Donate',
        navLabel: 'Donate',
        url: 'https://ko-fi.com/okamidesigns',
        external: true,
        inTopNav: true
    };

    const TOP_NAV_ITEM_KEYS = [
        'home',
        'services',
        'tools',
        'prints',
        'support',
        'contact',
        'donate'
    ];

    const ADMIN_NAV_ITEM_KEYS = [
        'home',
        'services',
        'tools',
        'prints',
        'support',
        'contact',
        'donate',
        'ledVideoWallCalculator',
        'okamiSignalLab'
    ];

    const LEGACY_HTML_REDIRECTS = {
        '/home.html': '/',
        '/services.html': '/services',
        '/support.html': '/support',
        '/contact.html': '/contact',
        '/tools.html': '/tools',
        '/tools/index.html': '/tools',
        '/tools/led-wall-visualizer.html': '/tools/led-video-wall-calculator',
        '/tools/signal-lab.html': '/tools/signal-lab',
        '/3d-prints.html': '/3d-prints'
    };

    const TOOL_PAGE_KEYS = ['ledVideoWallCalculator', 'okamiSignalLab'];

    const SPLASH_PAGE = {
        key: 'splash',
        title: 'Construction Splash',
        filePaths: ['index.html'],
        analyticsPath: '/',
        trackAnalytics: true,
        trackSeparately: true,
        constructionOnly: true
    };

    const EXEMPT_PATHS = new Set([
        'admin.html',
        'admin-analytics.html',
        '404.html',
        '50x.html'
    ]);

    function normalizeRequestPathname(pathname) {
        let normalized = (pathname || '/').split('?')[0].replace(/\\/g, '/').toLowerCase();
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized || '/';
    }

    function normalizeFilePath(pathname) {
        return resolveVisibilityPathValue(pathname);
    }

    function resolveVisibilityPathValue(requestPath) {
        const normalized = normalizeRequestPathname(requestPath);

        if (normalized === '/' || normalized === '/index.html') {
            return '';
        }

        for (const page of PUBLIC_PAGES) {
            if (page.publicPath && page.publicPath.toLowerCase() === normalized) {
                return page.filePaths[0];
            }
            for (const candidate of page.filePaths) {
                const candidatePath = `/${candidate}`.toLowerCase();
                if (candidatePath === normalized || candidate.toLowerCase() === normalized.replace(/^\//, '')) {
                    return candidate;
                }
            }
        }

        for (const route of EXTRA_PUBLIC_ROUTES) {
            if (route.publicPath.toLowerCase() === normalized) {
                return route.filePath;
            }
            if (`/${route.filePath}`.toLowerCase() === normalized) {
                return route.filePath;
            }
        }

        return normalized.replace(/^\//, '');
    }

    function getLegacyRedirect(pathname) {
        const normalized = normalizeRequestPathname(pathname);
        return LEGACY_HTML_REDIRECTS[normalized] || null;
    }

    function resolveFilePathFromRequest(pathname) {
        const normalized = normalizeRequestPathname(pathname);

        if (normalized === '/' || normalized === '/index.html' || normalized === '/home.html') {
            return null;
        }

        for (const page of PUBLIC_PAGES) {
            if (page.publicPath && page.publicPath.toLowerCase() === normalized) {
                return page.filePaths[0];
            }
        }

        for (const route of EXTRA_PUBLIC_ROUTES) {
            if (route.publicPath.toLowerCase() === normalized) {
                return route.filePath;
            }
        }

        const legacyPath = normalized.replace(/^\//, '');
        if (legacyPath.endsWith('.html') && !EXEMPT_PATHS.has(legacyPath)) {
            return legacyPath;
        }

        return null;
    }

    function isPublicCleanPath(pathname) {
        const normalized = normalizeRequestPathname(pathname);
        if (normalized === '/') {
            return true;
        }

        for (const page of PUBLIC_PAGES) {
            if (page.publicPath && page.publicPath.toLowerCase() === normalized) {
                return true;
            }
        }

        return EXTRA_PUBLIC_ROUTES.some((route) => route.publicPath.toLowerCase() === normalized);
    }

    function isManagedPublicRequest(pathname) {
        const normalized = normalizeRequestPathname(pathname);

        if (normalized === '/' || normalized === '/index.html') {
            return true;
        }

        if (getLegacyRedirect(normalized)) {
            return true;
        }

        if (isPublicCleanPath(normalized)) {
            return true;
        }

        const filePath = normalized.replace(/^\//, '');
        if (filePath.endsWith('.html') && !EXEMPT_PATHS.has(filePath)) {
            return true;
        }

        return false;
    }

    function getPublicPathForFilePath(filePath) {
        const normalized = (filePath || '').replace(/^\//, '').toLowerCase();
        if (!normalized || normalized === 'index.html') {
            return '/';
        }

        for (const page of PUBLIC_PAGES) {
            if (page.filePaths.some((candidate) => candidate.toLowerCase() === normalized)) {
                return page.publicPath || page.canonicalPath || page.analyticsPath;
            }
        }

        for (const route of EXTRA_PUBLIC_ROUTES) {
            if (route.filePath.toLowerCase() === normalized) {
                return route.publicPath;
            }
        }

        return `/${normalized}`;
    }

    function normalizeAnalyticsPath(pathname) {
        const filePath = resolveVisibilityPathValue(pathname);
        if (!filePath) {
            return '/';
        }
        if (filePath === 'index.html') {
            return SPLASH_PAGE.analyticsPath;
        }

        for (const page of PUBLIC_PAGES) {
            if (page.filePaths.some((candidate) => candidate.toLowerCase() === filePath.toLowerCase())) {
                return page.anonicalPath || page.publicPath || page.analyticsPath;
            }
        }

        for (const route of EXTRA_PUBLIC_ROUTES) {
            if (route.filePath.toLowerCase() === filePath.toLowerCase()) {
                return route.analyticsPath || route.publicPath;
            }
        }

        return getPublicPathForFilePath(filePath);
    }

    function resolvePage(pathname) {
        const filePath = resolveVisibilityPathValue(pathname);
        if (!filePath) {
            const home = PUBLIC_PAGES.find((page) => page.key === 'home');
            return { ...home, filePath: '' };
        }
        if (filePath === 'index.html') {
            return { ...SPLASH_PAGE, filePath: 'index.html' };
        }
        for (const page of PUBLIC_PAGES) {
            if (page.filePaths.some((candidate) => candidate.toLowerCase() === filePath.toLowerCase())) {
                return { ...page, filePath };
            }
        }
        if (SPLASH_PAGE.filePaths.some((candidate) => candidate.toLowerCase() === filePath.toLowerCase())) {
            return { ...SPLASH_PAGE, filePath };
        }
        return null;
    }

    function getPageKeyFromPathValue(pathValue) {
        const normalized = resolveVisibilityPathValue(pathValue.startsWith('/') ? pathValue : `/${pathValue}`);
        if (!normalized) {
            return null;
        }
        const page = resolvePage(`/${normalized}`);
        if (!page || page.key === 'splash') {
            return null;
        }
        return page.key;
    }

    function getPageLinkPaths(page) {
        const paths = new Set();

        if (page.publicPath) {
            paths.add(page.publicPath);
        }

        if (page.analyticsPath) {
            paths.add(page.analyticsPath);
        }

        (page.filePaths || []).forEach((filePath) => {
            paths.add(`/${filePath}`);
            paths.add(filePath);
        });

        if (page.publicPath === '/') {
            paths.add('/');
            paths.add('/home.html');
            paths.add('home.html');
        }

        return [...paths];
    }

    function getVisibilityPagePaths() {
        const map = {};
        PUBLIC_PAGES.forEach((page) => {
            map[page.key] = getPageLinkPaths(page);
        });
        return map;
    }

    function getDefaultPageOrder() {
        return PUBLIC_PAGES.map((page) => page.key);
    }

    function normalizePageOrder(rawOrder) {
        const defaults = getDefaultPageOrder();
        const order = Array.isArray(rawOrder)
            ? rawOrder.filter((key) => defaults.includes(key))
            : [];

        defaults.forEach((key) => {
            if (!order.includes(key)) {
                order.push(key);
            }
        });

        return order;
    }

    function getNavItemDefinition(key) {
        if (key === DONATE_NAV_ITEM.key) {
            return { ...DONATE_NAV_ITEM };
        }

        const page = PUBLIC_PAGES.find((entry) => entry.key === key);
        if (!page) {
            return null;
        }

        return {
            key: page.key,
            title: page.title,
            navLabel: page.navLabel || page.title.toUpperCase(),
            url: page.publicPath || '/',
            external: false,
            inTopNav: TOP_NAV_ITEM_KEYS.includes(page.key),
            isToolsDropdown: page.key === 'tools',
            isContactBtn: page.key === 'contact',
            isDonateBtn: false
        };
    }

    function getTopNavItemKeys() {
        return TOP_NAV_ITEM_KEYS.slice();
    }

    function getAdminNavItemKeys() {
        return ADMIN_NAV_ITEM_KEYS.slice();
    }

    function getAdminNavItems() {
        return ADMIN_NAV_ITEM_KEYS
            .map((key) => getNavItemDefinition(key))
            .filter(Boolean);
    }

    function formatNavItemPath(item) {
        if (!item) {
            return '/';
        }
        if (item.external) {
            return item.url;
        }
        return item.url || '/';
    }

    function getPublicServeRoutes() {
        const routes = PUBLIC_PAGES
            .filter((page) => page.publicPath && page.publicPath !== '/')
            .map((page) => ({
                publicPath: page.publicPath,
                filePath: page.filePaths[0]
            }));

        EXTRA_PUBLIC_ROUTES.forEach((route) => {
            routes.push({
                publicPath: route.publicPath,
                filePath: route.filePath
            });
        });

        return routes;
    }

    function getTrackablePages() {
        return [
            ...PUBLIC_PAGES.filter((page) => page.trackAnalytics),
            SPLASH_PAGE
        ];
    }

    function getToolPages() {
        return PUBLIC_PAGES.filter((page) => TOOL_PAGE_KEYS.includes(page.key));
    }

    function getToolsHubPage() {
        return PUBLIC_PAGES.find((page) => page.key === 'tools') || null;
    }

    function isExemptPath(pathname) {
        return EXEMPT_PATHS.has(resolveVisibilityPathValue(pathname));
    }

    function shouldTrackAnalytics(pathname) {
        if (isExemptPath(pathname)) {
            return false;
        }
        const page = resolvePage(pathname);
        return Boolean(page && page.trackAnalytics);
    }

    const api = {
        PUBLIC_PAGES,
        EXTRA_PUBLIC_ROUTES,
        LEGACY_HTML_REDIRECTS,
        SPLASH_PAGE,
        TOOL_PAGE_KEYS,
        EXEMPT_PATHS,
        normalizeFilePath,
        normalizeRequestPathname,
        normalizeAnalyticsPath,
        resolveVisibilityPathValue,
        getLegacyRedirect,
        resolveFilePathFromRequest,
        isPublicCleanPath,
        isManagedPublicRequest,
        getPublicPathForFilePath,
        DONATE_NAV_ITEM,
        TOP_NAV_ITEM_KEYS,
        ADMIN_NAV_ITEM_KEYS,
        getNavItemDefinition,
        getTopNavItemKeys,
        getAdminNavItemKeys,
        getAdminNavItems,
        formatNavItemPath,
        getPublicServeRoutes,
        resolvePage,
        getPageKeyFromPathValue,
        getPageLinkPaths,
        getVisibilityPagePaths,
        getDefaultPageOrder,
        normalizePageOrder,
        getTrackablePages,
        getToolPages,
        getToolsHubPage,
        isExemptPath,
        shouldTrackAnalytics
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.Registry = api;
    global.OkamiPageRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
