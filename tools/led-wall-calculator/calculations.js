(function(global) {
    'use strict';

    const C = global.OkamiLedWallCalculator.Constants;

    function clampPanelCount(value) {
        if (!Number.isFinite(value)) {
            return C.MIN_PANEL_COUNT;
        }
        return Math.min(C.MAX_PANEL_COUNT, Math.max(C.MIN_PANEL_COUNT, Math.round(value)));
    }

    function clampPortFillThreshold(value, fallback = C.DEFAULTS.portFillThreshold) {
        if (!Number.isFinite(value)) {
            return fallback;
        }
        return Math.min(100, Math.max(50, Math.round(value)));
    }

    function clampCircuitSafeLoadPercent(value, fallback = C.DEFAULTS.circuitSafeLoadPercent) {
        if (!Number.isFinite(value)) {
            return fallback;
        }
        // Cap at 80% so circuit plans always retain at least 20% headroom.
        return Math.min(80, Math.max(1, Math.round(value)));
    }

    function isMmCabinetPreset(presetKey) {
        return presetKey === '500x500' || presetKey === '500x1000';
    }

    function resolveCabinetDimensions(inputs = {}) {
        const presetKey = inputs.cabinetPreset;
        const preset = isMmCabinetPreset(presetKey) ? C.CABINET_PRESETS[presetKey] : null;

        if (preset) {
            return {
                cabinetWidthMM: preset.width,
                cabinetHeightMM: preset.height
            };
        }

        return {
            cabinetWidthMM: Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM,
            cabinetHeightMM: Number(inputs.cabinetHeightMM) || C.DEFAULTS.cabinetHeightMM
        };
    }

    /**
     * Custom LED Spacing mode (includes legacy saved value "transparent").
     */
    function isCustomSpacingDisplayType(displayType) {
        const type = displayType || C.DEFAULTS.displayType;
        return type === C.DISPLAY_TYPE_CUSTOM_SPACING || type === C.DISPLAY_TYPE_TRANSPARENT_LEGACY;
    }

    /**
     * Per-cabinet pixel resolution from pitch, preset tables, or custom LED spacing.
     * Pure function — no DOM.
     */
    function calculateCabinetResolution(inputs = {}) {
        const displayType = inputs.displayType || C.DEFAULTS.displayType;
        const cabinetWidthMM = Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM;
        const cabinetHeightMM = Number(inputs.cabinetHeightMM) || C.DEFAULTS.cabinetHeightMM;
        const pixelPitchMM = Number(inputs.pixelPitchMM) || C.DEFAULTS.pixelPitchMM;
        const cabinetPreset = inputs.cabinetPreset || 'custom';
        const pitchPreset = inputs.pitchPreset || 'custom';

        if (isCustomSpacingDisplayType(displayType)) {
            const horizontalPitch = Number(inputs.meshPitchHorizontalMM) || C.DEFAULTS.meshPitchHorizontalMM;
            const verticalPitch = Number(inputs.meshPitchVerticalMM) || C.DEFAULTS.meshPitchVerticalMM;
            return {
                pixelWidth: Math.round(cabinetWidthMM / horizontalPitch),
                pixelHeight: Math.round(cabinetHeightMM / verticalPitch)
            };
        }

        if (isMmCabinetPreset(cabinetPreset) && pitchPreset !== 'custom') {
            const pitch = parseFloat(pitchPreset);
            const presetResolution = C.RESOLUTION_PRESETS[cabinetPreset]?.[pitch];
            if (presetResolution) {
                return {
                    pixelWidth: presetResolution.pixelWidth,
                    pixelHeight: presetResolution.pixelHeight
                };
            }
        }

        return {
            pixelWidth: Math.round(cabinetWidthMM / pixelPitchMM),
            pixelHeight: Math.round(cabinetHeightMM / pixelPitchMM)
        };
    }

    /**
     * Total wall pixel resolution from cabinet pixels and grid size.
     */
    function calculateWallResolution(inputs = {}) {
        const pixelWidth = Math.max(1, Math.round(Number(inputs.pixelWidth) || C.DEFAULTS.pixelWidth));
        const pixelHeight = Math.max(1, Math.round(Number(inputs.pixelHeight) || C.DEFAULTS.pixelHeight));
        const panelsWide = clampPanelCount(Number(inputs.panelsWide) || C.DEFAULTS.panelsWide);
        const panelsTall = clampPanelCount(Number(inputs.panelsTall) || C.DEFAULTS.panelsTall);

        const totalPixelWidth = pixelWidth * panelsWide;
        const totalPixelHeight = pixelHeight * panelsTall;
        const totalPixels = totalPixelWidth * totalPixelHeight;

        return {
            pixelWidth,
            pixelHeight,
            panelsWide,
            panelsTall,
            totalPanels: panelsWide * panelsTall,
            totalPixelWidth,
            totalPixelHeight,
            totalPixels
        };
    }

    /**
     * Physical wall size in mm and feet.
     */
    function calculatePhysicalSize(inputs = {}) {
        const cabinetWidthMM = Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM;
        const cabinetHeightMM = Number(inputs.cabinetHeightMM) || C.DEFAULTS.cabinetHeightMM;
        const panelsWide = clampPanelCount(Number(inputs.panelsWide) || C.DEFAULTS.panelsWide);
        const panelsTall = clampPanelCount(Number(inputs.panelsTall) || C.DEFAULTS.panelsTall);
        const mmPerFoot = Number(inputs.mmPerFoot) || C.MM_PER_FOOT;

        const physicalWidthMM = cabinetWidthMM * panelsWide;
        const physicalHeightMM = cabinetHeightMM * panelsTall;
        const physicalWidthFt = physicalWidthMM / mmPerFoot;
        const physicalHeightFt = physicalHeightMM / mmPerFoot;
        const aspectRatio = physicalWidthMM / physicalHeightMM;

        return {
            physicalWidthMM,
            physicalHeightMM,
            physicalWidthFt,
            physicalHeightFt,
            aspectRatio
        };
    }

    /**
     * Pixel aspect ratio and nearest standard format label.
     */
    function calculateAspectRatio(inputs = {}, standardRatios = C.STANDARD_RATIOS) {
        const width = Number(inputs.width ?? inputs.totalPixelWidth);
        const height = Number(inputs.height ?? inputs.totalPixelHeight);

        if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
            return {
                ratio: 0,
                closestRatio: standardRatios[0]
            };
        }

        const ratio = width / height;
        let closestRatio = standardRatios[0];
        let smallestDiff = Math.abs(ratio - closestRatio.value);

        standardRatios.forEach((entry) => {
            const diff = Math.abs(ratio - entry.value);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestRatio = entry;
            }
        });

        return { ratio, closestRatio };
    }

    function resolveOverlayTargetRatio(inputs = {}) {
        const overlayFormat = inputs.overlayFormat ?? 'none';

        if (overlayFormat === 'none') {
            return null;
        }

        if (overlayFormat === 'custom') {
            const width = Math.round(Number(inputs.customFormatWidth) || 0);
            const height = Math.round(Number(inputs.customFormatHeight) || 0);
            if (width <= 0 || height <= 0) {
                return null;
            }
            return {
                format: overlayFormat,
                label: `${width}:${height}`,
                ratio: width / height
            };
        }

        const ratio = C.OVERLAY_FORMAT_RATIOS[overlayFormat];
        if (ratio == null) {
            return null;
        }

        return {
            format: overlayFormat,
            label: overlayFormat,
            ratio
        };
    }

    function isOverlayActive(inputs = {}) {
        return resolveOverlayTargetRatio(inputs) !== null;
    }

    /**
     * Largest centered content rectangle matching target aspect inside the wall.
     */
    function calculateContentOverlay(inputs = {}) {
        const totalPixelWidth = Math.round(Number(inputs.totalPixelWidth) || 0);
        const totalPixelHeight = Math.round(Number(inputs.totalPixelHeight) || 0);
        const targetRatio = Number(inputs.targetRatio);

        if (
            totalPixelWidth <= 0
            || totalPixelHeight <= 0
            || !Number.isFinite(targetRatio)
            || targetRatio <= 0
        ) {
            return null;
        }

        const wallRatio = totalPixelWidth / totalPixelHeight;
        let overlayPixelWidth;
        let overlayPixelHeight;

        if (wallRatio > targetRatio) {
            overlayPixelHeight = totalPixelHeight;
            overlayPixelWidth = Math.round(overlayPixelHeight * targetRatio);
        } else {
            overlayPixelWidth = totalPixelWidth;
            overlayPixelHeight = Math.round(overlayPixelWidth / targetRatio);
        }

        overlayPixelWidth = Math.min(overlayPixelWidth, totalPixelWidth);
        overlayPixelHeight = Math.min(overlayPixelHeight, totalPixelHeight);

        const unusedHorizontal = totalPixelWidth - overlayPixelWidth;
        const unusedVertical = totalPixelHeight - overlayPixelHeight;
        const overlayLeftPx = unusedHorizontal / 2;
        const overlayTopPx = unusedVertical / 2;
        const usedPercentage = ((overlayPixelWidth * overlayPixelHeight) / (totalPixelWidth * totalPixelHeight)) * 100;
        const overlayAspectRatio = overlayPixelWidth / overlayPixelHeight;

        const leftPercent = (overlayLeftPx / totalPixelWidth) * 100;
        const topPercent = (overlayTopPx / totalPixelHeight) * 100;
        const widthPercent = (overlayPixelWidth / totalPixelWidth) * 100;
        const heightPercent = (overlayPixelHeight / totalPixelHeight) * 100;

        return {
            overlayPixelWidth,
            overlayPixelHeight,
            overlayAspectRatio,
            unusedHorizontal,
            unusedVertical,
            overlayLeftPx,
            overlayTopPx,
            usedPercentage,
            leftPercent,
            topPercent,
            widthPercent,
            heightPercent
        };
    }

    /**
     * Usable pixel budget per processor port after fill threshold.
     */
    function calculatePortFill(inputs = {}) {
        const portCapacity = Math.max(0, Math.round(Number(inputs.portCapacity) || C.DEFAULTS.portCapacity));
        const portFillThreshold = clampPortFillThreshold(inputs.portFillThreshold);
        const usablePixelsPerPort = Math.floor(portCapacity * (portFillThreshold / 100));

        return {
            portCapacity,
            portFillThreshold,
            usablePixelsPerPort
        };
    }

    /**
     * Processor ports required for total pixel load.
     */
    function calculateProcessorPorts(inputs = {}) {
        const totalPixels = Math.max(0, Math.round(Number(inputs.totalPixels) || 0));
        const portFill = inputs.usablePixelsPerPort != null
            ? {
                portCapacity: inputs.portCapacity ?? C.DEFAULTS.portCapacity,
                portFillThreshold: inputs.portFillThreshold ?? C.DEFAULTS.portFillThreshold,
                usablePixelsPerPort: Math.max(0, Math.floor(Number(inputs.usablePixelsPerPort)))
            }
            : calculatePortFill(inputs);

        const portsRequired = portFill.usablePixelsPerPort > 0
            ? Math.ceil(totalPixels / portFill.usablePixelsPerPort)
            : 0;

        return {
            ...portFill,
            totalPixels,
            portsRequired
        };
    }

    /**
     * Aggregate port fill and processor capacity usage for UI and exports.
     */
    function summarizePortLoading(state = {}) {
        const portsRequired = Math.max(0, Math.round(Number(state.portsRequired) || 0));
        const usablePixelsPerPort = Math.max(0, Math.floor(Number(state.usablePixelsPerPort) || 0));
        const totalPixels = Math.max(0, Math.round(Number(state.totalPixels) || 0));
        const portCapacity = Math.max(0, Math.round(Number(state.portCapacity) || 0));

        if (!portsRequired || !usablePixelsPerPort || !totalPixels) {
            return {
                avgPortUtilizationPercent: null,
                peakPortUtilizationPercent: null,
                processorLoadingPercent: null
            };
        }

        let assignedPixels = 0;
        let peakFill = 0;
        let peakPortPixels = 0;
        let fillSum = 0;

        for (let portNum = 1; portNum <= portsRequired; portNum += 1) {
            const remaining = totalPixels - assignedPixels;
            const portPixels = portNum === portsRequired
                ? remaining
                : Math.min(usablePixelsPerPort, remaining);
            const fillPercent = (portPixels / usablePixelsPerPort) * 100;
            peakFill = Math.max(peakFill, fillPercent);
            peakPortPixels = Math.max(peakPortPixels, portPixels);
            fillSum += fillPercent;
            assignedPixels += portPixels;
        }

        const peakSafeCapacityUsedPercent = peakFill;
        const peakRawMaxLoadPercent = portCapacity > 0
            ? (peakPortPixels / portCapacity) * 100
            : null;
        const processorPortHeadroomPercent = peakRawMaxLoadPercent != null
            ? Math.max(0, 100 - peakRawMaxLoadPercent)
            : null;
        const processorLoadingPercent = portCapacity > 0
            ? (totalPixels / (portsRequired * portCapacity)) * 100
            : null;
        const atSafePortLimit = peakSafeCapacityUsedPercent >= 99.5;

        return {
            avgPortUtilizationPercent: fillSum / portsRequired,
            peakPortUtilizationPercent: peakFill,
            peakSafeCapacityUsedPercent,
            peakRawMaxLoadPercent,
            processorPortHeadroomPercent,
            processorLoadingPercent,
            atSafePortLimit
        };
    }

    /**
     * Which preview artwork matches cabinet dimensions (square, tall, or custom).
     */
    function calculateCabinetArtworkType(inputs = {}) {
        const width = Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM;
        const height = Number(inputs.cabinetHeightMM) || C.DEFAULTS.cabinetHeightMM;

        if (width === height) {
            return 'square';
        }

        if (height === width * 2) {
            return 'tall';
        }

        return null;
    }

    /**
     * Estimated power draw and circuit count from panel count and circuit settings.
     */
    function calculatePowerRequirements(inputs = {}) {
        const wattsPerPanel = Math.max(0, Number(inputs.wattsPerPanel) || C.DEFAULTS.wattsPerPanel);
        const circuitAmperage = Math.max(0, Number(inputs.circuitAmperage) || C.DEFAULTS.circuitAmperage);
        const circuitVoltage = Math.max(0, Number(inputs.circuitVoltage) || C.DEFAULTS.circuitVoltage);
        const circuitSafeLoadPercent = clampCircuitSafeLoadPercent(inputs.circuitSafeLoadPercent);
        const totalPanels = Math.max(0, Math.round(Number(inputs.totalPanels) || 0));

        const totalEstimatedWatts = totalPanels * wattsPerPanel;
        const totalEstimatedAmps = circuitVoltage > 0 ? totalEstimatedWatts / circuitVoltage : 0;
        const rawWattsPerCircuit = circuitVoltage * circuitAmperage;
        const usableWattsPerCircuit = rawWattsPerCircuit * (circuitSafeLoadPercent / 100);
        const circuitHeadroomPercent = 100 - circuitSafeLoadPercent;
        const circuitsRequired = usableWattsPerCircuit > 0
            ? Math.ceil(totalEstimatedWatts / usableWattsPerCircuit)
            : 0;

        return {
            wattsPerPanel,
            circuitAmperage,
            circuitVoltage,
            circuitSafeLoadPercent,
            circuitHeadroomPercent,
            rawWattsPerCircuit,
            totalEstimatedWatts,
            totalEstimatedAmps,
            usableWattsPerCircuit,
            circuitsRequired
        };
    }

    /**
     * Per-cabinet bend angle when curved wall mode is enabled.
     */
    function resolveCabinetAngleDegrees(rawInputs = {}) {
        const curvedWallMode = rawInputs.curvedWallMode === true
            || rawInputs.curvedWallMode === 'true';
        if (!curvedWallMode) {
            return 0;
        }

        const preset = String(rawInputs.cabinetAnglePreset ?? '0');
        if (preset === 'custom') {
            const custom = Number(rawInputs.customCabinetAngleDegrees);
            return Number.isFinite(custom) && custom >= 0 ? custom : 0;
        }

        const angle = parseFloat(preset);
        return Number.isFinite(angle) && angle >= 0 ? angle : 0;
    }

    /**
     * Arc width, chord width, depth, and total curve angle for angled cabinets.
     * Does not affect pixel resolution or processor math.
     * Surface width = cabinet width × cabinets wide (arc length).
     */
    function calculateCurvedWallPhysical(inputs = {}) {
        const mmPerFoot = Number(inputs.mmPerFoot) || C.MM_PER_FOOT;
        const cabinetWidthMM = Number(inputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM;
        const panelsWide = clampPanelCount(Number(inputs.panelsWide) || C.DEFAULTS.panelsWide);
        const curvedWallMode = inputs.curvedWallMode === true
            || inputs.curvedWallMode === 'true';
        const cabinetAngleDegrees = Math.max(0, resolveCabinetAngleDegrees(inputs));

        const surfaceWidthFeet = (cabinetWidthMM / mmPerFoot) * panelsWide;
        const surfaceWidthMM = cabinetWidthMM * panelsWide;

        const flatResult = {
            curvedWallMode,
            curvedWallActive: false,
            cabinetAngleDegrees: 0,
            surfaceWidthFeet,
            surfaceWidthMM,
            arcWidthFeet: surfaceWidthFeet,
            chordWidthFeet: surfaceWidthFeet,
            chordWidthMM: surfaceWidthMM,
            curveDepthFeet: 0,
            curveDepthMM: 0,
            depthFeet: 0,
            totalCurveAngle: 0,
            totalCurveAngleRadians: 0,
            radiusFeet: null,
            radiusMM: null,
            curvedWallAngleExceeded: false,
            curvedWallValidationMessage: null
        };

        if (!curvedWallMode || cabinetAngleDegrees === 0 || panelsWide <= 1) {
            return flatResult;
        }

        const totalCurveAngle = (panelsWide - 1) * cabinetAngleDegrees;
        if (totalCurveAngle > C.MAX_TOTAL_CURVE_ANGLE) {
            return {
                ...flatResult,
                cabinetAngleDegrees,
                totalCurveAngle,
                curvedWallAngleExceeded: true,
                curvedWallValidationMessage: `Total curve angle (${totalCurveAngle.toFixed(1)}°) exceeds 180°. Reduce cabinet angle or panel count.`
            };
        }

        if (totalCurveAngle === 0) {
            return flatResult;
        }

        const totalCurveAngleRadians = totalCurveAngle * Math.PI / 180;
        const radiusFeet = surfaceWidthFeet / totalCurveAngleRadians;
        const chordWidthFeet = 2 * radiusFeet * Math.sin(totalCurveAngleRadians / 2);
        const curveDepthFeet = radiusFeet * (1 - Math.cos(totalCurveAngleRadians / 2));

        return {
            curvedWallMode,
            curvedWallActive: true,
            cabinetAngleDegrees,
            surfaceWidthFeet,
            surfaceWidthMM,
            arcWidthFeet: surfaceWidthFeet,
            chordWidthFeet,
            chordWidthMM: chordWidthFeet * mmPerFoot,
            curveDepthFeet,
            curveDepthMM: curveDepthFeet * mmPerFoot,
            depthFeet: curveDepthFeet,
            totalCurveAngle,
            totalCurveAngleRadians,
            radiusFeet,
            radiusMM: radiusFeet * mmPerFoot,
            curvedWallAngleExceeded: false,
            curvedWallValidationMessage: null
        };
    }

    /**
     * Layout positions for curved wall preview (front view with perspective).
     */
    function computeCurvedCabinetLayout(state, layoutWidthPx, layoutHeightPx) {
        const panelsWide = clampPanelCount(Number(state.panelsWide) || C.DEFAULTS.panelsWide);
        const panelsTall = clampPanelCount(Number(state.panelsTall) || C.DEFAULTS.panelsTall);
        const totalRad = Number(state.totalCurveAngleRadians) || 0;
        const radiusFeet = Number(state.radiusFeet) || 0;
        const surfaceWidthFeet = Number(state.surfaceWidthFeet) || 0;
        const curveDepthFeet = Number(state.curveDepthFeet) || 0;

        if (!state.curvedWallActive || totalRad <= 0 || radiusFeet <= 0 || panelsWide <= 1) {
            return null;
        }

        const startRad = -totalRad / 2;
        const angularStep = totalRad / panelsWide;
        const cabinetWidthFeet = surfaceWidthFeet / panelsWide;
        const footPositions = [];

        for (let col = 0; col < panelsWide; col += 1) {
            const theta = startRad + (col + 0.5) * angularStep;
            footPositions.push({
                x: radiusFeet * Math.sin(theta),
                depth: radiusFeet * (1 - Math.cos(theta)),
                rotateY: (theta * 180) / Math.PI
            });
        }

        const minX = Math.min(...footPositions.map((p) => p.x - cabinetWidthFeet / 2));
        const maxX = Math.max(...footPositions.map((p) => p.x + cabinetWidthFeet / 2));
        const spanXFt = Math.max(maxX - minX, state.chordWidthFeet || surfaceWidthFeet);
        const scale = layoutWidthPx / spanXFt;
        const cabinetWidthPx = cabinetWidthFeet * scale;
        const rowHeightPx = layoutHeightPx / panelsTall;
        const depthScale = curveDepthFeet > 0 ? Math.min(scale, (layoutHeightPx * 0.12) / curveDepthFeet) : 0;

        return {
            panelsWide,
            panelsTall,
            cabinetWidthPx,
            rowHeightPx,
            positions: footPositions.map((p) => ({
                xPx: (p.x - minX) * scale,
                depthPx: p.depth * depthScale,
                rotateY: p.rotateY
            }))
        };
    }

    /**
     * Maximum per-cabinet angle before total curve exceeds 180°.
     */
    function maxCabinetAngleForPanels(panelsWide) {
        const wide = clampPanelCount(Number(panelsWide) || C.DEFAULTS.panelsWide);
        if (wide <= 1) {
            return 0;
        }
        return C.MAX_TOTAL_CURVE_ANGLE / (wide - 1);
    }

    /**
     * Resolve cabinet pixels (auto or manual) then compute full wall metrics.
     * Input object is serializable — suitable for save/load and export later.
     */
    function computeWallProject(rawInputs = {}) {
        const autoCalculate = rawInputs.autoCalculateResolution !== false
            && rawInputs.autoCalculateResolution !== 'false';

        const cabinetDimensions = resolveCabinetDimensions(rawInputs);
        const resolvedInputs = {
            ...rawInputs,
            ...cabinetDimensions
        };

        let pixelWidth = Number(resolvedInputs.pixelWidth) || C.DEFAULTS.pixelWidth;
        let pixelHeight = Number(resolvedInputs.pixelHeight) || C.DEFAULTS.pixelHeight;

        if (autoCalculate) {
            const cabinetPixels = calculateCabinetResolution(resolvedInputs);
            pixelWidth = cabinetPixels.pixelWidth;
            pixelHeight = cabinetPixels.pixelHeight;
        }

        const wall = calculateWallResolution({
            pixelWidth,
            pixelHeight,
            panelsWide: resolvedInputs.panelsWide,
            panelsTall: resolvedInputs.panelsTall
        });

        const physical = calculatePhysicalSize({
            cabinetWidthMM: cabinetDimensions.cabinetWidthMM,
            cabinetHeightMM: cabinetDimensions.cabinetHeightMM,
            panelsWide: wall.panelsWide,
            panelsTall: wall.panelsTall,
            mmPerFoot: resolvedInputs.mmPerFoot
        });

        const aspect = calculateAspectRatio({
            totalPixelWidth: wall.totalPixelWidth,
            totalPixelHeight: wall.totalPixelHeight
        });

        const processor = calculateProcessorPorts({
            totalPixels: wall.totalPixels,
            portCapacity: resolvedInputs.portCapacity,
            portFillThreshold: resolvedInputs.portFillThreshold
        });

        const portLoading = summarizePortLoading({
            ...processor,
            totalPixels: wall.totalPixels
        });

        const overlayTarget = resolveOverlayTargetRatio(resolvedInputs);
        const overlay = overlayTarget
            ? calculateContentOverlay({
                totalPixelWidth: wall.totalPixelWidth,
                totalPixelHeight: wall.totalPixelHeight,
                targetRatio: overlayTarget.ratio
            })
            : null;

        const power = calculatePowerRequirements({
            totalPanels: wall.totalPanels,
            wattsPerPanel: resolvedInputs.wattsPerPanel,
            circuitAmperage: resolvedInputs.circuitAmperage,
            circuitVoltage: resolvedInputs.circuitVoltage,
            circuitSafeLoadPercent: resolvedInputs.circuitSafeLoadPercent
        });

        const curvedWall = calculateCurvedWallPhysical({
            curvedWallMode: resolvedInputs.curvedWallMode,
            cabinetAnglePreset: resolvedInputs.cabinetAnglePreset,
            customCabinetAngleDegrees: resolvedInputs.customCabinetAngleDegrees,
            cabinetWidthMM: cabinetDimensions.cabinetWidthMM,
            panelsWide: wall.panelsWide,
            mmPerFoot: resolvedInputs.mmPerFoot
        });

        return {
            ...wall,
            ...physical,
            ...curvedWall,
            aspectRatio: aspect.ratio,
            closestRatio: aspect.closestRatio,
            ...processor,
            ...portLoading,
            ...power,
            overlayFormat: resolvedInputs.overlayFormat ?? 'none',
            overlayFormatLabel: overlayTarget ? overlayTarget.label : null,
            overlayActive: overlayTarget !== null,
            overlay,
            cabinetArtworkType: calculateCabinetArtworkType(cabinetDimensions),
            displayType: resolvedInputs.displayType || C.DEFAULTS.displayType,
            cabinetWidthMM: cabinetDimensions.cabinetWidthMM,
            cabinetHeightMM: cabinetDimensions.cabinetHeightMM,
            pixelPitchMM: Number(resolvedInputs.pixelPitchMM) || C.DEFAULTS.pixelPitchMM
        };
    }

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    Object.assign(global.OkamiLedWallCalculator, {
        clampPanelCount,
        clampPortFillThreshold,
        clampCircuitSafeLoadPercent,
        isCustomSpacingDisplayType,
        resolveCabinetDimensions,
        calculateCabinetResolution,
        calculateWallResolution,
        calculatePhysicalSize,
        calculateAspectRatio,
        resolveOverlayTargetRatio,
        isOverlayActive,
        calculateContentOverlay,
        calculatePortFill,
        calculateProcessorPorts,
        summarizePortLoading,
        calculatePowerRequirements,
        calculateCabinetArtworkType,
        resolveCabinetAngleDegrees,
        calculateCurvedWallPhysical,
        computeCurvedCabinetLayout,
        maxCabinetAngleForPanels,
        computeWallProject
    });
})(typeof window !== 'undefined' ? window : globalThis);
