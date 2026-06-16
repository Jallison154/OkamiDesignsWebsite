(function(global) {
    'use strict';

    const PREMIUM_MOTION_PATTERN_IDS = new Set([
        'figure-8',
        'rotating-siemens-star',
        'rotating-logo'
    ]);

    const PREMIUM_VIDEO_PATTERN_IDS = new Set([
        'smpte-bars',
        'grayscale-ramp',
        'pixel-grid',
        'resolution'
    ]);

    function isPremiumPattern(moduleId, patternId) {
        if (!patternId) {
            return false;
        }
        if (moduleId === 'motion-patterns') {
            return PREMIUM_MOTION_PATTERN_IDS.has(patternId);
        }
        if (moduleId === 'video-patterns') {
            return PREMIUM_VIDEO_PATTERN_IDS.has(patternId);
        }
        return false;
    }

    const api = {
        PREMIUM_MOTION_PATTERN_IDS,
        PREMIUM_VIDEO_PATTERN_IDS,
        isPremiumPattern
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.CommercialPremiumPatterns = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
