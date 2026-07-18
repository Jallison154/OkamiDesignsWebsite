(function() {
    'use strict';

    const TAB_STORAGE_KEY = 'okami-admin-active-tab';
    const VALID_TABS = new Set(['overview', 'pages', 'tools', 'featured', 'files', 'analytics', 'settings']);

    function getHashTab() {
        const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
        return VALID_TABS.has(hash) ? hash : null;
    }

    function getStoredTab() {
        try {
            const value = sessionStorage.getItem(TAB_STORAGE_KEY);
            return VALID_TABS.has(value) ? value : null;
        } catch {
            return null;
        }
    }

    function setStoredTab(tab) {
        try {
            sessionStorage.setItem(TAB_STORAGE_KEY, tab);
        } catch {
            // ignore
        }
    }

    function activateTab(tabId, { updateHash = true } = {}) {
        const tab = VALID_TABS.has(tabId) ? tabId : 'overview';
        const select = document.getElementById('admin-tab-select');

        document.querySelectorAll('[data-admin-tab]').forEach((button) => {
            const active = button.dataset.adminTab === tab;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.tabIndex = active ? 0 : -1;
        });

        document.querySelectorAll('[data-admin-panel]').forEach((panel) => {
            const active = panel.dataset.adminPanel === tab;
            panel.hidden = !active;
            panel.classList.toggle('is-active', active);
        });

        if (select) {
            select.value = tab;
        }

        setStoredTab(tab);
        if (updateHash) {
            const nextHash = `#${tab}`;
            if (window.location.hash !== nextHash) {
                history.replaceState(null, '', nextHash);
            }
        }

        document.dispatchEvent(new CustomEvent('okami:admin-tab-changed', { detail: { tab } }));
    }

    function bindTabs() {
        document.querySelectorAll('[data-admin-tab]').forEach((button) => {
            button.addEventListener('click', () => activateTab(button.dataset.adminTab));
        });

        document.getElementById('admin-tab-select')?.addEventListener('change', (event) => {
            activateTab(event.target.value);
        });

        document.querySelectorAll('[data-goto-tab]').forEach((control) => {
            control.addEventListener('click', () => activateTab(control.dataset.gotoTab));
        });

        window.addEventListener('hashchange', () => {
            const tab = getHashTab();
            if (tab) {
                activateTab(tab, { updateHash: false });
            }
        });

        window.addEventListener('beforeunload', (event) => {
            if (window.OkamiAdminState?.hasUnsavedChanges?.()) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
    }

    async function refreshOverview() {
        const container = document.getElementById('admin-overview-stats');
        if (!container) {
            return;
        }

        try {
            const [settings, toolsData] = await Promise.all([
                typeof getSiteSettings === 'function' ? getSiteSettings() : Promise.resolve(null),
                typeof getManagedTools === 'function' ? getManagedTools() : Promise.resolve({ tools: [] })
            ]);

            const pages = settings?.pages || {};
            const pageEntries = Object.values(pages);
            const enabledPages = pageEntries.filter((entry) => {
                if (typeof entry === 'boolean') return entry;
                return entry?.visible !== false;
            }).length;

            const tools = Array.isArray(toolsData.tools) ? toolsData.tools : [];
            const published = tools.filter((tool) => tool.enabled !== false).length;
            const featured = tools.filter((tool) => tool.enabled !== false && tool.featured).length;
            const drafts = tools.filter((tool) => tool.enabled === false).length;
            const updatedAt = toolsData.updatedAt || settings?.updatedAt || null;

            container.innerHTML = `
                <article class="admin-stat-card"><p class="admin-stat-value">${enabledPages}</p><p class="admin-stat-label">Visible pages</p></article>
                <article class="admin-stat-card"><p class="admin-stat-value">${published}</p><p class="admin-stat-label">Published tools / projects</p></article>
                <article class="admin-stat-card"><p class="admin-stat-value">${featured}</p><p class="admin-stat-label">Featured on homepage</p></article>
                <article class="admin-stat-card"><p class="admin-stat-value">${drafts}</p><p class="admin-stat-label">Disabled / draft items</p></article>
                <article class="admin-stat-card admin-stat-card--wide">
                    <p class="admin-stat-label">Last catalog update</p>
                    <p class="admin-stat-value admin-stat-value--sm">${updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</p>
                </article>
            `;
        } catch (error) {
            container.innerHTML = `<p class="tools-hub-empty">Overview unavailable: ${String(error.message || error)}</p>`;
        }
    }

    function initAdminTabs() {
        bindTabs();
        const initial = getHashTab() || getStoredTab() || 'overview';
        activateTab(initial, { updateHash: true });
        refreshOverview();
    }

    window.OkamiAdminTabs = {
        activateTab,
        refreshOverview
    };

    document.addEventListener('DOMContentLoaded', () => {
        // Tabs bind after login too — showAdminPanel may run later
        const panel = document.getElementById('admin-panel');
        if (panel && panel.style.display !== 'none') {
            initAdminTabs();
        }
    });

    document.addEventListener('okami:admin-ready', () => {
        initAdminTabs();
        refreshOverview();
    });

    document.addEventListener('okami:admin-tab-changed', (event) => {
        if (event.detail?.tab === 'overview') {
            refreshOverview();
        }
        if (event.detail?.tab === 'featured' && typeof window.renderFeaturedAdminList === 'function') {
            window.renderFeaturedAdminList();
        }
    });
})();
