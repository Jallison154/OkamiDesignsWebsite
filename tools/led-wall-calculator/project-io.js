(function(global) {
    'use strict';

    const PROJECT_VERSION = 1;
    const PRODUCT_ID = 'okami-led-wall-calculator';

    function slugify(value) {
        return String(value || 'project')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'project';
    }

    function buildProjectPayload(inputs, state) {
        return {
            version: PROJECT_VERSION,
            product: PRODUCT_ID,
            savedAt: new Date().toISOString(),
            inputs: { ...inputs },
            results: {
                panelsWide: state.panelsWide,
                panelsTall: state.panelsTall,
                totalPanels: state.totalPanels,
                totalPixelWidth: state.totalPixelWidth,
                totalPixelHeight: state.totalPixelHeight,
                totalPixels: state.totalPixels,
                physicalWidthFt: state.physicalWidthFt,
                physicalHeightFt: state.physicalHeightFt,
                aspectRatio: state.aspectRatio,
                closestRatio: state.closestRatio,
                portsRequired: state.portsRequired,
                overlayFormat: state.overlayFormat,
                overlayFormatLabel: state.overlayFormatLabel
            }
        };
    }

    function buildReportText(inputs, state) {
        const lines = [
            'Okami LED Video Wall Calculator — Project Report',
            `Generated: ${new Date().toLocaleString()}`,
            '',
            'WALL',
            `  Grid: ${state.panelsWide} × ${state.panelsTall} (${state.totalPanels.toLocaleString()} panels)`,
            `  Resolution: ${state.totalPixelWidth.toLocaleString()} × ${state.totalPixelHeight.toLocaleString()} px`,
            `  Total pixels: ${state.totalPixels.toLocaleString()}`,
            `  Physical size: ${state.physicalWidthFt.toFixed(2)}' × ${state.physicalHeightFt.toFixed(2)}'`,
            `  Aspect ratio: ${state.closestRatio?.label || state.aspectRatio.toFixed(4)}`,
            '',
            'CABINET',
            `  Preset: ${inputs.cabinetPreset || 'custom'}`,
            `  Size: ${inputs.cabinetWidthMM} × ${inputs.cabinetHeightMM} mm`,
            `  Pixel pitch: P${inputs.pixelPitchMM}`,
            '',
            'PROCESSOR',
            `  Ports required: ${state.portsRequired}`,
            `  Port capacity: ${state.portCapacity?.toLocaleString?.() || inputs.portCapacity}`,
            `  Fill threshold: ${state.portFillThreshold ?? inputs.portFillThreshold}%`,
            `  Usable pixels/port: ${state.usablePixelsPerPort?.toLocaleString?.() || '—'}`
        ];

        if (state.overlay && state.overlayFormatLabel) {
            lines.push(
                '',
                'CONTENT FIT',
                `  Format: ${state.overlayFormatLabel}`,
                `  Active area: ${state.overlay.overlayPixelWidth} × ${state.overlay.overlayPixelHeight} px`,
                `  Used: ${Math.round(state.overlay.usedPercentage)}%`
            );
        }

        lines.push('', '— Okami Designs (okamidesigns.com)');
        return lines.join('\n');
    }

    function downloadBlob(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function downloadProject(inputs, state) {
        const payload = buildProjectPayload(inputs, state);
        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `okami-led-wall-${slugify(`${state.panelsWide}x${state.panelsTall}`)}-${stamp}.json`;
        downloadBlob(filename, JSON.stringify(payload, null, 2), 'application/json');
        return filename;
    }

    function downloadReport(inputs, state) {
        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `okami-led-wall-report-${stamp}.txt`;
        downloadBlob(filename, buildReportText(inputs, state), 'text/plain;charset=utf-8');
        return filename;
    }

    const api = {
        PROJECT_VERSION,
        PRODUCT_ID,
        buildProjectPayload,
        buildReportText,
        downloadProject,
        downloadReport
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    global.OkamiLedWallCalculator.ProjectIO = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
