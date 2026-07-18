(function() {
    'use strict';

    const catalogApi = () => window.OkamiShared?.ToolsCatalog;
    const ui = () => window.OkamiAdminUi || {};

    let toolsState = [];
    let toolsDirty = false;
    let toolsBound = false;

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

    function setToolsStatus(message, isError = false) {
        const status = document.getElementById('tools-save-status');
        if (!status) {
            return;
        }
        if (!message) {
            status.hidden = true;
            status.textContent = '';
            return;
        }
        status.hidden = false;
        status.textContent = message;
        status.classList.toggle('is-error', Boolean(isError));
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
        setToolsStatus('Unsaved changes. Click Save Tools to publish.');
        setFeaturedStatus('Unsaved featured changes. Click Save Featured Order.');
        window.OkamiAdminTabs?.refreshOverview?.();
    }

    function sortState() {
        const api = catalogApi();
        toolsState = api?.reindexDisplayOrder
            ? api.reindexDisplayOrder(toolsState)
            : toolsState
                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                .map((tool, index) => ({ ...tool, displayOrder: index + 1 }));
        if (api?.reindexHomepageOrder) {
            toolsState = api.reindexHomepageOrder(toolsState);
        }
    }

    window.OkamiAdminState = {
        hasUnsavedChanges: () => toolsDirty
    };

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
        const href = catalogApi()?.resolveToolHref?.(tool) || tool.url || '#';
        const imageUrl = resolvePreviewImageUrl(tool);
        const thumb = imageUrl
            ? `<img class="tools-admin-row-thumb" src="${escapeHtml(imageUrl)}" alt="" width="40" height="40">`
            : `<span class="tools-admin-row-thumb tools-admin-row-thumb--fallback" aria-hidden="true">${escapeHtml((tool.title || 'T').charAt(0).toUpperCase())}</span>`;
        return `
            <div class="visibility-page-row tools-admin-row" data-tool-id="${escapeHtml(tool.id)}">
                <div class="visibility-page-order" aria-label="Reorder tool">
                    <span class="visibility-page-order-num" aria-label="Order">${orderNumber}</span>
                    <button type="button" class="visibility-order-btn tools-order-up" data-tool-id="${escapeHtml(tool.id)}" aria-label="Move ${escapeHtml(tool.title)} up">↑</button>
                    <button type="button" class="visibility-order-btn tools-order-down" data-tool-id="${escapeHtml(tool.id)}" aria-label="Move ${escapeHtml(tool.title)} down">↓</button>
                </div>
                ${thumb}
                <div class="visibility-page-info">
                    <span class="visibility-page-name">${escapeHtml(tool.title)}</span>
                    <span class="visibility-page-path">${escapeHtml(tool.category || 'Tool')} · ${escapeHtml(tool.contentType || 'tool')} · ${escapeHtml(href)}</span>
                    <span class="visibility-page-kind">${tool.listOnToolsPage === false ? 'Hidden from Tools page · ' : ''}${tool.featured ? 'On homepage · ' : ''}${escapeHtml(tool.linkType || 'internal')} · Image: ${escapeHtml(tool.imageSource || 'upload')}</span>
                </div>
                <label class="visibility-switch">
                    <input type="checkbox" class="tools-enabled-toggle" data-tool-id="${escapeHtml(tool.id)}"${tool.enabled ? ' checked' : ''}>
                    <span class="visibility-switch-slider" aria-hidden="true"></span>
                    <span class="visibility-switch-text">Published</span>
                </label>
                <label class="visibility-switch">
                    <input type="checkbox" class="tools-homepage-toggle" data-tool-id="${escapeHtml(tool.id)}"${tool.featured ? ' checked' : ''}${tool.enabled ? '' : ' disabled'}>
                    <span class="visibility-switch-slider" aria-hidden="true"></span>
                    <span class="visibility-switch-text">Show on Homepage</span>
                </label>
                <div class="tools-admin-row-actions">
                    <button type="button" class="visibility-secondary-button tools-preview-btn" data-tool-id="${escapeHtml(tool.id)}">Preview</button>
                    <button type="button" class="visibility-secondary-button tools-edit-btn" data-tool-id="${escapeHtml(tool.id)}">Edit</button>
                    <button type="button" class="visibility-secondary-button tools-duplicate-btn" data-tool-id="${escapeHtml(tool.id)}">Duplicate</button>
                    ${tool.imageSource === 'website' ? `<button type="button" class="visibility-secondary-button tools-refresh-logo-btn" data-tool-id="${escapeHtml(tool.id)}">Refresh Logo</button>` : ''}
                    <button type="button" class="visibility-secondary-button tools-delete-btn tools-delete-btn--danger" data-tool-id="${escapeHtml(tool.id)}">Delete</button>
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
                <label class="visibility-switch">
                    <input type="checkbox" class="tools-homepage-toggle" data-tool-id="${escapeHtml(tool.id)}"${tool.featured ? ' checked' : ''}${tool.enabled ? '' : ' disabled'}>
                    <span class="visibility-switch-slider" aria-hidden="true"></span>
                    <span class="visibility-switch-text">Show on Homepage</span>
                </label>
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
        sortState();
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
            .map((tool) => `
                <div class="visibility-page-row tools-admin-row" data-tool-id="${escapeHtml(tool.id)}">
                    <div class="visibility-page-info">
                        <span class="visibility-page-name">${escapeHtml(tool.title)}</span>
                        <span class="visibility-page-path">${escapeHtml(tool.contentType || 'tool')} · not on homepage</span>
                    </div>
                    <label class="visibility-switch">
                        <input type="checkbox" class="tools-homepage-toggle" data-tool-id="${escapeHtml(tool.id)}">
                        <span class="visibility-switch-slider" aria-hidden="true"></span>
                        <span class="visibility-switch-text">Show on Homepage</span>
                    </label>
                    <div class="tools-admin-row-actions">
                        <button type="button" class="visibility-secondary-button tools-edit-btn" data-tool-id="${escapeHtml(tool.id)}">Edit source</button>
                    </div>
                </div>
            `).join('');
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
        const rows = [...container.querySelectorAll('.tools-admin-row')];
        rows.forEach((row, index) => {
            const orderNum = row.querySelector('.visibility-page-order-num');
            if (orderNum) {
                orderNum.textContent = String(index + 1);
            }
            const up = row.querySelector('.tools-order-up');
            const down = row.querySelector('.tools-order-down');
            if (up) {
                up.disabled = index === 0;
            }
            if (down) {
                down.disabled = index === rows.length - 1;
            }
        });
    }

    function renderToolsList() {
        const container = document.getElementById('tools-admin-list');
        if (!container) {
            return;
        }
        sortState();
        if (!toolsState.length) {
            container.innerHTML = '<p class="visibility-page-list-error">No tools yet. Add your first tool to populate the public Tools page.</p>';
            return;
        }
        container.innerHTML = toolsState.map((tool, index) => buildToolRow(tool, index + 1)).join('');
        updateOrderButtons();
        renderFeaturedAdminList();
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
        toolsState = copy;
        sortState();
        markDirty();
        renderToolsList();
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

    async function openToolEditor(existing = null) {
        const openModal = ui().openModal;
        const closeModal = ui().closeModal;
        if (!openModal || !closeModal) {
            return;
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
            featured: false,
            listOnToolsPage: true,
            homepageOrder: 999,
            heroImageUrl: '',
            features: [],
            screenshots: [],
            supportUrl: '',
            pageKey: null
        };

        const form = buildToolForm(draft);
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
            // Persist current form values into state so refresh uses the latest URL.
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

        const result = await openModal({
            title: existing ? `Edit ${existing.title}` : 'Add Tool',
            content: form,
            actions: [
                { label: 'Cancel', value: null, variant: 'secondary' },
                {
                    label: 'Save Tool',
                    variant: 'primary',
                    handler: (event) => {
                        event.preventDefault();
                        const tool = readToolForm(form, draft);
                        const api = catalogApi();
                        const normalized = api?.normalizeTool
                            ? api.normalizeTool(tool, 0)
                            : tool;
                        const catalog = { tools: toolsState.filter((item) => item.id !== normalized.id).concat([normalized]) };
                        const errors = api?.validateToolForSave?.(normalized, catalog) || [];
                        if (!normalized.title || !normalized.url) {
                            errors.push('Title and destination URL are required.');
                        }
                        if (errors.length) {
                            ui().showToast?.(errors[0], 'error');
                            return;
                        }
                        closeModal(normalized);
                    }
                }
            ]
        });

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
        ui().showToast?.('Tool duplicated. Save Tools to publish.', 'success');
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

    async function loadToolsCatalog() {
        setToolsStatus('Loading tools…');
        try {
            if (typeof getManagedTools !== 'function') {
                throw new Error('Tools API client missing');
            }
            const data = await getManagedTools();
            toolsState = Array.isArray(data.tools) ? data.tools : [];
            toolsDirty = false;
            renderToolsList();
            setToolsStatus(data.updatedAt ? `Loaded · last saved ${new Date(data.updatedAt).toLocaleString()}` : 'Loaded');
        } catch (error) {
            console.error(error);
            setToolsStatus(error.message || 'Failed to load tools', true);
        }
    }

    async function saveToolsCatalog() {
        setToolsStatus('Saving…');
        try {
            sortState();
            const result = await saveManagedTools({
                version: 1,
                tools: toolsState
            });
            toolsState = Array.isArray(result.tools) ? result.tools : toolsState;
            toolsDirty = false;
            renderToolsList();
            setToolsStatus(`Saved ${new Date(result.updatedAt || Date.now()).toLocaleString()}`);
            setFeaturedStatus(`Saved ${new Date(result.updatedAt || Date.now()).toLocaleString()}`);
            ui().showToast?.('Tools catalog saved.', 'success');
            window.OkamiAdminTabs?.refreshOverview?.();
        } catch (error) {
            console.error(error);
            setToolsStatus(error.message || 'Failed to save tools', true);
            setFeaturedStatus(error.message || 'Failed to save featured order', true);
            ui().showToast?.(error.message || 'Failed to save tools', 'error');
        }
    }

    function bindToolsAdmin() {
        if (toolsBound) {
            return;
        }
        toolsBound = true;

        document.getElementById('add-tool-btn')?.addEventListener('click', () => openToolEditor(null));
        document.getElementById('save-tools-catalog')?.addEventListener('click', saveToolsCatalog);
        document.getElementById('reload-tools-catalog')?.addEventListener('click', loadToolsCatalog);
        document.getElementById('save-featured-catalog')?.addEventListener('click', saveToolsCatalog);

        document.addEventListener('click', (event) => {
            const toolsList = document.getElementById('tools-admin-list');
            const featuredList = document.getElementById('featured-admin-list');
            const inTools = toolsList?.contains(event.target);
            const inFeatured = featuredList?.contains(event.target);
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
            const dup = event.target.closest('.tools-duplicate-btn');
            if (dup?.dataset.toolId) {
                duplicateTool(dup.dataset.toolId);
                return;
            }
            const del = event.target.closest('.tools-delete-btn');
            if (del?.dataset.toolId) {
                deleteTool(del.dataset.toolId);
                return;
            }
            const refresh = event.target.closest('.tools-refresh-logo-btn');
            if (refresh?.dataset.toolId) {
                refreshLogoForTool(refresh.dataset.toolId);
            }
        });

        async function refreshLogoForTool(toolId) {
            try {
                setToolsStatus('Refreshing website logo…');
                // Persist any pending order/enabled edits first so refresh does not clobber them.
                if (toolsDirty) {
                    await saveToolsCatalog();
                }
                const result = await refreshToolWebsiteLogo(toolId);
                if (Array.isArray(result.tools)) {
                    toolsState = result.tools;
                    toolsDirty = false;
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
                const tool = findTool(enabledToggle.dataset.toolId);
                if (!tool) return;
                tool.enabled = Boolean(enabledToggle.checked);
                if (!tool.enabled) {
                    tool.featured = false;
                }
                tool.updatedAt = new Date().toISOString();
                markDirty();
                renderToolsList();
                return;
            }

            const homepageToggle = event.target.closest?.('.tools-homepage-toggle');
            if (homepageToggle?.dataset.toolId) {
                const tool = findTool(homepageToggle.dataset.toolId);
                if (!tool || !tool.enabled) return;
                tool.featured = Boolean(homepageToggle.checked);
                tool.homepageOrder = tool.featured
                    ? (tool.homepageOrder && tool.homepageOrder < 999 ? tool.homepageOrder : toolsState.filter((t) => t.featured).length)
                    : 999;
                tool.updatedAt = new Date().toISOString();
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
