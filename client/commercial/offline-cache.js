(function(global) {
    'use strict';

    const STORAGE_PREFIX = 'okami_commercial_';
    const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

    function storageKey(productId, type) {
        return `${STORAGE_PREFIX}${type}_${productId || 'default'}`;
    }

    function canUseStorage() {
        try {
            const probe = `${STORAGE_PREFIX}probe`;
            global.localStorage.setItem(probe, '1');
            global.localStorage.removeItem(probe);
            return true;
        } catch {
            return false;
        }
    }

    function saveRecord(productId, type, data, ttlMs = DEFAULT_TTL_MS) {
        if (!canUseStorage() || !data) {
            return false;
        }

        const record = {
            savedAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
            data
        };

        try {
            global.localStorage.setItem(storageKey(productId, type), JSON.stringify(record));
            return true;
        } catch (error) {
            console.warn('Commercial offline cache save failed:', error.message || error);
            return false;
        }
    }

    function loadRecord(productId, type) {
        if (!canUseStorage()) {
            return null;
        }

        try {
            const raw = global.localStorage.getItem(storageKey(productId, type));
            if (!raw) {
                return null;
            }

            const record = JSON.parse(raw);
            if (!record?.data || Date.now() > record.expiresAt) {
                global.localStorage.removeItem(storageKey(productId, type));
                return null;
            }

            return record.data;
        } catch {
            return null;
        }
    }

    function clearRecord(productId, type) {
        if (!canUseStorage()) {
            return;
        }
        global.localStorage.removeItem(storageKey(productId, type));
    }

    function clearAll() {
        if (!canUseStorage()) {
            return;
        }

        Object.keys(global.localStorage).forEach((key) => {
            if (key.startsWith(STORAGE_PREFIX)) {
                global.localStorage.removeItem(key);
            }
        });
    }

    function saveEntitlements(productId, entitlements, ttlMs) {
        return saveRecord(productId, 'entitlements', entitlements, ttlMs);
    }

    function loadEntitlements(productId) {
        return loadRecord(productId, 'entitlements');
    }

    function saveConfig(config, ttlMs) {
        return saveRecord('__global__', 'config', config, ttlMs);
    }

    function loadConfig() {
        return loadRecord('__global__', 'config');
    }

    function isDesktopOfflinePreferred() {
        return Boolean(global.OkamiDesktopShell?.isDesktopShell?.());
    }

    global.OkamiCommercialOfflineCache = {
        DEFAULT_TTL_MS,
        saveEntitlements,
        loadEntitlements,
        saveConfig,
        loadConfig,
        clearAll,
        clearEntitlements(productId) {
            clearRecord(productId, 'entitlements');
        },
        isDesktopOfflinePreferred
    };
})(typeof window !== 'undefined' ? window : globalThis);
