(function(global) {
    'use strict';

    class RefreshRateEstimator {
        constructor(sampleSize = 120) {
            this.sampleSize = sampleSize;
            this.samples = [];
            this.lastTimestamp = 0;
            this.hz = 0;
        }

        reset() {
            this.samples = [];
            this.lastTimestamp = 0;
            this.hz = 0;
        }

        update(timestamp) {
            if (this.lastTimestamp > 0) {
                const delta = timestamp - this.lastTimestamp;
                if (delta >= 5 && delta <= 100) {
                    this.samples.push(delta);
                    if (this.samples.length > this.sampleSize) {
                        this.samples.shift();
                    }
                    const avg = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
                    this.hz = Math.round(1000 / avg);
                }
            }
            this.lastTimestamp = timestamp;
            return this.hz;
        }
    }

    function gcd(a, b) {
        let x = Math.abs(Math.round(a));
        let y = Math.abs(Math.round(b));
        while (y) {
            const temp = y;
            y = x % y;
            x = temp;
        }
        return x || 1;
    }

    function formatAspectRatio(width, height) {
        if (!width || !height) {
            return '—';
        }

        const divisor = gcd(width, height);
        const ratioW = Math.round(width / divisor);
        const ratioH = Math.round(height / divisor);
        const decimal = (width / height).toFixed(2);
        return `${ratioW}:${ratioH} (${decimal}:1)`;
    }

    function getFullscreenStatus() {
        const element = document.fullscreenElement;
        if (!element) {
            return { active: false, label: 'No' };
        }

        const hint = element.id
            || (typeof element.className === 'string' && element.className.split(' ')[0])
            || element.tagName.toLowerCase();

        return { active: true, label: `Yes (${hint})` };
    }

    function collectDisplayMetrics() {
        const screenWidth = window.screen?.width ?? 0;
        const screenHeight = window.screen?.height ?? 0;
        const viewportWidth = window.innerWidth ?? 0;
        const viewportHeight = window.innerHeight ?? 0;
        const fullscreen = getFullscreenStatus();

        return {
            screenWidth,
            screenHeight,
            viewportWidth,
            viewportHeight,
            aspectRatio: formatAspectRatio(viewportWidth, viewportHeight),
            devicePixelRatio: window.devicePixelRatio ?? 1,
            fullscreen: fullscreen.label,
            fullscreenActive: fullscreen.active
        };
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.DisplayMetrics = {
        RefreshRateEstimator,
        collectDisplayMetrics,
        formatAspectRatio,
        getFullscreenStatus
    };
})(typeof window !== 'undefined' ? window : globalThis);
