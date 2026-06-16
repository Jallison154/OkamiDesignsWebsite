'use strict';

const { TIERS } = require('../../shared/commercial/features');

const TIER_ALIASES = {
    free: 'free',
    standard: 'standard',
    pro: 'professional',
    professional: 'professional',
    enterprise: 'professional'
};

function normalizeTier(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }
    const key = value.trim().toLowerCase();
    const tier = TIER_ALIASES[key];
    return tier && TIERS[tier] ? tier : null;
}

/**
 * Map common upstream license API shapes to Okami tier + validity.
 */
function normalizeUpstreamResponse(body = {}) {
    const root = body.license && typeof body.license === 'object' ? body.license : body;
    const explicitValid = root.valid ?? root.isValid ?? body.valid ?? body.isValid;
    const status = String(root.status || body.status || '').toLowerCase();
    const activeStatuses = new Set(['active', 'valid', 'activated', 'success']);
    const inactiveStatuses = new Set(['inactive', 'expired', 'revoked', 'invalid', 'cancelled', 'canceled']);

    let valid;
    if (typeof explicitValid === 'boolean') {
        valid = explicitValid;
    } else if (status && activeStatuses.has(status)) {
        valid = true;
    } else if (status && inactiveStatuses.has(status)) {
        valid = false;
    } else if (body.success === true || root.success === true) {
        valid = true;
    } else if (body.success === false || root.success === false) {
        valid = false;
    } else {
        valid = false;
    }

    const tier = normalizeTier(
        root.tier
        || root.plan
        || root.productTier
        || body.tier
        || body.plan
        || (valid ? 'standard' : 'free')
    ) || (valid ? 'standard' : 'free');

    return {
        valid,
        tier: valid ? tier : 'free',
        source: 'license-upstream',
        message: root.message || body.message || null,
        expiresAt: root.expiresAt || root.expiry || body.expiresAt || null,
        customerId: root.customerId || body.customerId || null
    };
}

function buildVerifyUrl(config) {
    const base = (config.licenseServerUrl || '').replace(/\/+$/, '');
    const path = (config.licenseVerifyPath || '/verify').replace(/^\/?/, '/');
    return `${base}${path}`;
}

/**
 * Server-side upstream license verification — never call from the browser.
 */
async function verifyWithUpstream(config, payload = {}) {
    const licenseKey = payload.licenseKey || payload.key || '';
    const productId = payload.productId || null;
    const url = buildVerifyUrl(config);
    const timeoutMs = Number(config.licenseVerifyTimeoutMs) || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.licenseApiKey}`
            },
            body: JSON.stringify({
                licenseKey,
                key: licenseKey,
                productId,
                product: productId
            })
        });

        let body = {};
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            body = await response.json();
        } else {
            const text = await response.text();
            body = { message: text || `Upstream returned ${response.status}` };
        }

        if (!response.ok) {
            return {
                valid: false,
                tier: 'free',
                source: 'license-upstream-http-error',
                message: body.message || body.error || `License server responded with ${response.status}`
            };
        }

        const normalized = normalizeUpstreamResponse(body);
        return normalized;
    } catch (error) {
        const aborted = error.name === 'AbortError';
        return {
            valid: false,
            tier: 'free',
            source: aborted ? 'license-upstream-timeout' : 'license-upstream-error',
            message: aborted
                ? `License server timed out after ${timeoutMs}ms`
                : (error.message || 'License server request failed')
        };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    normalizeTier,
    normalizeUpstreamResponse,
    buildVerifyUrl,
    verifyWithUpstream
};
