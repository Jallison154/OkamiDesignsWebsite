// Admin authentication and file management
(function() {
    'use strict';

    let sessionTimeoutInterval = null;
    let selectedLogo = null;
    let selectedFile = null;
    let manualNameInput = null;
    let manualLinkInput = null;
    let manualLinkDirty = false;
    let currentFiles = [];
    let modalElements = {};
    let modalResolve = null;
    
    // IndexedDB database setup
    let db = null;
    const DB_NAME = 'OkamiDesignsDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'uploadedFiles';
    
    function slugify(value) {
        if (!value) return '';
        return value
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 120);
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return value
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const TOAST_DURATION = 5000;
    const SITE_SETTINGS_STORAGE_KEY = 'okami-site-settings';
    let lastLoadedSettingsSource = 'config';
    let lastLoadedSettingsUpdatedAt = null;
    let apiConnectionStatus = 'disconnected';

    function getSettingsApi() {
        return window.OkamiShared?.Settings || null;
    }

    function getDefaultSiteSettings() {
        const api = getSettingsApi();
        if (api?.DEFAULT_SITE_SETTINGS) {
            return api.DEFAULT_SITE_SETTINGS;
        }
        return {
            constructionMode: false,
            pages: {
                home: { visible: true, navOrder: 1 },
                tools: { visible: true, navOrder: 2 },
                prints: { visible: true, navOrder: 3 },
                support: { visible: true, navOrder: 4 },
                contact: { visible: true, navOrder: 5 },
                donate: { visible: true, navOrder: 6 },
                services: { visible: true, navOrder: 7 },
                ledVideoWallCalculator: { visible: true, navOrder: 8 },
                okamiSignalLab: { visible: true, navOrder: 9 }
            }
        };
    }

    function normalizeSiteSettings(raw) {
        const api = getSettingsApi();
        if (api?.mergeSettings) {
            return api.mergeSettings(raw);
        }

        return getDefaultSiteSettings();
    }

    function isPageVisible(settings, pageKey) {
        const api = getSettingsApi();
        if (api?.isPageVisible) {
            return api.isPageVisible(settings, pageKey);
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

    function formatNavItemPath(item) {
        const registry = getRegistryApi();
        if (registry?.formatNavItemPath) {
            return registry.formatNavItemPath(item);
        }
        if (item?.external) {
            return item.url;
        }
        return item?.url || '/';
    }

    function getRegistryApi() {
        return window.OkamiShared?.Registry || window.OkamiPageRegistry || null;
    }

    function getAdminNavItems(settings) {
        const registry = getRegistryApi();
        const registryItems = registry?.getAdminNavItems?.();
        if (!registryItems?.length) {
            return [];
        }

        const api = getSettingsApi();
        const keys = registryItems.map((item) => item.key);
        const sortedKeys = api?.getAdminItemKeysSorted
            ? api.getAdminItemKeysSorted(settings, keys)
            : keys;

        const itemsByKey = Object.fromEntries(registryItems.map((item) => [item.key, item]));
        return sortedKeys.map((key) => itemsByKey[key]).filter(Boolean);
    }

    function buildVisibilityPageRow(item, settings, orderNumber) {
        const pathLabel = formatNavItemPath(item);
        const isVisible = isPageVisible(settings, item.key);
        const pathHint = item.external ? 'External link' : 'Site page';

        return `
            <div class="visibility-page-row" data-page-key="${escapeHtml(item.key)}">
                <div class="visibility-page-order" aria-label="Reorder page">
                    <span class="visibility-page-order-num" aria-label="Order">${orderNumber}</span>
                    <button type="button" class="visibility-order-btn visibility-order-up" data-page-key="${escapeHtml(item.key)}" aria-label="Move ${escapeHtml(item.title)} up">↑</button>
                    <button type="button" class="visibility-order-btn visibility-order-down" data-page-key="${escapeHtml(item.key)}" aria-label="Move ${escapeHtml(item.title)} down">↓</button>
                </div>
                <div class="visibility-page-info">
                    <span class="visibility-page-name">${escapeHtml(item.title)}</span>
                    <span class="visibility-page-path">${escapeHtml(pathLabel)}</span>
                    <span class="visibility-page-kind">${escapeHtml(pathHint)}</span>
                </div>
                <label class="visibility-switch">
                    <input type="checkbox" class="visibility-page-toggle" data-page-key="${escapeHtml(item.key)}"${isVisible ? ' checked' : ''}>
                    <span class="visibility-switch-slider" aria-hidden="true"></span>
                    <span class="visibility-switch-text">Visible</span>
                </label>
            </div>
        `;
    }

    function updateVisibilityOrderButtonState(container) {
        const rows = [...container.querySelectorAll('.visibility-page-row')];
        rows.forEach((row, index) => {
            const orderNum = row.querySelector('.visibility-page-order-num');
            if (orderNum) {
                orderNum.textContent = String(index + 1);
            }

            const upButton = row.querySelector('.visibility-order-up');
            const downButton = row.querySelector('.visibility-order-down');
            if (upButton) {
                upButton.disabled = index === 0;
            }
            if (downButton) {
                downButton.disabled = index === rows.length - 1;
            }
        });
    }

    function moveVisibilityPageRow(pageKey, direction) {
        const container = document.getElementById('visibility-page-list');
        if (!container) {
            return;
        }

        const rows = [...container.querySelectorAll('.visibility-page-row')];
        const index = rows.findIndex((row) => row.dataset.pageKey === pageKey);
        const targetIndex = index + direction;

        if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) {
            return;
        }

        const row = rows[index];
        const target = rows[targetIndex];

        if (direction < 0) {
            container.insertBefore(row, target);
        } else {
            container.insertBefore(row, target.nextSibling);
        }

        updateVisibilityOrderButtonState(container);
    }

    function bindVisibilityOrderButtons(container) {
        if (!container || document.body.dataset.visibilityOrderBound === 'true') {
            return;
        }

        document.addEventListener('click', (event) => {
            const list = document.getElementById('visibility-page-list');
            if (!list || !list.contains(event.target)) {
                return;
            }

            const upButton = event.target.closest('.visibility-order-up');
            if (upButton?.dataset.pageKey) {
                moveVisibilityPageRow(upButton.dataset.pageKey, -1);
                return;
            }

            const downButton = event.target.closest('.visibility-order-down');
            if (downButton?.dataset.pageKey) {
                moveVisibilityPageRow(downButton.dataset.pageKey, 1);
            }
        });

        document.body.dataset.visibilityOrderBound = 'true';
    }

    function renderVisibilityPageList(settings = getDefaultSiteSettings()) {
        const container = document.getElementById('visibility-page-list');
        if (!container) {
            return;
        }

        const normalized = normalizeSiteSettings(settings);
        const items = getAdminNavItems(normalized);
        if (!items.length) {
            container.innerHTML = '<p class="visibility-page-list-error">Navigation registry failed to load. Ensure shared/registry/pages.js is included before admin.js.</p>';
            return;
        }

        container.innerHTML = items
            .map((item, index) => buildVisibilityPageRow(item, normalized, index + 1))
            .join('');

        bindVisibilityOrderButtons(container);
        updateVisibilityOrderButtonState(container);
        container.dataset.rendered = 'true';
    }

    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('is-visible');
        });

        setTimeout(() => {
            toast.classList.remove('is-visible');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            }, { once: true });
        }, TOAST_DURATION);
    }

    function initModalElements() {
        modalElements = {
            container: document.getElementById('modal-container'),
            backdrop: document.querySelector('#modal-container .modal-backdrop'),
            card: document.querySelector('#modal-container .modal-card'),
            title: document.getElementById('modal-title'),
            body: document.getElementById('modal-body'),
            actions: document.getElementById('modal-actions'),
            close: document.getElementById('modal-close')
        };

        if (!modalElements.container) {
            return;
        }

        const closeHandler = () => closeModal(null);

        modalElements.backdrop?.addEventListener('click', closeHandler);
        modalElements.close?.addEventListener('click', closeHandler);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modalElements.container?.classList.contains('is-active')) {
                closeModal(null);
            }
        });
    }

    function openModal({ title = 'Notice', content = '', actions = [] }) {
        if (!modalElements.container) {
            return Promise.resolve(null);
        }

        modalElements.title.textContent = title;
        modalElements.body.innerHTML = '';

        if (typeof content === 'string') {
            modalElements.body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            modalElements.body.appendChild(content);
        }

        modalElements.actions.innerHTML = '';

        const resolvedActions = actions.length ? actions : [{ label: 'OK', value: true, variant: 'primary' }];

        return new Promise((resolve) => {
            modalResolve = resolve;

            resolvedActions.forEach((action) => {
                const button = document.createElement('button');
                button.type = action.type || 'button';
                button.className = `modal-button ${action.variant ? `modal-button-${action.variant}` : 'modal-button-primary'}`;
                button.textContent = action.label || 'OK';

                if (typeof action.handler === 'function') {
                    button.addEventListener('click', (event) => {
                        action.handler(event, closeModal);
                    });
                } else {
                    button.addEventListener('click', () => closeModal(action.value));
                }

                modalElements.actions.appendChild(button);
            });

            modalElements.container.classList.add('is-active');
            modalElements.container.setAttribute('aria-hidden', 'false');
            modalElements.card?.focus?.();
        });
    }

    function closeModal(result) {
        if (!modalElements.container) {
            return;
        }

        modalElements.container.classList.remove('is-active');
        modalElements.container.setAttribute('aria-hidden', 'true');

        if (modalResolve) {
            const resolver = modalResolve;
            modalResolve = null;
            resolver(result);
        }
    }

    function showAlert(message, title = 'Notice') {
        return openModal({
            title,
            content: `<p class="modal-message">${escapeHtml(message)}</p>`
        });
    }

    function showConfirmModal(message, options = {}) {
        const { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel', confirmVariant = 'primary' } = options;

        return openModal({
            title,
            content: `<p class="modal-message">${escapeHtml(message)}</p>`,
            actions: [
                { label: cancelText, value: false, variant: 'secondary' },
                { label: confirmText, value: true, variant: confirmVariant }
            ]
        });
    }

    async function openMetadataModal({ title = 'Manual Details', displayName = '', slug = '' }) {
        return new Promise((resolve) => {
            const form = document.createElement('form');
            form.className = 'modal-form';
            form.innerHTML = `
                <div class="modal-field">
                    <label for="modal-manual-name">Manual Display Name</label>
                    <input id="modal-manual-name" type="text" maxlength="120" value="${escapeHtml(displayName)}" required>
                </div>
                <div class="modal-field">
                    <label for="modal-manual-slug">Manual Link Name</label>
                    <input id="modal-manual-slug" type="text" maxlength="120" value="${escapeHtml(slug)}" required>
                    <p class="modal-hint">Used in the download URL. Only letters, numbers, and dashes.</p>
                </div>
            `;

            const nameInput = form.querySelector('#modal-manual-name');
            const slugInput = form.querySelector('#modal-manual-slug');

            let slugDirty = false;

            const syncSlug = () => {
                if (!slugDirty) {
                    slugInput.value = slugify(nameInput.value);
                }
            };

            nameInput.addEventListener('input', syncSlug);
            slugInput.addEventListener('input', () => {
                slugDirty = true;
                slugInput.value = slugify(slugInput.value);
            });

            const handleSubmit = () => {
                const manualName = nameInput.value.trim();
                const manualSlug = slugify(slugInput.value.trim() || manualName);

                if (!manualName) {
                    nameInput.focus();
                    return;
                }

                if (!manualSlug) {
                    slugInput.focus();
                    return;
                }

                closeModal({ displayName: manualName, slug: manualSlug });
            };

            form.addEventListener('submit', (event) => {
                event.preventDefault();
                handleSubmit();
            });

            openModal({
                title,
                content: form,
                actions: [
                    { label: 'Cancel', value: null, variant: 'secondary' },
                    {
                        label: 'Save',
                        variant: 'primary',
                        handler: (event) => {
                            event.preventDefault();
                            handleSubmit();
                        }
                    }
                ]
            }).then((result) => {
                resolve(result || null);
            });

            setTimeout(() => {
                nameInput.focus();
                nameInput.select();
            }, 50);
        });
    }

    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', async function() {
        initModalElements();
        manualNameInput = document.getElementById('manual-name');
        manualLinkInput = document.getElementById('manual-link');

        // Initialize IndexedDB first
        initDB().then(() => {
            console.log('IndexedDB initialized');
        }).catch((error) => {
            console.error('Failed to initialize IndexedDB:', error);
            // Continue anyway - database is optional
        });
        
        // Setup login form immediately (don't wait for DB)
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        const session = await checkAdminSession();
        if (session?.authenticated) {
            showAdminPanel();
            startSessionTimeout();
            await loadFiles();
        } else {
            showLoginScreen();
        }

        // Setup logout buttons with multiple approaches to ensure they work
        function setupLogoutButtons() {
            const logoutBtn = document.getElementById('logout-btn');
            const logoutBtnMobile = document.getElementById('logout-btn-mobile');
            
            // Remove any existing listeners by cloning and replacing
            if (logoutBtn) {
                const newLogoutBtn = logoutBtn.cloneNode(true);
                logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
                newLogoutBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Logout button clicked');
                    handleLogout(e);
                });
            }
            
            if (logoutBtnMobile) {
                const newLogoutBtnMobile = logoutBtnMobile.cloneNode(true);
                logoutBtnMobile.parentNode.replaceChild(newLogoutBtnMobile, logoutBtnMobile);
                newLogoutBtnMobile.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Logout button (mobile) clicked');
                    handleLogout(e);
                });
            }
            
            // Also use event delegation as backup
            document.addEventListener('click', function(e) {
                const target = e.target;
                if (target && (target.id === 'logout-btn' || target.id === 'logout-btn-mobile')) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Logout via delegation');
                    handleLogout(e);
                }
            }, true); // Use capture phase
        }
        
        // Setup immediately
        setupLogoutButtons();
        
        // Also setup after a short delay to override any script.js handlers
        setTimeout(setupLogoutButtons, 100);

        // Setup file uploads
        setupFileUploads();
        initSiteVisibilityAdmin();
    });

    function showLoginScreen() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('admin-panel').style.display = 'none';
    }

    function showAdminPanel() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        loadSiteVisibilitySettings();
    }

    function readVisibilityRowsFromList() {
        const container = document.getElementById('visibility-page-list');
        if (!container) {
            return [];
        }

        return [...container.querySelectorAll('.visibility-page-row')].map((row) => {
            const pageKey = row.dataset.pageKey;
            const toggle = row.querySelector('.visibility-page-toggle');
            return {
                key: pageKey,
                visible: Boolean(toggle?.checked)
            };
        }).filter((row) => row.key);
    }

    function readSiteVisibilityForm() {
        const constructionToggle = document.getElementById('construction-mode-toggle');
        const settings = normalizeSiteSettings(getDefaultSiteSettings());
        settings.constructionMode = Boolean(constructionToggle?.checked);

        const api = getSettingsApi();
        if (api?.buildPagesFromOrderedRows) {
            settings.pages = api.buildPagesFromOrderedRows(readVisibilityRowsFromList());
        } else {
            readVisibilityRowsFromList().forEach((row, index) => {
                if (settings.pages[row.key]) {
                    settings.pages[row.key].visible = row.visible;
                    settings.pages[row.key].navOrder = index + 1;
                }
            });
        }

        return settings;
    }

    function resetNavigationOrder() {
        const api = getSettingsApi();
        const current = readSiteVisibilityForm();
        const resetPages = api?.resetNavigationOrder
            ? api.resetNavigationOrder(current.pages)
            : getDefaultSiteSettings().pages;

        applySiteVisibilityForm({
            ...current,
            pages: resetPages
        });
        setVisibilitySaveStatus('Navigation order reset to defaults. Save Settings to apply.');
    }

    function applySiteVisibilityForm(settings) {
        renderVisibilityPageList(settings);
        const normalized = normalizeSiteSettings(settings);
        const constructionToggle = document.getElementById('construction-mode-toggle');

        if (constructionToggle) {
            constructionToggle.checked = normalized.constructionMode;
            updateConstructionToggleState(constructionToggle);
        }
    }

    function updateConstructionToggleState(toggle) {
        const state = toggle?.closest('.visibility-toggle')?.querySelector('.visibility-toggle-state');
        if (!state) {
            return;
        }
        state.textContent = toggle.checked ? (state.dataset.on || 'On') : (state.dataset.off || 'Off');
    }

    function formatSettingsSourceLabel(source) {
        const labels = {
            server: 'server',
            'static-fallback': 'local fallback (static file)',
            'local-fallback': 'local fallback (browser storage)',
            config: 'defaults (API unavailable)'
        };
        return labels[source] || source;
    }

    function setApiConnectionStatus(status) {
        apiConnectionStatus = status === 'connected' ? 'connected' : 'disconnected';
        const statusEl = document.getElementById('debug-api-status');
        if (statusEl) {
            statusEl.textContent = apiConnectionStatus;
            statusEl.dataset.state = apiConnectionStatus;
        }
    }

    function formatNavItemsDebugList(settings) {
        const items = getAdminNavItems(normalizeSiteSettings(settings));
        if (!items.length) {
            return '—';
        }

        return items.map((item, index) => {
            const visible = isPageVisible(settings, item.key) ? 'visible' : 'hidden';
            return `${index + 1}. ${item.title} (${visible})`;
        }).join('; ');
    }

    function updateVisibilitySettingsDebug(settings, source = lastLoadedSettingsSource) {
        lastLoadedSettingsSource = source;
        lastLoadedSettingsUpdatedAt = settings?.updatedAt || null;

        const modeEl = document.getElementById('debug-construction-mode');
        const sourceEl = document.getElementById('debug-settings-source');
        const updatedEl = document.getElementById('debug-settings-updated');
        const navItemsEl = document.getElementById('debug-nav-items');

        if (modeEl) {
            modeEl.textContent = String(Boolean(settings?.constructionMode));
        }
        if (sourceEl) {
            sourceEl.textContent = formatSettingsSourceLabel(source);
        }
        if (updatedEl) {
            updatedEl.textContent = settings?.updatedAt
                ? new Date(settings.updatedAt).toLocaleString()
                : '—';
        }
        if (navItemsEl) {
            navItemsEl.textContent = formatNavItemsDebugList(settings);
        }
    }

    async function loadSiteVisibilitySettings() {
        const section = document.getElementById('site-visibility-section');
        if (!section) {
            return;
        }

        let settings = null;
        let source = 'config';

        try {
            settings = normalizeSiteSettings(await getSiteSettings());
            source = 'server';
            setApiConnectionStatus('connected');
        } catch (error) {
            console.warn('Failed to load site settings from API:', error.message || error);
            setApiConnectionStatus('disconnected');
        }

        if (!settings) {
            if (window.location.protocol === 'file:') {
                try {
                    const response = await fetch(`files/site-settings.json?t=${Date.now()}`, { cache: 'no-store' });
                    if (response.ok) {
                        settings = normalizeSiteSettings(await response.json());
                        source = 'static-fallback';
                    }
                } catch (error) {
                    console.warn('Failed to load static site settings:', error.message || error);
                }
            }
        }

        const resolved = settings || getDefaultSiteSettings();
        if (!settings) {
            source = 'config';
        }

        applySiteVisibilityForm(resolved);
        updateVisibilitySettingsDebug(resolved, source);

        console.info('[Okami Admin Site Settings]', {
            apiStatus: apiConnectionStatus,
            constructionMode: Boolean(resolved.constructionMode),
            settingsSource: source,
            updatedAt: resolved.updatedAt || null,
            path: window.location.pathname,
            isAdmin: Boolean((await checkAdminSession())?.authenticated)
        });
    }

    function setVisibilitySaveStatus(message, isError = false) {
        const status = document.getElementById('visibility-save-status');
        if (!status) {
            return;
        }

        status.textContent = message;
        status.hidden = !message;
        status.classList.toggle('is-error', Boolean(isError));
    }

    async function saveSiteVisibilitySettings() {
        const saveButton = document.getElementById('save-site-visibility');
        const settings = readSiteVisibilityForm();

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
        }

        setVisibilitySaveStatus('');

        try {
            const result = await saveSiteSettings(settings);
            const saved = normalizeSiteSettings(result?.settings || settings);
            setApiConnectionStatus('connected');
            updateVisibilitySettingsDebug(saved, 'server');
            localStorage.setItem('okami-site-settings-updated', Date.now().toString());
            if (window.SiteVisibility?.refreshNavigationSettings) {
                window.SiteVisibility.refreshNavigationSettings(true).catch(() => {});
            }
            setVisibilitySaveStatus('Settings saved to server.');
            showToast('Site visibility settings saved.', 'success');
        } catch (error) {
            console.error('Site settings save failed:', error);
            setApiConnectionStatus('disconnected');

            let message = 'Settings could not be saved to the server.';
            if (error.status === 401) {
                message += ' Sign in again and retry.';
            } else if (error.code === 'admin_auth_not_configured') {
                message += ' Admin auth is not configured on the server.';
            }

            setVisibilitySaveStatus(message, true);
            showToast('Settings could not be saved to the server.', 'info');
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'Save Settings';
            }
        }
    }

    function initSiteVisibilityAdmin() {
        renderVisibilityPageList(getDefaultSiteSettings());

        const saveButton = document.getElementById('save-site-visibility');
        const constructionToggle = document.getElementById('construction-mode-toggle');

        if (saveButton && saveButton.dataset.bound !== 'true') {
            saveButton.addEventListener('click', saveSiteVisibilitySettings);
            saveButton.dataset.bound = 'true';
        }

        if (constructionToggle && constructionToggle.dataset.bound !== 'true') {
            constructionToggle.addEventListener('change', () => updateConstructionToggleState(constructionToggle));
            constructionToggle.dataset.bound = 'true';
        }

        const resetButton = document.getElementById('reset-nav-order');
        if (resetButton && resetButton.dataset.bound !== 'true') {
            resetButton.addEventListener('click', resetNavigationOrder);
            resetButton.dataset.bound = 'true';
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        const passwordInput = document.getElementById('admin-password');
        const errorMsg = document.getElementById('login-error');
        
        try {
            const password = passwordInput.value.trim();

            if (!password) {
                errorMsg.textContent = 'Please enter a password.';
                return;
            }

            await adminLogin(password);
            showAdminPanel();
            errorMsg.textContent = '';
            startSessionTimeout();
            await loadFiles();
        } catch (error) {
            console.error('Login error:', error);
            errorMsg.textContent = error.message || 'Login failed. Please try again.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
    
    function startSessionTimeout() {
        // Clear any existing timeout interval
        if (sessionTimeoutInterval) {
            clearInterval(sessionTimeoutInterval);
        }
        
        // Re-check server session periodically
        sessionTimeoutInterval = setInterval(async () => {
            const session = await checkAdminSession();
            if (!session?.authenticated) {
                handleLogout();
            }
        }, 60000);
    }

    async function handleLogout(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        try {
            await adminLogout();
        } catch (error) {
            console.warn('Admin logout request failed:', error.message || error);
        }

        if (sessionTimeoutInterval) {
            clearInterval(sessionTimeoutInterval);
            sessionTimeoutInterval = null;
        }
        
        window.location.href = 'admin.html';
    }
    
    // Make handleLogout available globally for debugging
    window.handleAdminLogout = handleLogout;

    function setupFileUploads() {
        const logoInput = document.getElementById('logo-upload');
        const fileInput = document.getElementById('file-upload');
        const uploadBtn = document.getElementById('upload-combined');
        const logoPreview = document.getElementById('logo-preview');
        const filePreview = document.getElementById('file-preview');

        if (!logoInput || !fileInput || !uploadBtn || !logoPreview || !filePreview) {
            return;
        }

        manualLinkDirty = false;

        if (manualNameInput) {
            manualNameInput.addEventListener('input', () => {
                if (!manualLinkDirty && manualLinkInput) {
                    manualLinkInput.value = slugify(manualNameInput.value);
                }
                checkUploadButton();
            });
        }

        if (manualLinkInput) {
            manualLinkInput.addEventListener('input', () => {
                manualLinkDirty = true;
                manualLinkInput.value = slugify(manualLinkInput.value);
            });
        }

        // Logo upload
        logoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                selectedLogo = file;
                // Convert to base64 for persistence
                const reader = new FileReader();
                reader.onload = function(e) {
                    logoPreview.innerHTML = `<img src="${e.target.result}" alt="Logo preview" />`;
                };
                reader.readAsDataURL(file);
                checkUploadButton();
            }
        });

        // File upload
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                selectedFile = file;
                const icon = getFileIcon(file.type);
                filePreview.innerHTML = `<div style="font-size: 48px; margin-bottom: 10px;">${icon}</div><div style="font-size: 14px; color: var(--primary-text);">${file.name}</div><div style="font-size: 12px; color: var(--secondary-text);">${formatFileSize(file.size)}</div>`;

                if (manualNameInput) {
                    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[\-_]+/g, ' ').trim();
                    manualNameInput.value = baseName || file.name;
                }

                if (manualLinkInput) {
                    manualLinkDirty = false;
                    const source = manualNameInput ? manualNameInput.value : file.name;
                    manualLinkInput.value = slugify(source);
                }
                checkUploadButton();
            }
        });

        // Combined upload
        uploadBtn.addEventListener('click', function() {
            if (selectedFile) {
                handleCombinedUpload();
            }
        });

        checkUploadButton();
    }

    function getFileIcon(type) {
        if (type.includes('pdf')) return '📕';
        if (type.includes('word') || type.includes('document')) return '📘';
        if (type.includes('image')) return '🖼️';
        return '📄';
    }

    function checkUploadButton() {
        const uploadBtn = document.getElementById('upload-combined');
        if (uploadBtn) {
            const hasManualName = manualNameInput ? manualNameInput.value.trim().length > 0 : true;
            uploadBtn.disabled = !(selectedFile && hasManualName);
        }
    }

    async function handleCombinedUpload() {
        const uploadBtn = document.getElementById('upload-combined');
        
        if (!selectedFile) {
            await showAlert('Please select a file to upload.');
            return;
        }
        
        const manualName = manualNameInput ? manualNameInput.value.trim() : '';
        if (!manualName) {
            await showAlert('Please enter a manual display name.');
            return;
        }

        let manualSlug = manualLinkInput ? manualLinkInput.value.trim() : '';
        manualSlug = slugify(manualSlug || manualName);

        if (!manualSlug) {
            await showAlert('Please provide a valid manual link name.');
            return;
        }

        if (manualLinkInput) {
            manualLinkInput.value = manualSlug;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        try {
            // Check if API is available (with timeout)
            const apiAvailable = await Promise.race([
                checkAPIHealth(),
                new Promise(resolve => setTimeout(() => resolve(false), 3000))
            ]);
            
            if (!apiAvailable) {
                throw new Error('Backend API is not available. The server may be starting up. Please wait a moment and try again, or check server logs.');
            }

            // Upload to backend (with timeout)
            const result = await Promise.race([
                uploadFile({
                    file: selectedFile,
                    logo: selectedLogo,
                    displayName: manualName,
                    slug: manualSlug
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 60000))
            ]);
            
            console.log('File uploaded successfully:', result);

            // Reset form
            document.getElementById('logo-upload').value = '';
            document.getElementById('file-upload').value = '';
            document.getElementById('logo-preview').innerHTML = '';
            document.getElementById('file-preview').innerHTML = '';
            selectedLogo = null;
            selectedFile = null;
            manualLinkDirty = false;
            if (manualNameInput) manualNameInput.value = '';
            if (manualLinkInput) manualLinkInput.value = '';

            uploadBtn.textContent = 'Upload Documentation';
            checkUploadButton();
            
            // Reload files
            await loadFiles();
            
            showToast('Manual uploaded successfully!', 'success');
        } catch (error) {
            console.error('Upload error:', error);
            let errorMessage = 'Error uploading file. ';
            if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Please ensure the backend API is running and try again.';
            }
            await showAlert(errorMessage, 'Upload Failed');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Documentation';
        }
    }

    // Load files from backend API or fallback to manifest
    async function loadFiles() {
        const filesGrid = document.getElementById('files-grid');
        if (!filesGrid) return;

        filesGrid.innerHTML = '<p style="color: var(--secondary-text);">Loading files...</p>';

        // Try backend API first (with timeout)
        try {
            const apiAvailable = await Promise.race([
                checkAPIHealth(),
                new Promise(resolve => setTimeout(() => resolve(false), 2000))
            ]);
            
            if (apiAvailable) {
                try {
                    const files = await Promise.race([
                        getFiles(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                    ]);
                    
                    displayFiles(files);
                    return;
                } catch (apiError) {
                    console.warn('API request failed, falling back to manifest:', apiError.message);
                }
            }
        } catch (error) {
            console.warn('API health check failed, falling back to manifest:', error.message);
        }

        // Fallback: try to load from manifest.json (for static deployment)
        try {
            const manifestResponse = await fetch('files/manifest.json');
            if (manifestResponse.ok) {
                const manifest = await manifestResponse.json();
                manifest.files.forEach(file => {
                    file.url = `files/${file.filename}`;
                    if (file.logoFilename) {
                        file.logo = `files/${file.logoFilename}`;
                    }
                    file.isStatic = true;
                });
                displayFiles(manifest.files);
                return;
            }
        } catch (error) {
            console.log('No static files manifest found');
        }

        // No files available
        displayFiles([]);
    }

    function displayFiles(files) {
        const filesGrid = document.getElementById('files-grid');
        if (!filesGrid) return;

        filesGrid.innerHTML = '';

        if (files.length === 0) {
            filesGrid.innerHTML = '<p style="color: var(--secondary-text);">No files uploaded yet.</p>';
            return;
        }

        const normalizedFiles = files.map((file) => {
            const clone = { ...file };
            if (!clone.slug) {
                if (clone.filename) {
                    clone.slug = slugify(clone.filename.replace(/\.[^/.]+$/, ''));
                } else if (clone.name) {
                    clone.slug = slugify(clone.name);
                }
            }
            return clone;
        });

        currentFiles = normalizedFiles;

        normalizedFiles.forEach((file) => {
            const fileCard = document.createElement('div');
            fileCard.className = 'file-card';
            const isImage = file.type && file.type.startsWith('image/');
            const hasLogo = !!file.logo;
            
            const logoHtml = hasLogo ? 
                `<div class="file-preview"><img src="${file.logo}" alt="Project logo" onerror="this.parentElement.innerHTML='<div style=\\'padding: 40px; text-align: center; color: var(--secondary-text);\\'>No Logo</div>'" /></div>` :
                (isImage ? `<div class="file-preview"><img src="${file.url}" alt="${file.name}" /></div>` : 
                `<div class="file-preview" style="display: flex; align-items: center; justify-content: center; background: var(--accent-bg);">
                    <div style="text-align: center; color: var(--secondary-text); font-size: 12px;">
                        <div style="font-size: 48px; margin-bottom: 10px;">${getFileIcon(file.type)}</div>
                        <div>No Logo</div>
                    </div>
                </div>`);
            
            const actionButtons = [];
            actionButtons.push(`<button class="download-file" onclick="${file.isStatic ? `window.open('${file.url}', '_blank')` : `downloadFileAdmin(${file.id})`}">Download</button>`);
            if (!file.isStatic) {
                actionButtons.push(`<button class="update-file" data-replace-id="${file.id}" onclick="replaceFile(${file.id})">Replace</button>`);
                actionButtons.push(`<button class="delete-file" onclick="deleteFile(${file.id})">Delete</button>`);
            }

            const actionsHtml = actionButtons.join('');
            const statusHtml = file.isStatic ? `<div class="file-card-status">(Deployed)</div>` : '';
            
            fileCard.innerHTML = `
                ${logoHtml}
                <div class="file-card-body">
                    <div class="file-card-header">
                        <div class="file-card-name">${file.name}</div>
                    </div>
                    <div class="file-card-info">
                        <span class="file-card-size">${formatFileSize(file.size)}</span>
                        <span class="file-card-date">${formatDate(file.uploaded)}</span>
                    </div>
                </div>
                <div class="file-card-footer">
                    <div class="file-card-actions">${actionsHtml}</div>
                    ${statusHtml}
                </div>
            `;
            filesGrid.appendChild(fileCard);
        });
    }

    async function updateFile(index) {
        // Create hidden file inputs
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.doc,.docx,.txt';
        input.style.display = 'none';
        
        input.addEventListener('change', async function(e) {
            const newFile = e.target.files[0];
            if (newFile) {
                if (!db) {
                    await showAlert('Database not initialized');
                    return;
                }
                
                // Convert to base64
                const reader = new FileReader();
                reader.onload = function(e) {
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    const getAllRequest = store.getAll();
                    
                    getAllRequest.onsuccess = () => {
                        const files = getAllRequest.result;
                        if (index < files.length) {
                            const updatedFile = {
                                ...files[index],
                                name: newFile.name,
                                size: newFile.size,
                                type: newFile.type,
                                uploaded: new Date().toISOString(),
                                url: e.target.result
                            };
                            
                            const putRequest = store.put(updatedFile);
                            putRequest.onsuccess = () => {
                                loadFiles(); // Reload to show update
                            };
                            putRequest.onerror = async () => {
                                await showAlert('Error updating file: ' + putRequest.error.message);
                            };
                        }
                    };
                };
                reader.readAsDataURL(newFile);
            }
        });
        
        // Trigger file picker
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    async function downloadFileAdmin(fileId, isStatic = false) {
        try {
            // Try to get file info from API first
            const apiAvailable = await checkAPIHealth();
            if (apiAvailable) {
                const files = await getFiles();
                const file = files.find(f => f.id === fileId);
                if (file && file.url) {
                    const link = document.createElement('a');
                    link.href = file.url;
                    link.download = file.name;
                    link.click();
                    return;
                }
            }
            
            // Fallback: try loading from manifest
            const manifestResponse = await fetch('files/manifest.json');
            if (manifestResponse.ok) {
                const manifest = await manifestResponse.json();
                const staticFile = manifest.files.find(f => f.id === fileId);
                if (staticFile) {
                    const link = document.createElement('a');
                    link.href = `files/${staticFile.filename}`;
                    link.download = staticFile.name;
                    link.click();
                    return;
                }
            }
            
            await showAlert('File not found');
        } catch (error) {
            console.error('Download error:', error);
            await showAlert('Download failed. Please try again.', 'Download Failed');
        }
    }
    
    async function replaceFile(fileId) {
        if (!fileId) {
            return;
        }

        const file = currentFiles.find((item) => item.id === fileId);
        if (!file) {
            await showAlert('Unable to locate file details for this document. Please refresh and try again.');
            return;
        }

        const replaceButton = document.querySelector(`[data-replace-id="${fileId}"]`);

        if (!replaceButton) {
            await showAlert('Replace is only available for files uploaded through the admin panel.');
            return;
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.doc,.docx,.txt';
        fileInput.style.display = 'none';

        const cleanup = () => {
            if (fileInput.parentNode) {
                fileInput.parentNode.removeChild(fileInput);
            }
        };

        fileInput.addEventListener('change', async (event) => {
            try {
                const newFile = event.target.files && event.target.files[0];

                if (!newFile) {
                    return;
                }

                const metadata = await openMetadataModal({
                    title: 'Replace Manual',
                    displayName: file.name,
                    slug: file.slug || slugify(file.name)
                });

                if (!metadata) {
                    return;
                }

                if (replaceButton) {
                    replaceButton.disabled = true;
                    replaceButton.textContent = 'Replacing...';
                }

                const apiAvailable = await checkAPIHealth();
                if (!apiAvailable) {
                    throw new Error('Backend API is not available.');
                }

                await replaceFileById(fileId, {
                    file: newFile,
                    displayName: metadata.displayName,
                    slug: metadata.slug
                });
                await loadFiles();
                showToast('Manual replaced successfully.', 'success');
            } catch (error) {
                console.error('Replace error:', error);
                await showAlert('Error replacing file: ' + (error.message || 'Please try again.'), 'Replace Failed');
            } finally {
                if (replaceButton) {
                    replaceButton.disabled = false;
                    replaceButton.textContent = 'Replace';
                }
                event.target.value = '';
                cleanup();
            }
        }, { once: true });

        document.body.appendChild(fileInput);
        fileInput.click();

        // If the user cancels the dialog, ensure the input is removed
        fileInput.addEventListener('blur', () => setTimeout(cleanup, 0), { once: true });
    }

    async function deleteFile(fileId) {
        const confirmed = await showConfirmModal('Are you sure you want to delete this manual? This action cannot be undone.', {
            title: 'Delete Manual',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmVariant: 'danger'
        });

        if (!confirmed) {
            return;
        }
        
        try {
            const apiAvailable = await checkAPIHealth();
            if (!apiAvailable) {
                throw new Error('Backend API is not available.');
            }
            
            await deleteFileById(fileId);
            await loadFiles();
            showToast('Manual deleted successfully.', 'success');
        } catch (error) {
            console.error('Delete error:', error);
            await showAlert('Error deleting file: ' + (error.message || 'Please try again.'), 'Delete Failed');
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    // Make functions globally available
    window.updateFile = updateFile;
    window.deleteFile = deleteFile;
    window.downloadFileAdmin = downloadFileAdmin;
    window.replaceFile = replaceFile;
})();
