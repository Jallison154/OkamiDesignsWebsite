(function(global) {
    'use strict';

    /** Scale content to fit inside a container, centered (letterbox/pillarbox). */
    function computeScaleToFit(containerW, containerH, contentW, contentH) {
        const cw = Math.max(1, contentW);
        const ch = Math.max(1, contentH);
        const scale = Math.min(containerW / cw, containerH / ch);
        const drawW = cw * scale;
        const drawH = ch * scale;

        return {
            scale,
            drawW,
            drawH,
            drawX: (containerW - drawW) / 2,
            drawY: (containerH - drawH) / 2
        };
    }

    /** Scale content to fill container (stretch; may distort aspect ratio). */
    function computeScaleToFill(containerW, containerH, contentW, contentH) {
        return {
            scale: Math.max(containerW / Math.max(1, contentW), containerH / Math.max(1, contentH)),
            drawW: containerW,
            drawH: containerH,
            drawX: 0,
            drawY: 0
        };
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.CanvasLayout = { computeScaleToFit, computeScaleToFill };
})(typeof window !== 'undefined' ? window : globalThis);
