(function() {
    'use strict';

    const API_URL = '/api/tools';
    const FALLBACK_URL = '/files/tools.json';
    const catalogApi = window.OkamiShared?.ToolsCatalog;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isPageVisible(settings, pageKey) {
        if (!pageKey) {
            return true;
        }
        if (window.OkamiShared?.Settings?.isPageVisible) {
            return window.OkamiShared.Settings.isPageVisible(settings, pageKey);
        }
        const entry = settings?.pages?.[pageKey];
        if (entry == null) {
            return true;
        }
        if (typeof entry === 'boolean') {
            return entry !== false;
        }
        return entry.visible !== false;
    }

    function resolveHref(tool) {
        if (catalogApi?.resolveToolHref) {
            return catalogApi.resolveToolHref(tool);
        }
        if (tool.detailPageEnabled && tool.slug) {
            return `/tools/${tool.slug}`;
        }
        return tool.url || '#';
    }

    function createFallbackIcon(title) {
        const fallback = document.createElement('span');
        fallback.className = 'tools-hub-card-icon tools-hub-card-icon--fallback';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.textContent = String(title || 'T').trim().charAt(0).toUpperCase() || 'T';
        return fallback;
    }

    function resolveImageUrl(tool) {
        if (catalogApi?.resolveToolImageUrl) {
            return catalogApi.resolveToolImageUrl(tool);
        }
        if (tool.imageSource === 'placeholder') {
            return '';
        }
        if (tool.imageSource === 'website') {
            return tool.websiteLogoUrl || tool.iconUrl || '';
        }
        return tool.iconUrl || tool.websiteLogoUrl || '';
    }

    function createToolThumb(tool) {
        const thumb = document.createElement('span');
        thumb.className = 'tools-hub-card-thumb';
        const imageUrl = resolveImageUrl(tool);

        if (!imageUrl) {
            thumb.appendChild(createFallbackIcon(tool.title));
            return thumb;
        }

        const icon = document.createElement('img');
        icon.className = 'tools-hub-card-icon';
        icon.src = imageUrl;
        icon.alt = '';
        icon.width = 48;
        icon.height = 48;
        icon.loading = 'lazy';
        icon.decoding = 'async';
        let triedUploadFallback = false;
        icon.addEventListener('error', () => {
            // Graceful fallback: uploaded image → placeholder
            if (!triedUploadFallback && imageUrl !== tool.iconUrl && tool.iconUrl) {
                triedUploadFallback = true;
                icon.src = tool.iconUrl;
                return;
            }
            thumb.replaceChildren(createFallbackIcon(tool.title));
        });
        thumb.appendChild(icon);
        return thumb;
    }

    function createToolCard(tool) {
        const href = resolveHref(tool);
        const card = document.createElement('a');
        card.className = 'tools-hub-card';
        card.href = href;
        card.dataset.toolsCard = tool.pageKey || tool.id;
        card.dataset.toolId = tool.id;

        if (tool.featured) {
            card.classList.add('tools-hub-card--featured');
        }
        if (tool.accent && tool.accent !== 'default') {
            card.classList.add(`tools-hub-card--${tool.accent}`);
        }
        if (tool.openInNewTab) {
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
        }

        card.appendChild(createToolThumb(tool));

        const tag = document.createElement('span');
        tag.className = 'tools-hub-card-tag';
        tag.textContent = tool.category || 'Tool';
        card.appendChild(tag);

        const title = document.createElement('h2');
        title.className = 'tools-hub-card-title';
        title.textContent = tool.title || 'Untitled tool';
        card.appendChild(title);

        const desc = document.createElement('p');
        desc.className = 'tools-hub-card-desc';
        desc.textContent = tool.shortDescription || '';
        card.appendChild(desc);

        const action = document.createElement('span');
        action.className = 'tools-hub-card-action';
        action.textContent = tool.buttonLabel || 'Open tool →';
        card.appendChild(action);

        return card;
    }

    function renderEmpty(container) {
        container.innerHTML = `
            <p class="tools-hub-empty">No tools are published yet. Check back soon.</p>
        `;
    }

    function renderTools(tools, container) {
        container.replaceChildren();
        if (!tools.length) {
            renderEmpty(container);
            return;
        }
        const fragment = document.createDocumentFragment();
        tools.forEach((tool) => {
            fragment.appendChild(createToolCard(tool));
        });
        container.appendChild(fragment);
        document.dispatchEvent(new CustomEvent('okami:tools-hub-rendered'));
    }

    async function fetchTools() {
        try {
            const response = await fetch(API_URL, { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                return Array.isArray(data.tools) ? data.tools : [];
            }
        } catch (error) {
            console.warn('Tools API unavailable, trying fallback JSON.', error);
        }

        const fallback = await fetch(FALLBACK_URL, { cache: 'no-store' });
        if (!fallback.ok) {
            throw new Error('Failed to load tools catalog');
        }
        const data = await fallback.json();
        const tools = Array.isArray(data.tools) ? data.tools : [];
        return tools.filter((tool) => tool.enabled !== false);
    }

    async function loadSiteSettings() {
        try {
            const response = await fetch('/api/site-settings', { cache: 'no-store' });
            if (response.ok) {
                return await response.json();
            }
        } catch {
            // ignore
        }
        return null;
    }

    async function initToolsHub() {
        const container = document.getElementById('tools-hub-grid');
        if (!container) {
            return;
        }

        container.setAttribute('aria-busy', 'true');
        try {
            const [tools, settings] = await Promise.all([fetchTools(), loadSiteSettings()]);
            const visibleTools = tools.filter((tool) => isPageVisible(settings, tool.pageKey));
            const sorted = catalogApi?.sortTools
                ? catalogApi.sortTools(visibleTools)
                : visibleTools.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
            renderTools(sorted, container);
        } catch (error) {
            console.error('Failed to render tools hub:', error);
            container.innerHTML = `<p class="tools-hub-empty">${escapeHtml('Tools are temporarily unavailable.')}</p>`;
        } finally {
            container.setAttribute('aria-busy', 'false');
        }
    }

    window.initToolsHub = initToolsHub;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToolsHub);
    } else {
        initToolsHub();
    }
})();
