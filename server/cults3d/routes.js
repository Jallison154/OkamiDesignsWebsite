'use strict';

const express = require('express');
const path = require('path');
const { getModelsListing } = require('./service');
const { readCults3dConfig } = require('./config');

function createCults3dRouter(options = {}) {
    const router = express.Router();
    const fallbackPath = options.fallbackPath
        || path.join(__dirname, '..', '..', 'files', 'cults3d-models.json');

    router.get('/models', async (_req, res) => {
        try {
            const listing = await getModelsListing({ fallbackPath });
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

    return router;
}

module.exports = createCults3dRouter;
