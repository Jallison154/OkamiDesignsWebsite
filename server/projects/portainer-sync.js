'use strict';

/**
 * Portainer → site sync.
 *
 * Polls the Portainer API for containers that opt in with a label
 * (default `okami.public=true`) and turns them into project cards.
 * Card fields come from the same `homepage.*` labels the Homepage dashboard
 * (gethomepage.dev) reads, with optional `okami.*` labels taking precedence.
 *
 * Results are cached in files/portainer-projects.json so the site keeps working
 * when Portainer is unreachable. Containers that disappear are kept (marked
 * "removed", hidden from the public site) for REMOVED_RETENTION_MS so admin
 * overrides survive a redeploy.
 *
 * The API key never leaves the server.
 */

const path = require('path');
const fs = require('fs').promises;
const { marked } = require('marked');
const toolsCatalog = require('../../shared/tools/catalog');

const FILES_DIR = path.join(__dirname, '..', '..', 'files');
const CACHE_PATH = path.join(FILES_DIR, 'portainer-projects.json');
const REMOVED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DASHBOARD_ICONS_BASE = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons';

function readPortainerConfig(env = process.env) {
    const url = String(env.PORTAINER_URL || '').trim().replace(/\/+$/, '');
    const apiKey = String(env.PORTAINER_API_KEY || '').trim();
    const intervalMs = Number(env.PORTAINER_SYNC_INTERVAL_MS) || 5 * 60 * 1000;
    return {
        enabled: Boolean(url && apiKey),
        url,
        apiKey,
        endpointIds: String(env.PORTAINER_ENDPOINT_IDS || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        publicLabel: String(env.PORTAINER_PUBLIC_LABEL || 'okami.public').trim(),
        intervalMs: Math.max(intervalMs, 30 * 1000),
        timeoutMs: Number(env.PORTAINER_TIMEOUT_MS) || 10000
    };
}

function isTruthyLabel(value) {
    return /^(true|1|yes|on)$/i.test(String(value || '').trim());
}

function resolveIcon(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
        return raw;
    }
    // Homepage-style icon names, e.g. "sonarr.png" / "grafana.svg" / "jellyfin"
    const match = raw.match(/^([a-z0-9][a-z0-9-]*)(?:\.(png|svg|webp))?$/i);
    if (match) {
        const ext = (match[2] || 'png').toLowerCase();
        return `${DASHBOARD_ICONS_BASE}/${ext}/${match[1].toLowerCase()}.${ext}`;
    }
    return '';
}

function imageVersion(container, labels) {
    const labelled = labels['okami.version'] || labels['org.opencontainers.image.version'];
    if (labelled) {
        return String(labelled);
    }
    const image = String(container.Image || '');
    if (image.startsWith('sha256:')) {
        return '';
    }
    const lastSegment = image.split('/').pop() || '';
    const tag = lastSegment.includes(':') ? lastSegment.split(':').pop() : '';
    return tag && tag !== 'latest' ? tag : '';
}

function runtimeStatusFor(container) {
    const state = String(container.State || '').toLowerCase();
    const status = String(container.Status || '').toLowerCase();
    if (state !== 'running') {
        return 'offline';
    }
    if (status.includes('unhealthy')) {
        return 'degraded';
    }
    return 'online';
}

/**
 * Turn one Docker container (as returned by /containers/json) into a project.
 * Exported for tests.
 */
