/**
 * License upstream + version compare unit tests.
 * node scripts/license-upstream-tests.mjs
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    normalizeUpstreamResponse,
    normalizeTier,
    buildVerifyUrl
} = require('../server/commercial/license-upstream');
const { compareVersions } = require('../server/commercial/version-service');

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

assert('normalizeTier maps pro to professional', normalizeTier('pro') === 'professional');
assert('normalizeUpstreamResponse handles { valid, tier }', (() => {
    const result = normalizeUpstreamResponse({ valid: true, tier: 'standard' });
    return result.valid && result.tier === 'standard' && result.source === 'license-upstream';
})());
assert('normalizeUpstreamResponse handles status active', (() => {
    const result = normalizeUpstreamResponse({ status: 'active', plan: 'professional' });
    return result.valid && result.tier === 'professional';
})());
assert('normalizeUpstreamResponse handles invalid license', (() => {
    const result = normalizeUpstreamResponse({ valid: false, tier: 'professional' });
    return !result.valid && result.tier === 'free';
})());
assert('buildVerifyUrl joins base and path', buildVerifyUrl({
    licenseServerUrl: 'https://licenses.example.com/',
    licenseVerifyPath: '/api/verify'
}) === 'https://licenses.example.com/api/verify');
assert('compareVersions detects newer release', compareVersions('1.2.0', '1.1.9') === 1);
assert('compareVersions detects equal versions', compareVersions('1.0.0', '1.0.0') === 0);

const failed = results.filter((entry) => !entry.ok);
results.forEach((entry) => {
    console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`);
});

if (failed.length) {
    console.error(`\n${failed.length} license upstream test(s) failed.`);
    process.exit(1);
}

console.log(`\n${results.length}/${results.length} license upstream tests passed.`);
