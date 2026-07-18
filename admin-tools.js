(function() {
    'use strict';

    const catalogApi = () => window.OkamiShared?.ToolsCatalog;
    const ui = () => window.OkamiAdminUi || {};

    let toolsState = [];
    let toolsDirty = false;
    let toolsBound = false;
    let toolsLastSavedAt = null;
    let drawerResolve = null;
    let drawerDraft = null;
    let drawerForm = null;

    function escapeHtml(value) {
        if (ui().escapeHtml) {
            return ui().escapeHtml(value);
        }
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function slugify(value) {
        if (catalogApi()?.slugify) {
            return catalogApi().slugify(value);
        }
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 120);
    }

    function setToolsMeta(message = '') {
        const meta = document.getElementById('tools-save-meta');
        if (!meta) {
            return;
        }
        if (!message) {
            meta.hidden = true;
            meta.textContent = '';
            return;
        }
        meta.hidden = false;
        meta.textContent = message;
    }

    function setToolsStatus(message, options = {}) {
        const status = document.getElementById('tools-save-status');
        if (!status) {
            return;
        }
        const isError = options === true || options.isError === true;
        const isSuccess = Boolean(options.isSuccess);
        if (!message) {
            status.textContent = toolsDirty ? 'Unsaved changes' : 'All changes saved';
            status.classList.remove('is-error', 'is-success');
            return;
        }
        status.hidden = false;
        status.textContent = message;
        status.classList.toggle('is-error', isError);
        status.classList.toggle('is-success', isSuccess && !isError);
    }

    function setFeaturedStatus(message, isError = false) {
        const status = document.getElementById('featured-save-status');
        if (!status) return;
        if (!message) {
            status.hidden = true;
            status.textContent = '';
            return;
        }
        status.hidden = false;
        status.textContent = message;
        status.classList.toggle('is-error', Boolean(isError));
    }

    function markDirty() {
        toolsDirty = true;
        setToolsStatus('Unsaved changes');
        setFeaturedStatus('Unsaved changes');
        updateSaveButtonsState();
        syncAdminUnsavedState();
        document.querySelectorAll('[data-admin-tab="tools"], [data-admin-tab="featured"]').forEach((tab) => {
            tab.classList.add('has-unsaved');
        });
    }

    function clearDirty() {
        toolsDirty = false;
        if (!document.getElementById('tools-save-status')?.classList.contains('is-error')) {
            setToolsStatus('All changes saved');
        }
        updateSaveButtonsState();
        syncAdminUnsavedState();
        document.querySelectorAll('[data-admin-tab="tools"], [data-admin-tab="featured"]').forEach((tab) => {
            tab.classList.remove('has-unsaved');
        });
    }

    function linkTypeLabel(tool) {
        if (tool?.detailPageEnabled) {
            return 'Detail Page';
        }
        if (tool?.linkType === 'external') {
            return 'External';
        }
        return 'Internal';
    }

    function toolMetaLine(tool) {
        const category = (tool?.category || 'Tool').trim() || 'Tool';
        return `${category} · ${linkTypeLabel(tool)}`;
    }

    function closeOpenMenus(exceptRow = null) {
        document.querySelectorAll('.tools-admin-table-row.is-menu-open').forEach((row) => {
            if (exceptRow && row === exceptRow) {
                return;
            }
            row.classList.remove('is-menu-open');
            const menu = row.querySelector('.tools-admin-menu');
            const toggle = row.querySelector('.tools-more-toggle');
            if (menu) {
                menu.hidden = true;
            }
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function sortState() {
        // Preserve current array order as the source of truth for displayOrder.
        toolsState = toolsState.map((tool, index) => ({
            ...tool,
            displayOrder: index + 1
        }));
        if (catalogApi()?.reindexHomepageOrder) {
            toolsState = catalogApi().reindexHomepageOrder(toolsState);
        }
    }

    function sortStateFromSavedOrders() {
        const api = catalogApi();
        toolsState = api?.reindexDisplayOrder
            ? api.reindexDisplayOrder(toolsState)
            : [...toolsState]
                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                .map((tool, index) => ({ ...tool, displayOrder: index + 1 }));
        if (api?.reindexHomepageOrder) {
            toolsState = api.reindexHomepageOrder(toolsState);
        }
    }

    function syncAdminUnsavedState() {
        window.OkamiAdminState = window.OkamiAdminState || {};
        window.OkamiAdminState.hasToolsUnsaved = () => toolsDirty;
        window.OkamiAdminState.hasUnsavedChanges = () => (
            toolsDirty || Boolean(window.OkamiAdminState.hasPagesUnsaved?.())
        );
    }

    syncAdminUnsavedState();

    function resolvePreviewImageUrl(tool) {
        if (catalogApi()?.resolveToolImageUrl) {
            return catalogApi().resolveToolImageUrl(tool);
        }
        if (tool.imageSource === 'placeholder') {
            return '';
        }
        if (tool.imageSource === 'website') {
            return tool.websiteLogoUrl || tool.iconUrl || '';
        }
        return tool.iconUrl || tool.websiteLogoUrl || '';
    }

    function buildPreviewCardHtml(tool) {
        const imageUrl = resolvePreviewImageUrl(tool);
        const icon = imageUrl
            ? `<span class="tools-hub-card-thumb"><img class="tools-hub-card-icon" src="${escapeHtml(imageUrl)}" alt="" width="48" height="48"></span>`
            : `<span class="tools-hub-card-thumb"><span class="tools-hub-card-icon tools-hub-card-icon--fallback" aria-hidden="true">${escapeHtml((tool.title || 'T').charAt(0).toUpperCase())}</span></span>`;

        return `
            <div class="tools-hub-card tools-admin-preview-card${tool.featured ? ' tools-hub-card--featured' : ''}">
                ${icon}
                <span class="tools-hub-card-tag">${escapeHtml(tool.category || 'Tool')}</span>
                <h2 class="tools-hub-card-title">${escapeHtml(tool.title || 'Untitled')}</h2>
                <p class="tools-hub-card-desc">${escapeHtml(tool.shortDescription || '')}</p>
                <span class="tools-hub-card-action">${escapeHtml(tool.buttonLabel || 'Open tool →')}</span>
            </div>
        `;
    }

    function buildToolRow(tool, orderNumber) {
        const imageUrl = resolvePreviewImageUrl(tool);
        const thumb = imageUrl
            ? `<img class="tools-admin-thumb" src="${escapeHtml(imageUrl)}" alt="" width="40" height="40">`
            : `<span class="tools-admin-thumb tools-admin-thumb--fallback" aria-hidden="true">${escapeHtml((tool.title || 'T').charAt(0).toUpperCase())}</span>`;
        const typeLabel = linkTypeLabel(tool);
        const typeClass = tool.detailPageEnabled
            ? 'detail'
            : (tool.linkType === 'external' ? 'external' : 'internal');
        const refreshLogoItem = tool.imageSource === 'website'
            ? `<button type="button" class="tools-menu-item tools-refresh-logo-btn" role="menuitem" data-tool-id="${escapeHtml(tool.id)}">Refresh Logo</button>`
            : '';

        return `
            <div class="tools-admin-table-row" role="row" data-tool-id="${escapeHtml(tool.id)}">
                <div class="tools-admin-cell tools-admin-cell--order" role="cell" data-label="Order">
                    <div class="tools-admin-order" aria-label="Reorder ${escapeHtml(tool.title || 'tool')}">
                        <span class="tools-admin-order-num">${orderNumber}</span>
                        <div class="tools-admin-order-btns">
                            <button type="button" class="tools-order-btn tools-order-up" data-tool-id="${escapeHtml(tool.id)}" aria-label="Move ${escapeHtml(tool.title)} up">↑</button>
                            <button type="button" class="tools-order-btn tools-order-down" data-tool-id="${escapeHtml(tool.id)}" aria-label="Move ${escapeHtml(tool.title)} down">↓</button>
                        </div>
                    </div>
                </div>
                <div class="tools-admin-cell tools-admin-cell--tool" role="cell" data-label="Tool">
                    <button type="button" class="tools-admin-tool-main tools-row-expand-toggle" data-tool-id="${escapeHtml(tool.id)}" aria-expanded="false">
                        ${thumb}
                        <span class="tools-admin-tool-copy">
                            <span class="tools-admin-tool-title">${escapeHtml(tool.title || 'Untitled')}</span>
                            <span class="tools-admin-tool-meta">${escapeHtml(toolMetaLine(tool))}</span>
                        </span>
                    </button>
                    <div class="tools-admin-row-details">
                        <div class="tools-admin-mobile-order">
                            <span>Order ${orderNumber}</span>
                            <button type="button" class="tools-order-btn tools-order-up" data-tool-id="${escapeHtml(tool.id)}" aria-label="Move ${escapeHtml(tool.title)} up">↑</button>
                            <button type="button" class="tools-order-btn tools-order-down" data-tool-id="${escapeHtml(tool.id)}" aria-label="Move ${escapeHtml(tool.title)} down">↓</button>
                            <span class="tools-admin-badge tools-admin-badge--${typeClass}">${escapeHtml(typeLabel)}</span>
                        </div>
                        <p><span>URL</span> ${escapeHtml(tool.url || '—')}</p>
                        <p><span>Type</span> ${escapeHtml(tool.contentType || 'tool')}</p>
                        <p><span>Image</span> ${escapeHtml(tool.imageSource || 'upload')}</p>
                        ${tool.listOnToolsPage === false ? '<p><span>Listing</span> Hidden from Tools page</p>' : ''}
                    </div>
                </div>
                <div class="tools-admin-cell tools-admin-cell--visibility" role="cell" data-label="Visibility">
                    <label class="tools-admin-switch">
                        <input type="checkbox" class="tools-enabled-toggle" data-tool-id="${escapeHtml(tool.id)}"${tool.enabled ? ' checked' : ''}>
                        <span class="tools-admin-switch-ui" aria-hidden="true"></span>
                        <span class="tools-admin-switch-label">Published</span>
                    </label>
                </div>
                <div class="tools-admin-cell tools-admin-cell--homepage" role="cell" data-label="Homepage">
                    <label class="tools-admin-switch" title="Controls Featured Projects on the homepage">
                        <input type="checkbox" class="tools-homepage-toggle" data-tool-id="${escapeHtml(tool.id)}"${tool.featured ? ' checked' : ''}${tool.enabled ? '' : ' disabled'} aria-label="Show on Homepage (Featured Projects)">
                        <span class="tools-admin-switch-ui" aria-hidden="true"></span>
                        <span class="tools-admin-switch-label">Homepage</span>
                    </label>
                </div>
                <div class="tools-admin-cell tools-admin-cell--link" role="cell" data-label="Link Type">
                    <span class="tools-admin-badge tools-admin-badge--${typeClass}">${escapeHtml(typeLabel)}</span>
                </div>
                <div class="tools-admin-cell tools-admin-cell--actions" role="cell" data-label="Actions">
                    <div class="tools-admin-actions">
                        <button type="button" class="tools-admin-action-btn tools-preview-btn" data-tool-id="${escapeHtml(tool.id)}">Preview</button>
                        <button type="button" class="tools-admin-action-btn tools-edit-btn" data-tool-id="${escapeHtml(tool.id)}">Edit</button>
                        <div class="tools-admin-more">
                            <button type="button" class="tools-admin-action-btn tools-more-toggle" data-tool-id="${escapeHtml(tool.id)}" aria-haspopup="menu" aria-expanded="false">More</button>
                            <div class="tools-admin-menu" role="menu" hidden>
                                <button type="button" class="tools-menu-item tools-duplicate-btn" role="menuitem" data-tool-id="${escapeHtml(tool.id)}">Duplicate</button>
                                ${refreshLogoItem}
                                <button type="button" class="tools-menu-item tools-menu-item--danger tools-delete-btn" role="menuitem" data-tool-id="${escapeHtml(tool.id)}">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function buildFeaturedRow(tool, orderNumber) {
        const imageUrl = resolvePreviewImageUrl(tool);
        const thumb = imageUrl
            ? `<img class="tools-admin-row-thumb" src="${escapeHtml(imageUrl)}" alt="" width="40" height="40">`
            : `<span class="tools-admin-row-thumb tools-admin-row-thumb--fallback" aria-hidden="true">${escapeHtml((tool.title || 'T').charAt(0).toUpperCase())}</span>`;
        return `
            <div class="visibility-page-row tools-admin-row" data-tool-id="${escapeHtml(tool.id)}">
                <div class="visibility-page-order" aria-label="Reorder homepage item">
                    <span class="visibility-page-order-num">${orderNumber}</span>
                    <button type="button" class="visibility-order-btn featured-order-up" data-tool-id="${escapeHtml(tool.id)}" aria-label="Move ${escapeHtml(tool.title)} up on homepage">↑</button>
                    <button type="button" class="visibility-order-btn featured-order-down" data-tool-id="${escapeHtml(tool.id)}" aria-label="Move ${escapeHtml(tool.title)} down on homepage">↓</button>
                </div>
                ${thumb}
                <div class="visibility-page-info">
                    <span class="visibility-page-name">${escapeHtml(tool.title)}</span>
                    <span class="visibility-page-path">${escapeHtml(tool.contentType || 'tool')} · ${escapeHtml(tool.category || '')}</span>
                    <span class="visibility-page-kind">${tool.enabled ? 'Published' : 'Disabled'} · Homepage order ${orderNumber}</span>
                </div>
                <div class="tools-admin-toggles">
                    <label class="visibility-switch">
                        <input type="checkbox" class="tools-homepage-toggle" data-tool-id="${escapeHtml(tool.id)}"${tool.featured ? ' checked' : ''}${tool.enabled ? '' : ' disabled'}>
                        <span class="visibility-switch-slider" aria-hidden="true"></span>
                        <span class="visibility-switch-text">Show on Homepage</span>
                    </label>
                </div>
                <div class="tools-admin-row-actions">
                    <button type="button" class="visibility-secondary-button tools-edit-btn" data-tool-id="${escapeHtml(tool.id)}">Edit source</button>
                    <button type="button" class="visibility-secondary-button tools-preview-btn" data-tool-id="${escapeHtml(tool.id)}">Preview</button>
                </div>
            </div>
        `;
    }

    function renderFeaturedAdminList() {
        const container = document.getElementById('featured-admin-list');
        if (!container) return;
        if (catalogApi()?.reindexHomepageOrder) {
            toolsState = catalogApi().reindexHomepageOrder(toolsState);
        }
        const items = catalogApi()?.getHomepageProjects?.({ tools: toolsState })
            || toolsState.filter((tool) => tool.enabled !== false && tool.featured);
        const eligible = toolsState.filter((tool) => tool.enabled !== false);
        if (!eligible.length) {
            container.innerHTML = '<p class="visibility-page-list-error">No published tools/projects yet. Add and publish items in the Tools tab first.</p>';
            return;
        }
        const featuredHtml = items.length
            ? items.map((tool, index) => buildFeaturedRow(tool, index + 1)).join('')
            : '<p class="tools-hub-empty">No homepage featured items. Toggle Show on Homepage on a published Tool.</p>';
        const otherHtml = eligible
            .filter((tool) => !tool.featured)
            .map((tool) => {
                const imageUrl = resolvePreviewImageUrl(tool);
                const thumb = imageUrl
                    ? `<img class="tools-admin-row-thumb" src="${escapeHtml(imageUrl)}" alt="" width="40" height="40">`
                    : `<span class="tools-admin-row-thumb tools-admin-row-thumb--fallback" aria-hidden="true">${escapeHtml((tool.title || 'T').charAt(0).toUpperCase())}</span>`;
                return `
                <div class="visibility-page-row tools-admin-row" data-tool-id="${escapeHtml(tool.id)}">
                    <div class="visibility-page-order" aria-hidden="true">
                        <span class="visibility-page-order-num">–</span>
                    </div>
                    ${thumb}
                    <div class="visibility-page-info">
                        <span class="visibility-page-name">${escapeHtml(tool.title)}</span>
                        <span class="visibility-page-path">${escapeHtml(tool.contentType || 'tool')} · not on homepage</span>
                    </div>
                    <div class="tools-admin-toggles">
                        <label class="visibility-switch">
                            <input type="checkbox" class="tools-homepage-toggle" data-tool-id="${escapeHtml(tool.id)}">
                            <span class="visibility-switch-slider" aria-hidden="true"></span>
                            <span class="visibility-switch-text">Show on Homepage</span>
                        </label>
                    </div>
                    <div class="tools-admin-row-actions">
                        <button type="button" class="visibility-secondary-button tools-edit-btn" data-tool-id="${escapeHtml(tool.id)}">Edit source</button>
                    </div>
                </div>
            `;
            }).join('');
        container.innerHTML = `
            <h3 class="admin-subheading">On homepage</h3>
            ${featuredHtml}
            <h3 class="admin-subheading">Eligible but not featured</h3>
            ${otherHtml || '<p class="tools-hub-empty">All published items are featured.</p>'}
        `;
    }

    function updateOrderButtons() {
        const container = document.getElementById('tools-admin-list');
        if (!container) {
            return;
        }
        const rows = [...container.querySelectorAll('.tools-admin-table-row')];
        rows.forEach((row, index) => {
            row.querySelectorAll('.tools-admin-order-num').forEach((orderNum) => {
                orderNum.textContent = String(index + 1);
            });
            row.querySelectorAll('.tools-order-up').forEach((up) => {
                up.disabled = index === 0;
            });
            row.querySelectorAll('.tools-order-down').forEach((down) => {
                down.disabled = index === rows.length - 1;
            });
        });
    }

    function renderToolsList() {
        const container = document.getElementById('tools-admin-list');
        if (!container) {
            return;
        }
        // Keep current toolsState order; only renumber displayOrder labels.
        toolsState = toolsState.map((tool, index) => ({ ...tool, displayOrder: index + 1 }));
        if (!toolsState.length) {
            container.innerHTML = '<p class="tools-admin-empty">No tools yet. Add your first tool to populate the public Tools page.</p>';
            renderFeaturedAdminList();
            updateSaveButtonsState();
            return;
        }
        container.innerHTML = `
            <div class="tools-admin-table" role="table" aria-label="Tools catalog">
                <div class="tools-admin-table-head" role="row">
                    <div class="tools-admin-cell tools-admin-cell--order" role="columnheader">Order</div>
                    <div class="tools-admin-cell tools-admin-cell--tool" role="columnheader">Tool</div>
                    <div class="tools-admin-cell tools-admin-cell--visibility" role="columnheader">Visibility</div>
                    <div class="tools-admin-cell tools-admin-cell--homepage" role="columnheader">Homepage</div>
                    <div class="tools-admin-cell tools-admin-cell--link" role="columnheader">Link Type</div>
                    <div class="tools-admin-cell tools-admin-cell--actions" role="columnheader">Actions</div>
                </div>
                <div class="tools-admin-table-body" role="rowgroup">
                    ${toolsState.map((tool, index) => buildToolRow(tool, index + 1)).join('')}
                </div>
            </div>
        `;
        updateOrderButtons();
        renderFeaturedAdminList();
        updateSaveButtonsState();
    }

    function moveTool(toolId, direction) {
        const index = toolsState.findIndex((tool) => tool.id === toolId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= toolsState.length) {
            return;
        }
        const copy = [...toolsState];
        const [item] = copy.splice(index, 1);
        copy.splice(target, 0, item);
        toolsState = copy.map((tool, orderIndex) => ({
            ...tool,
            displayOrder: orderIndex + 1
        }));
        markDirty();
        renderToolsList();
    }

    function updateSaveButtonsState() {
        const toolsSave = document.getElementById('save-tools-catalog');
        if (toolsSave && toolsSave.dataset.saving !== 'true') {
            toolsSave.disabled = !toolsDirty;
            toolsSave.classList.toggle('is-emphasized', toolsDirty);
            toolsSave.textContent = 'Save Changes';
        }
        const featuredSave = document.getElementById('save-featured-catalog');
        if (featuredSave && featuredSave.dataset.saving !== 'true') {
            featuredSave.disabled = !toolsDirty;
        }
    }

    function findTool(toolId) {
        return toolsState.find((tool) => tool.id === toolId) || null;
    }

    function linesToArray(value) {
        return String(value || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
    }

    function buildToolForm(tool) {
        const form = document.createElement('form');
        form.className = 'modal-form tools-admin-form';
        form.innerHTML = `
            <div class="modal-field">
                <label for="tool-field-title">Title</label>
                <input id="tool-field-title" type="text" maxlength="120" value="${escapeHtml(tool.title || '')}" required>
            </div>
            <div class="modal-field">
                <label for="tool-field-category">Category / eyebrow</label>
                <input id="tool-field-category" type="text" maxlength="80" value="${escapeHtml(tool.category || '')}">
            </div>
            <div class="modal-field">
                <label for="tool-field-short">Short description</label>
                <textarea id="tool-field-short" rows="3" maxlength="400">${escapeHtml(tool.shortDescription || '')}</textarea>
            </div>
            <div class="modal-field">
                <label for="tool-field-long">Long description (optional)</label>
                <textarea id="tool-field-long" rows="4" maxlength="2000">${escapeHtml(tool.longDescription || '')}</textarea>
            </div>
            <div class="modal-field">
                <label for="tool-field-button">Button label</label>
                <input id="tool-field-button" type="text" maxlength="80" value="${escapeHtml(tool.buttonLabel || 'Open tool →')}">
            </div>
            <div class="modal-field">
                <label for="tool-field-url">Destination URL</label>
                <input id="tool-field-url" type="text" maxlength="500" value="${escapeHtml(tool.url || '')}" required>
            </div>
            <div class="modal-field">
                <label for="tool-field-link-type">Link type</label>
                <select id="tool-field-link-type">
                    <option value="internal"${tool.linkType === 'internal' ? ' selected' : ''}>Internal</option>
                    <option value="external"${tool.linkType === 'external' ? ' selected' : ''}>External</option>
                </select>
            </div>
            <div class="modal-field">
                <label for="tool-field-content-type">Content type</label>
                <select id="tool-field-content-type">
                    ${['tool', 'app', 'calculator', 'prints', 'download', 'page', 'project'].map((type) => (
                        `<option value="${type}"${(tool.contentType || 'tool') === type ? ' selected' : ''}>${type}</option>`
                    )).join('')}
                </select>
            </div>
            <div class="modal-field modal-field--inline">
                <label><input type="checkbox" id="tool-field-new-tab"${tool.openInNewTab ? ' checked' : ''}> Open in new tab</label>
                <label><input type="checkbox" id="tool-field-enabled"${tool.enabled !== false ? ' checked' : ''}> Published / enabled</label>
                <label><input type="checkbox" id="tool-field-featured"${tool.featured ? ' checked' : ''}> Show on Homepage</label>
                <label><input type="checkbox" id="tool-field-list-tools"${tool.listOnToolsPage !== false ? ' checked' : ''}> List on Tools page</label>
            </div>
            <div class="modal-field">
                <label for="tool-field-slug">Slug (for detail page)</label>
                <input id="tool-field-slug" type="text" maxlength="120" value="${escapeHtml(tool.slug || '')}">
            </div>
            <div class="modal-field modal-field--inline">
                <label><input type="checkbox" id="tool-field-detail"${tool.detailPageEnabled ? ' checked' : ''}> Detail page enabled</label>
            </div>
            <div class="modal-field">
                <label for="tool-field-accent">Accent style</label>
                <select id="tool-field-accent">
                    <option value="default"${tool.accent === 'default' ? ' selected' : ''}>Default</option>
                    <option value="accent"${tool.accent === 'accent' ? ' selected' : ''}>Accent</option>
                    <option value="muted"${tool.accent === 'muted' ? ' selected' : ''}>Muted</option>
                </select>
            </div>
            <div class="modal-field">
                <label for="tool-field-image-source">Card image source</label>
                <select id="tool-field-image-source">
                    <option value="upload"${(tool.imageSource || 'upload') === 'upload' ? ' selected' : ''}>Uploaded image</option>
                    <option value="website"${tool.imageSource === 'website' ? ' selected' : ''}>Website logo / favicon</option>
                    <option value="placeholder"${tool.imageSource === 'placeholder' ? ' selected' : ''}>Generated placeholder</option>
                </select>
                <p class="modal-hint">Website logos are cached locally and refreshed every 7 days (or via Refresh Logo).</p>
            </div>
            <div class="modal-field">
                <label for="tool-field-icon-url">Uploaded image URL (fallback)</label>
                <input id="tool-field-icon-url" type="text" maxlength="500" value="${escapeHtml(tool.iconUrl || '')}">
                <p class="modal-hint">Used when image source is “Uploaded image”, or as fallback if website logo fetch fails.</p>
                <input type="file" id="tool-field-icon-file" accept=".png,.jpg,.jpeg,.gif,.webp,.svg,image/*">
            </div>
            <div class="modal-field tools-website-logo-meta" id="tool-website-logo-meta">
                <p class="modal-hint">
                    Cached logo: ${tool.websiteLogoUrl ? escapeHtml(tool.websiteLogoUrl) : 'Not cached yet'}
                    ${tool.websiteLogoKind ? ` · source ${escapeHtml(tool.websiteLogoKind)}` : ''}
                    ${tool.websiteLogoFetchedAt ? ` · fetched ${escapeHtml(new Date(tool.websiteLogoFetchedAt).toLocaleString())}` : ''}
                    ${tool.websiteLogoError ? ` · last error: ${escapeHtml(tool.websiteLogoError)}` : ''}
                </p>
                <button type="button" class="visibility-secondary-button" id="tool-field-refresh-logo">Refresh Logo Now</button>
            </div>
            <div class="modal-field">
                <label for="tool-field-hero">Hero image URL (detail page)</label>
                <input id="tool-field-hero" type="text" maxlength="500" value="${escapeHtml(tool.heroImageUrl || '')}">
            </div>
            <div class="modal-field">
                <label for="tool-field-features">Feature list (one per line)</label>
                <textarea id="tool-field-features" rows="4">${escapeHtml((tool.features || []).join('\n'))}</textarea>
            </div>
            <div class="modal-field">
                <label for="tool-field-screenshots">Additional screenshots (one URL per line)</label>
                <textarea id="tool-field-screenshots" rows="3">${escapeHtml((tool.screenshots || []).join('\n'))}</textarea>
            </div>
            <div class="modal-field">
                <label for="tool-field-support">Support link (optional)</label>
                <input id="tool-field-support" type="text" maxlength="500" value="${escapeHtml(tool.supportUrl || '')}">
            </div>
            <div class="modal-field">
                <label for="tool-field-id">Internal ID</label>
                <input id="tool-field-id" type="text" maxlength="120" value="${escapeHtml(tool.id || '')}" ${tool.id ? 'readonly' : ''}>
            </div>
            <div class="tools-admin-live-preview" id="tool-live-preview">${buildPreviewCardHtml(tool)}</div>
        `;
        return form;
    }

    function readToolForm(form, existing) {
        const title = form.querySelector('#tool-field-title').value.trim();
        const nowIso = new Date().toISOString();
        const id = form.querySelector('#tool-field-id').value.trim()
            || existing?.id
            || catalogApi()?.createId?.(title)
            || slugify(title);

        return {
            ...(existing || {}),
            id,
            title,
            category: form.querySelector('#tool-field-category').value.trim() || 'Tool',
            shortDescription: form.querySelector('#tool-field-short').value.trim(),
            longDescription: form.querySelector('#tool-field-long').value.trim(),
            buttonLabel: form.querySelector('#tool-field-button').value.trim() || 'Open tool →',
            url: form.querySelector('#tool-field-url').value.trim(),
            linkType: form.querySelector('#tool-field-link-type').value,
            openInNewTab: form.querySelector('#tool-field-new-tab').checked,
            enabled: form.querySelector('#tool-field-enabled').checked,
            featured: form.querySelector('#tool-field-featured').checked,
            listOnToolsPage: form.querySelector('#tool-field-list-tools').checked,
            contentType: form.querySelector('#tool-field-content-type').value,
            slug: slugify(form.querySelector('#tool-field-slug').value || title),
            detailPageEnabled: form.querySelector('#tool-field-detail').checked,
            accent: form.querySelector('#tool-field-accent').value,
            imageSource: form.querySelector('#tool-field-image-source').value,
            homepageOrder: existing?.homepageOrder || 999,
            iconUrl: form.querySelector('#tool-field-icon-url').value.trim(),
            websiteLogoUrl: existing?.websiteLogoUrl || '',
            websiteLogoRemoteUrl: existing?.websiteLogoRemoteUrl || '',
            websiteLogoKind: existing?.websiteLogoKind || '',
            websiteLogoFetchedAt: existing?.websiteLogoFetchedAt || '',
            websiteLogoError: existing?.websiteLogoError || '',
            heroImageUrl: form.querySelector('#tool-field-hero').value.trim(),
            features: linesToArray(form.querySelector('#tool-field-features').value),
            screenshots: linesToArray(form.querySelector('#tool-field-screenshots').value),
            supportUrl: form.querySelector('#tool-field-support').value.trim(),
            createdAt: existing?.createdAt || nowIso,
            updatedAt: nowIso,
            displayOrder: existing?.displayOrder || toolsState.length + 1,
            pageKey: existing?.pageKey || null
        };
    }

    async function uploadIconFile(file) {
        if (typeof uploadToolIcon !== 'function') {
            throw new Error('Icon upload is unavailable.');
        }
        const result = await uploadToolIcon(file);
        return result.iconUrl;
    }

    function getDrawerEls() {
        return {
            root: document.getElementById('tools-editor-drawer'),
            body: document.getElementById('tools-drawer-body'),
            title: document.getElementById('tools-drawer-title'),
            save: document.getElementById('tools-drawer-save'),
            panel: document.querySelector('#tools-editor-drawer .tools-drawer-panel')
        };
    }

    function closeToolDrawer(result = null) {
        const { root } = getDrawerEls();
        if (!root) {
            return;
        }
        root.classList.remove('is-open');
        root.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('tools-drawer-open');
        drawerForm = null;
        drawerDraft = null;
        if (drawerResolve) {
            const resolve = drawerResolve;
            drawerResolve = null;
            resolve(result);
        }
    }

    function bindDrawerChromeOnce() {
        const { root, save } = getDrawerEls();
        if (!root || root.dataset.bound === 'true') {
            return;
        }
        root.dataset.bound = 'true';

        root.addEventListener('click', (event) => {
            if (event.target.closest('[data-tools-drawer-close]')) {
                closeToolDrawer(null);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && root.classList.contains('is-open')) {
                closeToolDrawer(null);
            }
        });

        save?.addEventListener('click', (event) => {
            event.preventDefault();
            if (!drawerForm || !drawerDraft) {
                return;
            }
            const tool = readToolForm(drawerForm, drawerDraft);
            const api = catalogApi();
            const normalized = api?.normalizeTool ? api.normalizeTool(tool, 0) : tool;
            const catalog = {
                tools: toolsState.filter((item) => item.id !== normalized.id).concat([normalized])
            };
            const errors = api?.validateToolForSave?.(normalized, catalog) || [];
            if (!normalized.title || !normalized.url) {
                errors.push('Title and destination URL are required.');
            }
            if (errors.length) {
                ui().showToast?.(errors[0], 'error');
                return;
            }
            closeToolDrawer(normalized);
        });
    }

    function openToolDrawer(existing = null) {
        bindDrawerChromeOnce();
        const { root, body, title, panel } = getDrawerEls();
        if (!root || !body) {
            return Promise.resolve(null);
        }

        const draft = existing ? { ...existing } : {
            id: '',
            title: '',
            category: '',
            shortDescription: '',
            longDescription: '',
            buttonLabel: 'Open tool →',
            url: '',
            linkType: 'external',
            openInNewTab: false,
            enabled: true,
            featured: false,
            slug: '',
            detailPageEnabled: false,
            accent: 'default',
            imageSource: 'website',
            contentType: 'tool',
            iconUrl: '',
            websiteLogoUrl: '',
            websiteLogoRemoteUrl: '',
            websiteLogoKind: '',
            websiteLogoFetchedAt: '',
            websiteLogoError: '',
            listOnToolsPage: true,
            homepageOrder: 999,
            heroImageUrl: '',
            features: [],
            screenshots: [],
            supportUrl: '',
            pageKey: null
        };

        const form = buildToolForm(draft);
        form.classList.add('tools-drawer-form');
        drawerDraft = draft;
        drawerForm = form;
        body.innerHTML = '';
        body.appendChild(form);
        if (title) {
            title.textContent = existing ? `Edit ${existing.title}` : 'Add Tool';
        }

        const titleInput = form.querySelector('#tool-field-title');
        const slugInput = form.querySelector('#tool-field-slug');
        const imageSourceSelect = form.querySelector('#tool-field-image-source');
        const logoMeta = form.querySelector('#tool-website-logo-meta');

        const syncLogoMetaVisibility = () => {
            if (logoMeta) {
                logoMeta.hidden = imageSourceSelect.value !== 'website';
            }
        };
        syncLogoMetaVisibility();

        const preview = () => {
            const live = form.querySelector('#tool-live-preview');
            if (live) {
                live.innerHTML = buildPreviewCardHtml(readToolForm(form, draft));
            }
            syncLogoMetaVisibility();
        };

        let slugDirty = Boolean(existing?.slug);
        titleInput.addEventListener('input', () => {
            if (!slugDirty) {
                slugInput.value = slugify(titleInput.value);
            }
            preview();
        });
        slugInput.addEventListener('input', () => {
            slugDirty = true;
            slugInput.value = slugify(slugInput.value);
            preview();
        });
        form.addEventListener('input', preview);
        form.addEventListener('change', preview);

        form.querySelector('#tool-field-icon-file').addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }
            try {
                const iconUrl = await uploadIconFile(file);
                form.querySelector('#tool-field-icon-url').value = iconUrl;
                if (imageSourceSelect.value === 'placeholder') {
                    imageSourceSelect.value = 'upload';
                }
                preview();
                ui().showToast?.('Icon uploaded.', 'success');
            } catch (error) {
                ui().showToast?.(error.message || 'Icon upload failed.', 'error');
            }
        });

        form.querySelector('#tool-field-refresh-logo')?.addEventListener('click', async (event) => {
            event.preventDefault();
            const current = readToolForm(form, draft);
            if (!current.id) {
                ui().showToast?.('Save the tool once before refreshing its logo.', 'error');
                return;
            }
            if (current.imageSource !== 'website') {
                ui().showToast?.('Set image source to Website logo first.', 'error');
                return;
            }
            const index = toolsState.findIndex((tool) => tool.id === current.id);
            if (index >= 0) {
                toolsState[index] = { ...toolsState[index], ...current };
            } else {
                toolsState.push(current);
            }
            try {
                await saveManagedTools({ version: 1, tools: toolsState });
                const result = await refreshToolWebsiteLogo(current.id);
                if (result.tool) {
                    Object.assign(draft, result.tool);
                    const meta = form.querySelector('#tool-website-logo-meta .modal-hint');
                    if (meta) {
                        meta.textContent = `Cached logo: ${result.tool.websiteLogoUrl || 'Not cached yet'}${result.tool.websiteLogoKind ? ` · source ${result.tool.websiteLogoKind}` : ''}${result.tool.websiteLogoFetchedAt ? ` · fetched ${new Date(result.tool.websiteLogoFetchedAt).toLocaleString()}` : ''}`;
                    }
                    if (Array.isArray(result.tools)) {
                        toolsState = result.tools;
                    }
                    preview();
                    renderToolsList();
                }
                ui().showToast?.('Website logo refreshed.', 'success');
            } catch (error) {
                if (error.tool) {
                    Object.assign(draft, error.tool);
                }
                if (Array.isArray(error.tools)) {
                    toolsState = error.tools;
                    renderToolsList();
                }
                ui().showToast?.(error.message || 'Logo refresh failed.', 'error');
                preview();
            }
        });

        root.classList.add('is-open');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('tools-drawer-open');
        requestAnimationFrame(() => {
            panel?.focus?.();
            titleInput?.focus?.();
        });

        return new Promise((resolve) => {
            drawerResolve = resolve;
        });
    }

    async function openToolEditor(existing = null) {
        const result = await openToolDrawer(existing);
        if (!result) {
            return;
        }

        const index = toolsState.findIndex((tool) => tool.id === result.id);
        if (index >= 0) {
            toolsState[index] = result;
        } else {
            toolsState.push(result);
        }
        sortState();
        markDirty();
        renderToolsList();
    }

    async function previewTool(toolId) {
        const tool = findTool(toolId);
        if (!tool || !ui().openModal) {
            return;
        }
        await ui().openModal({
            title: `Preview · ${tool.title}`,
            content: buildPreviewCardHtml(tool),
            actions: [{ label: 'Close', value: true, variant: 'primary' }]
        });
    }

    async function deleteTool(toolId) {
        const tool = findTool(toolId);
        if (!tool) {
            return;
        }
        const confirmed = await ui().showConfirmModal?.(
            `Delete "${tool.title}"? This removes it from Tools and Featured Projects after you save.`,
            { title: 'Delete Tool', confirmText: 'Delete', confirmVariant: 'primary' }
        );
        if (!confirmed) {
            return;
        }
        toolsState = toolsState.filter((item) => item.id !== toolId);
        sortState();
        markDirty();
        renderToolsList();
    }

    function duplicateTool(toolId) {
        const tool = findTool(toolId);
        if (!tool) return;
        const copy = {
            ...tool,
            id: catalogApi()?.createId?.(tool.title) || `${tool.id}-copy`,
            title: `${tool.title} Copy`,
            slug: slugify(`${tool.slug || tool.title}-copy`),
            featured: false,
            homepageOrder: 999,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            displayOrder: toolsState.length + 1
        };
        toolsState.push(copy);
        sortState();
        markDirty();
        renderToolsList();
        ui().showToast?.('Tool duplicated. Save Changes to publish.', 'success');
        openToolEditor(copy);
    }

    function moveFeatured(toolId, direction) {
        const featured = toolsState
            .filter((tool) => tool.featured)
            .sort((a, b) => (a.homepageOrder || 999) - (b.homepageOrder || 999));
        const index = featured.findIndex((tool) => tool.id === toolId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= featured.length) return;
        const reordered = [...featured];
        const [item] = reordered.splice(index, 1);
        reordered.splice(target, 0, item);
        const orderMap = new Map(reordered.map((tool, i) => [tool.id, i + 1]));
        toolsState = toolsState.map((tool) => (
            orderMap.has(tool.id) ? { ...tool, homepageOrder: orderMap.get(tool.id) } : tool
        ));
        markDirty();
        renderToolsList();
    }

    async function loadToolsCatalog({ force = false } = {}) {
        if (toolsDirty && !force) {
            const confirmed = await ui().showConfirmModal?.(
                'You have unsaved Tools changes. Reload saved data and discard them?',
                { title: 'Reload Saved Data', confirmText: 'Discard & Reload', cancelText: 'Keep Editing' }
            );
            if (!confirmed) {
                return;
            }
        }

        setToolsStatus('Loading…');
        setFeaturedStatus('Loading…');
        try {
            if (typeof getManagedTools !== 'function') {
                throw new Error('Tools API client missing');
            }
            const data = await getManagedTools();
            toolsState = Array.isArray(data.tools) ? data.tools : [];
            sortStateFromSavedOrders();
            clearDirty();
            renderToolsList();
            toolsLastSavedAt = data.updatedAt || null;
            setToolsStatus('Loaded successfully', { isSuccess: true });
            setToolsMeta(toolsLastSavedAt
                ? `Last saved ${new Date(toolsLastSavedAt).toLocaleString()}`
                : '');
            setFeaturedStatus('Loaded successfully');
            console.info('[Okami Admin Tools] loaded', {
                count: toolsState.length,
                updatedAt: data.updatedAt || null
            });
        } catch (error) {
            console.error('[Okami Admin Tools] load failed', error);
            setToolsStatus(error.message || 'Failed to load tools', { isError: true });
            setFeaturedStatus(error.message || 'Failed to load tools', true);
        }
    }

    async function saveToolsCatalog() {
        if (!toolsDirty) {
            setToolsStatus('All changes saved');
            setFeaturedStatus('No changes to save');
            return false;
        }

        const saveButtons = ['save-tools-catalog', 'save-featured-catalog']
            .map((id) => document.getElementById(id))
            .filter(Boolean);
        saveButtons.forEach((button) => {
            button.dataset.saving = 'true';
            button.disabled = true;
            if (button.id === 'save-tools-catalog') {
                button.textContent = 'Saving…';
            }
        });

        setToolsStatus('Saving…');
        setFeaturedStatus('Saving…');
        try {
            // Persist current array order as displayOrder before save.
            sortState();
            console.info('[Okami Admin Tools] saving', {
                count: toolsState.length,
                ids: toolsState.map((tool) => tool.id)
            });
            const result = await saveManagedTools({
                version: 1,
                tools: toolsState
            });
            toolsState = Array.isArray(result.tools) ? result.tools : toolsState;
            sortStateFromSavedOrders();
            clearDirty();
            renderToolsList();
            toolsLastSavedAt = result.updatedAt || new Date().toISOString();
            setToolsStatus('All changes saved', { isSuccess: true });
            setToolsMeta(`Last saved ${new Date(toolsLastSavedAt).toLocaleString()}`);
            setFeaturedStatus(`Saved ${new Date(toolsLastSavedAt).toLocaleString()}`);
            ui().showToast?.('Tools catalog saved.', 'success');
            window.OkamiAdminTabs?.refreshOverview?.();
            return true;
        } catch (error) {
            console.error('[Okami Admin Tools] save failed', error);
            // Keep unsaved local edits; do not claim success.
            setToolsStatus('Save failed', { isError: true });
            setFeaturedStatus(error.message || 'Save failed', true);
            ui().showToast?.(error.message || 'Failed to save tools', 'error');
            toolsDirty = true;
            syncAdminUnsavedState();
            updateSaveButtonsState();
            return false;
        } finally {
            saveButtons.forEach((button) => {
                button.dataset.saving = 'false';
                if (button.id === 'save-featured-catalog') {
                    button.textContent = 'Save Featured Order';
                } else {
                    button.textContent = 'Save Changes';
                }
                button.disabled = !toolsDirty;
            });
            updateSaveButtonsState();
        }
    }

    function bindToolsAdmin() {
        if (toolsBound) {
            return;
        }
        toolsBound = true;

        document.getElementById('add-tool-btn')?.addEventListener('click', () => openToolEditor(null));
        document.getElementById('save-tools-catalog')?.addEventListener('click', saveToolsCatalog);
        document.getElementById('reload-tools-catalog')?.addEventListener('click', () => loadToolsCatalog({ force: false }));
        document.getElementById('save-featured-catalog')?.addEventListener('click', saveToolsCatalog);
        updateSaveButtonsState();

        document.addEventListener('click', (event) => {
            const toolsList = document.getElementById('tools-admin-list');
            const featuredList = document.getElementById('featured-admin-list');
            const inTools = toolsList?.contains(event.target);
            const inFeatured = featuredList?.contains(event.target);

            if (!event.target.closest('.tools-admin-more')) {
                closeOpenMenus();
            }

            if (!inTools && !inFeatured) {
                return;
            }

            const up = event.target.closest('.tools-order-up');
            if (up?.dataset.toolId) {
                moveTool(up.dataset.toolId, -1);
                return;
            }
            const down = event.target.closest('.tools-order-down');
            if (down?.dataset.toolId) {
                moveTool(down.dataset.toolId, 1);
                return;
            }
            const featuredUp = event.target.closest('.featured-order-up');
            if (featuredUp?.dataset.toolId) {
                moveFeatured(featuredUp.dataset.toolId, -1);
                return;
            }
            const featuredDown = event.target.closest('.featured-order-down');
            if (featuredDown?.dataset.toolId) {
                moveFeatured(featuredDown.dataset.toolId, 1);
                return;
            }
            const expand = event.target.closest('.tools-row-expand-toggle');
            if (expand?.dataset.toolId && window.matchMedia('(max-width: 900px)').matches) {
                const row = expand.closest('.tools-admin-table-row');
                if (row) {
                    const open = !row.classList.contains('is-expanded');
                    row.classList.toggle('is-expanded', open);
                    expand.setAttribute('aria-expanded', open ? 'true' : 'false');
                }
                return;
            }
            const edit = event.target.closest('.tools-edit-btn');
            if (edit?.dataset.toolId) {
                if (typeof window.OkamiAdminTabs?.activateTab === 'function') {
                    window.OkamiAdminTabs.activateTab('tools');
                }
                openToolEditor(findTool(edit.dataset.toolId));
                return;
            }
            const preview = event.target.closest('.tools-preview-btn');
            if (preview?.dataset.toolId) {
                previewTool(preview.dataset.toolId);
                return;
            }
            const more = event.target.closest('.tools-more-toggle');
            if (more?.dataset.toolId) {
                const row = more.closest('.tools-admin-table-row');
                const menu = row?.querySelector('.tools-admin-menu');
                if (row && menu) {
                    const open = menu.hidden;
                    document.querySelectorAll('.tools-admin-table-row.is-menu-open').forEach((other) => {
                        if (other !== row) {
                            other.classList.remove('is-menu-open');
                            const otherMenu = other.querySelector('.tools-admin-menu');
                            const otherToggle = other.querySelector('.tools-more-toggle');
                            if (otherMenu) otherMenu.hidden = true;
                            if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
                        }
                    });
                    menu.hidden = !open;
                    row.classList.toggle('is-menu-open', open);
                    more.setAttribute('aria-expanded', open ? 'true' : 'false');
                }
                return;
            }
            const dup = event.target.closest('.tools-duplicate-btn');
            if (dup?.dataset.toolId) {
                closeOpenMenus();
                duplicateTool(dup.dataset.toolId);
                return;
            }
            const del = event.target.closest('.tools-delete-btn');
            if (del?.dataset.toolId) {
                closeOpenMenus();
                deleteTool(del.dataset.toolId);
                return;
            }
            const refresh = event.target.closest('.tools-refresh-logo-btn');
            if (refresh?.dataset.toolId) {
                closeOpenMenus();
                refreshLogoForTool(refresh.dataset.toolId);
            }
        });

        async function refreshLogoForTool(toolId) {
            try {
                setToolsStatus('Refreshing website logo…');
                // Persist any pending order/enabled edits first so refresh does not clobber them.
                if (toolsDirty) {
                    const saved = await saveToolsCatalog();
                    if (!saved) {
                        return;
                    }
                }
                const result = await refreshToolWebsiteLogo(toolId);
                if (Array.isArray(result.tools)) {
                    toolsState = result.tools;
                    clearDirty();
                    renderToolsList();
                }
                setToolsStatus(result.kind ? `Logo refreshed (${result.kind})` : 'Logo refresh complete');
                ui().showToast?.('Website logo refreshed.', 'success');
            } catch (error) {
                if (Array.isArray(error.tools)) {
                    toolsState = error.tools;
                    renderToolsList();
                }
                setToolsStatus(error.message || 'Logo refresh failed', true);
                ui().showToast?.(error.message || 'Logo refresh failed', 'error');
            }
        }

        document.addEventListener('change', (event) => {
            const enabledToggle = event.target.closest?.('.tools-enabled-toggle');
            if (enabledToggle?.dataset.toolId) {
                const toolId = enabledToggle.dataset.toolId;
                const enabled = Boolean(enabledToggle.checked);
                const nowIso = new Date().toISOString();
                toolsState = toolsState.map((tool) => {
                    if (tool.id !== toolId) {
                        return tool;
                    }
                    return {
                        ...tool,
                        enabled,
                        featured: enabled ? tool.featured : false,
                        homepageOrder: enabled ? tool.homepageOrder : 999,
                        updatedAt: nowIso
                    };
                });
                markDirty();
                renderToolsList();
                return;
            }

            const homepageToggle = event.target.closest?.('.tools-homepage-toggle');
            if (homepageToggle?.dataset.toolId) {
                const toolId = homepageToggle.dataset.toolId;
                const tool = findTool(toolId);
                if (!tool || !tool.enabled) {
                    homepageToggle.checked = false;
                    return;
                }
                const featured = Boolean(homepageToggle.checked);
                const nextHomepageOrder = featured
                    ? (tool.homepageOrder && tool.homepageOrder < 999
                        ? tool.homepageOrder
                        : toolsState.filter((item) => item.featured).length + 1)
                    : 999;
                const nowIso = new Date().toISOString();
                toolsState = toolsState.map((item) => (
                    item.id === toolId
                        ? { ...item, featured, homepageOrder: nextHomepageOrder, updatedAt: nowIso }
                        : item
                ));
                markDirty();
                renderToolsList();
            }
        });
    }

    window.renderFeaturedAdminList = renderFeaturedAdminList;

    window.initToolsAdmin = function initToolsAdmin() {
        bindToolsAdmin();
        loadToolsCatalog();
    };

    window.reloadToolsAdmin = loadToolsCatalog;
})();
