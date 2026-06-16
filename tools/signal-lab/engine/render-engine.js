(function(global) {
    'use strict';

    /**
     * HiDPI canvas rendering engine for Okami Signal Lab.
     * Renders modules at pattern resolution, scales to preview container.
     */
    class RenderEngine {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d', { alpha: false });
            this.container = options.container || canvas.parentElement;
            this.module = null;
            this.state = {};
            this.outputSettings = options.outputSettings || { patternResolution: 'auto' };
            this.running = false;
            this.rafId = null;
            this.resizeObserver = null;
            this.maxDpr = options.maxDpr || 3;
            this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
            this.backgroundColor = options.backgroundColor || '#050505';
            this.onFrame = options.onFrame || null;
            this.onResize = options.onResize || null;
            this.onPatternMismatch = options.onPatternMismatch || null;
            this.lastTimestamp = 0;
            this.displayWidth = 0;
            this.displayHeight = 0;
            this.bufferWidth = 0;
            this.bufferHeight = 0;
            this.patternWidth = 0;
            this.patternHeight = 0;
            this._layoutWidth = 0;
            this._layoutHeight = 0;
            this._layoutDpr = 0;
            this._patternBufferWidth = 0;
            this._patternBufferHeight = 0;
            this._resizeDebounceMs = options.resizeDebounceMs ?? 50;
            this._resizeTimer = null;
            this._resizeScheduled = false;
            this._pendingZeroSizeRetry = false;
            this._isPopout = Boolean(options.isPopout);

            this.patternCanvas = document.createElement('canvas');
            this.patternCtx = this.patternCanvas.getContext('2d', { alpha: false });

            this._handleResize = this._handleResize.bind(this);
            this._loop = this._loop.bind(this);
            this._onContainerResize = this._onContainerResize.bind(this);

            if (typeof ResizeObserver !== 'undefined' && this.container) {
                this.resizeObserver = new ResizeObserver(this._onContainerResize);
                this.resizeObserver.observe(this.container);
            } else {
                window.addEventListener('resize', this._onContainerResize);
            }

            this._handleResize();
        }

        setOutputSettings(settings) {
            this.outputSettings = { ...this.outputSettings, ...settings };
            this._handleResize();
        }

        setModule(module) {
            if (this.module && typeof this.module.onDetach === 'function') {
                this.module.onDetach(this);
            }

            this.module = module;
            if (module && typeof module.onAttach === 'function') {
                module.onAttach(this);
            }
            this.renderFrame(this.lastTimestamp || performance.now());
        }

        setState(nextState) {
            this.state = { ...this.state, ...nextState };
        }

        getDisplaySize() {
            return {
                width: this.displayWidth,
                height: this.displayHeight
            };
        }

        getPatternSize() {
            return {
                width: this.patternWidth,
                height: this.patternHeight
            };
        }

        start() {
            if (this.running) {
                return;
            }
            this.running = true;
            this.lastTimestamp = performance.now();
            this.rafId = requestAnimationFrame(this._loop);
        }

        stop() {
            this.running = false;
            if (this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        }

        destroy() {
            this.stop();
            this._clearResizeTimer();

            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            } else {
                window.removeEventListener('resize', this._onContainerResize);
            }

            if (this.module && typeof this.module.onDetach === 'function') {
                this.module.onDetach(this);
            }

            this.module = null;
            this.container = null;
            this.patternCanvas = null;
            this.patternCtx = null;
        }

        _resolvePatternDimensions() {
            const resolver = global.OkamiSignalLab?.PatternResolution?.resolvePatternResolution;
            if (typeof resolver === 'function') {
                return resolver(this.outputSettings, this.displayWidth, this.displayHeight);
            }
            return {
                width: this.displayWidth,
                height: this.displayHeight,
                preset: 'auto',
                matchesOutput: true
            };
        }

        _ensurePatternBuffer(patternWidth, patternHeight) {
            if (
                patternWidth === this._patternBufferWidth
                && patternHeight === this._patternBufferHeight
            ) {
                return;
            }

            this._patternBufferWidth = patternWidth;
            this._patternBufferHeight = patternHeight;
            this.patternCanvas.width = patternWidth;
            this.patternCanvas.height = patternHeight;
        }

        renderFrame(timestamp) {
            if (!this.ctx || !this.displayWidth || !this.displayHeight) {
                return;
            }

            const resolved = this._resolvePatternDimensions();
            this.patternWidth = resolved.width;
            this.patternHeight = resolved.height;
            this._ensurePatternBuffer(this.patternWidth, this.patternHeight);

            const patternCtx = this.patternCtx;
            patternCtx.setTransform(1, 0, 0, 1, 0, 0);
            patternCtx.fillStyle = this.backgroundColor;
            patternCtx.fillRect(0, 0, this.patternWidth, this.patternHeight);

            if (this.module && typeof this.module.render === 'function') {
                this.module.render(patternCtx, {
                    timestamp,
                    width: this.patternWidth,
                    height: this.patternHeight,
                    displayWidth: this.patternWidth,
                    displayHeight: this.patternHeight,
                    dpr: 1,
                    patternWidth: this.patternWidth,
                    patternHeight: this.patternHeight,
                    state: this.state
                });
            }

            const ctx = this.ctx;
            ctx.save();
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.fillStyle = this.backgroundColor;
            ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);

            const scale = Math.min(
                this.displayWidth / this.patternWidth,
                this.displayHeight / this.patternHeight
            );
            const drawW = this.patternWidth * scale;
            const drawH = this.patternHeight * scale;
            const drawX = (this.displayWidth - drawW) / 2;
            const drawY = (this.displayHeight - drawH) / 2;

            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(
                this.patternCanvas,
                0,
                0,
                this.patternWidth,
                this.patternHeight,
                drawX,
                drawY,
                drawW,
                drawH
            );
            ctx.restore();

            if (typeof this.onPatternMismatch === 'function') {
                const warning = global.OkamiSignalLab?.PatternResolution?.getMismatchWarning(
                    resolved,
                    this.displayWidth,
                    this.displayHeight
                );
                this.onPatternMismatch(warning, resolved);
            }

            if (typeof this.onFrame === 'function') {
                this.onFrame({
                    timestamp,
                    width: this.displayWidth,
                    height: this.displayHeight,
                    patternWidth: this.patternWidth,
                    patternHeight: this.patternHeight
                });
            }
        }

        _clearResizeTimer() {
            if (this._resizeTimer !== null) {
                clearTimeout(this._resizeTimer);
                this._resizeTimer = null;
            }
            this._resizeScheduled = false;
        }

        _onContainerResize() {
            if (this._resizeScheduled) {
                return;
            }

            this._resizeScheduled = true;
            this._resizeTimer = setTimeout(() => {
                this._resizeTimer = null;
                this._resizeScheduled = false;
                this._handleResize();
            }, this._resizeDebounceMs);
        }

        _handleResize() {
            const container = this.container;
            const canvas = this.canvas;

            if (!container || !canvas || !this.ctx) {
                return;
            }

            const rawWidth = container.clientWidth;
            const rawHeight = container.clientHeight;

            if (rawWidth === 0 || rawHeight === 0) {
                if (!this._pendingZeroSizeRetry) {
                    this._pendingZeroSizeRetry = true;
                    requestAnimationFrame(() => {
                        this._pendingZeroSizeRetry = false;
                        this._handleResize();
                    });
                }
                return;
            }

            const displayWidth = Math.max(1, Math.floor(rawWidth));
            const displayHeight = Math.max(1, Math.floor(rawHeight));
            const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);

            if (
                displayWidth === this._layoutWidth
                && displayHeight === this._layoutHeight
                && dpr === this._layoutDpr
            ) {
                return;
            }

            this._layoutWidth = displayWidth;
            this._layoutHeight = displayHeight;
            this._layoutDpr = dpr;

            this.dpr = dpr;
            this.displayWidth = displayWidth;
            this.displayHeight = displayHeight;
            this.bufferWidth = Math.floor(displayWidth * dpr);
            this.bufferHeight = Math.floor(displayHeight * dpr);

            canvas.width = this.bufferWidth;
            canvas.height = this.bufferHeight;
            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;

            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            if (typeof this.onResize === 'function') {
                this.onResize({
                    width: displayWidth,
                    height: displayHeight,
                    dpr
                });
            }

            this.renderFrame(this.lastTimestamp || performance.now());
        }

        _loop(timestamp) {
            if (!this.running) {
                this.rafId = null;
                return;
            }

            this.lastTimestamp = timestamp;
            this.renderFrame(timestamp);
            this.rafId = requestAnimationFrame(this._loop);
        }
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.RenderEngine = RenderEngine;
})(typeof window !== 'undefined' ? window : globalThis);
