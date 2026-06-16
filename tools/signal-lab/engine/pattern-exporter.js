(function(global) {
    'use strict';

    const RESOLUTION_PRESETS = [
        { id: 'current', label: 'Current Display' },
        { id: '1920x1080', label: '1920 × 1080', width: 1920, height: 1080 },
        { id: '2560x1440', label: '2560 × 1440', width: 2560, height: 1440 },
        { id: '3840x2160', label: '3840 × 2160 (4K UHD)', width: 3840, height: 2160 },
        { id: '4096x2160', label: '4096 × 2160 (4K DCI)', width: 4096, height: 2160 },
        { id: '7680x4320', label: '7680 × 4320 (8K UHD)', width: 7680, height: 4320 },
        { id: 'custom', label: 'Custom' }
    ];

    const EXPORTABLE_MODULES = [
        'video-patterns',
        'motion-patterns',
        'sync-tools',
        'branding',
        'display-info',
        'led-utilities'
    ];

    const MAX_PIXELS = 34000000;

    function sanitizeFilenamePart(value) {
        return String(value || 'pattern')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'pattern';
    }

    function formatExportDate(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function buildFilename(patternName, width, height, format, date = new Date()) {
        const ext = format === 'jpg' ? 'jpg' : 'png';
        return `${sanitizeFilenamePart(patternName)}_${width}x${height}_${formatExportDate(date)}.${ext}`;
    }

    function resolvePatternName(sourceModuleId, sourceState) {
        if (!sourceState) {
            return sourceModuleId;
        }

        if (sourceState.patternId) {
            if (sourceState.patternId === 'okami-calibration') {
                return 'okami-calibration-pattern';
            }
            return sourceState.patternId;
        }
        if (sourceState.mode) {
            return sourceState.mode;
        }
        if (sourceModuleId === 'branding') {
            return 'branding-overlay';
        }
        if (sourceModuleId === 'led-utilities' && sourceState) {
            const wide = Math.max(1, Math.floor(Number(sourceState.panelsWide) || 1));
            const tall = Math.max(1, Math.floor(Number(sourceState.panelsTall) || 1));
            const pw = Math.max(1, Math.floor(Number(sourceState.panelWidthPx) || 192));
            const ph = Math.max(1, Math.floor(Number(sourceState.panelHeightPx) || 192));
            return `led-wall-${pw * wide}x${ph * tall}`;
        }
        return sourceModuleId;
    }

    function resolveResolution(exportState, displaySize) {
        const preset = exportState.resolutionPreset || '1920x1080';

        if (preset === 'current') {
            return {
                width: Math.max(1, Math.floor(displaySize?.width || 1920)),
                height: Math.max(1, Math.floor(displaySize?.height || 1080))
            };
        }

        if (preset === 'custom') {
            return {
                width: Math.max(1, Math.floor(Number(exportState.customWidth) || 1920)),
                height: Math.max(1, Math.floor(Number(exportState.customHeight) || 1080))
            };
        }

        const match = RESOLUTION_PRESETS.find((entry) => entry.id === preset);
        if (match?.width && match?.height) {
            return { width: match.width, height: match.height };
        }

        return { width: 1920, height: 1080 };
    }

    function loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            if (!dataUrl) {
                resolve(null);
                return;
            }

            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Failed to load watermark logo.'));
            image.src = dataUrl;
        });
    }

    function drawExportWatermarks(ctx, width, height, options) {
        const { drawTextOverlay, drawLogo } = global.OkamiSignalLab.OverlayRenderer;
        const padding = Math.max(24, Math.min(width, height) * 0.025);

        if (options.textWatermarkEnabled) {
            drawTextOverlay(ctx, {
                width,
                height,
                text: options.textWatermarkText || 'Okami Signal Lab',
                position: 'bottom-right',
                fontSize: Math.max(18, Math.round(height * 0.022)),
                opacity: Number(options.textWatermarkOpacity) ?? 0.45,
                padding,
                color: '#ffffff'
            });
        }

        if (options.logoWatermarkEnabled && options.logoImage) {
            drawLogo(ctx, options.logoImage, {
                width,
                height,
                position: 'bottom-left',
                sizePercent: Number(options.logoWatermarkSize) || 12,
                opacity: Number(options.logoWatermarkOpacity) ?? 0.55,
                padding
            });
        }
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function renderToCanvas(options) {
        const {
            sourceModuleId,
            sourceState,
            width,
            height,
            backgroundColor = '#050505',
            watermarks = {}
        } = options;

        const registry = global.OkamiSignalLab?.ModuleRegistry;
        const renderer = registry?.getRenderer(sourceModuleId);

        if (!renderer || typeof renderer.render !== 'function') {
            throw new Error('Selected pattern source cannot be exported.');
        }

        if (width * height > MAX_PIXELS) {
            throw new Error(`Resolution too large (${width}×${height}). Maximum is ${MAX_PIXELS.toLocaleString()} pixels.`);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
            throw new Error('Unable to create export canvas.');
        }

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        renderer.render(ctx, {
            timestamp: performance.now(),
            width,
            height,
            displayWidth: width,
            displayHeight: height,
            dpr: 1,
            state: { ...sourceState }
        });

        let logoImage = null;
        if (watermarks.logoWatermarkEnabled) {
            const logoUrl = watermarks.logoWatermarkDataUrl || watermarks.fallbackLogoDataUrl || '';
            logoImage = await loadImage(logoUrl);
        }

        drawExportWatermarks(ctx, width, height, {
            ...watermarks,
            logoImage
        });

        return canvas;
    }

    async function exportPattern(options) {
        const {
            exportState,
            allModuleState,
            displaySize,
            activeModuleId
        } = options;

        let sourceModuleId = exportState.sourceModuleId || 'video-patterns';
        if (sourceModuleId === 'active') {
            sourceModuleId = activeModuleId;
        }

        if (!EXPORTABLE_MODULES.includes(sourceModuleId)) {
            throw new Error('The selected module cannot be exported as an image.');
        }

        const sourceState = allModuleState[sourceModuleId] || {};
        const { width, height } = resolveResolution(exportState, displaySize);
        const format = exportState.format === 'jpg' ? 'jpg' : 'png';
        const patternName = resolvePatternName(sourceModuleId, sourceState);
        const filename = buildFilename(patternName, width, height, format);

        const canvas = await renderToCanvas({
            sourceModuleId,
            sourceState,
            width,
            height,
            watermarks: {
                textWatermarkEnabled: exportState.textWatermarkEnabled,
                textWatermarkText: exportState.textWatermarkText,
                textWatermarkOpacity: exportState.textWatermarkOpacity,
                logoWatermarkEnabled: exportState.logoWatermarkEnabled,
                logoWatermarkDataUrl: exportState.logoWatermarkDataUrl,
                logoWatermarkOpacity: exportState.logoWatermarkOpacity,
                logoWatermarkSize: exportState.logoWatermarkSize,
                fallbackLogoDataUrl: allModuleState.branding?.logoDataUrl || ''
            }
        });

        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality = format === 'jpg' ? 0.92 : undefined;

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(new Error('Export encoding failed.'));
                }
            }, mimeType, quality);
        });

        downloadBlob(blob, filename);

        return { filename, width, height, format, patternName, sourceModuleId };
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.PatternExporter = {
        RESOLUTION_PRESETS,
        EXPORTABLE_MODULES,
        sanitizeFilenamePart,
        buildFilename,
        resolvePatternName,
        resolveResolution,
        renderToCanvas,
        exportPattern
    };
})(typeof window !== 'undefined' ? window : globalThis);
