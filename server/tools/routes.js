'use strict';

const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const toolsCatalog = require('../../shared/tools/catalog');
const { readToolsCatalog, writeToolsCatalog, ensureToolsFile } = require('./catalog-service');
const { refreshToolLogoById, refreshStaleWebsiteLogos } = require('./logo-service');

const FILES_DIR = path.join(__dirname, '..', '..', 'files');
const TOOL_ICONS_DIR = path.join(FILES_DIR, 'tool-icons');

const IMAGE_MIME = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/svg+xml'
]);

function createToolIconUploader() {
    const storage = multer.diskStorage({
        destination: async (_req, _file, cb) => {
            try {
                await fs.mkdir(TOOL_ICONS_DIR, { recursive: true });
                cb(null, TOOL_ICONS_DIR);
            } catch (error) {
                cb(error);
            }
        },
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
            const safeExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext) ? ext : '.png';
            const stamp = Date.now();
            const randomId = crypto.randomBytes(4).toString('hex');
            cb(null, `tool-icon_${stamp}_${randomId}${safeExt}`);
        }
    });

    return multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (IMAGE_MIME.has(file.mimetype)) {
                cb(null, true);
                return;
            }
            cb(new Error('Only image uploads are allowed for tool icons.'));
        }
    });
}

