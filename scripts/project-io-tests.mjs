/**
 * LED wall project I/O tests — node scripts/project-io-tests.mjs
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ProjectIO = require('../tools/led-wall-calculator/project-io.js');

const results = [];

function pass(name) {
    results.push({ name, ok: true });
}

function fail(name, detail) {
    results.push({ name, ok: false, detail });
}

function assert(name, condition, detail = '') {
    if (condition) {
        pass(name);
    } else {
        fail(name, detail);
    }
}

const sampleInputs = {
    cabinetPreset: '500x500',
    pitchPreset: '2.6',
    displayType: 'standard',
    cabinetWidthMM: 500,
    cabinetHeightMM: 500,
    pixelPitchMM: 2.6,
    panelsWide: 10,
    panelsTall: 6,
    portCapacity: 650000,
    portFillThreshold: 90,
    overlayFormat: '16:9',
    autoCalculateResolution: true
};

const sampleState = {
    panelsWide: 10,
    panelsTall: 6,
    totalPanels: 60,
    totalPixelWidth: 1920,
    totalPixelHeight: 1152,
    totalPixels: 2211840,
    physicalWidthFt: 16.4,
    physicalHeightFt: 9.84,
    aspectRatio: 1.6667,
    closestRatio: { label: '16:9' },
    portsRequired: 4,
    overlayFormat: '16:9',
    overlayFormatLabel: '16:9'
};

const payload = ProjectIO.buildProjectPayload(sampleInputs, sampleState);
assert('buildProjectPayload includes product id', payload.product === ProjectIO.PRODUCT_ID);
assert('buildProjectPayload preserves inputs', payload.inputs.panelsWide === 10);

const parsed = ProjectIO.parseProjectJson(JSON.stringify(payload));
assert('parseProjectJson round-trip', parsed.inputs.panelsWide === 10);

try {
    ProjectIO.validateProjectPayload({ product: 'wrong-product', inputs: {} });
    fail('reject wrong product', 'should throw');
} catch (error) {
    pass('reject wrong product');
}

try {
    ProjectIO.parseProjectJson('{not json');
    fail('reject invalid json', 'should throw');
} catch (error) {
    pass('reject invalid json');
}

const report = ProjectIO.buildReportText(sampleInputs, sampleState);
assert('buildReportText includes wall grid', report.includes('10 × 6'));

const failed = results.filter((entry) => !entry.ok);
results.forEach((entry) => {
    console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`);
});

if (failed.length) {
    console.error(`\n${failed.length} project I/O test(s) failed.`);
    process.exit(1);
}

console.log(`\n${results.length}/${results.length} project I/O tests passed.`);
