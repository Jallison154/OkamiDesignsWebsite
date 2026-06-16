(function(global) {
    'use strict';

    const SECTION_ORDER = ['background', 'pattern', 'motion', 'motion-props', 'audio', 'sync', 'resolution', 'branding', 'output', 'export'];

    const CARD_ORDER = ['pattern', 'motion', 'display', 'output'];

    const DECK_CARD_ORDER = ['pattern', 'motion', 'display'];

    const CARD_LABELS = {
        pattern: 'Pattern',
        motion: 'Motion',
        display: 'Display',
        output: 'Output'
    };

    const DEFAULT_OPEN_CARDS = new Set(['pattern', 'motion', 'display']);

    const MOTION_CARD_KEYS = new Set([
        'playing', 'speed', 'motionBackgroundEnabled', 'reverse', 'active',
        'mode', 'intervalMs', 'motionPlaying'
    ]);

    const OBJECT_CARD_KEYS = new Set([
        'motionSize', 'objectColor', 'motionShape', 'colorMode', 'dvdColor', 'edgeFlash',
        'dvdText', 'dvdLogoDataUrl', 'trailLength', 'trailOpacity', 'orbitRadius',
        'figure8Width', 'figure8Height', 'lineThickness', 'lineSpacing', 'lineColor',
        'gridSize', 'gridLineThickness', 'gridDirection', 'rotationSpeed',
        'crawlText', 'crawlTextSize', 'crawlDirection', 'wrapMode',
        'toneEnabled', 'toneLevelDbfs',
        'logoEnabled', 'logoDataUrl', 'logoSize', 'logoOpacity', 'logoPosition',
        'textEnabled', 'customText', 'textSize', 'textOpacity', 'textPosition',
        'panelWidthPx', 'panelHeightPx', 'panelsWide', 'panelsTall',
        'sourceModuleId', 'format', 'resolutionPreset', 'customWidth', 'customHeight'
    ]);

    const RANDOM_BEHAVIOR_KEYS = new Set([
        'randomMotionType', 'randomPreset', 'objectCount', 'randomnessAmount',
        'directionChangeFreq', 'randomColorMode', 'waypointPauseMs',
        'boundaryBounce', 'wrapEdges', 'smoothMotion', 'randomRotation', 'randomScaleChanges'
    ]);

    const DISPLAY_CARD_KEYS = new Set([
        'backgroundEnabled', 'backgroundType', 'backgroundOpacity', 'gridIntensity',
        'patternResolution', 'scaleMode', 'patternWidth', 'patternHeight'
    ]);

    const SECTION_LABELS = {
        background: 'Background',
        pattern: 'Pattern',
        motion: 'Motion',
        'motion-props': 'Motion Properties',
        audio: 'Audio',
        sync: 'Sync',
        resolution: 'Resolution',
        branding: 'Branding',
        output: 'Output',
        export: 'Export'
    };

    const DEFAULT_OPEN_SECTIONS = new Set(['background', 'pattern', 'motion', 'motion-props', 'output']);

    function resolveCardId(sectionId, control) {
        const key = control?.key;
        if (sectionId === 'pattern' || key === 'patternId') {
            return 'pattern';
        }
        if (DISPLAY_CARD_KEYS.has(key) || sectionId === 'background' || sectionId === 'resolution') {
            return 'display';
        }
        if (sectionId === 'audio' || sectionId === 'sync' || sectionId === 'export' || sectionId === 'output') {
            return 'output';
        }
        return 'motion';
    }

    function groupSchemaIntoCards(layers) {
        const groups = new Map();
        CARD_ORDER.forEach((id) => groups.set(id, []));

        layers.forEach((layer) => {
            const { schema, state, moduleId } = layer;
            (schema || []).forEach((control) => {
                if (control.type === 'section') {
                    return;
                }
                const visibility = getControlVisibility(control, state);
                if (visibility.hidden) {
                    return;
                }
                const sectionId = normalizeSection(control, moduleId);
                const cardId = resolveCardId(sectionId, control);
                if (!groups.has(cardId)) {
                    groups.set(cardId, []);
                }
                groups.get(cardId).push({
                    control,
                    disabled: visibility.disabled,
                    state,
                    moduleId
                });
            });
        });

        return CARD_ORDER
            .filter((id) => groups.get(id)?.length)
            .map((id) => ({
                id,
                label: CARD_LABELS[id] || id,
                items: groups.get(id)
            }));
    }

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
        const isCard = layout === 'card';
        const isInline = layout === 'inline' || extraClass.includes('toolbar');

        if (control.type === 'select') {
            const id = `sl-ctrl-${control.key}`;
            const body = CC.renderSelect(id, control.key, control.options, current, disabled);
            if (isCard) {
                return `
                    <div class="signal-lab-card-field signal-lab-card-field--select${disabled ? ' is-disabled' : ''}" data-control-key="${control.key}">
                        ${CC.renderLabel(control.label, id)}
                        <div class="signal-lab-card-field__body">${body}</div>
                    </div>
                `;
            }
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

            if (isCard) {
                const unitHtml = unit ? `<span class="${CL.fieldUnit}">${escapeHtml(unit)}</span>` : '';
                return `
                    <div class="signal-lab-card-field signal-lab-card-field--range${disabled ? ' is-disabled' : ''}" data-control-key="${control.key}">
                        <div class="signal-lab-card-field__head">
                            ${CC.renderLabel(control.label, id)}
                            <div class="signal-lab-card-field__value">${numberInput}${unitHtml}</div>
                        </div>
                        <input type="range" id="${id}" class="signal-lab-range"
                            data-control-key="${control.key}" data-control-type="range"
                            min="${control.min}" max="${control.max}" step="${control.step || 0.1}" value="${val}"${dis}>
                    </div>
                `;
            }

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
            if (isCard) {
                return `
                    <div class="signal-lab-card-field signal-lab-card-field--checkbox${disabled ? ' is-disabled' : ''}" data-control-key="${control.key}">
                        ${body}
                    </div>
                `;
            }
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

            if (isCard) {
                return `
                    <div class="signal-lab-card-field signal-lab-card-field--transport${disabled ? ' is-disabled' : ''}" data-control-key="${transportKey}">
                        ${CC.renderLabel(control.label)}
                        ${body}
                    </div>
                `;
            }

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

    function renderCard(card, extraHtml = '') {
        const open = DEFAULT_OPEN_CARDS.has(card.id) ? ' open' : '';
        const controlsHtml = card.items
            .map(({ control, disabled, state }) => renderControl(control, state, disabled, '', 'card'))
            .join('');

        if (!controlsHtml && !extraHtml) {
            return '';
        }

        return `
            <details class="signal-lab-card" data-card="${card.id}"${open}>
                <summary class="signal-lab-card__header">${escapeHtml(card.label)}</summary>
                <div class="signal-lab-card__body">
                    ${extraHtml}
                    ${controlsHtml}
                </div>
            </details>
        `;
    }

    function buildControlDeckHtml(layers, staticCards = {}, options = {}) {
        const cardOrder = options.cardOrder || DECK_CARD_ORDER;
        const gridClass = options.gridClass || 'signal-lab-card-grid--deck';
        const cards = groupSchemaIntoCards(layers);
        const merged = cardOrder.map((id) => {
            const dynamic = cards.find((card) => card.id === id);
            const extra = staticCards[id] || '';
            const items = dynamic?.items || [];
            if (!items.length && !extra) {
                return null;
            }
            return {
                id,
                label: CARD_LABELS[id],
                items,
                extraHtml: extra
            };
        }).filter(Boolean);

        if (!merged.length) {
            return '';
        }

        return `<div class="signal-lab-card-grid ${gridClass}">${merged.map((card) => renderCard(card, card.extraHtml)).join('')}</div>`;
    }

    function buildOutputPanelHtml(layers, staticCards = {}) {
        return buildControlDeckHtml(layers, staticCards, {
            cardOrder: ['output'],
            gridClass: 'signal-lab-card-grid--output'
        });
    }

    function flattenDeckLayers(layers) {
        return layers.flatMap((layer) => (
            (layer.schema || [])
                .filter((control) => control.type !== 'section')
                .filter((control) => !getControlVisibility(control, layer.state).hidden)
                .map((control) => ({ control, moduleId: layer.moduleId }))
        ));
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
        return buildControlDeckHtml([{ schema, state, moduleId }]);
    }

    function flattenSchema(schema, state, moduleId) {
        return groupSchemaIntoSections(schema, state, moduleId)
            .flatMap((section) => section.items.map((item) => item.control));
    }

    function flattenSchemaFromLayers(layers) {
        return flattenDeckLayers(layers).map((entry) => entry.control);
    }

    const REBUILD_OPTION_KEYS = new Set([
        'patternId',
        'mode',
        'motionShape',
        'colorMode',
        'resolutionPreset',
        'logoEnabled',
        'textEnabled',
        'logoWatermarkEnabled',
        'textWatermarkEnabled',
        'backgroundEnabled',
        'backgroundType',
        'randomPreset',
        'randomMotionType',
        'randomColorMode',
        'wrapMode',
        'motionShape',
        'scrollDirection',
        'gridDirection',
        'crawlDirection'
    ]);

    function shouldRebuildOptions(key) {
        return REBUILD_OPTION_KEYS.has(key);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.ControlUI = {
        SECTION_ORDER,
        SECTION_LABELS,
        CARD_ORDER,
        DECK_CARD_ORDER,
        CARD_LABELS,
        getControlVisibility,
        groupSchemaIntoSections,
        groupSchemaIntoCards,
        buildOptionsHtml,
        buildToolbarHtml,
        buildControlDeckHtml,
        buildOutputPanelHtml,
        flattenSchema,
        flattenDeckLayers,
        shouldRebuildOptions,
        renderControl
    };
})(typeof window !== 'undefined' ? window : globalThis);
