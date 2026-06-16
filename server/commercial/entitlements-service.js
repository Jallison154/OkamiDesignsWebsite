'use strict';

const publicConfig = require('../../shared/commercial/public-config');
const { FEATURES, TIERS } = require('../../shared/commercial/features');
const { getSession } = require('./accounts-service');
const { verifyLicense } = require('./licensing-service');
const { setLicenseCookie, clearLicenseCookie } = require('./session-service');

/**
 * Resolve entitlements server-side. Browser receives results only — never validation secrets.
 */
async function getEntitlements(req, options = {}, res = null) {
    const config = require('./config').readCommercialConfig();
    const session = await getSession(req);
    const productId = options.productId || req.query?.productId || req.body?.productId || null;

    if (!config.commercialEnabled) {
        const allFeatures = Object.values(FEATURES);
        return {
            productId,
            tier: 'professional',
            tierLabel: 'Development (all features)',
            features: allFeatures,
            featureMap: allFeatures.reduce((acc, key) => {
                acc[key] = true;
                return acc;
            }, {}),
            authenticated: session.authenticated,
            user: session.user,
            license: {
                valid: true,
                source: 'commercial-disabled',
                message: null
            },
            legal: publicConfig.LEGAL_LINKS
        };
    }

    const licenseKey = options.licenseKey || req.body?.licenseKey;
    let license;

    if (licenseKey) {
        license = await verifyLicense({ licenseKey, productId });
        if (license.valid && res) {
            setLicenseCookie(res, {
                tier: license.tier,
                productId,
                source: license.source
            });
        } else if (res) {
            clearLicenseCookie(res);
        }
    } else if (session.tier && session.source !== 'anonymous') {
        license = {
            valid: true,
            tier: session.tier,
            source: session.source
        };
    } else {
        license = {
            valid: false,
            tier: 'free',
            source: 'anonymous'
        };
    }

    const tier = license.valid ? (license.tier || 'free') : 'free';
    const tierDef = TIERS[tier] || TIERS.free;

    return {
        productId,
        tier,
        tierLabel: tierDef.label,
        features: tierDef.features,
        featureMap: tierDef.features.reduce((acc, key) => {
            acc[key] = true;
            return acc;
        }, {}),
        authenticated: session.authenticated,
        user: session.user,
        license: {
            valid: license.valid,
            source: license.source,
            message: license.message || null
        },
        legal: publicConfig.LEGAL_LINKS
    };
}

module.exports = {
    FEATURES,
    TIERS,
    getEntitlements
};
