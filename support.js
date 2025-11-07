// Support page - Display uploaded documentation
(function() {
    'use strict';

    // IndexedDB database setup (same as admin.js)
    let db = null;
    const DB_NAME = 'OkamiDesignsDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'uploadedFiles';
    
    // Initialize IndexedDB
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        // Try to load from static files first (for production)
        loadStaticFiles().then(() => {
            // Then load from IndexedDB (for local files)
            initDB().then(() => {
                loadDocs();
            }).catch((error) => {
                console.error('Failed to initialize IndexedDB:', error);
                // Still show static files even if IndexedDB fails
                const docsGrid = document.getElementById('docs-grid');
                if (docsGrid && docsGrid.innerHTML.includes('Loading')) {
                    docsGrid.innerHTML = '<p style="color: var(--secondary-text);">No documentation available yet.</p>';
                }
            });
        }).catch(() => {
            // No static files, just use IndexedDB
            initDB().then(() => {
                loadDocs();
            }).catch((error) => {
                console.error('Failed to initialize:', error);
                const docsGrid = document.getElementById('docs-grid');
                if (docsGrid) {
                    docsGrid.innerHTML = '<p style="color: var(--secondary-text);">Unable to load documentation. Please refresh the page.</p>';
                }
            });
        });
    });
    
    async function loadStaticFiles() {
        try {
            const manifestResponse = await fetch('files/manifest.json');
            if (manifestResponse.ok) {
                const manifest = await manifestResponse.json();
                const docsGrid = document.getElementById('docs-grid');
                if (docsGrid && manifest.files.length > 0) {
                    docsGrid.innerHTML = '';
                    manifest.files.forEach((file) => {
                        const docCard = document.createElement('div');
                        docCard.className = 'manual-card';
                        const logoUrl = file.logo || (file.logoFilename ? `/files/${file.logoFilename}` : null);
                        const hasLogo = !!logoUrl;
                        const fileUrl = file.url || (file.filename ? `/files/${file.filename}` : '#');
                        const isImage = file.type && file.type.startsWith('image/');
                        
                        docCard.innerHTML = `
                            ${hasLogo ? `<div class="manual-preview"><img src="${logoUrl}" alt="Project logo" onerror="this.parentElement.innerHTML='<div style=\'padding: 40px; text-align: center; color: var(--secondary-text);\'>No Logo</div>'" /></div>` : 
                              isImage ? `<div class="manual-preview"><img src="${fileUrl}" alt="${file.name}" /></div>` : 
                              `<div class="manual-icon">📄</div>`}
                            <div class="manual-name">${file.name}</div>
                            <div class="manual-description">${formatFileSize(file.size)} • Uploaded ${formatDate(file.uploaded)}</div>
                            <a href="${fileUrl}" class="manual-download-link" download="${file.name}">Download</a>
                        `;
                        docsGrid.appendChild(docCard);
                    });
                }
            }
        } catch (error) {
            // No static files manifest - that's okay
            console.log('No static files manifest found');
        }
    }

    function loadDocs() {
        const docsGrid = document.getElementById('docs-grid');
        if (!docsGrid) return;

        // Don't overwrite if static files are already loaded
        if (!docsGrid.innerHTML.includes('Loading') && docsGrid.children.length > 0) {
            // Static files already loaded, just append IndexedDB files
        } else {
            docsGrid.innerHTML = '<p style="color: var(--secondary-text);">Loading documentation...</p>';
        }

        if (!db) {
            if (docsGrid.innerHTML.includes('Loading')) {
                docsGrid.innerHTML = '<p style="color: var(--secondary-text);">Database not initialized. Please refresh the page.</p>';
            }
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const files = request.result;
            
            // Only clear if we're starting fresh
            if (docsGrid.innerHTML.includes('Loading') || docsGrid.innerHTML.includes('No documentation')) {
                docsGrid.innerHTML = '';
            }

            if (files.length === 0 && docsGrid.children.length === 0) {
                docsGrid.innerHTML = '<p style="color: var(--secondary-text);">No documentation available yet.</p>';
                return;
            }

            console.log('Loaded files from IndexedDB:', files);
            files.forEach((file, index) => {
                const docCard = document.createElement('div');
                docCard.className = 'manual-card';
                const logoUrl = file.logo || (file.logoFilename ? `/files/${file.logoFilename}` : null);
                const hasLogo = !!logoUrl;
                const fileUrl = file.url || (file.filename ? `/files/${file.filename}` : '#');
                const isImage = file.type && file.type.startsWith('image/');
                
                docCard.innerHTML = `
                    ${hasLogo ? `<div class="manual-preview"><img src="${logoUrl}" alt="Project logo" onerror="this.parentElement.innerHTML='<div style=\'padding: 40px; text-align: center; color: var(--secondary-text);\'>No Logo</div>'" /></div>` : 
                      isImage ? `<div class="manual-preview"><img src="${fileUrl}" alt="${file.name}" /></div>` : 
                      `<div class="manual-icon">📄</div>`}
                    <div class="manual-name">${file.name}</div>
                    <div class="manual-description">${formatFileSize(file.size)} • Uploaded ${formatDate(file.uploaded)}</div>
                    <button class="manual-download-link" onclick="downloadFile(${file.id})">Download</button>
                `;
                docsGrid.appendChild(docCard);
            });
        };

        request.onerror = () => {
            console.error('Error loading files:', request.error);
            docsGrid.innerHTML = '<p style="color: var(--secondary-text);">Error loading documentation. Please refresh the page.</p>';
        };
    }

    function downloadFile(fileId) {
        if (!db) {
            alert('Database not initialized');
            return;
        }
        
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(fileId);
        
        request.onsuccess = () => {
            const file = request.result;
            
            if (!file) {
                alert('File not found');
                return;
            }
            
            // Convert base64 data URL to blob and download
            try {
                // If it's already a data URL (base64), convert it to blob
                if (file.url.startsWith('data:')) {
                    fetch(file.url)
                        .then(res => res.blob())
                        .then(blob => {
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = file.name;
                            link.style.display = 'none';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                        })
                        .catch(err => {
                            console.error('Download failed:', err);
                            alert('Download failed. Please try again.');
                        });
                } else {
                    // Fallback for blob URLs (shouldn't happen with new system)
                    const url = window.URL.createObjectURL(new Blob([file.url]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = file.name;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                }
            } catch (error) {
                console.error('Download error:', error);
                alert('Download failed. Please try again.');
            }
        };
        
        request.onerror = () => {
            alert('Error loading file: ' + request.error.message);
        };
    }
    
    // Make function globally available
    window.downloadFile = downloadFile;

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }
})();

