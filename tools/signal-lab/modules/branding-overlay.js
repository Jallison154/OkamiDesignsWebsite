(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';
    const { POSITION_OPTIONS, drawLogo, drawTextOverlay } = global.OkamiSignalLab.OverlayRenderer;

    const logoCache = {
        url: '',
        image: null,
        ready: false
    };

    let attachedEngine = null;

    function drawPreviewBackground(ctx, w, h) {
        ctx.fillStyle = '#141414';
        ctx.fillRect(0, 0, w, h);

        const barH = h * 0.08;
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, w, barH);
        ctx.fillRect(0, h - barH, w, barH);

        ctx.strokeStyle = 'rgba(255, 106, 45, 0.18)';
        ctx.lineWidth = 1;
        const grid = Math.max(24, Math.min(w, h) / 20);
        ctx.beginPath();
        for (let x = 0; x <= w; x += grid) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
        }
        for (let y = 0; y <= h; y += grid) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
        }
        ctx.stroke();

        const inset = Math.min(w, h) * 0.1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = `600 ${Math.max(10, Math.min(w, h) * 0.022)}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('BRANDING OVERLAY PREVIEW', w / 2, barH * 0.35);
    }

    function preloadLogo(dataUrl, onReady) {
        if (!dataUrl) {
            logoCache.url = '';
            logoCache.image = null;
            logoCache.ready = false;
            return;
        }

        if (logoCache.url === dataUrl && logoCache.ready) {
            if (typeof onReady === 'function') {
                onReady(logoCache.image);
            }
            return;
        }

        logoCache.url = dataUrl;
        logoCache.ready = false;
        logoCache.image = new Image();
        logoCache.image.onload = () => {
            logoCache.ready = true;
            if (typeof onReady === 'function') {
                onReady(logoCache.image);
            }
            if (attachedEngine) {
                attachedEngine.renderFrame(performance.now());
            }
        };
        logoCache.image.onerror = () => {
            logoCache.ready = false;
        };
        logoCache.image.src = dataUrl;
    }

    function getReadyLogo() {
        if (logoCache.ready && logoCache.image) {
            return logoCache.image;
        }
        return null;
    }

    const BrandingOverlayModule = {
        id: 'branding',
        needsAnimationLoop: false,

        defaultState: {
            logoEnabled: false,
            logoDataUrl: '',
            logoSize: 20,
            logoOpacity: 1,
            logoPosition: 'bottom-right',
            textEnabled: true,
            customText: 'Okami Signal Lab',
            textSize: 28,
            textOpacity: 0.85,
            textPosition: 'bottom-center'
        },

        onAttach(engine) {
            attachedEngine = engine;
            const state = engine.state || {};
            preloadLogo(state.logoDataUrl);
        },

        onDetach() {
            attachedEngine = null;
        },

        onStateChange(engine, state, key) {
            if (key === 'logoDataUrl') {
                preloadLogo(state.logoDataUrl);
            }
        },

        getControlSchema() {
            return [
                { type: 'section', label: 'Logo' },
                {
                    type: 'file-upload',
                    key: 'logoDataUrl',
                    label: 'Upload Logo',
                    accept: 'image/*'
                },
                {
                    type: 'checkbox',
                    key: 'logoEnabled',
                    label: 'Show Logo'
                },
                {
                    type: 'range',
                    key: 'logoSize',
                    label: 'Logo Size',
                    min: 5,
                    max: 50,
                    step: 1,
                    unit: '%'
                },
                {
                    type: 'range',
                    key: 'logoOpacity',
                    label: 'Logo Opacity',
                    min: 0,
                    max: 1,
                    step: 0.05,
                    unit: ''
                },
                {
                    type: 'select',
                    key: 'logoPosition',
                    label: 'Logo Position',
                    options: POSITION_OPTIONS
                },
                { type: 'section', label: 'Custom Text' },
                {
                    type: 'text',
                    key: 'customText',
                    label: 'Text',
                    placeholder: 'Okami Signal Lab'
                },
                {
                    type: 'checkbox',
                    key: 'textEnabled',
                    label: 'Show Text'
                },
                {
                    type: 'range',
                    key: 'textSize',
                    label: 'Text Size',
                    min: 12,
                    max: 120,
                    step: 1,
                    unit: ' px'
                },
                {
                    type: 'range',
                    key: 'textOpacity',
                    label: 'Text Opacity',
                    min: 0,
                    max: 1,
                    step: 0.05,
                    unit: ''
                },
                {
                    type: 'select',
                    key: 'textPosition',
                    label: 'Text Position',
                    options: POSITION_OPTIONS
                }
            ];
        },

        render(ctx, frame) {
            const w = frame.displayWidth;
            const h = frame.displayHeight;
            const state = frame.state || {};
            const padding = Math.max(16, Math.min(w, h) * 0.04);

            drawPreviewBackground(ctx, w, h);

            if (state.logoEnabled && state.logoDataUrl) {
                if (!logoCache.ready && logoCache.url !== state.logoDataUrl) {
                    preloadLogo(state.logoDataUrl);
                }

                const logo = getReadyLogo();
                drawLogo(ctx, logo, {
                    width: w,
                    height: h,
                    position: state.logoPosition || 'bottom-right',
                    sizePercent: Number(state.logoSize) || 20,
                    opacity: Number(state.logoOpacity) ?? 1,
                    padding
                });
            }

            if (state.textEnabled !== false) {
                drawTextOverlay(ctx, {
                    width: w,
                    height: h,
                    text: state.customText || 'Okami Signal Lab',
                    position: state.textPosition || 'bottom-center',
                    fontSize: Number(state.textSize) || 28,
                    opacity: Number(state.textOpacity) ?? 0.85,
                    padding,
                    color: '#ffffff'
                });
            }

            ctx.fillStyle = ACCENT;
            ctx.font = `600 ${Math.max(9, Math.min(w, h) * 0.018)}px Montserrat, sans-serif`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.globalAlpha = 0.55;
            ctx.fillText('Overlay active on output', w - padding, h - padding * 0.35);
            ctx.globalAlpha = 1;
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('branding', BrandingOverlayModule);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.BrandingOverlayModule = BrandingOverlayModule;
})(typeof window !== 'undefined' ? window : globalThis);
