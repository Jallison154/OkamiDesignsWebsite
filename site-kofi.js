(function(global) {
    'use strict';

    const KOFI_URL = 'https://ko-fi.com/okamidesigns';
    const KOFI_LINK_REL = 'noopener noreferrer';

    function isAdminPage() {
        const path = (global.location?.pathname || '').toLowerCase();
        return path.includes('admin.html') || path.includes('admin-analytics.html');
    }

    function createKofiAnchor(className, text) {
        const link = document.createElement('a');
        link.href = KOFI_URL;
        link.target = '_blank';
        link.rel = KOFI_LINK_REL;
        link.className = className;
        link.textContent = text;
        return link;
    }

    function injectHeaderSupportLinks() {
        document.querySelectorAll('.nav .contact-btn, .nav-mobile .contact-btn').forEach((contactLink) => {
            const nav = contactLink.parentElement;
            if (!nav || nav.querySelector('.nav-support-link')) {
                return;
            }

            nav.insertBefore(createKofiAnchor('nav-link nav-support-link', '☕ Support'), contactLink);
        });
    }

    function injectSiteFooter() {
        if (document.querySelector('.okami-site-footer')) {
            return;
        }

        const footer = document.createElement('footer');
        footer.className = 'okami-site-footer';
        footer.setAttribute('aria-label', 'Site footer');
        footer.appendChild(createKofiAnchor('okami-site-footer-kofi-link', '☕ Support on Ko-fi'));

        const particles = document.getElementById('particles-js');
        if (particles?.parentNode) {
            particles.parentNode.insertBefore(footer, particles);
        } else {
            document.body.appendChild(footer);
        }
    }

    function init() {
        if (isAdminPage()) {
            return;
        }

        injectHeaderSupportLinks();
        injectSiteFooter();

        if (global.SiteVisibility?.refreshNavigationSettings) {
            global.SiteVisibility.refreshNavigationSettings(true).catch(() => {});
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.OkamiKofiSupport = {
        KOFI_URL,
        init
    };
})(typeof window !== 'undefined' ? window : globalThis);
