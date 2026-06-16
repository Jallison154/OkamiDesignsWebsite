#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD = process.argv[2] || '20260615';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
    path.join(root, 'tools', 'signal-lab.html'),
    path.join(root, 'tools', 'signal-lab-output.html')
];

function bustLocalAsset(url) {
    if (/^(https?:|\/\/|data:|mailto:)/.test(url) || url.includes('fonts.googleapis.com')) {
        return url;
    }
    if (url.includes('?v=')) {
        return url.replace(/\?v=[^"'#]+/, `?v=${BUILD}`);
    }
    return `${url}?v=${BUILD}`;
}

function patchHtml(filePath) {
    let html = fs.readFileSync(filePath, 'utf8');
    const marker = `<!-- Signal Lab asset build: ${BUILD} -->`;

    if (!html.includes('Signal Lab asset build:')) {
        html = html.replace('<head>', `<head>\n    ${marker}`);
    } else {
        html = html.replace(/<!-- Signal Lab asset build: [^>]+ -->/, marker);
    }

    html = html.replace(/((?:href|src)=["'])([^"'?#]+)(\?v=[^"'#]*)?(["'])/g, (full, prefix, url, _query, suffix) => {
        if (/^(https?:|\/\/|data:|mailto:)/.test(url)) {
            return full;
        }
        return `${prefix}${bustLocalAsset(url)}${suffix}`;
    });

    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`Updated ${path.relative(root, filePath)}`);
}

targets.forEach(patchHtml);
