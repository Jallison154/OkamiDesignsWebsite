// Admin API client - Replaces IndexedDB with backend API
const API_BASE = '/api';

// Upload files to backend
async function uploadFile({ file, logo, displayName, slug }) {
    const formData = new FormData();
    formData.append('file', file);
    if (logo) {
        formData.append('logo', logo);
    }
    if (displayName) {
        formData.append('manualName', displayName);
    }
    if (slug) {
        formData.append('manualSlug', slug);
    }

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

// Get all files from backend
async function getFiles() {
    try {
        const response = await fetch(`${API_BASE}/files`);
        if (!response.ok) {
            throw new Error(`Failed to fetch files: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching files:', error);
        return [];
    }
}

// Delete file from backend
async function deleteFileById(fileId) {
    try {
        const response = await fetch(`${API_BASE}/files/${fileId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error(`Delete failed: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Delete error:', error);
        throw error;
    }
}

// Replace file contents via backend
async function replaceFileById(fileId, { file, logo, displayName, slug }) {
    const formData = new FormData();

    if (file) {
        formData.append('file', file);
    }

    if (logo) {
        formData.append('logo', logo);
    }

    if (displayName) {
        formData.append('manualName', displayName);
    }

    if (slug) {
        formData.append('manualSlug', slug);
    }

    try {
        const response = await fetch(`${API_BASE}/files/${fileId}/replace`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Replace failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Replace error:', error);
        throw error;
    }
}

// Update file metadata
async function updateFileMetadata(fileId, updates) {
    try {
        const response = await fetch(`${API_BASE}/files/${fileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        if (!response.ok) {
            throw new Error(`Update failed: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Update error:', error);
        throw error;
    }
}

// Check if API is available
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        return response.ok;
    } catch (error) {
        console.log('API health check failed:', error.message);
        return false;
    }
}

