(function(global) {
    'use strict';

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

    function formatMetersCompact(mm) {
        if (!hasValue(mm)) {
            return null;
        }
        return `${(mm / 1000).toFixed(2)}m`;
    }

    function formatWatts(watts) {
        if (!hasValue(watts)) {
            return '—';
        }
        return `${Math.round(watts).toLocaleString()} W`;
    }

    function formatAmps(amps) {
        if (!hasValue(amps)) {
            return null;
        }
        return `${Number(amps).toFixed(1)} A`;
    }

    function formatPercent(value, digits = 1) {
        if (!hasValue(value)) {
            return null;
        }
        return `${Number(value).toFixed(digits)}%`;
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
        return `${formatNumber(capacity)} px`;
    }

    function formatPixelPair(width, height) {
        return `${formatNumber(width)} × ${formatNumber(height)}`;
    }

    function getOverlayReferenceLabel(formatLabel, variant = 'preview') {
        const label = formatLabel || '16:9';
        if (variant === 'pdf') {
            return `${label} reference area`;
        }
        return `${label} Content Area`;
    }

    function getOverlayReferenceNote(formatLabel) {
        const label = formatLabel || '16:9';
        return `Overlay shows ${label} content fit only. Full LED wall remains active.`;
    }

    function describeContentFitStatus(overlay) {
        if (!overlay) {
            return null;
        }

        const unusedH = Math.round(overlay.unusedHorizontal || 0);
        const unusedV = Math.round(overlay.unusedVertical || 0);

        if (unusedH === 0 && unusedV === 0) {
            return 'Fits Exactly';
        }
        if (unusedV > 0 && unusedH === 0) {
            return `${unusedV}px Top/Bottom Letterbox`;
        }
        if (unusedH > 0 && unusedV === 0) {
            return `${unusedH}px Side Letterbox`;
        }
        return `${unusedV}px Top/Bottom · ${unusedH}px Side Letterbox`;
    }

    function buildContentFitSection(state, inputs) {
        const formatLabel = state.overlayFormatLabel || '16:9';
        const title = `${formatLabel} Reference Fit`;
        const overlayFormat = inputs?.overlayFormat ?? state.overlayFormat ?? 'none';
        const referenceNote = 'Reference only — does not change wall size.';

        if (!state.overlay) {
            if (overlayFormat === 'none') {
                return {
                    title,
                    configured: false,
                    primary: 'Not configured',
                    lines: ['Enable overlay in Advanced settings', referenceNote]
                };
            }
            return {
                title,
                configured: false,
                primary: '—',
                lines: ['Overlay not calculated', referenceNote]
            };
        }

        const overlay = state.overlay;
        const fitStatus = describeContentFitStatus(overlay);
        const lines = [
            `${Math.round(overlay.usedPercentage)}% of wall used`,
            fitStatus,
            referenceNote
        ].filter(Boolean);

        return {
            title,
            configured: true,
            primary: formatPixelPair(overlay.overlayPixelWidth, overlay.overlayPixelHeight),
            lines
        };
    }

    function buildProcessorSummaryLines(state) {
        const threshold = hasValue(state.portFillThreshold) ? state.portFillThreshold : 90;
        const safePeak = state.peakSafeCapacityUsedPercent ?? state.peakPortUtilizationPercent;
        const usablePort = formatPortCapacity(state.usablePixelsPerPort);
        const maxPort = formatPortCapacity(state.portCapacity);
        const lines = [];

        if (hasValue(safePeak)) {
            lines.push(`${formatPercent(safePeak)} of ${threshold}% safe capacity`);
        }
        if (usablePort && maxPort) {
            lines.push(`${usablePort} usable / ${maxPort} max per port`);
        }
        if (hasValue(state.peakRawMaxLoadPercent)) {
            lines.push(`Actual max port load: ${formatPercent(state.peakRawMaxLoadPercent)}`);
        }
        if (hasValue(state.processorPortHeadroomPercent)) {
            lines.push(`Safety headroom: ${formatPercent(state.processorPortHeadroomPercent)}`);
        }
        if (state.atSafePortLimit || (hasValue(safePeak) && safePeak >= 99.5)) {
            lines.push('At safe limit — add another port for more headroom.');
        }

        return lines;
    }

    function buildPowerSummarySection(state) {
        const headroom = hasValue(state.circuitHeadroomPercent)
            ? state.circuitHeadroomPercent
            : (hasValue(state.circuitSafeLoadPercent) ? 100 - state.circuitSafeLoadPercent : 20);
        const circuitAmperage = state.circuitAmperage;
        const circuitsRequired = state.circuitsRequired;
        const circuitWord = circuitsRequired === 1 ? 'Circuit' : 'Circuits';
        const title = hasValue(circuitAmperage) ? `Power • ${circuitAmperage}A` : 'Power';

        const primary = hasValue(circuitsRequired)
            ? `${formatNumber(circuitsRequired)} ${circuitWord}`
            : '—';

        const emphasis = hasValue(state.totalEstimatedWatts)
            ? `${formatWatts(state.totalEstimatedWatts)} estimated`
            : null;

        const lines = [
            hasValue(state.totalEstimatedAmps)
                ? `${Number(state.totalEstimatedAmps).toFixed(1)}A total`
                : null,
            hasValue(state.usableWattsPerCircuit)
                ? `${formatNumber(Math.round(state.usableWattsPerCircuit))} W usable/circuit`
                : null,
            `${headroom}% headroom included`
        ].filter(Boolean);

        const ampsAtVoltage = hasValue(state.totalEstimatedAmps) && hasValue(state.circuitVoltage)
            ? `${Number(state.totalEstimatedAmps).toFixed(1)}A @ ${state.circuitVoltage}V`
            : null;

        const supportingDetail = [
            ampsAtVoltage,
            hasValue(state.usableWattsPerCircuit)
                ? `${formatNumber(Math.round(state.usableWattsPerCircuit))} W usable/circuit`
                : null,
            `${headroom}% headroom included`
        ].filter(Boolean).join(' · ');

        return {
            title,
            primary,
            emphasis,
            lines,
            ampsAtVoltage,
            supportingDetail
        };
    }

    /**
     * Shared project summary for the calculator UI and PDF build sheet.
     */
    function buildProjectSummary(state, inputs = {}) {
        const widthFt = formatFeetInches(state.physicalWidthFt);
        const heightFt = formatFeetInches(state.physicalHeightFt);
        const widthM = formatMetersCompact(state.physicalWidthMM);
        const heightM = formatMetersCompact(state.physicalHeightMM);

        const physicalPrimary = widthFt && heightFt ? `${widthFt} × ${heightFt}` : '—';
        const physicalMetric = widthM && heightM ? `(${widthM} × ${heightM})` : null;

        const wallLines = [
            `${state.panelsWide} × ${state.panelsTall} cabinet grid`,
            `${formatNumber(state.totalPanels)} cabinets`
        ];
        if (physicalMetric) {
            wallLines.push(physicalMetric);
        }

        const portsRequired = hasValue(state.portsRequired) ? state.portsRequired : null;
        const portWord = portsRequired === 1 ? 'Port' : 'Ports';
        const processorLines = buildProcessorSummaryLines(state);
        const power = buildPowerSummarySection(state);

        const contentFit = buildContentFitSection(state, inputs);

        return {
            wall: {
                title: 'Wall',
                primary: physicalPrimary,
                lines: wallLines.filter(Boolean)
            },
            resolution: {
                title: 'Resolution',
                primary: formatPixelPair(state.totalPixelWidth, state.totalPixelHeight),
                lines: [
                    `${formatPixelPair(state.pixelWidth, state.pixelHeight)} px per cabinet`
                ]
            },
            processor: {
                title: 'Processor',
                primary: portsRequired != null ? `${formatNumber(portsRequired)} ${portWord}` : '—',
                lines: processorLines
            },
            power,
            contentFit
        };
    }

    /**
     * KPI card layout used by the PDF Project Summary row.
     */
    function buildKpiCards(summary) {
        return [
            {
                title: 'Wall Size',
                primary: summary.wall.primary,
                secondary: summary.wall.lines.find((line) => line.startsWith('(')) || null,
                tertiary: null
            },
            {
                title: 'Resolution',
                primary: summary.resolution.primary,
                secondary: null,
                tertiary: null
            },
            {
                title: 'Processor Ports',
                primary: summary.processor.primary,
                secondary: summary.processor.lines[0] || null,
                tertiary: null
            },
            {
                title: summary.power.title,
                primary: summary.power.primary,
                secondary: summary.power.emphasis,
                secondaryBold: true,
                tertiary: summary.power.supportingDetail || summary.power.ampsAtVoltage
            },
            {
                title: summary.contentFit.title,
                primary: summary.contentFit.configured
                    ? summary.contentFit.primary
                    : summary.contentFit.primary,
                secondary: summary.contentFit.configured
                    ? summary.contentFit.lines[0]
                    : (summary.contentFit.lines[0] || null),
                tertiary: summary.contentFit.configured
                    ? summary.contentFit.lines.slice(1).join(' · ')
                    : (summary.contentFit.lines[1] || null)
            }
        ];
    }

    const api = {
        buildProcessorSummaryLines,
        buildPowerSummarySection,
        buildProjectSummary,
        buildKpiCards,
        describeContentFitStatus,
        getOverlayReferenceLabel,
        getOverlayReferenceNote,
        formatPortCapacity,
        formatWatts,
        formatFeetInches,
        formatMetersCompact
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    global.OkamiLedWallCalculator.WallProjectSummary = api;
}(typeof window !== 'undefined' ? window : global));
