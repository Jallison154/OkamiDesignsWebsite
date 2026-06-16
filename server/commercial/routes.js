'use strict';

const express = require('express');
const publicConfig = require('../../shared/commercial/public-config');
const productVersion = require('../../shared/commercial/product-version');
const { FEATURES, TIERS } = require('../../shared/commercial/features');
const { readCommercialConfig } = require('./config');
const { getAccountProfile } = require('./accounts-service');
const { verifyLicense } = require('./licensing-service');
const { checkForUpdates, getPublicVersionInfo } = require('./version-service');
const { getEntitlements } = require('./entitlements-service');

const router = express.Router();

/** Public config safe for browsers and desktop shells (no secrets). */
router.get('/config', (req, res) => {
    res.json({
        companyName: publicConfig.companyName,
        supportEmail: publicConfig.supportEmail,
        legal: publicConfig.LEGAL_LINKS,
        products: publicConfig.PRODUCTS,
        features: FEATURES,
        tiers: Object.keys(TIERS),
        version: getPublicVersionInfo(),
        commercialEnabled: readCommercialConfig().commercialEnabled
    });
});

/** Entitlements for gating premium UI — validation stays on server. */
router.get('/entitlements', async (req, res) => {
    try {
        const entitlements = await getEntitlements(req, { productId: req.query.productId });
        res.json(entitlements);
    } catch (error) {
        console.error('Entitlements error:', error);
        res.status(500).json({ error: 'entitlements_unavailable' });
    }
});

router.post('/entitlements', async (req, res) => {
    try {
        const entitlements = await getEntitlements(req, {
            productId: req.body?.productId,
            licenseKey: req.body?.licenseKey
        });
        res.json(entitlements);
    } catch (error) {
        console.error('Entitlements error:', error);
        res.status(500).json({ error: 'entitlements_unavailable' });
    }
});

/** Account session placeholder. */
router.get('/account/session', async (req, res) => {
    try {
        const profile = await getAccountProfile(req);
        res.json(profile);
    } catch (error) {
        console.error('Account session error:', error);
        res.status(500).json({ error: 'account_unavailable' });
    }
});

/** Server-side license verification — keys must never be validated in frontend code. */
router.post('/license/verify', async (req, res) => {
    try {
        const result = await verifyLicense(req.body || {});
        res.json(result);
    } catch (error) {
        console.error('License verify error:', error);
        res.status(500).json({ error: 'license_verification_failed' });
    }
});

/** Version / update check for web and desktop builds. */
router.get('/version', async (req, res) => {
    try {
        const info = await checkForUpdates(req.query || {});
        res.json(info);
    } catch (error) {
        console.error('Version check error:', error);
        res.status(500).json({ error: 'version_check_failed' });
    }
});

module.exports = router;
