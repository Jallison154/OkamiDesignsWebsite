(function(global) {
    'use strict';

    const UNSUPPORTED_MSG = 'Screen selection is not supported in this browser. Open the pop-out, drag it to the desired display, then click fullscreen.';

    const STATUS = {
        SUPPORTED: 'supported',
        PERMISSION_DENIED: 'permission_denied',
        NOT_SUPPORTED: 'not_supported',
        NOT_SECURE: 'not_secure'
    };

    const STATUS_MESSAGE = {
        supported: 'Screen selection supported',
        permission_denied: 'Permission denied',
        not_supported: 'Screen selection not supported',
        not_secure: 'Screen selection not supported'
    };

    function isApiAvailable() {
        return typeof window.getScreenDetails === 'function';
    }

    function isSecureContext() {
        if (typeof window.isSecureContext === 'boolean') {
            return window.isSecureContext;
        }
        const { protocol, hostname } = window.location;
        return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
    }

    function mapScreens(details) {
        return (details.screens || []).map((screen, index) => ({
            id: `screen-${index}`,
            label: screen.label
                || `Display ${index + 1} (${screen.availWidth}×${screen.availHeight})`,
            availLeft: screen.availLeft,
            availTop: screen.availTop,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            isPrimary: details.currentScreen === screen
        }));
    }

    /**
     * Must be called from a direct user click — requests permission when needed.
     */
    async function requestScreenDetails() {
        if (!isSecureContext()) {
            return {
                status: STATUS.NOT_SECURE,
                screens: [],
                statusMessage: STATUS_MESSAGE.not_secure,
                helperText: 'Screen selection requires HTTPS or localhost.'
            };
        }

        if (!isApiAvailable()) {
            return {
                status: STATUS.NOT_SUPPORTED,
                screens: [],
                statusMessage: STATUS_MESSAGE.not_supported,
                helperText: UNSUPPORTED_MSG
            };
        }

        try {
            const details = await window.getScreenDetails();
            const screens = mapScreens(details);

            return {
                status: STATUS.SUPPORTED,
                screens,
                statusMessage: STATUS_MESSAGE.supported,
                helperText: screens.length > 1
                    ? 'Choose a display, then click Open on Screen again.'
                    : 'Pop-out will open on the detected display.'
            };
        } catch (error) {
            if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
                return {
                    status: STATUS.PERMISSION_DENIED,
                    screens: [],
                    statusMessage: STATUS_MESSAGE.permission_denied,
                    helperText: 'Display permission was denied. Allow access in the browser prompt and try again.'
                };
            }

            return {
                status: STATUS.NOT_SUPPORTED,
                screens: [],
                statusMessage: STATUS_MESSAGE.not_supported,
                helperText: UNSUPPORTED_MSG,
                error: error?.message || String(error)
            };
        }
    }

    function getPopupFeatures(screen) {
        const left = Math.round(screen?.availLeft ?? 0);
        const top = Math.round(screen?.availTop ?? 0);
        const width = Math.round(screen?.availWidth ?? 960);
        const height = Math.round(screen?.availHeight ?? 540);
        return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
    }

    /** @deprecated Use requestScreenDetails() from a click handler instead. */
    function isScreenSelectionSupported() {
        return isApiAvailable() && isSecureContext();
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.ScreenPlacement = {
        STATUS,
        STATUS_MESSAGE,
        UNSUPPORTED_MSG,
        isApiAvailable,
        isSecureContext,
        isScreenSelectionSupported,
        requestScreenDetails,
        getPopupFeatures
    };
})(typeof window !== 'undefined' ? window : globalThis);
