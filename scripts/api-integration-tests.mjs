/**
 * API integration tests — run: node scripts/api-integration-tests.mjs
 * Spins up an ephemeral in-process server (no port 3000 required).
 */
import http from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app, prepareServer } = require('../server.js');

const ADMIN_COOKIE = 'okami_admin=1';

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
    let body = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        body = await response.json();
    } else {
        body = await response.text();
    }
    return { status: response.status, body };
}

async function run() {
    await prepareServer();
    const server = http.createServer(app);
    await listen(server);
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        const health = await request(baseUrl, '/api/health');
        if (health.status === 200 && health.body?.status === 'ok' && health.body?.version) {
            pass('GET /api/health', `version ${health.body.version}`);
        } else {
            fail('GET /api/health', JSON.stringify(health.body));
        }

        const config = await request(baseUrl, '/api/commercial/config');
        if (config.status === 200 && config.body?.companyName && config.body?.commercialEnabled === false
            && config.body?.clientCommercialUiEnabled === false) {
            pass('GET /api/commercial/config');
        } else {
            fail('GET /api/commercial/config', `status ${config.status}`);
        }

        const entitlements = await request(baseUrl, '/api/commercial/entitlements?productId=okami-signal-lab');
        if (entitlements.status === 200 && entitlements.body?.tier === 'professional') {
            pass('GET /api/commercial/entitlements');
        } else {
            fail('GET /api/commercial/entitlements', JSON.stringify(entitlements.body));
        }

        const session = await request(baseUrl, '/api/commercial/account/session');
        if (session.status === 200) {
            pass('GET /api/commercial/account/session');
        } else {
            fail('GET /api/commercial/account/session', `status ${session.status}`);
        }

        const version = await request(baseUrl, '/api/commercial/version?channel=web&version=1.0.0');
        if (version.status === 200 && version.body?.channel === 'web') {
            pass('GET /api/commercial/version');
        } else {
            fail('GET /api/commercial/version', JSON.stringify(version.body));
        }

        const license = await request(baseUrl, '/api/commercial/license/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: 'test-key', productId: 'okami-signal-lab' })
        });
        if (license.status === 200 && license.body?.valid === true) {
            pass('POST /api/commercial/license/verify (commercial disabled = valid dev mode)');
        } else {
            fail('POST /api/commercial/license/verify', JSON.stringify(license.body));
        }

        const settingsGet = await request(baseUrl, '/api/site-settings');
        if (settingsGet.status === 200 && settingsGet.body?.pages) {
            pass('GET /api/site-settings (public read)');
        } else {
            fail('GET /api/site-settings (public read)', `status ${settingsGet.status}`);
        }

        const settingsPutDenied = await request(baseUrl, '/api/site-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ constructionMode: false, pages: settingsGet.body.pages })
        });
        if (settingsPutDenied.status === 401) {
            pass('PUT /api/site-settings requires admin');
        } else {
            fail('PUT /api/site-settings requires admin', `status ${settingsPutDenied.status}`);
        }

        const settingsPutOk = await request(baseUrl, '/api/site-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Cookie: ADMIN_COOKIE
            },
            body: JSON.stringify(settingsGet.body)
        });
        if (settingsPutOk.status === 200 && settingsPutOk.body?.success) {
            pass('PUT /api/site-settings with admin cookie');
        } else {
            fail('PUT /api/site-settings with admin cookie', `status ${settingsPutOk.status}`);
        }

        const analyticsDenied = await request(baseUrl, '/api/analytics');
        if (analyticsDenied.status === 401) {
            pass('GET /api/analytics requires admin');
        } else {
            fail('GET /api/analytics requires admin', `status ${analyticsDenied.status}`);
        }

        const analyticsView = await request(baseUrl, '/api/analytics/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/home.html', title: 'Home' })
        });
        if (analyticsView.status === 200 && analyticsView.body?.success) {
            pass('POST /api/analytics/view (public, rate-limited)');
        } else {
            fail('POST /api/analytics/view', `status ${analyticsView.status}`);
        }

        const uploadDenied = await request(baseUrl, '/api/upload', { method: 'POST' });
        if (uploadDenied.status === 401) {
            pass('POST /api/upload requires admin');
        } else {
            fail('POST /api/upload requires admin', `status ${uploadDenied.status}`);
        }

        const filesPublic = await request(baseUrl, '/api/files');
        if (filesPublic.status === 200 && Array.isArray(filesPublic.body)) {
            pass('GET /api/files (public read for support page)');
        } else {
            fail('GET /api/files', `status ${filesPublic.status}`);
        }
    } finally {
        await close(server);
    }

    const failed = results.filter((r) => !r.ok);
    console.log('\n=== API Integration Tests ===\n');
    for (const r of results) {
        console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
    process.exit(failed.length ? 1 : 0);
}

run().catch((error) => {
    console.error('API integration tests failed to run:', error);
    process.exit(1);
});
