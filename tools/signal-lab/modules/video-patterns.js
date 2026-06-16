(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';

    const PATTERN_CATALOG = [
        { id: 'okami-calibration', label: 'Default / Okami Calibration Pattern' },
        { id: 'white', label: 'White' },
        { id: 'black', label: 'Black' },
        { id: 'red', label: 'Red' },
        { id: 'green', label: 'Green' },
        { id: 'blue', label: 'Blue' },
        { id: 'cyan', label: 'Cyan' },
        { id: 'magenta', label: 'Magenta' },
        { id: 'yellow', label: 'Yellow' },
        { id: 'gray-50', label: '50% Gray' },
        { id: 'smpte-bars', label: 'SMPTE Color Bars' },
        { id: 'grayscale-ramp', label: 'Grayscale Ramp' },
        { id: 'crosshair', label: 'Crosshair' },
        { id: 'grid', label: 'Grid' },
        { id: 'pixel-grid', label: 'Pixel Grid' },
        { id: 'safe-area', label: 'Safe Area' },
        { id: 'border-frame', label: 'Border Frame' },
        { id: 'circle-alignment', label: 'Circle Alignment' },
        { id: 'resolution', label: 'Resolution Pattern' }
    ];

    function fillSolid(ctx, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
    }

    function drawSmpteBars(ctx, w, h) {
        const topH = h * 0.75;
        const midH = h * 0.065;
        const botH = h - topH - midH;
        const bars = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff'];
        const barW = w / bars.length;

        bars.forEach((color, i) => {
            ctx.fillStyle = color;
            ctx.fillRect(i * barW, 0, barW, topH);
        });

        const midColors = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff'];
        midColors.forEach((color, i) => {
            ctx.fillStyle = color;
            ctx.fillRect(i * barW, topH, barW, midH);
        });

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, topH + midH, w, botH);

        const plugeW = w * 0.14;
        ctx.fillStyle = '#131313';
        ctx.fillRect(0, topH + midH, plugeW, botH);
        ctx.fillStyle = '#000000';
        ctx.fillRect(plugeW, topH + midH, plugeW * 0.35, botH);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(w - plugeW, topH + midH, plugeW, botH);
    }

    function drawGrayscaleRamp(ctx, w, h) {
        const steps = 256;
        const stepW = w / steps;
        for (let i = 0; i < steps; i += 1) {
            const v = Math.round((i / (steps - 1)) * 255);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(i * stepW, 0, stepW + 1, h);
        }
    }

    function drawCrosshair(ctx, w, h, frame) {
        fillSolid(ctx, w, h, '#101010');
        const cx = w / 2;
        const cy = h / 2;
        const lineThickness = Math.max(1, Number(frame?.state?.lineThickness) || Math.max(1, Math.min(w, h) / 400));
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = lineThickness;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.moveTo(0, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * 0.08, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawGrid(ctx, w, h, cellSize, frame) {
        fillSolid(ctx, w, h, '#0a0a0a');
        const size = Math.max(4, Number(cellSize) || 32);
        const lineThickness = Math.max(1, Number(frame?.state?.lineThickness) || 1);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = lineThickness;
        ctx.beginPath();
        for (let x = 0; x <= w; x += size) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
        }
        for (let y = 0; y <= h; y += size) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
        }
        ctx.stroke();
    }

    function drawSafeArea(ctx, w, h) {
        fillSolid(ctx, w, h, '#141414');
        const cx = w / 2;
        const cy = h / 2;

        function drawRect(ratio, color, label) {
            const rw = w * ratio;
            const rh = h * ratio;
            const x = cx - rw / 2;
            const y = cy - rh / 2;
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1, Math.min(w, h) / 300);
            ctx.strokeRect(x, y, rw, rh);
            ctx.fillStyle = color;
            ctx.font = `600 ${Math.max(10, Math.min(w, h) * 0.024)}px Montserrat, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(label, x + 6, y + 4);
        }

        drawRect(0.9, 'rgba(0, 255, 120, 0.85)', 'Title Safe 90%');
        drawRect(0.8, 'rgba(255, 106, 45, 0.85)', 'Action Safe 80%');
    }

    function drawBorderFrame(ctx, w, h) {
        fillSolid(ctx, w, h, '#1a1a1a');
        const inset = Math.max(8, Math.min(w, h) * 0.04);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = Math.max(2, Math.min(w, h) / 200);
        ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(inset * 2, inset * 2, w - inset * 4, h - inset * 4);
    }

    function drawCircleAlignment(ctx, w, h) {
        fillSolid(ctx, w, h, '#0d0d0d');
        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.min(w, h) * 0.46;
        const rings = 5;

        ctx.lineWidth = Math.max(1, Math.min(w, h) / 350);
        for (let i = 1; i <= rings; i += 1) {
            const r = (maxR / rings) * i;
            ctx.strokeStyle = i === rings ? ACCENT : 'rgba(255,255,255,0.28)';
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(cx - maxR, cy);
        ctx.lineTo(cx + maxR, cy);
        ctx.moveTo(cx, cy - maxR);
        ctx.lineTo(cx, cy + maxR);
        ctx.stroke();
    }

    function drawResolutionPattern(ctx, w, h, frame) {
        const gridSize = Number(frame?.state?.gridSize) || Math.max(32, Math.round(Math.min(w, h) / 20));
        drawGrid(ctx, w, h, gridSize, frame);

        const lines = [
            `${Math.round(w)} × ${Math.round(h)} px`,
            `Buffer: ${frame.width} × ${frame.height}`,
            `DPR: ${(frame.dpr || 1).toFixed(2)}`
        ];

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.max(14, Math.min(w, h) * 0.045)}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lines[0], w / 2, h / 2 - 20);

        ctx.fillStyle = ACCENT;
        ctx.font = `600 ${Math.max(11, Math.min(w, h) * 0.028)}px Montserrat, sans-serif`;
        ctx.fillText(lines[1], w / 2, h / 2 + 8);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(lines[2], w / 2, h / 2 + 28);

        ctx.font = `600 ${Math.max(9, Math.min(w, h) * 0.018)}px Montserrat, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText('OKAMI SIGNAL LAB', 12, h - 14);
    }

    const SOLID_COLORS = {
        white: '#ffffff',
        black: '#000000',
        red: '#ff0000',
        green: '#00ff00',
        blue: '#0000ff',
        cyan: '#00ffff',
        magenta: '#ff00ff',
        yellow: '#ffff00',
        'gray-50': '#808080'
    };

    const PATTERN_RENDERERS = {
        white: (ctx, w, h) => fillSolid(ctx, w, h, SOLID_COLORS.white),
        black: (ctx, w, h) => fillSolid(ctx, w, h, SOLID_COLORS.black),
        red: (ctx, w, h) => fillSolid(ctx, w, h, SOLID_COLORS.red),
        green: (ctx, w, h) => fillSolid(ctx, w, h, SOLID_COLORS.green),
        blue: (ctx, w, h) => fillSolid(ctx, w, h, SOLID_COLORS.blue),
        cyan: (ctx, w, h) => fillSolid(ctx, w, h, SOLID_COLORS.cyan),
        magenta: (ctx, w, h) => fillSolid(ctx, w, h, SOLID_COLORS.magenta),
        yellow: (ctx, w, h) => fillSolid(ctx, w, h, SOLID_COLORS.yellow),
        'gray-50': (ctx, w, h) => fillSolid(ctx, w, h, SOLID_COLORS['gray-50']),
        'smpte-bars': drawSmpteBars,
        'grayscale-ramp': drawGrayscaleRamp,
        crosshair: (ctx, w, h, frame) => drawCrosshair(ctx, w, h, frame),
        grid: (ctx, w, h, frame) => {
            const size = Number(frame?.state?.gridSize) || Math.max(24, Math.round(Math.min(w, h) / 16));
            drawGrid(ctx, w, h, size, frame);
        },
        'pixel-grid': (ctx, w, h, frame) => {
            const size = Math.max(4, Math.round((Number(frame?.state?.gridSize) || Math.min(w, h) / 48)));
            drawGrid(ctx, w, h, size, frame);
        },
        'safe-area': drawSafeArea,
        'border-frame': drawBorderFrame,
        'circle-alignment': drawCircleAlignment,
        resolution: drawResolutionPattern,
        'okami-calibration': (ctx, w, h, frame) => {
            const draw = global.OkamiSignalLab?.drawOkamiCalibrationPattern;
            if (typeof draw === 'function') {
                draw(ctx, w, h, frame);
            } else {
                fillSolid(ctx, w, h, '#0a0a0a');
            }
        }
    };

    const VideoPatternsModule = {
        id: 'video-patterns',
        needsAnimationLoop: false,

        defaultState: {
            patternId: 'okami-calibration',
            motionPlaying: true,
            lineThickness: 2,
            gridSize: 64
        },

        shouldAnimate(state) {
            return state?.patternId === 'okami-calibration' && state?.motionPlaying !== false;
        },

        onAttach(engine) {
            if (!engine.state.patternId) {
                engine.setState({ patternId: this.defaultState.patternId });
            }
        },

        onDetach() {},

        getControlSchema(state = {}) {
            const patternId = state.patternId || this.defaultState.patternId;
            const usesLine = ['crosshair', 'grid', 'pixel-grid'].includes(patternId);
            const usesGrid = ['grid', 'pixel-grid', 'resolution'].includes(patternId);

            return [
                {
                    section: 'pattern',
                    type: 'select',
                    key: 'patternId',
                    label: 'Pattern',
                    options: PATTERN_CATALOG.map((entry) => ({
                        value: entry.id,
                        label: entry.label
                    }))
                },
                {
                    section: 'motion',
                    type: 'transport',
                    key: 'motionPlaying',
                    label: 'Motion Test',
                    startLabel: 'Play',
                    stopLabel: 'Pause',
                    enabledWhen: (s) => (s.patternId || patternId) === 'okami-calibration'
                },
                {
                    section: 'pattern',
                    type: 'range',
                    key: 'lineThickness',
                    label: 'Line Thickness',
                    min: 1,
                    max: 20,
                    step: 1,
                    unit: 'px',
                    enabledWhen: () => usesLine
                },
                {
                    section: 'pattern',
                    type: 'range',
                    key: 'gridSize',
                    label: 'Grid Size',
                    min: 8,
                    max: 256,
                    step: 1,
                    unit: 'px',
                    enabledWhen: () => usesGrid
                }
            ];
        },

        render(ctx, frame) {
            const w = frame.displayWidth;
            const h = frame.displayHeight;
            let patternId = frame.state?.patternId || 'okami-calibration';
            if (!global.OkamiCommercialGate?.canUsePremiumPatternSync?.('video-patterns', patternId)) {
                patternId = 'okami-calibration';
            }
            const draw = PATTERN_RENDERERS[patternId] || PATTERN_RENDERERS['okami-calibration'];
            draw(ctx, w, h, frame);
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('video-patterns', VideoPatternsModule);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.VideoPatternsModule = VideoPatternsModule;
    global.OkamiSignalLab.PATTERN_CATALOG = PATTERN_CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);
