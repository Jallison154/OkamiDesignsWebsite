'use strict';

/**
 * Loads projects from projects/*.md — one file per project.
 *
 * The file's front matter supplies the card/catalog fields and the Markdown body
 * becomes the project's detail page. Files whose names start with "_" are ignored
 * (use that for drafts and templates). See docs/ADDING-A-PROJECT.md.
 */

const path = require('path');
const fs = require('fs').promises;
const { marked } = require('marked');
const toolsCatalog = require('../../shared/tools/catalog');
const { parseFrontMatter } = require('./frontmatter');

const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');
const PROJECT_ASSETS_PUBLIC_PATH = '/projects/assets';

function resolveAssetUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
        return raw;
    }
    // Bare file names live in projects/assets/
    return `${PROJECT_ASSETS_PUBLIC_PATH}/${raw.replace(/^\.?\/*(assets\/)?/, '')}`;
}

function asList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

function pick(data, ...keys) {
    for (const key of keys) {
        if (data[key] !== undefined && data[key] !== '') {
            return data[key];
        }
    }
    return undefined;
}

/**
 * Map friendly front-matter keys onto the catalog tool shape.
 * Exported for tests.
 */
function projectFromFile({ data, body }, fileName) {
    const baseName = path.basename(fileName, '.md');
    const slug = toolsCatalog.slugify(pick(data, 'slug') || baseName);
    const id = String(pick(data, 'id') || slug);
    const url = String(pick(data, 'url', 'link') || '').trim();
    const iconValue = pick(data, 'icon', 'image');
    const usesWebsiteLogo = pick(data, 'websiteLogo') === true || String(iconValue || '').toLowerCase() === 'website';
    const iconPath = String(iconValue || '').toLowerCase() === 'website' ? '' : iconValue;
    const detailPage = pick(data, 'detailPage', 'detail_page');
    const hidden = pick(data, 'hidden', 'draft');
    const repo = String(pick(data, 'repo') || '').trim();
    const bodyText = String(body || '').trim();

    const resolvedUrl = url || `/projects/${slug}`;
    const isExternal = /^https?:\/\//i.test(resolvedUrl);

    return {
        id,
        title: pick(data, 'title', 'name') || baseName,
        slug,
        category: pick(data, 'category', 'group') || 'Project',
        shortDescription: pick(data, 'summary', 'description') || '',
        url: resolvedUrl,
        linkType: isExternal ? 'external' : 'internal',
        buttonLabel: pick(data, 'button', 'buttonLabel') || (isExternal ? 'Open app →' : 'Open tool →'),
        openInNewTab: pick(data, 'newTab', 'openInNewTab') ?? isExternal,
        contentType: pick(data, 'type', 'contentType') || (isExternal ? 'app' : 'tool'),
        imageSource: usesWebsiteLogo ? 'website' : (iconPath ? 'upload' : 'placeholder'),
        iconUrl: resolveAssetUrl(iconPath),
        heroImageUrl: resolveAssetUrl(pick(data, 'hero', 'heroImage')),
        featured: pick(data, 'featured') ?? false,
        homepageOrder: pick(data, 'homepageOrder'),
        displayOrder: pick(data, 'order', 'displayOrder') ?? 100,
        listOnToolsPage: pick(data, 'listOnToolsPage', 'listed') ?? true,
        enabled: hidden === true ? false : true,
        // A project gets a detail page when its file has body text (or no URL),
        // unless the file sets detailPage: false. Built-in app slugs never do.
        detailPageEnabled: !toolsCatalog.isReservedAppSlug(slug) && (detailPage === undefined
            ? Boolean(bodyText) || !url
            : detailPage === true),
        pageKey: pick(data, 'pageKey') || null,
        accent: pick(data, 'accent') || 'default',
        status: pick(data, 'status') || '',
        version: pick(data, 'version') != null ? String(pick(data, 'version')) : '',
        tags: asList(pick(data, 'tags')),
        features: asList(pick(data, 'features')),
        screenshots: asList(pick(data, 'screenshots')).map(resolveAssetUrl),
        supportUrl: pick(data, 'support', 'supportUrl') || '',
        repoUrl: repo && !/^https?:\/\//i.test(repo) ? `https://github.com/${repo}` : repo,
        bodyHtml: bodyText ? marked.parse(bodyText) : '',
        source: 'file',
        sourcePath: `projects/${fileName}`
    };
}

async function loadMarkdownProjects({ dir = PROJECTS_DIR } = {}) {
    let entries = [];
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }

    const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('_'))
        .map((entry) => entry.name)
        .sort();

    const projects = [];
    const seen = new Set();
    for (const fileName of files) {
        try {
            const raw = await fs.readFile(path.join(dir, fileName), 'utf8');
            const stat = await fs.stat(path.join(dir, fileName));
            const project = projectFromFile(parseFrontMatter(raw), fileName);
            if (seen.has(project.id)) {
                console.warn(`projects/${fileName}: duplicate project id "${project.id}" — skipped.`);
                continue;
            }
            seen.add(project.id);
            project.createdAt = stat.birthtime?.toISOString?.() || stat.mtime.toISOString();
            project.updatedAt = stat.mtime.toISOString();
            projects.push(project);
        } catch (error) {
            console.warn(`projects/${fileName}: could not be loaded — ${error.message || error}`);
        }
    }
    return projects;
}

module.exports = {
    PROJECTS_DIR,
    loadMarkdownProjects,
    projectFromFile,
    resolveAssetUrl
};
