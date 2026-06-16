(function(global) {
    'use strict';

    const WEB_APP_VERSION = '1.0.0';
    const DESKTOP_APP_VERSION = '0.0.0-placeholder';

    const RELEASE_CHANNELS = {
        web: 'web',
        desktop: 'desktop'
    };

    const api = {
        WEB_APP_VERSION,
        DESKTOP_APP_VERSION,
        RELEASE_CHANNELS,
        updateCheckPath: '/api/commercial/version'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.ProductVersion = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
