(function(global) {
    'use strict';

    /**
     * Lightweight click synthesizer for AV sync tools (isolated from tone generator).
     */
    class SyncAudio {
        constructor() {
            this.context = null;
        }

        async ensureContext() {
            if (this.context) {
                if (this.context.state === 'suspended') {
                    await this.context.resume();
                }
                return this.context;
            }

            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioCtx();
            return this.context;
        }

        async playClick(volume = 0.6) {
            const ctx = await this.ensureContext();
            const t = ctx.currentTime;
            const clamped = Math.max(0, Math.min(1, volume));

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, t);
            osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);

            gain.gain.setValueAtTime(clamped, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(t);
            osc.stop(t + 0.06);
        }

        destroy() {
            if (this.context) {
                this.context.close();
                this.context = null;
            }
        }
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.SyncAudio = SyncAudio;
})(typeof window !== 'undefined' ? window : globalThis);
