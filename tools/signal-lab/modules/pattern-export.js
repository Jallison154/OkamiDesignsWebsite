(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';
    const { RESOLUTION_PRESETS, exportPattern, resolveResolution, buildFilename, resolvePatternName } =
        global.OkamiSignalLab.PatternExporter;

    const SOURCE_OPTIONS = [
        { value: 'active', label: 'Current Module' },
        { value: 'video-patterns', label: 'Video Patterns' },
        { value: 'motion-patterns', label: 'Motion Engine' },
        { value: 'welcome', label: 'Signal Check' },
        { value: 'sync-tools', label: 'AV Sync Tools' },
        { value: 'branding', label: 'Branding Overlay' },
        { value: 'display-info', label: 'Display Information' },
        { value: 'led-utilities', label: 'LED Wall Utilities' }
    ];

    function drawExportPreview(ctx, w, h, state, summary) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255, 106, 45, 0.2)';
        ctx.lineWidth = 1;
        const grid = Math.max(20, Math.min(w, h) / 24);
        ctx.beginPath();
        for (let x = 0; x <= w; x += grid) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
        }
        for (let y = 0; y <= h; y += grid) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
        }
        ctx.stroke();

        const pad = Math.max(16, Math.min(w, h) * 0.04);
        const panelW = Math.min(w - pad * 2, 620);
        const lines = summary?.lines || [];
        const rowH = Math.max(24, Math.min(w, h) * 0.042);
        const headerH = Math.max(42, rowH * 1.35);
        const panelH = headerH + lines.length * rowH + pad;
        const panelX = (w - panelW) / 2;
        const panelY = Math.max(pad, (h - panelH) / 2);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = 'rgba(255, 106, 45, 0.35)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(panelX, panelY, panelW, panelH, 8);
        } else {
            ctx.rect(panelX, panelY, panelW, panelH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = ACCENT;
        ctx.font = `800 ${Math.max(14, Math.min(w, h) * 0.03)}px Montserrat, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('PATTERN EXPORT', panelX + pad, panelY + headerH * 0.5);

        const labelFont = `600 ${Math.max(10, Math.min(w, h) * 0.02)}px ui-monospace, Menlo, Consolas, monospace`;
        const valueFont = `500 ${Math.max(10, Math.min(w, h) * 0.02)}px ui-monospace, Menlo, Consolas, monospace`;
        const fontSize = Math.max(10, Math.min(w, h) * 0.02);

        lines.forEach((line, index) => {
            const y = panelY + headerH + index * rowH + rowH * 0.5;
            let value = line.value;
            const maxChars = Math.floor((panelW - pad * 2) / (fontSize * 0.55));
            if (value.length > maxChars && maxChars > 8) {
                value = `${value.slice(0, maxChars - 1)}…`;
            }

            if (index > 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
                ctx.beginPath();
                ctx.moveTo(panelX + pad, y - rowH * 0.5);
                ctx.lineTo(panelX + panelW - pad, y - rowH * 0.5);
                ctx.stroke();
            }

            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.font = labelFont;
            ctx.textAlign = 'left';
            ctx.fillText(line.label, panelX + pad, y);

            ctx.fillStyle = '#ffffff';
            ctx.font = valueFont;
            ctx.textAlign = 'right';
            ctx.fillText(value, panelX + panelW - pad, y);
        });

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = `500 ${Math.max(9, Math.min(w, h) * 0.018)}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Use Download Export to render a fresh high-resolution file', w / 2, h - pad * 0.8);
    }

    function buildSummary(state, context) {
        const sourceModuleId = state.sourceModuleId === 'active'
            ? (context?.activeModuleId || 'video-patterns')
            : (state.sourceModuleId || 'video-patterns');
        const sourceState = context?.getModuleState?.()?.[sourceModuleId] || {};
        const displaySize = context?.getDisplaySize?.() || { width: 1920, height: 1080 };
        const { width, height } = resolveResolution(state, displaySize);
        const patternName = resolvePatternName(sourceModuleId, sourceState);
        const format = (state.format || 'png').toUpperCase();
        const filename = buildFilename(patternName, width, height, state.format || 'png');

        return {
            lines: [
                { label: 'Source', value: SOURCE_OPTIONS.find((o) => o.value === state.sourceModuleId)?.label || sourceModuleId },
                { label: 'Pattern', value: patternName },
                { label: 'Resolution', value: `${width} × ${height}` },
                { label: 'Format', value: format },
                { label: 'Text Watermark', value: state.textWatermarkEnabled ? 'On' : 'Off' },
                { label: 'Logo Watermark', value: state.logoWatermarkEnabled ? 'On' : 'Off' },
                { label: 'Filename', value: filename }
            ]
        };
    }

    const PatternExportModule = {
        id: 'export',
        needsAnimationLoop: false,

        defaultState: {
            sourceModuleId: 'active',
            format: 'png',
            resolutionPreset: '1920x1080',
            customWidth: 1920,
            customHeight: 1080,
            textWatermarkEnabled: false,
            textWatermarkText: 'Okami Signal Lab',
            textWatermarkOpacity: 0.45,
            logoWatermarkEnabled: false,
            logoWatermarkDataUrl: '',
            logoWatermarkOpacity: 0.55,
            logoWatermarkSize: 12
        },

        _previewContext: null,

        onAttach(engine) {
            this._previewContext = null;
            if (!engine.state.sourceModuleId) {
                engine.setState({ ...this.defaultState });
            }
        },

        onDetach() {
            this._previewContext = null;
        },

        setPreviewContext(context) {
            this._previewContext = context;
        },

        getControlSchema(state = {}) {
            const customRes = (state.resolutionPreset || this.defaultState.resolutionPreset) === 'custom';
            const textWm = Boolean(state.textWatermarkEnabled);
            const logoWm = Boolean(state.logoWatermarkEnabled && state.logoWatermarkDataUrl);

            return [
                {
                    section: 'export',
                    type: 'select',
                    key: 'sourceModuleId',
                    label: 'Export Source',
                    options: SOURCE_OPTIONS
                },
                {
                    section: 'export',
                    type: 'select',
                    key: 'format',
                    label: 'Format',
                    options: [
                        { value: 'png', label: 'PNG' },
                        { value: 'jpg', label: 'JPG' }
                    ]
                },
                {
                    section: 'resolution',
                    type: 'select',
                    key: 'resolutionPreset',
                    label: 'Resolution Preset',
                    options: RESOLUTION_PRESETS.map((entry) => ({
                        value: entry.id,
                        label: entry.label
                    }))
                },
                {
                    section: 'resolution',
                    type: 'number',
                    key: 'customWidth',
                    label: 'Custom Width',
                    min: 64,
                    max: 16384,
                    step: 1,
                    unit: 'px',
                    disabledWhen: () => !customRes
                },
                {
                    section: 'resolution',
                    type: 'number',
                    key: 'customHeight',
                    label: 'Custom Height',
                    min: 64,
                    max: 16384,
                    step: 1,
                    unit: 'px',
                    disabledWhen: () => !customRes
                },
                {
                    section: 'branding',
                    type: 'checkbox',
                    key: 'textWatermarkEnabled',
                    label: 'Text Watermark'
                },
                {
                    section: 'branding',
                    type: 'text',
                    key: 'textWatermarkText',
                    label: 'Watermark Text',
                    placeholder: 'Okami Signal Lab',
                    disabledWhen: () => !textWm
                },
                {
                    section: 'branding',
                    type: 'range',
                    key: 'textWatermarkOpacity',
                    label: 'Text Opacity',
                    min: 0,
                    max: 1,
                    step: 0.05,
                    disabledWhen: () => !textWm
                },
                {
                    section: 'branding',
                    type: 'checkbox',
                    key: 'logoWatermarkEnabled',
                    label: 'Logo Watermark'
                },
                {
                    section: 'branding',
                    type: 'file-upload',
                    key: 'logoWatermarkDataUrl',
                    label: 'Watermark Logo',
                    accept: 'image/*'
                },
                {
                    section: 'branding',
                    type: 'range',
                    key: 'logoWatermarkOpacity',
                    label: 'Logo Opacity',
                    min: 0,
                    max: 1,
                    step: 0.05,
                    disabledWhen: () => !logoWm
                },
                {
                    section: 'branding',
                    type: 'range',
                    key: 'logoWatermarkSize',
                    label: 'Logo Size',
                    min: 5,
                    max: 30,
                    step: 1,
                    unit: '%',
                    disabledWhen: () => !logoWm
                },
                {
                    section: 'export',
                    type: 'action',
                    key: 'downloadExport',
                    label: 'Export',
                    buttonLabel: 'Download Export'
                }
            ];
        },

        async handleAction(actionKey, context, state) {
            if (actionKey !== 'downloadExport') {
                return;
            }

            context?.setStatus?.('Rendering export…');

            try {
                const result = await exportPattern({
                    exportState: state,
                    allModuleState: context.getModuleState(),
                    displaySize: context.getDisplaySize(),
                    activeModuleId: context.activeModuleId
                });

                context?.setStatus?.(`Exported ${result.filename}`);
            } catch (error) {
                context?.setStatus?.(error.message || 'Export failed.');
                throw error;
            }
        },

        render(ctx, frame) {
            const summary = buildSummary(frame.state || {}, this._previewContext);
            drawExportPreview(ctx, frame.displayWidth, frame.displayHeight, frame.state || {}, summary);
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('export', PatternExportModule);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.PatternExportModule = PatternExportModule;
})(typeof window !== 'undefined' ? window : globalThis);
