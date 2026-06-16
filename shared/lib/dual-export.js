/**
 * Attach a module API to Node (module.exports) and the browser (OkamiShared namespace).
 */
function dualExport(namespace, key, api) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    const root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
    root.OkamiShared = root.OkamiShared || {};
    if (namespace) {
        root.OkamiShared[namespace] = api;
    } else if (key) {
        root.OkamiShared[key] = api;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { dualExport };
}
