(function(global) {
    'use strict';

    /**
     * Module registry — future Signal Lab features register here.
     * Categories: video, motion, audio, sync, branding, export, led
     */
    const MODULE_CATALOG = [
        {
            id: 'video-patterns',
            label: 'Video Patterns',
            category: 'video',
            status: 'active',
            description: 'Solid colors, SMPTE bars, grids, safe areas, and calibration patterns.'
        },
        {
            id: 'motion-patterns',
            label: 'Motion Engine',
            category: 'motion',
            status: 'active',
            description: 'Animated motion patterns for refresh rate, latency, and movement calibration.'
        },
        {
            id: 'audio-tools',
            label: 'Audio Generator',
            category: 'audio',
            status: 'active',
            description: 'Test tones, pink/white noise, channel routing, and peak level metering.'
        },
        {
            id: 'sync-tools',
            label: 'AV Sync Tools',
            category: 'sync',
            status: 'active',
            description: 'Flash, click, and timing patterns for measuring display latency and A/V sync.'
        },
        {
            id: 'display-info',
            label: 'Display Information',
            category: 'foundation',
            status: 'active',
            description: 'Live screen, viewport, pixel ratio, fullscreen status, and estimated refresh rate.'
        },
        {
            id: 'branding',
            label: 'Branding Overlay',
            category: 'branding',
            status: 'active',
            description: 'Upload logos and custom text overlays with size, opacity, and position controls.'
        },
        {
            id: 'export',
            label: 'Pattern Export',
            category: 'export',
            status: 'active',
            description: 'Render and download high-resolution PNG or JPG pattern files with optional watermarks.'
        },
        {
            id: 'led-utilities',
            label: 'LED Wall Utilities',
            category: 'led',
            status: 'active',
            description: 'Calculate wall resolution, aspect ratio, scaling warnings, and generate cabinet test patterns.'
        }
    ];

    /** Public UI ids → internal renderer ids (stable registry for sidebar + state). */
    const SIDEBAR_MODULES = [
        { id: 'videoPatterns', rendererId: 'video-patterns', label: 'Video Patterns' },
        { id: 'motionEngine', rendererId: 'motion-patterns', label: 'Motion Engine' },
        { id: 'audioGenerator', rendererId: 'audio-tools', label: 'Audio Generator' },
        { id: 'avSync', rendererId: 'sync-tools', label: 'AV Sync' },
        { id: 'branding', rendererId: 'branding', label: 'Branding' },
        { id: 'export', rendererId: 'export', label: 'Export' },
        { id: 'ledWallTools', rendererId: 'led-utilities', label: 'LED Wall Tools' }
    ];

    const DEFAULT_RENDERER_ID = 'video-patterns';
    const DEFAULT_PUBLIC_ID = 'videoPatterns';

    const renderers = new Map();

    function resolveRendererId(moduleId) {
        if (!moduleId) {
            return DEFAULT_RENDERER_ID;
        }
        const sidebar = SIDEBAR_MODULES.find(
            (entry) => entry.id === moduleId || entry.rendererId === moduleId
        );
        if (sidebar) {
            return sidebar.rendererId;
        }
        if (getModuleById(moduleId)) {
            return moduleId;
        }
        return DEFAULT_RENDERER_ID;
    }

    function getPublicModuleId(rendererId) {
        const sidebar = SIDEBAR_MODULES.find((entry) => entry.rendererId === rendererId);
        return sidebar?.id || DEFAULT_PUBLIC_ID;
    }

    function getSidebarModules() {
        return SIDEBAR_MODULES.map((entry) => ({ ...entry }));
    }

    function registerRenderer(moduleId, renderer) {
        renderers.set(moduleId, renderer);
    }

    function getRenderer(moduleId) {
        const resolved = resolveRendererId(moduleId);
        const renderer = renderers.get(resolved) || null;
        if (!renderer) {
            return null;
        }
        const guard = global.OkamiSignalLab?.ModuleErrorBoundary?.guardRenderer;
        return guard ? guard(renderer, resolved) : renderer;
    }

    function getCatalog() {
        return MODULE_CATALOG.slice();
    }

    function getActiveModules() {
        return MODULE_CATALOG.filter((entry) => entry.status === 'active');
    }

    function getModuleById(moduleId) {
        return MODULE_CATALOG.find((entry) => entry.id === moduleId) || null;
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.ModuleRegistry = {
        MODULE_CATALOG,
        SIDEBAR_MODULES,
        DEFAULT_RENDERER_ID,
        DEFAULT_PUBLIC_ID,
        resolveRendererId,
        getPublicModuleId,
        getSidebarModules,
        registerRenderer,
        getRenderer,
        getCatalog,
        getActiveModules,
        getModuleById
    };
})(typeof window !== 'undefined' ? window : globalThis);
