(function(global) {
    'use strict';

    /** Off until legal pages + API are production-ready. Tools must not be affected. */
    const COMMERCIAL_UI_AUTO_INIT = false;

    function resolveLegalLinks(config) {
        const legal = config?.legal
            || global.OkamiShared?.CommercialPublic?.LEGAL_LINKS
            || {};

        const prefix = global.location?.pathname?.includes('/tools/') ? '..' : '';

        return {
            terms: `${prefix}${legal.termsOfService || '/legal/terms.html'}`,
            privacy: `${prefix}${legal.privacyPolicy || '/legal/privacy.html'}`,
            disclaimer: `${prefix}${legal.disclaimer || '/legal/disclaimer.html'}`,
            license: `${prefix}${legal.commercialLicense || '/legal/commercial-license.html'}`,
            support: `${prefix}${legal.support || '/support.html'}`
        };
    }

    function injectCommercialFooter(config) {
        if (document.querySelector('[data-okami-commercial-footer]')) {
            return;
        }

        if (document.querySelector('main.full-height-tool')) {
            return;
        }

        const links = resolveLegalLinks(config);
        const footer = document.createElement('footer');
        footer.className = 'okami-commercial-footer';
        footer.setAttribute('data-okami-commercial-footer', 'true');
        footer.innerHTML = `
            <nav class="okami-commercial-footer-nav" aria-label="Legal and licensing">
                <a href="${links.terms}">Terms</a>
                <a href="${links.privacy}">Privacy</a>
                <a href="${links.disclaimer}">Disclaimer</a>
                <a href="${links.license}">Commercial License</a>
                <a href="${links.support}">Support</a>
            </nav>
            <p class="okami-commercial-footer-note">Okami tools are provided for professional AV use. Premium features require a valid license.</p>
        `;

        const main = document.querySelector('main.main, main.tools-hub-main');
        if (main) {
            main.appendChild(footer);
        } else {
            document.body.appendChild(footer);
        }
    }

    function renderUpgradePlaceholder(container, productId) {
        if (!global.OkamiCommercialClient?.COMMERCIAL_ENABLED) {
            return;
        }

        if (!container || container.querySelector('[data-okami-upgrade-placeholder]')) {
            return;
        }

        const block = document.createElement('div');
        block.className = 'okami-upgrade-placeholder';
        block.setAttribute('data-okami-upgrade-placeholder', 'true');
        block.innerHTML = `
            <p class="okami-upgrade-placeholder-title">Premium feature</p>
            <p class="okami-upgrade-placeholder-text">This capability will unlock with a commercial license for <strong>${productId || 'Okami tools'}</strong>.</p>
            <a class="okami-upgrade-placeholder-link" href="${resolveLegalLinks().license}">View licensing options</a>
        `;
        container.appendChild(block);
    }

    async function initCommercialUi(options = {}) {
        if (!global.OkamiCommercialClient?.COMMERCIAL_ENABLED && options.force !== true) {
            return null;
        }

        const client = global.OkamiCommercialClient;
        if (!client) {
            return null;
        }

        let config = null;
        try {
            config = await client.fetchConfig();
        } catch (error) {
            console.warn('Commercial config unavailable:', error.message || error);
        }

        if (options.footer !== false) {
            injectCommercialFooter(config);
        }

        if (options.productId && client.fetchEntitlements) {
            try {
                const entitlements = await client.fetchEntitlements(options.productId);
                global.OkamiCommercialEntitlements = entitlements;
            } catch (error) {
                console.warn('Commercial entitlements unavailable:', error.message || error);
            }
        }

        return config;
    }

    global.OkamiCommercialUi = {
        COMMERCIAL_UI_AUTO_INIT,
        initCommercialUi,
        injectCommercialFooter,
        renderUpgradePlaceholder,
        resolveLegalLinks
    };

    if (COMMERCIAL_UI_AUTO_INIT) {
        const run = () => {
            initCommercialUi({
                productId: document.body.classList.contains('signal-lab-page')
                    ? 'okami-signal-lab'
                    : document.body.classList.contains('led-calculator-page')
                        ? 'okami-led-wall-calculator'
                        : null
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
