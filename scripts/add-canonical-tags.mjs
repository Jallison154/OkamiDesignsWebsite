import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const pages = require(path.join(root, 'shared/registry/pages.js'));

const SITE_ORIGIN = (process.env.OKAMI_SITE_ORIGIN || 'https://okamidesigns.com').replace(/\/$/, '');

const fileToCanonical = new Map();

pages.PUBLIC_PAGES.forEach((page) => {
    const canonical = page.canonicalPath || page.publicPath || page.analyticsPath;
    if (!canonical || canonical === '/') {
        return;
    }
    page.filePaths.forEach((filePath) => {
        fileToCanonical.set(filePath, `${SITE_ORIGIN}${canonical}`);
    });
});

pages.EXTRA_PUBLIC_ROUTES.forEach((route) => {
    const canonical = route.canonicalPath || route.publicPath;
    fileToCanonical.set(route.filePath, `${SITE_ORIGIN}${canonical}`);
});

fileToCanonical.set('home.html', `${SITE_ORIGIN}/`);

for (const [filePath, canonicalUrl] of fileToCanonical) {
    const full = path.join(root, filePath);
    if (!fs.existsSync(full)) {
        continue;
    }

    let content = fs.readFileSync(full, 'utf8');
    const canonicalTag = `<link rel="canonical" href="${canonicalUrl}">`;

    if (/rel="canonical"/i.test(content)) {
        content = content.replace(/<link rel="canonical" href="[^"]*">/i, canonicalTag);
    } else {
        content = content.replace(/<head>/i, `<head>\n    ${canonicalTag}`);
    }

    fs.writeFileSync(full, content);
    console.log('canonical', filePath, canonicalUrl);
}
