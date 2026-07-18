'use strict';

const path = require('path');
const fs = require('fs').promises;
const toolsCatalog = require('../../shared/tools/catalog');
const { normalizeSiteSettings } = require('../../shared/settings/site-settings');

const FILES_DIR = path.join(__dirname, '..', '..', 'files');
const TOOLS_PATH = path.join(FILES_DIR, 'tools.json');
const SITE_SETTINGS_PATH = path.join(FILES_DIR, 'site-settings.json');

async function readVisibilityPages() {
    try {
        const data = await fs.readFile(SITE_SETTINGS_PATH, 'utf8');
        return normalizeSiteSettings(JSON.parse(data)).pages;
    } catch {
        return null;
    }
}

async function ensureToolsFile() {
    await fs.mkdir(FILES_DIR, { recursive: true });
    try {
        await fs.access(TOOLS_PATH);
    } catch {
        const visibilityPages = await readVisibilityPages();
        const catalog = toolsCatalog.createDefaultCatalog({ visibilityPages });
        await fs.writeFile(TOOLS_PATH, JSON.stringify(catalog, null, 2));
    }
}

async function readToolsCatalog() {
    await ensureToolsFile();
    try {
        const data = await fs.readFile(TOOLS_PATH, 'utf8');
        return toolsCatalog.normalizeCatalog(JSON.parse(data), {
            visibilityPages: await readVisibilityPages()
        });
    } catch {
        const visibilityPages = await readVisibilityPages();
        return toolsCatalog.createDefaultCatalog({ visibilityPages });
    }
}

async function writeToolsCatalog(raw) {
    await ensureToolsFile();
    const catalog = toolsCatalog.normalizeCatalog(raw, { allowEmpty: true });
    catalog.updatedAt = new Date().toISOString();
    catalog.tools = catalog.tools.map((tool) => ({
        ...tool,
        updatedAt: tool.updatedAt || catalog.updatedAt
    }));
    // Persist without the transient allowEmpty flag
    const payload = {
        version: catalog.version,
        updatedAt: catalog.updatedAt,
        tools: catalog.tools
    };
    await fs.writeFile(TOOLS_PATH, JSON.stringify(payload, null, 2));
    return catalog;
}

module.exports = {
    TOOLS_PATH,
    readToolsCatalog,
    writeToolsCatalog,
    ensureToolsFile
};
