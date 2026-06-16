(function(global) {
    'use strict';

    const PRESETS = [
        { id: 'auto', label: 'Auto / Match Output' },
        { id: '1280x720', label: '1280 × 720', width: 1280, height: 720 },
        { id: '1920x1080', label: '1920 × 1080', width: 1920, height: 1080 },
        { id: '2560x1440', label: '2560 × 1440', width: 2560, height: 1440 },
        { id: '3840x2160', label: '3840 × 2160', width: 3840, height: 2160 },
        { id: '4096x2160', label: '4096 × 2160', width: 4096, height: 2160 },
        { id: 'custom', label: 'Custom' }
    ];

    function resolvePatternResolution(settings, outputWidth, outputHeight) {
        const preset = settings?.patternResolution || 'auto';
        const outW = Math.max(1, Math.floor(outputWidth || 1));
        const outH = Math.max(1, Math.floor(outputHeight || 1));

        if (preset === 'auto') {
            return { width: outW, height: outH, preset, matchesOutput: true };
        }

        if (preset === 'custom') {
            const width = Math.max(1, Math.floor(Number(settings.patternWidth) || 1920));
            const height = Math.max(1, Math.floor(Number(settings.patternHeight) || 1080));
            return {
                width,
                height,
                preset,
                matchesOutput: width === outW && height === outH
            };
        }

        const match = PRESETS.find((entry) => entry.id === preset);
        const width = match?.width || 1920;
        const height = match?.height || 1080;
        return {
            width,
            height,
            preset,
            matchesOutput: width === outW && height === outH
        };
    }

    function getMismatchWarning(resolved, outputWidth, outputHeight) {
        if (!resolved || resolved.preset === 'auto' || resolved.matchesOutput) {
            return null;
        }
        return `Pattern resolution (${resolved.width}×${resolved.height}) does not match output (${outputWidth}×${outputHeight}).`;
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.PatternResolution = {
        PRESETS,
        resolvePatternResolution,
        getMismatchWarning
    };
})(typeof window !== 'undefined' ? window : globalThis);
