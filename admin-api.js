// Admin API client - Replaces IndexedDB with backend API
const API_BASE = '/api';
const API_TIMEOUT_MS = 8000;

function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
}

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
            credentials: 'same-origin',
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
            method: 'DELETE',
            credentials: 'same-origin'
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
            credentials: 'same-origin',
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
            credentials: 'same-origin',
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

// Site visibility settings — server is the source of truth
async function getSiteSettings() {
    const response = await fetchWithTimeout(`${API_BASE}/site-settings`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to fetch site settings (${response.status})`);
    }
    return await response.json();
}

async function saveSiteSettings(settings) {
    const response = await fetchWithTimeout(`${API_BASE}/site-settings`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const error = new Error(body.error || `Failed to save site settings (${response.status})`);
        error.status = response.status;
        error.code = body.error || null;
        throw error;
    }

    return await response.json();
}

async function getManagedTools() {
    const response = await fetchWithTimeout(`${API_BASE}/tools/manage`, {
        credentials: 'same-origin',
        cache: 'no-store'
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to fetch tools (${response.status})`);
    }
    return await response.json();
}

async function saveManagedTools(catalog) {
    const response = await fetchWithTimeout(`${API_BASE}/tools`, {
        method: 'PUT',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(catalog)
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = Array.isArray(body.messages) && body.messages.length
            ? body.messages.join(' ')
            : (body.error || `Failed to save tools (${response.status})`);
        throw new Error(message);
    }

    return await response.json();
}

async function uploadToolIcon(file) {
    const formData = new FormData();
    formData.append('icon', file);

    const response = await fetch(`${API_BASE}/tools/upload-icon`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Icon upload failed (${response.status})`);
    }

    return await response.json();
}

async function refreshToolWebsiteLogo(toolId) {
    const response = await fetchWithTimeout(`${API_BASE}/tools/${encodeURIComponent(toolId)}/refresh-logo`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store'
    }, 20000);

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(body.message || body.error || `Logo refresh failed (${response.status})`);
        error.status = response.status;
        error.tool = body.tool || null;
        error.tools = body.tools || null;
        throw error;
    }
    return body;
}

async function getAnalyticsReport() {
    try {
        const response = await fetch(`${API_BASE}/analytics`, {
            cache: 'no-store',
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch analytics: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching analytics:', error);
        throw error;
    }
}

async function resetAnalytics(scope) {
    try {
        const response = await fetch(`${API_BASE}/analytics/reset`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ scope })
        });

        if (!response.ok) {
            throw new Error(`Failed to reset analytics: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error resetting analytics:', error);
        throw error;
    }
}

// Probe the same endpoint the public site uses
async function checkSiteSettingsApi() {
    try {
        const response = await fetchWithTimeout(`${API_BASE}/site-settings`, { cache: 'no-store' }, 5000);
        return response.ok;
    } catch (error) {
        console.warn('Site settings API probe failed:', error.message || error);
        return false;
    }
}

/** @deprecated Use checkSiteSettingsApi — kept for callers that still reference it */
async function checkAPIHealth() {
    try {
        const response = await fetchWithTimeout(`${API_BASE}/health`, { cache: 'no-store' }, 5000);
        return response.ok;
    } catch (error) {
        console.warn('API health check failed:', error.message || error);
        return false;
    }
}

async function checkAdminSession() {
    try {
        const response = await fetch(`${API_BASE}/admin/session`, {
            credentials: 'same-origin',
            cache: 'no-store'
        });
        if (!response.ok) {
            return { authenticated: false };
        }
        return await response.json();
    } catch (error) {
        console.warn('Admin session check failed:', error.message || error);
        return { authenticated: false };
    }
}

async function getAdminSetupStatus() {
    try {
        const response = await fetch(`${API_BASE}/admin/setup-status`, {
            cache: 'no-store'
        });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
}

async function adminLogin(password) {
    const response = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        let message = 'Login failed. Please try again.';
        if (body.error === 'invalid_credentials') {
            message = 'Incorrect password. Please try again.';
        } else if (body.error === 'admin_auth_not_configured') {
            const missing = Array.isArray(body.missing) && body.missing.length
                ? body.missing.join(', ')
                : 'ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET';
            const envHint = body.envFileExists === false
                ? ' No .env file found on the server.'
                : '';
            message = `Admin login is not configured on the server. Missing: ${missing}.${envHint} See docs/ADMIN-LOGIN-SETUP.md`;
        }
        throw new Error(message);
    }

    return body;
}

async function adminLogout() {
    await fetch(`${API_BASE}/admin/logout`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store'
    });
}
