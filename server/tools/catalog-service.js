'use strict';

/**
 * Project catalog = three sources merged into one list:
 *
 *   1. manual    — entries created in the admin Tools tab (stored in full in files/tools.json)
 *   2. file      — projects/*.md (content lives in the Markdown file)
 *   3. portainer — labelled containers (content lives in Docker labels; cached in
 *                  files/portainer-projects.json)
 *
 * For file/portainer projects, files/tools.json only stores a small "stub":
 *   { id, source, overrides: { featured, enabled, ... }, websiteLogo* cache }
 * so admin choices (publish/hide, homepage, ordering) survive while the content
 * always comes from the file or container. Overrides only record values that
 * differ from the source, so editing `featured:` in a Markdown file still works
 * until an admin explicitly changes it.
 */

const path = require('path');
const fs = require('fs').promises;
const toolsCatalog = require('../../shared/tools/catalog');
const { normalizeSiteSettings } = require('../../shared/settings/site-settings');
const { loadMarkdownProjects } = require('../projects/markdown-projects');
const { getPortainerProjects } = require('../projects/portainer-sync');

const FILES_DIR = path.join(__dirname, '..', '..', 'files');
const TOOLS_PATH = path.join(FILES_DIR, 'tools.json');
const PUBLIC_SNAPSHOT_PATH = path.join(FILES_DIR, 'projects-public.json');
const SITE_SETTINGS_PATH = path.join(FILES_DIR, 'site-settings.json');

// Fields an admin may override on file/portainer projects.
const OVERRIDABLE_FIELDS = ['enabled', 'featured', 'listOnToolsPage', 'displayOrder', 'homepageOrder', 'accent'];
// Cache fields written by the logo service; persisted on stubs as-is.
const LOGO_CACHE_FIELDS = [
    'websiteLogoUrl',
    'websiteLogoRemoteUrl',
    'websiteLogoKind',
    'websiteLogoFetchedAt',
    'websiteLogoError'
];

async function readVisibilityPages() {
    try {
        const data = await fs.readFile(SITE_SETTINGS_PATH, 'utf8');
        return normalizeSiteSettings(JSON.parse(data)).pages;
    } catch {
        return null;
    }
}

async function ensureToolsFile() {
    await fs.mkdir(FILES_DIR, { recursive: true });
    try {
        await fs.access(TOOLS_PATH);
    } catch {
        // Projects now come from projects/*.md, so a fresh install starts with an
        // empty manual list rather than seeded duplicates.
        const empty = { version: toolsCatalog.CATALOG_VERSION, updatedAt: new Date().toISOString(), tools: [] };
        await fs.writeFile(TOOLS_PATH, JSON.stringify(empty, null, 2));
    }
}

async function readStoredFile() {
    await ensureToolsFile();
    try {
        const raw = JSON.parse(await fs.readFile(TOOLS_PATH, 'utf8'));
        return raw && typeof raw === 'object' ? raw : {};
    } catch {
        return {};
    }
}

function isStub(entry) {
    const source = String(entry?.source || '').toLowerCase();
    return source === 'file' || source === 'portainer';
}

async function loadExternalProjects() {
    const [fileProjects, portainerProjects] = await Promise.all([
        loadMarkdownProjects().catch((error) => {
            console.warn('Could not load projects/*.md:', error.message || error);
            return [];
        }),
        getPortainerProjects().catch(() => [])
    ]);

    // Markdown wins if a file and a container claim the same id.
    const byId = new Map();
    for (const project of [...portainerProjects, ...fileProjects]) {
        byId.set(project.id, project);
    }
    return [...byId.values()];
}

function applyStub(project, stub) {
    const merged = { ...project };
    const overrides = stub?.overrides || {};
    for (const field of OVERRIDABLE_FIELDS) {
        if (overrides[field] !== undefined) {
            merged[field] = overrides[field];
        }
    }
    for (const field of LOGO_CACHE_FIELDS) {
        if (stub?.[field]) {
            merged[field] = stub[field];
        }
    }
    // Containers that disappeared are never shown publicly.
    if (project.runtimeStatus === 'removed') {
        merged.enabled = false;
    }
    return merged;
}

