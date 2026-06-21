/**
 * ESM entry — runs the CommonJS generator (compatible with older Node on servers).
 *
 * Usage:
 *   node scripts/generate-admin-password-hash.mjs "your-secure-password"
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const password = process.argv[2];

if (!password) {
    console.error('Usage: node scripts/generate-admin-password-hash.mjs "your-secure-password"');
    process.exit(1);
}

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generate-admin-password-hash.cjs');
const result = spawnSync(process.execPath, [script, password], { stdio: 'inherit' });
process.exit(result.status ?? 1);
