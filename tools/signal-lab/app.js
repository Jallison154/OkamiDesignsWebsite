(function() {
    'use strict';

    let engine = null;
    let snapshotWindow = null;
    let activeModuleId = 'video-patterns';
    let initialized = false;
    let moduleSearchIndex = null;
    let currentSearchQuery = '';
    let availableScreens = [];
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
            resolution: document.getElementById('signal-lab-resolution'),
            resolutionWarning: document.getElementById('signal-lab-resolution-warning'),
            patternResolution: document.getElementById('signal-lab-pattern-resolution'),
            patternCustomWrap: document.getElementById('signal-lab-pattern-custom'),
            patternWidth: document.getElementById('signal-lab-pattern-width'),
            patternHeight: document.getElementById('signal-lab-pattern-height'),
            screenSelect: document.getElementById('signal-lab-screen-select'),
            screenNote: document.getElementById('signal-lab-screen-note'),
            moduleTitle: document.getElementById('signal-lab-module-title'),
            moduleDesc: document.getElementById('signal-lab-module-desc'),
            fullscreenBtn: document.getElementById('signal-lab-fullscreen'),
            popoutBtn: document.getElementById('signal-lab-popout'),
            popoutFullscreenBtn: document.getElementById('signal-lab-popout-fullscreen'),
            openScreenBtn: document.getElementById('signal-lab-open-screen'),
            closePopoutBtn: document.getElementById('signal-lab-close-popout')
        };
    }

    function getControlUtils() {
        return window.OkamiSignalLab?.ControlUtils;
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

    function setResolutionLabel(width, height, patternWidth, patternHeight) {
        const el = getElements().resolution;
        if (el) {
            if (patternWidth && patternHeight && (patternWidth !== width || patternHeight !== height)) {
                el.textContent = `Preview ${width} × ${height}px · Pattern ${patternWidth} × ${patternHeight}px`;
            } else {
                el.textContent = `${width} × ${height}px`;
            }
        }
    }

    function applyOutputSettingsToEngine() {
        if (engine) {
            engine.setOutputSettings({ ...outputSettings });
        }
    }

    function shouldRunAnimation(moduleId) {
        const renderer = window.OkamiSignalLab?.ModuleRegistry?.getRenderer(moduleId);
        const state = moduleState[moduleId] || {};

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
            numberInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    numberInput.blur();
                }
            });
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

        if (key === 'patternId') {
            buildModuleOptions(moduleId);
        }

        if (control?.type === 'transport') {
            setStatus(value ? (control.startLabel || 'Playing') : (control.stopLabel || 'Paused'));
            return;
        }

        const label = control?.label || key;
        setStatus(`${registry?.getModuleById(moduleId)?.label || moduleId}: ${label} updated`);
    }

    function buildModuleOptions(moduleId) {
        const container = getElements().moduleOptions;
        const registry = window.OkamiSignalLab?.ModuleRegistry;
        const renderer = registry?.getRenderer(moduleId);

        if (!container) {
            return;
        }

        const schema = renderer?.getControlSchema?.(moduleState[moduleId])
            || renderer?.getControlSchema?.()
            || [];
        if (!schema.length) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        container.hidden = false;
        container.innerHTML = schema.map((control) => {
            if (control.type === 'section') {
                return `<div class="signal-lab-control-section">${control.label}</div>`;
            }

            const current = moduleState[moduleId]?.[control.key];

            if (control.type === 'select') {
                const options = (control.options || []).map((opt) => {
                    const selected = current === opt.value ? ' selected' : '';
                    return `<option value="${opt.value}"${selected}>${opt.label}</option>`;
                }).join('');

                return `
                    <div class="signal-lab-control">
                        <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${control.label}</label>
                        <select id="sl-ctrl-${control.key}" class="led-select signal-lab-select" data-control-key="${control.key}" data-control-type="select">
                            ${options}
                        </select>
                    </div>
                `;
            }

            if (control.type === 'range') {
                const utils = getControlUtils();
                const val = current ?? control.min ?? 0;
                const isPercent = utils?.isPercentRangeControl(control);
                const displayVal = utils ? utils.rangeToDisplay(val, control) : val;
                const unit = isPercent ? '%' : (control.unit || '');
                const numMin = isPercent ? utils.rangeToDisplay(control.min, control) : control.min;
                const numMax = isPercent ? utils.rangeToDisplay(control.max, control) : control.max;
                const numStep = isPercent ? utils.rangeToDisplay(control.step, control) : (control.step || 0.1);
                return `
                    <div class="signal-lab-control">
                        <div class="signal-lab-range-header">
                            <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${control.label}</label>
                            <div class="signal-lab-range-value-wrap">
                                <input type="number" id="sl-ctrl-num-${control.key}" class="signal-lab-range-input"
                                    data-control-key="${control.key}" data-control-type="range-number"
                                    min="${numMin}" max="${numMax}" step="${numStep}" value="${displayVal}"
                                    aria-label="${control.label} value">
                                <span class="signal-lab-range-unit">${unit}</span>
                            </div>
                        </div>
                        <input type="range" id="sl-ctrl-${control.key}" class="signal-lab-range"
                            data-control-key="${control.key}" data-control-type="range"
                            min="${control.min}" max="${control.max}" step="${control.step || 0.1}" value="${val}">
                    </div>
                `;
            }

            if (control.type === 'checkbox') {
                const checked = current ? ' checked' : '';
                return `
                    <div class="signal-lab-control signal-lab-control--checkbox">
                        <label class="signal-lab-checkbox">
                            <input type="checkbox" id="sl-ctrl-${control.key}" data-control-key="${control.key}" data-control-type="checkbox"${checked}>
                            <span>${control.label}</span>
                        </label>
                    </div>
                `;
            }

            if (control.type === 'transport') {
                const isOn = current !== false && current !== 'false' && current !== undefined
                    ? Boolean(current)
                    : control.key === 'active' ? false : true;
                const startLabel = control.startLabel || 'Play';
                const stopLabel = control.stopLabel || 'Pause';
                const transportKey = control.key || 'playing';
                return `
                    <div class="signal-lab-control">
                        <span class="signal-lab-control-label">${control.label}</span>
                        <div class="signal-lab-transport">
                            <button type="button" class="led-btn signal-lab-transport-btn${isOn ? ' is-active' : ''}"
                                data-control-key="${transportKey}" data-control-value="true" aria-pressed="${isOn ? 'true' : 'false'}">${startLabel}</button>
                            <button type="button" class="led-btn signal-lab-transport-btn${!isOn ? ' is-active' : ''}"
                                data-control-key="${transportKey}" data-control-value="false" aria-pressed="${!isOn ? 'true' : 'false'}">${stopLabel}</button>
                        </div>
                    </div>
                `;
            }

            if (control.type === 'peak-meter') {
                return `
                    <div class="signal-lab-control signal-lab-control--meter" data-peak-meter-root>
                        <span class="signal-lab-control-label">${control.label}</span>
                        <div class="signal-lab-peak-meter">
                            <div class="signal-lab-peak-track">
                                <div class="signal-lab-peak-fill" data-peak-fill style="width: 0%"></div>
                            </div>
                            <span class="signal-lab-peak-label" data-peak-label">−∞ dB</span>
                        </div>
                    </div>
                `;
            }

            if (control.type === 'display-metrics') {
                const rows = [
                    { key: 'screenWidth', label: 'Screen Width' },
                    { key: 'screenHeight', label: 'Screen Height' },
                    { key: 'viewportWidth', label: 'Viewport Width' },
                    { key: 'viewportHeight', label: 'Viewport Height' },
                    { key: 'aspectRatio', label: 'Aspect Ratio' },
                    { key: 'devicePixelRatio', label: 'Device Pixel Ratio' },
                    { key: 'refreshRate', label: 'Est. Refresh Rate' },
                    { key: 'fullscreen', label: 'Fullscreen Status' }
                ].map((row) => `
                    <div class="signal-lab-display-metric">
                        <span class="signal-lab-display-metric-label">${row.label}</span>
                        <span class="signal-lab-display-metric-value" data-metric-value="${row.key}">—</span>
                    </div>
                `).join('');

                return `
                    <div class="signal-lab-control signal-lab-control--display-metrics">
                        <span class="signal-lab-control-label">${control.label}</span>
                        <div class="signal-lab-display-metrics" data-display-metrics-root>${rows}</div>
                    </div>
                `;
            }

            if (control.type === 'led-wall-metrics') {
                const rows = [
                    { key: 'resolutionLabel', label: 'Exact Resolution' },
                    { key: 'totalWidth', label: 'Total Width' },
                    { key: 'totalHeight', label: 'Total Height' },
                    { key: 'exactAspectRatio', label: 'Exact Aspect Ratio' },
                    { key: 'closestAspectLabel', label: 'Closest Common Aspect' },
                    { key: 'closestAspectDeviationPct', label: 'Aspect Deviation' },
                    { key: 'panelSizeLabel', label: 'Panel Size' },
                    { key: 'wallGridLabel', label: 'Wall Grid' }
                ].map((row) => `
                    <div class="signal-lab-display-metric">
                        <span class="signal-lab-display-metric-label">${row.label}</span>
                        <span class="signal-lab-display-metric-value" data-led-metric-value="${row.key}">—</span>
                    </div>
                `).join('');

                return `
                    <div class="signal-lab-control signal-lab-control--led-metrics">
                        <span class="signal-lab-control-label">${control.label}</span>
                        <div class="signal-lab-display-metrics" data-led-wall-metrics-root>${rows}</div>
                        <div class="signal-lab-led-warnings-wrap">
                            <span class="signal-lab-control-label">Scaling Warnings</span>
                            <ul class="signal-lab-led-warnings" data-led-wall-warnings>
                                <li class="signal-lab-led-warning">—</li>
                            </ul>
                        </div>
                    </div>
                `;
            }

            if (control.type === 'text') {
                const value = current ?? control.placeholder ?? '';
                return `
                    <div class="signal-lab-control">
                        <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${control.label}</label>
                        <input type="text" id="sl-ctrl-${control.key}" class="signal-lab-text-input"
                            data-control-key="${control.key}" data-control-type="text"
                            value="${String(value).replace(/"/g, '&quot;')}"
                            placeholder="${control.placeholder || ''}" maxlength="${control.maxLength || 120}">
                    </div>
                `;
            }

            if (control.type === 'number') {
                const val = current ?? control.min ?? 0;
                const unit = control.unit || '';
                return `
                    <div class="signal-lab-control">
                        <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${control.label}</label>
                        <input type="number" id="sl-ctrl-${control.key}" class="signal-lab-number-input"
                            data-control-key="${control.key}" data-control-type="number"
                            min="${control.min}" max="${control.max}" step="${control.step || 1}" value="${val}">
                        ${unit ? `<span class="signal-lab-number-unit">${unit.trim()}</span>` : ''}
                    </div>
                `;
            }

            if (control.type === 'action') {
                return `
                    <div class="signal-lab-control signal-lab-control--action">
                        <button type="button" class="led-btn signal-lab-action-btn"
                            data-control-key="${control.key}" data-control-type="action">${control.buttonLabel || control.label}</button>
                    </div>
                `;
            }

            if (control.type === 'file-upload') {
                const hasFile = Boolean(current);
                return `
                    <div class="signal-lab-control signal-lab-control--file">
                        <label class="signal-lab-control-label" for="sl-ctrl-${control.key}">${control.label}</label>
                        <input type="file" id="sl-ctrl-${control.key}" class="signal-lab-file-input"
                            data-control-key="${control.key}" data-control-type="file-upload"
                            accept="${control.accept || 'image/*'}">
                        <div class="signal-lab-file-meta">
                            <span class="signal-lab-file-status">${hasFile ? 'Image loaded' : 'No image uploaded'}</span>
                            ${hasFile ? `<button type="button" class="led-btn led-btn-text signal-lab-file-clear" data-clear-upload data-control-key="${control.key}">Remove</button>` : ''}
                        </div>
                    </div>
                `;
            }

            if (control.type === 'radio') {
                const options = (control.options || []).map((opt) => {
                    const checked = (current || control.options[0]?.value) === opt.value ? ' checked' : '';
                    return `
                        <label class="signal-lab-radio">
                            <input type="radio" name="sl-radio-${control.key}" value="${opt.value}"
                                data-control-key="${control.key}" data-control-type="radio"${checked}>
                            <span>${opt.label}</span>
                        </label>
                    `;
                }).join('');

                return `
                    <div class="signal-lab-control">
                        <span class="signal-lab-control-label">${control.label}</span>
                        <div class="signal-lab-radio-group">${options}</div>
                    </div>
                `;
            }

            return '';
        }).join('');

        container.querySelectorAll('[data-control-type="select"]').forEach((input) => {
            input.addEventListener('change', () => {
                const control = schema.find((c) => c.key === input.dataset.controlKey);
                handleControlChange(moduleId, input.dataset.controlKey, input.value, control);
            });
        });

        container.querySelectorAll('[data-control-type="range"]').forEach((input) => {
            const control = schema.find((c) => c.key === input.dataset.controlKey);
            const numberInput = container.querySelector(`#sl-ctrl-num-${input.dataset.controlKey}`);
            if (numberInput) {
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
                const control = schema.find((c) => c.key === input.dataset.controlKey);
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
                    updateModuleState(moduleId, patch);
                    applyEngineState(moduleId);
                    const renderer = window.OkamiSignalLab?.ModuleRegistry?.getRenderer(moduleId);
                    if (engine && typeof renderer?.onStateChange === 'function') {
                        renderer.onStateChange(engine, moduleState[moduleId], key);
                    }
                    refreshOutput();
                    buildModuleOptions(moduleId);
                    setStatus('Image uploaded.');
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
                updateModuleState(moduleId, patch);
                applyEngineState(moduleId);
                const renderer = window.OkamiSignalLab?.ModuleRegistry?.getRenderer(moduleId);
                if (engine && typeof renderer?.onStateChange === 'function') {
                    renderer.onStateChange(engine, moduleState[moduleId], key);
                }
                refreshOutput();
                buildModuleOptions(moduleId);
                setStatus('Image removed.');
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
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            });
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

    function buildModuleList() {
        renderModuleList(currentSearchQuery);
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

    function getSelectedScreen() {
        const id = getElements().screenSelect?.value || outputSettings.selectedScreenId;
        return availableScreens.find((screen) => screen.id === id) || availableScreens[0] || null;
    }

    function openPopoutSnapshot() {
        const canvas = getElements().canvas;
        if (!canvas || !engine) {
            setStatus('Preview not ready yet.');
            return;
        }

        refreshOutput();

        let dataUrl;
        try {
            dataUrl = canvas.toDataURL('image/png');
        } catch {
            setStatus('Could not capture preview image.');
            return;
        }

        if (snapshotWindow && !snapshotWindow.closed) {
            snapshotWindow.close();
        }

        snapshotWindow = window.open('', 'okami-signal-lab-snapshot', 'width=960,height=540');
        if (!snapshotWindow) {
            setStatus('Pop-up blocked. Allow pop-ups for this site.');
            return;
        }

        snapshotWindow.document.open();
        snapshotWindow.document.write(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Signal Lab Snapshot</title>
<style>*{box-sizing:border-box;margin:0}html,body{width:100%;height:100%;background:#000}
body{display:flex;align-items:center;justify-content:center;overflow:hidden}
img{display:block;max-width:100%;max-height:100vh;width:100%;height:100%;object-fit:contain}
.note{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);padding:6px 12px;border-radius:999px;
background:rgba(0,0,0,.65);color:rgba(255,255,255,.55);font:600 11px Montserrat,sans-serif}
</style></head><body>
<img src="${dataUrl}" alt="Signal Lab output snapshot">
<div class="note">Static snapshot — live pop-out sync temporarily disabled</div>
</body></html>`);
        snapshotWindow.document.close();
        getElements().closePopoutBtn?.removeAttribute('hidden');
        setStatus('Opened static output snapshot.');
    }

    function disableAdvancedPopout() {
        const els = getElements();

        if (els.popoutBtn) {
            els.popoutBtn.textContent = 'Open Snapshot';
            els.popoutBtn.removeAttribute('disabled');
        }

        if (els.popoutFullscreenBtn) {
            els.popoutFullscreenBtn.textContent = 'Pop-out sync temporarily disabled';
            els.popoutFullscreenBtn.setAttribute('disabled', '');
            els.popoutFullscreenBtn.setAttribute('aria-disabled', 'true');
        }

        if (els.openScreenBtn) {
            els.openScreenBtn.textContent = 'Pop-out sync temporarily disabled';
            els.openScreenBtn.setAttribute('disabled', '');
            els.openScreenBtn.setAttribute('aria-disabled', 'true');
        }

        els.closePopoutBtn?.setAttribute('hidden', '');
        if (els.closePopoutBtn) {
            els.closePopoutBtn.textContent = 'Close Snapshot';
        }

        if (els.screenNote) {
            els.screenNote.textContent = 'Live pop-out sync is temporarily disabled. Use Open Snapshot or Fullscreen.';
        }

        if (els.screenSelect) {
            els.screenSelect.disabled = true;
            els.screenSelect.innerHTML = '<option value="">Pop-out sync disabled</option>';
        }
    }

    function setScreenNote(text, tone = 'default') {
        const el = getElements().screenNote;
        if (!el) {
            return;
        }
        el.textContent = text;
        el.dataset.tone = tone;
    }

    function applyScreenListResult(result) {
        const els = getElements();
        const placement = window.OkamiSignalLab?.ScreenPlacement;
        if (!els.screenSelect || !result) {
            return result;
        }

        if (result.helperText) {
            setScreenNote(result.helperText, result.status === placement?.STATUS?.SUPPORTED ? 'ok' : 'default');
        }

        if (result.status !== placement?.STATUS?.SUPPORTED || !result.screens?.length) {
            els.screenSelect.disabled = true;
            document.getElementById('signal-lab-screen-select-wrap')?.classList.add('is-disabled');
            if (result.status === placement?.STATUS?.PERMISSION_DENIED) {
                els.screenSelect.innerHTML = '<option value="">Permission required</option>';
            } else if (result.status === placement?.STATUS?.SUPPORTED) {
                els.screenSelect.innerHTML = '<option value="">No displays detected</option>';
            }
            return result;
        }

        availableScreens = result.screens;
        els.screenSelect.disabled = false;
        document.getElementById('signal-lab-screen-select-wrap')?.classList.remove('is-disabled');
        els.screenSelect.innerHTML = availableScreens.map((screen) => `
            <option value="${screen.id}"${screen.id === outputSettings.selectedScreenId ? ' selected' : ''}>${screen.label}</option>
        `).join('');

        const selectedId = els.screenSelect.value || availableScreens[0]?.id;
        if (selectedId) {
            outputSettings.selectedScreenId = selectedId;
            els.screenSelect.value = selectedId;
        }

        return result;
    }

    function initScreenSelectionUI() {
        const els = getElements();
        const placement = window.OkamiSignalLab?.ScreenPlacement;
        const wrap = document.getElementById('signal-lab-screen-select-wrap');
        if (!placement || !els.screenSelect) {
            return;
        }

        els.screenSelect.disabled = true;
        els.screenSelect.innerHTML = '<option value="">Click Open on Screen to detect displays</option>';

        if (!placement.isApiAvailable()) {
            els.openScreenBtn?.setAttribute('disabled', '');
            wrap?.classList.add('is-disabled');
            setScreenNote(placement.UNSUPPORTED_MSG);
            return;
        }

        if (!placement.isSecureContext()) {
            els.openScreenBtn?.setAttribute('disabled', '');
            wrap?.classList.add('is-disabled');
            setScreenNote('Screen selection requires HTTPS or localhost. Use Open Pop Out, then drag the window to your display.');
            return;
        }

        wrap?.classList.remove('is-disabled');
        els.openScreenBtn?.removeAttribute('disabled');
        setScreenNote('Click Open on Screen to grant display access and list screens.');
    }

    async function handleOpenOnScreenClick() {
        const placement = window.OkamiSignalLab?.ScreenPlacement;
        if (!placement) {
            setStatus('Screen selection not supported');
            return;
        }

        if (!placement.isApiAvailable()) {
            setStatus('Screen selection not supported');
            setScreenNote(placement.UNSUPPORTED_MSG);
            return;
        }

        if (!placement.isSecureContext()) {
            setStatus('Screen selection not supported');
            setScreenNote('Screen selection requires HTTPS or localhost.');
            return;
        }

        const result = await placement.requestScreenDetails();
        applyScreenListResult(result);
        setStatus(result.statusMessage || 'Screen selection not supported');

        if (result.status !== placement.STATUS.SUPPORTED || !result.screens?.length) {
            return;
        }

        openPopoutSnapshot();
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
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            });
            input.addEventListener('blur', applyCustomPatternSize);
        });

        els.screenSelect?.addEventListener('change', () => {
            outputSettings.selectedScreenId = els.screenSelect.value;
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
            onFrame: ({ width, height, patternWidth, patternHeight }) => {
                setResolutionLabel(width, height, patternWidth, patternHeight);
            },
            onPatternMismatch: (warning) => setResolutionWarning(warning)
        });

        selectModule(activeModuleId);
    }

    function bindEvents() {
        const els = getElements();
        els.fullscreenBtn?.addEventListener('click', toggleFullscreen);
        els.popoutBtn?.addEventListener('click', openPopoutSnapshot);
        els.closePopoutBtn?.addEventListener('click', () => {
            if (snapshotWindow && !snapshotWindow.closed) {
                snapshotWindow.close();
            }
            snapshotWindow = null;
            setStatus('Snapshot closed.');
        });
        els.moduleSearch?.addEventListener('input', () => filterModuleList());

        document.addEventListener('fullscreenchange', () => {
            els.stage?.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement));
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

        buildModuleList();
        initEngine();

        if (!initialized) {
            initOutputSettingsUI();
            disableAdvancedPopout();
            bindEvents();
            initialized = true;
        }

        setStatus('Signal Lab ready.');
    }

    window.initSignalLab = initSignalLab;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSignalLab);
    } else {
        initSignalLab();
    }
})();