async function buildCatalog() {
    const stored = await readStoredFile();
    const rawTools = Array.isArray(stored.tools) ? stored.tools : [];
    const stubs = new Map(rawTools.filter(isStub).map((entry) => [entry.id, entry]));
    const external = await loadExternalProjects();
    const externalIds = new Set(external.map((project) => project.id));

    // Manual entries whose id is now provided by a file/container are superseded.
    const manualRaw = rawTools.filter((entry) => !isStub(entry) && !externalIds.has(entry.id));
    const merged = [
        ...manualRaw.map((entry) => ({ ...entry, source: 'manual' })),
        ...external.map((project) => applyStub(project, stubs.get(project.id)))
    ];

    const catalog = toolsCatalog.normalizeCatalog(
        { version: stored.version ?? toolsCatalog.CATALOG_VERSION, updatedAt: stored.updatedAt, tools: merged },
        { allowEmpty: true, visibilityPages: await readVisibilityPages() }
    );
    return { catalog, stored, external };
}

async function readToolsCatalog() {
    const { catalog } = await buildCatalog();
    return catalog;
}

function buildStub(tool, sourceProject, previousStub) {
    const sourceNormalized = toolsCatalog.normalizeTool(sourceProject, 0);
    const overrides = {};
    for (const field of OVERRIDABLE_FIELDS) {
        if (tool[field] !== undefined && tool[field] !== sourceNormalized[field]) {
            overrides[field] = tool[field];
        }
    }
    // Removed containers are force-hidden on read; don't bake that in as an override.
    if (sourceProject.runtimeStatus === 'removed' && previousStub?.overrides?.enabled === undefined) {
        delete overrides.enabled;
    }
    const stub = { id: tool.id, source: sourceProject.source, overrides };
    for (const field of LOGO_CACHE_FIELDS) {
        if (tool[field]) {
            stub[field] = tool[field];
        }
    }
    return stub;
}

async function writePublicSnapshot(catalog) {
    // Static fallback used by the browser when the API is unreachable.
    const payload = {
        version: catalog.version,
        updatedAt: catalog.updatedAt,
        tools: toolsCatalog.getPublicTools(catalog)
    };
    await fs.writeFile(PUBLIC_SNAPSHOT_PATH, JSON.stringify(payload, null, 2));
}

async function refreshPublicSnapshot() {
    const catalog = await readToolsCatalog();
    await writePublicSnapshot(catalog);
    return catalog;
}

async function writeToolsCatalog(raw) {
    const { stored, external } = await buildCatalog();
    const externalById = new Map(external.map((project) => [project.id, project]));
    const previousStubs = new Map((stored.tools || []).filter(isStub).map((entry) => [entry.id, entry]));

    const incoming = toolsCatalog.normalizeCatalog(raw, { allowEmpty: true });
    const nowIso = new Date().toISOString();
    const incomingIds = new Set(incoming.tools.map((tool) => tool.id));

    const manual = [];
    const stubs = [];
    for (const tool of incoming.tools) {
        const sourceProject = externalById.get(tool.id);
        if (sourceProject) {
            stubs.push(buildStub(tool, sourceProject, previousStubs.get(tool.id)));
        } else {
            const { source, sourcePath, bodyHtml, runtimeStatus, lastSyncedAt, ...rest } = tool;
            manual.push({ ...rest, source: 'manual', updatedAt: tool.updatedAt || nowIso });
        }
    }

    // Never infer deletion from a missing entry: background writers (logo refresh)
    // can hold a list read before a sync added new projects. Keep previous stubs for
    // anything not in this write (also covers renamed files / Portainer outages).
    // Hiding a file/Portainer project is done explicitly by setting enabled: false.
    for (const [id, previous] of previousStubs) {
        if (!incomingIds.has(id)) {
            stubs.push(previous);
        }
    }

    await fs.writeFile(TOOLS_PATH, JSON.stringify({
        version: incoming.version,
        updatedAt: nowIso,
        tools: [...manual, ...stubs]
    }, null, 2));

    return refreshPublicSnapshot();
}

module.exports = {
    TOOLS_PATH,
    PUBLIC_SNAPSHOT_PATH,
    OVERRIDABLE_FIELDS,
    readToolsCatalog,
    writeToolsCatalog,
    ensureToolsFile,
    refreshPublicSnapshot
};
