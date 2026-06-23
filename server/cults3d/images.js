'use strict';

const fs = require('fs').promises;
const path = require('path');

const LOCAL_IMAGE_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png'];
const ALLOWED_REMOTE_IMAGE_HOSTS = new Set([
    'images.cults3d.com',
    'fbi.cults3d.com',
    'img.cults3d.com'
]);

function extractModelSlug(modelUrl) {
    if (!modelUrl) {
        return '';
    }
    const match = String(modelUrl).match(/\/3d-model\/[^/]+\/([^/?#]+)/i);
    return match ? match[1].trim() : '';
}

function isAllowedRemoteImageUrl(imageUrl) {
    try {
        const parsed = new URL(imageUrl);
        return parsed.protocol === 'https:' && ALLOWED_REMOTE_IMAGE_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
}

function normalizePublicAssetPath(assetPath) {
    const trimmed = String(assetPath || '').trim();
    if (!trimmed) {
        return '';
    }
    if (trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed.replace(/^\.?\//, '')}`;
}

async function findLocalThumbnailFile(slug, publicModelsDir) {
    if (!slug) {
        return null;
    }

    for (const extension of LOCAL_IMAGE_EXTENSIONS) {
        const fileName = `${slug}.${extension}`;
        const filePath = path.join(publicModelsDir, fileName);
        try {
            await fs.access(filePath);
            return {
                filePath,
                publicPath: `/public/3d-models/${fileName}`
            };
        } catch {
            // try next extension
        }
    }

    return null;
}

function pickRemoteImage(model = {}, fallbackModel = {}) {
    const candidates = [
        model.image,
        model.imageRemote,
        fallbackModel.image,
        fallbackModel.imageRemote
    ];

    for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (value && isAllowedRemoteImageUrl(value)) {
            return value;
        }
    }

    return '';
}

function buildImageProxyPath(imageUrl) {
    if (!isAllowedRemoteImageUrl(imageUrl)) {
        return '';
    }
    return `/api/cults3d/image-proxy?src=${encodeURIComponent(imageUrl)}`;
}

function buildThumbnailRoutePath(slug) {
    if (!slug) {
        return '';
    }
    return `/api/cults3d/thumbnail/${encodeURIComponent(slug)}`;
}

function resolveModelImageSources(model, options = {}) {
    const slug = options.slug || extractModelSlug(model.url);
    const fallbackModel = options.fallbackModel || {};
    const imageLocal = normalizePublicAssetPath(options.localPublicPath || '');
    const remoteImage = pickRemoteImage(model, fallbackModel);

    let image = '';
    if (imageLocal) {
        image = imageLocal;
    } else if (remoteImage) {
        image = buildImageProxyPath(remoteImage);
    } else if (slug) {
        image = buildThumbnailRoutePath(slug);
    }

    return {
        slug,
        image,
        imageLocal,
        imageRemote: remoteImage
    };
}

async function enrichModelImages(models, options = {}) {
    const publicModelsDir = options.publicModelsDir
        || path.join(__dirname, '..', '..', 'public', '3d-models');
    const projectRoot = options.projectRoot
        || path.join(__dirname, '..', '..');
    const fallbackModels = Array.isArray(options.fallbackModels) ? options.fallbackModels : [];
    const fallbackBySlug = new Map(
        fallbackModels
            .map((model) => [extractModelSlug(model.url), model])
            .filter(([slug]) => slug)
    );

    return Promise.all(models.map(async (model) => {
        const slug = extractModelSlug(model.url);
        const fallbackModel = fallbackBySlug.get(slug) || {};
        const localFile = await findLocalThumbnailFile(slug, publicModelsDir);
        let verifiedLocalPath = localFile?.publicPath || '';

        if (!verifiedLocalPath) {
            const configuredLocal = normalizePublicAssetPath(
                model.imageLocal || fallbackModel.imageLocal
            );
            if (configuredLocal) {
                const diskPath = path.join(projectRoot, configuredLocal.replace(/^\//, ''));
                try {
                    await fs.access(diskPath);
                    verifiedLocalPath = configuredLocal;
                } catch {
                    verifiedLocalPath = '';
                }
            }
        }

        const resolved = resolveModelImageSources(model, {
            slug,
            fallbackModel,
            localPublicPath: verifiedLocalPath
        });

        return {
            ...model,
            slug: resolved.slug,
            image: resolved.image,
            imageLocal: resolved.imageLocal || undefined,
            imageRemote: resolved.imageRemote || undefined
        };
    }));
}

module.exports = {
    ALLOWED_REMOTE_IMAGE_HOSTS,
    LOCAL_IMAGE_EXTENSIONS,
    extractModelSlug,
    isAllowedRemoteImageUrl,
    normalizePublicAssetPath,
    findLocalThumbnailFile,
    pickRemoteImage,
    buildImageProxyPath,
    buildThumbnailRoutePath,
    resolveModelImageSources,
    enrichModelImages
};
