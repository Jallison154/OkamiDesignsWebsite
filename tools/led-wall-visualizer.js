(function() {
    'use strict';

    const Calc = window.OkamiLedWallCalculator;
    const {
        Constants,
        clampPanelCount,
        clampPortFillThreshold,
        calculateCabinetResolution,
        calculateContentOverlay,
        calculateCabinetArtworkType,
        computeWallProject
    } = Calc;

    const {
        DEFAULTS,
        PITCH_PRESETS,
        CABINET_PRESETS,
        EXTENDED_PITCHES
    } = Constants;

    const LABEL_TIER = {
        LARGE: 'large',
        MEDIUM: 'medium',
        SMALL: 'small',
        TINY: 'tiny'
    };

    const ADV_TO_HIDDEN_FIELDS = {
        'custom-cabinet-width-mm': 'cabinet-width-mm',
        'custom-cabinet-height-mm': 'cabinet-height-mm',
        'custom-pixel-pitch-mm': 'pixel-pitch-mm'
    };

    const ADV_FIELD_IDS = Object.keys(ADV_TO_HIDDEN_FIELDS);
    const PANEL_COUNT_IDS = ['panels-wide', 'panels-tall'];

    const OVERLAY_DEBUG = new URLSearchParams(window.location.search).has('debug');
    const CABINET_NUMBERS_SESSION_KEY = 'led-show-cabinet-numbers';
    const CABINET_ART = {
        square: { src: '../images/led-cabinet-square.png', status: 'loading' },
        tall: { src: '../images/led-cabinet-500x1000.png', status: 'loading' }
    };

    let resizeObserver = null;
    let syncingPreset = false;
    let previewHoverBound = false;
    let advancedViewOpen = false;
    let cabinetArtInitialized = false;

    function initLedWallVisualizer() {
        const app = document.getElementById('led-wall-app');
        if (!app || app.dataset.initialized === 'true') {
            if (app) {
                updateAll();
            }
            return;
        }

        app.dataset.initialized = 'true';

        ADV_FIELD_IDS.forEach((id) => {
            document.getElementById(id)?.addEventListener('input', () => onAdvFieldChange(id));
        });

        initQuickStart();
        initShowCabinetNumbers();
        initCabinetArt();

        document.getElementById('auto-calculate-resolution')?.addEventListener('change', () => {
            applyAutoCalculateMode();
            updateAll();
        });

        document.getElementById('pixel-width')?.addEventListener('input', onManualPixelChange);
        document.getElementById('pixel-height')?.addEventListener('input', onManualPixelChange);
        document.getElementById('port-capacity')?.addEventListener('input', updateAll);
        document.getElementById('port-fill-threshold')?.addEventListener('input', updateAll);
        document.getElementById('port-fill-threshold')?.addEventListener('blur', () => {
            const input = document.getElementById('port-fill-threshold');
            if (input) {
                input.value = readPortFillThreshold();
            }
            updateAll();
        });
        document.getElementById('mesh-pitch-horizontal-mm')?.addEventListener('input', onMeshPitchChange);
        document.getElementById('mesh-pitch-vertical-mm')?.addEventListener('input', onMeshPitchChange);

        document.getElementById('overlay-format')?.addEventListener('change', () => {
            toggleCustomFormatFields();
            updateAll();
        });

        document.getElementById('custom-format-width')?.addEventListener('input', updateAll);
        document.getElementById('custom-format-height')?.addEventListener('input', updateAll);

        document.getElementById('led-reset')?.addEventListener('click', () => {
            resetCalculator();
            updateAll();
        });

        document.getElementById('led-advanced-open')?.addEventListener('click', () => {
            openAdvancedView();
        });

        document.getElementById('led-advanced-back')?.addEventListener('click', () => {
            closeAdvancedView();
        });

        document.getElementById('led-save-project')?.addEventListener('click', () => {
            void saveProjectFile();
        });

        document.getElementById('led-load-project')?.addEventListener('click', () => {
            document.getElementById('led-load-project-input')?.click();
        });

        document.getElementById('led-load-project-input')?.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
                void loadProjectFile(file);
            }
        });

        document.getElementById('led-export-report')?.addEventListener('click', () => {
            void exportProjectReport();
        });

        const stage = document.getElementById('led-preview-stage');
        if (stage && 'ResizeObserver' in window) {
            resizeObserver = new ResizeObserver(() => renderPreview(getState()));
            resizeObserver.observe(stage);
        }

        window.addEventListener('resize', onResize);
        closeAdvancedView();
        syncAdvFromHidden();
        applyAutoCalculateMode();
        toggleCustomFormatFields();
        updateAll();

        void window.OkamiCommercialGate?.initForProduct?.('okami-led-wall-calculator');
        void window.OkamiDesktopShell?.initDesktopShell?.({ productId: 'okami-led-wall-calculator' });
    }

    function initCabinetArt() {
        if (cabinetArtInitialized) {
            return;
        }

        cabinetArtInitialized = true;

        Object.keys(CABINET_ART).forEach((key) => {
            const preload = new Image();
            preload.onload = () => {
                CABINET_ART[key].status = 'loaded';
                refreshCabinetArtPreview();
            };
            preload.onerror = () => {
                CABINET_ART[key].status = 'error';
                refreshCabinetArtPreview();
            };
            preload.src = CABINET_ART[key].src;
        });
    }

    function getCabinetArtType(state) {
        return calculateCabinetArtworkType(state);
    }

    function refreshCabinetArtPreview() {
        if (document.getElementById('led-preview-wall')) {
            renderPreview(getState());
        }
    }

    function createCabinetCell(index) {
        const cell = document.createElement('div');
        cell.className = 'led-cabinet';
        cell.dataset.index = String(index);

        const label = document.createElement('span');
        label.className = 'led-cabinet-label';
        cell.appendChild(label);

        return cell;
    }

    function applyCabinetArtToWall(wall, state) {
        const artType = getCabinetArtType(state);
        const useSquare = artType === 'square' && CABINET_ART.square.status === 'loaded';
        const useTall = artType === 'tall' && CABINET_ART.tall.status === 'loaded';

        wall.querySelectorAll('.led-cabinet').forEach((cell) => {
            cell.classList.toggle('has-cabinet-art--square', useSquare);
            cell.classList.toggle('has-cabinet-art--tall', useTall);
            cell.classList.toggle('led-cabinet--fallback', !useSquare && !useTall);
        });
    }

    function initShowCabinetNumbers() {
        const toggle = document.getElementById('show-cabinet-numbers');
        if (!toggle) {
            return;
        }

        const stored = sessionStorage.getItem(CABINET_NUMBERS_SESSION_KEY);
        toggle.checked = stored === null ? DEFAULTS.showCabinetNumbers : stored === 'true';

        toggle.addEventListener('change', () => {
            sessionStorage.setItem(CABINET_NUMBERS_SESSION_KEY, String(toggle.checked));
            hideCabinetTooltip();
            renderPreview(getState());
        });
    }

    function initQuickStart() {
        document.querySelectorAll('[data-cabinet]').forEach((button) => {
            button.addEventListener('click', () => {
                applyQuickCabinet(button.dataset.cabinet);
            });
        });

        document.querySelectorAll('[data-pitch]').forEach((button) => {
            button.addEventListener('click', () => {
                if (button.dataset.pitch === 'custom') {
                    applyCustomPitch();
                } else {
                    applyQuickPitch(parseFloat(button.dataset.pitch));
                }
            });
        });

        document.querySelectorAll('[name="display-mode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) {
                    applyDisplayType(input.value);
                }
            });
        });

        document.getElementById('panels-wide-dec')?.addEventListener('click', () => adjustPanelCount('panels-wide', -1));
        document.getElementById('panels-wide-inc')?.addEventListener('click', () => adjustPanelCount('panels-wide', 1));
        document.getElementById('panels-tall-dec')?.addEventListener('click', () => adjustPanelCount('panels-tall', -1));
        document.getElementById('panels-tall-inc')?.addEventListener('click', () => adjustPanelCount('panels-tall', 1));

        PANEL_COUNT_IDS.forEach((id) => {
            const input = document.getElementById(id);
            input?.addEventListener('input', () => onPanelCountInput(id));
            input?.addEventListener('blur', () => onPanelCountBlur(id));
            input?.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            });
        });
    }

    function syncAdvFromHidden() {
        Object.entries(ADV_TO_HIDDEN_FIELDS).forEach(([advId, hiddenId]) => {
            const hidden = document.getElementById(hiddenId);
            const adv = document.getElementById(advId);
            if (hidden && adv) {
                adv.value = hidden.value;
            }
        });
    }

    function syncHiddenFromAdv(advId) {
        const hiddenId = ADV_TO_HIDDEN_FIELDS[advId];
        const adv = document.getElementById(advId);
        const hidden = hiddenId ? document.getElementById(hiddenId) : null;
        if (adv && hidden) {
            hidden.value = adv.value;
        }
    }

    function applyQuickCabinet(presetKey) {
        const preset = CABINET_PRESETS[presetKey];
        if (!preset) {
            return;
        }

        syncingPreset = true;
        setInputValue('cabinet-preset', presetKey);
        setInputValue('cabinet-width-mm', preset.width);
        setInputValue('cabinet-height-mm', preset.height);
        syncAdvFromHidden();
        syncingPreset = false;
        syncAutoPixelResolution();
        updateAll();
    }

    function applyQuickPitch(pitch) {
        setInputValue('pitch-preset', String(pitch));
        setInputValue('pixel-pitch-mm', pitch);
        syncAutoPixelResolution();
        updateAll();
    }

    function applyCustomPitch() {
        setPitchToCustom();
        document.getElementById('custom-pixel-pitch-mm')?.focus();
        updateAll();
    }

    function isExtendedPitchPreset(pitchPreset) {
        if (pitchPreset === 'custom') {
            return true;
        }
        const pitch = parseFloat(pitchPreset);
        return EXTENDED_PITCHES.some((value) => Math.abs(value - pitch) < 0.01);
    }

    function getCabinetLayoutSnapshot() {
        return {
            cabinetPreset: getCabinetPreset(),
            cabinetWidthMM: readNumber('cabinet-width-mm', DEFAULTS.cabinetWidthMM),
            cabinetHeightMM: readNumber('cabinet-height-mm', DEFAULTS.cabinetHeightMM),
            panelsWide: readInt('panels-wide', DEFAULTS.panelsWide),
            panelsTall: readInt('panels-tall', DEFAULTS.panelsTall)
        };
    }

    function restoreCabinetLayoutSnapshot(snapshot) {
        setInputValue('cabinet-preset', snapshot.cabinetPreset);
        setInputValue('cabinet-width-mm', snapshot.cabinetWidthMM);
        setInputValue('cabinet-height-mm', snapshot.cabinetHeightMM);
        setInputValue('panels-wide', snapshot.panelsWide);
        setInputValue('panels-tall', snapshot.panelsTall);
        syncAdvFromHidden();
    }

    function applyDisplayType(displayType) {
        const layoutSnapshot = getCabinetLayoutSnapshot();

        setInputValue('display-type', displayType);
        syncAutoPixelResolution();
        restoreCabinetLayoutSnapshot(layoutSnapshot);
        updateAll();
    }

    function onMeshPitchChange() {
        syncAutoPixelResolution();
        updateAll();
    }

    function getPanelCountDefault(id) {
        return id === 'panels-wide' ? DEFAULTS.panelsWide : DEFAULTS.panelsTall;
    }

    function setPanelCount(id, value) {
        const next = clampPanelCount(value);
        setInputValue(id, next);
        updateAll();
    }

    function adjustPanelCount(id, delta) {
        const current = readInt(id, getPanelCountDefault(id));
        setPanelCount(id, current + delta);
    }

    function onPanelCountInput(id) {
        const input = document.getElementById(id);
        if (!input || input.value.trim() === '') {
            return;
        }

        const parsed = parseInt(input.value, 10);
        if (!Number.isFinite(parsed)) {
            return;
        }

        setPanelCount(id, parsed);
    }

    function onPanelCountBlur(id) {
        const input = document.getElementById(id);
        if (!input) {
            return;
        }

        const parsed = parseInt(input.value, 10);
        if (input.value.trim() === '' || !Number.isFinite(parsed)) {
            setPanelCount(id, getPanelCountDefault(id));
            return;
        }

        setPanelCount(id, parsed);
    }

    function syncPanelCountInputs(state) {
        PANEL_COUNT_IDS.forEach((id) => {
            const input = document.getElementById(id);
            if (!input || document.activeElement === input) {
                return;
            }

            const value = id === 'panels-wide' ? state.panelsWide : state.panelsTall;
            if (parseInt(input.value, 10) !== value) {
                input.value = value;
            }
        });
    }

    function findMatchingPitch(pixelPitchMM) {
        return PITCH_PRESETS.find((pitch) => Math.abs(pitch - pixelPitchMM) < 0.01) ?? null;
    }

    function getDisplayType() {
        return document.getElementById('display-type')?.value || DEFAULTS.displayType;
    }

    function isTransparentDisplay() {
        return getDisplayType() === 'transparent';
    }

    function setPitchToCustom() {
        setInputValue('pitch-preset', 'custom');
    }

    function onResize() {
        if (document.getElementById('led-wall-app')) {
            renderPreview(getState());
        }
    }

    function onAdvFieldChange(advId) {
        syncHiddenFromAdv(advId);
        if (!syncingPreset && (advId === 'custom-cabinet-width-mm' || advId === 'custom-cabinet-height-mm')) {
            applyCustomCabinetFromDimensions();
        }
        if (advId === 'custom-pixel-pitch-mm') {
            setPitchToCustom();
        }
        syncAutoPixelResolution();
        updateAll();
    }

    function onManualPixelChange() {
        if (isAutoCalculateEnabled()) {
            return;
        }
        updateAll();
    }

    function setPresetToCustom() {
        const presetInput = document.getElementById('cabinet-preset');
        if (presetInput && presetInput.value !== 'custom') {
            presetInput.value = 'custom';
        }
    }

    function applyCustomCabinetFromDimensions() {
        const width = readNumber('cabinet-width-mm', DEFAULTS.cabinetWidthMM);
        const height = readNumber('cabinet-height-mm', DEFAULTS.cabinetHeightMM);
        const matchesPreset = (presetKey) => {
            const preset = CABINET_PRESETS[presetKey];
            return preset && Math.abs(preset.width - width) < 0.001 && Math.abs(preset.height - height) < 0.001;
        };

        if (matchesPreset('500x500')) {
            setInputValue('cabinet-preset', '500x500');
        } else if (matchesPreset('500x1000')) {
            setInputValue('cabinet-preset', '500x1000');
        } else {
            setPresetToCustom();
        }
    }

    function getCabinetPreset() {
        return document.getElementById('cabinet-preset')?.value || 'custom';
    }

    function isAutoCalculateEnabled() {
        const checkbox = document.getElementById('auto-calculate-resolution');
        return checkbox ? checkbox.checked : DEFAULTS.autoCalculateResolution;
    }

    function applyAutoCalculateMode() {
        const autoEnabled = isAutoCalculateEnabled();
        const manualFields = document.getElementById('led-manual-resolution-fields');

        if (manualFields) {
            manualFields.hidden = autoEnabled;
        }

        if (autoEnabled) {
            syncAutoPixelResolution();
        }

        setText('auto-calc-state', autoEnabled ? 'On' : 'Off');
    }

    function syncAutoPixelResolution() {
        if (!isAutoCalculateEnabled()) {
            return;
        }

        const { pixelWidth, pixelHeight } = calculateCabinetResolution(gatherInputs());
        setInputValue('pixel-width', pixelWidth);
        setInputValue('pixel-height', pixelHeight);
    }

    function toggleCustomFormatFields() {
        const customAspect = document.getElementById('led-custom-aspect-section');
        const format = getOverlayFormat();
        if (customAspect) {
            customAspect.hidden = format !== 'custom';
        }
    }

    function getOverlayFormat() {
        return document.getElementById('overlay-format')?.value || 'none';
    }

    function overlayInputsFromDom() {
        return {
            overlayFormat: getOverlayFormat(),
            customFormatWidth: readInt('custom-format-width', DEFAULTS.customFormatWidth),
            customFormatHeight: readInt('custom-format-height', DEFAULTS.customFormatHeight)
        };
    }

    function setOverlayFormat(format) {
        const select = document.getElementById('overlay-format');
        if (select) {
            select.value = format;
        }
    }

    function openAdvancedView() {
        advancedViewOpen = true;
        document.getElementById('led-config-swap')?.classList.add('is-advanced');
        document.querySelector('.wall-configuration-card')?.classList.add('is-advanced-open');
        const quickStart = document.getElementById('led-quick-start');
        const advancedPanel = document.getElementById('led-advanced-panel');
        const advancedOpen = document.getElementById('led-advanced-open');
        if (quickStart) {
            quickStart.hidden = true;
        }
        if (advancedPanel) {
            advancedPanel.hidden = false;
        }
        if (advancedOpen) {
            advancedOpen.hidden = true;
        }
    }

    function closeAdvancedView() {
        advancedViewOpen = false;
        document.getElementById('led-config-swap')?.classList.remove('is-advanced');
        document.querySelector('.wall-configuration-card')?.classList.remove('is-advanced-open');
        const quickStart = document.getElementById('led-quick-start');
        const advancedPanel = document.getElementById('led-advanced-panel');
        const advancedOpen = document.getElementById('led-advanced-open');
        if (quickStart) {
            quickStart.hidden = false;
        }
        if (advancedPanel) {
            advancedPanel.hidden = true;
        }
        if (advancedOpen) {
            advancedOpen.hidden = false;
        }
    }

    function resetCalculator() {
        setInputValue('cabinet-preset', DEFAULTS.cabinetPreset);
        setInputValue('pitch-preset', DEFAULTS.pitchPreset);
        setInputValue('display-type', DEFAULTS.displayType);
        setInputValue('cabinet-width-mm', DEFAULTS.cabinetWidthMM);
        setInputValue('cabinet-height-mm', DEFAULTS.cabinetHeightMM);
        setInputValue('pixel-pitch-mm', DEFAULTS.pixelPitchMM);
        setInputValue('mesh-pitch-horizontal-mm', DEFAULTS.meshPitchHorizontalMM);
        setInputValue('mesh-pitch-vertical-mm', DEFAULTS.meshPitchVerticalMM);
        setInputValue('panels-wide', DEFAULTS.panelsWide);
        setInputValue('panels-tall', DEFAULTS.panelsTall);
        document.getElementById('auto-calculate-resolution').checked = DEFAULTS.autoCalculateResolution;
        setInputValue('pixel-width', DEFAULTS.pixelWidth);
        setInputValue('pixel-height', DEFAULTS.pixelHeight);
        setInputValue('port-capacity', DEFAULTS.portCapacity);
        setInputValue('port-fill-threshold', DEFAULTS.portFillThreshold);
        setInputValue('custom-format-width', DEFAULTS.customFormatWidth);
        setInputValue('custom-format-height', DEFAULTS.customFormatHeight);
        setOverlayFormat(DEFAULTS.overlayFormat);
        const showNumbers = document.getElementById('show-cabinet-numbers');
        if (showNumbers) {
            showNumbers.checked = DEFAULTS.showCabinetNumbers;
            sessionStorage.setItem(CABINET_NUMBERS_SESSION_KEY, String(DEFAULTS.showCabinetNumbers));
        }
        document.querySelectorAll('[name="display-mode"]').forEach((input) => {
            input.checked = input.value === DEFAULTS.displayType;
        });
        closeAdvancedView();
        syncAdvFromHidden();
        applyAutoCalculateMode();
        syncAutoPixelResolution();
        toggleCustomFormatFields();
    }

    function setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input) {
            input.value = value;
        }
    }

    function readNumber(id, fallback) {
        const value = parseFloat(document.getElementById(id)?.value);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }

    function readInt(id, fallback) {
        const value = parseInt(document.getElementById(id)?.value, 10);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }

    function readPortFillThreshold() {
        const value = parseInt(document.getElementById('port-fill-threshold')?.value, 10);
        return clampPortFillThreshold(value);
    }

    function gatherInputs() {
        return {
            displayType: getDisplayType(),
            cabinetPreset: getCabinetPreset(),
            pitchPreset: document.getElementById('pitch-preset')?.value || 'custom',
            cabinetWidthMM: readNumber('cabinet-width-mm', DEFAULTS.cabinetWidthMM),
            cabinetHeightMM: readNumber('cabinet-height-mm', DEFAULTS.cabinetHeightMM),
            pixelPitchMM: readNumber('pixel-pitch-mm', DEFAULTS.pixelPitchMM),
            meshPitchHorizontalMM: readNumber('mesh-pitch-horizontal-mm', DEFAULTS.meshPitchHorizontalMM),
            meshPitchVerticalMM: readNumber('mesh-pitch-vertical-mm', DEFAULTS.meshPitchVerticalMM),
            panelsWide: readInt('panels-wide', DEFAULTS.panelsWide),
            panelsTall: readInt('panels-tall', DEFAULTS.panelsTall),
            pixelWidth: readInt('pixel-width', DEFAULTS.pixelWidth),
            pixelHeight: readInt('pixel-height', DEFAULTS.pixelHeight),
            autoCalculateResolution: isAutoCalculateEnabled(),
            portCapacity: readInt('port-capacity', DEFAULTS.portCapacity),
            portFillThreshold: readPortFillThreshold(),
            ...overlayInputsFromDom()
        };
    }

    function getState() {
        return computeWallProject(gatherInputs());
    }

    async function saveProjectFile() {
        const gate = window.OkamiCommercialGate;
        const footer = document.querySelector('.led-config-footer');
        if (gate?.checkLedWallSaveAllowed) {
            const check = await gate.checkLedWallSaveAllowed();
            if (!check.allowed) {
                gate.showUpgradeNotice?.('Save Project requires a Standard license or higher.', footer);
                return;
            }
        }

        const ProjectIO = window.OkamiLedWallCalculator?.ProjectIO;
        if (!ProjectIO) {
            return;
        }

        ProjectIO.downloadProject(gatherInputs(), getState());
    }

    async function exportProjectReport() {
        const gate = window.OkamiCommercialGate;
        const footer = document.querySelector('.led-config-footer');
        if (gate?.checkLedWallReportAllowed) {
            const check = await gate.checkLedWallReportAllowed();
            if (!check.allowed) {
                gate.showUpgradeNotice?.('Export Report requires a Standard license or higher.', footer);
                return;
            }
        }

        const ProjectIO = window.OkamiLedWallCalculator?.ProjectIO;
        if (!ProjectIO) {
            return;
        }

        ProjectIO.downloadReport(gatherInputs(), getState());
    }

    function applyProjectInputs(inputs = {}) {
        const data = inputs || {};

        setInputValue('cabinet-preset', data.cabinetPreset ?? DEFAULTS.cabinetPreset);
        setInputValue('pitch-preset', data.pitchPreset ?? DEFAULTS.pitchPreset);
        setInputValue('display-type', data.displayType ?? DEFAULTS.displayType);
        setInputValue('cabinet-width-mm', data.cabinetWidthMM ?? DEFAULTS.cabinetWidthMM);
        setInputValue('cabinet-height-mm', data.cabinetHeightMM ?? DEFAULTS.cabinetHeightMM);
        setInputValue('pixel-pitch-mm', data.pixelPitchMM ?? DEFAULTS.pixelPitchMM);
        setInputValue('mesh-pitch-horizontal-mm', data.meshPitchHorizontalMM ?? DEFAULTS.meshPitchHorizontalMM);
        setInputValue('mesh-pitch-vertical-mm', data.meshPitchVerticalMM ?? DEFAULTS.meshPitchVerticalMM);
        setInputValue('panels-wide', data.panelsWide ?? DEFAULTS.panelsWide);
        setInputValue('panels-tall', data.panelsTall ?? DEFAULTS.panelsTall);
        setInputValue('pixel-width', data.pixelWidth ?? DEFAULTS.pixelWidth);
        setInputValue('pixel-height', data.pixelHeight ?? DEFAULTS.pixelHeight);
        setInputValue('port-capacity', data.portCapacity ?? DEFAULTS.portCapacity);
        setInputValue('port-fill-threshold', data.portFillThreshold ?? DEFAULTS.portFillThreshold);
        setInputValue('custom-format-width', data.customFormatWidth ?? DEFAULTS.customFormatWidth);
        setInputValue('custom-format-height', data.customFormatHeight ?? DEFAULTS.customFormatHeight);
        setOverlayFormat(data.overlayFormat ?? DEFAULTS.overlayFormat);

        const autoCalculate = document.getElementById('auto-calculate-resolution');
        if (autoCalculate) {
            autoCalculate.checked = data.autoCalculateResolution !== false
                && data.autoCalculateResolution !== 'false';
        }

        document.querySelectorAll('[name="display-mode"]').forEach((input) => {
            input.checked = input.value === (data.displayType ?? DEFAULTS.displayType);
        });

        closeAdvancedView();
        syncAdvFromHidden();
        applyAutoCalculateMode();
        toggleCustomFormatFields();
        updateAll();
    }

    async function loadProjectFile(file) {
        const gate = window.OkamiCommercialGate;
        const footer = document.querySelector('.led-config-footer');
        if (gate?.checkLedWallLoadAllowed) {
            const check = await gate.checkLedWallLoadAllowed();
            if (!check.allowed) {
                gate.showUpgradeNotice?.('Load Project requires a Standard license or higher.', footer);
                return;
            }
        }

        const ProjectIO = window.OkamiLedWallCalculator?.ProjectIO;
        if (!ProjectIO?.readProjectFile) {
            return;
        }

        try {
            const project = await ProjectIO.readProjectFile(file);
            applyProjectInputs(project.inputs);
        } catch (error) {
            window.alert(error.message || 'Could not load project file.');
        }
    }

    function getWallPhysicalAspect(state) {
        if (state.physicalWidthMM && state.physicalHeightMM) {
            return state.physicalWidthMM / state.physicalHeightMM;
        }
        return Calc.calculatePhysicalSize(state).aspectRatio;
    }

    function formatQuickCabinetLabel(cabinetPreset) {
        const presetLabels = {
            '500x500': '500x500',
            '500x1000': '500x1000',
            custom: 'Custom'
        };

        return presetLabels[cabinetPreset] || 'Custom';
    }

    function formatFeetInches(feetDecimal) {
        const totalInches = Math.round(feetDecimal * 12);
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return `${feet}' ${inches}"`;
    }

    function formatPortCapacity(capacity) {
        if (capacity >= 1000000) {
            const millions = capacity / 1000000;
            return Number.isInteger(millions) ? `${millions}M` : `${millions.toFixed(1)}M`;
        }
        if (capacity >= 1000) {
            return `${Math.round(capacity / 1000)}k`;
        }
        return capacity.toLocaleString();
    }

    function formatPixelPair(width, height, useGrouping) {
        const w = useGrouping ? width.toLocaleString() : String(width);
        const h = useGrouping ? height.toLocaleString() : String(height);
        return `${w} × ${h}`;
    }

    function formatQuickPitchLabel(state) {
        if (state.displayType === 'transparent') {
            const h = readNumber('mesh-pitch-horizontal-mm', DEFAULTS.meshPitchHorizontalMM);
            const v = readNumber('mesh-pitch-vertical-mm', DEFAULTS.meshPitchVerticalMM);
            return `${h} × ${v}mm`;
        }

        const pitchPreset = document.getElementById('pitch-preset')?.value || 'custom';
        if (pitchPreset !== 'custom') {
            return `P${pitchPreset}`;
        }

        const matched = findMatchingPitch(state.pixelPitchMM);
        if (matched) {
            return `P${matched}`;
        }

        return `${(Math.round(state.pixelPitchMM * 10) / 10).toFixed(1)}mm`;
    }

    function updateAdvancedSettings(state) {
        const isMesh = state.displayType === 'transparent';
        const meshSettings = document.getElementById('led-mesh-settings');

        if (meshSettings) {
            meshSettings.hidden = !isMesh;
        }

        document.querySelectorAll('[name="display-mode"]').forEach((input) => {
            input.checked = input.value === state.displayType;
        });

        toggleCustomFormatFields();
        applyAutoCalculateMode();
    }

    function updateQuickStartUI(state) {
        const cabinetPreset = getCabinetPreset();
        const pitchPreset = document.getElementById('pitch-preset')?.value || 'custom';

        document.querySelectorAll('[data-cabinet]').forEach((button) => {
            const isActive = cabinetPreset === button.dataset.cabinet;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });

        document.querySelectorAll('[data-pitch]').forEach((button) => {
            const isActive = pitchPreset === button.dataset.pitch;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });

        const morePitches = document.getElementById('led-more-pitches');
        if (morePitches) {
            morePitches.open = isExtendedPitchPreset(pitchPreset);
        }

        const customPitchField = document.getElementById('led-custom-pitch-field');
        if (customPitchField) {
            customPitchField.hidden = pitchPreset !== 'custom' || state.displayType === 'transparent';
        }

        syncPanelCountInputs(state);
        syncAdvFromHidden();
        updateAdvancedSettings(state);

        const cabinetLabel = formatQuickCabinetLabel(cabinetPreset);
        const pitchLabel = formatQuickPitchLabel(state);
        setText('summary-cabinet-pitch', `${cabinetLabel} • ${pitchLabel}`);
        setText('summary-cabinet-resolution', formatPixelPair(state.pixelWidth, state.pixelHeight, false));
        setText('summary-wall-resolution', formatPixelPair(state.totalPixelWidth, state.totalPixelHeight, false));
        setText('summary-processor-ports', String(state.portsRequired));
    }

    function formatTotalPixels(totalPixels) {
        if (totalPixels >= 1000000) {
            const millions = totalPixels / 1000000;
            const formatted = millions >= 10 ? millions.toFixed(1) : millions.toFixed(2);
            return `${formatted.replace(/\.?0+$/, '')}M`;
        }
        if (totalPixels >= 1000) {
            return `${Math.round(totalPixels / 1000)}k`;
        }
        return totalPixels.toLocaleString();
    }

    function formatPortCount(count) {
        const label = count === 1 ? 'Port' : 'Ports';
        return `${count} ${label}`;
    }

    function updateResults(state) {
        setText(
            'result-wall-primary',
            `${formatFeetInches(state.physicalWidthFt)} × ${formatFeetInches(state.physicalHeightFt)}`
        );
        setMultilineText('result-wall-secondary', [
            `${state.panelsWide} × ${state.panelsTall}`,
            `${state.totalPanels.toLocaleString()} panels`
        ]);
        setText(
            'result-resolution-primary',
            formatPixelPair(state.totalPixelWidth, state.totalPixelHeight, true)
        );
        setMultilineText('result-resolution-secondary', [
            `${formatTotalPixels(state.totalPixels)} pixels`,
            state.closestRatio.label
        ]);
        setText('result-processor-primary', formatPortCount(state.portsRequired));
        setMultilineText('result-processor-secondary', [
            `${state.portFillThreshold}% max fill`,
            `${formatPortCapacity(state.usablePixelsPerPort)} usable/port`,
            `${formatPortCapacity(state.portCapacity)} max/port`
        ]);
    }

    function setMultilineText(id, lines) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = lines.join('\n');
        }
    }

    function updateContentFit(state) {
        const fitCard = document.getElementById('result-content-fit-card');
        if (!fitCard) {
            return;
        }

        if (!state.overlay) {
            fitCard.hidden = true;
            updateOverlayDebug(state);
            return;
        }

        fitCard.hidden = false;
        const usedPercent = Math.round(state.overlay.usedPercentage);
        setText('result-content-fit-primary', `${usedPercent}% Used`);
        setMultilineText('result-content-fit-secondary', [
            state.overlayFormatLabel,
            formatPixelPair(state.overlay.overlayPixelWidth, state.overlay.overlayPixelHeight, false)
        ]);
        updateOverlayDebug(state);
    }

    function isCabinetNumbersEnabled() {
        const checkbox = document.getElementById('show-cabinet-numbers');
        return checkbox ? checkbox.checked : DEFAULTS.showCabinetNumbers;
    }

    function isDesktopPreview() {
        return window.matchMedia('(min-width: 1200px)').matches;
    }

    function getLabelTier(cellWidth) {
        if (cellWidth > 60) {
            return LABEL_TIER.LARGE;
        }
        if (cellWidth >= 35) {
            return LABEL_TIER.MEDIUM;
        }
        if (cellWidth >= 20) {
            return LABEL_TIER.SMALL;
        }
        return LABEL_TIER.TINY;
    }

    function getAxisMarkers(count) {
        const markers = [1];
        for (let value = 5; value <= count; value += 5) {
            markers.push(value);
        }
        return markers;
    }

    function shouldShowCabinetNumber(cabinetNumber, tier) {
        if (tier === LABEL_TIER.LARGE || tier === LABEL_TIER.MEDIUM) {
            return true;
        }
        if (tier === LABEL_TIER.SMALL) {
            return cabinetNumber % 5 === 0;
        }
        return false;
    }

    function getTierFontSize(tier, cellWidth) {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const minFont = isMobile ? 8 : 10;

        if (tier === LABEL_TIER.LARGE) {
            return Math.max(minFont, Math.min(18, cellWidth * 0.28));
        }
        if (tier === LABEL_TIER.MEDIUM) {
            return Math.max(minFont, Math.min(13, cellWidth * 0.26));
        }
        if (tier === LABEL_TIER.SMALL) {
            return Math.max(minFont, Math.min(11, cellWidth * 0.3));
        }
        return 0;
    }

    function renderAxisLabels(colAxis, rowAxis, state) {
        if (!colAxis || !rowAxis) {
            return;
        }

        colAxis.textContent = '';
        rowAxis.textContent = '';

        getAxisMarkers(state.panelsWide).forEach((col) => {
            const label = document.createElement('span');
            label.className = 'led-preview-axis-label led-preview-axis-label--col';
            label.textContent = String(col);
            label.style.left = `${((col - 0.5) / state.panelsWide) * 100}%`;
            colAxis.appendChild(label);
        });

        getAxisMarkers(state.panelsTall).forEach((row) => {
            const label = document.createElement('span');
            label.className = 'led-preview-axis-label led-preview-axis-label--row';
            label.textContent = String(row);
            label.style.top = `${((row - 0.5) / state.panelsTall) * 100}%`;
            rowAxis.appendChild(label);
        });
    }

    function hideCabinetTooltip() {
        const tooltip = document.getElementById('led-cabinet-tooltip');
        if (tooltip) {
            tooltip.hidden = true;
        }
    }

    function showCabinetTooltip(cell, cabinetNumber, row, col) {
        const tooltip = document.getElementById('led-cabinet-tooltip');
        const stage = document.getElementById('led-preview-stage');
        if (!tooltip || !stage || !isDesktopPreview()) {
            return;
        }

        tooltip.innerHTML = `
            <strong>Cabinet ${cabinetNumber}</strong>
            <span>Column ${col + 1}</span>
            <span>Row ${row + 1}</span>
        `;
        tooltip.hidden = false;

        const stageRect = stage.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        let left = cellRect.left - stageRect.left + cellRect.width / 2 - tooltipWidth / 2;
        let top = cellRect.top - stageRect.top - tooltipHeight - 8;

        if (top < 4) {
            top = cellRect.bottom - stageRect.top + 8;
        }

        left = Math.max(4, Math.min(left, stageRect.width - tooltipWidth - 4));
        top = Math.max(4, Math.min(top, stageRect.height - tooltipHeight - 4));

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    function bindPreviewHover(wall) {
        if (!wall || previewHoverBound) {
            return;
        }

        previewHoverBound = true;
        wall.addEventListener('mouseover', (event) => {
            const cell = event.target.closest('.led-cabinet');
            if (!cell || !wall.contains(cell)) {
                return;
            }

            const index = parseInt(cell.dataset.index, 10);
            if (!Number.isFinite(index)) {
                return;
            }

            const currentState = getState();
            const row = Math.floor(index / currentState.panelsWide);
            const col = index % currentState.panelsWide;
            showCabinetTooltip(cell, index + 1, row, col);
        });

        wall.addEventListener('mouseout', (event) => {
            const cell = event.target.closest('.led-cabinet');
            const related = event.relatedTarget;
            if (cell && related && cell.contains(related)) {
                return;
            }
            hideCabinetTooltip();
        });

        wall.addEventListener('mouseleave', hideCabinetTooltip);
    }

    function updateOverlayDebug(state) {
        const debugEl = document.getElementById('led-overlay-debug');
        if (!debugEl) {
            return;
        }

        if (!OVERLAY_DEBUG || !state.overlay) {
            debugEl.hidden = true;
            return;
        }

        debugEl.hidden = false;
        setText('debug-wall-pixels', `${state.totalPixelWidth} × ${state.totalPixelHeight}`);
        setText('debug-wall-ratio', state.aspectRatio.toFixed(3));
        setText('debug-overlay-pixels', `${state.overlay.overlayPixelWidth} × ${state.overlay.overlayPixelHeight}`);
        setText('debug-overlay-ratio', state.overlay.overlayAspectRatio.toFixed(3));
        setText('debug-overlay-position', `left ${state.overlay.leftPercent.toFixed(2)}% · top ${state.overlay.topPercent.toFixed(2)}%`);
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    function renderPreview(state) {
        const stage = document.getElementById('led-preview-stage');
        const wall = document.getElementById('led-preview-wall');
        if (!stage || !wall) {
            return;
        }

        hideCabinetTooltip();

        const wallPhysicalAspect = getWallPhysicalAspect(state);
        const numbersEnabled = isCabinetNumbersEnabled();
        const axisGutterX = 28;
        const axisGutterY = 22;

        function fitWallToStage(stageWidth, stageHeight, reserveAxisSpace) {
            let availableWidth = stageWidth;
            let availableHeight = stageHeight;

            if (reserveAxisSpace) {
                availableWidth -= axisGutterX;
                availableHeight -= axisGutterY;
            }

            if (availableWidth / availableHeight > wallPhysicalAspect) {
                return {
                    wallHeight: availableHeight,
                    wallWidth: availableHeight * wallPhysicalAspect
                };
            }

            return {
                wallWidth: availableWidth,
                wallHeight: availableWidth / wallPhysicalAspect
            };
        }

        const stageWidth = stage.clientWidth - 32;
        const stageHeight = stage.clientHeight - 32;
        let { wallWidth, wallHeight } = fitWallToStage(stageWidth, stageHeight, false);
        let cellWidth = wallWidth / state.panelsWide;
        let tier = getLabelTier(cellWidth);
        let showAxisLabels = numbersEnabled && tier === LABEL_TIER.TINY;

        if (showAxisLabels) {
            ({ wallWidth, wallHeight } = fitWallToStage(stageWidth, stageHeight, true));
            cellWidth = wallWidth / state.panelsWide;
            tier = getLabelTier(cellWidth);
            showAxisLabels = numbersEnabled && tier === LABEL_TIER.TINY;
        }

        wall.style.width = `${wallWidth}px`;
        wall.style.height = `${wallHeight}px`;
        wall.style.gridTemplateColumns = `repeat(${state.panelsWide}, ${state.cabinetWidthMM}fr)`;
        wall.style.gridTemplateRows = `repeat(${state.panelsTall}, ${state.cabinetHeightMM}fr)`;

        const totalPanels = state.totalPanels;
        const cellHeight = wallHeight / state.panelsTall;
        const wallContainer = document.getElementById('led-preview-wall-container');
        const colAxis = document.getElementById('led-preview-col-axis');
        const rowAxis = document.getElementById('led-preview-row-axis');

        if (wallContainer) {
            wallContainer.classList.toggle('has-axis-labels', showAxisLabels);
        }
        if (colAxis) {
            colAxis.hidden = !showAxisLabels;
        }
        if (rowAxis) {
            rowAxis.hidden = !showAxisLabels;
        }
        if (showAxisLabels) {
            renderAxisLabels(colAxis, rowAxis, state);
        }

        const existingCells = wall.querySelectorAll('.led-cabinet');
        if (existingCells.length !== totalPanels) {
            wall.textContent = '';
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < totalPanels; i++) {
                fragment.appendChild(createCabinetCell(i));
            }

            const overlayLayer = document.createElement('div');
            overlayLayer.className = 'led-overlay-layer';
            overlayLayer.id = 'led-overlay-layer';
            overlayLayer.hidden = true;
            fragment.appendChild(overlayLayer);
            wall.appendChild(fragment);
        }

        applyCabinetArtToWall(wall, state);

        const cells = wall.querySelectorAll('.led-cabinet');
        cells.forEach((cell, index) => {
            const row = Math.floor(index / state.panelsWide);
            const col = index % state.panelsWide;
            const cabinetNumber = index + 1;
            const label = cell.querySelector('.led-cabinet-label');
            cell.classList.remove('dimmed');
            cell.dataset.index = String(index);
            cell.dataset.row = String(row);
            cell.dataset.col = String(col);
            cell.classList.remove('label-large', 'label-medium', 'label-small');

            if (label && numbersEnabled && shouldShowCabinetNumber(cabinetNumber, tier)) {
                label.textContent = String(cabinetNumber);
                label.style.fontSize = `${getTierFontSize(tier, cellWidth)}px`;
                if (tier === LABEL_TIER.LARGE) {
                    cell.classList.add('label-large');
                } else if (tier === LABEL_TIER.MEDIUM) {
                    cell.classList.add('label-medium');
                } else {
                    cell.classList.add('label-small');
                }
            } else if (label) {
                label.textContent = '';
                label.style.fontSize = '';
            }
        });

        bindPreviewHover(wall);
        renderOverlayLayer(state);
    }

    function renderOverlayLayer(state) {
        const layer = document.getElementById('led-overlay-layer');
        if (!layer) {
            return;
        }

        if (!state.overlay) {
            layer.hidden = true;
            layer.innerHTML = '';
            return;
        }

        layer.hidden = false;
        const { leftPercent, topPercent, widthPercent, heightPercent, unusedHorizontal, unusedVertical } = state.overlay;
        const shades = [];

        if (unusedVertical > 0) {
            shades.push(`<div class="led-overlay-shade" style="left:0;top:0;width:100%;height:${topPercent}%;"></div>`);
            shades.push(`<div class="led-overlay-shade" style="left:0;top:${topPercent + heightPercent}%;width:100%;height:${100 - topPercent - heightPercent}%;"></div>`);
        }

        if (unusedHorizontal > 0) {
            shades.push(`<div class="led-overlay-shade" style="left:0;top:${topPercent}%;width:${leftPercent}%;height:${heightPercent}%;"></div>`);
            shades.push(`<div class="led-overlay-shade" style="left:${leftPercent + widthPercent}%;top:${topPercent}%;width:${100 - leftPercent - widthPercent}%;height:${heightPercent}%;"></div>`);
        }

        layer.innerHTML = `
            ${shades.join('')}
            <div class="led-overlay-frame" style="left:${leftPercent}%;top:${topPercent}%;width:${widthPercent}%;height:${heightPercent}%;">
                <span class="led-overlay-label">${state.overlayFormatLabel}</span>
            </div>
        `;
    }

    function updateAll() {
        if (isAutoCalculateEnabled()) {
            syncAutoPixelResolution();
        }

        const state = getState();
        updateQuickStartUI(state);
        updateResults(state);
        updateContentFit(state);
        renderPreview(state);
    }

    function runOverlayTests() {
        const targetRatio = 16 / 9;
        const tests = [
            {
                name: '500x500 P2.9 10x6',
                wallWidth: 1680,
                wallHeight: 1008,
                expectWidth: 1680,
                expectHeight: 945,
                expectUnusedHorizontal: 0,
                expectUnusedVertical: 63,
                expectTopPercent: 3.125
            },
            {
                name: '500x1000 P2.9 19x5',
                wallWidth: 3192,
                wallHeight: 1680,
                expectWidth: 2987,
                expectHeight: 1680,
                expectUnusedHorizontal: 205,
                expectUnusedVertical: 0,
                expectTopPercent: 0
            },
            {
                name: '500x1000 Mesh 3.9x7.8 19x5',
                wallWidth: 2432,
                wallHeight: 640,
                expectWidth: 1138,
                expectHeight: 640,
                expectUnusedHorizontal: 1294,
                expectUnusedVertical: 0,
                expectTopPercent: 0,
                expectLeftPercent: 26.604605263157895
            }
        ];

        const failures = [];
        let passed = 0;
        tests.forEach((test) => {
            const overlay = calculateContentOverlay({
                totalPixelWidth: test.wallWidth,
                totalPixelHeight: test.wallHeight,
                targetRatio
            });
            const expectLeftPercent = ((test.wallWidth - test.expectWidth) / 2 / test.wallWidth) * 100;
            const ok = overlay.overlayPixelWidth === test.expectWidth
                && overlay.overlayPixelHeight === test.expectHeight
                && overlay.unusedHorizontal === test.expectUnusedHorizontal
                && overlay.unusedVertical === test.expectUnusedVertical
                && Math.abs(overlay.topPercent - test.expectTopPercent) < 0.001
                && Math.abs(overlay.leftPercent - (test.expectLeftPercent ?? expectLeftPercent)) < 0.001;

            if (ok) {
                passed += 1;
            } else {
                failures.push(test.name);
            }
        });

        if (failures.length && OVERLAY_DEBUG) {
            window.__ledOverlayTestFailures = failures;
        }

        return passed === tests.length;
    }

    window.initLedWallVisualizer = initLedWallVisualizer;
    window.runLedOverlayTests = runOverlayTests;

    document.addEventListener('DOMContentLoaded', () => {
        initLedWallVisualizer();
        if (new URLSearchParams(window.location.search).has('test')) {
            runOverlayTests();
        }
    });
})();
