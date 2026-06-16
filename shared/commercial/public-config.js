(function(global) {
    'use strict';

    /** Public product metadata — safe to expose to browsers and desktop shells. */
    const PRODUCTS = {
        'okami-signal-lab': {
            id: 'okami-signal-lab',
            name: 'Okami Signal Lab',
            webPath: '/tools/signal-lab.html',
            desktopSku: 'okami-signal-lab-desktop',
            tier: 'professional'
        },
        'okami-led-wall-calculator': {
            id: 'okami-led-wall-calculator',
            name: 'LED Video Wall Calculator',
            webPath: '/tools/led-wall-visualizer.html',
            desktopSku: 'okami-led-wall-calculator-desktop',
            tier: 'standard'
        }
    };

    const LEGAL_LINKS = {
        termsOfService: '/legal/terms.html',
        privacyPolicy: '/legal/privacy.html',
        disclaimer: '/legal/disclaimer.html',
        commercialLicense: '/legal/commercial-license.html',
        support: '/support.html',
        contact: '/contact.html'
    };

    const api = {
        PRODUCTS,
        LEGAL_LINKS,
        companyName: 'Okami Designs',
        supportEmail: 'support@okamidesigns.com'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    global.OkamiShared = global.OkamiShared || {};
    global.OkamiShared.CommercialPublic = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {});
