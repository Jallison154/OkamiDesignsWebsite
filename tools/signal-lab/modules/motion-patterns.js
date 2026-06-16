(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';
    const BALL_COLOR = '#FF6A2D';
    const BG = '#0a0a0a';

    const BOUNCE_PALETTE = [
        '#FF6A2D',
        '#4ECDC4',
        '#FFE66D',
        '#A78BFA',
        '#F472B6',
        '#34D399',
        '#60A5FA',
        '#FB923C'
    ];

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
        { id: 'rotating-logo', label: 'Rotating Logo' },
        { id: 'text-crawl', label: 'Text Crawl' },
        { id: 'random-motion', label: 'Random Motion' }
    ];

    function isRandomMotion(state) {
        return global.OkamiSignalLab?.RandomMotion?.isRandomMotion?.(state) || isPattern(state, 'random-motion');
    }

    function pid(state) {
        return state?.patternId || 'bouncing-ball';
    }

    function isPattern(state, id) {
        return pid(state) === id;
    }

    function isBouncingBall(state) {
        return isPattern(state, 'bouncing-ball');
    }

    function isScrollLines(state) {
        const p = pid(state);
        return p === 'scrolling-h-lines' || p === 'scrolling-v-lines';
    }

    function isRotating(state) {
        const p = pid(state);
        return p === 'rotating-siemens-star' || p === 'rotating-logo';
    }

    function getMotionObjectColor(state) {
        return state?.objectColor || state?.dvdColor || BALL_COLOR;
    }

    function motionDirection(state) {
        return state.reverse ? -1 : 1;
    }

    let motionTime = 0;
    let lastTimestamp = 0;

    const dvdLogoCache = {
        url: '',
        image: null,
        ready: false
    };

    function resetMotionClock() {
        motionTime = 0;
        lastTimestamp = 0;
    }

    function advanceMotionTime(timestamp, state) {
        if (isBouncingBall(state) || isRandomMotion(state)) {
            return timestamp / 1000;
        }

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

    function extractDvdSnapshot(state) {
        return {
            dvdCx: state.dvdCx,
            dvdCy: state.dvdCy,
            dvdVx: state.dvdVx,
            dvdVy: state.dvdVy,
            dvdBounceCount: state.dvdBounceCount || 0,
            dvdFlashUntil: state.dvdFlashUntil || 0,
            dvdFlashEdge: state.dvdFlashEdge || '',
            dvdTrail: Array.isArray(state.dvdTrail) ? state.dvdTrail.map((p) => ({ ...p })) : [],
            dvdLastTs: state.dvdLastTs || 0,
            dvdInitialized: Boolean(state.dvdInitialized),
            _dvdCanvasW: state._dvdCanvasW,
            _dvdCanvasH: state._dvdCanvasH
        };
    }

    function applyDvdSnapshot(state, snapshot) {
        if (!snapshot) {
            return;
        }

        Object.assign(state, snapshot);
        state.dvdTrail = Array.isArray(snapshot.dvdTrail)
            ? snapshot.dvdTrail.map((p) => ({ ...p }))
            : [];
    }

    function getMotionClockSnapshot(state = {}) {
        const snap = {
            type: 'motion-patterns',
            motionTime,
            playing: state.playing !== false,
            speed: Number(state.speed) || 1,
            reverse: Boolean(state.reverse)
        };

        if (isBouncingBall(state)) {
            snap.dvd = extractDvdSnapshot(state);
        }

        if (isRandomMotion(state)) {
            snap.random = global.OkamiSignalLab?.RandomMotion?.extractRandomSnapshot?.(state);
        }

        return snap;
    }

    function getSizeScale(state) {
        return Math.max(0.2, Number(state.motionSize) || 1);
    }

    function clearBackground(ctx, w, h, frame, state) {
        if (state?.motionBackgroundEnabled === false) {
            ctx.fillStyle = BG;
            ctx.fillRect(0, 0, w, h);
            return;
        }

        const tb = global.OkamiSignalLab?.TechnicalBackground;
        if (tb?.fillModuleBase) {
            tb.fillModuleBase(ctx, w, h, frame);
            return;
        }
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, w, h);
    }

    function getObjectHalfExtents(w, h, scale, state) {
        const base = Math.min(w, h) * 0.045 * scale;
        const shape = state.motionShape || 'ball';

        if (shape === 'box') {
            return { halfW: base * 1.15, halfH: base * 1.15 };
        }

        if (shape === 'text') {
            const fontSize = Math.max(14, Math.min(w, h) * 0.09 * scale);
            const text = state.dvdText || 'OKAMI';
            const halfW = fontSize * text.length * 0.32;
            const halfH = fontSize * 0.55;
            return { halfW, halfH, fontSize };
        }

        if (shape === 'logo') {
            const img = dvdLogoCache.ready ? dvdLogoCache.image : null;
            const half = Math.min(w, h) * 0.08 * scale;
            if (img && img.naturalWidth) {
                const aspect = img.naturalWidth / img.naturalHeight;
                if (aspect >= 1) {
                    return { halfW: half, halfH: half / aspect };
                }
                return { halfW: half * aspect, halfH: half };
            }
            return { halfW: half, halfH: half };
        }

        return { halfW: base, halfH: base };
    }

    function initDvdState(state, w, h, scale) {
        const { halfW, halfH } = getObjectHalfExtents(w, h, scale, state);
        const margin = Math.max(halfW, halfH) + 2;

        state.dvdCx = margin + Math.random() * Math.max(1, w - margin * 2);
        state.dvdCy = margin + Math.random() * Math.max(1, h - margin * 2);

        const baseSpeed = Math.min(w, h) * 0.2;
        const angle = (Math.PI / 4) + (Math.random() * Math.PI / 2);
        state.dvdVx = Math.cos(angle) * baseSpeed;
        state.dvdVy = Math.sin(angle) * baseSpeed;

        state.dvdBounceCount = 0;
        state.dvdFlashUntil = 0;
        state.dvdFlashEdge = '';
        state.dvdTrail = [];
        state.dvdLastTs = 0;
        state.dvdInitialized = true;
        state._dvdCanvasW = w;
        state._dvdCanvasH = h;
    }

    function resolveObjectColor(state, timestamp) {
        const mode = state.colorMode || 'cycle-bounce';

        if (mode === 'fixed') {
            return state.dvdColor || ACCENT;
        }

        if (mode === 'rainbow') {
            const hue = ((timestamp * 0.06) + (state.dvdBounceCount || 0) * 37) % 360;
            return `hsl(${hue}, 82%, 58%)`;
        }

        const idx = (state.dvdBounceCount || 0) % BOUNCE_PALETTE.length;
        return BOUNCE_PALETTE[idx];
    }

    function stepDvdSimulation(state, w, h, timestamp, playing, speed, scale) {
        const resized = state._dvdCanvasW !== w || state._dvdCanvasH !== h;

        if (!state.dvdInitialized) {
            initDvdState(state, w, h, scale);
        } else if (resized) {
            const { halfW, halfH } = getObjectHalfExtents(w, h, scale, state);
            state.dvdCx = Math.min(Math.max(state.dvdCx, halfW), w - halfW);
            state.dvdCy = Math.min(Math.max(state.dvdCy, halfH), h - halfH);
            state._dvdCanvasW = w;
            state._dvdCanvasH = h;
        }

        if (state._syncedDvd) {
            applyDvdSnapshot(state, state._syncedDvd);
            delete state._syncedDvd;
            state.dvdLastTs = timestamp;
        }

        if (playing === false) {
            state.dvdLastTs = timestamp;
            return;
        }

        const lastTs = state.dvdLastTs || timestamp;
        let dt = (timestamp - lastTs) / 1000;
        state.dvdLastTs = timestamp;

        if (dt <= 0) {
            return;
        }

        dt = Math.min(dt, 0.05);

        const speedMult = Math.max(0.25, Number(speed) || 1);
        const { halfW, halfH } = getObjectHalfExtents(w, h, scale, state);

        let cx = state.dvdCx;
        let cy = state.dvdCy;

        cx += state.dvdVx * speedMult * dt;
        cy += state.dvdVy * speedMult * dt;

        let bounced = false;
        let edge = '';

        if (cx - halfW < 0) {
            cx = halfW;
            state.dvdVx = Math.abs(state.dvdVx);
            bounced = true;
            edge = 'left';
        } else if (cx + halfW > w) {
            cx = w - halfW;
            state.dvdVx = -Math.abs(state.dvdVx);
            bounced = true;
            edge = 'right';
        }

        if (cy - halfH < 0) {
            cy = halfH;
            state.dvdVy = Math.abs(state.dvdVy);
            bounced = true;
            edge = 'top';
        } else if (cy + halfH > h) {
            cy = h - halfH;
            state.dvdVy = -Math.abs(state.dvdVy);
            bounced = true;
            edge = 'bottom';
        }

        state.dvdCx = cx;
        state.dvdCy = cy;

        if (bounced) {
            state.dvdBounceCount = (state.dvdBounceCount || 0) + 1;
            if (state.edgeFlash !== false) {
                state.dvdFlashUntil = timestamp + 90;
                state.dvdFlashEdge = edge;
            }
        }

        const trailLen = Math.max(0, Number(state.trailLength ?? 40));
        if (trailLen <= 0 || state.trail === 'off') {
            state.dvdTrail = [];
        } else {
            const maxLen = Math.max(3, Math.round(trailLen / 4));
            if (!Array.isArray(state.dvdTrail)) {
                state.dvdTrail = [];
            }
            state.dvdTrail.push({ x: cx, y: cy });
            while (state.dvdTrail.length > maxLen) {
                state.dvdTrail.shift();
            }
        }
    }

    function drawEdgeFlash(ctx, w, h, state, timestamp) {
        if (!state.dvdFlashUntil || timestamp >= state.dvdFlashUntil) {
            return;
        }

        const elapsed = state.dvdFlashUntil - timestamp;
        const alpha = Math.max(0, Math.min(0.45, (elapsed / 90) * 0.45));
        const thickness = Math.max(4, Math.min(w, h) * 0.035);

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

        switch (state.dvdFlashEdge) {
            case 'left':
                ctx.fillRect(0, 0, thickness, h);
                break;
            case 'right':
                ctx.fillRect(w - thickness, 0, thickness, h);
                break;
            case 'top':
                ctx.fillRect(0, 0, w, thickness);
                break;
            case 'bottom':
                ctx.fillRect(0, h - thickness, w, thickness);
                break;
            default:
                break;
        }
    }

    function drawTrail(ctx, state, color) {
        const trail = state.dvdTrail;
        if (!trail || trail.length < 2) {
            return;
        }

        ctx.save();
        ctx.fillStyle = color;

        const trailOpacity = Math.max(0, Math.min(100, Number(state.trailOpacity ?? 70))) / 100;

        for (let i = 0; i < trail.length; i += 1) {
            const t = (i + 1) / trail.length;
            ctx.globalAlpha = t * 0.38 * trailOpacity;
            ctx.beginPath();
            ctx.arc(trail[i].x, trail[i].y, 2 + t * 5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawDvdShape(ctx, cx, cy, w, h, scale, state, color, timestamp) {
        const shape = state.motionShape || 'ball';
        const extents = getObjectHalfExtents(w, h, scale, state);

        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.004);

        if (shape === 'box') {
            ctx.fillRect(cx - extents.halfW, cy - extents.halfH, extents.halfW * 2, extents.halfH * 2);
            ctx.strokeRect(cx - extents.halfW, cy - extents.halfH, extents.halfW * 2, extents.halfH * 2);
            return;
        }

        if (shape === 'text') {
            const fontSize = extents.fontSize || Math.max(14, Math.min(w, h) * 0.09 * scale);
            ctx.font = `800 ${fontSize}px Montserrat, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color;
            ctx.fillText(state.dvdText || 'OKAMI', cx, cy);
            return;
        }

        if (shape === 'logo') {
            const img = dvdLogoCache.ready ? dvdLogoCache.image : null;
            if (img && img.naturalWidth) {
                ctx.drawImage(
                    img,
                    cx - extents.halfW,
                    cy - extents.halfH,
                    extents.halfW * 2,
                    extents.halfH * 2
                );
                return;
            }
            ctx.fillRect(cx - extents.halfW, cy - extents.halfH, extents.halfW * 2, extents.halfH * 2);
            return;
        }

        const radius = extents.halfW;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    function drawBouncingBall(ctx, w, h, timestamp, scale, state, playing, speed, frame) {
        clearBackground(ctx, w, h, frame, state);
        stepDvdSimulation(state, w, h, timestamp, playing, speed, scale);

        const color = resolveObjectColor(state, timestamp);

        drawEdgeFlash(ctx, w, h, state, timestamp);

        if (state.trail && state.trail !== 'off' && (state.trailLength ?? 40) > 0) {
            drawTrail(ctx, state, color);
        }

        drawDvdShape(ctx, state.dvdCx, state.dvdCy, w, h, scale, state, color, timestamp);
    }

    function preloadDvdLogo(dataUrl, onReady) {
        if (!dataUrl) {
            dvdLogoCache.url = '';
            dvdLogoCache.image = null;
            dvdLogoCache.ready = false;
            return;
        }

        if (dvdLogoCache.url === dataUrl && dvdLogoCache.ready) {
            if (typeof onReady === 'function') {
                onReady(dvdLogoCache.image);
            }
            return;
        }

        dvdLogoCache.url = dataUrl;
        dvdLogoCache.ready = false;
        dvdLogoCache.image = new Image();
        dvdLogoCache.image.onload = () => {
            dvdLogoCache.ready = true;
            if (typeof onReady === 'function') {
                onReady(dvdLogoCache.image);
            }
        };
        dvdLogoCache.image.onerror = () => {
            dvdLogoCache.ready = false;
        };
        dvdLogoCache.image.src = dataUrl;
    }

    function drawBall(ctx, x, y, radius, color) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color || BALL_COLOR;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(1, radius * 0.08);
        ctx.stroke();
    }

    function axisPosition(t, span, margin, mode, reverse) {
        const dir = reverse ? -1 : 1;
        if (mode === 'wrap') {
            const range = Math.max(1, span - margin * 2);
            return margin + ((t * 120 * dir) % range + range) % range;
        }
        return span / 2 + (span / 2 - margin) * Math.sin(t * 1.5 * dir);
    }

    function drawHorizontalBall(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const margin = Math.min(w, h) * 0.12 * scale;
        const radius = Math.min(w, h) * 0.045 * scale;
        const mode = state.wrapMode || 'bounce';
        const x = axisPosition(t, w, margin, mode, state.reverse);
        drawBall(ctx, x, h / 2, radius, getMotionObjectColor(state));
    }

    function drawVerticalBall(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const margin = Math.min(w, h) * 0.12 * scale;
        const radius = Math.min(w, h) * 0.045 * scale;
        const mode = state.wrapMode || 'bounce';
        const y = axisPosition(t, h, margin, mode, state.reverse);
        drawBall(ctx, w / 2, y, radius, getMotionObjectColor(state));
    }

    function drawCircularMotion(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const cx = w / 2;
        const cy = h / 2;
        const orbit = Math.min(w, h) * (Number(state.orbitRadius) || 0.32) * scale;
        const radius = Math.min(w, h) * 0.04 * scale;
        const dir = motionDirection(state);
        drawBall(ctx, cx + Math.cos(t * 1.5 * dir) * orbit, cy + Math.sin(t * 1.5 * dir) * orbit, radius, getMotionObjectColor(state));

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, orbit, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawFigure8(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const cx = w / 2;
        const cy = h / 2;
        const a = Math.min(w, h) * (Number(state.figure8Width) || 0.28) * scale;
        const b = Math.min(w, h) * (Number(state.figure8Height) || 0.28) * scale;
        const dir = motionDirection(state);
        const x = cx + a * Math.sin(t * 1.5 * dir);
        const y = cy + b * Math.sin(t * 1.5 * dir) * Math.cos(t * 1.5 * dir);
        const radius = Math.min(w, h) * 0.04 * scale;
        drawBall(ctx, x, y, radius, getMotionObjectColor(state));
    }

    function drawScrollingHorizontalLines(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const spacing = Math.max(8, Number(state.lineSpacing) || Math.round(28 * scale));
        const thickness = Math.max(1, Number(state.lineThickness) || 2 * scale);
        const dir = motionDirection(state);
        const offset = (t * 80 * scale * dir) % spacing;
        const color = state.lineColor || '#FF6A2D';
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        for (let y = -spacing; y <= h + spacing; y += spacing) {
            const lineY = y + offset;
            ctx.moveTo(0, lineY);
            ctx.lineTo(w, lineY);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function drawScrollingVerticalLines(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const spacing = Math.max(8, Number(state.lineSpacing) || Math.round(28 * scale));
        const thickness = Math.max(1, Number(state.lineThickness) || 2 * scale);
        const dir = motionDirection(state);
        const offset = (t * 80 * scale * dir) % spacing;
        const color = state.lineColor || '#FF6A2D';
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        for (let x = -spacing; x <= w + spacing; x += spacing) {
            const lineX = x + offset;
            ctx.moveTo(lineX, 0);
            ctx.lineTo(lineX, h);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function drawMovingGrid(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const spacing = Math.max(8, Number(state.gridSize) || Math.round(32 * scale));
        const thickness = Math.max(1, Number(state.gridLineThickness) || 1);
        const dir = motionDirection(state);
        const ox = (t * 60 * scale * dir) % spacing;
        const oy = (t * 45 * scale * dir) % spacing;
        const direction = state.gridDirection || 'both';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = thickness;
        ctx.beginPath();
        if (direction === 'both' || direction === 'vertical') {
            for (let x = -spacing; x <= w + spacing; x += spacing) {
                ctx.moveTo(x + ox + 0.5, 0);
                ctx.lineTo(x + ox + 0.5, h);
            }
        }
        if (direction === 'both' || direction === 'horizontal') {
            for (let y = -spacing; y <= h + spacing; y += spacing) {
                ctx.moveTo(0, y + oy + 0.5);
                ctx.lineTo(w, y + oy + 0.5);
            }
        }
        ctx.stroke();
    }

    function drawSiemensStar(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const cx = w / 2;
        const cy = h / 2;
        const outer = Math.min(w, h) * 0.42 * scale;
        const spokes = 24;
        const rotSpeed = Number(state.rotationSpeed) || 0.8;
        const rotation = t * rotSpeed * motionDirection(state);

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

    function drawRotatingLogo(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const cx = w / 2;
        const cy = h / 2;
        const fontSize = Math.max(18, Math.min(w, h) * 0.12 * scale);
        const rotSpeed = Number(state.rotationSpeed) || 0.7;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * rotSpeed * motionDirection(state));

        ctx.fillStyle = getMotionObjectColor(state);
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

    function drawTextCrawl(ctx, w, h, t, scale, frame, state) {
        clearBackground(ctx, w, h, frame, state);
        const text = state.crawlText || 'OKAMI SIGNAL LAB';
        const fontSize = Math.max(14, Number(state.crawlTextSize) || Math.min(w, h) * 0.06 * scale);
        const dir = (state.crawlDirection || 'left') === 'right' ? 1 : -1;
        const speed = Number(state.speed) || 1;
        const textWidth = fontSize * text.length * 0.55;
        const y = h * 0.5;
        const travel = w + textWidth * 2;
        const x = dir > 0
            ? ((t * 120 * speed) % travel) - textWidth
            : w - ((t * 120 * speed) % travel);

        ctx.fillStyle = getMotionObjectColor(state);
        ctx.font = `700 ${fontSize}px Montserrat, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
    }

    const MOTION_RENDERERS = {
        'bouncing-ball': (ctx, w, h, timestamp, scale, state, playing, speed, frame) => {
            drawBouncingBall(ctx, w, h, timestamp, scale, state, playing, speed, frame);
        },
        'horizontal-ball': (ctx, w, h, t, scale, frame, state) => drawHorizontalBall(ctx, w, h, t, scale, frame, state),
        'vertical-ball': (ctx, w, h, t, scale, frame, state) => drawVerticalBall(ctx, w, h, t, scale, frame, state),
        'circular-motion': (ctx, w, h, t, scale, frame, state) => drawCircularMotion(ctx, w, h, t, scale, frame, state),
        'figure-8': (ctx, w, h, t, scale, frame, state) => drawFigure8(ctx, w, h, t, scale, frame, state),
        'scrolling-h-lines': (ctx, w, h, t, scale, frame, state) => drawScrollingHorizontalLines(ctx, w, h, t, scale, frame, state),
        'scrolling-v-lines': (ctx, w, h, t, scale, frame, state) => drawScrollingVerticalLines(ctx, w, h, t, scale, frame, state),
        'moving-grid': (ctx, w, h, t, scale, frame, state) => drawMovingGrid(ctx, w, h, t, scale, frame, state),
        'rotating-siemens-star': (ctx, w, h, t, scale, frame, state) => drawSiemensStar(ctx, w, h, t, scale, frame, state),
        'rotating-logo': (ctx, w, h, t, scale, frame, state) => drawRotatingLogo(ctx, w, h, t, scale, frame, state),
        'text-crawl': (ctx, w, h, t, scale, frame, state) => drawTextCrawl(ctx, w, h, t, scale, frame, state),
        'random-motion': (ctx, w, h, timestamp, scale, state, playing, speed, frame) => {
            global.OkamiSignalLab?.RandomMotion?.drawRandomMotion?.(
                ctx, w, h, timestamp, scale, state, playing, speed, frame, clearBackground
            );
        }
    };

    const MotionEngineModule = {
        id: 'motion-patterns',
        needsAnimationLoop: true,

        defaultState: {
            patternId: 'bouncing-ball',
            playing: true,
            speed: 1,
            reverse: false,
            motionSize: 1,
            objectColor: '#FF6A2D',
            motionBackgroundEnabled: true,
            trailLength: 40,
            trailOpacity: 70,
            motionShape: 'ball',
            colorMode: 'cycle-bounce',
            dvdColor: '#FF6A2D',
            trail: 'short',
            edgeFlash: true,
            dvdText: 'OKAMI',
            dvdLogoDataUrl: '',
            wrapMode: 'bounce',
            orbitRadius: 0.32,
            figure8Width: 0.28,
            figure8Height: 0.28,
            lineThickness: 2,
            lineSpacing: 28,
            lineColor: '#FF6A2D',
            gridSize: 32,
            gridLineThickness: 1,
            gridDirection: 'both',
            rotationSpeed: 0.8,
            crawlText: 'OKAMI SIGNAL LAB',
            crawlTextSize: 48,
            crawlDirection: 'left',
            ...(global.OkamiSignalLab?.RandomMotion?.getDefaultRandomState?.() || {})
        },

        shouldAnimate(state) {
            return state.playing !== false;
        },

        onAttach(engine) {
            const state = engine.state || {};
            if (isBouncingBall(state)) {
                if (!state._syncedDvd && !state.dvdInitialized) {
                    state.dvdInitialized = false;
                }
                preloadDvdLogo(state.dvdLogoDataUrl);
            } else if (isRandomMotion(state)) {
                if (!state._syncedRandom) {
                    global.OkamiSignalLab?.RandomMotion?.resetRandomSim?.(state);
                }
            } else if (!state._syncedMotionTime && state._syncedWallAt === undefined) {
                resetMotionClock();
            }

            if (!engine.state.patternId) {
                engine.setState({ ...this.defaultState });
            }
        },

        onDetach() {
            resetMotionClock();
        },

        onStateChange(engine, state, key) {
            if (key === 'dvdLogoDataUrl') {
                preloadDvdLogo(state.dvdLogoDataUrl, () => {
                    engine.renderFrame(performance.now());
                });
            }

            if (key === 'randomPreset' && state.randomPreset && state.randomPreset !== 'custom') {
                const next = global.OkamiSignalLab?.RandomMotion?.applyPreset?.(state, state.randomPreset);
                if (next) {
                    engine.setState(next);
                    engine.renderFrame(performance.now());
                }
                return;
            }

            if (isRandomMotion(state) && (
                key === 'patternId'
                || key === 'randomMotionType'
                || key === 'objectCount'
                || key === 'motionSize'
                || key === 'randomPreset'
            )) {
                global.OkamiSignalLab?.RandomMotion?.resetRandomSim?.(state);
                engine.setState({ _randomMotion: null });
            }

            if (isBouncingBall(state) && (
                key === 'patternId'
                || key === 'motionSize'
                || key === 'motionShape'
            )) {
                state.dvdInitialized = false;
                engine.setState({ dvdInitialized: false });
            }
        },

        getControlSchema() {
            const range = (key, label, min, max, step, unit, enabledWhen) => ({
                section: 'motion-props',
                type: 'range',
                key,
                label,
                min,
                max,
                step,
                unit,
                enabledWhen
            });

            return [
                {
                    section: 'pattern',
                    type: 'select',
                    key: 'patternId',
                    label: 'Motion Pattern',
                    options: MOTION_CATALOG.map((entry) => ({
                        value: entry.id,
                        label: entry.label
                    }))
                },
                {
                    section: 'motion',
                    type: 'transport',
                    key: 'playing',
                    label: 'Play / Pause'
                },
                range('speed', 'Speed', 0.25, 3, 0.05, '×'),
                {
                    section: 'motion',
                    type: 'checkbox',
                    key: 'reverse',
                    label: 'Reverse Direction',
                    enabledWhen: (s) => !isBouncingBall(s) && !isRandomMotion(s)
                },
                range('motionSize', 'Object Size', 0.3, 1.5, 0.05, '×'),
                {
                    section: 'motion',
                    type: 'text',
                    key: 'objectColor',
                    label: 'Object Color',
                    enabledWhen: (s) => !isRandomMotion(s) || (s.randomColorMode || 'brand') === 'fixed'
                },
                range('trailLength', 'Trail Length', 0, 100, 1, '%', (s) => isBouncingBall(s) || isRandomMotion(s)),
                range('trailOpacity', 'Trail Opacity', 0, 100, 1, '%', (s) => isBouncingBall(s) || isRandomMotion(s)),
                {
                    section: 'motion',
                    type: 'checkbox',
                    key: 'motionBackgroundEnabled',
                    label: 'Background Motion Enable'
                },
                {
                    section: 'motion-props',
                    type: 'select',
                    key: 'motionShape',
                    label: 'Shape',
                    options: [
                        { value: 'ball', label: 'Ball' },
                        { value: 'box', label: 'Box' },
                        { value: 'logo', label: 'Logo' },
                        { value: 'text', label: 'Text' }
                    ],
                    enabledWhen: (s) => isBouncingBall(s)
                },
                {
                    section: 'motion-props',
                    type: 'select',
                    key: 'colorMode',
                    label: 'Bounce Color Change',
                    options: [
                        { value: 'fixed', label: 'Fixed' },
                        { value: 'cycle-bounce', label: 'Cycle on Bounce' },
                        { value: 'rainbow', label: 'Rainbow' }
                    ],
                    enabledWhen: (s) => isBouncingBall(s)
                },
                {
                    section: 'motion-props',
                    type: 'text',
                    key: 'dvdColor',
                    label: 'Bounce Color',
                    enabledWhen: (s) => isBouncingBall(s) && (s.colorMode || 'cycle-bounce') === 'fixed'
                },
                {
                    section: 'motion-props',
                    type: 'checkbox',
                    key: 'edgeFlash',
                    label: 'Edge Flash',
                    enabledWhen: (s) => isBouncingBall(s)
                },
                {
                    section: 'motion-props',
                    type: 'text',
                    key: 'dvdText',
                    label: 'Display Text',
                    enabledWhen: (s) => isBouncingBall(s) && s.motionShape === 'text'
                },
                {
                    section: 'motion-props',
                    type: 'file-upload',
                    key: 'dvdLogoDataUrl',
                    label: 'Logo Image',
                    accept: 'image/*',
                    enabledWhen: (s) => isBouncingBall(s) && s.motionShape === 'logo'
                },
                {
                    section: 'motion-props',
                    type: 'select',
                    key: 'wrapMode',
                    label: 'Wrap Mode',
                    options: [
                        { value: 'bounce', label: 'Bounce' },
                        { value: 'wrap', label: 'Wrap' }
                    ],
                    enabledWhen: (s) => isPattern(s, 'horizontal-ball') || isPattern(s, 'vertical-ball')
                },
                range('orbitRadius', 'Radius', 0.12, 0.45, 0.01, '×', (s) => isPattern(s, 'circular-motion')),
                range('figure8Width', 'Width', 0.12, 0.45, 0.01, '×', (s) => isPattern(s, 'figure-8')),
                range('figure8Height', 'Height', 0.12, 0.45, 0.01, '×', (s) => isPattern(s, 'figure-8')),
                range('lineThickness', 'Line Thickness', 1, 8, 0.5, 'px', (s) => isScrollLines(s)),
                range('lineSpacing', 'Line Spacing', 8, 120, 1, 'px', (s) => isScrollLines(s)),
                {
                    section: 'motion-props',
                    type: 'text',
                    key: 'lineColor',
                    label: 'Line Color',
                    enabledWhen: (s) => isScrollLines(s)
                },
                range('gridSize', 'Grid Size', 8, 128, 1, 'px', (s) => isPattern(s, 'moving-grid')),
                range('gridLineThickness', 'Line Thickness', 1, 6, 0.5, 'px', (s) => isPattern(s, 'moving-grid')),
                {
                    section: 'motion-props',
                    type: 'select',
                    key: 'gridDirection',
                    label: 'Direction',
                    options: [
                        { value: 'both', label: 'Both' },
                        { value: 'horizontal', label: 'Horizontal' },
                        { value: 'vertical', label: 'Vertical' }
                    ],
                    enabledWhen: (s) => isPattern(s, 'moving-grid')
                },
                range('rotationSpeed', 'Rotation Speed', 0.1, 2, 0.05, '×', (s) => isRotating(s)),
                {
                    section: 'motion-props',
                    type: 'text',
                    key: 'crawlText',
                    label: 'Text Content',
                    enabledWhen: (s) => isPattern(s, 'text-crawl')
                },
                range('crawlTextSize', 'Text Size', 14, 120, 1, 'px', (s) => isPattern(s, 'text-crawl')),
                {
                    section: 'motion-props',
                    type: 'select',
                    key: 'crawlDirection',
                    label: 'Direction',
                    options: [
                        { value: 'left', label: 'Left' },
                        { value: 'right', label: 'Right' }
                    ],
                    enabledWhen: (s) => isPattern(s, 'text-crawl')
                },
                ...(global.OkamiSignalLab?.RandomMotion?.getControlSchema?.(range) || [])
            ];
        },

        render(ctx, frame) {
            const w = frame.displayWidth;
            const h = frame.displayHeight;
            const state = frame.state || {};
            const scale = getSizeScale(state);
            const playing = state.playing !== false;
            const speed = Number(state.speed) || 1;

            let patternId = state.patternId || 'bouncing-ball';
            if (!global.OkamiSignalLab?.canRenderPattern?.('motion-patterns', patternId)) {
                patternId = 'bouncing-ball';
            }

            const draw = MOTION_RENDERERS[patternId] || MOTION_RENDERERS['bouncing-ball'];

            if (patternId === 'bouncing-ball' || patternId === 'random-motion') {
                draw(ctx, w, h, frame.timestamp, scale, state, playing, speed, frame);
            } else {
                const t = advanceMotionTime(frame.timestamp, state);
                draw(ctx, w, h, t, scale, frame, state);
            }
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('motion-patterns', MotionEngineModule);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.MotionEngineModule = MotionEngineModule;
    global.OkamiSignalLab.MOTION_CATALOG = MOTION_CATALOG;
    global.OkamiSignalLab.getMotionClockSnapshot = getMotionClockSnapshot;
    global.OkamiSignalLab.extractDvdSnapshot = extractDvdSnapshot;
})(typeof window !== 'undefined' ? window : globalThis);
