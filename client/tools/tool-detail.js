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
        const baseIndex = parts.findIndex((part) => part === 'projects' || part === 'tools');
        if (baseIndex === -1 || !parts[baseIndex + 1]) {
            return '';
        }
        return parts[baseIndex + 1].toLowerCase();
    }

    function renderError(container, message) {
        container.innerHTML = `
            <div class="tool-detail-empty">
                <h1 class="tool-title">Project unavailable</h1>
                <p class="tool-subtitle">${escapeHtml(message)}</p>
                <a class="featured-tool-btn" href="/tools">Back to all projects</a>
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

        const statusLabels = { live: 'Live', beta: 'Beta', alpha: 'Alpha', 'coming-soon': 'Coming soon', archived: 'Archived' };
        const runtimeLabels = { online: 'Online', degraded: 'Degraded', offline: 'Offline' };
        const metaChips = [
            statusLabels[tool.status] ? `<span class="project-badge project-badge--${escapeHtml(tool.status)}">${statusLabels[tool.status]}</span>` : '',
            runtimeLabels[tool.runtimeStatus] ? `<span class="project-runtime project-runtime--${escapeHtml(tool.runtimeStatus)}">${runtimeLabels[tool.runtimeStatus]}</span>` : '',
            tool.version ? `<span class="project-version">${escapeHtml(/^\d/.test(tool.version) ? `v${tool.version}` : tool.version)}</span>` : ''
        ].join('');
        const tags = Array.isArray(tool.tags) && tool.tags.length
            ? `<ul class="project-tags" aria-label="Tags">${tool.tags.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
            : '';
        const repoLink = tool.repoUrl
            ? `<a class="tool-detail-support" href="${escapeHtml(tool.repoUrl)}" target="_blank" rel="noopener noreferrer">Source code</a>`
            : '';
        // bodyHtml is rendered server-side from the project's Markdown file (trusted, repo-authored).
        const body = tool.bodyHtml
            ? `<section class="tool-detail-long project-body">${tool.bodyHtml}</section>`
            : (tool.longDescription ? `<section class="tool-detail-long"><p>${escapeHtml(tool.longDescription)}</p></section>` : '');
        const isSelfLink = !tool.url || tool.url === window.location.pathname;

        const supportLink = tool.supportUrl
            ? `<a class="tool-detail-support" href="${escapeHtml(tool.supportUrl)}">Get support</a>`
            : '';

        container.innerHTML = `
            <header class="tool-detail-hero">
                <p class="tools-hub-card-meta"><span class="tools-hub-card-tag">${escapeHtml(tool.category || 'Tool')}</span>${metaChips}</p>
                <h1 class="tool-title">${escapeHtml(tool.title || 'Tool')}</h1>
                <p class="tool-subtitle">${escapeHtml(tool.shortDescription || '')}</p>
                ${tags}
                <div class="tool-detail-actions">
                    ${isSelfLink ? '' : `<a class="featured-tool-btn" href="${escapeHtml(actionHref)}"${actionTarget}>${escapeHtml(tool.buttonLabel || 'Open')}</a>`}
                    <a class="tool-detail-back" href="/tools">All projects</a>
                    ${repoLink}
                    ${supportLink}
                </div>
            </header>
            ${hero ? `<div class="tool-detail-media"><img src="${escapeHtml(hero)}" alt="" class="tool-detail-hero-image"></div>` : ''}
            ${featureList}
            ${body}
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
