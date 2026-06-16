(function() {
    'use strict';

    function refreshPreviewLayout() {
        window.OkamiSiteLayout?.refreshLayout?.();
    }

    /** Temporary scaling debug — set false or use ?debugScale=0 to hide. ?debugScale=1 forces on. */
    const PREVIEW_SCALE_DEBUG_DEFAULT = true;

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
    let activeModuleId = 'video-patterns';
    let initialized = false;
    let moduleSearchIndex = null;
    let currentSearchQuery = '';
    let refreshEstimator = null;
    let popoutDisconnectTimer = null;
    let hadPopoutWindow = false;
    const outputSettings = {
        patternResolution: 'auto',
        patternWidth: 1920,
        patternHeight: 1080,
        selectedScreenId: '',
        scaleMode: 'fit'
    };
    const moduleState = {
        welcome: {},
        'video-patterns': { patternId: 'okami-calibration', motionPlaying: true, lineThickness: 2, gridSize: 64 },
        'motion-patterns': {
            patternId: 'bouncing-ball',
            playing: true,
            speed: 1,
            reverse: false,
            motionSize: 1
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
            logoWatermarkSize: 12
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
            canvas: document.getElementById('signal-lab-canvas'),
            canvasWrap: document.getElementById('signal-lab-canvas-wrap'),
            stage: document.getElementById('signal-lab-stage'),
            moduleList: document.getElementById('signal-lab-module-list'),
            moduleSearch: document.getElementById('signal-lab-search'),
            moduleSearchStatus: document.getElementById('signal-lab-search-status'),
            moduleOptions: document.getElementById('signal-lab-module-options'),
            status: document.getElementById('signal-lab-status'),
            resolutionWarning: document.getElementById('signal-lab-resolution-warning'),
            patternResolution: document.getElementById('signal-lab-pattern-resolution'),
            scaleMode: document.getElementById('signal-lab-scale-mode'),
            patternCustomWrap: document.getElementById('signal-lab-pattern-custom'),
            patternWidth: document.getElementById('signal-lab-pattern-width'),
            patternHeight: document.getElementById('signal-lab-pattern-height'),
            moduleTitle: document.getElementById('signal-lab-module-title'),
            moduleDesc: document.getElementById('signal-lab-module-desc'),
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
        updateModuleState(moduleId, patch);
        applyEngineState(moduleId);

        const renderer = window.OkamiSignalLab?.ModuleRegistry?.getRenderer(moduleId);
        if (engine && typeof renderer?.onStateChange === 'function' && options.notifyKey) {
            renderer.onStateChange(engine, moduleState[moduleId], options.notifyKey);
        }

        refreshOutput();

        if (options.rebuildControls) {
            buildModuleOptions(moduleId);
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

    function buildPopoutOutputState(requestFullscreen = false) {
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

    function sendStateToPopout(requestFullscreen = false) {
        const outputStateApi = window.OkamiSignalLab?.OutputState;
        if (!outputStateApi?.MSG) {
            return false;
        }

        refreshOutput();

        const state = buildPopoutOutputState(requestFullscreen);
        if (!state) {
            return false;
        }

        const payload = { type: outputStateApi.MSG.STATE, state };
        let delivered = false;

        if (popoutWindow && !popoutWindow.closed) {
            try {
                popoutWindow.postMessage(payload, window.location.origin);
                delivered = true;
            } catch {
                /* ignore */
            }
        }

        try {
            getPopoutChannel()?.postMessage(payload);
            delivered = true;
        } catch {
            /* ignore */
        }

        return delivered;
    }

    function handlePopoutMessage(data) {
        const MSG = window.OkamiSignalLab?.OutputState?.MSG;
        if (!data || !MSG) {
            return;
        }

        if (data.type === MSG.READY) {
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
        if (!engine) {
            setStatus('Preview not ready yet.');
            return;
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
            setStatus('Pop-up blocked. Allow pop-ups for this site.');
            return;
        }

        hadPopoutWindow = true;
        getElements().closePopoutBtn?.removeAttribute('hidden');
        updateOutputBadge('popout-connected');
        setStatus('Pop-out opened. Waiting for output window…');
    }

    function updatePopout() {
        if (!isPopoutOpen()) {
            setStatus('Open a pop-out window first.');
            return;
        }

        if (sendStateToPopout()) {
            setStatus('Pop-out updated with current pattern and resolution.');
        } else {
            setStatus('Could not send output to pop-out.');
        }
    }

    function applyOutputSettingsToEngine() {
        if (engine) {
            engine.setOutputSettings({ ...outputSettings });
        }
    }

    function shouldRunAnimation(moduleId) {
        const renderer = window.OkamiSignalLab?.ModuleRegistry?.getRenderer(moduleId);
        const shouldAnimate = window.OkamiSignalLab?.ModuleAnimation?.shouldAnimateModule;
        return shouldAnimate ? shouldAnimate(renderer, moduleState[moduleId] || {}) : false;
    }

    function refreshOutput() {
        if (!engine) {
            return;
        }

        engine.renderFrame(performance.now());

        if (shouldRunAnimation(activeModuleId)) {
            engine.start();
        } else {
            engine.stop();
        }
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

    function applyEngineState(moduleId) {
        if (!engine) {
            return;
        }
        const saved = moduleState[moduleId];
        if (saved && Object.keys(saved).length) {
            engine.setState({ ...saved });
        }
    }

    function updateModuleState(moduleId, patch) {
        moduleState[moduleId] = { ...(moduleState[moduleId] || {}), ...patch };
    }

    function getExportContext() {
        return {
            getModuleState: () => ({ ...moduleState }),
            getDisplaySize: () => engine?.getDisplaySize?.() ?? { width: 1920, height: 1080 },
            activeModuleId,
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
        updateModuleState(moduleId, { [key]: value });
        applyEngineState(moduleId);

        const renderer = registry?.getRenderer(moduleId);
        if (key === 'patternId' && renderer && engine) {
            if (typeof renderer.onAttach === 'function') {
                renderer.onAttach(engine);
            }
        }

        if (engine && typeof renderer?.onStateChange === 'function') {
            renderer.onStateChange(engine, moduleState[moduleId], key);
        }

        updateExportPreviewContext(moduleId);
        refreshOutput();
        updatePreviewPatternName();

        if (key === 'patternId' || key === 'mode' || key === 'sourceId'
            || window.OkamiSignalLab?.ControlUI?.shouldRebuildOptions(key)) {
            buildModuleOptions(moduleId);
        }

        if (control?.type === 'transport') {
            setStatus(value ? (control.startLabel || 'Playing') : (control.stopLabel || 'Paused'));
            return;
        }

        const label = control?.label || key;
        setStatus(`${registry?.getModuleById(moduleId)?.label || moduleId}: ${label} updated`);
    }

    function bindModuleControlEvents(container, schema, moduleId) {
        container.querySelectorAll('[data-control-type="select"]').forEach((input) => {
            input.addEventListener('change', () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                handleControlChange(moduleId, input.dataset.controlKey, input.value, control);
            });
        });

        container.querySelectorAll('[data-control-type="range"]').forEach((input) => {
            const control = schema.find((c) => c.key === input.dataset.controlKey);
            const numberInput = container.querySelector(`#sl-ctrl-num-${input.dataset.controlKey}`);
            if (numberInput && control) {
                syncRangePair(input, numberInput, control, moduleId, true);
            }
        });

        container.querySelectorAll('[data-control-type="text"]').forEach((input) => {
            input.addEventListener('input', () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                handleControlChange(moduleId, input.dataset.controlKey, input.value, control);
            });
        });

        container.querySelectorAll('[data-control-type="file-upload"]').forEach((input) => {
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
            btn.addEventListener('click', async () => {
                const control = schema.find((c) => c.key === btn.dataset.controlKey);
                const renderer = window.OkamiSignalLab?.ModuleRegistry?.getRenderer(moduleId);
                if (typeof renderer?.handleAction !== 'function') {
                    return;
                }

                btn.disabled = true;
                try {
                    await renderer.handleAction(btn.dataset.controlKey, getExportContext(), moduleState[moduleId]);
                } catch {
                    // Status message handled in module.
                } finally {
                    btn.disabled = false;
                    updateExportPreviewContext(moduleId);
                    refreshOutput();
                }
            });
        });

        container.querySelectorAll('[data-control-type="checkbox"]').forEach((input) => {
            input.addEventListener('change', () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                handleControlChange(moduleId, input.dataset.controlKey, input.checked, control);
            });
        });

        container.querySelectorAll('.signal-lab-transport-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.disabled) {
                    return;
                }
                const value = btn.dataset.controlValue === 'true';
                const transportKey = btn.dataset.controlKey || 'playing';
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
            input.addEventListener('change', () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                handleControlChange(moduleId, input.dataset.controlKey, input.value, control);
            });
        });
    }

    function buildModuleOptions(moduleId) {
        const container = getElements().moduleOptions;
        const registry = window.OkamiSignalLab?.ModuleRegistry;
        const controlUI = window.OkamiSignalLab?.ControlUI;
        const renderer = registry?.getRenderer(moduleId);
        const state = moduleState[moduleId] || {};

        if (!container || !controlUI) {
            return;
        }

        const rawSchema = renderer?.getControlSchema?.(state)
            || renderer?.getControlSchema?.()
            || [];

        if (!rawSchema.length) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        container.hidden = false;
        container.innerHTML = controlUI.buildOptionsHtml(rawSchema, state, moduleId);

        const schema = controlUI.flattenSchema(rawSchema, state, moduleId);
        bindModuleControlEvents(container, schema, moduleId);
    }

    function selectModule(moduleId, searchPatch = null) {
        const registry = window.OkamiSignalLab?.ModuleRegistry;
        const meta = registry?.getModuleById(moduleId);
        if (!meta || meta.status !== 'active') {
            return;
        }

        activeModuleId = moduleId;
        const renderer = registry.getRenderer(moduleId);

        if (renderer?.defaultState && !moduleState[moduleId]) {
            moduleState[moduleId] = { ...renderer.defaultState };
        }

        if (searchPatch && typeof searchPatch === 'object') {
            updateModuleState(moduleId, searchPatch);
        }

        if (engine) {
            applyEngineState(moduleId);
            engine.setModule(renderer);
            if (searchPatch && typeof renderer?.onStateChange === 'function') {
                Object.keys(searchPatch).forEach((key) => {
                    renderer.onStateChange(engine, moduleState[moduleId], key);
                });
            }
        }

        const els = getElements();
        if (els.moduleTitle) {
            els.moduleTitle.textContent = meta.label;
        }
        if (els.moduleDesc) {
            els.moduleDesc.textContent = meta.description;
        }

        els.moduleList?.querySelectorAll('[data-module-id]').forEach((btn) => {
            const isActive = btn.dataset.moduleId === moduleId;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        buildModuleOptions(moduleId);
        updateExportPreviewContext(moduleId);
        updatePreviewPatternName();
        updateOutputBadge();
        refreshOutput();
        setStatus(searchPatch
            ? `Active: ${meta.label} (search match applied)`
            : `Active: ${meta.label}`);
    }

    function getSearchIndex() {
        if (!moduleSearchIndex && window.OkamiSignalLab?.ModuleSearch) {
            moduleSearchIndex = window.OkamiSignalLab.ModuleSearch.buildModuleSearchIndex();
        }
        return moduleSearchIndex || [];
    }

    function updateSearchStatus(query, matchCount) {
        const el = getElements().moduleSearchStatus;
        if (!el) {
            return;
        }

        const normalized = window.OkamiSignalLab?.ModuleSearch?.normalizeForSearch(query) || query.trim().toLowerCase();
        if (!normalized) {
            el.hidden = true;
            el.textContent = '';
            return;
        }

        el.hidden = false;
        if (matchCount === 0) {
            el.textContent = `No tools match “${query.trim()}”.`;
        } else {
            el.textContent = `${matchCount} tool${matchCount === 1 ? '' : 's'} match “${query.trim()}”.`;
        }
    }

    function renderModuleList(query = '') {
        const registry = window.OkamiSignalLab?.ModuleRegistry;
        const list = getElements().moduleList;
        if (!registry || !list) {
            return;
        }

        currentSearchQuery = query;
        const normalizedQuery = window.OkamiSignalLab?.ModuleSearch?.normalizeForSearch(query) || '';
        const filtered = normalizedQuery
            ? window.OkamiSignalLab.ModuleSearch.filterModules(query, getSearchIndex())
            : getSearchIndex().map((entry) => ({
                moduleId: entry.moduleId,
                label: entry.label,
                category: entry.category,
                matchLabel: null,
                statePatch: null
            }));

        const planned = normalizedQuery
            ? []
            : registry.getCatalog().filter((entry) => entry.status !== 'active');

        updateSearchStatus(query, filtered.length);

        const activeButtons = filtered.map((entry) => {
            const isActive = entry.moduleId === activeModuleId;
            const meta = entry.matchLabel ? `Match: ${entry.matchLabel}` : entry.category;
            const patchAttr = entry.statePatch
                ? ` data-state-patch="${encodeURIComponent(JSON.stringify(entry.statePatch))}"`
                : '';

            return `
                <button type="button"
                    class="signal-lab-module-btn${isActive ? ' is-active' : ''}"
                    data-module-id="${entry.moduleId}"
                    data-category="${entry.category}"${patchAttr}
                    aria-pressed="${isActive ? 'true' : 'false'}">
                    <span class="signal-lab-module-btn-label">${entry.label}</span>
                    <span class="signal-lab-module-btn-meta">${meta}</span>
                </button>
            `;
        }).join('');

        const plannedButtons = planned.map((entry) => `
            <button type="button"
                class="signal-lab-module-btn is-planned"
                data-module-id="${entry.id}"
                data-category="${entry.category}"
                disabled aria-disabled="true">
                <span class="signal-lab-module-btn-label">${entry.label}</span>
                <span class="signal-lab-module-btn-meta">Coming soon</span>
            </button>
        `).join('');

        list.innerHTML = activeButtons + plannedButtons;

        list.querySelectorAll('[data-module-id]:not([disabled])').forEach((btn) => {
            btn.addEventListener('click', () => {
                let searchPatch = null;
                if (btn.dataset.statePatch) {
                    try {
                        searchPatch = JSON.parse(decodeURIComponent(btn.dataset.statePatch));
                    } catch {
                        searchPatch = null;
                    }
                }
                selectModule(btn.dataset.moduleId, searchPatch);
            });
        });
    }

    function filterModuleList() {
        renderModuleList(getElements().moduleSearch?.value || '');
    }

    function openPopoutFullscreen() {
        openPopout(true);
    }

    function bindPopoutSync() {
        getPopoutChannel();

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
        const els = getElements();
        const presets = window.OkamiSignalLab?.PatternResolution?.PRESETS || [];

        if (els.patternResolution) {
            els.patternResolution.innerHTML = presets.map((preset) => `
                <option value="${preset.id}"${outputSettings.patternResolution === preset.id ? ' selected' : ''}>${preset.label}</option>
            `).join('');

            els.patternResolution.addEventListener('change', () => {
                outputSettings.patternResolution = els.patternResolution.value;
                if (els.patternCustomWrap) {
                    els.patternCustomWrap.hidden = outputSettings.patternResolution !== 'custom';
                }
                applyOutputSettingsToEngine();
                refreshOutput();
            });
        }

        if (els.scaleMode) {
            els.scaleMode.value = outputSettings.scaleMode || 'fit';
            els.scaleMode.addEventListener('change', () => {
                outputSettings.scaleMode = els.scaleMode.value === 'stretch' ? 'stretch' : 'fit';
                applyOutputSettingsToEngine();
                refreshOutput();
            });
        }

        if (els.patternCustomWrap) {
            els.patternCustomWrap.hidden = outputSettings.patternResolution !== 'custom';
        }

        const applyCustomPatternSize = () => {
            const utils = getControlUtils();
            outputSettings.patternWidth = utils
                ? utils.clampNumber(els.patternWidth?.value, 64, 16384, 1)
                : parseInt(els.patternWidth?.value, 10) || 1920;
            outputSettings.patternHeight = utils
                ? utils.clampNumber(els.patternHeight?.value, 64, 16384, 1)
                : parseInt(els.patternHeight?.value, 10) || 1080;
            if (els.patternWidth) {
                els.patternWidth.value = outputSettings.patternWidth;
            }
            if (els.patternHeight) {
                els.patternHeight.value = outputSettings.patternHeight;
            }
            applyOutputSettingsToEngine();
            refreshOutput();
        };

        [els.patternWidth, els.patternHeight].forEach((input) => {
            if (!input) {
                return;
            }
            input.value = outputSettings[input.id.includes('width') ? 'patternWidth' : 'patternHeight']
                ?? input.value;
            bindEnterToBlur(input);
            input.addEventListener('blur', applyCustomPatternSize);
        });
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
        els.fullscreenBtn?.addEventListener('click', toggleFullscreen);
        els.popoutBtn?.addEventListener('click', () => openPopout(false));
        els.updatePopoutBtn?.addEventListener('click', updatePopout);
        els.popoutFullscreenBtn?.addEventListener('click', openPopoutFullscreen);
        els.closePopoutBtn?.addEventListener('click', () => {
            if (isPopoutOpen()) {
                popoutWindow.close();
            }
            handlePopoutClosed();
            setStatus('Pop-out closed.');
        });
        els.moduleSearch?.addEventListener('input', () => filterModuleList());

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

        moduleSearchIndex = null;
        currentSearchQuery = getElements().moduleSearch?.value || '';

        window.OkamiSiteLayout?.init?.();
        refreshPreviewLayout();
        renderModuleList(currentSearchQuery);
        initEngine();

        if (!initialized) {
            initOutputSettingsUI();
            bindPopoutSync();
            bindEvents();
            initialized = true;
        } else {
            refreshPreviewLayout();
        }

        setStatus('Signal Lab ready.');
        initPreviewScaleDebug();
        updatePreviewPatternName();
        updateOutputBadge();
    }

    window.initSignalLab = initSignalLab;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSignalLab);
    } else {
        initSignalLab();
    }
})();
