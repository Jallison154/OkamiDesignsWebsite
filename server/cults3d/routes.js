'use strict';

const express = require('express');
const path = require('path');
const { getModelsListing, fetchCreationThumbnail } = require('./service');
const { readCults3dConfig } = require('./config');
const {
    findLocalThumbnailFile,
    isAllowedRemoteImageUrl
} = require('./images');

const THUMBNAIL_CACHE_MS = 15 * 60 * 1000;
const thumbnailCache = new Map();

function createCults3dRouter(options = {}) {
    const router = express.Router();
    const projectRoot = options.projectRoot || path.join(__dirname, '..', '..');
    const fallbackPath = options.fallbackPath
        || path.join(projectRoot, 'files', 'cults3d-models.json');
    const publicModelsDir = options.publicModelsDir
        || path.join(projectRoot, 'public', '3d-models');
    const listingOptions = {
        fallbackPath,
        publicModelsDir,
        projectRoot
    };

    router.get('/models', async (_req, res) => {
        try {
            const listing = await getModelsListing(listingOptions);
            const config = readCults3dConfig();

            res.json({
                source: listing.source,
                profileUrl: listing.profileUrl,
                models: listing.models,
                configured: config.configured,
                liveError: listing.liveError || null,
                error: listing.error || null
            });
        } catch (error) {
            console.error('Cults3D models route failed:', error);
            res.status(500).json({
                source: 'error',
                profileUrl: readCults3dConfig().profileUrl,
                models: [],
                configured: readCults3dConfig().configured,
                error: 'Models could not be loaded right now.'
            });
        }
    });

    router.get('/thumbnail/:slug', async (req, res) => {
        const slug = String(req.params.slug || '').trim();
        if (!slug) {
            return res.status(400).json({ error: 'Missing model slug' });
        }

        try {
            const localFile = await findLocalThumbnailFile(slug, publicModelsDir);
            if (localFile) {
                res.set('Cache-Control', 'public, max-age=86400');
                return res.sendFile(localFile.filePath);
            }

            const cached = thumbnailCache.get(slug);
            if (cached && Date.now() - cached.fetchedAt < THUMBNAIL_CACHE_MS) {
                if (cached.imageUrl) {
                    return res.redirect(302, cached.imageUrl);
                }
                return res.status(404).end();
            }

            const config = readCults3dConfig();
            if (!config.configured) {
                return res.status(404).end();
            }

            const imageUrl = await fetchCreationThumbnail(config, slug);
            thumbnailCache.set(slug, {
                fetchedAt: Date.now(),
                imageUrl: imageUrl || ''
            });

            if (!imageUrl || !isAllowedRemoteImageUrl(imageUrl)) {
                return res.status(404).end();
            }

            return res.redirect(302, imageUrl);
        } catch (error) {
            console.warn(`Cults3D thumbnail lookup failed for ${slug}:`, error.message);
            return res.status(404).end();
        }
    });

    router.get('/image-proxy', async (req, res) => {
        const imageUrl = String(req.query.src || '').trim();
        if (!isAllowedRemoteImageUrl(imageUrl)) {
            return res.status(400).json({ error: 'Invalid image source' });
        }

        try {
            const upstream = await fetch(imageUrl, {
                headers: {
                    Accept: 'image/*',
                    'User-Agent': 'OkamiDesignsWebsite/1.0 (+https://okamidesigns.com)'
                }
            });

            if (!upstream.ok) {
                return res.status(upstream.status).end();
            }

            const contentType = upstream.headers.get('content-type') || 'image/jpeg';
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400');
            const buffer = Buffer.from(await upstream.arrayBuffer());
            return res.send(buffer);
        } catch (error) {
            console.warn('Cults3D image proxy failed:', error.message);
            return res.status(502).end();
        }
    });

    return router;
}

module.exports = createCults3dRouter;
