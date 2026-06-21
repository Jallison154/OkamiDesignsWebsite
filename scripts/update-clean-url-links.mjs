import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = [
    'home.html',
    'services.html',
    'support.html',
    'contact.html',
    '3d-prints.html',
    '404.html',
    'tools/index.html',
    'tools/led-wall-visualizer.html',
    'tools/signal-lab.html',
    'legal/privacy.html',
    'legal/disclaimer.html',
    'legal/terms.html',
    'legal/commercial-license.html',
    'page-template.html'
];

const replacements = [
    [/href="\.\.\/home\.html(\?[^"]*)?"/g, 'href="/"'],
    [/href="home\.html(\?[^"]*)?"/g, 'href="/"'],
    [/href="\.\.\/services\.html(\?[^"]*)?"/g, 'href="/services"'],
    [/href="services\.html(\?[^"]*)?"/g, 'href="/services"'],
    [/href="\.\.\/support\.html(\?[^"]*)?"/g, 'href="/support"'],
    [/href="support\.html(\?[^"]*)?"/g, 'href="/support"'],
    [/href="\.\.\/contact\.html(\?[^"]*)?"/g, 'href="/contact"'],
    [/href="contact\.html(\?[^"]*)?"/g, 'href="/contact"'],
    [/href="tools\/index\.html(\?[^"]*)?"/g, 'href="/tools"'],
    [/href="index\.html(\?[^"]*)?"/g, 'href="/tools"'],
    [/href="tools\/led-wall-visualizer\.html(\?[^"]*)?"/g, 'href="/tools/led-video-wall-calculator"'],
    [/href="led-wall-visualizer\.html(\?[^"]*)?"/g, 'href="/tools/led-video-wall-calculator"'],
    [/href="tools\/signal-lab\.html(\?[^"]*)?"/g, 'href="/tools/signal-lab"'],
    [/href="signal-lab\.html(\?[^"]*)?"/g, 'href="/tools/signal-lab"'],
    [/href="\/tools\/signal-lab\.html(\?[^"]*)?"/g, 'href="/tools/signal-lab"'],
    [/href="3d-prints\.html(\?[^"]*)?"/g, 'href="/3d-prints"']
];

for (const file of files) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) {
        console.log('skip', file);
        continue;
    }
    let content = fs.readFileSync(full, 'utf8');
    let changed = false;
    for (const [pattern, replacement] of replacements) {
        const next = content.replace(pattern, replacement);
        if (next !== content) {
            changed = true;
            content = next;
        }
    }
    if (changed) {
        fs.writeFileSync(full, content);
        console.log('updated', file);
    }
}
