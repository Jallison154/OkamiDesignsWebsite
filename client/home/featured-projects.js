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

    function resolveImageUrl(tool) {
        if (catalogApi?.resolveToolImageUrl) {
            return catalogApi.resolveToolImageUrl(tool);
        }
        return tool.websiteLogoUrl || tool.iconUrl || '';
    }

    function resolveHref(tool) {
        if (catalogApi?.resolveToolHref) {
            return catalogApi.resolveToolHref(tool);
        }
        return tool.url || '#';
    }

    function createCard(tool) {
        const article = document.createElement('article');
        article.className = 'featured-tool-card';
        if (tool.contentType === 'prints') {
            article.classList.add('featured-tool-card--prints');
        }
        if (tool.pageKey) {
            article.dataset.toolsCard = tool.pageKey;
        }
        article.dataset.toolId = tool.id;

        const imageUrl = resolveImageUrl(tool);
        const thumbHtml = imageUrl
            ? `<div class="featured-tool-thumb"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async"></div>`
            : `<div class="featured-tool-thumb featured-tool-thumb--fallback" aria-hidden="true">${escapeHtml((tool.title || 'P').charAt(0).toUpperCase())}</div>`;

        const href = resolveHref(tool);
        const target = tool.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';

        article.innerHTML = `
            ${thumbHtml}
            <span class="featured-tool-tag">${escapeHtml(tool.category || tool.contentType || 'Project')}</span>
            <h3 class="featured-tool-name">${escapeHtml(tool.title || 'Untitled')}</h3>
            <p class="featured-tool-desc">${escapeHtml(tool.shortDescription || '')}</p>
            <a href="${escapeHtml(href)}" class="featured-tool-btn"${target}>${escapeHtml(tool.buttonLabel || 'Open')}</a>
        `;

        const img = article.querySelector('img');
        if (img) {
            img.addEventListener('error', () => {
                const wrap = article.querySelector('.featured-tool-thumb');
                if (!wrap) return;
                wrap.className = 'featured-tool-thumb featured-tool-thumb--fallback';
                wrap.textContent = (tool.title || 'P').charAt(0).toUpperCase();
            });
        }

        return article;
    }

    async function fetchProjects() {
        try {
            const response = await fetch(API_URL, { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                const tools = Array.isArray(data.tools) ? data.tools : [];
                return catalogApi?.getHomepageProjects
                    ? catalogApi.getHomepageProjects({ tools })
                    : tools.filter((tool) => tool.enabled !== false && tool.featured);
            }
        } catch (error) {
            console.warn('Featured projects API unavailable, trying fallback.', error);
        }

        const fallback = await fetch(FALLBACK_URL, { cache: 'no-store' });
        if (!fallback.ok) {
            throw new Error('Failed to load featured projects');
        }
        const data = await fallback.json();
        const tools = Array.isArray(data.tools) ? data.tools : [];
        return catalogApi?.getHomepageProjects
            ? catalogApi.getHomepageProjects({ tools })
            : tools.filter((tool) => tool.enabled !== false && tool.featured);
    }

    async function initFeaturedProjects() {
        const grid = document.getElementById('featured-projects-grid');
        if (!grid) return;

        grid.setAttribute('aria-busy', 'true');
        try {
            const projects = await fetchProjects();
            grid.replaceChildren();
            if (!projects.length) {
                grid.innerHTML = '<p class="tools-hub-empty">Featured projects will appear here soon.</p>';
                return;
            }
            const fragment = document.createDocumentFragment();
            projects.forEach((project) => fragment.appendChild(createCard(project)));
            grid.appendChild(fragment);
            document.dispatchEvent(new CustomEvent('okami:featured-projects-rendered'));
        } catch (error) {
            console.error(error);
            grid.innerHTML = '<p class="tools-hub-empty">Featured projects are temporarily unavailable.</p>';
        } finally {
            grid.setAttribute('aria-busy', 'false');
        }
    }

    window.initFeaturedProjects = initFeaturedProjects;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFeaturedProjects);
    } else {
        initFeaturedProjects();
    }
})();
