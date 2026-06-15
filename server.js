// Okami Designs - Backend API Server
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const FILES_DIR = path.join(__dirname, 'files');
const MANIFEST_PATH = path.join(FILES_DIR, 'manifest.json');
const SITE_SETTINGS_PATH = path.join(FILES_DIR, 'site-settings.json');
const ANALYTICS_PATH = path.join(FILES_DIR, 'analytics.json');

const DEFAULT_SITE_SETTINGS = {
    constructionMode: false,
    pages: {
        home: true,
        services: true,
        tools: true,
        support: true,
        contact: true,
        ledVideoWallCalculator: true
    }
};

function slugify(value) {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 120) || `manual-${Date.now()}`;
}

async function buildUniqueFilename(manifest, slugCandidate, extension, excludeId = null) {
    const ext = extension && extension.startsWith('.') ? extension : `.${extension || 'pdf'}`;
    const baseSlug = slugify(slugCandidate || 'manual');
    let attempt = 0;
    let finalSlug = baseSlug;

    const isTaken = (filename) => manifest.files.some((file) => file.filename === filename && file.id !== excludeId);

    let filename = `${finalSlug}${ext}`;
    while (isTaken(filename)) {
        attempt += 1;
        finalSlug = `${baseSlug}-${attempt}`;
        filename = `${finalSlug}${ext}`;
    }

    return { filename, slug: finalSlug };
}

// Middleware
app.use(express.json());

function parseRequestCookies(req) {
    const header = req.headers.cookie || '';
    return header.split(';').reduce((cookies, part) => {
        const [name, ...rest] = part.trim().split('=');
        if (!name) {
            return cookies;
        }
        cookies[name] = decodeURIComponent(rest.join('='));
        return cookies;
    }, {});
}

function isAdminRequest(req) {
    return parseRequestCookies(req).okami_admin === '1';
}

function normalizeVisibilityPath(requestPath) {
    let normalized = (requestPath || '/').split('?')[0].replace(/\\/g, '/').toLowerCase();
    if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1) || '/';
    }
    if (normalized === '/' || normalized === '/index.html') {
        return '';
    }
    return normalized.replace(/^\//, '');
}

function getVisibilityPageKey(pathValue) {
    if (pathValue === 'home.html') {
        return 'home';
    }
    if (pathValue === 'services.html') {
        return 'services';
    }
    if (pathValue === 'support.html') {
        return 'support';
    }
    if (pathValue === 'contact.html') {
        return 'contact';
    }
    if (pathValue === 'tools/led-wall-visualizer.html') {
        return 'ledVideoWallCalculator';
    }
    return null;
}

function getServerAccessDecision(pathValue, settings, isAdmin) {
    if (pathValue === '404.html' || pathValue === '50x.html' || pathValue === 'admin.html') {
        return { allowed: true };
    }

    if (pathValue === 'admin-analytics.html') {
        return isAdmin ? { allowed: true } : { allowed: false, reason: 'admin-auth' };
    }

    if (isAdmin) {
        return { allowed: true };
    }

    if (settings.constructionMode) {
        if (pathValue === '') {
            return { allowed: true };
        }
        return { allowed: false, reason: 'construction' };
    }

    if (pathValue === '') {
        return { allowed: true };
    }

    if (pathValue.startsWith('tools/') && settings.pages.tools === false) {
        return { allowed: false, reason: 'hidden' };
    }

    const pageKey = getVisibilityPageKey(pathValue);
    if (pageKey && settings.pages[pageKey] === false) {
        return { allowed: false, reason: 'hidden' };
    }

    return { allowed: true };
}

function buildVisibilityRedirect(pathValue, reason, settings) {
    const inTools = pathValue.startsWith('tools/');
    if (reason === 'construction' || (reason === 'hidden' && settings.constructionMode)) {
        return inTools ? '/index.html' : '/index.html';
    }
    if (reason === 'hidden') {
        return inTools ? '/404.html' : '/404.html';
    }
    if (reason === 'admin-auth') {
        return inTools ? '/admin.html' : '/admin.html';
    }
    return '/index.html';
}

