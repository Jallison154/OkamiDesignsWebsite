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

    function getComponents() {
        return global.OkamiSignalLab?.ControlComponents;
    }

    function getControlUtils() {
        return global.OkamiSignalLab?.ControlUtils;
    }

    function escapeHtml(value) {
        return getComponents()?.escapeHtml?.(value) ?? String(value);
    }

    function disabledAttrs(disabled) {
        return getComponents()?.disabledAttrs?.(disabled) ?? (disabled ? ' disabled' : '');
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

    function formatUnit(control) {
        const utils = getControlUtils();
        if (utils?.isPercentRangeControl(control)) {
            return '%';
        }
        return (control.unit || '').trim();
    }

    function controlExtraClass(base, extra) {
        return [base, extra].filter(Boolean).join(' ');
    }

    function renderControlRowFromParts(parts, layout, disabled, extraClass, controlKey, modifier) {
        const CC = getComponents();
        if (!CC) {
            return '';
        }
        return CC.renderControlRow({
            labelHtml: parts.labelHtml,
            bodyHtml: parts.bodyHtml,
            layout,
            disabled,
            extraClass,
            controlKey,
            modifier
        });
    }

    function renderControl(control, state, disabled, extraClass = '', layout = 'stacked') {
        const CC = getComponents();
        const CL = CC?.CLASSES || {};
        const current = state?.[control.key];
        const dis = disabledAttrs(disabled);
        const isInline = layout === 'inline' || extraClass.includes('toolbar');

        if (control.type === 'select') {
            const id = `sl-ctrl-${control.key}`;
            const body = CC.renderSelect(id, control.key, control.options, current, disabled);
            return renderControlRowFromParts(
                { labelHtml: CC.renderLabel(control.label, id), bodyHtml: body },
                isInline ? 'inline' : 'stacked',
                disabled,
                extraClass,
                control.key
            );
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
            const id = `sl-ctrl-${control.key}`;

            const numberInput = `<input type="number" id="sl-ctrl-num-${control.key}" class="signal-lab-range-input ${CL.field}"
                data-control-key="${control.key}" data-control-type="range-number"
                min="${numMin}" max="${numMax}" step="${numStep}" value="${displayVal}"
                aria-label="${escapeHtml(control.label)} value"${dis}>`;

            const body = `
                ${CC.renderValueField(numberInput, unit)}
                <input type="range" id="${id}" class="signal-lab-range"
                    data-control-key="${control.key}" data-control-type="range"
                    min="${control.min}" max="${control.max}" step="${control.step || 0.1}" value="${val}"${dis}>
            `;

            return renderControlRowFromParts(
                { labelHtml: CC.renderLabel(control.label, id), bodyHtml: body },
                isInline ? 'inline' : 'range',
                disabled,
                extraClass,
                control.key
            );
        }

        if (control.type === 'checkbox') {
            const id = `sl-ctrl-${control.key}`;
            const body = `
                <label class="${CL.checkbox}">
                    <input type="checkbox" id="${id}" data-control-key="${control.key}" data-control-type="checkbox"${current ? ' checked' : ''}${dis}>
                    <span>${escapeHtml(control.label)}</span>
                </label>
            `;
            return renderControlRowFromParts(
                { labelHtml: '', bodyHtml: body },
                'inline',
                disabled,
                controlExtraClass('signal-lab-control-row--checkbox', extraClass),
                control.key
            );
        }

        if (control.type === 'transport') {
            const isOn = current !== false && current !== 'false' && current !== undefined
                ? Boolean(current)
                : control.key === 'active' ? false : true;
            const startLabel = control.startLabel || 'Play';
            const stopLabel = control.stopLabel || 'Pause';
            const transportKey = control.key || 'playing';

            const body = `
                <div class="${CL.transport}">
                    <button type="button" class="${CL.btn} ${CL.transportBtn}${isOn ? ' is-active' : ''}"
                        data-control-key="${transportKey}" data-control-value="true" aria-pressed="${isOn ? 'true' : 'false'}"${dis}>${escapeHtml(startLabel)}</button>
                    <button type="button" class="${CL.btn} ${CL.transportBtn}${!isOn ? ' is-active' : ''}"
                        data-control-key="${transportKey}" data-control-value="false" aria-pressed="${!isOn ? 'true' : 'false'}"${dis}>${escapeHtml(stopLabel)}</button>
                </div>
            `;

            return renderControlRowFromParts(
                { labelHtml: CC.renderLabel(control.label), bodyHtml: body },
                'inline',
                disabled,
                extraClass,
                transportKey
            );
        }

        if (control.type === 'peak-meter') {
            const body = `
                <div class="signal-lab-peak-meter">
                    <div class="signal-lab-peak-track">
                        <div class="signal-lab-peak-fill" data-peak-fill style="width: 0%"></div>
                    </div>
                    <span class="signal-lab-peak-label" data-peak-label">−∞ dB</span>
                </div>
            `;
            return renderControlRowFromParts(
                { labelHtml: CC.renderLabel(control.label), bodyHtml: body },
                isInline ? 'inline' : 'stacked',
                disabled,
                controlExtraClass('signal-lab-control-row--meter', extraClass),
                control.key
            );
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

            return renderControlRowFromParts(
                { labelHtml: '', bodyHtml: `<div class="signal-lab-display-metrics" data-display-metrics-root>${rows}</div>` },
                'stacked',
                disabled,
                controlExtraClass('signal-lab-control-row--display-metrics', extraClass),
                control.key
            );
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

            const body = `
                <div class="signal-lab-display-metrics" data-led-wall-metrics-root>${rows}</div>
                <div class="signal-lab-led-warnings-wrap">
                    ${CC.renderLabel('Scaling Warnings')}
                    <ul class="signal-lab-led-warnings" data-led-wall-warnings>
                        <li class="signal-lab-led-warning">—</li>
                    </ul>
                </div>
            `;

            return renderControlRowFromParts(
                { labelHtml: '', bodyHtml: body },
                'stacked',
                disabled,
                controlExtraClass('signal-lab-control-row--led-metrics', extraClass),
                control.key
            );
        }

        if (control.type === 'text') {
            const id = `sl-ctrl-${control.key}`;
            const value = current ?? control.placeholder ?? '';
            const body = CC.renderTextInput(id, control.key, value, disabled, {
                placeholder: control.placeholder || '',
                maxLength: control.maxLength || 120
            });
            return renderControlRowFromParts(
                { labelHtml: CC.renderLabel(control.label, id), bodyHtml: body },
                isInline ? 'inline' : 'stacked',
                disabled,
                extraClass,
                control.key
            );
        }

        if (control.type === 'number') {
            const id = `sl-ctrl-${control.key}`;
            const val = current ?? control.min ?? 0;
            const unit = formatUnit(control);
            const input = CC.renderNumberInput(id, control.key, val, control, disabled);
            const body = CC.renderValueField(input, unit);
            return renderControlRowFromParts(
                { labelHtml: CC.renderLabel(control.label, id), bodyHtml: body },
                isInline ? 'inline' : 'stacked',
                disabled,
                extraClass,
                control.key
            );
        }

        if (control.type === 'action') {
            const body = CC.renderButton(control.buttonLabel || control.label, {
                controlKey: control.key,
                controlType: 'action',
                disabled,
                extraClass: 'signal-lab-action-btn'
            });
            return renderControlRowFromParts(
                { labelHtml: '', bodyHtml: body },
                'inline',
                disabled,
                controlExtraClass('signal-lab-control-row--action', extraClass),
                control.key
            );
        }

        if (control.type === 'file-upload') {
            const id = `sl-ctrl-${control.key}`;
            const hasFile = Boolean(current);
            const body = `
                <input type="file" id="${id}" class="signal-lab-file-input ${CL.field}"
                    data-control-key="${control.key}" data-control-type="file-upload"
                    accept="${control.accept || 'image/*'}"${dis}>
                <div class="signal-lab-file-meta">
                    <span class="signal-lab-file-status">${hasFile ? 'Image loaded' : 'No image uploaded'}</span>
                    ${hasFile && !disabled ? `<button type="button" class="${CL.btn} ${CL.btnText} signal-lab-file-clear" data-clear-upload data-control-key="${control.key}">Remove</button>` : ''}
                </div>
            `;
            return renderControlRowFromParts(
                { labelHtml: CC.renderLabel(control.label, id), bodyHtml: body },
                'stacked',
                disabled,
                controlExtraClass('signal-lab-control-row--file', extraClass),
                control.key
            );
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

            return renderControlRowFromParts(
                { labelHtml: CC.renderLabel(control.label), bodyHtml: `<div class="signal-lab-radio-group">${options}</div>` },
                isInline ? 'inline' : 'stacked',
                disabled,
                extraClass,
                control.key
            );
        }

        return '';
    }

    function buildOptionsHtml(schema, state, moduleId) {
        const CC = getComponents();
        const sections = groupSchemaIntoSections(schema, state, moduleId);
        if (!sections.length || !CC) {
            return '';
        }

        return sections.map((section) => {
            const openByDefault = DEFAULT_OPEN_SECTIONS.has(section.id)
                || (moduleId === 'export' && section.id === 'export')
                || (moduleId === 'branding' && section.id === 'branding');
            const open = openByDefault ? ' open' : '';
            const controlsHtml = section.items
                .map(({ control, disabled }) => renderControl(control, state, disabled, '', 'stacked'))
                .join('');

            return `
                <details class="signal-lab-collapsible" data-section="${section.id}"${open}>
                    ${CC.renderSectionHeader(section.label, { tag: 'summary', extraClass: 'signal-lab-collapsible-summary', attrs: '' })}
                    <div class="signal-lab-collapsible-body">
                        ${controlsHtml}
                    </div>
                </details>
            `;
        }).join('');
    }

    function buildToolbarHtml(schema, state, moduleId) {
        const CC = getComponents();
        const sections = groupSchemaIntoSections(schema, state, moduleId);
        if (!sections.length || !CC) {
            return '';
        }

        const groups = sections.map((section) => {
            const controlsHtml = section.items
                .map(({ control, disabled }) => renderControl(
                    control,
                    state,
                    disabled,
                    'signal-lab-toolbar-control',
                    'inline'
                ))
                .join('');

            return CC.renderSectionGroup(section.id, section.label, controlsHtml);
        }).join('');

        return `<div class="${CC.CLASSES.toolbar}">${groups}</div>`;
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
