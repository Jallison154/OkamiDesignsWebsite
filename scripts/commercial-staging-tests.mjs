/**
 * Commercial staging tests — run with commercial enabled in-process.
 * node scripts/commercial-staging-tests.mjs
 */
import http from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { FEATURES } = require('../shared/commercial/features');

const STAGING_KEY = 'staging-test-license-key';
const savedEnv = {
    OKAMI_COMMERCIAL_ENABLED: process.env.OKAMI_COMMERCIAL_ENABLED,
    OKAMI_LICENSE_DEV_ACCEPT_KEY: process.env.OKAMI_LICENSE_DEV_ACCEPT_KEY,
    OKAMI_CLIENT_COMMERCIAL_UI: process.env.OKAMI_CLIENT_COMMERCIAL_UI
};

process.env.OKAMI_COMMERCIAL_ENABLED = 'true';
process.env.OKAMI_LICENSE_DEV_ACCEPT_KEY = STAGING_KEY;
process.env.OKAMI_CLIENT_COMMERCIAL_UI = 'true';

const { app, prepareServer } = require('../server.js');

const results = [];

function pass(name, detail = '') {
    results.push({ name, ok: true, detail });
}

function fail(name, detail = '') {
    results.push({ name, ok: false, detail });
}

function listen(server) {
    return new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve(server));
        server.on('error', reject);
    });
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

async function request(baseUrl, path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
        ? await response.json()
        : await response.text();
    return { status: response.status, body };
}

function restoreEnv() {
    for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
}

async function run() {
    await prepareServer();
    const server = http.createServer(app);
    await listen(server);
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        const config = await request(baseUrl, '/api/commercial/config');
        if (config.status === 200
            && config.body?.commercialEnabled === true
            && config.body?.clientCommercialUiEnabled === true
            && config.body?.featureGatingEnabled === true) {
            pass('Commercial config exposes staging flags');
        } else {
            fail('Commercial config exposes staging flags', JSON.stringify(config.body));
        }

        const freeEnt = await request(baseUrl, '/api/commercial/entitlements?productId=okami-signal-lab');
        if (freeEnt.status === 200
            && freeEnt.body?.tier === 'free'
            && freeEnt.body?.featureMap?.[FEATURES.SIGNAL_LAB_EXPORT_PNG]
            && !freeEnt.body?.featureMap?.[FEATURES.SIGNAL_LAB_EXPORT_BATCH]) {
            pass('Free tier blocks batch export feature');
        } else {
            fail('Free tier blocks batch export feature', JSON.stringify(freeEnt.body?.featureMap));
        }

        const licensed = await request(baseUrl, '/api/commercial/entitlements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: 'okami-signal-lab',
                licenseKey: STAGING_KEY
            })
        });
        if (licensed.status === 200
            && licensed.body?.license?.valid
            && licensed.body?.featureMap?.[FEATURES.LED_WALL_SAVE_PROJECT]
            && !licensed.body?.featureMap?.[FEATURES.SIGNAL_LAB_EXPORT_BATCH]) {
            pass('Dev license key activates standard tier');
        } else {
            fail('Dev license key activates standard tier', JSON.stringify(licensed.body));
        }

        const verify = await request(baseUrl, '/api/commercial/license/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: STAGING_KEY, productId: 'okami-signal-lab' })
        });
        if (verify.status === 200 && verify.body?.valid && verify.body?.tier === 'standard') {
            pass('POST /api/commercial/license/verify accepts dev key');
        } else {
            fail('POST /api/commercial/license/verify accepts dev key', JSON.stringify(verify.body));
        }

        const badKey = await request(baseUrl, '/api/commercial/license/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: 'not-a-real-key' })
        });
        if (badKey.status === 200 && badKey.body?.valid === false) {
            pass('Invalid license key rejected');
        } else {
            fail('Invalid license key rejected', JSON.stringify(badKey.body));
        }
    } finally {
        await close(server);
        restoreEnv();
    }

    const failed = results.filter((entry) => !entry.ok);
    results.forEach((entry) => {
        const mark = entry.ok ? '✓' : '✗';
        const detail = entry.detail ? ` — ${entry.detail}` : '';
        console.log(`${mark} ${entry.name}${detail}`);
    });

    if (failed.length) {
        console.error(`\n${failed.length} commercial staging test(s) failed.`);
        process.exit(1);
    }

    console.log(`\nAll ${results.length} commercial staging tests passed.`);
}

run().catch((error) => {
    restoreEnv();
    console.error(error);
    process.exit(1);
});
