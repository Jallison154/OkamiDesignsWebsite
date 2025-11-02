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
    
    // Session timeout configuration (30 minutes in milliseconds)
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    let sessionTimeoutInterval = null;

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
        }).catch((error) => {
            console.error('Failed to initialize IndexedDB:', error);
            // Continue anyway - database is optional
        });
        
        // Setup login form immediately (don't wait for DB)
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        // Check if already authenticated and session hasn't expired
        const authTime = sessionStorage.getItem('adminAuthTime');
        const isAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
        
        if (isAuthenticated && authTime) {
            const timeElapsed = Date.now() - parseInt(authTime, 10);
            if (timeElapsed < SESSION_TIMEOUT) {
                // Session still valid
                showAdminPanel();
                startSessionTimeout(); // Restart timeout timer
                loadFiles();
            } else {
                // Session expired
                sessionStorage.removeItem('adminAuthenticated');
                sessionStorage.removeItem('adminAuthTime');
                showLoginScreen();
            }
        } else {
            // Not authenticated
            showLoginScreen();
        }

        // Setup logout buttons with multiple approaches to ensure they work
        function setupLogoutButtons() {
            const logoutBtn = document.getElementById('logout-btn');
            const logoutBtnMobile = document.getElementById('logout-btn-mobile');
            
            // Remove any existing listeners by cloning and replacing
            if (logoutBtn) {
                const newLogoutBtn = logoutBtn.cloneNode(true);
                logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
                newLogoutBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Logout button clicked');
                    handleLogout(e);
                });
            }
            
            if (logoutBtnMobile) {
                const newLogoutBtnMobile = logoutBtnMobile.cloneNode(true);
                logoutBtnMobile.parentNode.replaceChild(newLogoutBtnMobile, logoutBtnMobile);
                newLogoutBtnMobile.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Logout button (mobile) clicked');
                    handleLogout(e);
                });
            }
            
            // Also use event delegation as backup
            document.addEventListener('click', function(e) {
                const target = e.target;
                if (target && (target.id === 'logout-btn' || target.id === 'logout-btn-mobile')) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Logout via delegation');
                    handleLogout(e);
                }
            }, true); // Use capture phase
        }
        
        // Setup immediately
        setupLogoutButtons();
        
        // Also setup after a short delay to override any script.js handlers
        setTimeout(setupLogoutButtons, 100);

        // Setup file uploads
        setupFileUploads();
        
        // Setup export files button
        const exportBtn = document.getElementById('export-files-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportFilesForDeployment);
        }
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
        
        // Trim whitespace from password
        const password = passwordInput.value.trim();

        if (!password) {
            errorMsg.textContent = 'Please enter a password.';
            return;
        }

        // Ensure password hash is set (in case DOMContentLoaded hasn't finished)
        if (!ADMIN_PASSWORD_HASH) {
            ADMIN_PASSWORD_HASH = await hashPassword('okami2025');
        }

        // Hash the entered password and compare with stored hash
        const enteredPasswordHash = await hashPassword(password);
        
        // Debug logging (remove in production)
        console.log('Password check:', {
            enteredLength: password.length,
            enteredHash: enteredPasswordHash.substring(0, 16) + '...',
            expectedHash: ADMIN_PASSWORD_HASH ? ADMIN_PASSWORD_HASH.substring(0, 16) + '...' : 'null',
            match: enteredPasswordHash === ADMIN_PASSWORD_HASH
        });
        
        if (enteredPasswordHash === ADMIN_PASSWORD_HASH) {
            // Store authentication state and timestamp
            sessionStorage.setItem('adminAuthenticated', 'true');
            sessionStorage.setItem('adminAuthTime', Date.now().toString());
            showAdminPanel();
            errorMsg.textContent = '';
            // Start session timeout
            startSessionTimeout();
            // Load files after successful login
            loadFiles();
        } else {
            errorMsg.textContent = 'Incorrect password. Please try again.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
    
    function startSessionTimeout() {
        // Clear any existing timeout interval
        if (sessionTimeoutInterval) {
            clearInterval(sessionTimeoutInterval);
        }
        
        // Check every minute if session has expired
        sessionTimeoutInterval = setInterval(() => {
            const authTime = sessionStorage.getItem('adminAuthTime');
            if (authTime) {
                const timeElapsed = Date.now() - parseInt(authTime, 10);
                if (timeElapsed >= SESSION_TIMEOUT) {
                    // Session expired - logout
                    handleLogout();
                }
            }
        }, 60000); // Check every minute
    }

    function handleLogout(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Clear session data
        sessionStorage.removeItem('adminAuthenticated');
        sessionStorage.removeItem('adminAuthTime');
        
        // Clear timeout interval
        if (sessionTimeoutInterval) {
            clearInterval(sessionTimeoutInterval);
            sessionTimeoutInterval = null;
        }
        
        // Force reload to show login screen
        window.location.href = 'admin.html';
    }
    
    // Make handleLogout available globally for debugging
    window.handleAdminLogout = handleLogout;

    function setupFileUploads() {
        const logoInput = document.getElementById('logo-upload');
        const fileInput = document.getElementById('file-upload');
        const uploadBtn = document.getElementById('upload-combined');
        const logoPreview = document.getElementById('logo-preview');
        const filePreview = document.getElementById('file-preview');

        if (!logoInput || !fileInput || !uploadBtn || !logoPreview || !filePreview) {
            return;
        }

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

    async function handleCombinedUpload() {
        const uploadBtn = document.getElementById('upload-combined');
        
        if (!selectedFile) {
            alert('Please select a file to upload.');
            return;
        }
        
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        try {
            // Check if API is available (with timeout)
            const apiAvailable = await Promise.race([
                checkAPIHealth(),
                new Promise(resolve => setTimeout(() => resolve(false), 3000))
            ]);
            
            if (!apiAvailable) {
                throw new Error('Backend API is not available. The server may be starting up. Please wait a moment and try again, or check server logs.');
            }

            // Upload to backend (with timeout)
            const result = await Promise.race([
                uploadFile(selectedFile, selectedLogo, selectedFile.name),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 60000))
            ]);
            
            console.log('File uploaded successfully:', result);

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
            await loadFiles();
            
            alert('File uploaded successfully!');
        } catch (error) {
            console.error('Upload error:', error);
            let errorMessage = 'Error uploading file. ';
            if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Please ensure the backend API is running and try again.';
            }
            alert(errorMessage);
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Documentation';
        }
    }

    // Load files from backend API or fallback to manifest
    async function loadFiles() {
        const filesGrid = document.getElementById('files-grid');
        if (!filesGrid) return;

        filesGrid.innerHTML = '<p style="color: var(--secondary-text);">Loading files...</p>';

        // Try backend API first (with timeout)
        try {
            const apiAvailable = await Promise.race([
                checkAPIHealth(),
                new Promise(resolve => setTimeout(() => resolve(false), 2000))
            ]);
            
            if (apiAvailable) {
                try {
                    const files = await Promise.race([
                        getFiles(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                    ]);
                    
                    displayFiles(files);
                    return;
                } catch (apiError) {
                    console.warn('API request failed, falling back to manifest:', apiError.message);
                }
            }
        } catch (error) {
            console.warn('API health check failed, falling back to manifest:', error.message);
        }

        // Fallback: try to load from manifest.json (for static deployment)
        try {
            const manifestResponse = await fetch('files/manifest.json');
            if (manifestResponse.ok) {
                const manifest = await manifestResponse.json();
                manifest.files.forEach(file => {
                    file.url = `files/${file.filename}`;
                    if (file.logoFilename) {
                        file.logo = `files/${file.logoFilename}`;
                    }
                    file.isStatic = true;
                });
                displayFiles(manifest.files);
                return;
            }
        } catch (error) {
            console.log('No static files manifest found');
        }

        // No files available
        displayFiles([]);
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
                // Files from API (all files now use API)
                actionsHtml = `<div class="file-card-actions">
                    <button class="download-file" onclick="downloadFileAdmin(${file.id})">Download</button>
                    <button class="delete-file" onclick="deleteFile(${file.id})">Delete</button>
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
        try {
            // Try to get file info from API first
            const apiAvailable = await checkAPIHealth();
            if (apiAvailable) {
                const files = await getFiles();
                const file = files.find(f => f.id === fileId);
                if (file && file.url) {
                    const link = document.createElement('a');
                    link.href = file.url;
                    link.download = file.name;
                    link.click();
                    return;
                }
            }
            
            // Fallback: try loading from manifest
            const manifestResponse = await fetch('files/manifest.json');
            if (manifestResponse.ok) {
                const manifest = await manifestResponse.json();
                const staticFile = manifest.files.find(f => f.id === fileId);
                if (staticFile) {
                    const link = document.createElement('a');
                    link.href = `files/${staticFile.filename}`;
                    link.download = staticFile.name;
                    link.click();
                    return;
                }
            }
            
            alert('File not found');
        } catch (error) {
            console.error('Download error:', error);
            alert('Download failed. Please try again.');
        }
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

    async function deleteFile(fileId) {
        if (!confirm('Are you sure you want to delete this file?')) {
            return;
        }
        
        try {
            const apiAvailable = await checkAPIHealth();
            if (!apiAvailable) {
                throw new Error('Backend API is not available.');
            }
            
            await deleteFileById(fileId);
            await loadFiles();
            alert('File deleted successfully');
        } catch (error) {
            console.error('Delete error:', error);
            alert('Error deleting file: ' + (error.message || 'Please try again.'));
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
