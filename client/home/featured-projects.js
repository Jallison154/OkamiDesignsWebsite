(function() {
    'use strict';

    const API_URL = '/api/tools';
    const FALLBACK_URL = '/files/tools.json';
    const SETTINGS_URL = '/api/site-settings';
    const SETTINGS_FALLBACK_URL = '/files/site-settings.json';
    const catalogApi = window.OkamiShared?.ToolsCatalog;
    const settingsApi = window.OkamiShared?.Settings;

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
        if (settingsApi?.isPageVisible) {
            return settingsApi.isPageVisible(settings, pageKey);
        }
        const entry = settings?.pages?.[pageKey];
        if (entry == null) {
            return true;
        }
        if (typeof entry === 'boolean') {
            return entry;
        }
        return entry.visible !== false;
    }

    async function fetchSiteSettings() {
        try {
            const response = await fetch(SETTINGS_URL, { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                return settingsApi?.mergeSettings ? settingsApi.mergeSettings(data) : data;
            }
        } catch (error) {
            console.warn('[Featured Projects] site settings API unavailable', error);
        }
        try {
            const fallback = await fetch(SETTINGS_FALLBACK_URL, { cache: 'no-store' });
            if (fallback.ok) {
                const data = await fallback.json();
                return settingsApi?.mergeSettings ? settingsApi.mergeSettings(data) : data;
            }
        } catch (error) {
            console.warn('[Featured Projects] site settings fallback unavailable', error);
        }
        return settingsApi?.DEFAULT_SITE_SETTINGS || { pages: {} };
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
            const [projects, settings] = await Promise.all([fetchProjects(), fetchSiteSettings()]);
            const visibleProjects = projects.filter((project) => {
                if (!project.pageKey) {
                    return true;
                }
                return isPageVisible(settings, project.pageKey);
            });
            grid.replaceChildren();
            if (!visibleProjects.length) {
                grid.innerHTML = '<p class="tools-hub-empty">Featured projects will appear here soon.</p>';
                document.dispatchEvent(new CustomEvent('okami:featured-projects-rendered', {
                    detail: { count: 0 }
                }));
                return;
            }
            const fragment = document.createDocumentFragment();
            visibleProjects.forEach((project) => fragment.appendChild(createCard(project)));
            grid.appendChild(fragment);
            console.info('[Featured Projects] rendered', {
                count: visibleProjects.length,
                ids: visibleProjects.map((project) => project.id)
            });
            document.dispatchEvent(new CustomEvent('okami:featured-projects-rendered', {
                detail: { count: visibleProjects.length }
            }));
        } catch (error) {
            console.error('[Featured Projects] render failed', error);
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
