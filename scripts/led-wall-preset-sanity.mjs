/**
 * Sanity checks for LED Video Wall Calculator preset cases.
 * Run: node scripts/led-wall-preset-sanity.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const calcDir = path.join(__dirname, '..', 'tools', 'led-wall-calculator');

function loadCalculator() {
    const ctx = { OkamiLedWallCalculator: {} };
    for (const file of ['constants.js', 'calculations.js']) {
        vm.runInNewContext(fs.readFileSync(path.join(calcDir, file), 'utf8'), ctx);
    }
    return ctx.OkamiLedWallCalculator;
}

function formatFeetInches(feetDecimal) {
    const totalInches = Math.round(feetDecimal * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}' ${inches}"`;
}

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
}

function assertNotMultiple(actual, divisor, label) {
    if (divisor > 0 && actual % divisor === 0) {
        throw new Error(`${label}: overlay dimension ${actual} snapped to cabinet grid (${divisor}px)`);
    }
}

const Calc = loadCalculator();
const base = {
    portCapacity: 650000,
    portFillThreshold: 90,
    overlayFormat: '16:9',
    autoCalculateResolution: true,
    displayType: 'standard'
};

const cases = [
    {
        name: 'page load default — 500×500 P3.9 10×6',
        inputs: {
            cabinetPreset: '500x500',
            pitchPreset: '3.9',
            panelsWide: 10,
            panelsTall: 6
        },
        checks: (r) => {
            assertEqual(r.pixelWidth, 128, 'cabinet width px');
            assertEqual(r.pixelHeight, 128, 'cabinet height px');
            assertEqual(r.totalPixelWidth, 1280, 'wall width px');
            assertEqual(r.totalPixelHeight, 768, 'wall height px');
            assertEqual(r.totalPanels, 60, 'panels');
            assertEqual(r.totalPixels, 983040, 'total pixels');
            assertEqual(r.portsRequired, 2, 'ports');
        }
    },
    {
        name: '500x500 P2.9, 10 wide x 6 high',
        inputs: { cabinetPreset: '500x500', pitchPreset: '2.9', panelsWide: 10, panelsTall: 6 },
        checks: (r) => {
            assertEqual(r.pixelWidth, 168, 'cabinet width px');
            assertEqual(r.pixelHeight, 168, 'cabinet height px');
            assertEqual(r.totalPixelWidth, 1680, 'wall width px');
            assertEqual(r.totalPixelHeight, 1008, 'wall height px');
            assertEqual(r.totalPanels, 60, 'panels');
            assertEqual(r.totalPixels, 1693440, 'total pixels');
            assertEqual(r.portsRequired, 3, 'ports');
            assertEqual(formatFeetInches(r.physicalWidthFt), `16' 5"`, 'physical width');
            assertEqual(formatFeetInches(r.physicalHeightFt), `9' 10"`, 'physical height');
            assertEqual(r.overlay.overlayPixelWidth, 1680, 'overlay width');
            assertEqual(r.overlay.overlayPixelHeight, 945, 'overlay height');
            assertEqual(r.overlay.unusedVertical, 63, 'unused vertical');
            assertNotMultiple(r.overlay.overlayPixelHeight, 168, 'overlay height');
        }
    },
    {
        name: '500x1000 P2.9, 10 wide x 6 high',
        inputs: {
            cabinetPreset: '500x1000',
            pitchPreset: '2.9',
            panelsWide: 10,
            panelsTall: 6,
            cabinetWidthMM: 500,
            cabinetHeightMM: 1000
        },
        checks: (r) => {
            assertEqual(r.pixelWidth, 168, 'cabinet width px');
            assertEqual(r.pixelHeight, 336, 'cabinet height px');
            assertEqual(r.totalPixelWidth, 1680, 'wall width px');
            assertEqual(r.totalPixelHeight, 2016, 'wall height px');
            assertEqual(r.totalPanels, 60, 'panels');
            assertEqual(r.cabinetArtworkType, 'tall', 'artwork type');
            assertEqual(r.overlay.overlayPixelWidth, 1680, 'overlay width');
            assertEqual(r.overlay.overlayPixelHeight, 945, 'overlay height');
            assertEqual(r.overlay.unusedVertical, 1071, 'unused vertical');
            assertNotMultiple(r.overlay.overlayPixelHeight, 336, 'overlay height');
        }
    },
    {
        name: '500x1000 P2.9, 19 wide x 5 high',
        inputs: {
            cabinetPreset: '500x1000',
            pitchPreset: '2.9',
            panelsWide: 19,
            panelsTall: 5,
            cabinetWidthMM: 500,
            cabinetHeightMM: 1000
        },
        checks: (r) => {
            assertEqual(r.pixelWidth, 168, 'cabinet width px');
            assertEqual(r.pixelHeight, 336, 'cabinet height px');
            assertEqual(r.totalPixelWidth, 3192, 'wall width px');
            assertEqual(r.totalPixelHeight, 1680, 'wall height px');
            assertEqual(r.totalPanels, 95, 'panels');
            assertEqual(formatFeetInches(r.physicalWidthFt), `31' 2"`, 'physical width');
            assertEqual(formatFeetInches(r.physicalHeightFt), `16' 5"`, 'physical height');
            assertEqual(r.overlay.overlayPixelWidth, 2987, 'overlay width');
            assertEqual(r.overlay.overlayPixelHeight, 1680, 'overlay height');
            assertEqual(r.overlay.unusedHorizontal, 205, 'unused horizontal');
            assertNotMultiple(r.overlay.overlayPixelWidth, 168, 'overlay width');
        }
    },
    {
        name: '500x500 P3.9, 18 wide x 5 high',
        inputs: { cabinetPreset: '500x500', pitchPreset: '3.9', panelsWide: 18, panelsTall: 5 },
        checks: (r) => {
            assertEqual(r.pixelWidth, 128, 'cabinet width px');
            assertEqual(r.pixelHeight, 128, 'cabinet height px');
            assertEqual(r.totalPixelWidth, 2304, 'wall width px');
            assertEqual(r.totalPixelHeight, 640, 'wall height px');
            assertEqual(r.totalPanels, 90, 'panels');
            assertEqual(r.overlay.overlayPixelHeight, 640, 'overlay full height');
            assertEqual(r.overlay.overlayPixelWidth, 1138, 'overlay width');
            assertEqual(r.overlay.unusedHorizontal, 1166, 'unused horizontal');
            assertEqual(r.overlay.unusedVertical, 0, 'unused vertical');
        }
    },
    {
        name: '500x500 P5.9, 20 wide x 8 high',
        inputs: { cabinetPreset: '500x500', pitchPreset: '5.9', panelsWide: 20, panelsTall: 8 },
        checks: (r) => {
            assertEqual(r.pixelWidth, 84, 'cabinet width px');
            assertEqual(r.pixelHeight, 84, 'cabinet height px');
            assertEqual(r.totalPixelWidth, 1680, 'wall width px');
            assertEqual(r.totalPixelHeight, 672, 'wall height px');
            assertEqual(r.totalPanels, 160, 'panels');
            assertEqual(r.totalPixels, 1128960, 'total pixels');
            assertEqual(r.portsRequired, 2, 'ports');
        }
    }
];

let passed = 0;
const failures = [];

for (const testCase of cases) {
    try {
        const result = Calc.computeWallProject({ ...base, ...testCase.inputs });
        const fill = Calc.calculatePortFill({ portCapacity: 650000, portFillThreshold: 90 });
        assertEqual(fill.usablePixelsPerPort, 585000, 'usable pixels per port');
        testCase.checks(result);
        console.log(`PASS  ${testCase.name}`);
        passed += 1;
    } catch (error) {
        console.log(`FAIL  ${testCase.name} — ${error.message}`);
        failures.push(testCase.name);
    }
}

console.log(`\n${passed}/${cases.length} preset sanity checks passed\n`);
process.exit(failures.length ? 1 : 0);
