(function(global) {
    'use strict';

    /**
     * Web Audio engine for Signal Lab tone and noise generation.
     */
    class AudioEngine {
        constructor() {
            this.context = null;
            this.masterGain = null;
            this.analyser = null;
            this.merger = null;
            this.gainLeft = null;
            this.gainRight = null;
            this.sourceNode = null;
            this.noiseBuffer = null;
            this.pinkNoiseBuffer = null;
            this.currentSourceId = null;
            this._peakHold = 0;
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

            this.masterGain = this.context.createGain();
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.65;

            this.merger = this.context.createChannelMerger(2);
            this.gainLeft = this.context.createGain();
            this.gainRight = this.context.createGain();

            this.gainLeft.connect(this.merger, 0, 0);
            this.gainRight.connect(this.merger, 0, 1);
            this.merger.connect(this.masterGain);
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.context.destination);

            this.masterGain.gain.value = 0.5;
            this.setChannelMode('stereo');

            return this.context;
        }

        _ensureNoiseBuffers() {
            if (!this.context || this.noiseBuffer) {
                return;
            }

            const sampleRate = this.context.sampleRate;
            const duration = 2;
            const length = Math.floor(sampleRate * duration);

            this.noiseBuffer = this.context.createBuffer(1, length, sampleRate);
            const white = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < length; i += 1) {
                white[i] = Math.random() * 2 - 1;
            }

            this.pinkNoiseBuffer = this.context.createBuffer(1, length, sampleRate);
            const pink = this.pinkNoiseBuffer.getChannelData(0);
            let b0 = 0;
            let b1 = 0;
            let b2 = 0;
            let b3 = 0;
            let b4 = 0;
            let b5 = 0;
            let b6 = 0;

            for (let i = 0; i < length; i += 1) {
                const whiteSample = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + whiteSample * 0.0555179;
                b1 = 0.99332 * b1 + whiteSample * 0.0750759;
                b2 = 0.969 * b2 + whiteSample * 0.153852;
                b3 = 0.8665 * b3 + whiteSample * 0.3104856;
                b4 = 0.55 * b4 + whiteSample * 0.5329522;
                b5 = -0.7616 * b5 - whiteSample * 0.016898;
                pink[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + whiteSample * 0.5362) * 0.11;
                b6 = whiteSample * 0.115926;
            }
        }

        _stopSource() {
            if (!this.sourceNode) {
                return;
            }

            try {
                this.sourceNode.stop();
                this.sourceNode.disconnect();
            } catch {
                // Source may already be stopped.
            }

            this.sourceNode = null;
        }

        _createSourceNode(sourceId) {
            const TONE_FREQUENCIES = {
                'tone-40hz': 40,
                'tone-60hz': 60,
                'tone-100hz': 100,
                'tone-250hz': 250,
                'tone-500hz': 500,
                'tone-1khz': 1000,
                'tone-4khz': 4000,
                'tone-10khz': 10000
            };

            if (TONE_FREQUENCIES[sourceId]) {
                const osc = this.context.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = TONE_FREQUENCIES[sourceId];
                return osc;
            }

            if (sourceId === 'white-noise' || sourceId === 'pink-noise') {
                this._ensureNoiseBuffers();
                const src = this.context.createBufferSource();
                src.buffer = sourceId === 'pink-noise' ? this.pinkNoiseBuffer : this.noiseBuffer;
                src.loop = true;
                return src;
            }

            return null;
        }

        async start(sourceId) {
            await this.ensureContext();
            this._stopSource();

            const node = this._createSourceNode(sourceId);
            if (!node) {
                return false;
            }

            const tap = this.context.createGain();
            tap.gain.value = 1;
            node.connect(tap);
            tap.connect(this.gainLeft);
            tap.connect(this.gainRight);

            node.start(0);
            this.sourceNode = node;
            this.currentSourceId = sourceId;
            return true;
        }

        stop() {
            this._stopSource();
            this.currentSourceId = null;
            this._peakHold = 0;
        }

        setVolume(linear) {
            if (!this.masterGain) {
                return;
            }
            const clamped = Math.max(0, Math.min(1, linear));
            this.masterGain.gain.setTargetAtTime(clamped, this.context?.currentTime || 0, 0.015);
        }

        setChannelMode(mode) {
            if (!this.gainLeft || !this.gainRight) {
                return;
            }

            const t = this.context?.currentTime || 0;
            if (mode === 'left') {
                this.gainLeft.gain.setTargetAtTime(1, t, 0.01);
                this.gainRight.gain.setTargetAtTime(0, t, 0.01);
            } else if (mode === 'right') {
                this.gainLeft.gain.setTargetAtTime(0, t, 0.01);
                this.gainRight.gain.setTargetAtTime(1, t, 0.01);
            } else {
                this.gainLeft.gain.setTargetAtTime(1, t, 0.01);
                this.gainRight.gain.setTargetAtTime(1, t, 0.01);
            }
        }

        getPeakLevels() {
            if (!this.analyser) {
                return { peak: 0, peakDb: -Infinity, left: 0, right: 0 };
            }

            const data = new Float32Array(this.analyser.fftSize);
            this.analyser.getFloatTimeDomainData(data);

            let peak = 0;
            for (let i = 0; i < data.length; i += 1) {
                const abs = Math.abs(data[i]);
                if (abs > peak) {
                    peak = abs;
                }
            }

            this._peakHold = Math.max(peak, this._peakHold * 0.96);
            const peakDb = this._peakHold > 0.00001
                ? 20 * Math.log10(this._peakHold)
                : -Infinity;

            return {
                peak: this._peakHold,
                peakDb,
                left: this._peakHold,
                right: this._peakHold
            };
        }

        destroy() {
            this.stop();
            if (this.context) {
                this.context.close();
                this.context = null;
            }
            this.masterGain = null;
            this.analyser = null;
        }
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.AudioEngine = AudioEngine;
})(typeof window !== 'undefined' ? window : globalThis);
