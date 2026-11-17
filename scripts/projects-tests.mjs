/**
 * Project catalog tests — run: node scripts/projects-tests.mjs
 *
 * Covers projects/*.md parsing, Portainer label mapping, the sync against a fake
 * Portainer API, and admin overrides merging. Backs up and restores the files it
 * touches in files/.
 */
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = path.join(ROOT, 'files');
const TOUCHED = ['tools.json', 'portainer-projects.json', 'projects-public.json'].map((name) => path.join(FILES, name));

const { parseFrontMatter } = require('../server/projects/frontmatter');
const { projectFromFile, loadMarkdownProjects } = require('../server/projects/markdown-projects');
const portainer = require('../server/projects/portainer-sync');
const catalogService = require('../server/tools/catalog-service');

const results = [];
function check(name, condition, detail = '') {
    results.push({ name, ok: Boolean(condition), detail });
}

async function backup() {
    const saved = new Map();
    for (const file of TOUCHED) {
        try {
            saved.set(file, await fs.readFile(file, 'utf8'));
        } catch {
            saved.set(file, null);
        }
    }
    return saved;
}

async function restore(saved) {
    for (const [file, content] of saved) {
        if (content == null) {
            await fs.rm(file, { force: true });
        } else {
            await fs.writeFile(file, content);
        }
    }
}

