(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';
    const FLASH_MS = 100;

    const MODE_CATALOG = [
        { id: 'flash-click', label: 'Flash + Click' },
        { id: 'sync-ball', label: 'Sync Ball' },
        { id: 'frame-counter', label: 'Frame Counter' },
        { id: 'timecode', label: 'Running Timecode' }
    ];

    let syncAudio = null;
    const runtime = {
        sessionStart: 0,
        lastEventTime: 0,
        nextEventTime: 0,
        eventCount: 0,
        frameCount: 0,
        flashUntil: 0,
        firedCenterThisCycle: false,
        cycleAnchor: 0
    };

    function getSyncAudio() {
        if (!syncAudio) {
            syncAudio = new global.OkamiSignalLab.SyncAudio();
        }
        return syncAudio;
    }

    function resetRuntime() {
        runtime.sessionStart = 0;
        runtime.lastEventTime = 0;
        runtime.nextEventTime = 0;
        runtime.eventCount = 0;
        runtime.frameCount = 0;
        runtime.flashUntil = 0;
        runtime.firedCenterThisCycle = false;
        runtime.cycleAnchor = 0;
    }

    function getSyncRuntimeSnapshot() {
        const now = performance.now();
        return {
            sessionAge: runtime.sessionStart ? now - runtime.sessionStart : 0,
            nextEventIn: runtime.nextEventTime ? Math.max(0, runtime.nextEventTime - now) : 0,
            eventCount: runtime.eventCount,
            frameCount: runtime.frameCount,
            flashRemaining: runtime.flashUntil ? Math.max(0, runtime.flashUntil - now) : 0,
            firedCenterThisCycle: runtime.firedCenterThisCycle,
            cycleAnchorAge: runtime.cycleAnchor ? now - runtime.cycleAnchor : 0
        };
    }

    function restoreSyncRuntimeSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        const now = performance.now();
        runtime.sessionStart = snapshot.sessionAge ? now - snapshot.sessionAge : 0;
        runtime.nextEventTime = snapshot.nextEventIn ? now + snapshot.nextEventIn : 0;
        runtime.lastEventTime = runtime.sessionStart;
        runtime.eventCount = snapshot.eventCount || 0;
        runtime.frameCount = snapshot.frameCount || 0;
        runtime.flashUntil = snapshot.flashRemaining ? now + snapshot.flashRemaining : 0;
        runtime.firedCenterThisCycle = Boolean(snapshot.firedCenterThisCycle);
        runtime.cycleAnchor = snapshot.cycleAnchorAge ? now - snapshot.cycleAnchorAge : 0;
    }

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function pad3(n) {
        return String(n).padStart(3, '0');
    }

    function formatTimecode(ms) {
        const total = Math.max(0, Math.floor(ms));
        const hours = Math.floor(total / 3600000);
        const minutes = Math.floor((total % 3600000) / 60000);
        const seconds = Math.floor((total % 60000) / 1000);
        const millis = total % 1000;
        return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
    }

    function fireEvent(now, state) {
        runtime.lastEventTime = now;
        runtime.eventCount += 1;
        runtime.frameCount += 1;

        if (state.flashEnabled !== false) {
            runtime.flashUntil = now + FLASH_MS;
        }

        if (state.clickEnabled !== false) {
            getSyncAudio().playClick(Number(state.clickVolume) ?? 0.6);
        }
    }

    function updateSyncRuntime(now, state) {
        if (!state.active) {
            return;
        }

        const interval = Math.max(100, Number(state.intervalMs) || 1000);

        if (runtime.sessionStart === 0) {
            runtime.sessionStart = now;
            runtime.cycleAnchor = now;
            runtime.lastEventTime = now;

            if (state.mode !== 'sync-ball') {
                fireEvent(now, state);
                runtime.nextEventTime = now + interval;
            } else {
                runtime.nextEventTime = now + interval;
            }
        }

        if (state.mode === 'sync-ball') {
            const elapsed = now - runtime.cycleAnchor;
            if (elapsed >= interval) {
                runtime.cycleAnchor += interval * Math.floor(elapsed / interval);
            }

            const progress = (now - runtime.cycleAnchor) / interval;
            if (progress >= 0.5 && !runtime.firedCenterThisCycle) {
                fireEvent(now, state);
                runtime.firedCenterThisCycle = true;
            }
            if (progress < 0.05) {
                runtime.firedCenterThisCycle = false;
            }
        } else {
            while (now >= runtime.nextEventTime) {
                fireEvent(runtime.nextEventTime, state);
                runtime.nextEventTime += interval;
            }
        }
    }

    function drawFlashOverlay(ctx, w, h, now, state) {
        if (state.flashEnabled === false || now >= runtime.flashUntil) {
            return;
        }

        const remaining = runtime.flashUntil - now;
        const alpha = Math.min(1, remaining / FLASH_MS);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + alpha * 0.45})`;
        ctx.fillRect(0, 0, w, h);
    }

    function drawCenterMarker(ctx, w, h) {
        const cx = w / 2;
        const cy = h / 2;
        const size = Math.min(w, h) * 0.04;

        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = Math.max(2, Math.min(w, h) / 200);
        ctx.beginPath();
        ctx.moveTo(cx - size, cy);
        ctx.lineTo(cx + size, cy);
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx, cy + size);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 106, 45, 0.35)';
        ctx.beginPath();
        ctx.arc(cx, cy, size * 1.2, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawTimingHud(ctx, w, h, now, state) {
        const elapsed = state.active ? now - runtime.sessionStart : 0;
        const sinceEvent = state.active && runtime.lastEventTime
            ? now - runtime.lastEventTime
            : 0;

        const lines = [
            `Elapsed: ${Math.floor(elapsed)} ms`,
            `Since event: ${Math.floor(sinceEvent)} ms`,
            `Events: ${runtime.eventCount}`,
            `Interval: ${Math.floor(Number(state.intervalMs) || 1000)} ms`
        ];

        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(12, 12, Math.min(w * 0.42, 240), lines.length * 22 + 16);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `600 ${Math.max(11, Math.min(w, h) * 0.022)}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
            ctx.fillText(line, 22, 20 + i * 22);
        });
    }

    function drawFlashClick(ctx, w, h, now, state) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        drawCenterMarker(ctx, w, h);

        ctx.fillStyle = ACCENT;
        ctx.font = `800 ${Math.max(14, Math.min(w, h) * 0.035)}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FLASH + CLICK', w / 2, h * 0.12);

        if (!state.active) {
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.font = `500 ${Math.max(12, Math.min(w, h) * 0.025)}px Montserrat, sans-serif`;
            ctx.fillText('Press Start to begin sync test', w / 2, h * 0.5);
        }

        drawTimingHud(ctx, w, h, now, state);
        drawFlashOverlay(ctx, w, h, now, state);
    }

    function drawSyncBall(ctx, w, h, now, state) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);

        const margin = Math.min(w, h) * 0.1;
        const y = h / 2;
        let ballX = w / 2;

        if (state.active && runtime.sessionStart > 0) {
            const interval = Math.max(100, Number(state.intervalMs) || 1000);
            const progress = ((now - runtime.cycleAnchor) % interval) / interval;
            ballX = margin + (w - margin * 2) * progress;
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(w - margin, y);
        ctx.stroke();

        drawCenterMarker(ctx, w, h);

        const radius = Math.max(10, Math.min(w, h) * 0.035);
        ctx.beginPath();
        ctx.arc(ballX, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = ACCENT;
        ctx.font = `800 ${Math.max(14, Math.min(w, h) * 0.035)}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('SYNC BALL', w / 2, h * 0.12);

        drawTimingHud(ctx, w, h, now, state);
        drawFlashOverlay(ctx, w, h, now, state);
    }

    function drawFrameCounter(ctx, w, h, now, state) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        drawCenterMarker(ctx, w, h);

        const frameNum = state.active ? runtime.frameCount : 0;

        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${Math.max(48, Math.min(w, h) * 0.18)}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(frameNum).padStart(4, '0'), w / 2, h * 0.45);

        ctx.fillStyle = ACCENT;
        ctx.font = `700 ${Math.max(12, Math.min(w, h) * 0.028)}px Montserrat, sans-serif`;
        ctx.fillText('FRAME', w / 2, h * 0.45 - Math.max(48, Math.min(w, h) * 0.18) * 0.65);

        drawTimingHud(ctx, w, h, now, state);
        drawFlashOverlay(ctx, w, h, now, state);
    }

    function drawTimecode(ctx, w, h, now, state) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        drawCenterMarker(ctx, w, h);

        const elapsed = state.active && runtime.sessionStart > 0
            ? now - runtime.sessionStart
            : 0;

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.max(28, Math.min(w, h) * 0.1)}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatTimecode(elapsed), w / 2, h * 0.45);

        ctx.fillStyle = ACCENT;
        ctx.font = `700 ${Math.max(12, Math.min(w, h) * 0.028)}px Montserrat, sans-serif`;
        ctx.fillText('TIMECODE', w / 2, h * 0.45 - Math.max(28, Math.min(w, h) * 0.1) * 0.75);

        drawTimingHud(ctx, w, h, now, state);
        drawFlashOverlay(ctx, w, h, now, state);
    }

    const MODE_RENDERERS = {
        'flash-click': drawFlashClick,
        'sync-ball': drawSyncBall,
        'frame-counter': drawFrameCounter,
        timecode: drawTimecode
    };

    const AvSyncModule = {
        id: 'sync-tools',
        needsAnimationLoop: true,

        defaultState: {
            mode: 'flash-click',
            active: false,
            intervalMs: 1000,
            clickVolume: 0.6,
            flashEnabled: true,
            clickEnabled: true
        },

        shouldAnimate(state) {
            return state.active === true;
        },

        onAttach(engine) {
            if (!engine.state.mode) {
                engine.setState({ ...this.defaultState });
            }
        },

        onDetach() {
            resetRuntime();
        },

        onStateChange(engine, state, key) {
            if (key === 'active') {
                if (state.active) {
                    resetRuntime();
                } else {
                    resetRuntime();
                }
            }
            if (key === 'mode' || key === 'intervalMs') {
                resetRuntime();
            }
        },

        getControlSchema(state = {}) {
            const flashModes = ['flash-click', 'sync-ball', 'frame-counter'].includes(state.mode || 'flash-click');
            return [
                {
                    section: 'pattern',
                    type: 'select',
                    key: 'mode',
                    label: 'Sync Mode',
                    options: MODE_CATALOG.map((entry) => ({
                        value: entry.id,
                        label: entry.label
                    }))
                },
                {
                    section: 'motion',
                    type: 'transport',
                    key: 'active',
                    label: 'Transport',
                    startLabel: 'Start',
                    stopLabel: 'Stop'
                },
                {
                    section: 'motion',
                    type: 'range',
                    key: 'intervalMs',
                    label: 'Interval',
                    min: 250,
                    max: 5000,
                    step: 50,
                    unit: 'ms'
                },
                {
                    section: 'motion',
                    type: 'range',
                    key: 'clickVolume',
                    label: 'Click Volume',
                    min: 0,
                    max: 1,
                    step: 0.05
                },
                {
                    section: 'motion',
                    type: 'checkbox',
                    key: 'flashEnabled',
                    label: 'Visual Flash',
                    enabledWhen: () => flashModes
                },
                {
                    section: 'motion',
                    type: 'checkbox',
                    key: 'clickEnabled',
                    label: 'Audio Click'
                }
            ];
        },

        render(ctx, frame) {
            const w = frame.displayWidth;
            const h = frame.displayHeight;
            const state = frame.state || {};
            const now = frame.timestamp;

            if (state.active) {
                updateSyncRuntime(now, state);
            }

            const draw = MODE_RENDERERS[state.mode] || drawFlashClick;
            draw(ctx, w, h, now, state);
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('sync-tools', AvSyncModule);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.AvSyncModule = AvSyncModule;
    global.OkamiSignalLab.MODE_CATALOG = MODE_CATALOG;
    global.OkamiSignalLab.getSyncRuntimeSnapshot = getSyncRuntimeSnapshot;
    global.OkamiSignalLab.restoreSyncRuntimeSnapshot = restoreSyncRuntimeSnapshot;
})(typeof window !== 'undefined' ? window : globalThis);
