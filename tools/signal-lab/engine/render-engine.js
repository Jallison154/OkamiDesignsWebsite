(function(global) {
    'use strict';

    /**
     * HiDPI canvas rendering engine for Okami Signal Lab.
     * Renders at pattern resolution; CSS display size scales to fit the wrapper.
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
            this.wrapperWidth = 0;
            this.wrapperHeight = 0;
            this.displayWidth = 0;
            this.displayHeight = 0;
            this.scaleFactor = 1;
            this.scaleMode = 'fit';
            this.patternWidth = 0;
            this.patternHeight = 0;
            this._layoutKey = '';
            this._patternBufferWidth = 0;
            this._patternBufferHeight = 0;
            this._resizeDebounceMs = options.resizeDebounceMs ?? 50;
            this._resizeTimer = null;
            this._resizeScheduled = false;
            this._pendingZeroSizeRetry = false;

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
            this._layoutKey = '';
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

        _resolvePatternDimensions(wrapperWidth, wrapperHeight) {
            const resolver = global.OkamiSignalLab?.PatternResolution?.resolvePatternResolution;
            if (typeof resolver === 'function') {
                return resolver(this.outputSettings, wrapperWidth, wrapperHeight);
            }
            return {
                width: wrapperWidth,
                height: wrapperHeight,
                preset: 'auto',
                matchesOutput: true
            };
        }

        _computeCssDisplaySize(wrapperWidth, wrapperHeight, patternWidth, patternHeight) {
            const scaleMode = this.outputSettings.scaleMode === 'stretch' ? 'stretch' : 'fit';

            if (scaleMode === 'stretch') {
                return {
                    width: wrapperWidth,
                    height: wrapperHeight
                };
            }

            const fit = global.OkamiSignalLab?.CanvasLayout?.computeScaleToFit(
                wrapperWidth,
                wrapperHeight,
                patternWidth,
                patternHeight
            );

            return {
                width: Math.max(1, Math.floor(fit?.drawW || wrapperWidth)),
                height: Math.max(1, Math.floor(fit?.drawH || wrapperHeight))
            };
        }

        _buildLayoutKey(wrapperWidth, wrapperHeight, patternWidth, patternHeight, cssWidth, cssHeight, dpr) {
            const settings = this.outputSettings;
            return [
                wrapperWidth,
                wrapperHeight,
                patternWidth,
                patternHeight,
                cssWidth,
                cssHeight,
                dpr,
                settings.patternResolution,
                settings.patternWidth,
                settings.patternHeight,
                settings.scaleMode
            ].join('|');
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
            if (!this.ctx || !this.patternWidth || !this.patternHeight) {
                return;
            }

            const resolved = this._resolvePatternDimensions(this.wrapperWidth, this.wrapperHeight);
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
            const bufferWidth = Math.floor(this.patternWidth * this.dpr);
            const bufferHeight = Math.floor(this.patternHeight * this.dpr);

            if (this.canvas.width !== bufferWidth || this.canvas.height !== bufferHeight) {
                this.canvas.width = bufferWidth;
                this.canvas.height = bufferHeight;
            }

            ctx.save();
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.fillStyle = this.backgroundColor;
            ctx.fillRect(0, 0, this.patternWidth, this.patternHeight);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(
                this.patternCanvas,
                0,
                0,
                this.patternWidth,
                this.patternHeight
            );
            ctx.restore();

            if (typeof this.onPatternMismatch === 'function') {
                const warning = global.OkamiSignalLab?.PatternResolution?.getMismatchWarning(
                    resolved,
                    this.wrapperWidth,
                    this.wrapperHeight
                );
                this.onPatternMismatch(warning, resolved);
            }

            if (typeof this.onFrame === 'function') {
                this.onFrame({
                    timestamp,
                    width: this.displayWidth,
                    height: this.displayHeight,
                    wrapperWidth: this.wrapperWidth,
                    wrapperHeight: this.wrapperHeight,
                    patternWidth: this.patternWidth,
                    patternHeight: this.patternHeight,
                    scaleFactor: this.scaleFactor,
                    scaleMode: this.scaleMode
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

            const wrapperWidth = Math.max(1, Math.floor(rawWidth));
            const wrapperHeight = Math.max(1, Math.floor(rawHeight));
            const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
            const resolved = this._resolvePatternDimensions(wrapperWidth, wrapperHeight);
            const patternWidth = resolved.width;
            const patternHeight = resolved.height;
            const cssSize = this._computeCssDisplaySize(
                wrapperWidth,
                wrapperHeight,
                patternWidth,
                patternHeight
            );
            const scaleMode = this.outputSettings.scaleMode === 'stretch' ? 'stretch' : 'fit';
            const scaleFactor = scaleMode === 'stretch'
                ? Math.max(cssSize.width / patternWidth, cssSize.height / patternHeight)
                : Math.min(wrapperWidth / patternWidth, wrapperHeight / patternHeight);
            const layoutKey = this._buildLayoutKey(
                wrapperWidth,
                wrapperHeight,
                patternWidth,
                patternHeight,
                cssSize.width,
                cssSize.height,
                dpr
            );

            if (layoutKey === this._layoutKey) {
                return;
            }

            this._layoutKey = layoutKey;
            this.wrapperWidth = wrapperWidth;
            this.wrapperHeight = wrapperHeight;
            this.patternWidth = patternWidth;
            this.patternHeight = patternHeight;
            this.dpr = dpr;
            this.displayWidth = cssSize.width;
            this.displayHeight = cssSize.height;
            this.scaleFactor = scaleFactor;
            this.scaleMode = scaleMode;

            canvas.width = Math.floor(patternWidth * dpr);
            canvas.height = Math.floor(patternHeight * dpr);
            canvas.style.width = `${cssSize.width}px`;
            canvas.style.height = `${cssSize.height}px`;

            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            if (typeof this.onResize === 'function') {
                this.onResize({
                    width: cssSize.width,
                    height: cssSize.height,
                    wrapperWidth,
                    wrapperHeight,
                    patternWidth,
                    patternHeight,
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