function startFakePortainer(state) {
    const server = http.createServer((req, res) => {
        if (req.headers['x-api-key'] !== 'test-key') {
            res.writeHead(401).end();
            return;
        }
        const url = new URL(req.url, 'http://localhost');
        res.setHeader('Content-Type', 'application/json');
        if (url.pathname === '/api/endpoints') {
            res.end(JSON.stringify([{ Id: 1, Name: 'proxmox' }]));
            return;
        }
        if (url.pathname === '/api/endpoints/1/docker/containers/json') {
            res.end(JSON.stringify(state.containers));
            return;
        }
        res.writeHead(404).end('{}');
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// --- Front matter & Markdown mapping ---------------------------------------
{
    const parsed = parseFrontMatter([
        '---',
        'title: Test Project   # trailing comment',
        'url: https://example.com/#anchor',
        'featured: true',
        'order: 7',
        'tags: [LED, Video]',
        'features:',
        '  - One',
        '  - Two',
        '---',
        '## Hello',
        '',
        'Body text.'
    ].join('\n'));
    check('frontmatter: strips trailing comments', parsed.data.title === 'Test Project', parsed.data.title);
    check('frontmatter: keeps # inside URLs', parsed.data.url === 'https://example.com/#anchor', parsed.data.url);
    check('frontmatter: booleans and numbers', parsed.data.featured === true && parsed.data.order === 7);
    check('frontmatter: inline + block lists', parsed.data.tags.length === 2 && parsed.data.features.join() === 'One,Two');

    const project = projectFromFile(parsed, 'test-project.md');
    check('markdown: slug from file name', project.slug === 'test-project' && project.id === 'test-project');
    check('markdown: external link → new tab', project.linkType === 'external' && project.openInNewTab === true);
    check('markdown: body renders to HTML', project.bodyHtml.includes('<h2>Hello</h2>'), project.bodyHtml);
    check('markdown: body text enables detail page', project.detailPageEnabled === true);

    const bare = projectFromFile(parseFrontMatter('---\ntitle: Bare\nicon: bare.svg\n---\n'), 'bare.md');
    check('markdown: no url → links to its own detail page', bare.url === '/projects/bare' && bare.detailPageEnabled === true);
    check('markdown: bare icon name → projects/assets', bare.iconUrl === '/projects/assets/bare.svg', bare.iconUrl);

    const reserved = projectFromFile(parseFrontMatter('---\ntitle: X\nslug: signal-lab\nurl: /tools/signal-lab\n---\nBody'), 'x.md');
    check('markdown: reserved app slugs never get a detail page', reserved.detailPageEnabled === false);

    const repoProjects = await loadMarkdownProjects();
    check('markdown: repo projects load and skip _TEMPLATE', repoProjects.length >= 4 && !repoProjects.some((p) => p.title === 'My New Project'));
}

// --- Portainer label mapping -------------------------------------------------
{
    const project = portainer.projectFromContainer({
        Id: 'abc',
        Names: ['/show-control'],
        Image: 'ghcr.io/okami/show-control:1.4.2',
        State: 'running',
        Status: 'Up 3 hours (healthy)',
        Labels: {
            'okami.public': 'true',
            'homepage.name': 'Show Control',
            'homepage.description': 'Live cue status',
            'homepage.href': 'https://show.example.com',
            'homepage.group': 'Apps',
            'homepage.icon': 'grafana.svg'
        }
    }, { endpointName: 'proxmox' });
    check('portainer: homepage.* labels map to card', project.title === 'Show Control' && project.category === 'Apps' && project.url === 'https://show.example.com');
    check('portainer: id is namespaced', project.id === 'portainer-show-control');
    check('portainer: version from image tag', project.version === '1.4.2', project.version);
    check('portainer: running → online', project.runtimeStatus === 'online');
    check('portainer: icon name → dashboard-icons CDN', project.iconUrl.endsWith('/svg/grafana.svg'), project.iconUrl);

    const unsafe = portainer.projectFromContainer({
        Names: ['/x'], State: 'exited', Labels: { 'homepage.href': 'javascript:alert(1)', 'okami.title': 'X' }
    });
    check('portainer: non-http links are rejected', unsafe.url === '/projects/x' && unsafe.linkType === 'internal');
    check('portainer: stopped → offline', unsafe.runtimeStatus === 'offline');
}

// --- Sync + merge + overrides (touches files/, restored afterwards) ----------
const saved = await backup();
const fakeState = {
    containers: [
        {
            Id: '1', Names: ['/show-control'], Image: 'show:2.0.0', State: 'running', Status: 'Up',
            Labels: { 'okami.public': 'true', 'homepage.name': 'Show Control', 'homepage.href': 'https://show.example.com' }
        },
        {
            Id: '2', Names: ['/postgres'], Image: 'postgres:16', State: 'running', Status: 'Up',
            Labels: { 'okami.public': 'false', 'homepage.name': 'Database' }
        }
    ]
};
const fake = await startFakePortainer(fakeState);
const config = portainer.readPortainerConfig({
    PORTAINER_URL: `http://127.0.0.1:${fake.address().port}`,
    PORTAINER_API_KEY: 'test-key'
});

try {
    await fs.writeFile(path.join(FILES, 'tools.json'), JSON.stringify({ version: 1, tools: [] }));
    await fs.rm(portainer.CACHE_PATH, { force: true });

    const first = await portainer.syncPortainer({ config });
    check('sync: imports only opted-in containers', first.count === 1, JSON.stringify(first));

    let catalog = await catalogService.readToolsCatalog();
    const show = catalog.tools.find((tool) => tool.id === 'portainer-show-control');
    check('merge: Portainer project appears in catalog', show && show.source === 'portainer' && show.enabled === true);
    check('merge: Markdown projects still present', catalog.tools.some((tool) => tool.id === 'pack' && tool.source === 'file'));
    check('merge: private containers never appear', !catalog.tools.some((tool) => tool.title === 'Database'));

    // Admin features the container project and edits its title (title edit must be ignored).
    const edited = catalog.tools.map((tool) => (
        tool.id === 'portainer-show-control' ? { ...tool, featured: true, title: 'Hacked title' } : tool
    ));
    await catalogService.writeToolsCatalog({ ...catalog, tools: edited });
    const stored = JSON.parse(await fs.readFile(path.join(FILES, 'tools.json'), 'utf8'));
    const stub = stored.tools.find((entry) => entry.id === 'portainer-show-control');
    check('write: external projects stored as stubs', stub && !('title' in stub) && stub.overrides.featured === true, JSON.stringify(stub));
    check('write: unchanged Markdown fields are not frozen as overrides',
        !stored.tools.find((entry) => entry.id === 'pack')?.overrides?.featured);

    catalog = await catalogService.readToolsCatalog();
    const afterEdit = catalog.tools.find((tool) => tool.id === 'portainer-show-control');
    check('read: admin override applied', afterEdit.featured === true);
    check('read: content still comes from labels', afterEdit.title === 'Show Control');

    // A stale writer (list read before a project existed) must not hide that project.
    await catalogService.writeToolsCatalog({ ...catalog, tools: catalog.tools.filter((tool) => tool.id !== 'pack') });
    catalog = await catalogService.readToolsCatalog();
    check('write: missing entry in a stale write does not hide it', catalog.tools.find((tool) => tool.id === 'pack')?.enabled === true);

    // Unpublishing a Markdown project in admin persists as an override.
    await catalogService.writeToolsCatalog({
        ...catalog,
        tools: catalog.tools.map((tool) => (tool.id === 'pack' ? { ...tool, enabled: false } : tool))
    });
    catalog = await catalogService.readToolsCatalog();
    check('write: unpublishing a file project persists', catalog.tools.find((tool) => tool.id === 'pack')?.enabled === false);

    // Container goes away → kept but hidden; override survives.
    fakeState.containers = [];
    await portainer.syncPortainer({ config });
    catalog = await catalogService.readToolsCatalog();
    const removed = catalog.tools.find((tool) => tool.id === 'portainer-show-control');
    check('sync: removed container kept but hidden', removed && removed.runtimeStatus === 'removed' && removed.enabled === false);

    // Portainer unreachable → cache kept, error recorded.
    const badConfig = { ...config, url: 'http://127.0.0.1:1' };
    const failed = await portainer.syncPortainer({ config: badConfig });
    const cache = JSON.parse(await fs.readFile(portainer.CACHE_PATH, 'utf8'));
    check('sync: failure keeps previous cache', Boolean(failed.error) && cache.projects.length === 1 && Boolean(cache.error));

    const snapshot = JSON.parse(await fs.readFile(catalogService.PUBLIC_SNAPSHOT_PATH, 'utf8'));
    check('snapshot: public fallback only has enabled projects', snapshot.tools.every((tool) => tool.enabled !== false));
} catch (error) {
    check('sync/merge suite ran without throwing', false, error.stack || String(error));
} finally {
    fake.close();
    await restore(saved);
}

let failures = 0;
for (const result of results) {
    if (!result.ok) failures += 1;
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${!result.ok && result.detail ? ` — ${result.detail}` : ''}`);
}
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
