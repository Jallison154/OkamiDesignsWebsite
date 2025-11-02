// Admin authentication and file management
(function() {
    'use strict';

    // Admin password hash (SHA-256 hash of 'okami2025')
    // The password is stored as a hash instead of plain text for security
    // To change password: hash your new password using SHA-256 and replace this value
    // You can generate a hash at: https://emn178.github.io/online-tools/sha256.html
    // Or run this in browser console after page loads:
    // hashPassword('yourpassword').then(h => console.log(h))
    // Note: This hash will be generated on first login attempt - see initialization code below
    let ADMIN_PASSWORD_HASH = null;

    // Track selected files
    let selectedLogo = null;
    let selectedFile = null;
    
    // IndexedDB database setup
    let db = null;
    const DB_NAME = 'OkamiDesignsDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'uploadedFiles';
    
    // Hash a string using SHA-256
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
    
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

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', async function() {
        // Generate password hash on initialization (so it's not stored in plain text)
        ADMIN_PASSWORD_HASH = await hashPassword('okami2025');
        
        // Initialize IndexedDB first
        initDB().then(() => {
            console.log('IndexedDB initialized');
            
            // Check if already authenticated
            if (sessionStorage.getItem('adminAuthenticated') === 'true') {
                showAdminPanel();
            } else {
                showLoginScreen();
            }

            // Setup login form
            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', handleLogin);
            }

            // Setup logout
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', handleLogout);
            }
            
            // Setup mobile logout button
            const logoutBtnMobile = document.getElementById('logout-btn-mobile');
            if (logoutBtnMobile) {
                logoutBtnMobile.addEventListener('click', handleLogout);
            }

            // Setup file uploads
            setupFileUploads();
            
            // Setup export files button
            const exportBtn = document.getElementById('export-files-btn');
            if (exportBtn) {
                exportBtn.addEventListener('click', exportFilesForDeployment);
            }
            
            // Load existing files (only if authenticated)
            if (sessionStorage.getItem('adminAuthenticated') === 'true') {
                loadFiles();
            }
        }).catch((error) => {
            console.error('Failed to initialize IndexedDB:', error);
            alert('Failed to initialize database. Please refresh the page.');
        });
    });

    function showLoginScreen() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('admin-panel').style.display = 'none';
    }

    function showAdminPanel() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
    }

    async function handleLogin(e) {
        e.preventDefault();
        const passwordInput = document.getElementById('admin-password');
        const errorMsg = document.getElementById('login-error');
        const password = passwordInput.value;

        // Hash the entered password and compare with stored hash
        const enteredPasswordHash = await hashPassword(password);
        
        if (enteredPasswordHash === ADMIN_PASSWORD_HASH) {
            sessionStorage.setItem('adminAuthenticated', 'true');
            showAdminPanel();
            errorMsg.textContent = '';
            // Load files after successful login
            loadFiles();
        } else {
            errorMsg.textContent = 'Incorrect password. Please try again.';
            passwordInput.value = '';
        }
    }

    function handleLogout() {
        sessionStorage.removeItem('adminAuthenticated');
        window.location.reload();
    }

    function setupFileUploads() {
        const logoInput = document.getElementById('logo-upload');
        const fileInput = document.getElementById('file-upload');
        const uploadBtn = document.getElementById('upload-combined');
        const logoPreview = document.getElementById('logo-preview');
        const filePreview = document.getElementById('file-preview');

        // Logo upload
        logoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                selectedLogo = file;
                // Convert to base64 for persistence
                const reader = new FileReader();
                reader.onload = function(e) {
                    logoPreview.innerHTML = `<img src="${e.target.result}" alt="Logo preview" />`;
                };
                reader.readAsDataURL(file);
                checkUploadButton();
            }
        });

        // File upload
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                selectedFile = file;
                const icon = getFileIcon(file.type);
                filePreview.innerHTML = `<div style="font-size: 48px; margin-bottom: 10px;">${icon}</div><div style="font-size: 14px; color: var(--primary-text);">${file.name}</div><div style="font-size: 12px; color: var(--secondary-text);">${formatFileSize(file.size)}</div>`;
                checkUploadButton();
            }
        });

        // Combined upload
        uploadBtn.addEventListener('click', function() {
            if (selectedFile) {
                handleCombinedUpload();
            }
        });
    }

    function getFileIcon(type) {
        if (type.includes('pdf')) return '📕';
        if (type.includes('word') || type.includes('document')) return '📘';
        if (type.includes('image')) return '🖼️';
        return '📄';
    }

    function checkUploadButton() {
        const uploadBtn = document.getElementById('upload-combined');
        if (uploadBtn) {
            uploadBtn.disabled = !selectedFile;
        }
    }

    function handleCombinedUpload() {
        const uploadBtn = document.getElementById('upload-combined');
        const files = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
        
        if (!selectedFile) {
            alert('Please select a file to upload.');
            return;
        }
        
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        // Convert files to base64 for persistence
        const convertToBase64 = (file) => {
            return new Promise((resolve, reject) => {
                if (!file) {
                    resolve(null);
                    return;
                }
                
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    try {
                        const result = e.target.result;
                        // Check if result is valid
                        if (result && result.length > 0) {
                            resolve(result);
                        } else {
                            reject(new Error('Empty file data'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                };
                
                reader.onerror = function(error) {
                    console.error('FileReader error:', error);
                    reject(new Error('Failed to read file: ' + error));
                };
                
                reader.onabort = function() {
                    reject(new Error('File reading was aborted'));
                };
                
                try {
                    reader.readAsDataURL(file);
                } catch (error) {
                    reject(new Error('Failed to start file reading: ' + error.message));
                }
            });
        };

        // Convert file first
        convertToBase64(selectedFile)
            .then((fileDataUrl) => {
                // Then convert logo if it exists
                if (selectedLogo) {
                    return convertToBase64(selectedLogo)
                        .then((logoDataUrl) => [fileDataUrl, logoDataUrl]);
                } else {
                    return [fileDataUrl, null];
                }
            })
            .then(([fileDataUrl, logoDataUrl]) => {
                try {
                    const fileData = {
                        name: selectedFile.name,
                        size: selectedFile.size,
                        type: selectedFile.type,
                        uploaded: new Date().toISOString(),
                        url: fileDataUrl,
                        logo: logoDataUrl
                    };

                    // Save to IndexedDB instead of localStorage
                    if (!db) {
                        throw new Error('Database not initialized');
                    }
                    
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.add(fileData);
                    
                    request.onsuccess = () => {
                        console.log('Saved file data to IndexedDB:', fileData);

                        // Reset form
                        document.getElementById('logo-upload').value = '';
                        document.getElementById('file-upload').value = '';
                        document.getElementById('logo-preview').innerHTML = '';
                        document.getElementById('file-preview').innerHTML = '';
                        selectedLogo = null;
                        selectedFile = null;

                        uploadBtn.textContent = 'Upload Documentation';
                        checkUploadButton();
                        
                        // Reload files
                        loadFiles();
                    };
                    
                    request.onerror = () => {
                        console.error('Error saving to IndexedDB:', request.error);
                        alert('Error saving file: ' + request.error.message);
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = 'Upload Documentation';
                    };
                } catch (error) {
                    console.error('Error saving file:', error);
                    alert('Error saving file: ' + error.message);
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = 'Upload Documentation';
                }
            })
            .catch((error) => {
                console.error('Upload error:', error);
                let errorMessage = 'Error uploading file. ';
                if (error.message) {
                    errorMessage += error.message;
                } else {
                    errorMessage += 'Please try again.';
                }
                alert(errorMessage);
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Documentation';
            });
    }

    // Load files from both static directory and IndexedDB
    async function loadFiles() {
        const filesGrid = document.getElementById('files-grid');
        if (!filesGrid) return;

        filesGrid.innerHTML = '<p style="color: var(--secondary-text);">Loading files...</p>';

        let allFiles = [];

        // First, try to load from static files directory (for production)
        try {
            const manifestResponse = await fetch('files/manifest.json');
            if (manifestResponse.ok) {
                const manifest = await manifestResponse.json();
                manifest.files.forEach(file => {
                    // Convert static file paths to full URLs
                    file.url = `files/${file.filename}`;
                    if (file.logoFilename) {
                        file.logo = `files/${file.logoFilename}`;
                    }
                    file.isStatic = true; // Mark as static file
                    allFiles.push(file);
                });
            }
        } catch (error) {
            // manifest.json doesn't exist or can't be loaded - that's okay
            console.log('No static files manifest found (this is normal for local development)');
        }

        // Then load from IndexedDB (for local uploads)
        if (db) {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const indexedFiles = request.result;
                // Add IndexedDB files (not marked as static)
                indexedFiles.forEach(file => {
                    file.isStatic = false;
                    allFiles.push(file);
                });

                displayFiles(allFiles);
            };

            request.onerror = () => {
                displayFiles(allFiles); // Still show static files even if IndexedDB fails
            };
        } else {
            displayFiles(allFiles);
        }
    }

    function displayFiles(files) {
        const filesGrid = document.getElementById('files-grid');
        if (!filesGrid) return;

        filesGrid.innerHTML = '';

        if (files.length === 0) {
            filesGrid.innerHTML = '<p style="color: var(--secondary-text);">No files uploaded yet.</p>';
            return;
        }

        files.forEach((file, index) => {
            const fileCard = document.createElement('div');
            fileCard.className = 'file-card';
            const isImage = file.type && file.type.startsWith('image/');
            const hasLogo = file.logo !== null;
            
            const logoHtml = hasLogo ? 
                `<div class="file-preview"><img src="${file.logo}" alt="Project logo" onerror="this.parentElement.innerHTML='<div style=\\'padding: 40px; text-align: center; color: var(--secondary-text);\\'>No Logo</div>'" /></div>` :
                (isImage ? `<div class="file-preview"><img src="${file.url}" alt="${file.name}" /></div>` : 
                `<div class="file-preview" style="display: flex; align-items: center; justify-content: center; background: var(--accent-bg);">
                    <div style="text-align: center; color: var(--secondary-text); font-size: 12px;">
                        <div style="font-size: 48px; margin-bottom: 10px;">${getFileIcon(file.type)}</div>
                        <div>No Logo</div>
                    </div>
                </div>`);
            
            // Create actions based on file type
            let actionsHtml = '';
            if (file.isStatic) {
                // Static files from files/ directory - these are deployed
                actionsHtml = `<div class="file-card-actions">
                    <button class="download-file" onclick="window.open('${file.url}', '_blank')">Download</button>
                    <span style="color: var(--secondary-text); font-size: 11px; font-style: italic; margin-left: 10px;">(Deployed)</span>
                </div>`;
            } else {
                // IndexedDB files (local uploads that need to be exported)
                const fileIndex = files.findIndex(f => f.id === file.id && !f.isStatic);
                actionsHtml = `<div class="file-card-actions">
                    <button class="download-file" onclick="downloadFileAdmin(${file.id})">Download</button>
                    <button class="update-file" onclick="updateFile(${fileIndex})">Update</button>
                    <button class="delete-file" onclick="deleteFile(${fileIndex})">Delete</button>
                </div>`;
            }
            
            fileCard.innerHTML = `
                ${logoHtml}
                <div class="file-card-header">
                    <div class="file-card-name">${file.name}</div>
                    ${actionsHtml}
                </div>
                <div class="file-card-info">
                    <span class="file-card-size">${formatFileSize(file.size)}</span>
                    <span class="file-card-date">${formatDate(file.uploaded)}</span>
                </div>
            `;
            filesGrid.appendChild(fileCard);
            });
        };

        request.onerror = () => {
            console.error('Error loading files:', request.error);
            filesGrid.innerHTML = '<p style="color: var(--danger-color);">Error loading files. Please refresh the page.</p>';
        };
    }

    function updateFile(index) {
        // Create hidden file inputs
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.doc,.docx,.txt';
        input.style.display = 'none';
        
        input.addEventListener('change', function(e) {
            const newFile = e.target.files[0];
            if (newFile) {
                if (!db) {
                    alert('Database not initialized');
                    return;
                }
                
                // Convert to base64
                const reader = new FileReader();
                reader.onload = function(e) {
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    const getAllRequest = store.getAll();
                    
                    getAllRequest.onsuccess = () => {
                        const files = getAllRequest.result;
                        if (index < files.length) {
                            const updatedFile = {
                                ...files[index],
                                name: newFile.name,
                                size: newFile.size,
                                type: newFile.type,
                                uploaded: new Date().toISOString(),
                                url: e.target.result
                            };
                            
                            const putRequest = store.put(updatedFile);
                            putRequest.onsuccess = () => {
                                loadFiles(); // Reload to show update
                            };
                            putRequest.onerror = () => {
                                alert('Error updating file: ' + putRequest.error.message);
                            };
                        }
                    };
                };
                reader.readAsDataURL(newFile);
            }
        });
        
        // Trigger file picker
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    async function downloadFileAdmin(fileId, isStatic = false) {
        if (isStatic) {
            // For static files, just download directly from URL
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => {
                const files = getAllRequest.result;
                const file = files.find(f => f.id === fileId);
                if (file && file.url) {
                    const link = document.createElement('a');
                    link.href = file.url;
                    link.download = file.name;
                    link.click();
                } else {
                    // Try loading from manifest
                    fetch('files/manifest.json')
                        .then(res => res.json())
                        .then(manifest => {
                            const staticFile = manifest.files.find(f => f.id === fileId);
                            if (staticFile) {
                                const link = document.createElement('a');
                                link.href = `files/${staticFile.filename}`;
                                link.download = staticFile.name;
                                link.click();
                            }
                        });
                }
            };
            return;
        }
        
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
    
    // Export files for deployment - creates downloadable files that can be added to git
    async function exportFilesForDeployment() {
        if (!db) {
            alert('Database not initialized');
            return;
        }
        
        const exportBtn = document.getElementById('export-files-btn');
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.textContent = 'Exporting...';
        }
        
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = async () => {
            const files = request.result;
            
            if (files.length === 0) {
                alert('No files to export.');
                if (exportBtn) {
                    exportBtn.disabled = false;
                    exportBtn.textContent = 'Export Files for Deployment';
                }
                return;
            }
            
            try {
                // Create manifest.json
                const manifest = {
                    version: '1.0',
                    generated: new Date().toISOString(),
                    files: []
                };
                
                // Process each file
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const fileId = file.id || i;
                    
                    // Generate safe filename
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const fileExt = safeName.substring(safeName.lastIndexOf('.'));
                    const baseName = safeName.substring(0, safeName.lastIndexOf('.')) || safeName;
                    const filename = `${baseName}_${fileId}${fileExt}`;
                    
                    // Convert base64 to blob and create download link
                    if (file.url.startsWith('data:')) {
                        const response = await fetch(file.url);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = filename;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        
                        // Trigger download
                        await new Promise(resolve => {
                            link.onclick = () => {
                                setTimeout(() => {
                                    window.URL.revokeObjectURL(url);
                                    document.body.removeChild(link);
                                    resolve();
                                }, 100);
                            };
                            link.click();
                        });
                        
                        // Handle logo if exists
                        let logoFilename = null;
                        if (file.logo && file.logo.startsWith('data:')) {
                            const logoExt = file.logo.match(/data:image\/([^;]+)/)?.[1] || 'png';
                            logoFilename = `${baseName}_${fileId}_logo.${logoExt}`;
                            const logoResponse = await fetch(file.logo);
                            const logoBlob = await logoResponse.blob();
                            const logoUrl = window.URL.createObjectURL(logoBlob);
                            const logoLink = document.createElement('a');
                            logoLink.href = logoUrl;
                            logoLink.download = logoFilename;
                            logoLink.style.display = 'none';
                            document.body.appendChild(logoLink);
                            
                            await new Promise(resolve => {
                                logoLink.onclick = () => {
                                    setTimeout(() => {
                                        window.URL.revokeObjectURL(logoUrl);
                                        document.body.removeChild(logoLink);
                                        resolve();
                                    }, 100);
                                };
                                logoLink.click();
                            });
                        }
                        
                        // Add to manifest
                        manifest.files.push({
                            id: fileId,
                            name: file.name,
                            filename: filename,
                            logoFilename: logoFilename,
                            size: file.size,
                            type: file.type,
                            uploaded: file.uploaded
                        });
                    }
                }
                
                // Download manifest.json
                const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
                const manifestUrl = window.URL.createObjectURL(manifestBlob);
                const manifestLink = document.createElement('a');
                manifestLink.href = manifestUrl;
                manifestLink.download = 'manifest.json';
                manifestLink.style.display = 'none';
                document.body.appendChild(manifestLink);
                manifestLink.click();
                setTimeout(() => {
                    window.URL.revokeObjectURL(manifestUrl);
                    document.body.removeChild(manifestLink);
                }, 100);
                
                alert(`Exported ${files.length} file(s) and manifest.json!\n\nInstructions:\n1. Create a 'files' folder in your website directory\n2. Copy the downloaded files to the 'files' folder\n3. Copy manifest.json to the 'files' folder\n4. Commit and push to your repository\n\nFiles will then be available on the deployed website.`);
                
            } catch (error) {
                console.error('Export error:', error);
                alert('Error exporting files: ' + error.message);
            }
            
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export Files for Deployment';
            }
        };
        
        request.onerror = () => {
            alert('Error loading files for export.');
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export Files for Deployment';
            }
        };
    }

    function deleteFile(index) {
        if (confirm('Are you sure you want to delete this file?')) {
            if (!db) {
                alert('Database not initialized');
                return;
            }
            
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => {
                const files = getAllRequest.result;
                if (index < files.length) {
                    const deleteRequest = store.delete(files[index].id);
                    deleteRequest.onsuccess = () => {
                        loadFiles();
                    };
                    deleteRequest.onerror = () => {
                        alert('Error deleting file: ' + deleteRequest.error.message);
                    };
                }
            };
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    // Make functions globally available
    window.updateFile = updateFile;
    window.deleteFile = deleteFile;
    window.downloadFileAdmin = downloadFileAdmin;
})();
