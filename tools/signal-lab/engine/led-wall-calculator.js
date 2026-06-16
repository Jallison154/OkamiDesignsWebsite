(function(global) {
    'use strict';

    /**
     * Signal Lab adapter — re-exports shared LED metrics from tools/led-wall-calculator/.
     * Load constants.js, calculations.js, and metrics.js before this file.
     */
    const metrics = global.OkamiLedWallCalculator?.Metrics;

    if (!metrics) {
        console.error(
            'OkamiLedWallCalculator.Metrics missing. Load led-wall-calculator/constants.js, ' +
            'calculations.js, and metrics.js before signal-lab/engine/led-wall-calculator.js.'
        );
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.LedWallCalculator = metrics || {
        calculateLedWall() {
            return { warnings: [], hasWarnings: false, resolutionLabel: '—' };
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
