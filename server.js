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

// Middleware
app.use(express.json());
app.use(express.static('.')); // Serve static files
app.use('/files', express.static(FILES_DIR)); // Serve uploaded files

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
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

        const fileData = {
            id: fileId,
            name: req.body.name || file.originalname,
            filename: file.filename,
            size: file.size,
            type: file.mimetype,
            uploaded: new Date().toISOString(),
            url: `/files/${file.filename}`
        };

        if (logo) {
            fileData.logoFilename = logo.filename;
            fileData.logo = `/files/${logo.filename}`;
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

        if (!newFile && !newLogo && !req.body?.name) {
            return res.status(400).json({ error: 'No replacement data provided' });
        }

        // Replace primary file if provided
        if (newFile) {
            if (existingFile.filename) {
                try {
                    await fs.unlink(path.join(FILES_DIR, existingFile.filename));
                } catch (error) {
                    console.error('Error removing old file:', error.message || error);
                }
            }

            existingFile.filename = newFile.filename;
            existingFile.size = newFile.size;
            existingFile.type = newFile.mimetype;
            existingFile.uploaded = new Date().toISOString();
            existingFile.url = `/files/${newFile.filename}`;
            existingFile.name = req.body?.name || newFile.originalname || existingFile.name;
        } else if (req.body?.name) {
            existingFile.name = req.body.name;
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

            existingFile.logoFilename = newLogo.filename;
            existingFile.logo = `/files/${newLogo.filename}`;
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
        if (req.body.name) {
            manifest.files[fileIndex].name = req.body.name;
        }

        await writeManifest(manifest);
        res.json({ success: true, file: manifest.files[fileIndex] });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ error: 'Failed to update file' });
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

