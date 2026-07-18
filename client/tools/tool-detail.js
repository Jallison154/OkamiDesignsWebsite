(function() {
    'use strict';

    const catalogApi = window.OkamiShared?.ToolsCatalog;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getSlugFromPath() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const toolsIndex = parts.indexOf('tools');
        if (toolsIndex === -1 || !parts[toolsIndex + 1]) {
            return '';
        }
        return parts[toolsIndex + 1].toLowerCase();
    }

    function renderError(container, message) {
        container.innerHTML = `
            <div class="tool-detail-empty">
                <h1 class="tool-title">Tool unavailable</h1>
                <p class="tool-subtitle">${escapeHtml(message)}</p>
                <a class="featured-tool-btn" href="/tools">Back to Tools</a>
            </div>
        `;
    }

    function renderTool(container, tool) {
        const actionHref = tool.url || '/tools';
        const actionTarget = tool.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
        const features = Array.isArray(tool.features) ? tool.features : [];
        const screenshots = Array.isArray(tool.screenshots) ? tool.screenshots : [];
        const hero = tool.heroImageUrl || tool.iconUrl || '';

        const featureList = features.length
            ? `<ul class="tool-detail-features">${features.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
            : '';

        const screenshotBlock = screenshots.length
            ? `<section class="tool-detail-screenshots" aria-label="Screenshots">
                ${screenshots.map((src) => `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">`).join('')}
               </section>`
            : '';

        const supportLink = tool.supportUrl
            ? `<a class="tool-detail-support" href="${escapeHtml(tool.supportUrl)}">Get support</a>`
            : '';

        container.innerHTML = `
            <header class="tool-detail-hero">
                <p class="tools-hub-card-tag">${escapeHtml(tool.category || 'Tool')}</p>
                <h1 class="tool-title">${escapeHtml(tool.title || 'Tool')}</h1>
                <p class="tool-subtitle">${escapeHtml(tool.shortDescription || '')}</p>
                <div class="tool-detail-actions">
                    <a class="featured-tool-btn" href="${escapeHtml(actionHref)}"${actionTarget}>${escapeHtml(tool.buttonLabel || 'Open')}</a>
                    <a class="tool-detail-back" href="/tools">All Tools</a>
                    ${supportLink}
                </div>
            </header>
            ${hero ? `<div class="tool-detail-media"><img src="${escapeHtml(hero)}" alt="" class="tool-detail-hero-image"></div>` : ''}
            ${tool.longDescription ? `<section class="tool-detail-long"><p>${escapeHtml(tool.longDescription)}</p></section>` : ''}
            ${featureList}
            ${screenshotBlock}
        `;

        document.title = `${tool.title || 'Tool'} | Okami Designs`;
        const description = document.querySelector('meta[name="description"]');
        if (description && tool.shortDescription) {
            description.setAttribute('content', tool.shortDescription);
        }
    }

    async function initToolDetail() {
        const container = document.getElementById('tool-detail-root');
        if (!container) {
            return;
        }

        const slug = getSlugFromPath();
        if (!slug || catalogApi?.isReservedAppSlug?.(slug)) {
            renderError(container, 'This tool page could not be found.');
            return;
        }

        try {
            const response = await fetch(`/api/tools/by-slug/${encodeURIComponent(slug)}`, { cache: 'no-store' });
            if (!response.ok) {
                renderError(container, 'This tool is not published or does not have a detail page.');
                return;
            }
            const data = await response.json();
            if (!data.tool) {
                renderError(container, 'This tool could not be found.');
                return;
            }
            renderTool(container, data.tool);
        } catch (error) {
            console.error('Tool detail load failed:', error);
            renderError(container, 'Unable to load this tool right now.');
        }
    }

    window.initToolDetail = initToolDetail;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToolDetail);
    } else {
        initToolDetail();
    }
})();
