(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';

    const METRIC_DEFINITIONS = [
        { key: 'screenWidth', label: 'Screen Width', format: (m) => `${m.screenWidth} px` },
        { key: 'screenHeight', label: 'Screen Height', format: (m) => `${m.screenHeight} px` },
        { key: 'viewportWidth', label: 'Viewport Width', format: (m) => `${m.viewportWidth} px` },
        { key: 'viewportHeight', label: 'Viewport Height', format: (m) => `${m.viewportHeight} px` },
        { key: 'aspectRatio', label: 'Aspect Ratio', format: (m) => m.aspectRatio },
        { key: 'devicePixelRatio', label: 'Device Pixel Ratio', format: (m) => `${m.devicePixelRatio}` },
        { key: 'refreshRate', label: 'Est. Refresh Rate', format: (m) => (m.refreshRate > 0 ? `~${m.refreshRate} Hz` : 'Measuring…') },
        { key: 'fullscreen', label: 'Fullscreen Status', format: (m) => m.fullscreen }
    ];

    let refreshEstimator = null;
    let lastMetrics = null;

    function getRefreshEstimator() {
        if (!refreshEstimator) {
            refreshEstimator = new global.OkamiSignalLab.DisplayMetrics.RefreshRateEstimator();
        }
        return refreshEstimator;
    }

    function gatherMetrics(timestamp) {
        const base = global.OkamiSignalLab.DisplayMetrics.collectDisplayMetrics();
        const refreshRate = getRefreshEstimator().update(timestamp);
        return { ...base, refreshRate };
    }

    function updateDisplayMetricsDom(metrics) {
        const root = document.querySelector('[data-display-metrics-root]');
        if (!root) {
            return;
        }

        METRIC_DEFINITIONS.forEach((entry) => {
            const valueEl = root.querySelector(`[data-metric-value="${entry.key}"]`);
            if (valueEl) {
                valueEl.textContent = entry.format(metrics);
            }
        });
    }

    function drawPanel(ctx, w, h, metrics, frame) {
        global.OkamiSignalLab?.TechnicalBackground?.fillModuleBase?.(ctx, w, h, frame)
            ?? (ctx.fillStyle = '#0a0a0a', ctx.fillRect(0, 0, w, h));

        const pad = Math.max(16, Math.min(w, h) * 0.04);
        const panelWidth = Math.min(w - pad * 2, 560);
        const rowHeight = Math.max(28, Math.min(w, h) * 0.048);
        const headerHeight = Math.max(44, rowHeight * 1.4);
        const panelHeight = headerHeight + METRIC_DEFINITIONS.length * rowHeight + pad;
        const panelX = (w - panelWidth) / 2;
        const panelY = Math.max(pad, (h - panelHeight) / 2);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = 'rgba(255, 106, 45, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 8);
        } else {
            ctx.rect(panelX, panelY, panelWidth, panelHeight);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = ACCENT;
        ctx.font = `800 ${Math.max(14, Math.min(w, h) * 0.032)}px Montserrat, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('DISPLAY INFORMATION', panelX + pad, panelY + headerHeight * 0.5);

        const labelX = panelX + pad;
        const valueX = panelX + panelWidth - pad;
        const fontSize = Math.max(11, Math.min(w, h) * 0.024);
        const labelFont = `600 ${fontSize}px ui-monospace, Menlo, Consolas, monospace`;
        const valueFont = `500 ${fontSize}px ui-monospace, Menlo, Consolas, monospace`;

        METRIC_DEFINITIONS.forEach((entry, index) => {
            const y = panelY + headerHeight + index * rowHeight + rowHeight * 0.5;

            if (index > 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
                ctx.beginPath();
                ctx.moveTo(labelX, y - rowHeight * 0.5);
                ctx.lineTo(valueX, y - rowHeight * 0.5);
                ctx.stroke();
            }

            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.font = labelFont;
            ctx.textAlign = 'left';
            ctx.fillText(entry.label, labelX, y);

            ctx.fillStyle = entry.key === 'fullscreen' && metrics.fullscreenActive
                ? '#7dffb0'
                : '#ffffff';
            ctx.font = valueFont;
            ctx.textAlign = 'right';
            ctx.fillText(entry.format(metrics), valueX, y);
        });

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = `500 ${Math.max(10, fontSize * 0.85)}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Live metrics · refresh rate estimated via requestAnimationFrame', w / 2, h - pad * 0.75);
    }

    const DisplayInfoModule = {
        id: 'display-info',
        needsAnimationLoop: true,

        shouldAnimate() {
            return true;
        },

        onAttach() {
            getRefreshEstimator().reset();
            lastMetrics = null;
        },

        onDetach() {
            if (refreshEstimator) {
                refreshEstimator.reset();
            }
            lastMetrics = null;
        },

        getControlSchema() {
            return [
                {
                    section: 'resolution',
                    type: 'display-metrics',
                    key: 'metrics',
                    label: 'Display Information'
                }
            ];
        },

        render(ctx, frame) {
            const w = frame.displayWidth;
            const h = frame.displayHeight;
            const metrics = gatherMetrics(frame.timestamp);
            lastMetrics = metrics;

            drawPanel(ctx, w, h, metrics, frame);
            updateDisplayMetricsDom(metrics);
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('display-info', DisplayInfoModule);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.DisplayInfoModule = DisplayInfoModule;
})(typeof window !== 'undefined' ? window : globalThis);
