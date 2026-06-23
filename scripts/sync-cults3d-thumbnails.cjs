'use strict';

const fs = require('fs').promises;
const path = require('path');
const { loadEnv } = require('../server/config/load-env');

loadEnv();

const { readCults3dConfig } = require('../server/cults3d/config');
const { getModelsListing, clearModelsCache } = require('../server/cults3d/service');
const { extractModelSlug, isAllowedRemoteImageUrl } = require('../server/cults3d/images');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_MODELS_DIR = path.join(PROJECT_ROOT, 'public', '3d-models');
const FALLBACK_PATH = path.join(PROJECT_ROOT, 'files', 'cults3d-models.json');

function extensionFromContentType(contentType = '') {
    const normalized = contentType.toLowerCase();
    if (normalized.includes('webp')) return 'webp';
    if (normalized.includes('png')) return 'png';
    if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
    return 'jpg';
}

async function downloadThumbnail(imageUrl, slug) {
    const response = await fetch(imageUrl, {
        headers: {
            Accept: 'image/*',
            'User-Agent': 'OkamiDesignsWebsite/1.0 (+https://okamidesigns.com)'
        }
    });

    if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
    }

    const extension = extensionFromContentType(response.headers.get('content-type') || '');
    const fileName = `${slug}.${extension}`;
    const filePath = path.join(PUBLIC_MODELS_DIR, fileName);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return `/public/3d-models/${fileName}`;
}

async function updateFallbackJson(models) {
    const raw = await fs.readFile(FALLBACK_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const bySlug = new Map(models.map((model) => [model.slug, model]));

    parsed.models = (parsed.models || []).map((model) => {
        const slug = extractModelSlug(model.url);
        const synced = bySlug.get(slug);
        if (!synced?.imageLocal) {
            return model;
        }

        return {
            ...model,
            imageLocal: synced.imageLocal,
            image: synced.imageRemote || model.image || ''
        };
    });

    await fs.writeFile(FALLBACK_PATH, `${JSON.stringify(parsed, null, 2)}\n`);
}

async function main() {
    const config = readCults3dConfig();
    if (!config.configured) {
        console.error('Cults3D sync requires CULTS3D_USERNAME and CULTS3D_API_KEY in .env');
        process.exit(1);
    }

    await fs.mkdir(PUBLIC_MODELS_DIR, { recursive: true });
    clearModelsCache();

    const listing = await getModelsListing({
        fallbackPath: FALLBACK_PATH,
        publicModelsDir: PUBLIC_MODELS_DIR,
        projectRoot: PROJECT_ROOT
    });

    const synced = [];

    for (const model of listing.models) {
        const slug = model.slug || extractModelSlug(model.url);
        const remoteImage = model.imageRemote || model.image;
        if (!slug || !remoteImage || !isAllowedRemoteImageUrl(remoteImage)) {
            console.warn(`Skipping ${model.title || slug}: no remote thumbnail URL`);
            continue;
        }

        try {
            const imageLocal = await downloadThumbnail(remoteImage, slug);
            synced.push({ slug, imageLocal, imageRemote: remoteImage });
            console.log(`Saved ${imageLocal}`);
        } catch (error) {
            console.warn(`Failed to download ${slug}: ${error.message}`);
        }
    }

    if (synced.length) {
        await updateFallbackJson(synced);
        console.log(`Updated ${FALLBACK_PATH}`);
    }

    console.log(`Done. ${synced.length} thumbnail(s) synced.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
