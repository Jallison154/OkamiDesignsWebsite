// Okami Designs - Backend API Server
const { loadEnv, ENV_PATH } = require('./server/config/load-env');
const envLoadResult = loadEnv();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const pageRegistry = require('./shared/registry/pages');
const { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } = require('./shared/settings/site-settings');
const accessPolicy = require('./shared/visibility/access-policy');
const commercialRoutes = require('./server/commercial/routes');
const productVersion = require('./shared/commercial/product-version');
const { readCommercialConfig, validateCommercialConfig, logCommercialValidation } = require('./server/commercial/config');
const { readAppConfig } = require('./server/config/app-config');
const { createCorsMiddleware } = require('./server/middleware/cors');
const { isAdminRequest, requireAdmin, initAdminAuth, getAdminSession, getAdminAuthConfig } = require('./server/middleware/admin-auth');
const adminAuthService = require('./server/admin/auth-service');
const { createRateLimiter } = require('./server/middleware/rate-limit');

const appConfig = readAppConfig();
const app = express();
const PORT = appConfig.port;
initAdminAuth(appConfig);
const FILES_DIR = path.join(__dirname, 'files');
const MANIFEST_PATH = path.join(FILES_DIR, 'manifest.json');
const SITE_SETTINGS_PATH = path.join(FILES_DIR, 'site-settings.json');
const ANALYTICS_PATH = path.join(FILES_DIR, 'analytics.json');

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
app.set('trust proxy', 1);

app.use('/api/admin', (req, res, next) => {
    setAdminSecurityHeaders(res);
    next();
});

app.use('/api/site-settings', (req, res, next) => {
    setNoCacheHeaders(res);
    next();
});

const { normalizeVisibilityPath, getAccessDecision, buildVisibilityRedirect: sharedBuildVisibilityRedirect, resolvePublicLandingPage } = accessPolicy;

const HOME_HTML = path.join(__dirname, 'home.html');
const CONSTRUCTION_HTML = path.join(__dirname, 'index.html');

function logSiteRouting(details) {
    console.info('[Site Routing]', {
        ...details,
        timestamp: new Date().toISOString()
    });
}

function describeLandingPage(landing) {
    return landing === 'construction'
        ? 'index.html (construction splash)'
        : 'home.html (live site)';
}

async function logStartupSiteRouting() {
    try {
        const settings = await readSiteSettings();
        const landing = resolvePublicLandingPage(settings);
        logSiteRouting({
            context: 'startup',
            route: '/',
            constructionMode: Boolean(settings.constructionMode),
            landingPage: describeLandingPage(landing),
            settingsSource: SITE_SETTINGS_PATH,
            settingsUpdatedAt: settings.updatedAt || null
        });
    } catch (error) {
        console.warn('[Site Routing] startup check failed:', error.message || error);
    }
}

function serveManagedRoot(req, res, settings, pathValue, isAdmin) {
    const landing = resolvePublicLandingPage(settings);

    logSiteRouting({
        context: 'request',
        route: req.path,
        constructionMode: Boolean(settings.constructionMode),
        landingPage: describeLandingPage(landing),
        isAdmin
    });

    setNoCacheHeaders(res);

    if (landing === 'home') {
        if (pathValue === 'index.html') {
            if (isAdmin) {
                return res.sendFile(CONSTRUCTION_HTML);
            }
            return res.redirect(302, '/');
        }
        return res.sendFile(HOME_HTML);
    }

    return res.sendFile(CONSTRUCTION_HTML);
}

function setNoCacheHeaders(res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
}

function setAdminSecurityHeaders(res) {
    setNoCacheHeaders(res);
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
}

const ADMIN_PAGE_PATTERN = /^\/admin(-analytics)?\.html$/i;

app.use((req, res, next) => {
    const pathLower = req.path.toLowerCase();
    if (ADMIN_PAGE_PATTERN.test(pathLower) || pathLower.startsWith('/api/admin')) {
        setAdminSecurityHeaders(res);
    }
    next();
});

function getServerAccessDecision(pathValue, settings, isAdmin) {
    return getAccessDecision({ pathValue, settings, isAdmin });
}