async function siteVisibilityMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
    }

    if (req.path.startsWith('/api/') || req.path.startsWith('/files/')) {
        return next();
    }

    const extension = path.extname(req.path).toLowerCase();
    if (extension && extension !== '.html') {
        return next();
    }

    const pathValue = normalizeVisibilityPath(req.path);
    const isManagedPage = pathValue === ''
        || pathValue.endsWith('.html')
        || pathValue.startsWith('tools/');

    if (!isManagedPage) {
        return next();
    }

    try {
        const settings = await readSiteSettings();
        const access = getServerAccessDecision(pathValue, settings, isAdminRequest(req));

        if (access.allowed) {
            return next();
        }

        const redirectTarget = buildVisibilityRedirect(pathValue, access.reason, settings);
        if (req.get('X-Requested-With') === 'fetch') {
            return res.status(403).json({
                error: 'access_denied',
                reason: access.reason,
                redirect: redirectTarget
            });
        }

        return res.redirect(302, redirectTarget);
    } catch (error) {
        console.error('Site visibility middleware error:', error);
        return next();
    }
}

app.use(siteVisibilityMiddleware);

const STATIC_CACHE_PATTERN = /\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i;
app.use(express.static('.', {
    setHeaders: (res, filePath) => {
        if (STATIC_CACHE_PATTERN.test(filePath)) {
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));
app.use('/files', express.static(FILES_DIR, {
    etag: false,
    maxAge: 0,
    lastModified: true,
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
}));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// Ensure files directory exists
async function ensureFilesDir() {
    try {
        await fs.mkdir(FILES_DIR, { recursive: true });
        // Create manifest.json if it doesn't exist
        try {
            await fs.access(MANIFEST_PATH);
        } catch {
            await fs.writeFile(MANIFEST_PATH, JSON.stringify({ version: '1.0', files: [] }, null, 2));
        }
    } catch (error) {
        console.error('Error creating files directory:', error);
    }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        await ensureFilesDir();
        cb(null, FILES_DIR);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: originalName_timestamp_randomId.ext
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
        const timestamp = Date.now();
        const randomId = crypto.randomBytes(4).toString('hex');
        cb(null, `${baseName}_${timestamp}_${randomId}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max
    }
});

// Read manifest
async function readManifest() {
    try {
        const data = await fs.readFile(MANIFEST_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return { version: '1.0', files: [] };
    }
}

// Write manifest
async function writeManifest(manifest) {
    manifest.generated = new Date().toISOString();
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function normalizeSiteSettings(raw) {
    const pages = { ...DEFAULT_SITE_SETTINGS.pages, ...(raw?.pages || {}) };

    Object.keys(DEFAULT_SITE_SETTINGS.pages).forEach((key) => {
        pages[key] = pages[key] !== false;
    });

    return {
        constructionMode: Boolean(raw?.constructionMode),
        pages,
        updatedAt: raw?.updatedAt || new Date().toISOString()
    };
}

async function readSiteSettings() {
    try {
        const data = await fs.readFile(SITE_SETTINGS_PATH, 'utf8');
        return normalizeSiteSettings(JSON.parse(data));
    } catch {
        return normalizeSiteSettings(DEFAULT_SITE_SETTINGS);
    }
}

async function writeSiteSettings(settings) {
    const normalized = normalizeSiteSettings(settings);
    normalized.updatedAt = new Date().toISOString();
    await fs.writeFile(SITE_SETTINGS_PATH, JSON.stringify(normalized, null, 2));
    return normalized;
}

// Keep in sync with page-registry.js
const TRACKABLE_PAGES = [
    { path: '/home.html', title: 'Home' },
    { path: '/services.html', title: 'Services' },
    { path: '/support.html', title: 'Support' },
    { path: '/contact.html', title: 'Contact' },
    { path: '/tools/led-wall-visualizer.html', title: 'LED Video Wall Calculator' },
    { path: '/', title: 'Construction Splash' }
];

function createEmptyPageRecord(title) {
    return {
        title,
        totalViews: 0,
        dailyViews: {},
        monthlyViews: {},
        lastViewedAt: null
    };
}

function normalizeAnalyticsStore(raw) {
    const pages = {};
    TRACKABLE_PAGES.forEach((entry) => {
        const existing = raw?.pages?.[entry.path] || {};
        pages[entry.path] = {
            title: existing.title || entry.title,
            totalViews: Number(existing.totalViews) || 0,
            dailyViews: existing.dailyViews && typeof existing.dailyViews === 'object' ? existing.dailyViews : {},
            monthlyViews: existing.monthlyViews && typeof existing.monthlyViews === 'object' ? existing.monthlyViews : {},
            lastViewedAt: existing.lastViewedAt || null
        };
    });

    Object.entries(raw?.pages || {}).forEach(([pathKey, page]) => {
        if (pages[pathKey]) {
            return;
        }
        pages[pathKey] = {
            title: page?.title || pathKey,
            totalViews: Number(page?.totalViews) || 0,
            dailyViews: page?.dailyViews && typeof page.dailyViews === 'object' ? page.dailyViews : {},
            monthlyViews: page?.monthlyViews && typeof page.monthlyViews === 'object' ? page.monthlyViews : {},
            lastViewedAt: page?.lastViewedAt || null
        };
    });

    return {
        pages,
        updatedAt: raw?.updatedAt || null
    };
}

async function readAnalytics() {
    try {
        const data = await fs.readFile(ANALYTICS_PATH, 'utf8');
        return normalizeAnalyticsStore(JSON.parse(data));
    } catch {
        return normalizeAnalyticsStore({ pages: {} });
    }
}

async function writeAnalytics(analytics) {
    const normalized = normalizeAnalyticsStore(analytics);
    normalized.updatedAt = new Date().toISOString();
    await fs.writeFile(ANALYTICS_PATH, JSON.stringify(normalized, null, 2));
    return normalized;
}

function getDateKeys(date = new Date()) {
    const iso = date.toISOString();
    return {
        day: iso.slice(0, 10),
        month: iso.slice(0, 7)
    };
}

function computePageStats(page, dateKeys) {
    const dayCount = Object.keys(page.dailyViews || {}).length;
    const monthCount = Object.keys(page.monthlyViews || {}).length;
    const viewsToday = Number(page.dailyViews?.[dateKeys.day]) || 0;
    const viewsThisMonth = Number(page.monthlyViews?.[dateKeys.month]) || 0;
    const totalViews = Number(page.totalViews) || 0;

    return {
        path: page.path,
        title: page.title,
        totalViews,
        viewsToday,
        viewsThisMonth,
        dailyAverage: dayCount > 0 ? Math.round((totalViews / dayCount) * 10) / 10 : 0,
        monthlyAverage: monthCount > 0 ? Math.round((totalViews / monthCount) * 10) / 10 : 0,
        lastViewedAt: page.lastViewedAt || null
    };
}

function buildAnalyticsReport(analytics) {
    const dateKeys = getDateKeys();
    const rows = Object.entries(analytics.pages).map(([pathKey, page]) => {
        return computePageStats({ ...page, path: pathKey }, dateKeys);
    });

    return {
        updatedAt: analytics.updatedAt,
        pages: rows
    };
}

async function recordAnalyticsView(path, title) {
    const analytics = await readAnalytics();
    const normalizedPath = path || '/';
    const registryEntry = TRACKABLE_PAGES.find((entry) => entry.path === normalizedPath);

    if (!analytics.pages[normalizedPath]) {
        analytics.pages[normalizedPath] = createEmptyPageRecord(
            title || registryEntry?.title || normalizedPath
        );
    }

    const page = analytics.pages[normalizedPath];
    const dateKeys = getDateKeys();
    const now = new Date().toISOString();

    page.title = title || page.title || registryEntry?.title || normalizedPath;
    page.totalViews = (Number(page.totalViews) || 0) + 1;
    page.dailyViews[dateKeys.day] = (Number(page.dailyViews[dateKeys.day]) || 0) + 1;
    page.monthlyViews[dateKeys.month] = (Number(page.monthlyViews[dateKeys.month]) || 0) + 1;
    page.lastViewedAt = now;

    return writeAnalytics(analytics);
}

async function resetAnalytics(scope) {
    const analytics = await readAnalytics();
    const dateKeys = getDateKeys();

    if (scope === 'all') {
        Object.keys(analytics.pages).forEach((pathKey) => {
            const title = analytics.pages[pathKey].title;
            analytics.pages[pathKey] = createEmptyPageRecord(title);
        });
    } else if (scope === 'today') {
        Object.values(analytics.pages).forEach((page) => {
            if (page.dailyViews?.[dateKeys.day]) {
                const removed = Number(page.dailyViews[dateKeys.day]) || 0;
                delete page.dailyViews[dateKeys.day];
                page.totalViews = Math.max(0, (Number(page.totalViews) || 0) - removed);

                Object.keys(page.monthlyViews || {}).forEach((monthKey) => {
                    if (monthKey === dateKeys.month) {
                        page.monthlyViews[monthKey] = Math.max(
                            0,
                            (Number(page.monthlyViews[monthKey]) || 0) - removed
                        );
                    }
                });
            }
        });
    } else if (scope === 'month') {
        Object.values(analytics.pages).forEach((page) => {
            const monthViews = Number(page.monthlyViews?.[dateKeys.month]) || 0;
            if (monthViews > 0) {
                Object.entries(page.dailyViews || {}).forEach(([dayKey, count]) => {
                    if (dayKey.startsWith(dateKeys.month)) {
                        delete page.dailyViews[dayKey];
                    }
                });
                delete page.monthlyViews[dateKeys.month];
                page.totalViews = Math.max(0, (Number(page.totalViews) || 0) - monthViews);
            }
        });
    }

    return writeAnalytics(analytics);
}

// API Routes

// Get all files
app.get('/api/files', async (req, res) => {
    try {
        const manifest = await readManifest();
        res.json(manifest.files);
    } catch (error) {
        console.error('Error reading files:', error);
        res.status(500).json({ error: 'Failed to read files' });
    }
});

// Get manifest
app.get('/api/manifest', async (req, res) => {
    try {
        const manifest = await readManifest();
        res.json(manifest);
    } catch (error) {
        console.error('Error reading manifest:', error);
        res.status(500).json({ error: 'Failed to read manifest' });
    }
});

// Upload file (with optional logo)
app.post('/api/upload', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'logo', maxCount: 1 }
]), async (req, res) => {
    try {
        const file = req.files?.file?.[0];
        const logo = req.files?.logo?.[0];

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const manifest = await readManifest();
        const fileId = Date.now();

        const manualNameRaw = req.body.manualName || req.body.name || file.originalname || `Manual ${fileId}`;
        const manualName = manualNameRaw.toString().trim() || `Manual ${fileId}`;
        const slugCandidate = req.body.manualSlug || manualName || file.originalname;
        const originalExt = path.extname(file.originalname) || path.extname(file.filename) || '.pdf';

        const { filename: finalFilename, slug } = await buildUniqueFilename(manifest, slugCandidate, originalExt);
        const uploadedPath = path.join(FILES_DIR, file.filename);
        const finalPath = path.join(FILES_DIR, finalFilename);

        if (file.filename !== finalFilename) {
            await fs.rename(uploadedPath, finalPath);
        }

        const fileData = {
            id: fileId,
            name: manualName,
            slug,
            filename: finalFilename,
            size: file.size,
            type: file.mimetype,
            uploaded: new Date().toISOString(),
            url: `/files/${finalFilename}`
        };

        if (logo) {
            const logoExt = path.extname(logo.originalname || logo.filename) || '.png';
            const logoFilename = `${slug}-logo${logoExt}`;
            const logoFinalPath = path.join(FILES_DIR, logoFilename);

            try {
                if (logo.filename !== logoFilename) {
                    await fs.rename(path.join(FILES_DIR, logo.filename), logoFinalPath);
                }
            } catch (error) {
                console.error('Error renaming logo file:', error.message || error);
            }

            fileData.logoFilename = logoFilename;
            fileData.logo = `/files/${logoFilename}`;
        }

        manifest.files.push(fileData);
        await writeManifest(manifest);

        res.json({ success: true, file: fileData });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Delete file
app.delete('/api/files/:id', async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const manifest = await readManifest();
        const fileIndex = manifest.files.findIndex(f => f.id === fileId);

        if (fileIndex === -1) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = manifest.files[fileIndex];

        // Delete files from disk
        try {
            if (file.filename) {
                await fs.unlink(path.join(FILES_DIR, file.filename));
            }
            if (file.logoFilename) {
                await fs.unlink(path.join(FILES_DIR, file.logoFilename));
            }
        } catch (error) {
            console.error('Error deleting files from disk:', error);
        }

        // Remove from manifest
        manifest.files.splice(fileIndex, 1);
        await writeManifest(manifest);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Replace file contents (and optional logo)
app.post('/api/files/:id/replace', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'logo', maxCount: 1 }
]), async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const manifest = await readManifest();
        const fileIndex = manifest.files.findIndex(f => f.id === fileId);

        if (fileIndex === -1) {
            return res.status(404).json({ error: 'File not found' });
        }

        const existingFile = manifest.files[fileIndex];
        const newFile = req.files?.file?.[0] || null;
        const newLogo = req.files?.logo?.[0] || null;

        const hasMetadataUpdate = typeof req.body?.manualName === 'string'
            || typeof req.body?.manualSlug === 'string'
            || typeof req.body?.name === 'string';

        if (!newFile && !newLogo && !hasMetadataUpdate) {
            return res.status(400).json({ error: 'No replacement data provided' });
        }

        const manualNameRaw = req.body.manualName || req.body.name || existingFile.name || existingFile.filename;
        const manualName = manualNameRaw ? manualNameRaw.toString().trim() : existingFile.name;
        const slugCandidate = req.body.manualSlug || manualName || existingFile.slug || existingFile.filename;

        const determineExtension = () => {
            if (newFile) {
                return path.extname(newFile.originalname) || path.extname(newFile.filename) || path.extname(existingFile.filename) || '.pdf';
            }
            return path.extname(existingFile.filename) || '.pdf';
        };

        const extension = determineExtension();
        const { filename: finalFilename, slug } = await buildUniqueFilename(manifest, slugCandidate, extension, existingFile.id);
        const finalPath = path.join(FILES_DIR, finalFilename);

        if (newFile) {
            if (existingFile.filename) {
                try {
                    await fs.unlink(path.join(FILES_DIR, existingFile.filename));
                } catch (error) {
                    console.error('Error removing old file:', error.message || error);
                }
            }

            const tempPath = path.join(FILES_DIR, newFile.filename);

            if (newFile.filename !== finalFilename) {
                await fs.rename(tempPath, finalPath);
            }

            existingFile.size = newFile.size;
            existingFile.type = newFile.mimetype;
            existingFile.uploaded = new Date().toISOString();
        } else if (existingFile.filename && existingFile.filename !== finalFilename) {
            try {
                await fs.rename(
                    path.join(FILES_DIR, existingFile.filename),
                    finalPath
                );
            } catch (error) {
                console.error('Error renaming existing file:', error.message || error);
            }
        }

        existingFile.filename = finalFilename;
        existingFile.slug = slug;
        existingFile.url = `/files/${finalFilename}`;
        if (manualName) {
            existingFile.name = manualName;
        }

        // Replace logo if provided
        if (newLogo) {
            if (existingFile.logoFilename) {
                try {
                    await fs.unlink(path.join(FILES_DIR, existingFile.logoFilename));
                } catch (error) {
                    console.error('Error removing old logo:', error.message || error);
                }
            }

            const logoExt = path.extname(newLogo.originalname || newLogo.filename) || '.png';
            const logoFilename = `${existingFile.slug || slug}-logo${logoExt}`;
            const logoFinalPath = path.join(FILES_DIR, logoFilename);

            try {
                if (newLogo.filename !== logoFilename) {
                    await fs.rename(path.join(FILES_DIR, newLogo.filename), logoFinalPath);
                }
            } catch (error) {
                console.error('Error renaming replacement logo:', error.message || error);
            }

            existingFile.logoFilename = logoFilename;
            existingFile.logo = `/files/${logoFilename}`;
        }

        await writeManifest(manifest);
        res.json({ success: true, file: existingFile });
    } catch (error) {
        console.error('Error replacing file:', error);
        res.status(500).json({ error: 'Failed to replace file' });
    }
});

// Update file metadata
app.put('/api/files/:id', async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const manifest = await readManifest();
        const fileIndex = manifest.files.findIndex(f => f.id === fileId);

        if (fileIndex === -1) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Update file metadata
        const file = manifest.files[fileIndex];
        const manualNameRaw = req.body.manualName || req.body.name;
        if (manualNameRaw) {
            const manualName = manualNameRaw.toString().trim();
            if (manualName) {
                file.name = manualName;
            }
        }

        const slugInput = req.body.manualSlug || req.body.slug;
        if (slugInput) {
            const extension = path.extname(file.filename) || '.pdf';
            const { filename: finalFilename, slug } = await buildUniqueFilename(manifest, slugInput, extension, file.id);

            if (file.filename !== finalFilename) {
                try {
                    await fs.rename(
                        path.join(FILES_DIR, file.filename),
                        path.join(FILES_DIR, finalFilename)
                    );
                } catch (error) {
                    console.error('Error renaming file during metadata update:', error.message || error);
                }
            }

            file.filename = finalFilename;
            file.slug = slug;
            file.url = `/files/${finalFilename}`;
        }

        await writeManifest(manifest);
        res.json({ success: true, file });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ error: 'Failed to update file' });
    }
});

// Site visibility settings
app.get('/api/site-settings', async (req, res) => {
    try {
        const settings = await readSiteSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error reading site settings:', error);
        res.status(500).json({ error: 'Failed to read site settings' });
    }
});

app.put('/api/site-settings', async (req, res) => {
    try {
        const settings = await writeSiteSettings(req.body || {});
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error saving site settings:', error);
        res.status(500).json({ error: 'Failed to save site settings' });
    }
});

// Site analytics
app.post('/api/analytics/view', async (req, res) => {
    try {
        const pathValue = (req.body?.path || '').trim();
        const title = (req.body?.title || '').trim();

        if (!pathValue) {
            return res.status(400).json({ error: 'Page path is required' });
        }

        const analytics = await recordAnalyticsView(pathValue, title);
        res.json({ success: true, updatedAt: analytics.updatedAt });
    } catch (error) {
        console.error('Error recording analytics view:', error);
        res.status(500).json({ error: 'Failed to record analytics view' });
    }
});

app.get('/api/analytics', async (req, res) => {
    try {
        const analytics = await readAnalytics();
        res.json(buildAnalyticsReport(analytics));
    } catch (error) {
        console.error('Error reading analytics:', error);
        res.status(500).json({ error: 'Failed to read analytics' });
    }
});

app.post('/api/analytics/reset', async (req, res) => {
    try {
        const scope = req.body?.scope;
        if (!['today', 'month', 'all'].includes(scope)) {
            return res.status(400).json({ error: 'Invalid reset scope' });
        }

        const analytics = await resetAnalytics(scope);
        res.json({ success: true, report: buildAnalyticsReport(analytics) });
    } catch (error) {
        console.error('Error resetting analytics:', error);
        res.status(500).json({ error: 'Failed to reset analytics' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
ensureFilesDir().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Okami Designs API server running on port ${PORT}`);
        console.log(`📁 Files directory: ${FILES_DIR}`);
        console.log(`✅ Server ready and listening on 0.0.0.0:${PORT}`);
    });
}).catch(error => {
    console.error('Failed to start server:', error);
    // Don't exit - let docker restart handle it
    setTimeout(() => process.exit(1), 5000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

