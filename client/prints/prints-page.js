(function(global) {
    'use strict';

    const CULTS_PROFILE_URL = 'https://cults3d.com/en/users/OkamiDesigns/3d-models';
    const FALLBACK_JSON_URL = '/files/cults3d-models.json';
    const API_URL = '/api/cults3d/models';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getModelImageSrc(model) {
        return String(model?.image || model?.imageLocal || '').trim();
    }

    function showImagePlaceholder(imageWrap) {
        imageWrap.classList.add('prints-model-card-image-wrap--placeholder');
        imageWrap.replaceChildren();
        const label = document.createElement('span');
        label.className = 'prints-model-card-placeholder';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = '3D';
        imageWrap.appendChild(label);
    }

    function createModelCard(model) {
        const card = document.createElement('article');
        card.className = 'prints-model-card';

        const imageWrap = document.createElement('div');
        imageWrap.className = 'prints-model-card-image-wrap';

        const imageSrc = getModelImageSrc(model);
        if (imageSrc) {
            const image = document.createElement('img');
            image.className = 'prints-model-card-image';
            image.src = imageSrc;
            image.alt = model.title || '3D model preview';
            image.loading = 'lazy';
            image.decoding = 'async';
            image.referrerPolicy = 'no-referrer';
            image.addEventListener('error', () => {
                showImagePlaceholder(imageWrap);
            });
            imageWrap.appendChild(image);
        } else {
            showImagePlaceholder(imageWrap);
        }

        const body = document.createElement('div');
        body.className = 'prints-model-card-body';

        const priceLabel = model.free ? 'Free' : (model.priceLabel || 'View price');
        body.innerHTML = `
            <div class="prints-model-card-meta">
                <span class="prints-model-price${model.free ? ' prints-model-price--free' : ''}">${escapeHtml(priceLabel)}</span>
            </div>
            <h2 class="prints-model-card-title">${escapeHtml(model.title)}</h2>
            <p class="prints-model-card-desc">${escapeHtml(model.description || '')}</p>
            <a class="prints-model-card-btn" href="${escapeHtml(model.url)}" target="_blank" rel="noopener noreferrer">View Model</a>
        `;

        card.appendChild(imageWrap);
        card.appendChild(body);
        return card;
    }

    function renderModelsGrid(models, container) {
        container.replaceChildren();
        const fragment = document.createDocumentFragment();
        models.forEach((model) => {
            fragment.appendChild(createModelCard(model));
        });
        container.appendChild(fragment);
    }

    function renderLoadingSkeleton(container, count = 3) {
        container.replaceChildren();
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i += 1) {
            const skeleton = document.createElement('article');
            skeleton.className = 'prints-model-card prints-model-card--skeleton';
            skeleton.innerHTML = `
                <div class="prints-model-card-image-wrap prints-model-card-image-wrap--placeholder"></div>
                <div class="prints-model-card-body">
                    <div class="prints-skeleton-line prints-skeleton-line--short"></div>
                    <div class="prints-skeleton-line prints-skeleton-line--title"></div>
                    <div class="prints-skeleton-line"></div>
                    <div class="prints-skeleton-line"></div>
                    <div class="prints-skeleton-line prints-skeleton-line--btn"></div>
                </div>
            `;
            fragment.appendChild(skeleton);
        }
        container.appendChild(fragment);
    }

    function setVisible(element, visible) {
        if (!element) {
            return;
        }
        element.hidden = !visible;
    }

    async function fetchJson(url) {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`Request failed (${response.status})`);
        }
        return response.json();
    }

    async function loadModels() {
        try {
            return await fetchJson(API_URL);
        } catch (apiError) {
            try {
                const fallback = await fetchJson(FALLBACK_JSON_URL);
                return {
                    ...fallback,
                    source: 'fallback',
                    liveError: apiError.message
                };
            } catch (fallbackError) {
                throw new Error(`${apiError.message}; ${fallbackError.message}`);
            }
        }
    }

    async function initPrintsPage() {
        const grid = document.getElementById('prints-models-grid');
        const loading = document.getElementById('prints-models-loading');
        const errorPanel = document.getElementById('prints-models-error');
        const emptyPanel = document.getElementById('prints-models-empty');
        const sourceNote = document.getElementById('prints-models-source-note');

        if (!grid) {
            return;
        }

        setVisible(loading, false);
        setVisible(errorPanel, false);
        setVisible(emptyPanel, false);
        grid.setAttribute('aria-busy', 'true');
        renderLoadingSkeleton(grid, 2);

        try {
            const payload = await loadModels();
            const models = Array.isArray(payload?.models) ? payload.models : [];
            const profileUrl = payload?.profileUrl || CULTS_PROFILE_URL;

            setVisible(loading, false);

            if (!models.length) {
                grid.replaceChildren();
                grid.setAttribute('aria-busy', 'false');
                setVisible(emptyPanel, true);
                if (sourceNote) {
                    sourceNote.hidden = true;
                }
                return;
            }

            renderModelsGrid(models, grid);
            grid.setAttribute('aria-busy', 'false');

            if (sourceNote) {
                if (payload.source === 'cults3d') {
                    sourceNote.textContent = 'Live catalog from Cults3D.';
                    sourceNote.hidden = false;
                } else if (payload.liveError) {
                    sourceNote.textContent = 'Showing featured models while Cults3D sync is unavailable.';
                    sourceNote.hidden = false;
                } else {
                    sourceNote.textContent = 'Featured models from the Okami Designs Cults3D catalog.';
                    sourceNote.hidden = false;
                }
            }

            const errorLink = errorPanel?.querySelector('[data-cults-profile-link]');
            if (errorLink) {
                errorLink.href = profileUrl;
            }
        } catch (error) {
            console.warn('Failed to load 3D models:', error);
            setVisible(loading, false);
            grid.replaceChildren();
            grid.setAttribute('aria-busy', 'false');
            setVisible(errorPanel, true);
            if (sourceNote) {
                sourceNote.hidden = true;
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPrintsPage);
    } else {
        initPrintsPage();
    }

    global.OkamiPrintsPage = {
        createModelCard,
        renderModelsGrid,
        escapeHtml
    };
}(typeof window !== 'undefined' ? window : globalThis));
