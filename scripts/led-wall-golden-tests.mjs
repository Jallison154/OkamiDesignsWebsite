/**
 * Golden tests for tools/led-wall-calculator/ (Node, no DOM).
 * Run: node scripts/led-wall-golden-tests.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const calcDir = path.join(__dirname, '..', 'tools', 'led-wall-calculator');

function loadCalculator() {
    const ctx = { OkamiLedWallCalculator: {} };
    for (const file of ['constants.js', 'calculations.js', 'metrics.js']) {
        vm.runInNewContext(fs.readFileSync(path.join(calcDir, file), 'utf8'), ctx);
    }
    return ctx.OkamiLedWallCalculator;
}

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
}

function assertNear(actual, expected, epsilon, label) {
    if (Math.abs(actual - expected) > epsilon) {
        throw new Error(`${label}: expected ~${expected}, got ${actual}`);
    }
}

const Calc = loadCalculator();

const cases = [
    {
        name: '10×6 @ P3.9 500×500 (default quick start)',
        fn: () => {
            const { DEFAULTS } = Calc.Constants;
            const r = Calc.computeWallProject({
                panelsWide: DEFAULTS.panelsWide,
                panelsTall: DEFAULTS.panelsTall,
                cabinetPreset: DEFAULTS.cabinetPreset,
                pitchPreset: DEFAULTS.pitchPreset,
                pixelPitchMM: DEFAULTS.pixelPitchMM,
                displayType: DEFAULTS.displayType,
                autoCalculateResolution: DEFAULTS.autoCalculateResolution,
                portCapacity: DEFAULTS.portCapacity,
                portFillThreshold: DEFAULTS.portFillThreshold,
                overlayFormat: DEFAULTS.overlayFormat
            });
            assertEqual(DEFAULTS.pitchPreset, '3.9', 'DEFAULTS.pitchPreset');
            assertEqual(r.totalPixelWidth, 1280, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 768, 'totalPixelHeight');
            assertEqual(r.totalPanels, 60, 'totalPanels');
            assertEqual(r.totalPixels, 983040, 'totalPixels');
            assertEqual(r.portsRequired, 2, 'portsRequired');
            assertEqual(r.pixelWidth, 128, 'pixelWidth');
            assertEqual(r.pixelHeight, 128, 'pixelHeight');
            assertNear(r.overlay.usedPercentage, 93.75, 0.01, 'overlay usedPercentage');
        }
    },
    {
        name: '10×6 @ P2.6 500×500',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                pixelPitchMM: 2.6,
                cabinetWidthMM: 500,
                cabinetHeightMM: 500,
                cabinetPreset: '500x500',
                pitchPreset: '2.6',
                displayType: 'standard',
                autoCalculateResolution: true,
                portCapacity: 650000,
                portFillThreshold: 90,
                overlayFormat: '16:9'
            });
            assertEqual(r.totalPixelWidth, 1920, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 1152, 'totalPixelHeight');
            assertEqual(r.totalPanels, 60, 'totalPanels');
            assertEqual(r.portsRequired, 4, 'portsRequired');
            assertEqual(r.pixelWidth, 192, 'pixelWidth');
            assertEqual(r.pixelHeight, 192, 'pixelHeight');
            assertNear(r.overlay.usedPercentage, 93.75, 0.01, 'overlay usedPercentage');
        }
    },
    {
        name: '500×1000 cabinet P2.6 4×3 grid',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 4,
                panelsTall: 3,
                cabinetPreset: '500x1000',
                pitchPreset: '2.6',
                displayType: 'standard',
                autoCalculateResolution: true,
                portCapacity: 650000,
                portFillThreshold: 90,
                overlayFormat: 'none'
            });
            assertEqual(r.pixelWidth, 192, 'pixelWidth');
            assertEqual(r.pixelHeight, 384, 'pixelHeight');
            assertEqual(r.totalPixelWidth, 768, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 1152, 'totalPixelHeight');
        }
    },
    {
        name: 'Manual resolution override 128×128 × 5×5',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 5,
                panelsTall: 5,
                pixelWidth: 128,
                pixelHeight: 128,
                autoCalculateResolution: false,
                portCapacity: 650000,
                portFillThreshold: 90,
                overlayFormat: 'none'
            });
            assertEqual(r.totalPixelWidth, 640, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 640, 'totalPixelHeight');
            assertEqual(r.totalPixels, 409600, 'totalPixels');
        }
    },
    {
        name: 'Signal Lab metrics — 10×6 @ 192 px panels',
        fn: () => {
            const r = Calc.calculateLedWall({
                panelWidthPx: 192,
                panelHeightPx: 192,
                panelsWide: 10,
                panelsTall: 6
            });
            assertEqual(r.totalWidth, 1920, 'totalWidth');
            assertEqual(r.totalHeight, 1152, 'totalHeight');
            assertEqual(r.closestAspectLabel, '16:9', 'closestAspectLabel');
            assertEqual(r.resolutionLabel, '1920 × 1152', 'resolutionLabel');
            assertEqual(typeof r.hasWarnings, 'boolean', 'hasWarnings type');
        }
    },
    {
        name: 'formatExactAspectRatio 1920×1080',
        fn: () => {
            const label = Calc.formatExactAspectRatio(1920, 1080);
            if (!label.includes('16:9')) {
                throw new Error(`formatExactAspectRatio: expected 16:9 in "${label}"`);
            }
        }
    },
    {
        name: '500×500 P1.9 10×6',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '1.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                overlayFormat: 'none'
            });
            assertEqual(r.pixelWidth, 263, 'pixelWidth');
            assertEqual(r.pixelHeight, 263, 'pixelHeight');
            assertEqual(r.totalPixelWidth, 2630, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 1578, 'totalPixelHeight');
        }
    },
    {
        name: '500×500 P2.9 10×6 — overlay + ports',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '2.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                portCapacity: 650000,
                portFillThreshold: 90,
                overlayFormat: '16:9'
            });
            assertEqual(r.totalPixels, 1693440, 'totalPixels');
            assertEqual(r.portsRequired, 3, 'portsRequired');
            assertEqual(r.overlay.overlayPixelWidth, 1680, 'overlay width');
            assertEqual(r.overlay.overlayPixelHeight, 945, 'overlay height');
            assertNear(r.overlay.usedPercentage, 93.75, 0.01, 'overlay usedPercentage');
        }
    },
    {
        name: '500×1000 P2.9 10×6 — tall portrait overlay',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x1000',
                pitchPreset: '2.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                portCapacity: 650000,
                portFillThreshold: 90,
                overlayFormat: '16:9'
            });
            assertEqual(r.totalPixelHeight, 2016, 'totalPixelHeight');
            assertEqual(r.cabinetArtworkType, 'tall', 'cabinetArtworkType');
            assertEqual(r.overlay.overlayPixelHeight, 945, 'overlay height');
            assertEqual(r.overlay.unusedVertical, 1071, 'unused vertical');
            if (r.overlay.overlayPixelHeight % r.pixelHeight === 0) {
                throw new Error('overlay height snapped to cabinet grid');
            }
        }
    },
    {
        name: '500×1000 P2.9 19×5 — wide wall overlay',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 19,
                panelsTall: 5,
                cabinetPreset: '500x1000',
                pitchPreset: '2.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                overlayFormat: '16:9'
            });
            assertEqual(r.totalPanels, 95, 'totalPanels');
            assertEqual(r.totalPixelWidth, 3192, 'totalPixelWidth');
            assertEqual(r.overlay.overlayPixelWidth, 2987, 'overlay width');
            assertEqual(r.overlay.unusedHorizontal, 205, 'unused horizontal');
        }
    },
    {
        name: '500×500 P3.9 18×5 — letterbox left/right',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 18,
                panelsTall: 5,
                cabinetPreset: '500x500',
                pitchPreset: '3.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                overlayFormat: '16:9'
            });
            assertEqual(r.totalPixelWidth, 2304, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 640, 'totalPixelHeight');
            assertEqual(r.overlay.overlayPixelHeight, 640, 'overlay full height');
            assertEqual(r.overlay.overlayPixelWidth, 1138, 'overlay width');
            assertEqual(r.overlay.unusedHorizontal, 1166, 'unused horizontal');
        }
    },
    {
        name: '500×500 P5.9 20×8',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 20,
                panelsTall: 8,
                cabinetPreset: '500x500',
                pitchPreset: '5.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                overlayFormat: 'none'
            });
            assertEqual(r.pixelWidth, 84, 'pixelWidth');
            assertEqual(r.totalPanels, 160, 'totalPanels');
            assertEqual(r.totalPixels, 1128960, 'totalPixels');
            assertEqual(r.portsRequired, 2, 'portsRequired');
        }
    },
    {
        name: 'physical size feet/inches — 500×500 P2.9 10×6',
        fn: () => {
            const formatFeetInches = (feetDecimal) => {
                const totalInches = Math.round(feetDecimal * 12);
                const feet = Math.floor(totalInches / 12);
                const inches = totalInches % 12;
                return `${feet}' ${inches}"`;
            };
            const r = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '2.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                overlayFormat: 'none'
            });
            assertEqual(formatFeetInches(r.physicalWidthFt), `16' 5"`, 'physical width');
            assertEqual(formatFeetInches(r.physicalHeightFt), `9' 10"`, 'physical height');
        }
    },
    {
        name: '500×500 P5.9 10×6',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '5.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                overlayFormat: 'none'
            });
            assertEqual(r.pixelWidth, 84, 'pixelWidth');
            assertEqual(r.totalPixelWidth, 840, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 504, 'totalPixelHeight');
        }
    },
    {
        name: '500×1000 P1.9 4×3',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 4,
                panelsTall: 3,
                cabinetPreset: '500x1000',
                cabinetWidthMM: 500,
                cabinetHeightMM: 1000,
                pitchPreset: '1.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                overlayFormat: 'none'
            });
            assertEqual(r.pixelWidth, 263, 'pixelWidth');
            assertEqual(r.pixelHeight, 526, 'pixelHeight');
            assertEqual(r.totalPixelWidth, 1052, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 1578, 'totalPixelHeight');
            assertEqual(r.cabinetArtworkType, 'tall', 'cabinetArtworkType');
        }
    },
    {
        name: '90% port fill threshold — usable pixels per port',
        fn: () => {
            const fill = Calc.calculatePortFill({ portCapacity: 650000, portFillThreshold: 90 });
            assertEqual(fill.usablePixelsPerPort, 585000, 'usablePixelsPerPort');
            assertEqual(fill.portFillThreshold, 90, 'portFillThreshold');
        }
    },
    {
        name: 'port safe capacity metrics — default 10×6 wall',
        fn: () => {
            const { DEFAULTS } = Calc.Constants;
            const r = Calc.computeWallProject({
                panelsWide: DEFAULTS.panelsWide,
                panelsTall: DEFAULTS.panelsTall,
                cabinetPreset: DEFAULTS.cabinetPreset,
                pitchPreset: DEFAULTS.pitchPreset,
                displayType: DEFAULTS.displayType,
                autoCalculateResolution: true,
                portCapacity: DEFAULTS.portCapacity,
                portFillThreshold: DEFAULTS.portFillThreshold,
                overlayFormat: 'none'
            });
            assertEqual(r.usablePixelsPerPort, 585000, 'usablePixelsPerPort');
            assertEqual(r.portsRequired, 2, 'portsRequired');
            assertEqual(r.peakSafeCapacityUsedPercent, 100, 'peakSafeCapacityUsedPercent');
            assertEqual(r.peakRawMaxLoadPercent, 90, 'peakRawMaxLoadPercent');
            assertEqual(r.processorPortHeadroomPercent, 10, 'processorPortHeadroomPercent');
            assertEqual(r.atSafePortLimit, true, 'atSafePortLimit');
        }
    },
    {
        name: 'content overlay 16:9 on 1920×1152 wall',
        fn: () => {
            const overlay = Calc.calculateContentOverlay({
                totalPixelWidth: 1920,
                totalPixelHeight: 1152,
                targetRatio: 16 / 9
            });
            assertEqual(overlay.overlayPixelWidth, 1920, 'overlayPixelWidth');
            assertEqual(overlay.overlayPixelHeight, 1080, 'overlayPixelHeight');
            assertEqual(overlay.unusedVertical, 72, 'unusedVertical');
            assertNear(overlay.usedPercentage, 93.75, 0.01, 'usedPercentage');
        }
    },
    {
        name: 'reset defaults — full project snapshot',
        fn: () => {
            const { DEFAULTS } = Calc.Constants;
            const r = Calc.computeWallProject({
                panelsWide: DEFAULTS.panelsWide,
                panelsTall: DEFAULTS.panelsTall,
                cabinetPreset: DEFAULTS.cabinetPreset,
                pitchPreset: DEFAULTS.pitchPreset,
                displayType: DEFAULTS.displayType,
                cabinetWidthMM: DEFAULTS.cabinetWidthMM,
                cabinetHeightMM: DEFAULTS.cabinetHeightMM,
                pixelPitchMM: DEFAULTS.pixelPitchMM,
                autoCalculateResolution: DEFAULTS.autoCalculateResolution,
                portCapacity: DEFAULTS.portCapacity,
                portFillThreshold: DEFAULTS.portFillThreshold,
                overlayFormat: DEFAULTS.overlayFormat
            });
            assertEqual(r.totalPixelWidth, 1280, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 768, 'totalPixelHeight');
            assertEqual(r.portsRequired, 2, 'portsRequired');
            assertEqual(r.cabinetArtworkType, 'square', 'cabinetArtworkType');
            assertNear(r.overlay.usedPercentage, 93.75, 0.01, 'overlay usedPercentage');
        }
    },
    {
        name: 'Custom LED Spacing 2.6×2.6 matches Standard P2.6 defaults',
        fn: () => {
            const standard = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '2.6',
                displayType: 'standard',
                autoCalculateResolution: true,
                overlayFormat: '16:9'
            });
            const customSpacing = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '2.6',
                displayType: 'customSpacing',
                meshPitchHorizontalMM: 2.6,
                meshPitchVerticalMM: 2.6,
                autoCalculateResolution: true,
                overlayFormat: '16:9'
            });
            assertEqual(customSpacing.totalPixelWidth, standard.totalPixelWidth, 'totalPixelWidth');
            assertEqual(customSpacing.totalPixelHeight, standard.totalPixelHeight, 'totalPixelHeight');
            assertEqual(customSpacing.portsRequired, standard.portsRequired, 'portsRequired');
            assertNear(customSpacing.overlay.usedPercentage, standard.overlay.usedPercentage, 0.01, 'overlay usedPercentage');
        }
    },
    {
        name: 'Legacy transparent display type still loads custom spacing math',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 19,
                panelsTall: 5,
                cabinetPreset: '500x1000',
                cabinetWidthMM: 500,
                cabinetHeightMM: 1000,
                displayType: 'transparent',
                meshPitchHorizontalMM: 3.9,
                meshPitchVerticalMM: 7.8,
                autoCalculateResolution: true,
                overlayFormat: 'none'
            });
            assertEqual(r.pixelWidth, 128, 'pixelWidth');
            assertEqual(r.pixelHeight, 128, 'pixelHeight');
            assertEqual(r.totalPixelWidth, 2432, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 640, 'totalPixelHeight');
        }
    },
    {
        name: 'calculateCabinetResolution preset table P3.9',
        fn: () => {
            const r = Calc.calculateCabinetResolution({
                cabinetPreset: '500x500',
                pitchPreset: '3.9',
                displayType: 'standard'
            });
            assertEqual(r.pixelWidth, 128, 'pixelWidth');
            assertEqual(r.pixelHeight, 128, 'pixelHeight');
        }
    },
    {
        name: 'estimated power — default 10×6 wall',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '2.6',
                displayType: 'standard',
                autoCalculateResolution: true,
                wattsPerPanel: 200,
                circuitAmperage: 20,
                circuitVoltage: 120,
                circuitSafeLoadPercent: 80,
                overlayFormat: 'none'
            });
            assertEqual(r.totalEstimatedWatts, 12000, 'totalEstimatedWatts');
            assertNear(r.totalEstimatedAmps, 100, 0.01, 'totalEstimatedAmps');
            assertEqual(r.rawWattsPerCircuit, 2400, 'rawWattsPerCircuit');
            assertEqual(r.circuitSafeLoadPercent, 80, 'circuitSafeLoadPercent');
            assertEqual(r.circuitHeadroomPercent, 20, 'circuitHeadroomPercent');
            assertEqual(r.usableWattsPerCircuit, 1920, 'usableWattsPerCircuit');
            assertEqual(r.circuitsRequired, 7, 'circuitsRequired');
        }
    },
    {
        name: 'safe load capped at 80% — minimum 20% headroom',
        fn: () => {
            const fill = Calc.calculatePowerRequirements({
                totalPanels: 10,
                wattsPerPanel: 200,
                circuitAmperage: 20,
                circuitVoltage: 120,
                circuitSafeLoadPercent: 100
            });
            assertEqual(fill.circuitSafeLoadPercent, 80, 'circuitSafeLoadPercent capped');
            assertEqual(fill.circuitHeadroomPercent, 20, 'circuitHeadroomPercent');
            assertEqual(fill.usableWattsPerCircuit, 1920, 'usableWattsPerCircuit');
        }
    },
    {
        name: 'build sheet port mapping — 4 ports @ 90% fill',
        fn: () => {
            const ctx = { OkamiLedWallCalculator: {} };
            const calcDir = path.join(__dirname, '..', 'tools', 'led-wall-calculator');
            for (const file of ['constants.js', 'calculations.js', 'build-sheet-export.js']) {
                vm.runInNewContext(fs.readFileSync(path.join(calcDir, file), 'utf8'), ctx);
            }
            const state = ctx.OkamiLedWallCalculator.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '2.6',
                displayType: 'standard',
                autoCalculateResolution: true,
                portCapacity: 650000,
                portFillThreshold: 90,
                overlayFormat: 'none'
            });
            const mapping = ctx.OkamiLedWallCalculator.BuildSheetExport.calculatePortMapping(state);
            assertEqual(mapping.length, 4, 'port count');
            assertEqual(mapping[0].port, 1, 'first port number');
            assertEqual(mapping[3].pixels, state.totalPixels - (585000 * 3), 'last port remainder pixels');
        }
    },
    {
        name: 'Curved wall off — flat physical size unchanged',
        fn: () => {
            const base = {
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '3.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                portCapacity: 650000,
                portFillThreshold: 90,
                overlayFormat: '16:9'
            };
            const flat = Calc.computeWallProject(base);
            const withAngleSaved = Calc.computeWallProject({
                ...base,
                curvedWallMode: false,
                cabinetAnglePreset: '2.5'
            });
            assertEqual(withAngleSaved.totalPixelWidth, flat.totalPixelWidth, 'totalPixelWidth');
            assertEqual(withAngleSaved.portsRequired, flat.portsRequired, 'portsRequired');
            assertNear(withAngleSaved.physicalWidthFt, flat.physicalWidthFt, 0.001, 'physicalWidthFt');
            assertEqual(withAngleSaved.curvedWallActive, false, 'curvedWallActive');
        }
    },
    {
        name: 'Curved wall 10 wide @ 2.5° — chord, depth, and total angle',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetWidthMM: 500,
                cabinetHeightMM: 500,
                cabinetPreset: '500x500',
                pitchPreset: '3.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                portCapacity: 650000,
                portFillThreshold: 90,
                overlayFormat: '16:9',
                curvedWallMode: true,
                cabinetAnglePreset: '2.5'
            });
            assertEqual(r.curvedWallActive, true, 'curvedWallActive');
            assertNear(r.physicalWidthFt, r.surfaceWidthFeet, 0.001, 'physicalWidth equals surface');
            assertNear(r.totalCurveAngle, 22.5, 0.01, 'totalCurveAngle');
            assertNear(r.chordWidthFeet, 16.29, 0.05, 'chordWidthFeet');
            assertNear(r.curveDepthFeet, 0.798, 0.03, 'curveDepthFeet');
            assertNear(r.radiusFeet, 41.77, 0.1, 'radiusFeet');
            assertEqual(r.totalPixelWidth, 1280, 'pixels unchanged');
            assertEqual(r.portsRequired, 2, 'ports unchanged');
        }
    },
    {
        name: 'Curved wall custom angle resolves from inputs',
        fn: () => {
            const curved = Calc.calculateCurvedWallPhysical({
                curvedWallMode: true,
                cabinetAnglePreset: 'custom',
                customCabinetAngleDegrees: 5,
                cabinetWidthMM: 500,
                panelsWide: 4
            });
            assertEqual(curved.curvedWallActive, true, 'curvedWallActive');
            assertNear(curved.cabinetAngleDegrees, 5, 0.01, 'custom angle');
            assertNear(curved.totalCurveAngle, 15, 0.01, 'totalCurveAngle');
        }
    },
    {
        name: 'Curved wall single cabinet wide stays flat',
        fn: () => {
            const curved = Calc.calculateCurvedWallPhysical({
                curvedWallMode: true,
                cabinetAnglePreset: '5',
                cabinetWidthMM: 500,
                panelsWide: 1
            });
            assertEqual(curved.curvedWallActive, false, 'curvedWallActive');
            assertNear(curved.chordWidthFeet, curved.surfaceWidthFeet, 0.001, 'chord equals surface');
            assertEqual(curved.curveDepthFeet, 0, 'curveDepthFeet');
        }
    },
    {
        name: 'Curved wall rejects total angle over 180°',
        fn: () => {
            const curved = Calc.calculateCurvedWallPhysical({
                curvedWallMode: true,
                cabinetAnglePreset: 'custom',
                customCabinetAngleDegrees: 30,
                cabinetWidthMM: 500,
                panelsWide: 10
            });
            assertEqual(curved.curvedWallActive, false, 'curvedWallActive');
            assertEqual(curved.curvedWallAngleExceeded, true, 'curvedWallAngleExceeded');
            assertNear(curved.totalCurveAngle, 270, 0.01, 'totalCurveAngle raw');
        }
    },
    {
        name: 'Curved cabinet layout returns positions for preview',
        fn: () => {
            const state = Calc.computeWallProject({
                panelsWide: 6,
                panelsTall: 2,
                cabinetWidthMM: 500,
                cabinetHeightMM: 500,
                curvedWallMode: true,
                cabinetAnglePreset: '5'
            });
            const layout = Calc.computeCurvedCabinetLayout(state, 600, 200);
            if (!layout || layout.positions.length !== 6) {
                throw new Error('layout: expected 6 cabinet positions');
            }
            if (Math.abs(layout.positions[0].leftPx - layout.positions[1].leftPx) < 1) {
                throw new Error('layout: expected distinct column positions along arc');
            }
            const centerCol = Math.floor((state.panelsWide - 1) / 2);
            const edgeCol = state.panelsWide - 1;
            if (layout.positions[edgeCol].depthPx <= layout.positions[centerCol].depthPx) {
                throw new Error('layout: edge columns should have greater depth than center');
            }
        }
    }
];

let passed = 0;
const failures = [];

for (const testCase of cases) {
    try {
        testCase.fn();
        console.log(`PASS  ${testCase.name}`);
        passed += 1;
    } catch (error) {
        console.log(`FAIL  ${testCase.name} — ${error.message}`);
        failures.push(testCase.name);
    }
}

console.log(`\n${passed}/${cases.length} golden tests passed\n`);
process.exit(failures.length ? 1 : 0);
