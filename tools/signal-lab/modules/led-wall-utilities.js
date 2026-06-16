(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';
    const ACCENT_DIM = 'rgba(255, 106, 45, 0.22)';
    const { calculateLedWall } = global.OkamiSignalLab.LedWallCalculator;

    const METRIC_DEFINITIONS = [
        { key: 'resolutionLabel', label: 'Exact Resolution' },
        { key: 'totalWidth', label: 'Total Width', format: (m) => `${m.totalWidth} px` },
        { key: 'totalHeight', label: 'Total Height', format: (m) => `${m.totalHeight} px` },
        { key: 'exactAspectRatio', label: 'Exact Aspect Ratio' },
        { key: 'closestAspectLabel', label: 'Closest Common Aspect' },
        { key: 'closestAspectDeviationPct', label: 'Aspect Deviation', format: (m) => `${m.closestAspectDeviationPct}%` },
        { key: 'panelSizeLabel', label: 'Panel Size', format: (m) => `${m.panelWidthPx} × ${m.panelHeightPx} px` },
        { key: 'wallGridLabel', label: 'Wall Grid', format: (m) => `${m.panelsWide} × ${m.panelsTall}` }
    ];

    function getWallFromState(state) {
        return calculateLedWall(state);
    }

    function updateLedWallMetricsDom(metrics, warnings) {
        const root = document.querySelector('[data-led-wall-metrics-root]');
        if (!root) {
            return;
        }

        METRIC_DEFINITIONS.forEach((entry) => {
            const valueEl = root.querySelector(`[data-led-metric-value="${entry.key}"]`);
            if (!valueEl) {
                return;
            }
            const value = entry.format ? entry.format(metrics) : metrics[entry.key];
            valueEl.textContent = value ?? '—';
        });

        const warningsEl = root.querySelector('[data-led-wall-warnings]');
        if (warningsEl) {
            if (!warnings.length) {
                warningsEl.innerHTML = '<li class="signal-lab-led-warning signal-lab-led-warning--ok">No scaling warnings</li>';
            } else {
                warningsEl.innerHTML = warnings.map(
                    (warning) => `<li class="signal-lab-led-warning">${warning}</li>`
                ).join('');
            }
        }
    }

    function drawWallPattern(ctx, canvasW, canvasH, wall) {
        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, canvasW, canvasH);

        const topBar = Math.max(28, canvasH * 0.08);
        const bottomPad = Math.max(16, canvasH * 0.04);
        const sidePad = Math.max(16, canvasW * 0.03);
        const drawW = canvasW - sidePad * 2;
        const drawH = canvasH - topBar - bottomPad;

        const wallAspect = wall.totalWidth / wall.totalHeight;
        let gridW = drawW;
        let gridH = gridW / wallAspect;
        if (gridH > drawH) {
            gridH = drawH;
            gridW = gridH * wallAspect;
        }

        const gridX = (canvasW - gridW) / 2;
        const gridY = topBar + (drawH - gridH) / 2;
        const cellW = gridW / wall.panelsWide;
        const cellH = gridH / wall.panelsTall;

        ctx.fillStyle = ACCENT;
        ctx.font = `800 ${Math.max(12, canvasH * 0.028)}px Montserrat, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('LED WALL TEST PATTERN', sidePad, Math.max(10, topBar * 0.22));

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `600 ${Math.max(10, canvasH * 0.02)}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(
            `${wall.resolutionLabel} · ${wall.exactAspectRatio}`,
            canvasW - sidePad,
            Math.max(10, topBar * 0.22)
        );

        for (let row = 0; row < wall.panelsTall; row += 1) {
            for (let col = 0; col < wall.panelsWide; col += 1) {
                const x = gridX + col * cellW;
                const y = gridY + row * cellH;
                const even = (row + col) % 2 === 0;

                ctx.fillStyle = even ? '#121212' : '#181818';
                ctx.fillRect(x, y, cellW, cellH);

                const pixelCols = Math.min(wall.panelWidthPx, 24);
                const pixelRows = Math.min(wall.panelHeightPx, 24);
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let px = 1; px < pixelCols; px += 1) {
                    const pxX = x + (cellW * px) / pixelCols;
                    ctx.moveTo(pxX, y);
                    ctx.lineTo(pxX, y + cellH);
                }
                for (let py = 1; py < pixelRows; py += 1) {
                    const pxY = y + (cellH * py) / pixelRows;
                    ctx.moveTo(x, pxY);
                    ctx.lineTo(x + cellW, pxY);
                }
                ctx.stroke();

                ctx.strokeStyle = ACCENT;
                ctx.lineWidth = Math.max(1, Math.min(cellW, cellH) * 0.04);
                ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

                const label = `${col + 1},${row + 1}`;
                const fontSize = Math.max(8, Math.min(cellW, cellH) * 0.16);
                ctx.fillStyle = ACCENT;
                ctx.font = `700 ${fontSize}px ui-monospace, Menlo, Consolas, monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, x + cellW / 2, y + cellH / 2);

                if (cellH > 28 && cellW > 40) {
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.font = `500 ${Math.max(7, fontSize * 0.65)}px ui-monospace, Menlo, Consolas, monospace`;
                    ctx.fillText(
                        `${wall.panelWidthPx}×${wall.panelHeightPx}`,
                        x + cellW / 2,
                        y + cellH / 2 + fontSize * 0.95
                    );
                }
            }
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(gridX + 0.5, gridY + 0.5, gridW - 1, gridH - 1);
        ctx.setLineDash([]);

        ctx.strokeStyle = ACCENT_DIM;
        ctx.beginPath();
        ctx.moveTo(gridX + gridW / 2, gridY);
        ctx.lineTo(gridX + gridW / 2, gridY + gridH);
        ctx.moveTo(gridX, gridY + gridH / 2);
        ctx.lineTo(gridX + gridW, gridY + gridH / 2);
        ctx.stroke();

        ctx.fillStyle = wall.hasWarnings ? '#ffb347' : '#7dffb0';
        ctx.font = `600 ${Math.max(9, canvasH * 0.018)}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const warningText = wall.hasWarnings
            ? `${wall.warnings.length} scaling warning${wall.warnings.length === 1 ? '' : 's'} — see panel`
            : 'No scaling warnings';
        ctx.fillText(warningText, canvasW / 2, canvasH - bottomPad * 0.35);
    }

    const LedWallUtilitiesModule = {
        id: 'led-utilities',
        needsAnimationLoop: false,

        defaultState: {
            panelWidthPx: 192,
            panelHeightPx: 192,
            panelsWide: 10,
            panelsTall: 6
        },

        getControlSchema() {
            return [
                { type: 'section', label: 'Panel Inputs' },
                {
                    type: 'number',
                    key: 'panelWidthPx',
                    label: 'Panel Width Pixels',
                    min: 1,
                    max: 4096,
                    step: 1,
                    unit: ' px'
                },
                {
                    type: 'number',
                    key: 'panelHeightPx',
                    label: 'Panel Height Pixels',
                    min: 1,
                    max: 4096,
                    step: 1,
                    unit: ' px'
                },
                {
                    type: 'number',
                    key: 'panelsWide',
                    label: 'Panels Wide',
                    min: 1,
                    max: 500,
                    step: 1
                },
                {
                    type: 'number',
                    key: 'panelsTall',
                    label: 'Panels Tall',
                    min: 1,
                    max: 500,
                    step: 1
                },
                {
                    type: 'led-wall-metrics',
                    key: 'wallMetrics',
                    label: 'Wall Calculations'
                }
            ];
        },

        render(ctx, frame) {
            const wall = getWallFromState(frame.state || {});
            const metrics = {
                ...wall,
                panelSizeLabel: `${wall.panelWidthPx} × ${wall.panelHeightPx} px`,
                wallGridLabel: `${wall.panelsWide} × ${wall.panelsTall}`
            };

            drawWallPattern(ctx, frame.displayWidth, frame.displayHeight, wall);
            updateLedWallMetricsDom(metrics, wall.warnings);
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('led-utilities', LedWallUtilitiesModule);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.LedWallUtilitiesModule = LedWallUtilitiesModule;
})(typeof window !== 'undefined' ? window : globalThis);
