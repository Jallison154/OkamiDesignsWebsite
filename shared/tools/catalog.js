(function(global) {
    'use strict';

    const CATALOG_VERSION = 1;
    const WEBSITE_LOGO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

    const DEFAULT_SEED_TOOLS = [
        {
            id: 'led-video-wall-calculator',
            title: 'LED Video Wall Calculator',
            category: 'Calculator',
            shortDescription: 'Visual calculator for LED wall layouts, resolution, aspect ratios, and processor requirements.',
            longDescription: '',
            imageSource: 'placeholder',
            iconUrl: '',
            websiteLogoUrl: '',
            websiteLogoRemoteUrl: '',
            websiteLogoKind: '',
            websiteLogoFetchedAt: '',
            websiteLogoError: '',
            contentType: 'calculator',
            buttonLabel: 'Open tool →',
            url: '/tools/led-video-wall-calculator',
            linkType: 'internal',
            openInNewTab: false,
            enabled: true,
            featured: true,
            listOnToolsPage: true,
            displayOrder: 1,
            homepageOrder: 1,
            slug: 'led-video-wall-calculator',
            detailPageEnabled: false,
            pageKey: 'ledVideoWallCalculator',
            accent: 'default',
            features: [],
            screenshots: [],
            supportUrl: '',
            heroImageUrl: ''
        },
        {
            id: 'okami-signal-lab',
            title: 'Okami Signal Lab',
            category: 'Signal Lab',
            shortDescription: 'AV testing and calibration for LED walls, projectors, broadcast systems, and media servers.',
            longDescription: '',
            imageSource: 'placeholder',
            iconUrl: '',
            websiteLogoUrl: '',
            websiteLogoRemoteUrl: '',
            websiteLogoKind: '',
            websiteLogoFetchedAt: '',
            websiteLogoError: '',
            contentType: 'tool',
            buttonLabel: 'Open tool →',
            url: '/tools/signal-lab',
            linkType: 'internal',
            openInNewTab: false,
            enabled: true,
            featured: true,
            listOnToolsPage: true,
            displayOrder: 2,
            homepageOrder: 2,
            slug: 'signal-lab',
            detailPageEnabled: false,
            pageKey: 'okamiSignalLab',
            accent: 'default',
            features: [],
            screenshots: [],
            supportUrl: '',
            heroImageUrl: ''
        },
        {
            id: 'pack',
            title: 'PACK',
            category: 'Personal Connections',
            shortDescription: 'Remember the people, places, and moments that matter. PACK keeps your connections organized in one private, easy-to-use space.',
            longDescription: '',
            imageSource: 'website',
            iconUrl: '/images/pack-icon.svg',
            websiteLogoUrl: '',
            websiteLogoRemoteUrl: '',
            websiteLogoKind: '',
            websiteLogoFetchedAt: '',
            websiteLogoError: '',
            contentType: 'app',
            buttonLabel: 'Open PACK',
            url: 'https://pack.okamidesigns.com',
            linkType: 'external',
            openInNewTab: false,
            enabled: true,
            featured: true,
            listOnToolsPage: true,
            displayOrder: 3,
            homepageOrder: 3,
            slug: 'pack',
            detailPageEnabled: false,
            pageKey: null,
            accent: 'default',
            features: [],
            screenshots: [],
            supportUrl: '',
            heroImageUrl: ''
        },
        {
            id: '3d-prints',
            title: '3D Prints',
            category: 'Fabrication',
            shortDescription: 'Browse printable adapters, production utilities, and custom design files from Okami Designs.',
            longDescription: '',
            imageSource: 'placeholder',
            iconUrl: '',
            websiteLogoUrl: '',
            websiteLogoRemoteUrl: '',
            websiteLogoKind: '',
            websiteLogoFetchedAt: '',
            websiteLogoError: '',
            contentType: 'prints',
            buttonLabel: 'View Prints',
            url: '/3d-prints',
            linkType: 'internal',
            openInNewTab: false,
            enabled: true,
            featured: true,
            listOnToolsPage: false,
            displayOrder: 4,
            homepageOrder: 4,
            slug: '3d-prints',
            detailPageEnabled: false,
            pageKey: 'prints',
            accent: 'default',
            features: [],
            screenshots: [],
            supportUrl: '',
            heroImageUrl: ''
        }
    ];

    const RESERVED_APP_SLUGS = new Set([
        'led-video-wall-calculator',
        'signal-lab',
        'signal-lab-output'
    ]);

    function slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 120);
    }

    function createId(prefix) {
        const base = slugify(prefix) || 'tool';
        const suffix = Math.random().toString(36).slice(2, 8);
        return `${base}-${suffix}`;
    }

    function asString(value, fallback = '') {
        if (value == null) {
            return fallback;
        }
        return String(value);
    }

    function asBoolean(value, fallback = false) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (value == null) {
            return fallback;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
                return true;
            }
            if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off' || normalized === '') {
                return false;
            }
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        return Boolean(value);
    }

    function asStringArray(value) {
        if (Array.isArray(value)) {
            return value.map((item) => asString(item).trim()).filter(Boolean);
        }
        if (typeof value === 'string') {
            return value
                .split(/\r?\n|,/)
                .map((item) => item.trim())
                .filter(Boolean);
        }
        return [];
    }

    function normalizeLinkType(value, url) {
        const raw = asString(value).toLowerCase();
        if (raw === 'external' || raw === 'internal') {
            return raw;
        }
        if (/^https?:\/\//i.test(asString(url))) {
            return 'external';
        }
        return 'internal';
    }

    function normalizeAccent(value) {
        const raw = asString(value, 'default').toLowerCase();
        if (raw === 'accent' || raw === 'muted') {
            return raw;
        }
        return 'default';
    }

    function normalizeImageSource(raw, linkType, url) {
        const value = asString(raw?.imageSource).toLowerCase();
        if (value === 'upload' || value === 'website' || value === 'placeholder') {
            return value;
        }
        // Legacy / migration defaults
        if (asBoolean(raw?.useWebsiteLogo, false)) {
            return 'website';
        }
        if (asString(raw?.id) === 'pack' || /pack\.okamidesigns\.com/i.test(asString(url))) {
            return 'website';
        }
        if (asString(raw?.iconUrl).trim()) {
            return 'upload';
        }
        return 'placeholder';
    }

    function normalizeContentType(raw, id) {
        const value = asString(raw?.contentType).toLowerCase();
        const allowed = new Set(['tool', 'app', 'calculator', 'prints', 'download', 'page', 'project']);
        if (allowed.has(value)) {
            return value;
        }
        if (id === 'pack') return 'app';
        if (id === 'led-video-wall-calculator') return 'calculator';
        if (id === '3d-prints' || id === 'prints') return 'prints';
        return 'tool';
    }

    function normalizeTool(raw, index = 0, nowIso = new Date().toISOString()) {
        const title = asString(raw?.title).trim() || `Tool ${index + 1}`;
        const id = asString(raw?.id).trim() || createId(title);
        const slug = slugify(raw?.slug || title) || slugify(id) || `tool-${index + 1}`;
        const url = asString(raw?.url).trim() || '#';
        const linkType = normalizeLinkType(raw?.linkType, url);
        const createdAt = asString(raw?.createdAt).trim() || nowIso;
        const updatedAt = asString(raw?.updatedAt).trim() || createdAt;
        const imageSource = normalizeImageSource(raw, linkType, url);
        const contentType = normalizeContentType(raw, id);
        const displayOrder = Number.isFinite(Number(raw?.displayOrder))
            ? Number(raw.displayOrder)
            : index + 1;
        const featured = asBoolean(raw?.featured ?? raw?.showOnHomepage, false);
        const rawHomepageOrder = raw?.homepageOrder;
        const homepageOrder = (rawHomepageOrder === null || rawHomepageOrder === undefined || rawHomepageOrder === '')
            ? (featured ? displayOrder : 999)
            : (Number.isFinite(Number(rawHomepageOrder)) ? Number(rawHomepageOrder) : (featured ? displayOrder : 999));
        const listOnToolsPage = raw?.listOnToolsPage == null
            ? contentType !== 'prints' && contentType !== 'page'
            : asBoolean(raw.listOnToolsPage, true);

        return {
            id,
            title,
            category: asString(raw?.category).trim() || 'Tool',
            shortDescription: asString(raw?.shortDescription ?? raw?.description).trim(),
            longDescription: asString(raw?.longDescription).trim(),
            imageSource,
            iconUrl: asString(raw?.iconUrl).trim(),
            websiteLogoUrl: asString(raw?.websiteLogoUrl).trim(),
            websiteLogoRemoteUrl: asString(raw?.websiteLogoRemoteUrl).trim(),
            websiteLogoKind: asString(raw?.websiteLogoKind).trim(),
            websiteLogoFetchedAt: asString(raw?.websiteLogoFetchedAt).trim(),
            websiteLogoError: asString(raw?.websiteLogoError).trim(),
            contentType,
            buttonLabel: asString(raw?.buttonLabel).trim() || 'Open tool →',
            url,
            linkType,
            openInNewTab: asBoolean(raw?.openInNewTab, false),
            enabled: asBoolean(raw?.enabled, true),
            // UI label: "Show on Homepage" — stored as featured (no schema rename)
            featured,
            listOnToolsPage,
            displayOrder,
            homepageOrder,
            slug,
            detailPageEnabled: asBoolean(raw?.detailPageEnabled, false),
            pageKey: asString(raw?.pageKey).trim() || null,
            accent: normalizeAccent(raw?.accent),
            features: asStringArray(raw?.features),
            screenshots: asStringArray(raw?.screenshots),
            supportUrl: asString(raw?.supportUrl).trim(),
            heroImageUrl: asString(raw?.heroImageUrl).trim(),
            createdAt,
            updatedAt
        };
    }

    function isWebsiteLogoStale(tool, nowMs = Date.now()) {
        if (!tool || tool.imageSource !== 'website') {
            return false;
        }
        if (!tool.websiteLogoUrl) {
            return true;
        }
        const fetchedAt = Date.parse(tool.websiteLogoFetchedAt || '');
        if (!Number.isFinite(fetchedAt)) {
            return true;
        }
        return (nowMs - fetchedAt) >= WEBSITE_LOGO_TTL_MS;
    }

    /**
     * Resolve the image URL shown on Tool cards.
     * Preference modes: upload | website | placeholder
     * Fallbacks: uploaded image → cached website logo → empty (caller shows placeholder).
     */
    function resolveToolImageUrl(tool) {
        if (!tool) {
            return '';
        }
        const source = tool.imageSource || 'upload';
        if (source === 'placeholder') {
            return '';
        }
        if (source === 'upload') {
            return tool.iconUrl || tool.websiteLogoUrl || '';
        }
        // website
        return tool.websiteLogoUrl || tool.iconUrl || '';
    }

    function sortTools(tools) {
        return [...tools].sort((left, right) => {
            const orderDiff = (left.displayOrder || 0) - (right.displayOrder || 0);
            if (orderDiff !== 0) {
                return orderDiff;
            }
            return left.title.localeCompare(right.title);
        });
    }

    function reindexDisplayOrder(tools) {
        return sortTools(tools).map((tool, index) => ({
            ...tool,
            displayOrder: index + 1
        }));
    }

    function createDefaultCatalog(options = {}) {
        const nowIso = options.nowIso || new Date().toISOString();
        const visibilityPages = options.visibilityPages || null;
        const tools = DEFAULT_SEED_TOOLS.map((seed, index) => {
            const tool = normalizeTool(seed, index, nowIso);
            if (visibilityPages && tool.pageKey && visibilityPages[tool.pageKey]) {
                const entry = visibilityPages[tool.pageKey];
                if (typeof entry === 'boolean') {
                    tool.enabled = entry !== false;
                } else if (entry && typeof entry === 'object') {
                    tool.enabled = entry.visible !== false;
                }
            }
            tool.createdAt = nowIso;
            tool.updatedAt = nowIso;
            return tool;
        });

        return {
            version: CATALOG_VERSION,
            updatedAt: nowIso,
            tools: reindexDisplayOrder(tools)
        };
    }

    function ensureKnownProjects(tools, nowIso, options = {}) {
        const byId = new Map(tools.map((tool) => [tool.id, tool]));
        const next = [...tools];

        // Soft migration helpers for PACK only — never resurrect deleted entries.
        if (byId.has('pack')) {
            const pack = byId.get('pack');
            pack.imageSource = pack.imageSource || 'website';
            pack.category = pack.category || 'Personal Connections';
            pack.url = pack.url || 'https://pack.okamidesigns.com';
            pack.buttonLabel = pack.buttonLabel || 'Open PACK';
            pack.contentType = pack.contentType || 'app';
            if (pack.listOnToolsPage == null) {
                pack.listOnToolsPage = true;
            }
        }

        // One-time companion seed only when explicitly requested (empty catalog recovery).
        if (options.seedMissingPrints && !byId.has('3d-prints')) {
            const seed = DEFAULT_SEED_TOOLS.find((item) => item.id === '3d-prints');
            if (seed) {
                next.push(normalizeTool(seed, next.length, nowIso));
            }
        }

        return next;
    }

    function normalizeCatalog(raw, options = {}) {
        const nowIso = options.nowIso || new Date().toISOString();
        const allowEmpty = options.allowEmpty === true || raw?.allowEmpty === true;

        if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tools)) {
            return createDefaultCatalog({ nowIso, visibilityPages: options.visibilityPages });
        }

        // Missing/corrupt file recovery: empty tools without an explicit save → seed defaults.
        if (raw.tools.length === 0 && !allowEmpty && raw.version == null) {
            return createDefaultCatalog({ nowIso, visibilityPages: options.visibilityPages });
        }

        const seenIds = new Set();
        let tools = raw.tools.map((item, index) => {
            const tool = normalizeTool(item, index, nowIso);
            let uniqueId = tool.id;
            while (seenIds.has(uniqueId)) {
                uniqueId = createId(tool.id);
            }
            seenIds.add(uniqueId);
            tool.id = uniqueId;
            return tool;
        });

        tools = ensureKnownProjects(tools, nowIso, { seedMissingPrints: false });
        tools = reindexDisplayOrder(tools);
        tools = reindexHomepageOrder(tools);

        return {
            version: CATALOG_VERSION,
            updatedAt: asString(raw.updatedAt).trim() || nowIso,
            tools
        };
    }

    function getPublicTools(catalog) {
        return sortTools((catalog?.tools || []).filter((tool) => asBoolean(tool.enabled, true)));
    }

    function getToolsPageTools(catalog) {
        return sortTools((catalog?.tools || []).filter((tool) => (
            asBoolean(tool.enabled, true) && asBoolean(tool.listOnToolsPage, true)
        )));
    }

    function getHomepageProjects(catalog) {
        return [...(catalog?.tools || [])]
            .filter((tool) => asBoolean(tool.enabled, true) && asBoolean(tool.featured, false))
            .sort((left, right) => {
                const orderDiff = (left.homepageOrder || 999) - (right.homepageOrder || 999);
                if (orderDiff !== 0) return orderDiff;
                return left.title.localeCompare(right.title);
            });
    }

    function reindexHomepageOrder(tools) {
        const featured = tools
            .filter((tool) => asBoolean(tool.featured, false))
            .sort((a, b) => (a.homepageOrder || 999) - (b.homepageOrder || 999));
        const orderMap = new Map(featured.map((tool, index) => [tool.id, index + 1]));
        return tools.map((tool) => ({
            ...tool,
            homepageOrder: tool.featured ? (orderMap.get(tool.id) || 999) : 999
        }));
    }

    function getToolBySlug(catalog, slug) {
        const normalized = slugify(slug);
        if (!normalized) {
            return null;
        }
        return (catalog?.tools || []).find((tool) => tool.slug === normalized) || null;
    }

    function getToolById(catalog, id) {
        return (catalog?.tools || []).find((tool) => tool.id === id) || null;
    }

    function resolveToolHref(tool) {
        if (!tool) {
            return '#';
        }
        if (tool.detailPageEnabled && tool.slug && !RESERVED_APP_SLUGS.has(tool.slug)) {
            return `/tools/${tool.slug}`;
        }
        return tool.url || '#';
    }

    function isReservedAppSlug(slug) {
        return RESERVED_APP_SLUGS.has(slugify(slug));
    }

    function validateToolForSave(tool, catalog, options = {}) {
        const errors = [];
        if (!tool.title?.trim()) {
            errors.push('Title is required.');
        }
        if (!tool.url?.trim()) {
            errors.push('Destination URL is required.');
        }
        if (tool.detailPageEnabled) {
            if (!tool.slug) {
                errors.push('Slug is required when a detail page is enabled.');
            } else if (isReservedAppSlug(tool.slug)) {
                errors.push(`Slug "${tool.slug}" is reserved for an existing app page.`);
            } else {
                const conflict = (catalog?.tools || []).find((other) => (
                    other.id !== tool.id
                    && other.detailPageEnabled
                    && other.slug === tool.slug
                ));
                if (conflict) {
                    errors.push(`Slug "${tool.slug}" is already used by another detail page.`);
                }
            }
        }
        return errors;
    }

    const api = {
        CATALOG_VERSION,
        WEBSITE_LOGO_TTL_MS,
        DEFAULT_SEED_TOOLS,
        RESERVED_APP_SLUGS,
        slugify,
        createId,
        normalizeTool,
        normalizeCatalog,
        createDefaultCatalog,
        sortTools,
        reindexDisplayOrder,
        getPublicTools,
        getToolsPageTools,
        getHomepageProjects,
        reindexHomepageOrder,
        getToolBySlug,
        getToolById,
        resolveToolHref,
        resolveToolImageUrl,
        isWebsiteLogoStale,
        isReservedAppSlug,
        validateToolForSave
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.ToolsCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
