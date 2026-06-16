(function(global) {
    'use strict';

    /** Shared class names for Signal Lab controls. */
    const CLASSES = {
        controlRow: 'signal-lab-control-row',
        controlRowStacked: 'signal-lab-control-row--stacked',
        controlRowInline: 'signal-lab-control-row--inline',
        controlRowRange: 'signal-lab-control-row--range',
        controlBody: 'signal-lab-control-body',
        label: 'signal-lab-label',
        field: 'signal-lab-field',
        select: 'signal-lab-select',
        btn: 'signal-lab-btn',
        btnSecondary: 'signal-lab-btn--secondary',
        btnText: 'signal-lab-btn--text',
        sectionHeader: 'signal-lab-section-header',
        sectionGroup: 'signal-lab-section-group',
        sectionBody: 'signal-lab-section-body',
        valueField: 'signal-lab-value-field',
        fieldUnit: 'signal-lab-field-unit',
        toolbar: 'signal-lab-toolbar',
        checkbox: 'signal-lab-checkbox',
        transport: 'signal-lab-transport',
        transportBtn: 'signal-lab-transport-btn'
    };

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function disabledAttrs(disabled) {
        return disabled ? ' disabled' : '';
    }

    /**
     * Section header — toolbar groups and collapsible summaries.
     * @param {string} label
     * @param {{ tag?: string, extraClass?: string, attrs?: string }} [options]
     */
    function renderSectionHeader(label, options = {}) {
        const tag = options.tag || 'span';
        const extra = options.extraClass ? ` ${options.extraClass}` : '';
        const attrs = options.attrs || '';
        return `<${tag} class="${CLASSES.sectionHeader}${extra}"${attrs}>${escapeHtml(label)}</${tag}>`;
    }

    /**
     * Uniform field label.
     * @param {string} text
     * @param {string} [forId]
     */
    function renderLabel(text, forId) {
        if (forId) {
            return `<label class="${CLASSES.label}" for="${escapeHtml(forId)}">${escapeHtml(text)}</label>`;
        }
        return `<span class="${CLASSES.label}">${escapeHtml(text)}</span>`;
    }

    /**
     * Shared control row shell — stacked (sidebar) or inline (toolbar).
     */
    function renderControlRow(options) {
        const {
            labelHtml = '',
            bodyHtml = '',
            layout = 'stacked',
            disabled = false,
            extraClass = '',
            controlKey = '',
            modifier = ''
        } = options;

        const layoutClass = layout === 'inline'
            ? CLASSES.controlRowInline
            : layout === 'range'
                ? CLASSES.controlRowRange
                : CLASSES.controlRowStacked;

        const disabledClass = disabled ? ' signal-lab-control-row--disabled' : '';
        const modClass = modifier ? ` ${modifier}` : '';
        const keyAttr = controlKey ? ` data-control-key="${escapeHtml(controlKey)}"` : '';
        const disabledAttr = disabled ? ' aria-disabled="true"' : '';

        const labelBlock = labelHtml
            ? `<div class="signal-lab-control-row__label">${labelHtml}</div>`
            : '';

        return `
            <div class="${CLASSES.controlRow} ${layoutClass}${disabledClass}${modClass}${extraClass ? ` ${extraClass}` : ''}"${keyAttr}${disabledAttr}>
                ${labelBlock}
                <div class="${CLASSES.controlBody}">${bodyHtml}</div>
            </div>
        `;
    }

    function renderSelect(id, controlKey, options, current, disabled) {
        const dis = disabledAttrs(disabled);
        const optionsHtml = (options || []).map((opt) => {
            const selected = current === opt.value ? ' selected' : '';
            return `<option value="${escapeHtml(opt.value)}"${selected}>${escapeHtml(opt.label)}</option>`;
        }).join('');

        return `<select id="${escapeHtml(id)}" class="${CLASSES.select} ${CLASSES.field}"
            data-control-key="${escapeHtml(controlKey)}" data-control-type="select"${dis}>
            ${optionsHtml}
        </select>`;
    }

    function renderTextInput(id, controlKey, value, disabled, attrs = {}) {
        const dis = disabledAttrs(disabled);
        const placeholder = attrs.placeholder ? ` placeholder="${escapeHtml(attrs.placeholder)}"` : '';
        const maxLength = attrs.maxLength ? ` maxlength="${attrs.maxLength}"` : '';
        const inputClass = attrs.inputClass || `${CLASSES.field} signal-lab-text-input`;

        return `<input type="text" id="${escapeHtml(id)}" class="${inputClass}"
            data-control-key="${escapeHtml(controlKey)}" data-control-type="text"
            value="${escapeHtml(value)}"${placeholder}${maxLength}${dis}>`;
    }

    function renderNumberInput(id, controlKey, value, control, disabled, options = {}) {
        const dis = disabledAttrs(disabled);
        const controlType = options.controlType || 'number';
        const inputClass = options.inputClass || `${CLASSES.field} signal-lab-number-input`;

        return `<input type="number" id="${escapeHtml(id)}" class="${inputClass}"
            data-control-key="${escapeHtml(controlKey)}" data-control-type="${controlType}"
            min="${control.min}" max="${control.max}" step="${control.step || 1}" value="${value}"${dis}>`;
    }

    function renderValueField(innerHtml, unit) {
        const unitHtml = unit
            ? `<span class="${CLASSES.fieldUnit}">${escapeHtml(unit)}</span>`
            : '';
        return `<div class="${CLASSES.valueField}">${innerHtml}${unitHtml}</div>`;
    }

    function renderButton(label, options = {}) {
        const {
            controlKey = '',
            controlType = 'button',
            disabled = false,
            extraClass = '',
            attrs = ''
        } = options;
        const variant = options.variant === 'text'
            ? CLASSES.btnText
            : options.variant === 'secondary'
                ? CLASSES.btnSecondary
                : '';
        const dis = disabledAttrs(disabled);
        const keyAttr = controlKey ? ` data-control-key="${escapeHtml(controlKey)}"` : '';
        const typeAttr = controlType ? ` data-control-type="${controlType}"` : '';

        return `<button type="button" class="${CLASSES.btn} ${variant}${extraClass ? ` ${extraClass}` : ''}"${keyAttr}${typeAttr}${attrs}${dis}>${escapeHtml(label)}</button>`;
    }

    function renderSectionGroup(sectionId, label, bodyHtml) {
        return `
            <div class="${CLASSES.sectionGroup}" data-section="${escapeHtml(sectionId)}">
                ${renderSectionHeader(label)}
                <div class="${CLASSES.sectionBody}">${bodyHtml}</div>
            </div>
        `;
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.ControlComponents = {
        CLASSES,
        escapeHtml,
        disabledAttrs,
        renderSectionHeader,
        renderLabel,
        renderControlRow,
        renderSelect,
        renderTextInput,
        renderNumberInput,
        renderValueField,
        renderButton,
        renderSectionGroup
    };
})(typeof window !== 'undefined' ? window : globalThis);
