(function(global) {
    'use strict';

    const Calc = global.OkamiLedWallCalculator;
    const C = Calc?.Constants;
    const WEBSITE_URL = 'https://okamidesigns.com';
    const MM_PER_FOOT = C?.MM_PER_FOOT || 304.8;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hasValue(value) {
        return value !== null && value !== undefined && value !== '' && !Number.isNaN(value);
    }

    function formatNumber(value) {
        return Number(value).toLocaleString('en-US');
    }

    function formatMegapixels(totalPixels) {
        if (!hasValue(totalPixels) || totalPixels <= 0) {
            return null;
        }
        const mp = totalPixels / 1000000;
        return mp >= 10 ? `${mp.toFixed(1)} MP` : `${mp.toFixed(2)} MP`;
    }

    function formatFeetInches(feetDecimal) {
        if (!hasValue(feetDecimal)) {
            return null;
        }
        const totalInches = Math.round(feetDecimal * 12);
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return `${feet}' ${inches}"`;
    }

    function formatMeters(mm) {
        if (!hasValue(mm)) {
            return null;
        }
        return `${(mm / 1000).toFixed(2)} m`;
    }

    function formatPortCapacity(capacity) {
        if (!hasValue(capacity)) {
            return null;
        }
        if (capacity >= 1000000) {
            const millions = capacity / 1000000;
            return Number.isInteger(millions) ? `${millions}M px` : `${millions.toFixed(1)}M px`;
        }
        if (capacity >= 1000) {
            return `${Math.round(capacity / 1000)}k px`;
        }
        return `${capacity.toLocaleString()} px`;
    }

    function formatCabinetPresetLabel(preset) {
        const labels = {
            '500x500': '500 × 500 mm',
            '500x1000': '500 × 1000 mm',
            custom: 'Custom'
        };
        return labels[preset] || 'Custom';
    }

    function formatDisplayMode(inputs) {
        if (Calc?.isCustomSpacingDisplayType?.(inputs.displayType)) {
            return 'Custom LED Spacing';
        }
        return 'Standard LED';
    }

    function formatPitchOrSpacing(inputs) {
        if (Calc?.isCustomSpacingDisplayType?.(inputs.displayType)) {
            const h = inputs.meshPitchHorizontalMM;
            const v = inputs.meshPitchVerticalMM;
            if (!hasValue(h) || !hasValue(v)) {
                return null;
            }
            return `${h} × ${v} mm spacing`;
        }

        const pitchPreset = inputs.pitchPreset;
        if (pitchPreset && pitchPreset !== 'custom') {
            return `P${pitchPreset}`;
        }

        if (hasValue(inputs.pixelPitchMM)) {
            return `${Number(inputs.pixelPitchMM).toFixed(1)} mm pitch`;
        }

        return null;
    }

    function formatCabinetOrientation(state) {
        const type = state.cabinetArtworkType;
        if (type === 'square') {
            return 'Square cabinets (1:1)';
        }
        if (type === 'tall') {
            return 'Portrait cabinets (1:2 height)';
        }
        if (state.cabinetHeightMM > state.cabinetWidthMM) {
            return 'Portrait orientation';
        }
        if (state.cabinetWidthMM > state.cabinetHeightMM) {
            return 'Landscape orientation';
        }
        return 'Square orientation';
    }

    /**
     * Pixel-based port load plan for build sheet display.
     */
    function calculatePortMapping(state) {
        const ports = [];
        const portsRequired = state.portsRequired;
        const usablePixelsPerPort = state.usablePixelsPerPort;
        const totalPixels = state.totalPixels;
        const pixelsPerCabinet = state.pixelWidth * state.pixelHeight;

        if (!portsRequired || !usablePixelsPerPort || !totalPixels) {
            return ports;
        }

        let assignedPixels = 0;
        for (let portNum = 1; portNum <= portsRequired; portNum += 1) {
            const remaining = totalPixels - assignedPixels;
            const portPixels = portNum === portsRequired
                ? remaining
                : Math.min(usablePixelsPerPort, remaining);
            const fillPercent = usablePixelsPerPort > 0
                ? (portPixels / usablePixelsPerPort) * 100
                : 0;
            const cabinetsEstimate = pixelsPerCabinet > 0
                ? Math.round(portPixels / pixelsPerCabinet)
                : 0;

            ports.push({
                port: portNum,
                pixels: portPixels,
                fillPercent,
                cabinetsEstimate: Math.min(cabinetsEstimate, state.totalPanels)
            });
            assignedPixels += portPixels;
        }

        return ports;
    }

    function collectWarnings(inputs, state, portMapping) {
        const warnings = [];

        if (portMapping.length) {
            const peakFill = Math.max(...portMapping.map((entry) => entry.fillPercent));
            if (peakFill >= 98) {
                warnings.push('At least one port is at or above 98% of the configured fill threshold. Confirm processor headroom with your controller manufacturer.');
            } else if (peakFill >= 90) {
                warnings.push('One or more ports are near the configured fill threshold. Consider additional headroom for stable playback.');
            }
        }

        if (state.portsRequired >= 12) {
            warnings.push(`High port count (${state.portsRequired}). Verify sending card, processor, and fiber/converter layout.`);
        }

        if (inputs.autoCalculateResolution === false) {
            warnings.push('Cabinet pixel resolution is manually overridden — confirm values against manufacturer specifications.');
        }

        if (inputs.cabinetPreset === 'custom' || !['500x500', '500x1000'].includes(inputs.cabinetPreset)) {
            warnings.push('Custom cabinet dimensions are in use — verify physical size and mounting before fabrication.');
        }

        if (state.overlay && state.overlay.usedPercentage < 85) {
            warnings.push(`Content overlay (${state.overlayFormatLabel}) uses ${Math.round(state.overlay.usedPercentage)}% of the wall — significant inactive pixels remain outside the target format.`);
        }

        return warnings;
    }

    function buildDetailRows(rows) {
        return rows.filter((row) => hasValue(row.value));
    }

    function buildBuildSheetModel(inputs, state, options = {}) {
        const exportedAt = options.exportedAt || new Date();
        const portMapping = calculatePortMapping(state);
        const warnings = collectWarnings(inputs, state, portMapping);
        const widthFt = formatFeetInches(state.physicalWidthFt);
        const heightFt = formatFeetInches(state.physicalHeightFt);
        const widthM = formatMeters(state.physicalWidthMM);
        const heightM = formatMeters(state.physicalHeightMM);
        const physicalSize = widthFt && heightFt && widthM && heightM
            ? `${widthFt} × ${heightFt} (${widthM} × ${heightM})`
            : null;

        const avgCabinetsPerPort = portMapping.length
            ? Math.round(portMapping.reduce((sum, entry) => sum + entry.cabinetsEstimate, 0) / portMapping.length)
            : null;

        const model = {
            exportedAt,
            projectName: options.projectName?.trim() || null,
            logoUrl: options.logoUrl || '../GFX/Full/Okami_Designs_FullW.png',
            websiteUrl: options.websiteUrl || WEBSITE_URL,
            warnings,
            portMapping,
            sections: {
                overview: buildDetailRows([
                    { label: 'Wall grid (W × H)', value: `${state.panelsWide} × ${state.panelsTall} cabinets` },
                    { label: 'Total cabinets', value: formatNumber(state.totalPanels) },
                    { label: 'Physical size', value: physicalSize },
                    { label: 'Aspect ratio', value: state.closestRatio?.label || (state.aspectRatio ? state.aspectRatio.toFixed(3) : null) },
                    { label: 'Display mode', value: formatDisplayMode(inputs) },
                    { label: 'Pixel pitch / spacing', value: formatPitchOrSpacing(inputs) },
                    { label: 'Cabinet size', value: `${state.cabinetWidthMM} × ${state.cabinetHeightMM} mm` },
                    { label: 'Cabinet type', value: formatCabinetPresetLabel(inputs.cabinetPreset) }
                ]),
                resolution: buildDetailRows([
                    { label: 'Total resolution', value: `${formatNumber(state.totalPixelWidth)} × ${formatNumber(state.totalPixelHeight)} px` },
                    { label: 'Pixels per cabinet', value: `${formatNumber(state.pixelWidth)} × ${formatNumber(state.pixelHeight)} px` },
                    { label: 'Horizontal pixels', value: formatNumber(state.totalPixelWidth) },
                    { label: 'Vertical pixels', value: formatNumber(state.totalPixelHeight) },
                    { label: 'Total pixels', value: formatNumber(state.totalPixels) },
                    { label: 'Megapixels', value: formatMegapixels(state.totalPixels) }
                ]),
                processor: buildDetailRows([
                    { label: 'Port capacity setting', value: state.portCapacity ? `${formatNumber(state.portCapacity)} px max/port` : null },
                    { label: 'Fill threshold', value: hasValue(state.portFillThreshold) ? `${state.portFillThreshold}%` : null },
                    { label: 'Usable pixels per port', value: state.usablePixelsPerPort ? `${formatNumber(state.usablePixelsPerPort)} px` : null },
                    { label: 'Total ports required', value: hasValue(state.portsRequired) ? formatNumber(state.portsRequired) : null },
                    { label: 'Avg. cabinets per port (est.)', value: avgCabinetsPerPort ? `~${avgCabinetsPerPort}` : null },
                    { label: 'Sending hardware', value: 'Confirm processor / sending card model with manufacturer — capacity settings above are user-defined.' }
                ]),
                buildNotes: buildDetailRows([
                    { label: 'Cabinet orientation', value: formatCabinetOrientation(state) },
                    { label: 'Resolution mode', value: inputs.autoCalculateResolution === false ? 'Manual cabinet resolution' : 'Auto-calculated from pitch / spacing' },
                    Calc?.isCustomSpacingDisplayType?.(inputs.displayType)
                        ? { label: 'Custom LED spacing', value: `${inputs.meshPitchHorizontalMM} × ${inputs.meshPitchVerticalMM} mm` }
                        : null,
                    state.overlay && state.overlayFormatLabel
                        ? {
                            label: 'Content overlay',
                            value: `${state.overlayFormatLabel} — ${formatNumber(state.overlay.overlayPixelWidth)} × ${formatNumber(state.overlay.overlayPixelHeight)} px (${Math.round(state.overlay.usedPercentage)}% of wall used)`
                        }
                        : null,
                    inputs.overlayFormat && inputs.overlayFormat !== 'none' && !state.overlay
                        ? { label: 'Content overlay', value: 'Enabled (no active area calculated)' }
                        : null
                ].filter(Boolean))
            }
        };

        return model;
    }

    function renderDetailSection(title, rows) {
        if (!rows.length) {
            return '';
        }

        const items = rows.map((row) => `
            <div class="build-sheet-row">
                <dt>${escapeHtml(row.label)}</dt>
                <dd>${escapeHtml(row.value)}</dd>
            </div>
        `).join('');

        return `
            <section class="build-sheet-section">
                <h2 class="build-sheet-section-title">${escapeHtml(title)}</h2>
                <dl class="build-sheet-details">${items}</dl>
            </section>
        `;
    }

    function renderPortMappingSection(portMapping, warnings) {
        if (!portMapping.length) {
            return '';
        }

        const rows = portMapping.map((entry) => `
            <tr>
                <td>Port ${entry.port}</td>
                <td>${formatNumber(entry.pixels)} px</td>
                <td>${entry.fillPercent.toFixed(1)}%</td>
                <td>~${formatNumber(entry.cabinetsEstimate)}</td>
            </tr>
        `).join('');

        const warningHtml = warnings.length
            ? `<p class="build-sheet-note build-sheet-note--warn">Review port loading before deployment. Estimates assume sequential pixel distribution.</p>`
            : `<p class="build-sheet-note">Cabinet counts per port are estimates based on pixel load — confirm mapping with your processor software.</p>`;

        return `
            <section class="build-sheet-section">
                <h2 class="build-sheet-section-title">Port Mapping / Data Plan</h2>
                <p class="build-sheet-lead">${formatNumber(portMapping.length)} sending port${portMapping.length === 1 ? '' : 's'} suggested for this wall configuration.</p>
                <div class="build-sheet-table-wrap">
                    <table class="build-sheet-table">
                        <thead>
                            <tr>
                                <th>Port</th>
                                <th>Pixel load</th>
                                <th>Fill %</th>
                                <th>Cabinets (est.)</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                ${warningHtml}
            </section>
        `;
    }

    function renderWarningsSection(warnings) {
        if (!warnings.length) {
            return '';
        }

        const items = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('');
        return `
            <section class="build-sheet-section build-sheet-section--warnings">
                <h2 class="build-sheet-section-title">Warnings &amp; Notes</h2>
                <ul class="build-sheet-warnings">${items}</ul>
            </section>
        `;
    }

    function renderPowerSection() {
        return `
            <section class="build-sheet-section">
                <h2 class="build-sheet-section-title">Power / Prep</h2>
                <p class="build-sheet-note">Power draw, circuit count, and rigging requirements are not calculated by this tool. Confirm amperage, breaker layout, and mounting with cabinet manufacturer specifications before install.</p>
            </section>
        `;
    }

    function buildBuildSheetHtml(model) {
        const exportLabel = model.exportedAt.toLocaleString(undefined, {
            dateStyle: 'full',
            timeStyle: 'short'
        });

        const projectLine = model.projectName
            ? `<p class="build-sheet-project">${escapeHtml(model.projectName)}</p>`
            : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LED Wall Configuration — Okami Designs</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --okami-bg: #121212;
            --okami-card: #1a1a1a;
            --okami-border: rgba(255, 255, 255, 0.08);
            --okami-text: #f2f2f2;
            --okami-muted: rgba(255, 255, 255, 0.58);
            --okami-accent: #ff6a2d;
        }

        * { box-sizing: border-box; }

        html, body {
            margin: 0;
            padding: 0;
            background: var(--okami-bg);
            color: var(--okami-text);
            font-family: "Montserrat", "Segoe UI", Arial, sans-serif;
            line-height: 1.45;
        }

        body {
            padding: 24px;
        }

        .build-sheet-page {
            max-width: 8.5in;
            margin: 0 auto;
        }

        .build-sheet-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding-bottom: 18px;
            border-bottom: 2px solid rgba(255, 106, 45, 0.45);
            margin-bottom: 22px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .build-sheet-brand img {
            display: block;
            max-width: 180px;
            height: auto;
        }

        .build-sheet-header-meta {
            text-align: right;
        }

        .build-sheet-title {
            margin: 0 0 6px;
            font-size: 1.55rem;
            font-weight: 800;
            letter-spacing: -0.02em;
        }

        .build-sheet-subtitle,
        .build-sheet-exported,
        .build-sheet-project {
            margin: 0;
            color: var(--okami-muted);
            font-size: 0.92rem;
        }

        .build-sheet-project {
            margin-top: 6px;
            color: var(--okami-accent);
            font-weight: 700;
        }

        .build-sheet-section {
            background: var(--okami-card);
            border: 1px solid var(--okami-border);
            border-radius: 12px;
            padding: 16px 18px;
            margin-bottom: 16px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .build-sheet-section-title {
            margin: 0 0 12px;
            font-size: 0.82rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--okami-accent);
        }

        .build-sheet-details {
            margin: 0;
        }

        .build-sheet-row {
            display: grid;
            grid-template-columns: minmax(140px, 38%) 1fr;
            gap: 10px 16px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .build-sheet-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }

        .build-sheet-row dt {
            margin: 0;
            color: var(--okami-muted);
            font-size: 0.88rem;
            font-weight: 600;
        }

        .build-sheet-row dd {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 700;
        }

        .build-sheet-lead,
        .build-sheet-note {
            margin: 0 0 12px;
            color: var(--okami-muted);
            font-size: 0.88rem;
        }

        .build-sheet-note--warn {
            color: #ffb089;
        }

        .build-sheet-table-wrap {
            overflow-x: auto;
        }

        .build-sheet-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.88rem;
        }

        .build-sheet-table th,
        .build-sheet-table td {
            padding: 8px 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            text-align: left;
        }

        .build-sheet-table th {
            color: var(--okami-accent);
            font-size: 0.75rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .build-sheet-warnings {
            margin: 0;
            padding-left: 18px;
            color: #ffd3bf;
            font-size: 0.88rem;
        }

        .build-sheet-warnings li + li {
            margin-top: 8px;
        }

        .build-sheet-footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid var(--okami-border);
            color: var(--okami-muted);
            font-size: 0.78rem;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .build-sheet-footer strong {
            color: var(--okami-text);
        }

        .build-sheet-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin: 0 0 18px;
        }

        .build-sheet-btn {
            appearance: none;
            border: 1px solid rgba(255, 106, 45, 0.55);
            background: rgba(255, 106, 45, 0.14);
            color: #fff;
            border-radius: 8px;
            padding: 10px 16px;
            font: inherit;
            font-size: 0.88rem;
            font-weight: 700;
            cursor: pointer;
        }

        .build-sheet-btn:hover {
            background: rgba(255, 106, 45, 0.24);
        }

        @page {
            size: letter;
            margin: 0.55in;
        }

        @media print {
            body {
                padding: 0;
                background: #121212;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .build-sheet-actions {
                display: none !important;
            }

            .build-sheet-page {
                max-width: none;
            }
        }
    </style>
</head>
<body>
    <div class="build-sheet-page">
        <div class="build-sheet-actions">
            <button type="button" class="build-sheet-btn" onclick="window.print()">Print / Save as PDF</button>
        </div>

        <header class="build-sheet-header">
            <div class="build-sheet-brand">
                <img src="${escapeHtml(model.logoUrl)}" alt="Okami Designs">
            </div>
            <div class="build-sheet-header-meta">
                <h1 class="build-sheet-title">LED Wall Configuration</h1>
                <p class="build-sheet-subtitle">Build Sheet</p>
                <p class="build-sheet-exported">Exported ${escapeHtml(exportLabel)}</p>
                ${projectLine}
            </div>
        </header>

        ${renderDetailSection('Wall Overview', model.sections.overview)}
        ${renderDetailSection('Resolution', model.sections.resolution)}
        ${renderDetailSection('Processor / Sending Card', model.sections.processor)}
        ${renderPortMappingSection(model.portMapping, model.warnings)}
        ${renderPowerSection()}
        ${renderDetailSection('Build Notes', model.sections.buildNotes)}
        ${renderWarningsSection(model.warnings)}

        <footer class="build-sheet-footer">
            <p><strong>Generated by Okami Designs LED Wall Calculator</strong></p>
            <p>${escapeHtml(model.websiteUrl)}</p>
            <p>Verify final processor, power, and rigging requirements with manufacturer specifications before deployment.</p>
        </footer>
    </div>
</body>
</html>`;
    }

    function openPrintView(inputs, state, options = {}) {
        const model = buildBuildSheetModel(inputs, state, options);
        const html = buildBuildSheetHtml(model);
        const printWindow = window.open('', '_blank');

        if (!printWindow) {
            throw new Error('Pop-up blocked. Allow pop-ups for this site to export the build sheet.');
        }

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();

        return model;
    }

    const api = {
        buildBuildSheetModel,
        buildBuildSheetHtml,
        calculatePortMapping,
        openPrintView
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    global.OkamiLedWallCalculator.BuildSheetExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
