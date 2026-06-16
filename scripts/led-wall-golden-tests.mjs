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
