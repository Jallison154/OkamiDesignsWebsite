(function() {
    'use strict';

    const SYNC_CHANNEL = 'okami-signal-lab-sync';
    let engine = null;
    let outputState = null;
    let requestFullscreenPending = false;
    let popoutTracker = null;

    function getTracker() {
        if (!popoutTracker && window.OkamiSignalLab?.OutputState) {
            popoutTracker = window.OkamiSignalLab.OutputState.createApplyTracker();
        }
        return popoutTracker;
    }

    function showWaiting(show) {
        const el = document.getElementById('output-waiting');
        if (el) {
            el.classList.toggle('is-visible', show);
        }
    }

    function refreshOutput() {
        if (!engine || !outputState) {
            return;
        }

        engine.renderFrame(performance.now());

        if (window.OkamiSignalLab.shouldAnimateOutput(outputState)) {
            engine.start();
        } else {
            engine.stop();
        }
    }

    function applyReceivedState(state) {
        if (!state?.activeModuleId || !engine || !window.OkamiSignalLab?.renderSignalLabCanvas) {
            showWaiting(true);
            return;
        }

        outputState = state;
        showWaiting(false);

        window.OkamiSignalLab.renderSignalLabCanvas(
            engine,
            outputState,
            performance.now(),
            getTracker()
        );

        if (outputState.requestFullscreen) {
            requestFullscreenPending = true;
            showFullscreenPrompt(true);
        }

        refreshOutput();
    }

    function showFullscreenPrompt(visible) {
        const prompt = document.getElementById('output-fullscreen-prompt');
        if (prompt) {
            prompt.classList.toggle('is-visible', visible);
        }
    }

    function tryEnterFullscreen() {
        const stage = document.getElementById('output-stage');
        if (!stage || document.fullscreenElement) {
            showFullscreenPrompt(false);
            requestFullscreenPending = false;
            return;
        }

        stage.requestFullscreen?.().then(() => {
            showFullscreenPrompt(false);
            requestFullscreenPending = false;
        }).catch(() => {
            showFullscreenPrompt(true);
        });
    }

    function notifyClosed() {
        const MSG = window.OkamiSignalLab?.OutputState?.MSG;
        const closedMsg = { type: MSG?.CLOSED || 'popout-closed' };
        try {
            window.opener?.postMessage(closedMsg, window.location.origin);
        } catch {
            /* ignore */
        }
        try {
            new BroadcastChannel(SYNC_CHANNEL).postMessage(closedMsg);
        } catch {
            /* ignore */
        }
    }

    function bindOutputInteractions() {
        const stage = document.getElementById('output-stage');
        const prompt = document.getElementById('output-fullscreen-prompt');
        const canvas = document.getElementById('output-canvas');

        stage?.addEventListener('dblclick', () => {
            notifyClosed();
            window.close();
        });

        window.addEventListener('beforeunload', notifyClosed);

        prompt?.addEventListener('click', tryEnterFullscreen);
        canvas?.addEventListener('click', () => {
            if (requestFullscreenPending || prompt?.classList.contains('is-visible')) {
                tryEnterFullscreen();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen?.();
            }
        });

        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                showFullscreenPrompt(false);
                requestFullscreenPending = false;
            }
        });
    }

    function bindStateSync() {
        const MSG = window.OkamiSignalLab?.OutputState?.MSG;

        const handlePayload = (data) => {
            if (!data) {
                return;
            }
            if (data.type === MSG?.STATE && data.state) {
                applyReceivedState(data.state);
            }
        };

        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) {
                return;
            }
            handlePayload(event.data);
        });

        const channel = new BroadcastChannel(SYNC_CHANNEL);
        channel.onmessage = (event) => {
            handlePayload(event.data);
        };
    }

    function notifyReady() {
        const MSG = window.OkamiSignalLab?.OutputState?.MSG;
        const readyMsg = { type: MSG?.READY || 'popout-ready' };

        if (window.opener) {
            try {
                window.opener.postMessage(readyMsg, window.location.origin);
            } catch {
                /* ignore */
            }
        }

        try {
            new BroadcastChannel(SYNC_CHANNEL).postMessage(readyMsg);
        } catch {
            /* ignore */
        }
    }

    function initOutput() {
        const canvas = document.getElementById('output-canvas');
        if (!canvas || !window.OkamiSignalLab?.RenderEngine) {
            return;
        }

        showWaiting(true);

        engine = new window.OkamiSignalLab.RenderEngine(canvas, {
            container: document.getElementById('output-canvas-wrap') || canvas.parentElement,
            backgroundColor: '#000000'
        });

        bindOutputInteractions();
        bindStateSync();

        const params = new URLSearchParams(window.location.search);
        if (params.get('fullscreen') === '1') {
            requestFullscreenPending = true;
            showFullscreenPrompt(true);
        }

        notifyReady();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOutput);
    } else {
        initOutput();
    }
})();
