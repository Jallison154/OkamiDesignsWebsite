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
        name: '10×6 @ P2.6 500×500 (default quick start)',
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
        name: '500×500 P2.9 10×6',
        fn: () => {
            const r = Calc.computeWallProject({
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '2.9',
                displayType: 'standard',
                autoCalculateResolution: true,
                overlayFormat: 'none'
            });
            assertEqual(r.pixelWidth, 168, 'pixelWidth');
            assertEqual(r.totalPixelWidth, 1680, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 1008, 'totalPixelHeight');
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
            const defaults = {
                panelsWide: 10,
                panelsTall: 6,
                cabinetPreset: '500x500',
                pitchPreset: '2.6',
                displayType: 'standard',
                cabinetWidthMM: 500,
                cabinetHeightMM: 500,
                pixelPitchMM: 2.6,
                autoCalculateResolution: true,
                portCapacity: 650000,
                portFillThreshold: 90,
                overlayFormat: '16:9'
            };
            const r = Calc.computeWallProject(defaults);
            assertEqual(r.totalPixelWidth, 1920, 'totalPixelWidth');
            assertEqual(r.totalPixelHeight, 1152, 'totalPixelHeight');
            assertEqual(r.portsRequired, 4, 'portsRequired');
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
