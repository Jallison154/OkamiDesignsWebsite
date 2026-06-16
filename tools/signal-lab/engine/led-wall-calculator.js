(function(global) {
    'use strict';

    const COMMON_ASPECT_RATIOS = [
        { label: '16:9', value: 16 / 9 },
        { label: '21:9', value: 21 / 9 },
        { label: '4:3', value: 4 / 3 },
        { label: '1:1', value: 1 },
        { label: '2.35:1', value: 2.35 },
        { label: '3:1', value: 3 },
        { label: '4096:2160 (DCI 4K)', value: 4096 / 2160 },
        { label: '256:135 (HD)', value: 256 / 135 }
    ];

    const STANDARD_RESOLUTIONS = [
        { width: 7680, height: 4320, label: '8K UHD' },
        { width: 3840, height: 2160, label: '4K UHD' },
        { width: 4096, height: 2160, label: '4K DCI' },
        { width: 2560, height: 1440, label: '1440p' },
        { width: 1920, height: 1080, label: '1080p' },
        { width: 1280, height: 720, label: '720p' }
    ];

    const CONTENT_SOURCES = [
        { width: 1920, height: 1080, label: '1080p' },
        { width: 3840, height: 2160, label: '4K UHD' },
        { width: 2560, height: 1440, label: '1440p' }
    ];

    function gcd(a, b) {
        let x = Math.abs(Math.round(a));
        let y = Math.abs(Math.round(b));
        while (y) {
            const temp = y;
            y = x % y;
            x = temp;
        }
        return x || 1;
    }

    function formatExactAspectRatio(width, height) {
        const divisor = gcd(width, height);
        const ratioW = Math.round(width / divisor);
        const ratioH = Math.round(height / divisor);
        const decimal = (width / height).toFixed(4);
        return `${ratioW}:${ratioH} (${decimal}:1)`;
    }

    function findClosestAspectRatio(ratio) {
        let closest = COMMON_ASPECT_RATIOS[0];
        let minDiff = Math.abs(ratio - closest.value);

        COMMON_ASPECT_RATIOS.forEach((entry) => {
            const diff = Math.abs(ratio - entry.value);
            if (diff < minDiff) {
                minDiff = diff;
                closest = entry;
            }
        });

        const deviationPct = ((minDiff / closest.value) * 100).toFixed(2);
        return {
            ...closest,
            deviationPct: Number(deviationPct)
        };
    }

    function isNearInteger(value, epsilon = 0.02) {
        return Math.abs(value - Math.round(value)) <= epsilon;
    }

    function buildScalingWarnings(wall) {
        const warnings = [];
        const {
            totalWidth,
            totalHeight,
            aspectRatio,
            closestAspect,
            panelWidthPx,
            panelHeightPx
        } = wall;

        if (closestAspect.deviationPct > 2) {
            warnings.push(`Aspect ratio differs from ${closestAspect.label} by ${closestAspect.deviationPct}%`);
        }

        const standardMatch = STANDARD_RESOLUTIONS.find(
            (entry) => entry.width === totalWidth && entry.height === totalHeight
        );
        if (!standardMatch) {
            warnings.push('Exact resolution does not match a standard broadcast format');
        }

        CONTENT_SOURCES.forEach((source) => {
            const scaleX = totalWidth / source.width;
            const scaleY = totalHeight / source.height;
            const uniform = Math.abs(scaleX - scaleY) <= 0.01;

            if (!uniform) {
                warnings.push(`${source.label} content requires non-uniform scaling (${scaleX.toFixed(3)}× / ${scaleY.toFixed(3)}×)`);
            } else if (!isNearInteger(scaleX)) {
                warnings.push(`${source.label} content scales by ${scaleX.toFixed(3)}× — not a whole-pixel factor`);
            }
        });

        if (panelWidthPx % 2 !== 0 || panelHeightPx % 2 !== 0) {
            warnings.push('Odd panel pixel dimensions may affect some codecs and scalers');
        }

        if (totalWidth * totalHeight > 20000000) {
            warnings.push('Total pixel count exceeds 20 MP — verify processor and cable capacity');
        }

        if (totalWidth > 16384 || totalHeight > 16384) {
            warnings.push('Wall dimension exceeds 16,384 px on one axis — check output limits');
        }

        if (aspectRatio > 4 || aspectRatio < 0.25) {
            warnings.push('Extreme aspect ratio — verify content framing and processor support');
        }

        return warnings;
    }

    function calculateLedWall(inputs = {}) {
        const panelWidthPx = Math.max(1, Math.floor(Number(inputs.panelWidthPx) || 192));
        const panelHeightPx = Math.max(1, Math.floor(Number(inputs.panelHeightPx) || 192));
        const panelsWide = Math.max(1, Math.floor(Number(inputs.panelsWide) || 1));
        const panelsTall = Math.max(1, Math.floor(Number(inputs.panelsTall) || 1));

        const totalWidth = panelWidthPx * panelsWide;
        const totalHeight = panelHeightPx * panelsTall;
        const aspectRatio = totalWidth / totalHeight;
        const exactAspectRatio = formatExactAspectRatio(totalWidth, totalHeight);
        const closestAspect = findClosestAspectRatio(aspectRatio);
        const warnings = buildScalingWarnings({
            totalWidth,
            totalHeight,
            aspectRatio,
            closestAspect,
            panelWidthPx,
            panelHeightPx
        });

        return {
            panelWidthPx,
            panelHeightPx,
            panelsWide,
            panelsTall,
            totalWidth,
            totalHeight,
            aspectRatio,
            exactAspectRatio,
            closestAspectLabel: closestAspect.label,
            closestAspectDeviationPct: closestAspect.deviationPct,
            resolutionLabel: `${totalWidth} × ${totalHeight}`,
            warnings,
            hasWarnings: warnings.length > 0
        };
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.LedWallCalculator = {
        COMMON_ASPECT_RATIOS,
        calculateLedWall,
        formatExactAspectRatio,
        findClosestAspectRatio
    };
})(typeof window !== 'undefined' ? window : globalThis);
