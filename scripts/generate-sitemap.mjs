/**
 * Generate sitemap.xml from shared page registry.
 * Run: node scripts/generate-sitemap.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const pages = require(path.join(root, 'shared/registry/pages.js'));

const SITE_ORIGIN = (process.env.OKAMI_SITE_ORIGIN || 'https://okamidesigns.com').replace(/\/$/, '');

function getSitemapLocation(page) {
    if (page.canonicalPath) {
        return `${SITE_ORIGIN}${page.canonicalPath}`;
    }
    if (page.key === 'splash') {
        return `${SITE_ORIGIN}/`;
    }
    return `${SITE_ORIGIN}${page.analyticsPath}`;
}

function buildSitemapXml(urls) {
    const uniqueUrls = [...new Set(urls)];
    const body = uniqueUrls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const urls = pages.getTrackablePages().map(getSitemapLocation);
const outputPath = path.join(root, 'sitemap.xml');
fs.writeFileSync(outputPath, buildSitemapXml(urls), 'utf8');
console.log(`Wrote ${urls.length} URLs to ${outputPath}`);
