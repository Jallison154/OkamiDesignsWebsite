(function(global) {
    'use strict';

    const PUBLIC_PAGES = [
        { key: 'home', title: 'Home', filePaths: ['home.html'], analyticsPath: '/home.html', trackAnalytics: true },
        { key: 'services', title: 'Services', filePaths: ['services.html'], analyticsPath: '/services.html', trackAnalytics: true },
        { key: 'support', title: 'Support', filePaths: ['support.html'], analyticsPath: '/support.html', trackAnalytics: true },
        { key: 'contact', title: 'Contact', filePaths: ['contact.html'], analyticsPath: '/contact.html', trackAnalytics: true },
        { key: 'tools', title: 'Tools', filePaths: ['tools/index.html'], analyticsPath: '/tools/index.html', trackAnalytics: true },
        {
            key: 'ledVideoWallCalculator',
            title: 'LED Video Wall Calculator',
            filePaths: ['tools/led-wall-visualizer.html', 'tools/led-video-wall-calculator'],
            analyticsPath: '/tools/led-wall-visualizer.html',
            canonicalPath: '/tools/led-video-wall-calculator',
            trackAnalytics: true,
            productId: 'okami-led-wall-calculator'
        },
        {
            key: 'okamiSignalLab',
            title: 'Okami Signal Lab',
            filePaths: ['tools/signal-lab.html'],
            analyticsPath: '/tools/signal-lab.html',
            trackAnalytics: true,
            productId: 'okami-signal-lab'
        }
    ];

    const TOOL_PAGE_KEYS = ['ledVideoWallCalculator', 'okamiSignalLab'];

    const SPLASH_PAGE = {
        key: 'splash',
        title: 'Construction Splash',
        filePaths: ['index.html'],
        analyticsPath: '/',
        trackAnalytics: true,
        trackSeparately: true
    };

    const EXEMPT_PATHS = new Set([
        'admin.html',
        'admin-analytics.html',
        '404.html',
        '50x.html'
    ]);

    function normalizeFilePath(pathname) {
        let path = (pathname || '').replace(/^\//, '').toLowerCase();
        if (!path || path === 'index.html') {
            return '';
        }
        return path;
    }

    function normalizeAnalyticsPath(pathname) {
        const filePath = normalizeFilePath(pathname);
        if (!filePath) {
            return SPLASH_PAGE.analyticsPath;
        }
        for (const page of PUBLIC_PAGES) {
            if (page.filePaths.some((candidate) => candidate.toLowerCase() === filePath)) {
                return page.analyticsPath;
            }
        }
        if (SPLASH_PAGE.filePaths.some((candidate) => candidate.toLowerCase() === filePath)) {
            return SPLASH_PAGE.analyticsPath;
        }
        return `/${filePath}`;
    }

    function resolvePage(pathname) {
        const filePath = normalizeFilePath(pathname);
        if (!filePath) {
            return { ...SPLASH_PAGE, filePath: '' };
        }
        for (const page of PUBLIC_PAGES) {
            if (page.filePaths.some((candidate) => candidate.toLowerCase() === filePath)) {
                return { ...page, filePath };
            }
        }
        if (SPLASH_PAGE.filePaths.some((candidate) => candidate.toLowerCase() === filePath)) {
            return { ...SPLASH_PAGE, filePath };
        }
        return null;
    }

    function getPageKeyFromPathValue(pathValue) {
        const normalized = (pathValue || '').replace(/^\//, '').toLowerCase();
        if (!normalized) {
            return null;
        }
        const page = resolvePage(`/${normalized}`);
        if (!page || page.key === 'splash') {
            return null;
        }
        return page.key;
    }

    function getVisibilityPagePaths() {
        const map = {};
        PUBLIC_PAGES.forEach((page) => {
            map[page.key] = page.filePaths.slice();
        });
        return map;
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
        return EXEMPT_PATHS.has(normalizeFilePath(pathname));
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
        SPLASH_PAGE,
        TOOL_PAGE_KEYS,
        EXEMPT_PATHS,
        normalizeFilePath,
        normalizeAnalyticsPath,
        resolvePage,
        getPageKeyFromPathValue,
        getVisibilityPagePaths,
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
