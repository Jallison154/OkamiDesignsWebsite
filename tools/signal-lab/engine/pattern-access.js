(function(global) {
    'use strict';

    /**
     * Whether a module pattern may render. When commercial gating is not loaded
     * (e.g. pop-out window), allow all patterns so the mirror matches the parent preview.
     */
    function canRenderPattern(moduleId, patternId) {
        const check = global.OkamiCommercialGate?.canUsePremiumPatternSync;
        if (typeof check !== 'function') {
            return true;
        }
        return check(moduleId, patternId);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.canRenderPattern = canRenderPattern;
})(typeof window !== 'undefined' ? window : globalThis);
