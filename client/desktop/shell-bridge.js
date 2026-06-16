(function(global) {
    'use strict';

    function getBridge() {
        return global.okamiDesktop || global.OkamiDesktop || null;
    }

    function isDesktopShell() {
        const bridge = getBridge();
        if (typeof bridge?.isDesktop === 'function') {
            return Boolean(bridge.isDesktop());
        }
        if (typeof bridge?.platform === 'string') {
            return bridge.platform === 'desktop';
        }
        return new URLSearchParams(global.location?.search || '').has('desktop');
    }

    function getShellVersion() {
        const bridge = getBridge();
        if (typeof bridge?.getVersion === 'function') {
            return bridge.getVersion();
        }
        return bridge?.version || null;
    }

    function getShellProductId() {
        const bridge = getBridge();
        return bridge?.productId || bridge?.product || null;
    }

    async function checkForUpdates() {
        const client = global.OkamiCommercialClient;
        if (!client?.checkVersion) {
            return null;
        }
        return client.checkVersion('desktop', getShellVersion());
    }

    async function initDesktopShell(options = {}) {
        if (!isDesktopShell()) {
            return { desktop: false };
        }

        const productId = options.productId || getShellProductId();
        if (productId && global.OkamiCommercialGate?.initForProduct) {
            await global.OkamiCommercialGate.initForProduct(productId);
        }

        if (options.checkUpdates) {
            try {
                return {
                    desktop: true,
                    version: getShellVersion(),
                    updates: await checkForUpdates()
                };
            } catch (error) {
                return {
                    desktop: true,
                    version: getShellVersion(),
                    updates: null,
                    error: error.message || String(error)
                };
            }
        }

        return { desktop: true, version: getShellVersion() };
    }

    global.OkamiDesktopShell = {
        isDesktopShell,
        getShellVersion,
        getShellProductId,
        checkForUpdates,
        initDesktopShell
    };
})(typeof window !== 'undefined' ? window : globalThis);
