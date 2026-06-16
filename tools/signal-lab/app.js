(function() {
    'use strict';

    function refreshPreviewLayout() {
        window.OkamiSiteLayout?.refreshLayout?.();
    }

    /** Temporary scaling debug — set false or use ?debugScale=0 to hide. ?debugScale=1 forces on. */
    const PREVIEW_SCALE_DEBUG_DEFAULT = false;

    function isPreviewScaleDebugEnabled() {
        const params = new URLSearchParams(window.location.search);
        const param = params.get('debugScale');
        if (param === '0' || param === 'false') {
            return false;
        }
        if (param === '1' || param === 'true') {
            return true;
        }
        return PREVIEW_SCALE_DEBUG_DEFAULT;
    }

    function initPreviewScaleDebug() {
        const el = document.getElementById('signal-lab-scale-debug');
        if (!el) {
            return;
        }
        const enabled = isPreviewScaleDebugEnabled();
        el.hidden = !enabled;
        el.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    }

    function updatePreviewScaleDebug(metrics) {
        const el = document.getElementById('signal-lab-scale-debug');
        if (!el || el.hidden) {
            return;
        }

        const {
            wrapperWidth,
            wrapperHeight,
            patternWidth,
            patternHeight,
            width,
            height,
            scaleFactor,
            scaleMode
        } = metrics;

        const scaleLabel = Number.isFinite(scaleFactor) ? scaleFactor.toFixed(4) : '—';
        el.textContent = [
            `wrapper: ${wrapperWidth} × ${wrapperHeight}`,
            `pattern: ${patternWidth} × ${patternHeight}`,
            `css canvas: ${width} × ${height}`,
            `scale: ${scaleLabel}`,
            `mode: ${scaleMode || 'fit'}`
        ].join('\n');
    }

    let engine = null;
    let popoutWindow = null;
    let popoutChannel = null;
    const POPOUT_SYNC_CHANNEL = 'okami-signal-lab-sync';
    const DEFAULT_MODULE_ID = 'video-patterns';
    let activeModuleId = DEFAULT_MODULE_ID;
    /** Canonical render state — main preview and pop-out both mirror this. */
    let outputState = null;
    let previewTracker = null;
    let initialized = false;
    let refreshEstimator = null;
    let popoutDisconnectTimer = null;
    let hadPopoutWindow = false;

    function getRegistry() {
        return window.OkamiSignalLab?.ModuleRegistry;
    }

    function resolveModuleId(moduleId) {
        return getRegistry()?.resolveRendererId?.(moduleId) || moduleId || DEFAULT_MODULE_ID;
    }

    function getBoundary() {
        return window.OkamiSignalLab?.ModuleErrorBoundary;
    }

    function getModuleLabel(moduleId) {
        return getBoundary()?.getModuleLabel?.(moduleId) || moduleId || 'Module';
    }

    function formatModuleLoadError(moduleId) {
        return getBoundary()?.formatLoadError?.(moduleId)
            || `This module failed to load. ${getModuleLabel(moduleId)}`;
    }

    function showModuleError(message) {
        const el = document.getElementById('signal-lab-module-error');
        if (!el) {
            return;
        }
        el.hidden = false;
        el.textContent = message;
    }

    function clearModuleError() {
        const el = document.getElementById('signal-lab-module-error');
        if (el) {
            el.hidden = true;
            el.textContent = '';
        }
    }

    function showModulePanelError(moduleId) {
        const container = getElements().controlDeck;
        const boundary = getBoundary();
        if (!container || !boundary) {
            return;
        }

        container.hidden = false;
        container.innerHTML = `<div class="signal-lab-card-grid">${boundary.buildPanelErrorHtml(moduleId)}</div>`;
    }

    function initModuleErrorReporting() {
        window.OkamiSignalLab = window.OkamiSignalLab || {};
        window.OkamiSignalLab.onModuleError = (payload) => {
            const moduleId = payload?.moduleId || activeModuleId;
            showModuleError(payload?.message || formatModuleLoadError(moduleId));
            if (moduleId === activeModuleId) {
                showModulePanelError(moduleId);
            }
        };
    }

    function attachModuleToEngine(moduleId) {
        if (!engine) {
            return false;
        }

        const registry = getRegistry();
        const rendererId = resolveModuleId(moduleId);
        const renderer = registry?.getRenderer(rendererId);

        if (!renderer) {
            return false;
        }

        const state = getModuleState(rendererId) || renderer.defaultState || {};

        try {
            engine.setOutputSettings({ ...outputSettings });
            engine.setState({ ...state });
            engine.setModule(renderer);
            return true;
        } catch (error) {
            getBoundary()?.reportError?.(rendererId, 'attach', error);
            return false;
        }
    }

    const outputSettings = {
        patternResolution: 'auto',
        patternWidth: 1920,
        patternHeight: 1080,
        selectedScreenId: '',
        scaleMode: 'fit',
        backgroundEnabled: true,
        backgroundType: 'technical-grid',
        backgroundOpacity: 100,
        gridIntensity: 100
    };
    const moduleState = {
        'video-patterns': {
            patternId: 'okami-calibration',
            motionPlaying: true,
            lineThickness: 2,
            gridSize: 64,
            toneEnabled: false,
            toneLevelDbfs: -20
        },
        'motion-patterns': {
            patternId: 'bouncing-ball',
            playing: true,
            speed: 1,
            reverse: false,
            motionSize: 1,
            objectColor: '#FF6A2D',
            motionBackgroundEnabled: true,
            trailLength: 40,
            trailOpacity: 70,
            motionShape: 'ball',
            colorMode: 'cycle-bounce',
            dvdColor: '#FF6A2D',
            trail: 'short',
            edgeFlash: true,
            dvdText: 'OKAMI',
            dvdLogoDataUrl: '',
            wrapMode: 'bounce',
            orbitRadius: 0.32,
            figure8Width: 0.28,
            figure8Height: 0.28,
            lineThickness: 2,
            lineSpacing: 28,
            lineColor: '#FF6A2D',
            gridSize: 32,
            gridLineThickness: 1,
            gridDirection: 'both',
            rotationSpeed: 0.8,
            crawlText: 'OKAMI SIGNAL LAB',
            crawlTextSize: 48,
            crawlDirection: 'left',
            randomMotionType: 'random-bounce',
            randomPreset: 'custom',
            objectCount: 1,
            randomnessAmount: 55,
            directionChangeFreq: 2,
            randomColorMode: 'brand',
            waypointPauseMs: 400,
            boundaryBounce: true,
            wrapEdges: false,
            smoothMotion: true,
            randomRotation: false,
            randomScaleChanges: false
        },
        'audio-tools': {
            sourceId: 'tone-1khz',
            active: false,
            volume: 0.5,
            channelMode: 'stereo'
        },
        'sync-tools': {
            mode: 'flash-click',
            active: false,
            intervalMs: 1000,
            clickVolume: 0.6,
            flashEnabled: true,
            clickEnabled: true
        },
        'display-info': {},
        branding: {
            logoEnabled: false,
            logoDataUrl: '',
            logoSize: 20,
            logoOpacity: 1,
            logoPosition: 'bottom-right',
            textEnabled: true,
            customText: 'Okami Signal Lab',
            textSize: 28,
            textOpacity: 0.85,
            textPosition: 'bottom-center'
        },
        export: {
            sourceModuleId: 'active',
            format: 'png',
            resolutionPreset: '1920x1080',
            customWidth: 1920,
            customHeight: 1080,
            textWatermarkEnabled: false,
            textWatermarkText: 'Okami Signal Lab',
            textWatermarkOpacity: 0.45,
            logoWatermarkEnabled: false,
            logoWatermarkDataUrl: '',
            logoWatermarkOpacity: 0.55,
            logoWatermarkSize: 12,
            exportIncludeBackground: true
        },
        'led-utilities': {
            panelWidthPx: 192,
            panelHeightPx: 192,
            panelsWide: 10,
            panelsTall: 6
        }
    };

    function getElements() {
        return {
            app: document.getElementById('signal-lab-app'),
            layout: document.getElementById('signal-lab-layout'),
            canvas: document.getElementById('signal-lab-canvas'),
            canvasWrap: document.getElementById('signal-lab-canvas-wrap'),
            stage: document.getElementById('signal-lab-stage'),
            moduleSelect: document.getElementById('signal-lab-module-select'),
            controlDeck: document.getElementById('signal-lab-control-deck'),
            outputControls: document.getElementById('signal-lab-output-controls'),
            sidebar: document.getElementById('signal-lab-sidebar'),
            sidebarToggle: document.getElementById('signal-lab-sidebar-toggle'),
            sidebarPanel: document.getElementById('signal-lab-sidebar-panel'),
            status: document.getElementById('signal-lab-status'),
            resolutionWarning: document.getElementById('signal-lab-resolution-warning'),
            patternResolution: document.getElementById('signal-lab-pattern-resolution'),
            scaleMode: document.getElementById('signal-lab-scale-mode'),
            patternCustomWrap: document.getElementById('signal-lab-pattern-custom'),
            patternWidth: document.getElementById('signal-lab-pattern-width'),
            patternHeight: document.getElementById('signal-lab-pattern-height'),
            fullscreenBtn: document.getElementById('signal-lab-fullscreen'),
            popoutBtn: document.getElementById('signal-lab-popout'),
            updatePopoutBtn: document.getElementById('signal-lab-update-popout'),
            popoutFullscreenBtn: document.getElementById('signal-lab-popout-fullscreen'),
            closePopoutBtn: document.getElementById('signal-lab-close-popout'),
            popoutNote: document.getElementById('signal-lab-popout-note'),
            previewPattern: document.getElementById('signal-lab-preview-pattern'),
            previewPatternRes: document.getElementById('signal-lab-preview-pattern-res'),
            previewOutputRes: document.getElementById('signal-lab-preview-output-res'),
            previewDisplayRes: document.getElementById('signal-lab-preview-display-res'),
            previewRefresh: document.getElementById('signal-lab-preview-refresh'),
            outputBadge: document.getElementById('signal-lab-output-badge')
        };
    }

    function getControlUtils() {
        return window.OkamiSignalLab?.ControlUtils;
    }

    function bindEnterToBlur(input) {
        if (!input) {
            return;
        }
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                input.blur();
            }
        });
    }

    function commitModulePatch(moduleId, patch, options = {}) {
        updateOutputState({ moduleId, modulePatch: patch });

        if (options.rebuildControls) {
            buildControlDeck(moduleId);
        }

        if (options.statusMessage) {
            setStatus(options.statusMessage);
        }
    }

    function setResolutionWarning(message) {
        const el = getElements().resolutionWarning;
        if (!el) {
            return;
        }
        if (message) {
            el.hidden = false;
            el.textContent = message;
        } else {
            el.hidden = true;
            el.textContent = '';
        }
    }

    function getRefreshEstimator() {
        if (!refreshEstimator && window.OkamiSignalLab?.DisplayMetrics?.RefreshRateEstimator) {
            refreshEstimator = new window.OkamiSignalLab.DisplayMetrics.RefreshRateEstimator();
        }
        return refreshEstimator;
    }

    function formatPxSize(width, height) {
        if (!width || !height) {
            return '—';
        }
        return `${Math.round(width)} × ${Math.round(height)} px`;
    }

    function getActivePatternLabel(moduleId, state) {
        const registry = window.OkamiSignalLab?.ModuleRegistry;
        const meta = registry?.getModuleById(moduleId);
        const s = state || moduleState[moduleId] || {};

        if (moduleId === 'video-patterns') {
            const catalog = window.OkamiSignalLab?.PATTERN_CATALOG || [];
            return catalog.find((entry) => entry.id === s.patternId)?.label || 'Calibration Pattern';
        }

        if (moduleId === 'motion-patterns') {
            const catalog = window.OkamiSignalLab?.MOTION_CATALOG || [];
            return catalog.find((entry) => entry.id === s.patternId)?.label || 'Motion Pattern';
        }

        if (moduleId === 'sync-tools') {
            const catalog = window.OkamiSignalLab?.MODE_CATALOG || [];
            return catalog.find((entry) => entry.id === s.mode)?.label || 'Sync Tool';
        }

        if (moduleId === 'audio-tools') {
            const catalog = window.OkamiSignalLab?.SOURCE_CATALOG || [];
            return catalog.find((entry) => entry.id === s.sourceId)?.label || 'Audio Source';
        }

        return meta?.label || 'Signal Lab';
    }

    function updatePreviewPatternName() {
        const el = getElements().previewPattern;
        if (el) {
            el.textContent = getActivePatternLabel(activeModuleId, moduleState[activeModuleId]);
        }
    }

    function updatePreviewStats(width, height, patternWidth, patternHeight, timestamp) {
        const els = getElements();
        const metrics = window.OkamiSignalLab?.DisplayMetrics?.collectDisplayMetrics?.() || {};
        const screenW = metrics.screenWidth || window.screen?.width || 0;
        const screenH = metrics.screenHeight || window.screen?.height || 0;

        if (els.previewPatternRes) {
            els.previewPatternRes.textContent = formatPxSize(patternWidth, patternHeight);
        }

        if (els.previewOutputRes) {
            els.previewOutputRes.textContent = formatPxSize(width, height);
        }

        if (els.previewDisplayRes) {
            els.previewDisplayRes.textContent = screenW && screenH
                ? formatPxSize(screenW, screenH)
                : '—';
        }

        if (els.previewRefresh) {
            const estimator = getRefreshEstimator();
            const hz = estimator && timestamp ? estimator.update(timestamp) : 0;
            els.previewRefresh.textContent = hz > 0 ? `~${hz} Hz` : 'Measuring…';
        }
    }

    function updateOutputBadge(forcedState) {
        const badge = getElements().outputBadge;
        if (!badge) {
            return;
        }

        let state = forcedState;
        if (!state) {
            if (document.fullscreenElement) {
                state = 'fullscreen';
            } else if (popoutWindow && !popoutWindow.closed) {
                state = 'popout-connected';
            } else {
                state = 'preview';
            }
        }

        const labels = {
            preview: 'Preview',
            fullscreen: 'Fullscreen',
            'popout-connected': 'Pop-out connected',
            'popout-disconnected': 'Pop-out disconnected'
        };

        badge.dataset.state = state;
        badge.textContent = labels[state] || 'Preview';
    }

    function popoutDebug() {
        return window.OkamiSignalLab?.PopoutDebug;
    }

    function notifyPopoutDisconnected() {
        if (popoutDisconnectTimer) {
            clearTimeout(popoutDisconnectTimer);
        }

        updateOutputBadge('popout-disconnected');
        popoutDisconnectTimer = setTimeout(() => {
            popoutDisconnectTimer = null;
            updateOutputBadge();
        }, 4000);
    }

    function handlePopoutClosed() {
        const wasOpen = hadPopoutWindow || Boolean(popoutWindow);
        popoutWindow = null;
        hadPopoutWindow = false;
        getElements().closePopoutBtn?.setAttribute('hidden', '');
        getElements().updatePopoutBtn?.setAttribute('disabled', '');
        popoutDebug()?.setConnectionStatus(
            popoutDebug()?.STATUS.NOT_OPENED,
            wasOpen ? 'Pop-out window closed' : null
        );

        if (wasOpen) {
            notifyPopoutDisconnected();
        } else {
            updateOutputBadge();
        }
    }

    function watchPopoutWindow() {
        if (popoutWindow && popoutWindow.closed) {
            handlePopoutClosed();
        }
    }

    function getPopoutChannel() {
        if (popoutChannel === null && typeof BroadcastChannel !== 'undefined') {
            try {
                popoutChannel = new BroadcastChannel(POPOUT_SYNC_CHANNEL);
                popoutChannel.onmessage = (event) => handlePopoutMessage(event.data);
            } catch {
                popoutChannel = false;
            }
        }
        return popoutChannel || null;
    }

    function getPreviewTracker() {
        if (!previewTracker && window.OkamiSignalLab?.OutputState) {
            previewTracker = window.OkamiSignalLab.OutputState.createApplyTracker();
        }
        return previewTracker;
    }

    function getCentralOutputState() {
        return {
            activeModuleId,
            moduleState,
            outputSettings
        };
    }

    function getModuleState(moduleId) {
        return moduleState[moduleId] || {};
    }

    function syncRuntimeModuleStateFromEngine() {
        const capture = window.OkamiSignalLab?.OutputState?.captureRuntimeModuleState;
        if (!capture || !engine?.state || !activeModuleId) {
            return;
        }

        moduleState[activeModuleId] = capture(engine.state, moduleState[activeModuleId] || {});
    }

    /**
     * Single write path for toolbar, sidebar, and module controls.
     * Rebuilds outputState, redraws preview, and syncs pop-out.
     */
    function updateOutputState(patch = {}, options = {}) {
        if (patch.outputSettings) {
            Object.assign(outputSettings, patch.outputSettings);
        }

        if (patch.moduleId && patch.modulePatch) {
            moduleState[patch.moduleId] = {
                ...(moduleState[patch.moduleId] || {}),
                ...patch.modulePatch
            };
        }

        if (patch.activeModulePatch) {
            moduleState[activeModuleId] = {
                ...(moduleState[activeModuleId] || {}),
                ...patch.activeModulePatch
            };
        }

        if (!options.skipCommit) {
            commitOutputState(options);
        }
    }

    function rebuildOutputState(requestFullscreen = false) {
        const outputStateApi = window.OkamiSignalLab?.OutputState;
        if (!outputStateApi?.buildOutputState) {
            return null;
        }

        return outputStateApi.buildOutputState({
            activeModuleId,
            moduleState,
            outputSettings,
            requestFullscreen
        });
    }

    /**
     * Single commit path: rebuild outputState, redraw main preview, sync pop-out.
     */
    function commitOutputState(options = {}) {
        if (!engine) {
            return;
        }

        try {
            syncRuntimeModuleStateFromEngine();

            outputState = rebuildOutputState(Boolean(options.requestFullscreen));
            if (!outputState) {
                engine.renderFrame(performance.now());
                return;
            }

            const renderFn = window.OkamiSignalLab?.renderSignalLabCanvas;
            if (renderFn) {
                const animate = renderFn(
                    engine,
                    outputState,
                    performance.now(),
                    getPreviewTracker()
                );
                if (animate) {
                    engine.start();
                } else {
                    engine.stop();
                }
            } else {
                attachModuleToEngine(activeModuleId);
                engine.renderFrame(performance.now());
                if (shouldRunAnimation(activeModuleId)) {
                    engine.start();
                } else {
                    engine.stop();
                }
            }

            window.OkamiSignalLab?.OutputState?.syncPopout?.(outputState);
        } catch (error) {
            console.error('[Okami Signal Lab] Output commit failed:', error);
            getBoundary()?.reportError?.(activeModuleId, 'render', error);
            try {
                attachModuleToEngine(DEFAULT_MODULE_ID);
                engine.renderFrame(performance.now());
            } catch {
                /* last resort */
            }
        }
    }

    function refreshOutput() {
        updateOutputState();
    }

    function applyOutputSettingsToEngine() {
        updateOutputState();
    }

    function sendStateToPopout(requestFullscreen = false) {
        commitOutputState({ requestFullscreen });
        return isPopoutOpen();
    }

    function handlePopoutMessage(data) {
        const MSG = window.OkamiSignalLab?.OutputState?.MSG;
        if (!data || !MSG) {
            return;
        }

        if (data.type === MSG.READY) {
            popoutDebug()?.logReady({ role: 'parent', received: true });
            popoutDebug()?.setConnectionStatus(popoutDebug()?.STATUS.CONNECTED, 'Ready handshake received');
            sendStateToPopout();
            hadPopoutWindow = true;
            getElements().closePopoutBtn?.removeAttribute('hidden');
            getElements().updatePopoutBtn?.removeAttribute('disabled');
            updateOutputBadge('popout-connected');
            setStatus('Pop-out connected.');
            return;
        }

        if (data.type === MSG.CLOSED) {
            handlePopoutClosed();
            setStatus('Pop-out closed.');
        }
    }

    function isPopoutOpen() {
        return Boolean(popoutWindow && !popoutWindow.closed);
    }

    function openPopout(requestFullscreen = false) {
        const run = async () => {
            if (!engine) {
                popoutDebug()?.setConnectionStatus(
                    popoutDebug()?.STATUS.FAILED,
                    'Preview engine not ready'
                );
                setStatus('Preview not ready yet.');
                return;
            }

            const gate = window.OkamiCommercialGate;
            if (gate?.checkPopoutAllowed) {
                const check = await gate.checkPopoutAllowed();
                if (!check.allowed) {
                    popoutDebug()?.setConnectionStatus(
                        popoutDebug()?.STATUS.FAILED,
                        check.reason || 'License required'
                    );
                    gate.showUpgradeNotice?.('Live pop-out sync requires a Professional license.');
                    setStatus('Premium feature — license required.');
                    return;
                }
            }

            getPopoutChannel();

            if (isPopoutOpen()) {
                popoutWindow.focus();
                if (sendStateToPopout(requestFullscreen)) {
                    setStatus(requestFullscreen
                        ? 'Pop-out updated (fullscreen requested).'
                        : 'Pop-out updated with current pattern.');
                }
                return;
            }

            const url = new URL('signal-lab-output.html', window.location.href);
            if (requestFullscreen) {
                url.searchParams.set('fullscreen', '1');
            }

            popoutWindow = window.open(
                url.href,
                'okami-signal-lab-output',
                'width=960,height=540,resizable=yes,scrollbars=no'
            );

            if (!popoutWindow) {
                popoutDebug()?.setConnectionStatus(
                    popoutDebug()?.STATUS.FAILED,
                    'Pop-up blocked by browser'
                );
                setStatus('Pop-up blocked. Allow pop-ups for this site.');
                return;
            }

            popoutDebug()?.logWindowOpened({ url: url.href, requestFullscreen: Boolean(requestFullscreen) });

            hadPopoutWindow = true;
            getElements().closePopoutBtn?.removeAttribute('hidden');
            updateOutputBadge('popout-connected');
            setStatus('Pop-out opened. Waiting for output window…');
        };

        void run();
    }

    function updatePopout() {
        const run = async () => {
            const gate = window.OkamiCommercialGate;
            if (gate?.checkPopoutAllowed) {
                const check = await gate.checkPopoutAllowed();
                if (!check.allowed) {
                    gate.showUpgradeNotice?.('Live pop-out sync requires a Professional license.');
                    setStatus('Premium feature — license required.');
                    return;
                }
            }

            if (!isPopoutOpen()) {
                setStatus('Open a pop-out window first.');
                return;
            }

            if (sendStateToPopout()) {
                setStatus('Pop-out updated with current pattern and resolution.');
            } else {
                setStatus('Could not send output to pop-out.');
            }
        };

        void run();
    }

    function shouldRunAnimation(moduleId) {
        const renderer = window.OkamiSignalLab?.ModuleRegistry?.getRenderer(moduleId);
        const shouldAnimate = window.OkamiSignalLab?.ModuleAnimation?.shouldAnimateModule;
        return shouldAnimate ? shouldAnimate(renderer, moduleState[moduleId] || {}) : false;
    }

    function syncRangePair(rangeInput, numberInput, control, moduleId, commitOnly) {
        const utils = getControlUtils();
        if (!utils || !control) {
            return;
        }

        const applyFromRange = (raw) => {
            const value = utils.clampNumber(raw, control.min, control.max, control.step);
            rangeInput.value = value;
            numberInput.value = utils.rangeToDisplay(value, control);
            handleControlChange(moduleId, control.key, value, control);
        };

        const applyFromNumber = () => {
            const displayVal = utils.clampNumber(
                numberInput.value,
                utils.rangeToDisplay(control.min, control),
                utils.rangeToDisplay(control.max, control),
                utils.isPercentRangeControl(control) ? utils.rangeToDisplay(control.step, control) : control.step
            );
            const value = utils.displayToRange(displayVal, control);
            rangeInput.value = value;
            numberInput.value = utils.rangeToDisplay(value, control);
            handleControlChange(moduleId, control.key, value, control);
        };

        rangeInput.addEventListener('input', () => applyFromRange(parseFloat(rangeInput.value)));

        if (commitOnly) {
            bindEnterToBlur(numberInput);
            numberInput.addEventListener('blur', applyFromNumber);
        } else {
            numberInput.addEventListener('change', applyFromNumber);
        }
    }

    function setStatus(message) {
        const el = getElements().status;
        if (el) {
            el.textContent = message;
        }
    }

    function updateModuleState(moduleId, patch) {
        moduleState[moduleId] = { ...(moduleState[moduleId] || {}), ...patch };
    }

    function getExportContext() {
        const central = getCentralOutputState();
        return {
            getModuleState: () => ({ ...central.moduleState }),
            getDisplaySize: () => engine?.getDisplaySize?.() ?? { width: 1920, height: 1080 },
            getOutputSettings: () => ({ ...central.outputSettings }),
            activeModuleId: central.activeModuleId,
            setStatus
        };
    }

    function updateExportPreviewContext(moduleId) {
        if (moduleId !== 'export') {
            return;
        }
        const renderer = window.OkamiSignalLab?.ModuleRegistry?.getRenderer('export');
        if (typeof renderer?.setPreviewContext === 'function') {
            renderer.setPreviewContext(getExportContext());
        }
    }

    function handleControlChange(moduleId, key, value, control) {
        const registry = window.OkamiSignalLab?.ModuleRegistry;

        try {
            if (moduleId === '__background__') {
                const patch = { [key]: value };
                if (key === 'backgroundType' && value === 'none') {
                    patch.backgroundEnabled = false;
                }
                if (key === 'backgroundEnabled' && value && (outputSettings.backgroundType === 'none' || !outputSettings.backgroundType)) {
                    patch.backgroundType = 'technical-grid';
                }
                updateOutputState({ outputSettings: patch });
                if (key === 'backgroundEnabled' || key === 'backgroundType') {
                    buildControlDeck(activeModuleId);
                }
                return;
            }

            updateOutputState({ moduleId, modulePatch: { [key]: value } });
            updateExportPreviewContext(moduleId);
            updatePreviewPatternName();

            if (key === 'patternId' || key === 'mode' || key === 'sourceId'
                || key === 'backgroundEnabled' || key === 'backgroundType'
                || key === 'randomPreset' || key === 'randomMotionType' || key === 'randomColorMode'
                || window.OkamiSignalLab?.ControlUI?.shouldRebuildOptions(key)) {
                buildControlDeck(moduleId);
            }

            if (control?.type === 'transport') {
                setStatus(value ? (control.startLabel || 'Playing') : (control.stopLabel || 'Paused'));
                return;
            }

            const label = control?.label || key;
            setStatus(`${registry?.getModuleById(moduleId)?.label || moduleId}: ${label} updated`);
        } catch (error) {
            getBoundary()?.reportError?.(moduleId, 'state', error);
        }
    }

    function bindModuleControlEvents(container, schema, moduleId) {
        const schemaKeys = new Set(schema.map((control) => control.key));
        const belongsToSchema = (element) => schemaKeys.has(element.dataset.controlKey);

        container.querySelectorAll('[data-control-type="select"]').forEach((input) => {
            if (!belongsToSchema(input)) {
                return;
            }
            input.addEventListener('change', () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                handleControlChange(moduleId, input.dataset.controlKey, input.value, control);
            });
        });

        container.querySelectorAll('[data-control-type="range"]').forEach((input) => {
            if (!belongsToSchema(input)) {
                return;
            }
            const control = schema.find((c) => c.key === input.dataset.controlKey);
            const numberInput = container.querySelector(`#sl-ctrl-num-${input.dataset.controlKey}`);
            if (numberInput && control) {
                syncRangePair(input, numberInput, control, moduleId, true);
            }
        });

        container.querySelectorAll('[data-control-type="text"]').forEach((input) => {
            if (!belongsToSchema(input)) {
                return;
            }
            input.addEventListener('input', () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                handleControlChange(moduleId, input.dataset.controlKey, input.value, control);
            });
        });

        container.querySelectorAll('[data-control-type="file-upload"]').forEach((input) => {
            if (!belongsToSchema(input)) {
                return;
            }
            input.addEventListener('change', () => {
                const file = input.files?.[0];
                if (!file) {
                    return;
                }
                if (!file.type.startsWith('image/')) {
                    setStatus('Please select an image file (PNG, JPG, SVG, etc.).');
                    input.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    const key = input.dataset.controlKey;
                    const patch = { [key]: reader.result };
                    if (key === 'logoDataUrl') {
                        patch.logoEnabled = true;
                    }
                    if (key === 'logoWatermarkDataUrl') {
                        patch.logoWatermarkEnabled = true;
                    }
                    commitModulePatch(moduleId, patch, {
                        notifyKey: key,
                        rebuildControls: true,
                        statusMessage: 'Image uploaded.'
                    });
                };
                reader.readAsDataURL(file);
            });
        });

        container.querySelectorAll('[data-clear-upload]').forEach((btn) => {
            if (!belongsToSchema(btn)) {
                return;
            }
            btn.addEventListener('click', () => {
                const key = btn.dataset.controlKey;
                const patch = { [key]: '' };
                if (key === 'logoDataUrl') {
                    patch.logoEnabled = false;
                }
                if (key === 'logoWatermarkDataUrl') {
                    patch.logoWatermarkEnabled = false;
                }
                commitModulePatch(moduleId, patch, {
                    notifyKey: key,
                    rebuildControls: true,
                    statusMessage: 'Image removed.'
                });
            });
        });

        container.querySelectorAll('[data-control-type="number"]').forEach((input) => {
            if (!belongsToSchema(input)) {
                return;
            }
            const applyNumber = () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                const utils = getControlUtils();
                const min = control?.min ?? 0;
                const max = control?.max ?? 999999;
                const step = control?.step || 1;
                const raw = parseFloat(input.value);
                const value = utils
                    ? utils.clampNumber(raw, min, max, step)
                    : (Number.isFinite(raw) ? raw : min);
                input.value = value;
                handleControlChange(moduleId, input.dataset.controlKey, value, control);
            };
            bindEnterToBlur(input);
            input.addEventListener('blur', applyNumber);
        });

        container.querySelectorAll('[data-control-type="action"]').forEach((btn) => {
            if (!belongsToSchema(btn)) {
                return;
            }
            btn.addEventListener('click', async () => {
                const control = schema.find((c) => c.key === btn.dataset.controlKey);
                const renderer = window.OkamiSignalLab?.ModuleRegistry?.getRenderer(moduleId);
                if (typeof renderer?.handleAction !== 'function') {
                    return;
                }

                btn.disabled = true;
                try {
                    await renderer.handleAction(btn.dataset.controlKey, getExportContext(), getModuleState(moduleId));
                } catch (error) {
                    getBoundary()?.reportError?.(moduleId, 'action', error);
                } finally {
                    btn.disabled = false;
                    updateExportPreviewContext(moduleId);
                    refreshOutput();
                }
            });
        });

        container.querySelectorAll('[data-control-type="checkbox"]').forEach((input) => {
            if (!belongsToSchema(input)) {
                return;
            }
            input.addEventListener('change', () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                handleControlChange(moduleId, input.dataset.controlKey, input.checked, control);
            });
        });

        container.querySelectorAll('.signal-lab-transport-btn').forEach((btn) => {
            const transportKey = btn.dataset.controlKey || 'playing';
            if (!schemaKeys.has(transportKey)) {
                return;
            }
            btn.addEventListener('click', () => {
                if (btn.disabled) {
                    return;
                }
                const value = btn.dataset.controlValue === 'true';
                const control = schema.find((c) => c.key === transportKey);
                handleControlChange(moduleId, transportKey, value, control);

                container.querySelectorAll(`.signal-lab-transport-btn[data-control-key="${transportKey}"]`).forEach((b) => {
                    const active = b.dataset.controlValue === String(value);
                    b.classList.toggle('is-active', active);
                    b.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
            });
        });

        container.querySelectorAll('[data-control-type="radio"]').forEach((input) => {
            if (!belongsToSchema(input)) {
                return;
            }
            input.addEventListener('change', () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                handleControlChange(moduleId, input.dataset.controlKey, input.value, control);
            });
        });
    }

    function renderPatternCardStatic() {
        return `
            <div class="signal-lab-card-field signal-lab-card-field--select">
                <label class="signal-lab-label" for="signal-lab-module-select">Module</label>
                <div class="signal-lab-card-field__body">
                    <select id="signal-lab-module-select" class="signal-lab-select signal-lab-field signal-lab-module-select"
                        aria-label="Signal Lab module"></select>
                </div>
            </div>
        `;
    }

    function renderDisplayCardStatic() {
        return `
            <div class="signal-lab-card-field signal-lab-card-field--select">
                <label class="signal-lab-label" for="signal-lab-pattern-resolution">Pattern Resolution</label>
                <div class="signal-lab-card-field__body">
                    <select id="signal-lab-pattern-resolution" class="signal-lab-select signal-lab-field"
                        aria-label="Pattern resolution"></select>
                </div>
            </div>
            <div id="signal-lab-pattern-custom" class="signal-lab-pattern-custom" hidden>
                <div class="signal-lab-card-field signal-lab-card-field--number">
                    <label class="signal-lab-label" for="signal-lab-pattern-width">Pattern Width</label>
                    <div class="signal-lab-card-field__body">
                        <div class="signal-lab-value-field">
                            <input type="number" id="signal-lab-pattern-width" class="signal-lab-number-input signal-lab-field"
                                min="64" max="16384" step="1" value="1920" aria-label="Pattern width">
                            <span class="signal-lab-field-unit">px</span>
                        </div>
                    </div>
                </div>
                <div class="signal-lab-card-field signal-lab-card-field--number">
                    <label class="signal-lab-label" for="signal-lab-pattern-height">Pattern Height</label>
                    <div class="signal-lab-card-field__body">
                        <div class="signal-lab-value-field">
                            <input type="number" id="signal-lab-pattern-height" class="signal-lab-number-input signal-lab-field"
                                min="64" max="16384" step="1" value="1080" aria-label="Pattern height">
                            <span class="signal-lab-field-unit">px</span>
                        </div>
                    </div>
                </div>
            </div>
            <p id="signal-lab-resolution-warning" class="signal-lab-resolution-warning" hidden></p>
            <div class="signal-lab-card-field signal-lab-card-field--select">
                <label class="signal-lab-label" for="signal-lab-scale-mode">Scale Mode</label>
                <div class="signal-lab-card-field__body">
                    <select id="signal-lab-scale-mode" class="signal-lab-select signal-lab-field" aria-label="Scale mode">
                        <option value="fit">Fit (letterbox)</option>
                        <option value="stretch">Stretch</option>
                    </select>
                </div>
            </div>
        `;
    }

    function renderOutputCardStatic() {
        return '';
    }

    function getStaticDeckFragments() {
        return {
            pattern: renderPatternCardStatic(),
            display: renderDisplayCardStatic(),
            output: renderOutputCardStatic()
        };
    }

    const MOBILE_DECK_MQ = window.matchMedia('(max-width: 767px)');
    const TABLET_DECK_MQ = window.matchMedia('(max-width: 1199px)');

    function bindMobileDeckAccordion(container) {
        if (!container) {
            return;
        }

        container.querySelectorAll('.signal-lab-card').forEach((card) => {
            if (!card.dataset.accordionBound) {
                card.dataset.accordionBound = 'true';
                card.addEventListener('toggle', () => {
                    if (!MOBILE_DECK_MQ.matches || !card.open) {
                        return;
                    }
                    container.querySelectorAll('.signal-lab-card').forEach((other) => {
                        if (other !== card) {
                            other.removeAttribute('open');
                        }
                    });
                });
            }
        });
    }

    function applyDeckOpenState(container) {
        if (!container) {
            return;
        }

        container.querySelectorAll('.signal-lab-card').forEach((card) => {
            if (MOBILE_DECK_MQ.matches) {
                if (!card.dataset.mobileTouched) {
                    card.dataset.mobileTouched = 'true';
                    if (card.dataset.card === 'pattern') {
                        card.setAttribute('open', '');
                    } else {
                        card.removeAttribute('open');
                    }
                }
            } else {
                delete card.dataset.mobileTouched;
                const defaults = window.OkamiSignalLab?.ControlUI?.DECK_CARD_ORDER || ['pattern', 'motion', 'display'];
                if (defaults.includes(card.dataset.card)) {
                    card.setAttribute('open', '');
                }
            }
        });
    }

    function initResponsiveLayout() {
        const els = getElements();
        if (!els.layout || els.layout.dataset.responsiveBound === 'true') {
            return;
        }

        els.layout.dataset.responsiveBound = 'true';

        const applySidebarMode = () => {
            const sidebar = els.sidebar;
            const toggle = els.sidebarToggle;
            if (!sidebar || !toggle) {
                return;
            }

            if (TABLET_DECK_MQ.matches) {
                sidebar.classList.add('is-collapsible');
                const open = toggle.getAttribute('aria-expanded') === 'true';
                sidebar.classList.toggle('is-open', open);
            } else {
                sidebar.classList.remove('is-collapsible', 'is-open');
                toggle.setAttribute('aria-expanded', 'true');
            }
        };

        els.sidebarToggle?.addEventListener('click', () => {
            const toggle = els.sidebarToggle;
            const sidebar = els.sidebar;
            if (!toggle || !sidebar) {
                return;
            }
            const open = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            sidebar.classList.toggle('is-open', open);
        });

        const onViewportChange = () => {
            applySidebarMode();
            applyDeckOpenState(els.controlDeck);
            refreshPreviewLayout();
        };

        TABLET_DECK_MQ.addEventListener('change', onViewportChange);
        MOBILE_DECK_MQ.addEventListener('change', onViewportChange);
        applySidebarMode();
    }

    function syncStaticDeckFields() {
        const els = getElements();
        const presets = window.OkamiSignalLab?.PatternResolution?.PRESETS || [];

        if (els.patternResolution) {
            const current = els.patternResolution.value;
            els.patternResolution.innerHTML = presets.map((preset) => `
                <option value="${preset.id}"${outputSettings.patternResolution === preset.id ? ' selected' : ''}>${preset.label}</option>
            `).join('');
            if (current && Array.from(els.patternResolution.options).some((opt) => opt.value === current)) {
                els.patternResolution.value = current;
            }
        }

        if (els.scaleMode) {
            els.scaleMode.value = outputSettings.scaleMode || 'fit';
        }

        if (els.patternCustomWrap) {
            els.patternCustomWrap.hidden = outputSettings.patternResolution !== 'custom';
        }

        [els.patternWidth, els.patternHeight].forEach((input) => {
            if (!input) {
                return;
            }
            const key = input.id.includes('width') ? 'patternWidth' : 'patternHeight';
            input.value = outputSettings[key] ?? input.value;
        });
    }

    function bindDeckControlLayers(container, layers) {
        if (!container) {
            return;
        }

        const controlUI = window.OkamiSignalLab?.ControlUI;
        layers.filter((layer) => layer.schema.length).forEach((layer) => {
            const flat = controlUI.flattenDeckLayers([layer]).map((entry) => entry.control);
            bindModuleControlEvents(container, flat, layer.moduleId);
        });
    }

    function buildControlDeck(moduleId = activeModuleId) {
        const container = getElements().controlDeck;
        const outputContainer = getElements().outputControls;
        const controlUI = window.OkamiSignalLab?.ControlUI;
        const registry = window.OkamiSignalLab?.ModuleRegistry;
        const boundary = getBoundary();

        if (!container || !controlUI) {
            return;
        }

        const backgroundSchema = window.OkamiSignalLab?.BackgroundControls?.getBackgroundControlSchema?.() || [];
        const renderer = registry?.getRenderer(moduleId);
        const state = getModuleState(moduleId);

        try {
            let moduleSchema = [];
            if (renderer) {
                moduleSchema = renderer.getControlSchema?.(state)
                    || renderer.getControlSchema?.()
                    || [];
            }

            const layers = [
                { schema: backgroundSchema, state: outputSettings, moduleId: '__background__' },
                { schema: moduleSchema, state, moduleId }
            ];
            const staticCards = getStaticDeckFragments();

            container.innerHTML = controlUI.buildControlDeckHtml(layers, staticCards);
            container.hidden = !container.innerHTML.trim();

            if (outputContainer) {
                outputContainer.innerHTML = controlUI.buildOutputPanelHtml(layers, staticCards);
                outputContainer.hidden = !outputContainer.innerHTML.trim();
            }

            bindDeckControlLayers(container, layers);
            bindDeckControlLayers(outputContainer, layers);

            renderModuleDropdown();
            syncModuleDropdownValue(moduleId);
            syncStaticDeckFields();

            if (moduleId === activeModuleId) {
                clearModuleError();
            }

            bindMobileDeckAccordion(container);
            applyDeckOpenState(container);
        } catch (error) {
            boundary?.reportError?.(moduleId, 'controls', error);
        }
    }

    function buildBackgroundToolbar() {
        buildControlDeck(activeModuleId);
    }

    function buildModuleOptions(moduleId) {
        buildControlDeck(moduleId);
    }

    function selectModule(moduleId, searchPatch = null) {
        const registry = getRegistry();
        let rendererId = resolveModuleId(moduleId);
        let meta = registry?.getModuleById(rendererId);

        if (!meta || meta.status !== 'active') {
            rendererId = DEFAULT_MODULE_ID;
            meta = registry?.getModuleById(rendererId);
        }

        if (!meta || meta.status !== 'active') {
            showModuleError('No active modules are registered. Check script loading.');
            return;
        }

        activeModuleId = rendererId;
        previewTracker = null;

        const renderer = registry.getRenderer(rendererId);
        if (renderer?.defaultState && !moduleState[rendererId]) {
            moduleState[rendererId] = { ...renderer.defaultState };
        }

        if (searchPatch && typeof searchPatch === 'object') {
            updateOutputState({ moduleId: rendererId, modulePatch: searchPatch }, { skipCommit: true });
        }

        if (!attachModuleToEngine(rendererId)) {
            showModuleError(formatModuleLoadError(rendererId));
            showModulePanelError(rendererId);
            if (rendererId !== DEFAULT_MODULE_ID) {
                selectModule(DEFAULT_MODULE_ID);
            }
            return;
        }

        clearModuleError();
        syncModuleDropdownValue(rendererId);
        buildModuleOptions(rendererId);
        updateExportPreviewContext(rendererId);
        updatePreviewPatternName();
        updateOutputBadge();
        commitOutputState();
        setStatus(searchPatch
            ? `Active: ${meta.label} (search match applied)`
            : `Active: ${meta.label}`);
    }

    function getVisibleModuleOptions() {
        const sidebar = getRegistry()?.getSidebarModules?.() || [];
        return sidebar.map((entry) => ({
            moduleId: entry.id,
            rendererId: entry.rendererId,
            label: entry.label,
            statePatch: null
        }));
    }

    function syncModuleDropdownValue(rendererId) {
        const select = getElements().moduleSelect;
        if (!select || !rendererId) {
            return;
        }
        const publicId = getRegistry()?.getPublicModuleId?.(rendererId) || rendererId;
        const hasOption = Array.from(select.options).some((opt) => opt.value === publicId);
        if (hasOption) {
            select.value = publicId;
        }
    }

    function renderModuleDropdown() {
        const select = getElements().moduleSelect;
        if (!select) {
            return;
        }

        const visible = getVisibleModuleOptions();

        select.innerHTML = visible.map((entry) => {
            const patchAttr = entry.statePatch
                ? ` data-state-patch="${encodeURIComponent(JSON.stringify(entry.statePatch))}"`
                : '';
            return `<option value="${entry.moduleId}" data-renderer-id="${entry.rendererId}"${patchAttr}>${entry.label}</option>`;
        }).join('');

        select.disabled = visible.length === 0;
        if (visible.length === 0) {
            showModuleError('Module list is empty. Registry did not load.');
            return;
        }

        const publicId = getRegistry()?.getPublicModuleId?.(activeModuleId) || visible[0].moduleId;
        if (visible.some((entry) => entry.moduleId === publicId)) {
            select.value = publicId;
        } else {
            select.selectedIndex = 0;
            activeModuleId = visible[0].rendererId;
        }
    }

    function applyModuleSelectionFromDropdown() {
        const select = getElements().moduleSelect;
        if (!select || select.disabled || !select.value) {
            return;
        }

        const option = select.selectedOptions[0];
        let searchPatch = null;
        if (option?.dataset.statePatch) {
            try {
                searchPatch = JSON.parse(decodeURIComponent(option.dataset.statePatch));
            } catch {
                searchPatch = null;
            }
        }

        selectModule(select.value, searchPatch);
    }

    function ensureDefaultModule() {
        const registry = getRegistry();
        if (!registry?.getRenderer?.(DEFAULT_MODULE_ID)) {
            showModuleError('Video Patterns module is not registered. Reload the page.');
            return;
        }
        if (!registry.getRenderer(activeModuleId)) {
            activeModuleId = DEFAULT_MODULE_ID;
        }
    }

    function openPopoutFullscreen() {
        openPopout(true);
    }

    function bindPopoutSync() {
        getPopoutChannel();

        window.OkamiSignalLab?.OutputState?.configurePopoutSync?.({
            isOpen: isPopoutOpen,
            getOrigin: () => window.location.origin,
            getPopoutWindow: () => popoutWindow,
            getBroadcastChannel: getPopoutChannel,
            debug: popoutDebug
        });

        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) {
                return;
            }
            handlePopoutMessage(event.data);
        });
    }

    function toggleFullscreen() {
        const stage = getElements().stage;
        if (!stage) {
            return;
        }

        if (!document.fullscreenElement) {
            stage.requestFullscreen?.().catch(() => {
                setStatus('Fullscreen not available in this browser.');
            });
        } else {
            document.exitFullscreen?.();
        }
    }

    function initOutputSettingsUI() {
        const deck = getElements().controlDeck;
        if (!deck || deck.dataset.staticBound === 'true') {
            syncStaticDeckFields();
            return;
        }

        deck.dataset.staticBound = 'true';

        const applyCustomPatternSize = () => {
            const els = getElements();
            const utils = getControlUtils();
            const patternWidth = utils
                ? utils.clampNumber(els.patternWidth?.value, 64, 16384, 1)
                : parseInt(els.patternWidth?.value, 10) || 1920;
            const patternHeight = utils
                ? utils.clampNumber(els.patternHeight?.value, 64, 16384, 1)
                : parseInt(els.patternHeight?.value, 10) || 1080;

            updateOutputState({
                outputSettings: { patternWidth, patternHeight }
            });

            if (els.patternWidth) {
                els.patternWidth.value = outputSettings.patternWidth;
            }
            if (els.patternHeight) {
                els.patternHeight.value = outputSettings.patternHeight;
            }
        };

        deck.addEventListener('change', (event) => {
            const target = event.target;
            const els = getElements();

            if (target.id === 'signal-lab-pattern-resolution') {
                updateOutputState({
                    outputSettings: { patternResolution: target.value }
                });
                if (els.patternCustomWrap) {
                    els.patternCustomWrap.hidden = outputSettings.patternResolution !== 'custom';
                }
                return;
            }

            if (target.id === 'signal-lab-scale-mode') {
                updateOutputState({
                    outputSettings: {
                        scaleMode: target.value === 'stretch' ? 'stretch' : 'fit'
                    }
                });
            }
        });

        deck.addEventListener('blur', (event) => {
            const target = event.target;
            if (target.id === 'signal-lab-pattern-width' || target.id === 'signal-lab-pattern-height') {
                applyCustomPatternSize();
            }
        }, true);

        deck.addEventListener('keydown', (event) => {
            const target = event.target;
            if (event.key !== 'Enter') {
                return;
            }
            if (target.id === 'signal-lab-pattern-width' || target.id === 'signal-lab-pattern-height') {
                event.preventDefault();
                target.blur();
            }
        });

        syncStaticDeckFields();
    }

    function initEngine() {
        const { canvas, canvasWrap } = getElements();
        if (!canvas || !window.OkamiSignalLab?.RenderEngine) {
            return;
        }

        engine = new window.OkamiSignalLab.RenderEngine(canvas, {
            container: canvasWrap || canvas.parentElement,
            backgroundColor: '#050505',
            outputSettings: { ...outputSettings },
            onFrame: (metrics) => {
                watchPopoutWindow();
                updatePreviewStats(
                    metrics.wrapperWidth || metrics.width,
                    metrics.wrapperHeight || metrics.height,
                    metrics.patternWidth,
                    metrics.patternHeight,
                    metrics.timestamp
                );
                updatePreviewScaleDebug(metrics);
            },
            onPatternMismatch: (warning) => setResolutionWarning(warning)
        });

        selectModule(activeModuleId);
    }

    function bindEvents() {
        const els = getElements();
        const root = els.app || els.layout || document;

        root.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button?.id) {
                return;
            }

            switch (button.id) {
                case 'signal-lab-fullscreen':
                    toggleFullscreen();
                    break;
                case 'signal-lab-popout':
                    popoutDebug()?.logButtonClicked({ action: 'pop-out' });
                    openPopout(false);
                    break;
                case 'signal-lab-update-popout':
                    popoutDebug()?.logButtonClicked({ action: 'update-pop-out' });
                    updatePopout();
                    break;
                case 'signal-lab-popout-fullscreen':
                    popoutDebug()?.logButtonClicked({ action: 'pop-out-fullscreen' });
                    openPopoutFullscreen();
                    break;
                case 'signal-lab-close-popout':
                    if (isPopoutOpen()) {
                        popoutWindow.close();
                    }
                    handlePopoutClosed();
                    setStatus('Pop-out closed.');
                    break;
                default:
                    break;
            }
        });

        const deck = els.controlDeck;
        deck?.addEventListener('change', (event) => {
            if (event.target.id === 'signal-lab-module-select') {
                applyModuleSelectionFromDropdown();
            }
        });

        document.addEventListener('fullscreenchange', () => {
            els.stage?.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement));
            updateOutputBadge();
            refreshOutput();
        });
    }

    function initSignalLab() {
        if (!document.getElementById('signal-lab-app')) {
            return;
        }

        if (engine) {
            engine.destroy();
            engine = null;
        }
        previewTracker = null;
        outputState = null;

        window.OkamiSiteLayout?.init?.();
        refreshPreviewLayout();
        initModuleErrorReporting();
        initResponsiveLayout();
        ensureDefaultModule();
        initEngine();

        if (!initialized) {
            initOutputSettingsUI();
            bindPopoutSync();
            bindEvents();
            initialized = true;
        } else {
            initOutputSettingsUI();
            refreshPreviewLayout();
        }

        setStatus('Signal Lab ready.');
        initPreviewScaleDebug();
        updatePreviewPatternName();
        updateOutputBadge();
        popoutDebug()?.setConnectionStatus(popoutDebug()?.STATUS.NOT_OPENED);

        void window.OkamiCommercialGate?.initForProduct?.('okami-signal-lab');
        void window.OkamiDesktopShell?.initDesktopShell?.({ productId: 'okami-signal-lab' });
    }

    window.initSignalLab = initSignalLab;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSignalLab);
    } else {
        initSignalLab();
    }
})();
