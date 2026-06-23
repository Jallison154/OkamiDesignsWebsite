'use strict';

const fs = require('fs').promises;
const path = require('path');
const { readCults3dConfig, DEFAULT_PROFILE_URL } = require('./config');
const {
    enrichModelImages,
    extractModelSlug
} = require('./images');

const CREATIONS_QUERY = `
query OkamiCreations($nick: String!, $limit: Int!) {
  user(nick: $nick) {
    nick
    shortUrl
    creations(limit: $limit) {
      name(locale: EN)
      url(locale: EN)
      shortUrl
      illustrationImageUrl(version: DEFAULT)
      illustrations {
        imageUrl(version: DEFAULT)
      }
      description(locale: EN)
      price(currency: USD) {
        value
        currency
      }
    }
  }
}
`;

const CREATION_THUMBNAIL_QUERY = `
query CreationThumbnail($slug: String!) {
  creation(slug: $slug) {
    illustrationImageUrl(version: DEFAULT)
    illustrations {
      imageUrl(version: DEFAULT)
    }
  }
}
`;

let cache = {
    key: '',
    fetchedAt: 0,
    payload: null
};

function stripHtml(value) {
    if (!value) {
        return '';
    }
    return String(value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncateText(value, maxLength = 180) {
    const text = stripHtml(value);
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 1).trim()}…`;
}

function formatPrice(price) {
    if (!price || price.value == null || Number(price.value) <= 0) {
        return { priceLabel: 'Free', free: true };
    }

    const currency = price.currency || 'USD';
    try {
        return {
            priceLabel: new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency
            }).format(Number(price.value)),
            free: false
        };
    } catch {
        return {
            priceLabel: `$${Number(price.value).toFixed(2)}`,
            free: false
        };
    }
}

function pickCreationImage(creation) {
    const primary = (creation?.illustrationImageUrl || '').trim();
    if (primary) {
        return primary;
    }

    const illustrations = Array.isArray(creation?.illustrations) ? creation.illustrations : [];
    for (const illustration of illustrations) {
        const imageUrl = (illustration?.imageUrl || '').trim();
        if (imageUrl) {
            return imageUrl;
        }
    }

    return '';
}

function normalizeCreation(creation) {
    if (!creation) {
        return null;
    }

    const title = (creation.name || '').trim();
    const url = (creation.url || '').trim();
    if (!title || !url) {
        return null;
    }

    const description = truncateText(creation.description || '');
    const pricing = formatPrice(creation.price);
    const slug = extractModelSlug(url);
    const imageRemote = pickCreationImage(creation);

    return {
        title,
        description,
        slug,
        image: imageRemote,
        imageRemote: imageRemote || undefined,
        priceLabel: pricing.priceLabel,
        free: pricing.free,
        url
    };
}

async function readFallbackModels(fallbackPath) {
    try {
        const raw = await fs.readFile(fallbackPath, 'utf8');
        const parsed = JSON.parse(raw);
        const models = Array.isArray(parsed?.models)
            ? parsed.models.filter((model) => model?.title && model?.url)
            : [];

        return {
            source: 'fallback',
            profileUrl: parsed?.profileUrl || DEFAULT_PROFILE_URL,
            models,
            error: null
        };
    } catch (error) {
        return {
            source: 'fallback',
            profileUrl: DEFAULT_PROFILE_URL,
            models: [],
            error: error.message || 'Failed to read fallback models'
        };
    }
}

async function fetchCreationThumbnail(config, slug) {
    if (!config.configured || !slug) {
        return '';
    }

    const auth = Buffer.from(`${config.username}:${config.apiKey}`).toString('base64');
    const response = await fetch(config.graphqlUrl, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({
            query: CREATION_THUMBNAIL_QUERY,
            variables: { slug }
        })
    });

    if (!response.ok) {
        throw new Error(`Cults3D thumbnail lookup failed with ${response.status}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload?.errors) && payload.errors.length) {
        throw new Error(payload.errors.map((entry) => entry.message).join('; '));
    }

    return pickCreationImage(payload?.data?.creation);
}

async function fetchCults3dCreations(config) {
    const auth = Buffer.from(`${config.username}:${config.apiKey}`).toString('base64');
    const response = await fetch(config.graphqlUrl, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({
            query: CREATIONS_QUERY,
            variables: {
                nick: config.userNick,
                limit: config.modelLimit
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Cults3D API responded with ${response.status}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload?.errors) && payload.errors.length) {
        throw new Error(payload.errors.map((entry) => entry.message).join('; '));
    }

    const creations = payload?.data?.user?.creations;
    if (!Array.isArray(creations)) {
        throw new Error('Cults3D API returned an unexpected payload');
    }

    const models = creations
        .map(normalizeCreation)
        .filter(Boolean);

    if (!models.length) {
        throw new Error('Cults3D API returned no public models');
    }

    return {
        source: 'cults3d',
        profileUrl: config.profileUrl,
        models,
        error: null
    };
}

async function finalizeListing(listing, options = {}) {
    const fallbackPath = options.fallbackPath
        || path.join(__dirname, '..', '..', 'files', 'cults3d-models.json');
    let fallbackModels = [];

    try {
        const raw = await fs.readFile(fallbackPath, 'utf8');
        const parsed = JSON.parse(raw);
        fallbackModels = Array.isArray(parsed?.models) ? parsed.models : [];
    } catch {
        fallbackModels = [];
    }

    const models = await enrichModelImages(listing.models || [], {
        publicModelsDir: options.publicModelsDir,
        projectRoot: options.projectRoot,
        fallbackModels
    });

    return {
        ...listing,
        models
    };
}

async function getModelsListing(options = {}) {
    const fallbackPath = options.fallbackPath
        || path.join(__dirname, '..', '..', 'files', 'cults3d-models.json');
    const config = readCults3dConfig();
    const cacheKey = `${config.userNick}:${config.modelLimit}:${config.configured ? 'live' : 'fallback'}`;

    if (
        cache.payload
        && cache.key === cacheKey
        && Date.now() - cache.fetchedAt < config.cacheMs
    ) {
        return cache.payload;
    }

    let listing;

    if (config.configured) {
        try {
            const live = await fetchCults3dCreations(config);
            listing = await finalizeListing(live, options);
            cache = { key: cacheKey, fetchedAt: Date.now(), payload: listing };
            return listing;
        } catch (error) {
            console.warn('Cults3D live fetch failed, using fallback models:', error.message);
            const fallback = await readFallbackModels(fallbackPath);
            fallback.liveError = error.message;
            listing = await finalizeListing(fallback, options);
            cache = { key: cacheKey, fetchedAt: Date.now(), payload: listing };
            return listing;
        }
    }

    listing = await readFallbackModels(fallbackPath);
    listing = await finalizeListing(listing, options);
    cache = { key: cacheKey, fetchedAt: Date.now(), payload: listing };
    return listing;
}

function clearModelsCache() {
    cache = { key: '', fetchedAt: 0, payload: null };
}

module.exports = {
    getModelsListing,
    fetchCreationThumbnail,
    clearModelsCache,
    normalizeCreation,
    pickCreationImage,
    stripHtml,
    truncateText,
    formatPrice
};
