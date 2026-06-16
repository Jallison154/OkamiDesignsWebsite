(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';
    const BALL_COLOR = '#FF6A2D';
    const BG = '#0a0a0a';

    const MOTION_CATALOG = [
        { id: 'bouncing-ball', label: 'Bouncing Ball' },
        { id: 'horizontal-ball', label: 'Horizontal Ball' },
        { id: 'vertical-ball', label: 'Vertical Ball' },
        { id: 'circular-motion', label: 'Circular Motion' },
        { id: 'figure-8', label: 'Figure 8 Motion' },
        { id: 'scrolling-h-lines', label: 'Scrolling Horizontal Lines' },
        { id: 'scrolling-v-lines', label: 'Scrolling Vertical Lines' },
        { id: 'moving-grid', label: 'Moving Grid' },
        { id: 'rotating-siemens-star', label: 'Rotating Siemens Star' },
        { id: 'rotating-logo', label: 'Rotating Logo' }
    ];

    let motionTime = 0;
    let lastTimestamp = 0;

    function resetMotionClock() {
        motionTime = 0;
        lastTimestamp = 0;
    }

    function advanceMotionTime(timestamp, state) {
        if (state.playing === false) {
            if (state._syncedMotionTime !== undefined) {
                return state._syncedMotionTime;
            }
            lastTimestamp = timestamp;
            return motionTime;
        }

        if (state._syncedMotionTime !== undefined && state._syncedWallAt !== undefined) {
            const dt = (Date.now() - state._syncedWallAt) / 1000;
            const dir = state.reverse ? -1 : 1;
            const speed = Number(state.speed) || 1;
            return state._syncedMotionTime + dt * speed * dir;
        }

        if (lastTimestamp > 0) {
            const dt = (timestamp - lastTimestamp) / 1000;
            const dir = state.reverse ? -1 : 1;
            const speed = Number(state.speed) || 1;
            motionTime += dt * speed * dir;
        }

        lastTimestamp = timestamp;
        return motionTime;
    }

    function getMotionClockSnapshot(state = {}) {
        return {
            type: 'motion-patterns',
            motionTime,
            playing: state.playing !== false,
            speed: Number(state.speed) || 1,
            reverse: Boolean(state.reverse)
        };
    }

    function getSizeScale(state) {
        return Math.max(0.2, Number(state.motionSize) || 1);
    }

    function clearBackground(ctx, w, h) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, w, h);
    }

    function drawBall(ctx, x, y, radius) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = BALL_COLOR;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(1, radius * 0.08);
        ctx.stroke();
    }

    function drawBouncingBall(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const margin = Math.min(w, h) * 0.12 * scale;
        const radius = Math.min(w, h) * 0.045 * scale;
        const x = margin + (w - margin * 2) * (0.5 + 0.5 * Math.sin(t * 1.4));
        const y = margin + radius + (h - margin * 2 - radius * 2) * Math.abs(Math.sin(t * 2.1));
        drawBall(ctx, x, y, radius);
    }

    function drawHorizontalBall(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const margin = Math.min(w, h) * 0.12 * scale;
        const radius = Math.min(w, h) * 0.045 * scale;
        const x = w / 2 + (w / 2 - margin) * Math.sin(t * 1.5);
        drawBall(ctx, x, h / 2, radius);
    }

    function drawVerticalBall(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const margin = Math.min(w, h) * 0.12 * scale;
        const radius = Math.min(w, h) * 0.045 * scale;
        const y = h / 2 + (h / 2 - margin) * Math.sin(t * 1.5);
        drawBall(ctx, w / 2, y, radius);
    }

    function drawCircularMotion(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const cx = w / 2;
        const cy = h / 2;
        const orbit = Math.min(w, h) * 0.32 * scale;
        const radius = Math.min(w, h) * 0.04 * scale;
        drawBall(ctx, cx + Math.cos(t * 1.5) * orbit, cy + Math.sin(t * 1.5) * orbit, radius);

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, orbit, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawFigure8(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const cx = w / 2;
        const cy = h / 2;
        const a = Math.min(w, h) * 0.28 * scale;
        const x = cx + a * Math.sin(t * 1.5);
        const y = cy + a * Math.sin(t * 1.5) * Math.cos(t * 1.5);
        const radius = Math.min(w, h) * 0.04 * scale;
        drawBall(ctx, x, y, radius);
    }

    function drawScrollingHorizontalLines(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const spacing = Math.max(12, Math.round(28 * scale));
        const offset = (t * 80 * scale) % spacing;
        ctx.strokeStyle = 'rgba(255, 106, 45, 0.65)';
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.beginPath();
        for (let y = -spacing; y <= h + spacing; y += spacing) {
            const lineY = y + offset;
            ctx.moveTo(0, lineY);
            ctx.lineTo(w, lineY);
        }
        ctx.stroke();
    }

    function drawScrollingVerticalLines(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const spacing = Math.max(12, Math.round(28 * scale));
        const offset = (t * 80 * scale) % spacing;
        ctx.strokeStyle = 'rgba(255, 106, 45, 0.65)';
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.beginPath();
        for (let x = -spacing; x <= w + spacing; x += spacing) {
            const lineX = x + offset;
            ctx.moveTo(lineX, 0);
            ctx.lineTo(lineX, h);
        }
        ctx.stroke();
    }

    function drawMovingGrid(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const spacing = Math.max(16, Math.round(32 * scale));
        const ox = (t * 60 * scale) % spacing;
        const oy = (t * 45 * scale) % spacing;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -spacing; x <= w + spacing; x += spacing) {
            ctx.moveTo(x + ox + 0.5, 0);
            ctx.lineTo(x + ox + 0.5, h);
        }
        for (let y = -spacing; y <= h + spacing; y += spacing) {
            ctx.moveTo(0, y + oy + 0.5);
            ctx.lineTo(w, y + oy + 0.5);
        }
        ctx.stroke();
    }

    function drawSiemensStar(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const cx = w / 2;
        const cy = h / 2;
        const outer = Math.min(w, h) * 0.42 * scale;
        const spokes = 24;
        const rotation = t * 0.8;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        for (let i = 0; i < spokes; i += 1) {
            const a0 = (i / spokes) * Math.PI * 2;
            const a1 = ((i + 0.5) / spokes) * Math.PI * 2;
            ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, outer, a0, a1);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    function drawRotatingLogo(ctx, w, h, t, scale) {
        clearBackground(ctx, w, h);
        const cx = w / 2;
        const cy = h / 2;
        const fontSize = Math.max(18, Math.min(w, h) * 0.12 * scale);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.7);

        ctx.fillStyle = ACCENT;
        ctx.font = `800 ${fontSize}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OKAMI', 0, 0);

        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = Math.max(2, fontSize * 0.06);
        ctx.beginPath();
        ctx.arc(0, 0, fontSize * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    const MOTION_RENDERERS = {
        'bouncing-ball': drawBouncingBall,
        'horizontal-ball': drawHorizontalBall,
        'vertical-ball': drawVerticalBall,
        'circular-motion': drawCircularMotion,
        'figure-8': drawFigure8,
        'scrolling-h-lines': drawScrollingHorizontalLines,
        'scrolling-v-lines': drawScrollingVerticalLines,
        'moving-grid': drawMovingGrid,
        'rotating-siemens-star': drawSiemensStar,
        'rotating-logo': drawRotatingLogo
    };

    const MotionEngineModule = {
        id: 'motion-patterns',
        needsAnimationLoop: true,

        defaultState: {
            patternId: 'bouncing-ball',
            playing: true,
            speed: 1,
            reverse: false,
            motionSize: 1
        },

        shouldAnimate(state) {
            return state.playing !== false;
        },

        onAttach(engine) {
            if (!engine.state._syncedMotionTime && engine.state._syncedWallAt === undefined) {
                resetMotionClock();
            }
            if (!engine.state.patternId) {
                engine.setState({ ...this.defaultState });
            }
        },

        onDetach() {
            resetMotionClock();
        },

        getControlSchema() {
            return [
                {
                    type: 'select',
                    key: 'patternId',
                    label: 'Motion Pattern',
                    options: MOTION_CATALOG.map((entry) => ({
                        value: entry.id,
                        label: entry.label
                    }))
                },
                {
                    type: 'transport',
                    key: 'playing',
                    label: 'Transport'
                },
                {
                    type: 'range',
                    key: 'speed',
                    label: 'Motion Speed',
                    min: 0.25,
                    max: 3,
                    step: 0.05,
                    unit: '×'
                },
                {
                    type: 'checkbox',
                    key: 'reverse',
                    label: 'Reverse Direction'
                },
                {
                    type: 'range',
                    key: 'motionSize',
                    label: 'Motion Size',
                    min: 0.3,
                    max: 1.5,
                    step: 0.05,
                    unit: '×'
                }
            ];
        },

        render(ctx, frame) {
            const w = frame.displayWidth;
            const h = frame.displayHeight;
            const state = frame.state || {};
            const t = advanceMotionTime(frame.timestamp, state);
            const scale = getSizeScale(state);
            const patternId = state.patternId || 'bouncing-ball';
            const draw = MOTION_RENDERERS[patternId] || MOTION_RENDERERS['bouncing-ball'];
            draw(ctx, w, h, t, scale);
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('motion-patterns', MotionEngineModule);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.MotionEngineModule = MotionEngineModule;
    global.OkamiSignalLab.MOTION_CATALOG = MOTION_CATALOG;
    global.OkamiSignalLab.getMotionClockSnapshot = getMotionClockSnapshot;
})(typeof window !== 'undefined' ? window : globalThis);
