(function(global) {
    'use strict';

    const SECTION_ORDER = ['pattern', 'motion', 'audio', 'sync', 'resolution', 'branding', 'output', 'export'];

    const SECTION_LABELS = {
        pattern: 'Pattern',
        motion: 'Motion',
        audio: 'Audio',
        sync: 'Sync',
        resolution: 'Resolution',
        branding: 'Branding',
        output: 'Output',
        export: 'Export'
    };

    const DEFAULT_OPEN_SECTIONS = new Set(['pattern', 'motion', 'output']);

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function getControlUtils() {
        return global.OkamiSignalLab?.ControlUtils;
    }

    function getControlVisibility(control, state) {
        if (control.type === 'section') {
            return { hidden: false, disabled: false, isLegacySection: true };
        }

        if (typeof control.enabledWhen === 'function' && !control.enabledWhen(state)) {
            return { hidden: true, disabled: false };
        }

        if (typeof control.disabledWhen === 'function' && control.disabledWhen(state)) {
            return { hidden: false, disabled: true };
        }

        if (typeof control.disabled === 'function' && control.disabled(state)) {
            return { hidden: false, disabled: true };
        }

        if (control.disabled === true) {
            return { hidden: false, disabled: true };
        }

        return { hidden: false, disabled: false };
    }

    function normalizeSection(control, moduleId) {
        if (control.section) {
            return control.section;
        }

        if (control.type === 'section') {
            return 'branding';
        }

        if (moduleId === 'export') {
            if (control.key === 'customWidth' || control.key === 'customHeight' || control.key === 'resolutionPreset') {
                return 'resolution';
            }
            if (
                control.key?.includes('Watermark')
                || control.key?.includes('logoWatermark')
            ) {
                return 'branding';
            }
            return 'export';
        }

        if (moduleId === 'branding') {
            return 'branding';
        }

        if (moduleId === 'motion-patterns' || moduleId === 'sync-tools') {
            if (control.key === 'patternId' || control.key === 'mode') {
                return 'pattern';
            }
            if (moduleId === 'sync-tools') {
                return 'sync';
            }
            return 'motion';
        }

        if (moduleId === 'video-patterns') {
            if (control.key === 'motionPlaying') {
                return 'motion';
            }
            if (control.key === 'toneEnabled') {
                return 'audio';
            }
            return 'pattern';
        }

        if (moduleId === 'display-info' || moduleId === 'led-utilities') {
            return 'resolution';
        }

        if (moduleId === 'audio-tools') {
            return 'audio';
        }

        return 'pattern';
    }

    function groupSchemaIntoSections(schema, state, moduleId) {
        const groups = new Map();

        schema.forEach((control) => {
            if (control.type === 'section') {
                return;
            }

            const visibility = getControlVisibility(control, state);
            if (visibility.hidden) {
                return;
            }

            const sectionId = normalizeSection(control, moduleId);
            if (!groups.has(sectionId)) {
                groups.set(sectionId, []);
            }
            groups.get(sectionId).push({ control, disabled: visibility.disabled });
        });

        return SECTION_ORDER
            .filter((id) => groups.has(id))
            .map((id) => ({
                id,
                label: SECTION_LABELS[id] || id,
                items: groups.get(id)
            }));
    }

    function controlShell(content, control, disabled, extraClass = '') {
        const disabledClass = disabled ? ' signal-lab-control--disabled' : '';
        const disabledAttr = disabled ? ' aria-disabled="true"' : '';
        return `<div class="signal-lab-control${disabledClass}${extraClass ? ` ${extraClass}` : ''}" data-control-key="${control.key || ''}"${disabledAttr}>${content}</div>`;
    }

    function disabledAttrs(disabled) {
        return disabled ? ' disabled' : '';
    }

    function formatUnit(control) {
        const utils = getControlUtils();
        if (utils?.isPercentRangeControl(control)) {
            return '%';
        }
        const unit = (control.unit || '').trim();
        return unit;
    }

    function controlExtraClass(base, extra) {
        return [base, extra].filter(Boolean).join(' ');
    }

    function renderControl(control, state, disabled, extraClass = '') {
        const current = state?.[control.key];
        const dis = disabledAttrs(disabled);

        if (control.type === 'select') {
            const options = (control.options || []).map((opt) => {
                const selected = current === opt.value ? ' selected' : '';
                return `<option value="${escapeHtml(opt.value)}"${selected}>${escapeHtml(opt.label)}</option>`;
            }).join('');

            return controlShell(`
                <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${escapeHtml(control.label)}</label>
                <select id="sl-ctrl-${control.key}" class="led-select signal-lab-select signal-lab-field"
                    data-control-key="${control.key}" data-control-type="select"${dis}>
                    ${options}
                </select>
            `, control, disabled, extraClass);
        }

        if (control.type === 'range') {
            const utils = getControlUtils();
            const val = current ?? control.min ?? 0;
            const isPercent = utils?.isPercentRangeControl(control);
            const displayVal = utils ? utils.rangeToDisplay(val, control) : val;
            const unit = formatUnit(control);
            const numMin = isPercent ? utils.rangeToDisplay(control.min, control) : control.min;
            const numMax = isPercent ? utils.rangeToDisplay(control.max, control) : control.max;
            const numStep = isPercent ? utils.rangeToDisplay(control.step, control) : (control.step || 0.1);

            return controlShell(`
                <div class="signal-lab-range-header">
                    <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${escapeHtml(control.label)}</label>
                    <div class="signal-lab-value-field">
                        <input type="number" id="sl-ctrl-num-${control.key}" class="signal-lab-range-input signal-lab-field"
                            data-control-key="${control.key}" data-control-type="range-number"
                            min="${numMin}" max="${numMax}" step="${numStep}" value="${displayVal}"
                            aria-label="${escapeHtml(control.label)} value"${dis}>
                        ${unit ? `<span class="signal-lab-field-unit">${escapeHtml(unit)}</span>` : ''}
                    </div>
                </div>
                <input type="range" id="sl-ctrl-${control.key}" class="signal-lab-range"
                    data-control-key="${control.key}" data-control-type="range"
                    min="${control.min}" max="${control.max}" step="${control.step || 0.1}" value="${val}"${dis}>
            `, control, disabled, extraClass);
        }

        if (control.type === 'checkbox') {
            const checked = current ? ' checked' : '';
            return controlShell(`
                <label class="signal-lab-checkbox">
                    <input type="checkbox" id="sl-ctrl-${control.key}" data-control-key="${control.key}" data-control-type="checkbox"${checked}${dis}>
                    <span>${escapeHtml(control.label)}</span>
                </label>
            `, control, disabled, controlExtraClass('signal-lab-control--checkbox', extraClass));
        }

        if (control.type === 'transport') {
            const isOn = current !== false && current !== 'false' && current !== undefined
                ? Boolean(current)
                : control.key === 'active' ? false : true;
            const startLabel = control.startLabel || 'Play';
            const stopLabel = control.stopLabel || 'Pause';
            const transportKey = control.key || 'playing';

            return controlShell(`
                <span class="signal-lab-control-label">${escapeHtml(control.label)}</span>
                <div class="signal-lab-transport">
                    <button type="button" class="led-btn signal-lab-btn signal-lab-transport-btn${isOn ? ' is-active' : ''}"
                        data-control-key="${transportKey}" data-control-value="true" aria-pressed="${isOn ? 'true' : 'false'}"${dis}>${escapeHtml(startLabel)}</button>
                    <button type="button" class="led-btn signal-lab-btn signal-lab-transport-btn${!isOn ? ' is-active' : ''}"
                        data-control-key="${transportKey}" data-control-value="false" aria-pressed="${!isOn ? 'true' : 'false'}"${dis}>${escapeHtml(stopLabel)}</button>
                </div>
            `, control, disabled, extraClass);
        }

        if (control.type === 'peak-meter') {
            return controlShell(`
                <span class="signal-lab-control-label">${escapeHtml(control.label)}</span>
                <div class="signal-lab-peak-meter">
                    <div class="signal-lab-peak-track">
                        <div class="signal-lab-peak-fill" data-peak-fill style="width: 0%"></div>
                    </div>
                    <span class="signal-lab-peak-label" data-peak-label">−∞ dB</span>
                </div>
            `, control, disabled, controlExtraClass('signal-lab-control--meter', extraClass));
        }

        if (control.type === 'display-metrics') {
            const rows = [
                { key: 'screenWidth', label: 'Screen Width' },
                { key: 'screenHeight', label: 'Screen Height' },
                { key: 'viewportWidth', label: 'Viewport Width' },
                { key: 'viewportHeight', label: 'Viewport Height' },
                { key: 'aspectRatio', label: 'Aspect Ratio' },
                { key: 'devicePixelRatio', label: 'Device Pixel Ratio' },
                { key: 'refreshRate', label: 'Est. Refresh Rate' },
                { key: 'fullscreen', label: 'Fullscreen Status' }
            ].map((row) => `
                <div class="signal-lab-display-metric">
                    <span class="signal-lab-display-metric-label">${row.label}</span>
                    <span class="signal-lab-display-metric-value" data-metric-value="${row.key}">—</span>
                </div>
            `).join('');

            return controlShell(`
                <div class="signal-lab-display-metrics" data-display-metrics-root>${rows}</div>
            `, control, disabled, controlExtraClass('signal-lab-control--display-metrics', extraClass));
        }

        if (control.type === 'led-wall-metrics') {
            const rows = [
                { key: 'resolutionLabel', label: 'Exact Resolution' },
                { key: 'totalWidth', label: 'Total Width' },
                { key: 'totalHeight', label: 'Total Height' },
                { key: 'exactAspectRatio', label: 'Exact Aspect Ratio' },
                { key: 'closestAspectLabel', label: 'Closest Common Aspect' },
                { key: 'closestAspectDeviationPct', label: 'Aspect Deviation' },
                { key: 'panelSizeLabel', label: 'Panel Size' },
                { key: 'wallGridLabel', label: 'Wall Grid' }
            ].map((row) => `
                <div class="signal-lab-display-metric">
                    <span class="signal-lab-display-metric-label">${row.label}</span>
                    <span class="signal-lab-display-metric-value" data-led-metric-value="${row.key}">—</span>
                </div>
            `).join('');

            return controlShell(`
                <div class="signal-lab-display-metrics" data-led-wall-metrics-root>${rows}</div>
                <div class="signal-lab-led-warnings-wrap">
                    <span class="signal-lab-control-label">Scaling Warnings</span>
                    <ul class="signal-lab-led-warnings" data-led-wall-warnings>
                        <li class="signal-lab-led-warning">—</li>
                    </ul>
                </div>
            `, control, disabled, controlExtraClass('signal-lab-control--led-metrics', extraClass));
        }

        if (control.type === 'text') {
            const value = current ?? control.placeholder ?? '';
            return controlShell(`
                <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${escapeHtml(control.label)}</label>
                <input type="text" id="sl-ctrl-${control.key}" class="signal-lab-text-input signal-lab-field"
                    data-control-key="${control.key}" data-control-type="text"
                    value="${escapeHtml(value)}"
                    placeholder="${escapeHtml(control.placeholder || '')}" maxlength="${control.maxLength || 120}"${dis}>
            `, control, disabled, extraClass);
        }

        if (control.type === 'number') {
            const val = current ?? control.min ?? 0;
            const unit = formatUnit(control);
            return controlShell(`
                <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${escapeHtml(control.label)}</label>
                <div class="signal-lab-value-field${unit ? '' : ' signal-lab-value-field--solo'}">
                    <input type="number" id="sl-ctrl-${control.key}" class="signal-lab-number-input signal-lab-field"
                        data-control-key="${control.key}" data-control-type="number"
                        min="${control.min}" max="${control.max}" step="${control.step || 1}" value="${val}"${dis}>
                    ${unit ? `<span class="signal-lab-field-unit">${escapeHtml(unit)}</span>` : ''}
                </div>
            `, control, disabled, extraClass);
        }

        if (control.type === 'action') {
            return controlShell(`
                <button type="button" class="led-btn signal-lab-btn signal-lab-action-btn"
                    data-control-key="${control.key}" data-control-type="action"${dis}>${escapeHtml(control.buttonLabel || control.label)}</button>
            `, control, disabled, controlExtraClass('signal-lab-control--action', extraClass));
        }

        if (control.type === 'file-upload') {
            const hasFile = Boolean(current);
            return controlShell(`
                <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${escapeHtml(control.label)}</label>
                <input type="file" id="sl-ctrl-${control.key}" class="signal-lab-file-input signal-lab-field"
                    data-control-key="${control.key}" data-control-type="file-upload"
                    accept="${control.accept || 'image/*'}"${dis}>
                <div class="signal-lab-file-meta">
                    <span class="signal-lab-file-status">${hasFile ? 'Image loaded' : 'No image uploaded'}</span>
                    ${hasFile && !disabled ? `<button type="button" class="led-btn led-btn-text signal-lab-btn signal-lab-file-clear" data-clear-upload data-control-key="${control.key}">Remove</button>` : ''}
                </div>
            `, control, disabled, controlExtraClass('signal-lab-control--file', extraClass));
        }

        if (control.type === 'radio') {
            const options = (control.options || []).map((opt) => {
                const checked = (current || control.options[0]?.value) === opt.value ? ' checked' : '';
                return `
                    <label class="signal-lab-radio">
                        <input type="radio" name="sl-radio-${control.key}" value="${escapeHtml(opt.value)}"
                            data-control-key="${control.key}" data-control-type="radio"${checked}${dis}>
                        <span>${escapeHtml(opt.label)}</span>
                    </label>
                `;
            }).join('');

            return controlShell(`
                <span class="signal-lab-control-label">${escapeHtml(control.label)}</span>
                <div class="signal-lab-radio-group">${options}</div>
            `, control, disabled, extraClass);
        }

        return '';
    }

    function buildOptionsHtml(schema, state, moduleId) {
        const sections = groupSchemaIntoSections(schema, state, moduleId);
        if (!sections.length) {
            return '';
        }

        return sections.map((section) => {
            const openByDefault = DEFAULT_OPEN_SECTIONS.has(section.id)
                || (moduleId === 'export' && section.id === 'export')
                || (moduleId === 'branding' && section.id === 'branding');
            const open = openByDefault ? ' open' : '';
            const controlsHtml = section.items
                .map(({ control, disabled }) => renderControl(control, state, disabled))
                .join('');

            return `
                <details class="signal-lab-collapsible" data-section="${section.id}"${open}>
                    <summary class="signal-lab-collapsible-summary">${escapeHtml(section.label)}</summary>
                    <div class="signal-lab-collapsible-body">
                        ${controlsHtml}
                    </div>
                </details>
            `;
        }).join('');
    }

    function buildToolbarHtml(schema, state, moduleId) {
        const sections = groupSchemaIntoSections(schema, state, moduleId);
        if (!sections.length) {
            return '';
        }

        const groups = sections.map((section) => {
            const controlsHtml = section.items
                .map(({ control, disabled }) => renderControl(control, state, disabled, 'signal-lab-toolbar-control'))
                .join('');

            return `
                <div class="signal-lab-toolbar-group" data-section="${section.id}">
                    <span class="signal-lab-toolbar-label">${escapeHtml(section.label)}</span>
                    <div class="signal-lab-toolbar-controls">${controlsHtml}</div>
                </div>
            `;
        }).join('');

        return `<div class="signal-lab-toolbar">${groups}</div>`;
    }

    function flattenSchema(schema, state, moduleId) {
        return groupSchemaIntoSections(schema, state, moduleId)
            .flatMap((section) => section.items.map((item) => item.control));
    }

    const REBUILD_OPTION_KEYS = new Set([
        'patternId',
        'mode',
        'resolutionPreset',
        'logoEnabled',
        'textEnabled',
        'logoWatermarkEnabled',
        'textWatermarkEnabled'
    ]);

    function shouldRebuildOptions(key) {
        return REBUILD_OPTION_KEYS.has(key);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.ControlUI = {
        SECTION_ORDER,
        SECTION_LABELS,
        getControlVisibility,
        groupSchemaIntoSections,
        buildOptionsHtml,
        buildToolbarHtml,
        flattenSchema,
        shouldRebuildOptions,
        renderControl
    };
})(typeof window !== 'undefined' ? window : globalThis);
