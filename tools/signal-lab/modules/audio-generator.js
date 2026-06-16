(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';

    const SOURCE_CATALOG = [
        { id: 'tone-40hz', label: '40Hz Tone', frequency: '40 Hz' },
        { id: 'tone-60hz', label: '60Hz Tone', frequency: '60 Hz' },
        { id: 'tone-100hz', label: '100Hz Tone', frequency: '100 Hz' },
        { id: 'tone-250hz', label: '250Hz Tone', frequency: '250 Hz' },
        { id: 'tone-500hz', label: '500Hz Tone', frequency: '500 Hz' },
        { id: 'tone-1khz', label: '1kHz Tone', frequency: '1 kHz' },
        { id: 'tone-4khz', label: '4kHz Tone', frequency: '4 kHz' },
        { id: 'tone-10khz', label: '10kHz Tone', frequency: '10 kHz' },
        { id: 'pink-noise', label: 'Pink Noise', frequency: 'Noise' },
        { id: 'white-noise', label: 'White Noise', frequency: 'Noise' }
    ];

    let audioEngine = null;

    function getAudioEngine() {
        if (!audioEngine) {
            audioEngine = new global.OkamiSignalLab.AudioEngine();
        }
        return audioEngine;
    }

    function getSourceMeta(sourceId) {
        return SOURCE_CATALOG.find((entry) => entry.id === sourceId) || SOURCE_CATALOG[5];
    }

    function formatDb(db) {
        if (!Number.isFinite(db) || db <= -60) {
            return '−∞ dB';
        }
        return `${db.toFixed(1)} dB`;
    }

    function updatePeakMeterDom(levels) {
        const root = document.querySelector('[data-peak-meter-root]');
        if (!root) {
            return;
        }

        const fill = root.querySelector('[data-peak-fill]');
        const label = root.querySelector('[data-peak-label]');
        const pct = Math.min(100, Math.max(0, levels.peak * 100));

        if (fill) {
            fill.style.width = `${pct}%`;
        }
        if (label) {
            label.textContent = formatDb(levels.peakDb);
        }
    }

    function applyAudioState(state) {
        const engine = getAudioEngine();
        engine.setVolume(Number(state.volume) ?? 0.5);
        engine.setChannelMode(state.channelMode || 'stereo');

        if (state.active) {
            engine.start(state.sourceId || 'tone-1khz');
        } else {
            engine.stop();
        }
    }

    function drawMeter(ctx, w, h, levels, state, frame) {
        global.OkamiSignalLab?.TechnicalBackground?.fillModuleBase?.(ctx, w, h, frame)
            ?? (ctx.fillStyle = '#0a0a0a', ctx.fillRect(0, 0, w, h));

        const meta = getSourceMeta(state.sourceId);
        const status = state.active ? 'OUTPUT ACTIVE' : 'STOPPED';
        const statusColor = state.active ? '#7dffb0' : 'rgba(255,255,255,0.35)';

        ctx.fillStyle = ACCENT;
        ctx.font = `800 ${Math.max(16, Math.min(w, h) * 0.06)}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AUDIO GENERATOR', w / 2, h * 0.18);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.max(22, Math.min(w, h) * 0.09)}px Montserrat, sans-serif`;
        ctx.fillText(meta.label, w / 2, h * 0.32);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `500 ${Math.max(12, Math.min(w, h) * 0.028)}px Montserrat, sans-serif`;
        ctx.fillText(meta.frequency, w / 2, h * 0.41);

        ctx.fillStyle = statusColor;
        ctx.font = `700 ${Math.max(11, Math.min(w, h) * 0.024)}px Montserrat, sans-serif`;
        ctx.fillText(status, w / 2, h * 0.5);

        const meterW = w * 0.72;
        const meterH = Math.max(18, h * 0.06);
        const meterX = (w - meterW) / 2;
        const meterY = h * 0.58;

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(meterX, meterY, meterW, meterH);

        const peakW = meterW * Math.min(1, levels.peak);
        const gradient = ctx.createLinearGradient(meterX, 0, meterX + meterW, 0);
        gradient.addColorStop(0, '#2ecc71');
        gradient.addColorStop(0.7, '#f1c40f');
        gradient.addColorStop(0.9, ACCENT);
        gradient.addColorStop(1, '#ff4444');
        ctx.fillStyle = gradient;
        ctx.fillRect(meterX, meterY, peakW, meterH);

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(meterX, meterY, meterW, meterH);

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `600 ${Math.max(11, Math.min(w, h) * 0.022)}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.fillText(`PEAK ${formatDb(levels.peakDb)}`, w / 2, meterY + meterH + 22);

        const channelLabel = {
            stereo: 'Stereo',
            left: 'Left Channel Only',
            right: 'Right Channel Only'
        }[state.channelMode || 'stereo'] || 'Stereo';

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `500 ${Math.max(10, Math.min(w, h) * 0.02)}px Montserrat, sans-serif`;
        ctx.fillText(`${channelLabel} · Vol ${Math.round((state.volume ?? 0.5) * 100)}%`, w / 2, h * 0.82);
    }

    const AudioGeneratorModule = {
        id: 'audio-tools',
        needsAnimationLoop: true,

        defaultState: {
            sourceId: 'tone-1khz',
            active: false,
            volume: 0.5,
            channelMode: 'stereo'
        },

        shouldAnimate(state) {
            return state.active === true;
        },

        onAttach(engine) {
            applyAudioState(engine.state || this.defaultState);
        },

        onDetach() {
            getAudioEngine().stop();
        },

        onStateChange(engine, state) {
            applyAudioState(state);
            if (!state.active) {
                getAudioEngine().getPeakLevels();
            }
        },

        getControlSchema() {
            return [
                {
                    section: 'output',
                    type: 'select',
                    key: 'sourceId',
                    label: 'Audio Source',
                    options: SOURCE_CATALOG.map((entry) => ({
                        value: entry.id,
                        label: entry.label
                    }))
                },
                {
                    section: 'output',
                    type: 'transport',
                    key: 'active',
                    label: 'Transport',
                    startLabel: 'Start',
                    stopLabel: 'Stop'
                },
                {
                    section: 'output',
                    type: 'range',
                    key: 'volume',
                    label: 'Audio Level',
                    min: 0,
                    max: 1,
                    step: 0.01
                },
                {
                    section: 'output',
                    type: 'peak-meter',
                    key: 'peakMeter',
                    label: 'Peak Meter'
                },
                {
                    section: 'output',
                    type: 'radio',
                    key: 'channelMode',
                    label: 'Channel Output',
                    options: [
                        { value: 'stereo', label: 'Stereo' },
                        { value: 'left', label: 'Left Only' },
                        { value: 'right', label: 'Right Only' }
                    ]
                }
            ];
        },

        render(ctx, frame) {
            const w = frame.displayWidth;
            const h = frame.displayHeight;
            const state = frame.state || {};
            const levels = state.active
                ? getAudioEngine().getPeakLevels()
                : { peak: 0, peakDb: -Infinity, left: 0, right: 0 };

            updatePeakMeterDom(levels);
            drawMeter(ctx, w, h, levels, state, frame);
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('audio-tools', AudioGeneratorModule);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.AudioGeneratorModule = AudioGeneratorModule;
    global.OkamiSignalLab.SOURCE_CATALOG = SOURCE_CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);
