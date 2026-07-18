'use strict';

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { URL } = require('url');
const toolsCatalog = require('../../shared/tools/catalog');
const { readToolsCatalog, writeToolsCatalog } = require('./catalog-service');

const FILES_DIR = path.join(__dirname, '..', '..', 'files');
const WEBSITE_LOGO_DIR = path.join(FILES_DIR, 'tool-icons', 'website');
const FETCH_TIMEOUT_MS = 12000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const USER_AGENT = 'OkamiDesignsLogoBot/1.0 (+https://okamidesigns.com)';

const refreshInFlight = new Map();

function isPrivateHostname(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
        return true;
    }
    if (host === '::1' || host === '0.0.0.0') {
        return true;
    }

    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
        const parts = ipv4.slice(1).map(Number);
        if (parts[0] === 10) return true;
        if (parts[0] === 127) return true;
        if (parts[0] === 0) return true;
        if (parts[0] === 169 && parts[1] === 254) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    }
    return false;
}

function assertPublicHttpUrl(rawUrl, baseUrl) {
    let parsed;
    try {
        parsed = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    } catch {
        throw new Error('Invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http/https URLs are allowed');
    }
    if (isPrivateHostname(parsed.hostname)) {
        throw new Error('Private or local hosts are not allowed');
    }
    return parsed;
}

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': USER_AGENT,
                Accept: options.accept || '*/*',
                ...(options.headers || {})
            },
            redirect: 'follow'
        });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function extractAttr(tag, attrName) {
    const pattern = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, 'i');
    const match = tag.match(pattern);
    return match ? decodeHtmlEntities(match[1].trim()) : '';
}

function collectMetaCandidates(html, pageUrl) {
    const candidates = [];
    const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
    for (const tag of metaTags) {
        const property = (extractAttr(tag, 'property') || extractAttr(tag, 'name')).toLowerCase();
        const content = extractAttr(tag, 'content');
        if (!content) continue;
        if (property === 'og:image' || property === 'og:image:url' || property === 'twitter:image' || property === 'twitter:image:src') {
            candidates.push({ kind: 'og-image', href: content });
        }
    }

    const linkTags = html.match(/<link\b[^>]*>/gi) || [];
    for (const tag of linkTags) {
        const rel = extractAttr(tag, 'rel').toLowerCase();
        const href = extractAttr(tag, 'href');
        if (!href) continue;
        if (rel.includes('apple-touch-icon')) {
            candidates.push({ kind: 'apple-touch-icon', href });
        } else if (rel.split(/\s+/).includes('icon') || rel.includes('shortcut icon')) {
            candidates.push({ kind: 'favicon', href });
        } else if (rel.includes('manifest')) {
            candidates.push({ kind: 'manifest', href, isManifest: true });
        }
    }

    // Common fallbacks
    candidates.push({ kind: 'favicon', href: '/favicon.ico' });
    candidates.push({ kind: 'favicon', href: '/favicon.png' });

    const resolved = [];
    const seen = new Set();
    for (const item of candidates) {
        try {
            const absolute = assertPublicHttpUrl(item.href, pageUrl).toString();
            if (seen.has(absolute)) continue;
            seen.add(absolute);
            resolved.push({ ...item, href: absolute });
        } catch {
            // skip invalid candidate
        }
    }

    const order = { 'og-image': 1, 'apple-touch-icon': 2, favicon: 3, manifest: 4 };
    return resolved.sort((a, b) => (order[a.kind] || 99) - (order[b.kind] || 99));
}

