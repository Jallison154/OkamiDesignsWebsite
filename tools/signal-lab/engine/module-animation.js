(function(global) {
    'use strict';

    /** Whether a module renderer should keep the animation loop running. */
    function shouldAnimateModule(renderer, state = {}) {
        if (typeof renderer?.shouldAnimate === 'function') {
            return renderer.shouldAnimate(state);
        }

        if (renderer?.needsAnimationLoop === false) {
            return false;
        }

        if (state.playing === false || state.active === false) {
            return false;
        }

        return Boolean(renderer?.needsAnimationLoop);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.ModuleAnimation = { shouldAnimateModule };
})(typeof window !== 'undefined' ? window : globalThis);
