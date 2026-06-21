(function(global) {
    'use strict';

    const BuildSheet = () => global.OkamiLedWallCalculator?.BuildSheetExport;

    const COLORS = {
        orange: [255, 106, 45],
        text: [26, 26, 26],
        muted: [102, 102, 102],
        border: [210, 210, 210],
        wallFill: [240, 240, 240],
        wallStroke: [120, 120, 120],
        gridLine: [190, 190, 190],
        letterbox: [220, 220, 220]
    };

    const PAGE = {
        width: 215.9,
        height: 279.4,
        margin: 12,
        footerHeight: 16
    };

    function getJsPDF() {
        const lib = global.jspdf?.jsPDF || global.jsPDF;
        if (!lib) {
            throw new Error('PDF library not loaded. Refresh the page and try again.');
        }
        return lib;
    }

    function formatExportDate(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatFilenameDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function hasValue(value) {
        return value !== null && value !== undefined && value !== '' && !Number.isNaN(value);
    }

    function formatNumber(value) {
        return Number(value).toLocaleString('en-US');
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

    function setTextColor(doc, rgb) {
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    }

    function setDrawColor(doc, rgb) {
        doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    }

    function setFillColor(doc, rgb) {
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    }

    function drawHorizontalRule(doc, y, x1, x2) {
        setDrawColor(doc, COLORS.border);
        doc.setLineWidth(0.25);
        doc.line(x1, y, x2, y);
    }

    function drawTitleRow(doc, model, y) {
        const rightX = PAGE.width - PAGE.margin;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        setTextColor(doc, COLORS.text);
        doc.text('LED Wall Build Sheet', PAGE.margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        setTextColor(doc, COLORS.muted);
        const dateStr = formatExportDate(model.exportedAt);
        doc.text(dateStr, rightX, y, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        setTextColor(doc, COLORS.orange);
        doc.text('Okami Designs', rightX, y + 4, { align: 'right' });

        let nextY = y + 7;

        if (model.projectName) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            setTextColor(doc, COLORS.muted);
            doc.text(`Project: ${model.projectName}`, PAGE.margin, nextY);
            nextY += 5;
        }

        drawHorizontalRule(doc, nextY, PAGE.margin, rightX);
        return nextY + 4;
    }

    /**
     * Compact wall diagram drawn with PDF primitives (light theme for print).
     */
    function drawWallDiagram(doc, state, maxWidth, maxHeight, originX, originY) {
        if (!state?.panelsWide || !state?.panelsTall) {
            return originY;
        }

        const wallAspect = state.physicalWidthMM / state.physicalHeightMM;
        let diagramW;
        let diagramH;

        if (wallAspect >= maxWidth / maxHeight) {
            diagramW = maxWidth;
            diagramH = maxWidth / wallAspect;
        } else {
            diagramH = maxHeight;
            diagramW = maxHeight * wallAspect;
        }

        const x0 = originX + (maxWidth - diagramW) / 2;
        const y0 = originY;
        const cellW = diagramW / state.panelsWide;
        const cellH = diagramH / state.panelsTall;

        setFillColor(doc, COLORS.wallFill);
        setDrawColor(doc, COLORS.wallStroke);
        doc.setLineWidth(0.35);
        doc.roundedRect(x0, y0, diagramW, diagramH, 1.2, 1.2, 'FD');

        setDrawColor(doc, COLORS.gridLine);
        doc.setLineWidth(0.15);
        for (let col = 1; col < state.panelsWide; col += 1) {
            const x = x0 + col * cellW;
            doc.line(x, y0, x, y0 + diagramH);
        }
        for (let row = 1; row < state.panelsTall; row += 1) {
            const y = y0 + row * cellH;
            doc.line(x0, y, x0 + diagramW, y);
        }

        if (state.overlay) {
            const { leftPercent, topPercent, widthPercent, heightPercent } = state.overlay;
            const overlayX = x0 + (leftPercent / 100) * diagramW;
            const overlayY = y0 + (topPercent / 100) * diagramH;
            const overlayW = (widthPercent / 100) * diagramW;
            const overlayH = (heightPercent / 100) * diagramH;

            setFillColor(doc, COLORS.letterbox);
            if (topPercent > 0) {
                doc.rect(x0, y0, diagramW, (topPercent / 100) * diagramH, 'F');
            }
            if (topPercent + heightPercent < 100) {
                const shadeY = y0 + ((topPercent + heightPercent) / 100) * diagramH;
                const shadeH = diagramH - ((topPercent + heightPercent) / 100) * diagramH;
                doc.rect(x0, shadeY, diagramW, shadeH, 'F');
            }
            if (leftPercent > 0) {
                doc.rect(x0, overlayY, (leftPercent / 100) * diagramW, overlayH, 'F');
            }
            if (leftPercent + widthPercent < 100) {
                const shadeX = x0 + ((leftPercent + widthPercent) / 100) * diagramW;
                const shadeW = diagramW - ((leftPercent + widthPercent) / 100) * diagramW;
                doc.rect(shadeX, overlayY, shadeW, overlayH, 'F');
            }

            setDrawColor(doc, COLORS.orange);
            doc.setLineWidth(0.6);
            doc.rect(overlayX, overlayY, overlayW, overlayH);

            if (state.overlayFormatLabel) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6.5);
                setTextColor(doc, COLORS.orange);
                doc.text(state.overlayFormatLabel, overlayX + overlayW / 2, overlayY - 1.2, { align: 'center' });
            }
        }

        const widthFt = formatFeetInches(state.physicalWidthFt);
        const heightFt = formatFeetInches(state.physicalHeightFt);
        const widthM = formatMeters(state.physicalWidthMM);
        const heightM = formatMeters(state.physicalHeightMM);
        const captionY = y0 + diagramH + 5;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        setTextColor(doc, COLORS.text);
        const line1 = `${state.panelsWide} × ${state.panelsTall} cabinets · ${formatNumber(state.totalPixelWidth)} × ${formatNumber(state.totalPixelHeight)} px`;
        doc.text(line1, originX + maxWidth / 2, captionY, { align: 'center' });

        if (widthFt && heightFt && widthM && heightM) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            setTextColor(doc, COLORS.muted);
            const line2 = `${widthFt} × ${heightFt} (${widthM} × ${heightM})`;
            doc.text(line2, originX + maxWidth / 2, captionY + 4, { align: 'center' });
            return captionY + 8;
        }

        return captionY + 5;
    }

    function pickRows(rows, labels) {
        const map = new Map(rows.map((row) => [row.label, row]));
        return labels.map((label) => map.get(label)).filter(Boolean);
    }

    function buildLeftColumnRows(model) {
        const overview = model.sections.overview;
        return pickRows(overview, [
            'Total cabinets',
            'Physical size',
            'Cabinet size',
            'Pixel pitch / spacing',
            'Display mode',
            'Wall grid (W × H)',
            'Aspect ratio'
        ]);
    }

    function buildResolutionRows(model) {
        const resolution = model.sections.resolution;
        return pickRows(resolution, [
            'Total resolution',
            'Megapixels',
            'Pixels per cabinet'
        ]);
    }

    function buildProcessorRows(model, state) {
        const processor = model.sections.processor;
        const picked = pickRows(processor, [
            'Port capacity setting',
            'Usable pixels per port',
            'Fill threshold',
            'Total ports required',
            'Avg. cabinets per port (est.)'
        ]);

        if (hasValue(state?.portsRequired) && picked.every((row) => row.label !== 'Total ports required')) {
            picked.unshift({
                label: 'Total ports required',
                value: formatNumber(state.portsRequired)
            });
        }

        return picked;
    }

    function buildPowerRows(state) {
        const rows = [];
        const circuitAmperage = state?.circuitAmperage;

        if (hasValue(state?.wattsPerPanel)) {
            rows.push({ label: 'Watts per panel', value: `${formatNumber(state.wattsPerPanel)} W` });
        }
        if (hasValue(state?.totalEstimatedWatts)) {
            rows.push({ label: 'Total estimated watts', value: `${formatNumber(state.totalEstimatedWatts)} W` });
        }
        if (hasValue(state?.circuitVoltage)) {
            rows.push({ label: 'Voltage', value: `${state.circuitVoltage}V` });
        }
        if (hasValue(circuitAmperage)) {
            rows.push({ label: 'Circuit size', value: `${circuitAmperage}A` });
        }
        if (hasValue(state?.rawWattsPerCircuit)) {
            rows.push({ label: 'Raw circuit capacity', value: `${formatNumber(Math.round(state.rawWattsPerCircuit))} W` });
        }
        if (hasValue(state?.usableWattsPerCircuit)) {
            rows.push({
                label: 'Usable circuit capacity (80%)',
                value: `${formatNumber(Math.round(state.usableWattsPerCircuit))} W`
            });
        }
        if (hasValue(state?.circuitsRequired)) {
            const circuitsLabel = hasValue(circuitAmperage)
                ? `Estimated ${circuitAmperage}A circuits required`
                : 'Estimated circuits required';
            rows.push({ label: circuitsLabel, value: formatNumber(state.circuitsRequired) });
        }

        return rows;
    }

    function drawSection(doc, title, rows, x, y, width, options = {}) {
        if (!rows.length) {
            return y;
        }

        const labelWidth = options.labelWidth ?? 38;
        const rowGap = options.rowGap ?? 4.2;
        const titleGap = options.titleGap ?? 5;
        const fontSize = options.fontSize ?? 7.5;
        const valueFontSize = options.valueFontSize ?? 7.5;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        setTextColor(doc, COLORS.orange);
        doc.text(title, x, y);

        setDrawColor(doc, COLORS.orange);
        doc.setLineWidth(0.35);
        doc.line(x, y + 1.2, x + width, y + 1.2);

        let cursorY = y + titleGap;

        rows.forEach((row) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(fontSize);
            setTextColor(doc, COLORS.muted);
            doc.text(row.label, x, cursorY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(valueFontSize);
            setTextColor(doc, COLORS.text);
            const valueX = x + labelWidth;
            const valueWidth = width - labelWidth;
            const valueLines = doc.splitTextToSize(String(row.value), valueWidth);
            doc.text(valueLines, valueX, cursorY);

            cursorY += Math.max(rowGap, valueLines.length * 3.2);
        });

        if (options.note) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(6.5);
            setTextColor(doc, COLORS.muted);
            const noteLines = doc.splitTextToSize(options.note, width);
            doc.text(noteLines, x, cursorY + 1);
            cursorY += noteLines.length * 3 + 2;
        }

        return cursorY + 2;
    }

    function drawFooter(doc, y) {
        const contentWidth = PAGE.width - PAGE.margin * 2;
        const footerTop = Math.max(y + 4, PAGE.height - PAGE.margin - PAGE.footerHeight);

        drawHorizontalRule(doc, footerTop, PAGE.margin, PAGE.width - PAGE.margin);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        setTextColor(doc, COLORS.text);
        doc.text('Generated by Okami Designs LED Wall Calculator', PAGE.margin, footerTop + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        setTextColor(doc, COLORS.muted);
        const disclaimer = 'Verify processor, power, rigging, and manufacturer specifications before deployment.';
        const lines = doc.splitTextToSize(disclaimer, contentWidth);
        doc.text(lines, PAGE.margin, footerTop + 9);

        return footerTop;
    }

    function downloadPdf(inputs, state, options = {}) {
        const exportApi = BuildSheet();
        if (!exportApi?.buildBuildSheetModel) {
            throw new Error('Build sheet export is unavailable.');
        }

        const jsPDF = getJsPDF();
        const model = exportApi.buildBuildSheetModel(inputs, state, options);
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

        doc.setProperties({
            title: 'LED Wall Build Sheet',
            subject: 'Okami Designs LED Wall Calculator',
            author: 'Okami Designs'
        });

        const contentRight = PAGE.width - PAGE.margin;
        const columnGap = 8;
        const columnWidth = (contentRight - PAGE.margin - columnGap) / 2;
        const leftX = PAGE.margin;
        const rightX = PAGE.margin + columnWidth + columnGap;

        let y = drawTitleRow(doc, model, PAGE.margin + 2);

        const diagramMaxW = 88;
        const diagramMaxH = 42;
        y = drawWallDiagram(doc, model.wallState, diagramMaxW, diagramMaxH, leftX, y + 2);
        y += 3;

        const leftRows = buildLeftColumnRows(model);
        const resolutionRows = buildResolutionRows(model);
        const processorRows = buildProcessorRows(model, model.wallState);
        const powerRows = buildPowerRows(model.wallState);

        const columnStartY = y;
        const compact = { rowGap: 3.8, titleGap: 4.5, fontSize: 7, valueFontSize: 7, labelWidth: 34 };

        let leftBottom = drawSection(doc, 'Wall Overview', leftRows, leftX, columnStartY, columnWidth, compact);

        let rightY = columnStartY;
        rightY = drawSection(doc, 'Resolution', resolutionRows, rightX, rightY, columnWidth, compact);
        rightY = drawSection(doc, 'Processor / Ports', processorRows, rightX, rightY + 1, columnWidth, {
            ...compact,
            note: model.portMapping?.length
                ? `${formatNumber(model.portMapping.length)} port${model.portMapping.length === 1 ? '' : 's'} suggested — confirm mapping in processor software.`
                : null
        });
        rightY = drawSection(doc, 'Estimated Power', powerRows, rightX, rightY + 1, columnWidth, {
            ...compact,
            note: '20% headroom included'
        });

        const contentBottom = Math.max(leftBottom, rightY);

        if (model.warnings?.length) {
            let warnY = contentBottom + 2;
            if (warnY > PAGE.height - PAGE.margin - PAGE.footerHeight - 14) {
                doc.setFontSize(6.5);
                compact.rowGap = 3.2;
            }
            const warnRows = model.warnings.slice(0, 2).map((message, index) => ({
                label: index === 0 ? 'Review' : '',
                value: message
            }));
            drawSection(doc, 'Warnings', warnRows, leftX, warnY, contentRight - PAGE.margin, {
                ...compact,
                labelWidth: 14,
                rowGap: 3.2,
                fontSize: 6.5,
                valueFontSize: 6.5
            });
        }

        drawFooter(doc, contentBottom);

        const filename = `okami-led-wall-build-sheet-${formatFilenameDate(model.exportedAt)}.pdf`;
        doc.save(filename);

        return { filename, model };
    }

    const api = { downloadPdf };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    global.OkamiLedWallCalculator.BuildSheetPdf = api;
}(typeof window !== 'undefined' ? window : global));
