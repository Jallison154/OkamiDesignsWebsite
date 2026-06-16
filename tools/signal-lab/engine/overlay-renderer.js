(function(global) {
    'use strict';

    const POSITION_OPTIONS = [
        { value: 'top-left', label: 'Top Left' },
        { value: 'top-center', label: 'Top Center' },
        { value: 'top-right', label: 'Top Right' },
        { value: 'center-left', label: 'Center Left' },
        { value: 'center', label: 'Center' },
        { value: 'center-right', label: 'Center Right' },
        { value: 'bottom-left', label: 'Bottom Left' },
        { value: 'bottom-center', label: 'Bottom Center' },
        { value: 'bottom-right', label: 'Bottom Right' }
    ];

    function resolveAnchor(position, width, height, padding) {
        const pad = padding ?? Math.max(16, Math.min(width, height) * 0.04);
        const map = {
            'top-left': { x: pad, y: pad, align: 'left', baseline: 'top' },
            'top-center': { x: width / 2, y: pad, align: 'center', baseline: 'top' },
            'top-right': { x: width - pad, y: pad, align: 'right', baseline: 'top' },
            'center-left': { x: pad, y: height / 2, align: 'left', baseline: 'middle' },
            center: { x: width / 2, y: height / 2, align: 'center', baseline: 'middle' },
            'center-right': { x: width - pad, y: height / 2, align: 'right', baseline: 'middle' },
            'bottom-left': { x: pad, y: height - pad, align: 'left', baseline: 'bottom' },
            'bottom-center': { x: width / 2, y: height - pad, align: 'center', baseline: 'bottom' },
            'bottom-right': { x: width - pad, y: height - pad, align: 'right', baseline: 'bottom' }
        };

        return map[position] || map['bottom-right'];
    }

    function drawLogo(ctx, image, options) {
        if (!image || !image.complete || !image.naturalWidth) {
            return;
        }

        const {
            width,
            height,
            position,
            sizePercent = 20,
            opacity = 1,
            padding
        } = options;

        const anchor = resolveAnchor(position, width, height, padding);
        const maxDim = Math.min(width, height) * (sizePercent / 100);
        const aspect = image.naturalWidth / image.naturalHeight;
        let drawW = maxDim;
        let drawH = maxDim;

        if (aspect >= 1) {
            drawH = maxDim / aspect;
        } else {
            drawW = maxDim * aspect;
        }

        let x = anchor.x;
        let y = anchor.y;

        if (anchor.align === 'center') {
            x -= drawW / 2;
        } else if (anchor.align === 'right') {
            x -= drawW;
        }

        if (anchor.baseline === 'middle') {
            y -= drawH / 2;
        } else if (anchor.baseline === 'bottom') {
            y -= drawH;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        ctx.drawImage(image, x, y, drawW, drawH);
        ctx.restore();
    }

    function drawTextOverlay(ctx, options) {
        const {
            width,
            height,
            text,
            position,
            fontSize = 28,
            opacity = 1,
            padding,
            color = '#ffffff',
            fontFamily = 'Montserrat, sans-serif'
        } = options;

        if (!text || !String(text).trim()) {
            return;
        }

        const anchor = resolveAnchor(position, width, height, padding);
        const size = Math.max(12, fontSize);

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        ctx.fillStyle = color;
        ctx.font = `700 ${size}px ${fontFamily}`;
        ctx.textAlign = anchor.align;
        ctx.textBaseline = anchor.baseline;
        ctx.fillText(String(text), anchor.x, anchor.y);
        ctx.restore();
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.OverlayRenderer = {
        POSITION_OPTIONS,
        resolveAnchor,
        drawLogo,
        drawTextOverlay
    };
})(typeof window !== 'undefined' ? window : globalThis);
