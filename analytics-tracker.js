(function() {
    'use strict';

    const DEBOUNCE_MS = 5000;
    const STORAGE_KEY = 'okami-analytics-last-view';

    let adminSessionActive = false;

    async function refreshAdminSessionState() {
        try {
            const response = await fetch('/api/admin/session', {
                credentials: 'include',
                cache: 'no-store'
            });
            if (!response.ok) {
                adminSessionActive = false;
                return false;
            }
            const data = await response.json();
            adminSessionActive = data.authenticated === true;
            return adminSessionActive;
        } catch {
            adminSessionActive = false;
            return false;
        }
    }

    function isAdminSession() {
        return adminSessionActive;
    }

    function getPageMeta(pathname) {
        if (window.OkamiPageRegistry) {
            const page = window.OkamiPageRegistry.resolvePage(pathname);
            if (page) {
                return {
                    path: page.analyticsPath,
                    title: page.title
                };
            }

            if (window.OkamiPageRegistry.shouldTrackAnalytics(pathname)) {
                return {
                    path: window.OkamiPageRegistry.normalizeAnalyticsPath(pathname),
                    title: document.title || 'Untitled Page'
                };
            }

            return null;
        }

        return {
            path: pathname || '/',
            title: document.title || 'Untitled Page'
        };
    }

    function shouldSkipDuplicate(path) {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return false;
            }

            const last = JSON.parse(raw);
            if (last.path !== path) {
                return false;
            }

            return Date.now() - last.timestamp < DEBOUNCE_MS;
        } catch {
            return false;
        }
    }

    function rememberView(path) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
            path,
            timestamp: Date.now()
        }));
    }

    async function trackPageView(url) {
        if (isAdminSession()) {
            return;
        }

        let pathname;
        try {
            const parsed = url ? new URL(url, window.location.origin) : window.location;
            pathname = parsed.pathname;
        } catch {
            pathname = window.location.pathname;
        }

        if (window.OkamiPageRegistry && !window.OkamiPageRegistry.shouldTrackAnalytics(pathname)) {
            return;
        }

        const meta = getPageMeta(pathname);
        if (!meta || !meta.path) {
            return;
        }

        if (shouldSkipDuplicate(meta.path)) {
            return;
        }

        rememberView(meta.path);

        try {
            const response = await fetch('/api/analytics/view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: meta.path,
                    title: meta.title
                }),
                keepalive: true
            });

            if (!response.ok) {
                console.warn('Analytics view not recorded:', response.status);
            }
        } catch (error) {
            console.warn('Analytics tracker unavailable:', error.message || error);
        }
    }

    async function trackToolUsage(toolId, action, label) {
        if (isAdminSession()) {
            return;
        }

        const path = `/tools/${toolId}/usage/${action}`;
        const title = label || `${toolId}: ${action}`;

        try {
            const response = await fetch('/api/analytics/view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, title }),
                keepalive: true
            });

            if (!response.ok) {
                console.warn('Tool usage not recorded:', response.status);
            }
        } catch (error) {
            console.warn('Analytics tracker unavailable:', error.message || error);
        }
    }

    window.OkamiAnalytics = {
        trackPageView,
        trackToolUsage
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            await refreshAdminSessionState();
            trackPageView();
        });
    } else {
        refreshAdminSessionState().then(() => trackPageView());
    }
})();
