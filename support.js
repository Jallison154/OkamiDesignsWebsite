// Support page - Fetch documentation from backend API
(function() {
    'use strict';

    const API_BASE = '/api';

    document.addEventListener('DOMContentLoaded', () => {
        loadDocumentation();
    });

    async function loadDocumentation() {
        const docsGrid = document.getElementById('docs-grid');
        if (!docsGrid) return;

        docsGrid.innerHTML = '<p style="color: var(--secondary-text);">Loading documentation...</p>';

        let files = await fetchFromAPI();

        if (!files.length) {
            files = await fetchFromManifest();
        }

        if (!files.length) {
            docsGrid.innerHTML = '<p style="color: var(--secondary-text);">No documentation available yet.</p>';
            return;
        }

        docsGrid.innerHTML = '';
        files.forEach(file => {
            docsGrid.appendChild(buildDocCard(file));
        });
    }

    async function fetchFromAPI() {
        try {
            const response = await fetch(`${API_BASE}/files`, {
                cache: 'no-store'
            });
            if (!response.ok) {
                throw new Error(`API responded with ${response.status}`);
            }
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.warn('Unable to load docs from API:', error.message || error);
            return [];
        }
    }

    async function fetchFromManifest() {
        try {
            const response = await fetch('files/manifest.json', {
                cache: 'no-cache'
            });
            if (!response.ok) {
                throw new Error('Manifest not found');
            }
            const manifest = await response.json();
            return Array.isArray(manifest?.files) ? manifest.files : [];
        } catch (error) {
            console.warn('No static manifest available:', error.message || error);
            return [];
        }
    }

    function buildDocCard(file) {
        const docCard = document.createElement('div');
        docCard.className = 'manual-card';

        const fileUrl = resolveFileUrl(file);
        const logoUrl = resolveLogoUrl(file);
        const isImage = file?.type?.startsWith('image/');

        let previewHTML = '<div class="manual-icon">📄</div>';

        if (logoUrl) {
            previewHTML = `
                <div class="manual-preview">
                    <img src="${logoUrl}" alt="Project logo" onerror="this.closest('.manual-preview').innerHTML='<div style=\'padding:40px;text-align:center;color:var(--secondary-text);\'>No Logo</div>'" />
                </div>
            `;
        } else if (isImage) {
            previewHTML = `
                <div class="manual-preview">
                    <img src="${fileUrl}" alt="${file?.name || 'Manual preview'}" />
                </div>
            `;
        }

        docCard.innerHTML = `
            ${previewHTML}
            <div class="manual-name">${escapeHTML(file?.name || 'Untitled Manual')}</div>
            <div class="manual-description">${formatFileSize(file?.size)} • Uploaded ${formatDate(file?.uploaded)}</div>
            <a class="manual-download-link" href="${fileUrl}" download="${escapeAttribute(file?.name || 'manual.pdf')}">Download</a>
        `;

        return docCard;
    }

    function resolveFileUrl(file) {
        if (!file) return '#';
        if (file.url) return file.url;
        if (file.filename) return `/files/${file.filename}`;
        return '#';
    }

    function resolveLogoUrl(file) {
        if (!file) return null;
        return file.logoUrl || file.logo || (file.logoFilename ? `/files/${file.logoFilename}` : null);
    }

    function formatFileSize(bytes) {
        const size = Number(bytes);
        if (!Number.isFinite(size) || size <= 0) return 'Unknown size';
        const units = ['Bytes', 'KB', 'MB', 'GB'];
        const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
        const value = size / Math.pow(1024, exponent);
        return `${value.toFixed(value < 10 && exponent > 0 ? 1 : 0)} ${units[exponent]}`;
    }

    function formatDate(value) {
        try {
            const date = value ? new Date(value) : new Date();
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return 'Unknown date';
        }
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, (char) => {
            const entities = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return entities[char];
        });
    }

    function escapeAttribute(str) {
        return escapeHTML(str).replace(/\s+/g, '_');
    }
})();