function projectFromContainer(container, { endpointName = '', nowIso = new Date().toISOString() } = {}) {
    const labels = container.Labels || {};
    const containerName = String((container.Names || [])[0] || container.Id || 'container').replace(/^\//, '');
    const label = (...keys) => {
        for (const key of keys) {
            const value = labels[key];
            if (value != null && String(value).trim() !== '') {
                return String(value).trim();
            }
        }
        return '';
    };

    const title = label('okami.title', 'okami.name', 'homepage.name') || containerName;
    const slug = toolsCatalog.slugify(label('okami.slug') || title) || toolsCatalog.slugify(containerName);
    const href = label('okami.url', 'homepage.href');
    const safeHref = /^https?:\/\//i.test(href) ? href : '';
    const details = label('okami.details');
    const repo = label('okami.repo', 'org.opencontainers.image.source');
    const icon = resolveIcon(label('okami.icon', 'homepage.icon'));

    return {
        id: `portainer-${slug}`,
        title,
        slug,
        category: label('okami.category', 'homepage.group') || 'App',
        shortDescription: label('okami.description', 'homepage.description'),
        url: safeHref || `/projects/${slug}`,
        linkType: safeHref ? 'external' : 'internal',
        openInNewTab: Boolean(safeHref),
        buttonLabel: label('okami.button') || 'Open app →',
        contentType: 'app',
        imageSource: icon ? 'upload' : 'placeholder',
        iconUrl: icon,
        featured: isTruthyLabel(label('okami.featured')),
        listOnToolsPage: true,
        enabled: true,
        detailPageEnabled: label('okami.detail_page') ? isTruthyLabel(label('okami.detail_page')) : Boolean(details || !safeHref),
        status: label('okami.status'),
        version: imageVersion(container, labels),
        tags: label('okami.tags').split(',').map((tag) => tag.trim()).filter(Boolean),
        bodyHtml: details ? marked.parse(details) : '',
        repoUrl: /^https?:\/\//i.test(repo) ? repo : '',
        runtimeStatus: runtimeStatusFor(container),
        lastSyncedAt: nowIso,
        displayOrder: Number(label('okami.order')) || 200,
        source: 'portainer',
        sourcePath: `${endpointName ? `${endpointName} / ` : ''}${containerName}`,
        createdAt: container.Created ? new Date(container.Created * 1000).toISOString() : nowIso,
        updatedAt: nowIso
    };
}

async function portainerFetch(config, apiPath) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
        const response = await fetch(`${config.url}${apiPath}`, {
            headers: { 'X-API-Key': config.apiKey, Accept: 'application/json' },
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`Portainer ${apiPath} responded ${response.status}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

async function readCache() {
    try {
        const raw = JSON.parse(await fs.readFile(CACHE_PATH, 'utf8'));
        return {
            syncedAt: raw.syncedAt || '',
            lastAttemptAt: raw.lastAttemptAt || '',
            error: raw.error || '',
            projects: Array.isArray(raw.projects) ? raw.projects : []
        };
    } catch {
        return { syncedAt: '', lastAttemptAt: '', error: '', projects: [] };
    }
}

async function writeCache(cache) {
    await fs.mkdir(FILES_DIR, { recursive: true });
    await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/**
 * Merge a fresh container list with the previous cache:
 * - seen containers replace their cached entry
 * - unseen containers are kept as "removed" until the retention window passes
 */
function mergeWithPrevious(previous, fresh, nowIso) {
    const nowMs = Date.parse(nowIso);
    const freshIds = new Set(fresh.map((project) => project.id));
    const kept = previous
        .filter((project) => !freshIds.has(project.id))
        .map((project) => ({
            ...project,
            runtimeStatus: 'removed',
            removedAt: project.removedAt || nowIso
        }))
        .filter((project) => nowMs - Date.parse(project.removedAt) < REMOVED_RETENTION_MS);
    return [...fresh, ...kept];
}

let syncInFlight = null;
let syncTimer = null;

async function syncPortainer({ config = readPortainerConfig(), fetchImpl } = {}) {
    if (!config.enabled) {
        return { skipped: true, reason: 'not_configured' };
    }
    if (syncInFlight) {
        return syncInFlight;
    }

    syncInFlight = (async () => {
        const nowIso = new Date().toISOString();
        const previous = await readCache();
        try {
            const doFetch = fetchImpl || ((apiPath) => portainerFetch(config, apiPath));
            const endpoints = config.endpointIds.length
                ? config.endpointIds.map((id) => ({ Id: id, Name: `endpoint ${id}` }))
                : await doFetch('/api/endpoints');
            const fresh = [];
            const seen = new Set();
            const filters = encodeURIComponent(JSON.stringify({ label: [config.publicLabel] }));

            for (const endpoint of endpoints || []) {
                const containers = await doFetch(
                    `/api/endpoints/${encodeURIComponent(endpoint.Id)}/docker/containers/json?all=1&filters=${filters}`
                );
                for (const container of containers || []) {
                    if (!isTruthyLabel(container.Labels?.[config.publicLabel])) {
                        continue;
                    }
                    const project = projectFromContainer(container, { endpointName: endpoint.Name, nowIso });
                    if (seen.has(project.id)) {
                        continue; // first match wins (e.g. replicas / same app on two hosts)
                    }
                    seen.add(project.id);
                    fresh.push(project);
                }
            }

            const cache = {
                syncedAt: nowIso,
                lastAttemptAt: nowIso,
                error: '',
                projects: mergeWithPrevious(previous.projects, fresh, nowIso)
            };
            await writeCache(cache);
            return { skipped: false, count: fresh.length, syncedAt: nowIso };
        } catch (error) {
            const message = error.name === 'AbortError' ? 'Portainer request timed out' : (error.message || String(error));
            await writeCache({ ...previous, lastAttemptAt: nowIso, error: message });
            console.warn(`Portainer sync failed: ${message}`);
            return { skipped: false, error: message };
        } finally {
            syncInFlight = null;
        }
    })();

    return syncInFlight;
}

async function getPortainerProjects() {
    const cache = await readCache();
    return cache.projects;
}

async function getPortainerStatus() {
    const config = readPortainerConfig();
    const cache = await readCache();
    return {
        configured: config.enabled,
        publicLabel: config.publicLabel,
        intervalMs: config.intervalMs,
        syncedAt: cache.syncedAt,
        lastAttemptAt: cache.lastAttemptAt,
        error: cache.error,
        count: cache.projects.filter((project) => project.runtimeStatus !== 'removed').length
    };
}

function startPortainerSync({ onSynced } = {}) {
    const config = readPortainerConfig();
    if (!config.enabled) {
        return false;
    }
    const run = () => syncPortainer({ config })
        .then((result) => {
            if (typeof onSynced === 'function') {
                onSynced(result);
            }
        })
        .catch((error) => console.warn('Portainer sync error:', error.message || error));
    run();
    syncTimer = setInterval(run, config.intervalMs);
    if (typeof syncTimer.unref === 'function') {
        syncTimer.unref();
    }
    console.log(`🐳 Portainer sync enabled (${config.url}, every ${Math.round(config.intervalMs / 1000)}s, label ${config.publicLabel})`);
    return true;
}

module.exports = {
    CACHE_PATH,
    readPortainerConfig,
    projectFromContainer,
    mergeWithPrevious,
    resolveIcon,
    syncPortainer,
    getPortainerProjects,
    getPortainerStatus,
    startPortainerSync
};
