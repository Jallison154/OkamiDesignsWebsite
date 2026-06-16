(function(global) {
    'use strict';

    const PREFIX = '[Signal Lab Pop-Out]';

    const STATUS = {
        NOT_OPENED: 'not-opened',
        CONNECTING: 'connecting',
        CONNECTED: 'connected',
        FAILED: 'failed'
    };

    const STATUS_LABELS = {
        [STATUS.NOT_OPENED]: 'Not Opened',
        [STATUS.CONNECTING]: 'Connecting',
        [STATUS.CONNECTED]: 'Connected',
        [STATUS.FAILED]: 'Failed'
    };

    function log(event, detail) {
        if (detail !== undefined && detail !== null) {
            console.log(`${PREFIX} ${event}`, detail);
        } else {
            console.log(`${PREFIX} ${event}`);
        }
    }

    function setConnectionStatus(status, detail) {
        const label = STATUS_LABELS[status] || status;
        const el = typeof document !== 'undefined'
            ? document.getElementById('signal-lab-popout-connection')
            : null;

        if (el) {
            el.dataset.status = status;
            el.textContent = `Pop-out: ${label}`;
            if (detail) {
                el.title = String(detail);
            } else {
                el.removeAttribute('title');
            }
        }

        log('Connection Status', { status: label, detail: detail || null });
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.PopoutDebug = {
        STATUS,
        STATUS_LABELS,
        log,
        setConnectionStatus,
        logButtonClicked(detail) {
            log('Pop-Out Button Clicked', detail);
        },
        logWindowOpened(detail) {
            log('Pop-Out Window Opened', detail);
            setConnectionStatus(STATUS.CONNECTING, detail);
        },
        logReady(detail) {
            log('Pop-Out Ready', detail);
        },
        logStateSent(detail) {
            log('State Sent', detail);
        },
        logStateReceived(detail) {
            log('State Received', detail);
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