function buildVisibilityRedirect(pathValue, reason, settings) {
    if (reason === 'hidden' && settings?.constructionMode) {
        return sharedBuildVisibilityRedirect(pathValue, 'construction', settings);
    }
    return sharedBuildVisibilityRedirect(pathValue, reason, settings);
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
    const requestPath = req.path.toLowerCase();

    const isManagedPage = pathValue === ''
        || pathValue.endsWith('.html')
        || pathValue.startsWith('tools/');

    if (!isManagedPage) {
        return next();
    }

    try {
        const settings = await readSiteSettings();
        const isAdmin = isAdminRequest(req);

        if (requestPath === '/' || requestPath === '/index.html') {
            const rootVariant = requestPath === '/index.html' ? 'index.html' : '';
            serveManagedRoot(req, res, settings, rootVariant, isAdmin);
            return;
        }

        if (!settings.constructionMode && pathValue === 'home.html' && !isAdmin) {
            return res.redirect(301, '/');
        }

        const access = getServerAccessDecision(pathValue, settings, isAdmin);

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

const LED_CALCULATOR_HTML = path.join(__dirname, 'tools/led-wall-visualizer.html');

app.get('/tools/led-video-wall-calculator', (req, res) => {
    setNoCacheHeaders(res);
    res.sendFile(LED_CALCULATOR_HTML);
});

// Chrome DevTools probes this automatically; avoid 404 + strict CSP console noise.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
    res.type('application/json').send('{}');
});

