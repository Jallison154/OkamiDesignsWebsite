(function(global) {
    'use strict';

    let initialized = false;
    let headerResizeObserver = null;

    function findSiteHeader() {
        return document.querySelector('header.header')
            || document.querySelector('header')
            || document.querySelector('.site-header')
            || document.querySelector('.navbar')
            || document.querySelector('nav.navbar');
    }

    function updateOkamiHeaderHeight() {
        const header = findSiteHeader();
        const height = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
        document.documentElement.style.setProperty('--okami-header-height', `${height}px`);
        return height;
    }

    function refreshLayout() {
        updateOkamiHeaderHeight();
        requestAnimationFrame(() => {
            global.dispatchEvent(new Event('resize'));
        });
    }

    function bindHeaderObserver() {
        const header = findSiteHeader();
        if (!header || typeof ResizeObserver === 'undefined' || headerResizeObserver) {
            return;
        }

        headerResizeObserver = new ResizeObserver(() => {
            refreshLayout();
        });
        headerResizeObserver.observe(header);
    }

    function initOkamiSiteLayout() {
        updateOkamiHeaderHeight();

        if (initialized) {
            return;
        }

        initialized = true;

        global.addEventListener('resize', updateOkamiHeaderHeight);
        global.addEventListener('orientationchange', () => {
            requestAnimationFrame(updateOkamiHeaderHeight);
        });

        if (global.document?.fonts?.ready) {
            global.document.fonts.ready.then(updateOkamiHeaderHeight).catch(() => {});
        }

        bindHeaderObserver();
    }

    global.OkamiSiteLayout = {
        findSiteHeader,
        updateOkamiHeaderHeight,
        refreshLayout,
        init: initOkamiSiteLayout
    };

    if (global.document?.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initOkamiSiteLayout);
    } else {
        initOkamiSiteLayout();
    }
})(typeof window !== 'undefined' ? window : globalThis);
