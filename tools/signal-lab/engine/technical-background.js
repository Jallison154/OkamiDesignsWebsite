(function(global) {
    'use strict';

    const CHARCOAL = '#1a1a1e';
    const PURE_BLACK = '#000000';

    const BACKGROUND_TYPES = [
        { id: 'technical-grid', label: 'Technical Grid' },
        { id: 'technical-blueprint', label: 'Technical Blueprint' },
        { id: 'hex-pattern', label: 'Hex Pattern' },
        { id: 'carbon-fiber', label: 'Carbon Fiber' },
        { id: 'gradient', label: 'Gradient' },
        { id: 'none', label: 'None' }
    ];

    function normalizeSettings(settings = {}) {
        const enabled = settings.backgroundEnabled !== false;
        let type = settings.backgroundType || 'technical-grid';
        if (!enabled) {
            type = 'none';
        }
        const opacity = Math.max(0, Math.min(100, Number(settings.backgroundOpacity ?? 100)));
        const gridIntensity = Math.max(0, Math.min(100, Number(settings.gridIntensity ?? 100)));
        return { enabled, type, opacity, gridIntensity };
    }

    function isActive(settings) {
        const { enabled, type } = normalizeSettings(settings);
        return enabled && type !== 'none';
    }

    function buildCacheKey(w, h, settings) {
        const { enabled, type, opacity, gridIntensity } = normalizeSettings(settings);
        return `${w}x${h}|${enabled ? type : 'off'}|${opacity}|${gridIntensity}`;
    }

    function ensureCacheHolder(holder) {
        if (!holder) {
            return { key: '', canvas: null };
        }
        if (!holder._techBgCache) {
            holder._techBgCache = { key: '', canvas: null };
        }
        return holder._techBgCache;
    }

    function invalidateCache(holder) {
        const cache = holder?._techBgCache;
        if (cache) {
            cache.key = '';
            cache.canvas = null;
        }
    }

    function gridAlpha(base, intensity) {
        return base * (intensity / 100);
    }

    function drawTechnicalGrid(ctx, w, h, intensity = 100) {
        ctx.fillStyle = CHARCOAL;
        ctx.fillRect(0, 0, w, h);

        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${gridAlpha(0.03, intensity)})`;
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += 20) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
        }
        for (let y = 0; y <= h; y += 20) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 128, 0, ${gridAlpha(0.10, intensity)})`;
        for (let x = 0; x <= w; x += 100) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
        }
        for (let y = 0; y <= h; y += 100) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
        }
        ctx.stroke();
    }

    function drawTechnicalBlueprint(ctx, w, h, intensity = 100) {
        ctx.fillStyle = '#0c1218';
        ctx.fillRect(0, 0, w, h);

        const spacing = 50;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 184, 212, ${gridAlpha(0.08, intensity)})`;
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += spacing) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
        }
        for (let y = 0; y <= h; y += spacing) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 128, 0, ${gridAlpha(0.06, intensity)})`;
        const offset = spacing / 2;
        for (let x = offset; x <= w; x += spacing) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
        }
        for (let y = offset; y <= h; y += spacing) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
        }
        ctx.stroke();

        const cx = w / 2;
        const cy = h / 2;
        const cross = Math.min(w, h) * 0.06;
        ctx.strokeStyle = `rgba(255, 128, 0, ${gridAlpha(0.18, intensity)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - cross, cy + 0.5);
        ctx.lineTo(cx + cross, cy + 0.5);
        ctx.moveTo(cx + 0.5, cy - cross);
        ctx.lineTo(cx + 0.5, cy + cross);
        ctx.stroke();

        ctx.strokeStyle = `rgba(0, 184, 212, ${gridAlpha(0.2, intensity)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, cross * 0.55, 0, Math.PI * 2);
        ctx.stroke();

        const tickLen = 8;
        ctx.strokeStyle = `rgba(255, 255, 255, ${gridAlpha(0.12, intensity)})`;
        for (let x = 0; x <= w; x += 100) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, tickLen);
            ctx.moveTo(x + 0.5, h);
            ctx.lineTo(x + 0.5, h - tickLen);
            ctx.stroke();
        }
        for (let y = 0; y <= h; y += 100) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(tickLen, y + 0.5);
            ctx.moveTo(w, y + 0.5);
            ctx.lineTo(w - tickLen, y + 0.5);
            ctx.stroke();
        }
    }

    function drawHexPattern(ctx, w, h, intensity = 100) {
        ctx.fillStyle = '#16161a';
        ctx.fillRect(0, 0, w, h);

        const radius = 14;
        const hexW = radius * Math.sqrt(3);
        const hexH = radius * 2;
        const rowH = hexH * 0.75;

        ctx.strokeStyle = `rgba(255, 255, 255, ${gridAlpha(0.04, intensity)})`;
        ctx.lineWidth = 1;

        for (let row = -1; row * rowH < h + hexH; row += 1) {
            const y = row * rowH;
            const offsetX = (row % 2) * (hexW / 2);
            for (let col = -1; col * hexW < w + hexW; col += 1) {
                const cx = col * hexW + offsetX;
                const cy = y + (row % 2 === 0 ? 0 : radius * 0.5);
                ctx.beginPath();
                for (let i = 0; i < 6; i += 1) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const px = cx + radius * Math.cos(angle);
                    const py = cy + radius * Math.sin(angle);
                    if (i === 0) {
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
    }

    function drawCarbonFiber(ctx, w, h, intensity = 100) {
        ctx.fillStyle = '#141416';
        ctx.fillRect(0, 0, w, h);

        const step = 5;
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${gridAlpha(0.022, intensity)})`;
        for (let i = -h; i < w + h; i += step) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + h, h);
            ctx.stroke();
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${gridAlpha(0.018, intensity)})`;
        for (let i = -h; i < w + h; i += step) {
            ctx.beginPath();
            ctx.moveTo(i, h);
            ctx.lineTo(i + h, 0);
            ctx.stroke();
        }
    }

    function drawGradient(ctx, w, h) {
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.max(w, h) * 0.72;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, '#242428');
        gradient.addColorStop(0.45, '#18181c');
        gradient.addColorStop(1, PURE_BLACK);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    function drawNone(ctx, w, h) {
        ctx.fillStyle = PURE_BLACK;
        ctx.fillRect(0, 0, w, h);
    }

    const RENDERERS = {
        'technical-grid': drawTechnicalGrid,
        'technical-blueprint': drawTechnicalBlueprint,
        'hex-pattern': drawHexPattern,
        'carbon-fiber': drawCarbonFiber,
        gradient: drawGradient,
        none: drawNone
    };

    function renderToContext(ctx, w, h, settings) {
        const { type, gridIntensity } = normalizeSettings(settings);
        const draw = RENDERERS[type] || RENDERERS['technical-grid'];
        if (type === 'gradient' || type === 'none') {
            draw(ctx, w, h);
        } else {
            draw(ctx, w, h, gridIntensity);
        }
    }

    /**
     * Draw cached technical background into target context.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} w
     * @param {number} h
     * @param {object} settings outputSettings slice
     * @param {object|null} cacheHolder RenderEngine instance or plain object
     */
    function draw(ctx, w, h, settings, cacheHolder) {
        if (!ctx || w <= 0 || h <= 0) {
            return;
        }

        const key = buildCacheKey(w, h, settings);
        const cache = ensureCacheHolder(cacheHolder);

        if (cache.key === key && cache.canvas) {
            const { opacity } = normalizeSettings(settings);
            ctx.save();
            ctx.globalAlpha = opacity / 100;
            ctx.drawImage(cache.canvas, 0, 0, w, h);
            ctx.restore();
            return;
        }

        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const offCtx = offscreen.getContext('2d', { alpha: false });
        if (!offCtx) {
            drawNone(ctx, w, h);
            return;
        }

        renderToContext(offCtx, w, h, settings);
        cache.canvas = offscreen;
        cache.key = key;

        const { opacity } = normalizeSettings(settings);
        ctx.save();
        ctx.globalAlpha = opacity / 100;
        ctx.drawImage(offscreen, 0, 0, w, h);
        ctx.restore();
    }

    /**
     * Module base fill — skip when engine already drew technical background.
     */
    function fillModuleBase(ctx, w, h, frame) {
        const settings = frame?.outputSettings;
        if (isActive(settings)) {
            return;
        }
        ctx.fillStyle = PURE_BLACK;
        ctx.fillRect(0, 0, w, h);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.TechnicalBackground = {
        BACKGROUND_TYPES,
        normalizeSettings,
        isActive,
        buildCacheKey,
        draw,
        renderToContext,
        fillModuleBase,
        invalidateCache
    };
})(typeof window !== 'undefined' ? window : globalThis);
