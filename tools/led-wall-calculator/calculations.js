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

    function isMmCabinetPreset(presetKey) {
        return presetKey === '500x500' || presetKey === '500x1000';
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
     * Resolve cabinet pixels (auto or manual) then compute full wall metrics.
     * Input object is serializable — suitable for save/load and export later.
     */
    function computeWallProject(rawInputs = {}) {
        const autoCalculate = rawInputs.autoCalculateResolution !== false
            && rawInputs.autoCalculateResolution !== 'false';

        let pixelWidth = Number(rawInputs.pixelWidth) || C.DEFAULTS.pixelWidth;
        let pixelHeight = Number(rawInputs.pixelHeight) || C.DEFAULTS.pixelHeight;

        if (autoCalculate) {
            const cabinetPixels = calculateCabinetResolution(rawInputs);
            pixelWidth = cabinetPixels.pixelWidth;
            pixelHeight = cabinetPixels.pixelHeight;
        }

        const wall = calculateWallResolution({
            pixelWidth,
            pixelHeight,
            panelsWide: rawInputs.panelsWide,
            panelsTall: rawInputs.panelsTall
        });

        const physical = calculatePhysicalSize({
            cabinetWidthMM: rawInputs.cabinetWidthMM,
            cabinetHeightMM: rawInputs.cabinetHeightMM,
            panelsWide: wall.panelsWide,
            panelsTall: wall.panelsTall,
            mmPerFoot: rawInputs.mmPerFoot
        });

        const aspect = calculateAspectRatio({
            totalPixelWidth: wall.totalPixelWidth,
            totalPixelHeight: wall.totalPixelHeight
        });

        const processor = calculateProcessorPorts({
            totalPixels: wall.totalPixels,
            portCapacity: rawInputs.portCapacity,
            portFillThreshold: rawInputs.portFillThreshold
        });

        const overlayTarget = resolveOverlayTargetRatio(rawInputs);
        const overlay = overlayTarget
            ? calculateContentOverlay({
                totalPixelWidth: wall.totalPixelWidth,
                totalPixelHeight: wall.totalPixelHeight,
                targetRatio: overlayTarget.ratio
            })
            : null;

        return {
            ...wall,
            ...physical,
            aspectRatio: aspect.ratio,
            closestRatio: aspect.closestRatio,
            ...processor,
            overlayFormat: rawInputs.overlayFormat ?? 'none',
            overlayFormatLabel: overlayTarget ? overlayTarget.label : null,
            overlayActive: overlayTarget !== null,
            overlay,
            cabinetArtworkType: calculateCabinetArtworkType(rawInputs),
            displayType: rawInputs.displayType || C.DEFAULTS.displayType,
            cabinetWidthMM: Number(rawInputs.cabinetWidthMM) || C.DEFAULTS.cabinetWidthMM,
            cabinetHeightMM: Number(rawInputs.cabinetHeightMM) || C.DEFAULTS.cabinetHeightMM,
            pixelPitchMM: Number(rawInputs.pixelPitchMM) || C.DEFAULTS.pixelPitchMM
        };
    }

    global.OkamiLedWallCalculator = global.OkamiLedWallCalculator || {};
    Object.assign(global.OkamiLedWallCalculator, {
        clampPanelCount,
        clampPortFillThreshold,
        isCustomSpacingDisplayType,
        calculateCabinetResolution,
        calculateWallResolution,
        calculatePhysicalSize,
        calculateAspectRatio,
        resolveOverlayTargetRatio,
        isOverlayActive,
        calculateContentOverlay,
        calculatePortFill,
        calculateProcessorPorts,
        calculateCabinetArtworkType,
        computeWallProject
    });
})(typeof window !== 'undefined' ? window : globalThis);
