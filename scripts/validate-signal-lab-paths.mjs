#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function collectRefs(htmlPath) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const baseDir = path.dirname(htmlPath);
    const refs = [];
    const re = /(?:href|src)=["']([^"'?#]+)/g;
    let match;
    while ((match = re.exec(html)) !== null) {
        const ref = match[1];
        if (/^(https?:|\/\/|data:|mailto:)/.test(ref)) {
            continue;
        }
        refs.push({
            ref,
            resolved: path.normalize(path.join(baseDir, ref))
        });
    }
    return refs;
}

const pages = [
    path.join(root, 'tools', 'signal-lab.html'),
    path.join(root, 'tools', 'signal-lab-output.html')
];

let failed = false;

for (const page of pages) {
    console.log(`\n${path.relative(root, page)}`);
    for (const { ref, resolved } of collectRefs(page)) {
        if (!fs.existsSync(resolved)) {
            failed = true;
            console.log(`  MISSING  ${ref}`);
            console.log(`           -> ${path.relative(root, resolved)}`);
        }
    }
}

if (failed) {
    process.exit(1);
}

console.log('\nAll referenced paths exist.');
