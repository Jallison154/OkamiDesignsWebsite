(function(global) {
    'use strict';

    const OutputState = () => global.OkamiSignalLab?.OutputState;

    function shouldAnimateOutput(outputState) {
        const registry = global.OkamiSignalLab?.ModuleRegistry;
        const shouldAnimate = global.OkamiSignalLab?.ModuleAnimation?.shouldAnimateModule;

        if (!registry || !outputState || !shouldAnimate) {
            return false;
        }

        const activeModuleId = outputState.activeModuleId;
        const moduleState = outputState.moduleState || {};
        let state = { ...(moduleState[activeModuleId] || {}) };

        state = OutputState()?.injectAnimationIntoState(
            activeModuleId,
            state,
            outputState.animation
        ) || state;

        const renderer = registry.getRenderer(activeModuleId);
        return shouldAnimate(renderer, state);
    }

    /**
     * Single render path for main preview and pop-out mirror.
     * Applies full outputState to the engine, then draws one frame.
     */
    function renderSignalLabCanvas(engine, outputState, timestamp, tracker, options = {}) {
        const os = OutputState();
        const registry = global.OkamiSignalLab?.ModuleRegistry;

        if (!engine || !outputState || !registry || !os) {
            return false;
        }

        const applyTracker = tracker || os.createApplyTracker();
        const activeModuleId = outputState.activeModuleId;
        const incoming = outputState.moduleState || {};

        engine.setOutputSettings({ ...(outputState.outputSettings || {}) });

        if (outputState.animation?.type === 'sync-tools') {
            global.OkamiSignalLab?.restoreSyncRuntimeSnapshot?.(outputState.animation);
        }

        let activeState = os.injectAnimationIntoState(
            activeModuleId,
            JSON.parse(JSON.stringify(incoming[activeModuleId] || {})),
            outputState.animation
        );

        os.preloadBrandingAssets(incoming);

        const renderer = registry.getRenderer(activeModuleId);
        if (!renderer) {
            const fallbackId = registry.DEFAULT_RENDERER_ID || 'video-patterns';
            if (options._retriedFallback || activeModuleId === fallbackId) {
                return false;
            }
            const fallback = registry.getRenderer(fallbackId);
            if (!fallback) {
                return false;
            }
            return renderSignalLabCanvas(
                engine,
                { ...outputState, activeModuleId: fallbackId },
                timestamp,
                tracker,
                { ...options, _retriedFallback: true }
            );
        }

        const moduleChanged = applyTracker.lastModuleId !== activeModuleId;
        const patternChanged = applyTracker.lastPatternId !== activeState.patternId;
        const rendererChanged = engine.module !== renderer;

        if (moduleChanged || rendererChanged) {
            if (engine.module !== renderer) {
                try {
                    engine.setModule(renderer);
                } catch (error) {
                    global.OkamiSignalLab?.ModuleErrorBoundary?.reportError?.(activeModuleId, 'attach', error);
                }
            }
        }

        engine.setState({ ...activeState });

        if (!options.renderOnly && (moduleChanged || rendererChanged || patternChanged)) {
            if (typeof renderer.onAttach === 'function' && (moduleChanged || patternChanged)) {
                const boundary = global.OkamiSignalLab?.ModuleErrorBoundary;
                const attach = () => {
                    renderer.onAttach(engine);
                    engine.setState({ ...activeState });
                };

                if (boundary) {
                    boundary.safeRun(activeModuleId, 'attach', attach);
                } else {
                    attach();
                }
            }
        }

        if (!options.renderOnly && typeof renderer.onStateChange === 'function') {
            const prevKeys = applyTracker.lastStateKeys || [];
            const nextKeys = Object.keys(activeState).filter((key) => !key.startsWith('_'));
            const keysToNotify = moduleChanged || rendererChanged || patternChanged
                ? nextKeys
                : nextKeys.filter((key) => {
                    const prev = applyTracker.lastStateSnapshot?.[key];
                    return JSON.stringify(prev) !== JSON.stringify(activeState[key]);
                });

            keysToNotify.forEach((key) => {
                renderer.onStateChange(engine, activeState, key);
            });

            applyTracker.lastStateSnapshot = JSON.parse(JSON.stringify(activeState));
            applyTracker.lastStateKeys = nextKeys;
        }

        applyTracker.lastModuleId = activeModuleId;
        applyTracker.lastPatternId = activeState.patternId ?? null;

        try {
            engine.renderFrame(timestamp ?? performance.now());
        } catch (error) {
            global.OkamiSignalLab?.ModuleErrorBoundary?.reportError?.(activeModuleId, 'render', error);
        }

        return shouldAnimateOutput(outputState);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.renderSignalLabCanvas = renderSignalLabCanvas;
    global.OkamiSignalLab.shouldAnimateOutput = shouldAnimateOutput;
})(typeof window !== 'undefined' ? window : globalThis);