const STATIC_CACHE_PATTERN = /\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i;
app.use(express.static('.', {
    index: false,
    setHeaders: (res, filePath) => {
        if (/\.html$/i.test(filePath)) {
            setNoCacheHeaders(res);
        } else if (STATIC_CACHE_PATTERN.test(filePath)) {
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));
app.use('/files', express.static(FILES_DIR, {
    etag: false,
    maxAge: 0,
    lastModified: true,
    setHeaders: (res) => {
        setNoCacheHeaders(res);
    }
}));

app.use(createCorsMiddleware(appConfig));

const analyticsRateLimit = createRateLimiter({
    windowMs: appConfig.analyticsRateLimit.windowMs,
    max: appConfig.analyticsRateLimit.max,
    keyPrefix: 'analytics-view'
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

const TRACKABLE_PAGES = pageRegistry.getTrackablePages().map((page) => ({
    path: page.analyticsPath,
    title: page.title
}));

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
app.post('/api/upload', requireAdmin, upload.fields([
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
app.delete('/api/files/:id', requireAdmin, async (req, res) => {
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
app.post('/api/files/:id/replace', requireAdmin, upload.fields([
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
app.put('/api/files/:id', requireAdmin, async (req, res) => {
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
        res.json({
            constructionMode: settings.constructionMode,
            pages: settings.pages,
            updatedAt: settings.updatedAt || null
        });
    } catch (error) {
        console.error('Error reading site settings:', error);
        res.status(500).json({ error: 'Failed to read site settings' });
    }
});

async function handleSaveSiteSettings(req, res) {
    try {
        const settings = await writeSiteSettings(req.body || {});
        res.json({
            success: true,
            settings: {
                constructionMode: settings.constructionMode,
                pages: settings.pages,
                updatedAt: settings.updatedAt || null
            }
        });
    } catch (error) {
        console.error('Error saving site settings:', error);
        res.status(500).json({ error: 'Failed to save site settings' });
    }
}

app.post('/api/admin/login', async (req, res) => {
    setAdminSecurityHeaders(res);

    const config = getAdminAuthConfig();
    if (!adminAuthService.isAdminAuthConfigured(config)) {
        return res.status(503).json({ error: 'admin_auth_not_configured' });
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password.trim()) {
        return res.status(400).json({ error: 'password_required' });
    }

    try {
        const valid = await adminAuthService.verifyAdminPassword(password, config);
        if (!valid) {
            return res.status(401).json({ error: 'invalid_credentials' });
        }

        const token = adminAuthService.createSessionToken(config);
        res.setHeader('Set-Cookie', adminAuthService.buildSessionCookie(token, config));
        return res.json({
            success: true,
            expiresAt: new Date(Date.now() + config.sessionMaxAgeMs).toISOString()
        });
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({ error: 'login_failed' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    setAdminSecurityHeaders(res);
    res.setHeader('Set-Cookie', adminAuthService.buildClearSessionCookie(getAdminAuthConfig()));
    res.json({ success: true });
});

app.get('/api/admin/session', (req, res) => {
    setAdminSecurityHeaders(res);
    const session = getAdminSession(req);
    if (!session) {
        return res.json({ authenticated: false });
    }

    return res.json({
        authenticated: true,
        expiresAt: new Date(session.exp).toISOString()
    });
});

app.post('/api/site-settings', requireAdmin, handleSaveSiteSettings);
app.put('/api/site-settings', requireAdmin, handleSaveSiteSettings);

// Site analytics
app.post('/api/analytics/view', analyticsRateLimit, async (req, res) => {
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

app.get('/api/analytics', requireAdmin, async (req, res) => {
    try {
        const analytics = await readAnalytics();
        res.json(buildAnalyticsReport(analytics));
    } catch (error) {
        console.error('Error reading analytics:', error);
        res.status(500).json({ error: 'Failed to read analytics' });
    }
});

app.post('/api/analytics/reset', requireAdmin, async (req, res) => {
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

// Commercial API — licensing, accounts, entitlements, version checks (server-side only)
app.use('/api/commercial', commercialRoutes);

// Health check
app.get('/api/health', (req, res) => {
    setNoCacheHeaders(res);
    const commercial = readCommercialConfig();
    const adminConfig = getAdminAuthConfig();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: productVersion.WEB_APP_VERSION,
        environment: appConfig.nodeEnv,
        admin: {
            configured: adminAuthService.isAdminAuthConfigured(adminConfig),
            devFallback: Boolean(adminConfig.usingDevPasswordFallback)
        },
        commercial: {
            enabled: commercial.commercialEnabled
        }
    });
});

function logAdminAuthStartup() {
    const config = getAdminAuthConfig();
    const configured = adminAuthService.isAdminAuthConfigured(config);

    if (envLoadResult.loaded) {
        console.log(`🔐 Environment loaded from ${envLoadResult.path} (${envLoadResult.method || 'dotenv'})`);
    } else {
        console.warn(`⚠️  No .env file at ${ENV_PATH} — using process environment only`);
    }

    if (configured) {
        console.log('✅ Admin login configured (ADMIN_PASSWORD_HASH or development fallback)');
        if (config.usingDevPasswordFallback) {
            console.warn('⚠️  Development mode: using ADMIN_DEV_PASSWORD — set ADMIN_PASSWORD_HASH before production');
        }
        return;
    }

    console.warn('⚠️  Admin login is NOT configured.');
    console.warn('   Set ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET in .env (see docs/ADMIN-LOGIN-SETUP.md)');
    if (appConfig.isProduction) {
        console.warn('   Production requires ADMIN_PASSWORD_HASH — login is disabled until configured.');
    } else {
        console.warn('   Local dev: set ADMIN_DEV_PASSWORD in .env, or generate a hash with:');
        console.warn('   node scripts/generate-admin-password-hash.mjs "your-password"');
    }
}

async function prepareServer() {
    await ensureFilesDir();
    logAdminAuthStartup();
    logCommercialValidation(validateCommercialConfig(readCommercialConfig()));
    await logStartupSiteRouting();
}

function startServer() {
    return prepareServer().then(() => new Promise((resolve, reject) => {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Okami Designs API server running on port ${PORT}`);
            console.log(`📁 Files directory: ${FILES_DIR}`);
            console.log(`⚙️  Site settings: ${SITE_SETTINGS_PATH}`);
            console.log(`✅ Server ready and listening on 0.0.0.0:${PORT}`);
            console.log(`   Cloudflare Tunnel should target http://127.0.0.1:${PORT} (site root — not /index.html or a static subfolder)`);
            resolve(server);
        });
        server.on('error', reject);
    }));
}

module.exports = { app, prepareServer, startServer, PORT };

if (require.main === module) {
    startServer().catch((error) => {
        console.error('Failed to start server:', error);
        setTimeout(() => process.exit(1), 5000);
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