function createToolsRouter({ requireAdmin, setNoCacheHeaders }) {
    const router = express.Router();
    const uploadIcon = createToolIconUploader();

    router.use((req, res, next) => {
        if (typeof setNoCacheHeaders === 'function') {
            setNoCacheHeaders(res);
        }
        next();
    });

    router.get('/', async (_req, res) => {
        try {
            await ensureToolsFile();
            const catalog = await readToolsCatalog();
            // Refresh stale website logos in the background (7-day cache).
            refreshStaleWebsiteLogos({ force: false, limit: 3 }).catch((error) => {
                console.warn('Background website logo refresh failed:', error.message || error);
            });
            res.json({
                version: catalog.version,
                updatedAt: catalog.updatedAt,
                tools: toolsCatalog.getPublicTools(catalog)
            });
        } catch (error) {
            console.error('Error reading tools catalog:', error);
            res.status(500).json({ error: 'Failed to read tools catalog' });
        }
    });

    router.get('/manage', requireAdmin, async (_req, res) => {
        try {
            const catalog = await readToolsCatalog();
            refreshStaleWebsiteLogos({ force: false, limit: 5 }).catch((error) => {
                console.warn('Background website logo refresh failed:', error.message || error);
            });
            res.json({
                version: catalog.version,
                updatedAt: catalog.updatedAt,
                tools: toolsCatalog.sortTools(catalog.tools)
            });
        } catch (error) {
            console.error('Error reading managed tools catalog:', error);
            res.status(500).json({ error: 'Failed to read tools catalog' });
        }
    });

    router.get('/by-slug/:slug', async (req, res) => {
        try {
            const catalog = await readToolsCatalog();
            const tool = toolsCatalog.getToolBySlug(catalog, req.params.slug);
            if (!tool || tool.enabled === false) {
                return res.status(404).json({ error: 'tool_not_found' });
            }
            if (!tool.detailPageEnabled) {
                return res.status(404).json({ error: 'detail_disabled' });
            }
            if (toolsCatalog.isReservedAppSlug(tool.slug)) {
                return res.status(404).json({ error: 'reserved_slug' });
            }
            return res.json({ tool });
        } catch (error) {
            console.error('Error reading tool by slug:', error);
            return res.status(500).json({ error: 'Failed to read tool' });
        }
    });

    router.put('/', requireAdmin, async (req, res) => {
        try {
            const incoming = { ...(req.body || {}), allowEmpty: true };
            const normalized = toolsCatalog.normalizeCatalog(incoming, { allowEmpty: true });
            for (const tool of normalized.tools) {
                const errors = toolsCatalog.validateToolForSave(tool, normalized);
                if (errors.length) {
                    return res.status(400).json({ error: 'validation_failed', messages: errors, toolId: tool.id });
                }
            }
            let catalog = await writeToolsCatalog(normalized);

            // Fetch website logos for tools that need them (missing or stale cache).
            const needingLogo = catalog.tools.filter((tool) => (
                tool.imageSource === 'website' && toolsCatalog.isWebsiteLogoStale(tool)
            ));
            for (const tool of needingLogo.slice(0, 5)) {
                try {
                    const refreshed = await refreshToolLogoById(tool.id, { force: !tool.websiteLogoUrl });
                    catalog = {
                        ...catalog,
                        tools: refreshed.tools,
                        updatedAt: refreshed.updatedAt || catalog.updatedAt
                    };
                } catch (error) {
                    console.warn(`Logo fetch on save failed for ${tool.id}:`, error.message || error);
                }
            }

            res.json({
                success: true,
                version: catalog.version,
                updatedAt: catalog.updatedAt,
                tools: toolsCatalog.sortTools(catalog.tools)
            });
        } catch (error) {
            console.error('Error saving tools catalog:', error);
            res.status(500).json({ error: 'Failed to save tools catalog' });
        }
    });

    router.post('/', requireAdmin, async (req, res) => {
        try {
            const catalog = await readToolsCatalog();
            const nowIso = new Date().toISOString();
            const tool = toolsCatalog.normalizeTool({
                ...req.body,
                id: req.body?.id || toolsCatalog.createId(req.body?.title || 'tool'),
                createdAt: nowIso,
                updatedAt: nowIso,
                displayOrder: (catalog.tools.length || 0) + 1
            }, catalog.tools.length, nowIso);

            const nextCatalog = toolsCatalog.normalizeCatalog({
                ...catalog,
                tools: [...catalog.tools, tool]
            });

            const errors = toolsCatalog.validateToolForSave(tool, nextCatalog);
            if (errors.length) {
                return res.status(400).json({ error: 'validation_failed', messages: errors });
            }

            const saved = await writeToolsCatalog(nextCatalog);
            res.status(201).json({
                success: true,
                tool: toolsCatalog.getToolById(saved, tool.id),
                tools: toolsCatalog.sortTools(saved.tools),
                updatedAt: saved.updatedAt
            });
        } catch (error) {
            console.error('Error creating tool:', error);
            res.status(500).json({ error: 'Failed to create tool' });
        }
    });

    router.put('/:id', requireAdmin, async (req, res) => {
        try {
            const catalog = await readToolsCatalog();
            const existing = toolsCatalog.getToolById(catalog, req.params.id);
            if (!existing) {
                return res.status(404).json({ error: 'tool_not_found' });
            }

            const nowIso = new Date().toISOString();
            const tool = toolsCatalog.normalizeTool({
                ...existing,
                ...req.body,
                id: existing.id,
                createdAt: existing.createdAt,
                updatedAt: nowIso
            }, existing.displayOrder - 1, nowIso);

            const nextTools = catalog.tools.map((item) => (item.id === tool.id ? tool : item));
            const nextCatalog = toolsCatalog.normalizeCatalog({ ...catalog, tools: nextTools });
            const errors = toolsCatalog.validateToolForSave(tool, nextCatalog);
            if (errors.length) {
                return res.status(400).json({ error: 'validation_failed', messages: errors });
            }

            const saved = await writeToolsCatalog(nextCatalog);
            res.json({
                success: true,
                tool: toolsCatalog.getToolById(saved, tool.id),
                tools: toolsCatalog.sortTools(saved.tools),
                updatedAt: saved.updatedAt
            });
        } catch (error) {
            console.error('Error updating tool:', error);
            res.status(500).json({ error: 'Failed to update tool' });
        }
    });

    router.delete('/:id', requireAdmin, async (req, res) => {
        try {
            const catalog = await readToolsCatalog();
            const existing = toolsCatalog.getToolById(catalog, req.params.id);
            if (!existing) {
                return res.status(404).json({ error: 'tool_not_found' });
            }

            const nextCatalog = toolsCatalog.normalizeCatalog({
                ...catalog,
                tools: catalog.tools.filter((tool) => tool.id !== existing.id)
            });
            const saved = await writeToolsCatalog(nextCatalog);
            res.json({
                success: true,
                tools: toolsCatalog.sortTools(saved.tools),
                updatedAt: saved.updatedAt
            });
        } catch (error) {
            console.error('Error deleting tool:', error);
            res.status(500).json({ error: 'Failed to delete tool' });
        }
    });

    router.post('/upload-icon', requireAdmin, (req, res) => {
        uploadIcon.single('icon')(req, res, async (error) => {
            if (error) {
                console.error('Tool icon upload error:', error);
                return res.status(400).json({ error: error.message || 'upload_failed' });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'icon_required' });
            }
            return res.json({
                success: true,
                iconUrl: `/files/tool-icons/${req.file.filename}`,
                filename: req.file.filename
            });
        });
    });

    router.post('/:id/refresh-logo', requireAdmin, async (req, res) => {
        try {
            const result = await refreshToolLogoById(req.params.id, { force: true });
            if (result.failed) {
                return res.status(422).json({
                    error: 'logo_refresh_failed',
                    message: result.error || 'Could not retrieve a website logo',
                    tool: result.tool,
                    tools: result.tools
                });
            }
            return res.json({
                success: true,
                skipped: Boolean(result.skipped),
                kind: result.kind || null,
                tool: result.tool,
                tools: result.tools,
                updatedAt: result.updatedAt
            });
        } catch (error) {
            if (error.code === 'tool_not_found') {
                return res.status(404).json({ error: 'tool_not_found' });
            }
            console.error('Tool logo refresh error:', error);
            return res.status(500).json({ error: 'Failed to refresh website logo' });
        }
    });

    return router;
}

module.exports = {
    createToolsRouter,
    TOOL_ICONS_DIR
};
