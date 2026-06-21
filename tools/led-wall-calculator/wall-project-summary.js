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

        const usablePort = formatPortCapacity(state.usablePixelsPerPort);
        const maxPort = formatPortCapacity(state.portCapacity);
        const portCapacityLine = usablePort && maxPort
            ? `${usablePort} usable / ${maxPort} max per port`
            : (usablePort || maxPort || null);

        const portsRequired = hasValue(state.portsRequired) ? state.portsRequired : null;
        const portWord = portsRequired === 1 ? 'Port' : 'Ports';

        const headroom = hasValue(state.circuitHeadroomPercent)
            ? state.circuitHeadroomPercent
            : (hasValue(state.circuitSafeLoadPercent) ? 100 - state.circuitSafeLoadPercent : 20);

        const powerLines = [
            formatAmps(state.totalEstimatedAmps) ? `${formatAmps(state.totalEstimatedAmps)} estimated` : null,
            hasValue(state.circuitsRequired)
                ? `${formatNumber(state.circuitsRequired)} circuit${state.circuitsRequired === 1 ? '' : 's'} required`
                : null,
            hasValue(state.usableWattsPerCircuit)
                ? `${formatNumber(Math.round(state.usableWattsPerCircuit))} W usable per circuit`
                : null,
            `${headroom}% headroom included`
        ].filter(Boolean);

        const ampsAtVoltage = hasValue(state.totalEstimatedAmps) && hasValue(state.circuitVoltage)
            ? `${Number(state.totalEstimatedAmps).toFixed(0)}A @ ${state.circuitVoltage}V`
            : (formatAmps(state.totalEstimatedAmps) || null);

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
                lines: [
                    formatPercent(state.peakPortUtilizationPercent)
                        ? `${formatPercent(state.peakPortUtilizationPercent)} peak port fill`
                        : null,
                    portCapacityLine
                ].filter(Boolean)
            },
            power: {
                title: 'Power',
                primary: formatWatts(state.totalEstimatedWatts),
                lines: powerLines,
                ampsAtVoltage
            },
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
                title: 'Est. Power Draw',
                primary: summary.power.primary,
                secondary: summary.power.ampsAtVoltage,
                tertiary: summary.power.lines[1] || null
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
