(function() {
    'use strict';

    /**
     * Central registry of public site pages.
     * Add new pages here to include them in visibility controls and analytics.
     */
    const PUBLIC_PAGES = [
        {
            key: 'home',
            title: 'Home',
            filePaths: ['home.html'],
            analyticsPath: '/home.html',
            trackAnalytics: true
        },
        {
            key: 'services',
            title: 'Services',
            filePaths: ['services.html'],
            analyticsPath: '/services.html',
            trackAnalytics: true
        },
        {
            key: 'support',
            title: 'Support',
            filePaths: ['support.html'],
            analyticsPath: '/support.html',
            trackAnalytics: true
        },
        {
            key: 'contact',
            title: 'Contact',
            filePaths: ['contact.html'],
            analyticsPath: '/contact.html',
            trackAnalytics: true
        },
        {
            key: 'tools',
            title: 'Tools',
            filePaths: ['tools/index.html'],
            analyticsPath: '/tools/index.html',
            trackAnalytics: true
        },
        {
            key: 'ledVideoWallCalculator',
            title: 'LED Video Wall Calculator',
            filePaths: ['tools/led-wall-visualizer.html'],
            analyticsPath: '/tools/led-wall-visualizer.html',
            trackAnalytics: true
        },
        {
            key: 'okamiSignalLab',
            title: 'Okami Signal Lab',
            filePaths: ['tools/signal-lab.html'],
            analyticsPath: '/tools/signal-lab.html',
            trackAnalytics: true
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
        const filePath = normalizeFilePath(pathname);
        return EXEMPT_PATHS.has(filePath);
    }

    function shouldTrackAnalytics(pathname) {
        if (isExemptPath(pathname)) {
            return false;
        }

        const page = resolvePage(pathname);
        return Boolean(page && page.trackAnalytics);
    }

    window.OkamiPageRegistry = {
        PUBLIC_PAGES,
        SPLASH_PAGE,
        TOOL_PAGE_KEYS,
        EXEMPT_PATHS,
        normalizeFilePath,
        normalizeAnalyticsPath,
        resolvePage,
        getVisibilityPagePaths,
        getTrackablePages,
        getToolPages,
        getToolsHubPage,
        isExemptPath,
        shouldTrackAnalytics
    };
})();