async function expandManifestCandidates(manifestUrl) {
    try {
        const response = await fetchWithTimeout(manifestUrl, {
            accept: 'application/manifest+json,application/json,*/*'
        });
        if (!response.ok) return [];
        const data = await response.json();
        const icons = Array.isArray(data.icons) ? data.icons : [];
        return icons
            .map((icon) => {
                const src = icon?.src;
                if (!src) return null;
                try {
                    return {
                        kind: 'manifest',
                        href: assertPublicHttpUrl(src, manifestUrl).toString()
                    };
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

function extensionFromContentType(contentType, fallbackUrl) {
    const type = String(contentType || '').split(';')[0].trim().toLowerCase();
    const map = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'image/x-icon': '.ico',
        'image/vnd.microsoft.icon': '.ico'
    };
    if (map[type]) return map[type];
    const fromUrl = path.extname(new URL(fallbackUrl).pathname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(fromUrl)) {
        return fromUrl === '.jpeg' ? '.jpg' : fromUrl;
    }
    return '.png';
}

async function downloadImage(imageUrl) {
    const response = await fetchWithTimeout(imageUrl, {
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
    });
    if (!response.ok) {
        throw new Error(`Image fetch failed (${response.status})`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/^image\//i.test(contentType) && !/icon/i.test(contentType)) {
        // Some servers omit type for ico; allow empty/unknown below
        if (!/octet-stream/i.test(contentType)) {
            throw new Error(`Unexpected content type: ${contentType}`);
        }
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
        throw new Error('Empty image response');
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
        throw new Error('Image exceeds size limit');
    }
    return {
        buffer,
        contentType,
        extension: extensionFromContentType(contentType, imageUrl)
    };
}

async function saveWebsiteLogo(toolId, image) {
    await fs.mkdir(WEBSITE_LOGO_DIR, { recursive: true });
    const safeId = toolsCatalog.slugify(toolId) || `tool-${crypto.randomBytes(3).toString('hex')}`;
    const filename = `${safeId}${image.extension}`;
    const diskPath = path.join(WEBSITE_LOGO_DIR, filename);
    await fs.writeFile(diskPath, image.buffer);
    // cache-bust query so browsers pick up refreshes
    return `/files/tool-icons/website/${filename}?v=${Date.now()}`;
}

async function discoverLogoCandidates(pageUrl) {
    const response = await fetchWithTimeout(pageUrl, {
        accept: 'text/html,application/xhtml+xml'
    });
    if (!response.ok) {
        throw new Error(`Website returned ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        // Still try if server mislabels
    }
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const initial = collectMetaCandidates(html, pageUrl);
    const expanded = [];
    for (const candidate of initial) {
        if (candidate.isManifest) {
            const manifestIcons = await expandManifestCandidates(candidate.href);
            expanded.push(...manifestIcons);
        } else {
            expanded.push(candidate);
        }
    }
    const order = { 'og-image': 1, 'apple-touch-icon': 2, favicon: 3, manifest: 4 };
    const seen = new Set();
    return expanded
        .filter((item) => {
            if (seen.has(item.href)) return false;
            seen.add(item.href);
            return true;
        })
        .sort((a, b) => (order[a.kind] || 99) - (order[b.kind] || 99));
}

async function refreshToolWebsiteLogo(tool, { force = false } = {}) {
    if (!tool || tool.imageSource !== 'website') {
        return { tool, skipped: true, reason: 'image_source_not_website' };
    }
    if (tool.linkType !== 'external' && !/^https?:\/\//i.test(tool.url || '')) {
        return { tool, skipped: true, reason: 'not_external_url' };
    }

    if (!force && !toolsCatalog.isWebsiteLogoStale(tool)) {
        return { tool, skipped: true, reason: 'fresh_cache' };
    }

    if (refreshInFlight.has(tool.id)) {
        return refreshInFlight.get(tool.id);
    }

    const job = (async () => {
        const pageUrl = assertPublicHttpUrl(tool.url).toString();
        const candidates = await discoverLogoCandidates(pageUrl);
        let lastError = null;

        for (const candidate of candidates) {
            try {
                const image = await downloadImage(candidate.href);
                const localUrl = await saveWebsiteLogo(tool.id, image);
                const nowIso = new Date().toISOString();
                const updated = {
                    ...tool,
                    websiteLogoUrl: localUrl,
                    websiteLogoRemoteUrl: candidate.href,
                    websiteLogoKind: candidate.kind,
                    websiteLogoFetchedAt: nowIso,
                    websiteLogoError: '',
                    updatedAt: nowIso
                };
                return { tool: updated, skipped: false, kind: candidate.kind };
            } catch (error) {
                lastError = error;
            }
        }

        const nowIso = new Date().toISOString();
        return {
            tool: {
                ...tool,
                websiteLogoError: lastError?.message || 'No logo found',
                websiteLogoFetchedAt: tool.websiteLogoFetchedAt || nowIso,
                updatedAt: nowIso
            },
            skipped: false,
            failed: true,
            error: lastError?.message || 'No logo found'
        };
    })();

    refreshInFlight.set(tool.id, job);
    try {
        return await job;
    } finally {
        refreshInFlight.delete(tool.id);
    }
}

async function persistToolLogoUpdate(updatedTool) {
    const catalog = await readToolsCatalog();
    const nextTools = catalog.tools.map((item) => (
        item.id === updatedTool.id ? { ...item, ...updatedTool } : item
    ));
    return writeToolsCatalog({
        ...catalog,
        tools: nextTools
    });
}

async function refreshToolLogoById(toolId, { force = true } = {}) {
    const catalog = await readToolsCatalog();
    const tool = toolsCatalog.getToolById(catalog, toolId);
    if (!tool) {
        const error = new Error('tool_not_found');
        error.code = 'tool_not_found';
        throw error;
    }

    const result = await refreshToolWebsiteLogo(tool, { force });
    const saved = await persistToolLogoUpdate(result.tool);
    return {
        ...result,
        tool: toolsCatalog.getToolById(saved, toolId),
        tools: toolsCatalog.sortTools(saved.tools),
        updatedAt: saved.updatedAt
    };
}

async function refreshStaleWebsiteLogos({ force = false, limit = 5 } = {}) {
    const catalog = await readToolsCatalog();
    const targets = catalog.tools.filter((tool) => (
        tool.imageSource === 'website'
        && (force || toolsCatalog.isWebsiteLogoStale(tool))
    )).slice(0, limit);

    if (!targets.length) {
        return { refreshed: 0, tools: catalog.tools };
    }

    let tools = [...catalog.tools];
    let refreshed = 0;

    for (const target of targets) {
        try {
            const result = await refreshToolWebsiteLogo(target, { force });
            tools = tools.map((item) => (item.id === target.id ? result.tool : item));
            if (!result.skipped) {
                refreshed += 1;
            }
        } catch (error) {
            console.warn(`Website logo refresh failed for ${target.id}:`, error.message || error);
        }
    }

    if (refreshed > 0 || force) {
        const saved = await writeToolsCatalog({ ...catalog, tools });
        return { refreshed, tools: saved.tools, updatedAt: saved.updatedAt };
    }

    return { refreshed: 0, tools: catalog.tools };
}

module.exports = {
    WEBSITE_LOGO_DIR,
    refreshToolWebsiteLogo,
    refreshToolLogoById,
    refreshStaleWebsiteLogos
};
