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

    function formatPercent(value, digits = 0) {
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

    function formatPortCapacityShort(capacity) {
        if (!hasValue(capacity)) {
            return null;
        }
        if (capacity >= 1000000) {
            const millions = capacity / 1000000;
            return Number.isInteger(millions) ? `${millions}M` : `${millions.toFixed(1)}M`;
        }
        if (capacity >= 1000) {
            return `${Math.round(capacity / 1000)}k`;
        }
        return formatNumber(capacity);
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

    function describeContentFitCompact(overlay) {
        if (!overlay) {
            return null;
        }

        const unusedH = Math.round(overlay.unusedHorizontal || 0);
        const unusedV = Math.round(overlay.unusedVertical || 0);

        if (unusedH === 0 && unusedV === 0) {
            return 'Exact fit';
        }
        if (unusedV > 0 && unusedH === 0) {
            return `${unusedV}px letterbox`;
        }
        if (unusedH > 0 && unusedV === 0) {
            return `${unusedH}px letterbox`;
        }
        return `${unusedV}px letterbox`;
    }

    function buildContentFitSection(state, inputs) {
        const formatLabel = state.overlayFormatLabel || '16:9';
        const title = `${formatLabel} Reference Fit`;
        const overlayFormat = inputs?.overlayFormat ?? state.overlayFormat ?? 'none';

        if (!state.overlay) {
            return {
                title,
                configured: false,
                primary: overlayFormat === 'none' ? 'Not configured' : '—',
                lines: []
            };
        }

        const overlay = state.overlay;
        const compactFit = describeContentFitCompact(overlay);

        return {
            title,
            configured: true,
            primary: formatPixelPair(overlay.overlayPixelWidth, overlay.overlayPixelHeight),
            lines: [
                `${Math.round(overlay.usedPercentage)}% wall used`,
                compactFit
            ].filter(Boolean)
        };
    }

    function buildProcessorSummarySection(state) {
        const threshold = hasValue(state.portFillThreshold) ? state.portFillThreshold : 90;
        const portsRequired = state.portsRequired;
        const portWord = portsRequired === 1 ? 'Port' : 'Ports';
        const usableShort = formatPortCapacityShort(state.usablePixelsPerPort);
        const safePeak = state.peakSafeCapacityUsedPercent ?? state.peakPortUtilizationPercent;

        const lines = [
            `${threshold}% safe limit`,
            usableShort ? `${usableShort} usable/port` : null
        ].filter(Boolean);

        let badge = null;
        if (state.atSafePortLimit || (hasValue(safePeak) && safePeak >= 99.5)) {
            badge = 'At Limit';
        } else if (hasValue(safePeak) && safePeak >= 95) {
            badge = 'Add Port';
        }

        return {
            title: 'Processor',
            primary: hasValue(portsRequired) ? `${formatNumber(portsRequired)} ${portWord}` : '—',
            lines,
            badge
        };
    }

    function buildPowerSummarySection(state) {
        const headroom = hasValue(state.circuitHeadroomPercent)
            ? state.circuitHeadroomPercent
            : (hasValue(state.circuitSafeLoadPercent) ? 100 - state.circuitSafeLoadPercent : 20);
        const circuitAmperage = state.circuitAmperage;
        const circuitsRequired = state.circuitsRequired;
        const circuitWord = circuitsRequired === 1 ? 'Circuit' : 'Circuits';
        const title = hasValue(circuitAmperage) ? `Power • ${circuitAmperage}A` : 'Power';

        return {
            title,
            primary: hasValue(circuitsRequired)
                ? `${formatNumber(circuitsRequired)} ${circuitWord}`
                : '—',
            lines: [
                hasValue(state.totalEstimatedWatts)
                    ? `${formatWatts(state.totalEstimatedWatts)} estimated`
                    : null,
                `${headroom}% headroom`
            ].filter(Boolean)
        };
    }

    function formatDegreeLabel(degrees) {
        if (!hasValue(degrees)) {
            return '0°';
        }
        const rounded = Math.round(Number(degrees) * 10) / 10;
        return Number.isInteger(rounded) ? `${rounded}°` : `${rounded.toFixed(1)}°`;
    }

    function buildWallSummarySection(state) {
        const widthFt = formatFeetInches(state.physicalWidthFt);
        const heightFt = formatFeetInches(state.physicalHeightFt);
        const physicalPrimary = widthFt && heightFt ? `${widthFt} × ${heightFt}` : '—';

        const lines = [
            `${state.panelsWide} × ${state.panelsTall} cabinets`,
            `${formatNumber(state.totalPanels)} total`
        ];

        const curvedActive = state.curvedWallActive === true;
        if (curvedActive) {
            const arcWidthFt = state.arcWidthFeet ?? state.physicalWidthFt;
            lines.unshift(
                `Curve: ${formatDegreeLabel(state.cabinetAngleDegrees)} per cabinet · ${formatDegreeLabel(state.totalCurveAngle)} total`,
                `Depth: ${formatFeetInches(state.depthFeet)}`,
                `Curved Width: ${formatFeetInches(state.chordWidthFeet)}`,
                `Flat Width: ${formatFeetInches(arcWidthFt)}`
            );
        }

        return {
            title: 'Wall',
            primary: physicalPrimary,
            lines,
            badge: curvedActive ? 'Curved' : null
        };
    }

    /**
     * Shared project summary for the calculator UI and PDF build sheet.
     */
    function buildProjectSummary(state, inputs = {}) {
        const processor = buildProcessorSummarySection(state);
        const power = buildPowerSummarySection(state);
        const contentFit = buildContentFitSection(state, inputs);

        return {
            wall: buildWallSummarySection(state),
            resolution: {
                title: 'Resolution',
                primary: formatPixelPair(state.totalPixelWidth, state.totalPixelHeight),
                lines: [
                    `${formatPixelPair(state.pixelWidth, state.pixelHeight)} px/cabinet`,
                    `${formatNumber(state.totalPixels)} total px`
                ]
            },
            processor,
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
                secondary: summary.wall.lines[0] || null,
                tertiary: summary.wall.lines[1] || null
            },
            {
                title: 'Resolution',
                primary: summary.resolution.primary,
                secondary: summary.resolution.lines[0] || null,
                tertiary: null
            },
            {
                title: 'Processor',
                primary: summary.processor.primary,
                secondary: summary.processor.lines[0] || null,
                tertiary: summary.processor.lines[1] || null,
                badge: summary.processor.badge
            },
            {
                title: summary.power.title,
                primary: summary.power.primary,
                secondary: summary.power.lines[0] || null,
                secondaryBold: Boolean(summary.power.lines[0]),
                tertiary: summary.power.lines[1] || null
            },
            {
                title: summary.contentFit.title,
                primary: summary.contentFit.primary,
                secondary: summary.contentFit.lines[0] || null,
                tertiary: summary.contentFit.lines[1] || null
            }
        ];
    }

    const api = {
        buildProcessorSummarySection,
        buildPowerSummarySection,
        buildProjectSummary,
        buildKpiCards,
        describeContentFitStatus,
        describeContentFitCompact,
        getOverlayReferenceLabel,
        getOverlayReferenceNote,
        formatPortCapacity,
        formatPortCapacityShort,
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
