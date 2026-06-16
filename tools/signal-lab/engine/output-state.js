(function(global) {
    'use strict';

    const MSG = {
        READY: 'OKAMI_SIGNAL_LAB_READY',
        STATE: 'OKAMI_SIGNAL_LAB_STATE',
        CLOSED: 'OKAMI_SIGNAL_LAB_CLOSED'
    };

    function cloneDeep(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function captureAnimationClock(activeModuleId, moduleState) {
        const syncedWallAt = Date.now();

        const state = moduleState[activeModuleId] || {};

        if (activeModuleId === 'motion-patterns') {
            const snapshot = global.OkamiSignalLab?.getMotionClockSnapshot?.(state);
            if (snapshot) {
                return { ...snapshot, syncedWallAt };
            }
        }

        if (activeModuleId === 'video-patterns' && state.patternId === 'okami-calibration') {
            return {
                type: 'calibration',
                syncedWallAt,
                motionPlaying: state.motionPlaying !== false,
                phaseOffset: syncedWallAt / 12
            };
        }

        if (activeModuleId === 'sync-tools' && state.active) {
            const snapshot = global.OkamiSignalLab?.getSyncRuntimeSnapshot?.();
            if (snapshot) {
                return { type: 'sync-tools', syncedWallAt, ...snapshot };
            }
        }

        return { type: 'none', syncedWallAt };
    }

    /**
     * Build the canonical output state snapshot used by preview and pop-out.
     */
    function buildOutputState(params) {
        const {
            activeModuleId,
            moduleState,
            outputSettings,
            requestFullscreen = false
        } = params;

        return {
            activeModuleId,
            moduleState: cloneDeep(moduleState),
            outputSettings: { ...outputSettings },
            animation: captureAnimationClock(activeModuleId, moduleState),
            requestFullscreen: Boolean(requestFullscreen),
            sentAt: performance.now()
        };
    }

    function injectAnimationIntoState(activeModuleId, state, animation) {
        if (!animation || !state) {
            return { ...state };
        }

        const next = { ...state };

        if (activeModuleId === 'motion-patterns') {
            if (animation.motionTime !== undefined) {
                next._syncedMotionTime = animation.motionTime;
            }
            if (animation.syncedWallAt !== undefined) {
                next._syncedWallAt = animation.syncedWallAt;
            }
        }

        if (activeModuleId === 'video-patterns' && next.patternId === 'okami-calibration') {
            next._motionSyncedWallAt = animation.syncedWallAt ?? Date.now();
            next._motionPhaseOffset = animation.phaseOffset ?? 0;
            next.motionPlaying = animation.motionPlaying !== false;
        }

        return next;
    }

    function preloadBrandingAssets(moduleState) {
        const branding = moduleState?.branding;
        if (!branding?.logoDataUrl) {
            return;
        }

        const renderer = global.OkamiSignalLab?.ModuleRegistry?.getRenderer('branding');
        if (renderer && typeof renderer.onStateChange === 'function') {
            renderer.onStateChange({ renderFrame: () => {} }, branding, 'logoDataUrl');
        }
    }

    /**
     * Apply a full output state to a render engine (pop-out or preview helper).
     */
    function applyOutputState(context) {
        const {
            engine,
            registry,
            outputState,
            moduleStateStore,
            tracker
        } = context;

        if (!engine || !registry || !outputState || !moduleStateStore) {
            return null;
        }

        const activeModuleId = outputState.activeModuleId;
        const incoming = outputState.moduleState || {};

        Object.keys(incoming).forEach((moduleId) => {
            moduleStateStore[moduleId] = cloneDeep(incoming[moduleId]);
        });

        engine.setOutputSettings({ ...(outputState.outputSettings || {}) });

        if (global.OkamiSignalLab?.restoreSyncRuntimeSnapshot
            && outputState.animation?.type === 'sync-tools') {
            global.OkamiSignalLab.restoreSyncRuntimeSnapshot(outputState.animation);
        }

        let activeState = injectAnimationIntoState(
            activeModuleId,
            moduleStateStore[activeModuleId] || {},
            outputState.animation
        );
        moduleStateStore[activeModuleId] = activeState;

        preloadBrandingAssets(moduleStateStore);

        const renderer = registry.getRenderer(activeModuleId);
        if (!renderer) {
            return { activeModuleId };
        }

        const moduleChanged = tracker.lastModuleId !== activeModuleId;
        const patternChanged = !moduleChanged && tracker.lastPatternId !== activeState.patternId;

        engine.setModule(renderer);
        engine.setState({ ...activeState });

        if (moduleChanged || patternChanged) {
            if (typeof renderer.onAttach === 'function') {
                renderer.onAttach(engine);
            }
            engine.setState({ ...activeState });
        }

        if (typeof renderer.onStateChange === 'function') {
            Object.keys(activeState).forEach((key) => {
                if (key.startsWith('_')) {
                    return;
                }
                renderer.onStateChange(engine, activeState, key);
            });
        }

        tracker.lastModuleId = activeModuleId;
        tracker.lastPatternId = activeState.patternId ?? null;

        return { activeModuleId };
    }

    function createApplyTracker() {
        return {
            lastModuleId: null,
            lastPatternId: null,
            lastStateSnapshot: null,
            lastStateKeys: []
        };
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.OutputState = {
        MSG,
        buildOutputState,
        applyOutputState,
        createApplyTracker,
        captureAnimationClock,
        injectAnimationIntoState
    };
})(typeof window !== 'undefined' ? window : globalThis);
