(function() {
    'use strict';

    const SESSION_TIMEOUT = 30 * 60 * 1000;
    let sessionTimeoutInterval = null;
    let analyticsRows = [];
    let modalElements = {};
    let modalResolve = null;

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return value
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('is-visible'));
        setTimeout(() => {
            toast.classList.remove('is-visible');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, 5000);
    }

    function initModalElements() {
        modalElements = {
            container: document.getElementById('modal-container'),
            backdrop: document.querySelector('#modal-container .modal-backdrop'),
            card: document.querySelector('#modal-container .modal-card'),
            title: document.getElementById('modal-title'),
            body: document.getElementById('modal-body'),
            actions: document.getElementById('modal-actions'),
            close: document.getElementById('modal-close')
        };

        if (!modalElements.container) {
            return;
        }

        modalElements.backdrop?.addEventListener('click', () => closeModal(null));
        modalElements.close?.addEventListener('click', () => closeModal(null));
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modalElements.container?.classList.contains('is-active')) {
                closeModal(null);
            }
        });
    }

    function openModal({ title = 'Notice', content = '', actions = [] }) {
        if (!modalElements.container) {
            return Promise.resolve(null);
        }

        modalElements.title.textContent = title;
        modalElements.body.innerHTML = typeof content === 'string' ? content : '';
        modalElements.actions.innerHTML = '';

        const resolvedActions = actions.length ? actions : [{ label: 'OK', value: true, variant: 'primary' }];

        return new Promise((resolve) => {
            modalResolve = resolve;

            resolvedActions.forEach((action) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `modal-button ${action.variant ? `modal-button-${action.variant}` : 'modal-button-primary'}`;
                button.textContent = action.label || 'OK';
                button.addEventListener('click', () => closeModal(action.value));
                modalElements.actions.appendChild(button);
            });

            modalElements.container.classList.add('is-active');
            modalElements.container.setAttribute('aria-hidden', 'false');
            modalElements.card?.focus?.();
        });
    }

    function closeModal(result) {
        if (!modalElements.container) {
            return;
        }

        modalElements.container.classList.remove('is-active');
        modalElements.container.setAttribute('aria-hidden', 'true');

        if (modalResolve) {
            const resolver = modalResolve;
            modalResolve = null;
            resolver(result);
        }
    }

    function showConfirmModal(message, options = {}) {
        const { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel', confirmVariant = 'primary' } = options;
        return openModal({
            title,
            content: `<p class="modal-message">${escapeHtml(message)}</p>`,
            actions: [
                { label: cancelText, value: false, variant: 'secondary' },
                { label: confirmText, value: true, variant: confirmVariant }
            ]
        });
    }

    function requireAuth() {
        const authTime = sessionStorage.getItem('adminAuthTime');
        const isAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';

        if (!isAuthenticated || !authTime) {
            window.location.href = 'admin.html';
            return false;
        }

        const timeElapsed = Date.now() - parseInt(authTime, 10);
        if (timeElapsed >= SESSION_TIMEOUT) {
            sessionStorage.removeItem('adminAuthenticated');
            sessionStorage.removeItem('adminAuthTime');
            window.location.href = 'admin.html';
            return false;
        }

        return true;
    }

    function startSessionTimeout() {
        if (sessionTimeoutInterval) {
            clearInterval(sessionTimeoutInterval);
        }

        sessionTimeoutInterval = setInterval(() => {
            const authTime = sessionStorage.getItem('adminAuthTime');
            if (!authTime) {
                return;
            }

            const timeElapsed = Date.now() - parseInt(authTime, 10);
            if (timeElapsed >= SESSION_TIMEOUT) {
                handleLogout();
            }
        }, 60000);
    }

    function handleLogout() {
        sessionStorage.removeItem('adminAuthenticated');
        sessionStorage.removeItem('adminAuthTime');
        document.cookie = 'okami_admin=; path=/; max-age=0; SameSite=Strict';
        if (sessionTimeoutInterval) {
            clearInterval(sessionTimeoutInterval);
            sessionTimeoutInterval = null;
        }
        window.location.href = 'admin.html';
    }

    function formatDateTime(value) {
        if (!value) {
            return '—';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }

        return date.toLocaleString();
    }

    function sortRows(rows, sortKey) {
        const sorted = rows.slice();

        if (sortKey === 'newest-viewed') {
            sorted.sort((a, b) => {
                const aTime = a.lastViewedAt ? new Date(a.lastViewedAt).getTime() : 0;
                const bTime = b.lastViewedAt ? new Date(b.lastViewedAt).getTime() : 0;
                return bTime - aTime;
            });
            return sorted;
        }

        if (sortKey === 'page-name') {
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            return sorted;
        }

        sorted.sort((a, b) => b.totalViews - a.totalViews || a.title.localeCompare(b.title));
        return sorted;
    }

    function renderAnalyticsTable(rows) {
        const tbody = document.getElementById('analytics-table-body');
        if (!tbody) {
            return;
        }

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7">No analytics data yet.</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map((row) => `
            <tr>
                <td>
                    <div class="analytics-page-cell">
                        <span class="analytics-page-title">${escapeHtml(row.title)}</span>
                        <span class="analytics-page-path">${escapeHtml(row.path)}</span>
                    </div>
                </td>
                <td>${row.viewsToday.toLocaleString()}</td>
                <td>${row.viewsThisMonth.toLocaleString()}</td>
                <td>${row.totalViews.toLocaleString()}</td>
                <td>${row.dailyAverage.toLocaleString()}</td>
                <td>${row.monthlyAverage.toLocaleString()}</td>
                <td>${escapeHtml(formatDateTime(row.lastViewedAt))}</td>
            </tr>
        `).join('');
    }

    function setAnalyticsStatus(message, isError = false) {
        const status = document.getElementById('analytics-status');
        if (!status) {
            return;
        }

        status.textContent = message;
        status.classList.toggle('is-error', Boolean(isError));
    }

    async function loadAnalytics() {
        setAnalyticsStatus('Loading analytics...');

        try {
            const apiAvailable = await checkAPIHealth();
            if (!apiAvailable) {
                throw new Error('Backend API is not available.');
            }

            const report = await getAnalyticsReport();
            analyticsRows = report.pages || [];
            const sortKey = document.getElementById('analytics-sort')?.value || 'most-viewed';
            renderAnalyticsTable(sortRows(analyticsRows, sortKey));

            const updatedAt = report.updatedAt ? formatDateTime(report.updatedAt) : 'Never';
            setAnalyticsStatus(`Last updated: ${updatedAt}`);
        } catch (error) {
            console.error('Analytics load failed:', error);
            renderAnalyticsTable([]);
            setAnalyticsStatus('Unable to load analytics. Start the server API to view page view data.', true);
        }
    }

    async function handleReset(scope, confirmMessage) {
        const confirmed = await showConfirmModal(confirmMessage, {
            title: 'Confirm Reset',
            confirmText: 'Reset',
            cancelText: 'Cancel',
            confirmVariant: 'danger'
        });

        if (!confirmed) {
            return;
        }

        try {
            const apiAvailable = await checkAPIHealth();
            if (!apiAvailable) {
                throw new Error('Backend API is not available.');
            }

            const result = await resetAnalytics(scope);
            analyticsRows = result.report?.pages || [];
            const sortKey = document.getElementById('analytics-sort')?.value || 'most-viewed';
            renderAnalyticsTable(sortRows(analyticsRows, sortKey));
            setAnalyticsStatus(`Analytics reset complete. Last updated: ${formatDateTime(result.report?.updatedAt)}`);
            showToast('Analytics reset successfully.', 'success');
        } catch (error) {
            console.error('Analytics reset failed:', error);
            showToast(error.message || 'Analytics reset failed.', 'info');
        }
    }

    function bindEvents() {
        document.getElementById('analytics-sort')?.addEventListener('change', (event) => {
            renderAnalyticsTable(sortRows(analyticsRows, event.target.value));
        });

        document.getElementById('analytics-reset-today')?.addEventListener('click', () => {
            handleReset('today', 'Reset today\'s view counts for all pages? Total and monthly counts will be adjusted accordingly.');
        });

        document.getElementById('analytics-reset-month')?.addEventListener('click', () => {
            handleReset('month', 'Reset this month\'s view counts for all pages? Total counts will be adjusted accordingly.');
        });

        document.getElementById('analytics-reset-all')?.addEventListener('click', () => {
            handleReset('all', 'Reset all analytics data? This cannot be undone.');
        });

        ['logout-btn', 'logout-btn-mobile'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', (event) => {
                event.preventDefault();
                handleLogout();
            });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!requireAuth()) {
            return;
        }

        initModalElements();
        bindEvents();
        startSessionTimeout();
        loadAnalytics();
    });
})();
