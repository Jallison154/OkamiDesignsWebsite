/**
 * Phase 0 acceptance gate — run: node scripts/phase-0-acceptance.mjs [baseUrl]
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

const BASE = process.argv[2] || `http://localhost:${process.env.PORT || 3000}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const results = [];

function pass(name, detail = '') {
    results.push({ name, ok: true, detail });
}

function fail(name, detail = '') {
    results.push({ name, ok: false, detail });
}

async function fetchOk(url, label) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            fail(label, `HTTP ${res.status} ${url}`);
            return null;
        }
        pass(label, url);
        return res;
    } catch (error) {
        fail(label, error.message);
        return null;
    }
}

function testLedCalculations() {
    const label = 'LED wall golden calculation (inline smoke)';
    try {
        const calcDir = path.join(root, 'tools', 'led-wall-calculator');
        const ctx = { OkamiLedWallCalculator: {} };
        for (const file of ['constants.js', 'calculations.js', 'metrics.js']) {
            vm.runInNewContext(fs.readFileSync(path.join(calcDir, file), 'utf8'), ctx);
        }
        const r = ctx.OkamiLedWallCalculator.computeWallProject({
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
        const ok = r.totalPixelWidth === 1920
            && r.totalPixelHeight === 1152
            && r.portsRequired === 4
            && r.totalPanels === 60;
        if (ok) {
            pass(label, '1920×1152, 4 ports, 60 cabinets');
        } else {
            fail(label, JSON.stringify({
                totalPixelWidth: r.totalPixelWidth,
                totalPixelHeight: r.totalPixelHeight,
                portsRequired: r.portsRequired,
                totalPanels: r.totalPanels
            }));
        }
    } catch (error) {
        fail(label, error.message);
    }
}

function testSharedNodeModules() {
    try {
        const pages = require(path.join(root, 'shared/registry/pages.js'));
        const settings = require(path.join(root, 'shared/settings/site-settings.js'));
        const visibility = require(path.join(root, 'shared/visibility/access-policy.js'));
        const trackable = pages.getTrackablePages().length;
        const access = visibility.getAccessDecision({
            pathValue: 'tools/signal-lab.html',
            settings: settings.DEFAULT_SITE_SETTINGS,
            isAdmin: false
        });
        if (trackable >= 8 && access.allowed) {
            pass('Shared Node modules', `${trackable} trackable pages, signal-lab allowed`);
        } else {
            fail('Shared Node modules', `trackable=${trackable} allowed=${access.allowed}`);
        }
    } catch (error) {
        fail('Shared Node modules', error.message);
    }
}

function testServerRequires() {
    try {
        require(path.join(root, 'server/commercial/routes.js'));
        pass('Server commercial routes module loads');
    } catch (error) {
        fail('Server commercial routes module loads', error.message);
    }
}

function testHtmlBootstrap(file, relPrefix, options = {}) {
    const label = `HTML bootstrap: ${file}`;
    const requireVisibility = options.requireVisibility !== false;
    try {
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        const required = [
            `${relPrefix}shared/settings/site-settings.js`,
            `${relPrefix}shared/registry/pages.js`,
            `${relPrefix}shared/visibility/access-policy.js`,
            `${relPrefix}page-registry.js`
        ];
        if (requireVisibility) {
            required.push(`${relPrefix}site-visibility.js`);
        }
        const missing = required.filter((s) => !html.includes(s));
        if (missing.length) {
            fail(label, `missing: ${missing.join(', ')}`);
        } else {
            pass(label);
        }
    } catch (error) {
        fail(label, error.message);
    }
}

function testSignalLabCalcShim() {
    const label = 'Signal Lab LED calc shim loads shared metrics';
    try {
        const calcDir = path.join(root, 'tools', 'led-wall-calculator');
        const ctx = {
            OkamiLedWallCalculator: {},
            OkamiSignalLab: {},
            window: {},
            globalThis: {}
        };
        ctx.window = ctx;
        ctx.globalThis = ctx;
        for (const file of ['constants.js', 'calculations.js', 'metrics.js']) {
            vm.runInNewContext(fs.readFileSync(path.join(calcDir, file), 'utf8'), ctx);
        }
        vm.runInNewContext(
            fs.readFileSync(path.join(root, 'tools/signal-lab/engine/led-wall-calculator.js'), 'utf8'),
            ctx
        );
        const r = ctx.OkamiSignalLab.LedWallCalculator.calculateLedWall({
            panelWidthPx: 192,
            panelHeightPx: 192,
            panelsWide: 10,
            panelsTall: 6
        });
        if (r.totalWidth !== 1920 || r.totalHeight !== 1152) {
            fail(label, `${r.totalWidth}×${r.totalHeight}`);
            return;
        }
        pass(label);
    } catch (error) {
        fail(label, error.message);
    }
}

function testCommercialFlagsDisabled() {
    const clientPath = path.join(root, 'client/commercial/commercial-client.js');
    const uiPath = path.join(root, 'client/commercial/commercial-ui.js');
    try {
        const client = fs.readFileSync(clientPath, 'utf8');
        const ui = fs.readFileSync(uiPath, 'utf8');
        const clientOff = !/COMMERCIAL_ENABLED\s*=\s*true/.test(client)
            && /isGatingActive/.test(client);
        const uiOff = /COMMERCIAL_UI_AUTO_INIT\s*=\s*false/.test(ui);
        if (clientOff && uiOff) {
            pass('Commercial flags disabled in client');
        } else {
            fail('Commercial flags disabled in client', `client=${clientOff} ui=${uiOff}`);
        }
    } catch (error) {
        fail('Commercial flags disabled in client', error.message);
    }
}

// --- run ---
testLedCalculations();
testSharedNodeModules();
testServerRequires();
testSignalLabCalcShim();
testCommercialFlagsDisabled();
testHtmlBootstrap('home.html', '');
testHtmlBootstrap('tools/signal-lab.html', '../');
testHtmlBootstrap('tools/led-wall-visualizer.html', '../');
testHtmlBootstrap('admin.html', '', { requireVisibility: false });

const pages = [
    '/home.html',
    '/tools/index.html',
    '/tools/signal-lab.html',
    '/tools/led-wall-visualizer.html',
    '/api/health',
    '/api/site-settings',
    '/api/commercial/config',
    '/api/commercial/entitlements?productId=okami-signal-lab'
];

for (const p of pages) {
    await fetchOk(`${BASE}${p}`, `HTTP ${p}`);
}

const signalHtml = await (await fetch(`${BASE}/tools/signal-lab.html`).catch(() => null))?.text();
if (signalHtml) {
    if (signalHtml.includes('signal-lab-controls-scroll') && signalHtml.includes('signal-lab-app')) {
        pass('Signal Lab layout markup', 'controls-scroll + app present');
    } else {
        fail('Signal Lab layout markup', 'missing controls-scroll or app');
    }
}

const failed = results.filter((r) => !r.ok);
console.log('\n=== Phase 0 Acceptance ===\n');
for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
process.exit(failed.length ? 1 : 0);
