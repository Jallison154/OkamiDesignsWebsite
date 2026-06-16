(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';
    const BRAND_COLORS = [
        '#FF6A2D', '#4ECDC4', '#FFE66D', '#A78BFA',
        '#F472B6', '#34D399', '#60A5FA', '#FB923C'
    ];

    const RANDOM_MOTION_TYPES = [
        { id: 'random-bounce', label: 'Random Bounce' },
        { id: 'random-walk', label: 'Random Walk' },
        { id: 'random-waypoints', label: 'Random Waypoints' },
        { id: 'multi-object', label: 'Multi-Object Random' },
        { id: 'particle-swarm', label: 'Particle Swarm' }
    ];

    const RANDOM_PRESETS = {
        'gentle-drift': {
            randomMotionType: 'random-walk',
            speed: 0.55,
            objectCount: 1,
            randomnessAmount: 25,
            directionChangeFreq: 5,
            trailLength: 55,
            trailOpacity: 45,
            smoothMotion: true,
            boundaryBounce: false,
            wrapEdges: true
        },
        'trade-show': {
            randomMotionType: 'multi-object',
            speed: 1,
            objectCount: 6,
            randomnessAmount: 50,
            directionChangeFreq: 2.5,
            trailLength: 35,
            trailOpacity: 60,
            randomColorMode: 'brand',
            boundaryBounce: true
        },
        'led-stress': {
            randomMotionType: 'multi-object',
            speed: 1.6,
            objectCount: 18,
            randomnessAmount: 70,
            directionChangeFreq: 1.5,
            trailLength: 25,
            trailOpacity: 50,
            randomRotation: true,
            randomScaleChanges: true
        },
        'processor-test': {
            randomMotionType: 'particle-swarm',
            speed: 1.4,
            objectCount: 120,
            randomnessAmount: 85,
            directionChangeFreq: 0.8,
            trailLength: 20,
            trailOpacity: 35,
            randomColorMode: 'rainbow'
        },
        'chaos': {
            randomMotionType: 'random-bounce',
            speed: 2.4,
            objectCount: 10,
            randomnessAmount: 100,
            directionChangeFreq: 0.6,
            trailLength: 70,
            trailOpacity: 75,
            randomColorMode: 'random',
            randomRotation: true,
            randomScaleChanges: true,
            boundaryBounce: true
        }
    };

    const PRESET_OPTIONS = [
        { value: 'custom', label: 'Custom' },
        { value: 'gentle-drift', label: 'Gentle Drift' },
        { value: 'trade-show', label: 'Trade Show' },
        { value: 'led-stress', label: 'LED Wall Stress Test' },
        { value: 'processor-test', label: 'Processor Test' },
        { value: 'chaos', label: 'Chaos Mode' }
    ];

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function rand(min = 0, max = 1) {
        return min + Math.random() * (max - min);
    }

    function isRandomMotion(state) {
        return (state?.patternId || '') === 'random-motion';
    }

    function getObjectRadius(w, h, scale, state, type) {
        const base = Math.min(w, h) * 0.045 * scale;
        if (type === 'particle-swarm') {
            return Math.max(1.5, base * 0.35);
        }
        return Math.max(3, base);
    }

    function getMaxObjectCount(state, w, h) {
        const requested = Math.round(Number(state.objectCount) || 1);
        const type = state.randomMotionType || 'random-bounce';
        const pixels = w * h;

        if (type === 'particle-swarm') {
            if (pixels > 1920 * 1080) {
                return Math.min(requested, 250);
            }
            if (pixels > 1280 * 720) {
                return Math.min(requested, 150);
            }
            return Math.min(requested, 80);
        }

        if (type === 'multi-object') {
            return Math.min(requested, 32);
        }

        return Math.min(requested, 12);
    }

    function effectiveObjectCount(state, w, h) {
        const type = state.randomMotionType || 'random-bounce';
        const max = getMaxObjectCount(state, w, h);
        if (type === 'random-bounce' || type === 'random-walk' || type === 'random-waypoints') {
            return Math.min(max, 1);
        }
        return max;
    }

    function resolveColor(state, obj, timestamp, index) {
        const mode = state.randomColorMode || 'brand';
        if (mode === 'fixed') {
            return state.objectColor || ACCENT;
        }
        if (mode === 'random') {
            return obj.color || BRAND_COLORS[index % BRAND_COLORS.length];
        }
        if (mode === 'rainbow') {
            const hue = (obj.hue + timestamp * 0.04) % 360;
            return `hsl(${hue}, 78%, 56%)`;
        }
        return BRAND_COLORS[index % BRAND_COLORS.length];
    }

    function spawnObject(w, h, radius, index) {
        const margin = radius + 4;
        const speed = Math.min(w, h) * rand(0.12, 0.28);
        const angle = rand(0, Math.PI * 2);
        return {
            x: rand(margin, Math.max(margin + 1, w - margin)),
            y: rand(margin, Math.max(margin + 1, h - margin)),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            angle: rand(0, Math.PI * 2),
            angVel: rand(-2, 2),
            objScale: 1,
            scaleVel: rand(-0.4, 0.4),
            targetX: rand(margin, Math.max(margin + 1, w - margin)),
            targetY: rand(margin, Math.max(margin + 1, h - margin)),
            pauseUntil: 0,
            lastDirChange: 0,
            trail: [],
            color: BRAND_COLORS[index % BRAND_COLORS.length],
            hue: rand(0, 360)
        };
    }

    function ensureSim(state, w, h, scale) {
        const type = state.randomMotionType || 'random-bounce';
        const count = effectiveObjectCount(state, w, h);
        let sim = state._randomMotion;

        if (!sim || sim.w !== w || sim.h !== h || sim.type !== type) {
            sim = {
                w,
                h,
                type,
                objects: [],
                lastTs: 0
            };
            state._randomMotion = sim;
        }

        while (sim.objects.length < count) {
            const r = getObjectRadius(w, h, scale, state, type);
            sim.objects.push(spawnObject(w, h, r, sim.objects.length));
        }
        while (sim.objects.length > count) {
            sim.objects.pop();
        }

        return sim;
    }

    function pushTrail(obj, maxLen) {
        if (maxLen <= 0) {
            obj.trail = [];
            return;
        }
        obj.trail.push({ x: obj.x, y: obj.y });
        while (obj.trail.length > maxLen) {
            obj.trail.shift();
        }
    }

    function handleBoundary(obj, w, h, radius, state) {
        const bounce = state.boundaryBounce !== false;
        const wrap = Boolean(state.wrapEdges);

        if (wrap) {
            if (obj.x < -radius) {
                obj.x = w + radius;
            }
            if (obj.x > w + radius) {
                obj.x = -radius;
            }
            if (obj.y < -radius) {
                obj.y = h + radius;
            }
            if (obj.y > h + radius) {
                obj.y = -radius;
            }
            return;
        }

        if (!bounce) {
            return;
        }

        if (obj.x - radius < 0) {
            obj.x = radius;
            obj.vx = Math.abs(obj.vx);
        } else if (obj.x + radius > w) {
            obj.x = w - radius;
            obj.vx = -Math.abs(obj.vx);
        }

        if (obj.y - radius < 0) {
            obj.y = radius;
            obj.vy = Math.abs(obj.vy);
        } else if (obj.y + radius > h) {
            obj.y = h - radius;
            obj.vy = -Math.abs(obj.vy);
        }
    }

    function perturbVelocity(obj, state, timestamp) {
        const freq = Math.max(0.25, Number(state.directionChangeFreq) || 2);
        const amount = clamp(Number(state.randomnessAmount) || 50, 0, 100) / 100;

        if (timestamp - obj.lastDirChange < freq * 1000) {
            return;
        }

        obj.lastDirChange = timestamp;
        const speed = Math.hypot(obj.vx, obj.vy) || 1;
        const angle = Math.atan2(obj.vy, obj.vx) + rand(-Math.PI, Math.PI) * amount;
        const nextSpeed = speed * (1 + rand(-0.25, 0.25) * amount);
        obj.vx = Math.cos(angle) * nextSpeed;
        obj.vy = Math.sin(angle) * nextSpeed;
        obj.hue = (obj.hue + rand(20, 80)) % 360;
    }

    function stepRandomBounce(obj, dt, w, h, radius, state, timestamp, speedMult) {
        perturbVelocity(obj, state, timestamp);
        obj.x += obj.vx * dt * speedMult;
        obj.y += obj.vy * dt * speedMult;
        handleBoundary(obj, w, h, radius, state);
    }

    function stepRandomWalk(obj, dt, w, h, radius, state, speedMult) {
        const amount = clamp(Number(state.randomnessAmount) || 50, 0, 100) / 100;
        const smooth = state.smoothMotion !== false ? 0.92 : 0.75;
        const steer = amount * 3.5;

        obj.vx = obj.vx * smooth + rand(-steer, steer) * speedMult;
        obj.vy = obj.vy * smooth + rand(-steer, steer) * speedMult;

        const maxSpeed = Math.min(w, h) * 0.35 * speedMult;
        const mag = Math.hypot(obj.vx, obj.vy) || 1;
        if (mag > maxSpeed) {
            obj.vx = (obj.vx / mag) * maxSpeed;
            obj.vy = (obj.vy / mag) * maxSpeed;
        }

        obj.x += obj.vx * dt;
        obj.y += obj.vy * dt;
        handleBoundary(obj, w, h, radius, state);
    }

    function stepRandomWaypoints(obj, dt, w, h, radius, state, timestamp, speedMult) {
        const pauseMs = Math.max(0, Number(state.waypointPauseMs) || 400);

        if (timestamp < obj.pauseUntil) {
            return;
        }

        const dx = obj.targetX - obj.x;
        const dy = obj.targetY - obj.y;
        const dist = Math.hypot(dx, dy);

        if (dist < radius * 1.5) {
            obj.pauseUntil = timestamp + pauseMs;
            const margin = radius + 4;
            obj.targetX = rand(margin, Math.max(margin + 1, w - margin));
            obj.targetY = rand(margin, Math.max(margin + 1, h - margin));
            return;
        }

        const speed = Math.min(w, h) * 0.45 * speedMult;
        const lerp = state.smoothMotion !== false ? 0.08 : 0.14;
        obj.vx += (dx / dist) * speed * lerp;
        obj.vy += (dy / dist) * speed * lerp;
        obj.vx *= 0.9;
        obj.vy *= 0.9;
        obj.x += obj.vx * dt;
        obj.y += obj.vy * dt;
        handleBoundary(obj, w, h, radius, state);
    }

    function stepObject(obj, dt, w, h, radius, state, timestamp, speedMult, motionType) {
        if (motionType === 'random-walk' || motionType === 'particle-swarm') {
            stepRandomWalk(obj, dt, w, h, radius, state, speedMult);
        } else if (motionType === 'random-waypoints') {
            stepRandomWaypoints(obj, dt, w, h, radius, state, timestamp, speedMult);
        } else {
            stepRandomBounce(obj, dt, w, h, radius, state, timestamp, speedMult);
        }

        if (state.randomRotation) {
            obj.angle += obj.angVel * dt;
        }

        if (state.randomScaleChanges) {
            obj.objScale += obj.scaleVel * dt;
            if (obj.objScale < 0.55 || obj.objScale > 1.45) {
                obj.scaleVel *= -1;
            }
            obj.objScale = clamp(obj.objScale, 0.55, 1.45);
        }
    }

    function stepSimulation(state, w, h, timestamp, playing, speed, scale) {
        const sim = ensureSim(state, w, h, scale);
        const motionType = state.randomMotionType || 'random-bounce';
        const speedMult = Math.max(0.25, Number(speed) || 1);

        if (!playing) {
            sim.lastTs = timestamp;
            return sim;
        }

        if (state._syncedRandom) {
            Object.assign(sim, state._syncedRandom);
            delete state._syncedRandom;
            sim.lastTs = timestamp;
        }

        const lastTs = sim.lastTs || timestamp;
        let dt = (timestamp - lastTs) / 1000;
        sim.lastTs = timestamp;
        if (dt <= 0) {
            return sim;
        }
        dt = Math.min(dt, 0.05);

        const trailMax = Math.max(0, Math.round((Number(state.trailLength) || 40) / 4));

        sim.objects.forEach((obj) => {
            stepObject(obj, dt, w, h, getObjectRadius(w, h, scale, state, motionType), state, timestamp, speedMult, motionType);
            pushTrail(obj, trailMax);
        });

        return sim;
    }

    function drawTrails(ctx, sim, state, timestamp) {
        const trailOpacity = clamp(Number(state.trailOpacity) || 70, 0, 100) / 100;
        if (trailOpacity <= 0) {
            return;
        }

        ctx.save();
        sim.objects.forEach((obj, index) => {
            const color = resolveColor(state, obj, timestamp, index);
            for (let i = 0; i < obj.trail.length; i += 1) {
                const t = (i + 1) / obj.trail.length;
                ctx.globalAlpha = t * 0.4 * trailOpacity;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(obj.trail[i].x, obj.trail[i].y, 1.5 + t * 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawObjects(ctx, sim, state, timestamp, w, h, scale) {
        const motionType = state.randomMotionType || 'random-bounce';

        sim.objects.forEach((obj, index) => {
            const baseR = getObjectRadius(w, h, scale, state, motionType);
            const radius = baseR * (obj.objScale || 1);
            const color = resolveColor(state, obj, timestamp, index);

            ctx.save();
            ctx.translate(obj.x, obj.y);
            if (state.randomRotation) {
                ctx.rotate(obj.angle || 0);
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.28)';
            ctx.lineWidth = Math.max(1, radius * 0.08);
            ctx.stroke();
            ctx.restore();
        });
    }

    function drawRandomMotion(ctx, w, h, timestamp, scale, state, playing, speed, frame, clearBackground) {
        clearBackground(ctx, w, h, frame, state);
        const sim = stepSimulation(state, w, h, timestamp, playing, speed, scale);
        drawTrails(ctx, sim, state, timestamp);
        drawObjects(ctx, sim, state, timestamp, w, h, scale);
    }

    function extractRandomSnapshot(state) {
        const sim = state._randomMotion;
        if (!sim) {
            return null;
        }
        return {
            w: sim.w,
            h: sim.h,
            type: sim.type,
            lastTs: sim.lastTs,
            objects: sim.objects.map((obj) => ({
                ...obj,
                trail: Array.isArray(obj.trail) ? obj.trail.map((p) => ({ ...p })) : []
            }))
        };
    }

    function applyPreset(state, presetId) {
        const preset = RANDOM_PRESETS[presetId];
        if (!preset) {
            return state;
        }
        return { ...state, ...preset, randomPreset: presetId, _randomMotion: null };
    }

    function resetRandomSim(state) {
        state._randomMotion = null;
    }

    function getDefaultRandomState() {
        return {
            randomMotionType: 'random-bounce',
            randomPreset: 'custom',
            objectCount: 1,
            randomnessAmount: 55,
            directionChangeFreq: 2,
            randomColorMode: 'brand',
            waypointPauseMs: 400,
            boundaryBounce: true,
            wrapEdges: false,
            smoothMotion: true,
            randomRotation: false,
            randomScaleChanges: false
        };
    }

    function getControlSchema(range) {
        const isRm = (s) => isRandomMotion(s);
        const isSwarm = (s) => isRm(s) && (
            s.randomMotionType === 'particle-swarm' || s.randomMotionType === 'multi-object'
        );
        const isWaypoint = (s) => isRm(s) && s.randomMotionType === 'random-waypoints';

        return [
            {
                section: 'motion-props',
                type: 'select',
                key: 'randomMotionType',
                label: 'Random Pattern Type',
                options: RANDOM_MOTION_TYPES.map((t) => ({ value: t.id, label: t.label })),
                enabledWhen: isRm
            },
            {
                section: 'motion-props',
                type: 'select',
                key: 'randomPreset',
                label: 'Preset',
                options: PRESET_OPTIONS,
                enabledWhen: isRm
            },
            range('objectCount', 'Object Count', 1, 200, 1, '', isSwarm),
            range('randomnessAmount', 'Randomness Amount', 0, 100, 1, '%', isRm),
            range('directionChangeFreq', 'Direction Change Frequency', 0.25, 10, 0.25, 's', isRm),
            {
                section: 'motion-props',
                type: 'select',
                key: 'randomColorMode',
                label: 'Color Mode',
                options: [
                    { value: 'fixed', label: 'Fixed' },
                    { value: 'random', label: 'Random' },
                    { value: 'rainbow', label: 'Rainbow' },
                    { value: 'brand', label: 'Brand Colors' }
                ],
                enabledWhen: isRm
            },
            range('waypointPauseMs', 'Pause at Destination', 0, 3000, 50, 'ms', isWaypoint),
            {
                section: 'motion-props',
                type: 'checkbox',
                key: 'boundaryBounce',
                label: 'Boundary Bounce',
                enabledWhen: isRm
            },
            {
                section: 'motion-props',
                type: 'checkbox',
                key: 'wrapEdges',
                label: 'Wrap Around Edges',
                enabledWhen: isRm
            },
            {
                section: 'motion-props',
                type: 'checkbox',
                key: 'smoothMotion',
                label: 'Smooth Motion',
                enabledWhen: isRm
            },
            {
                section: 'motion-props',
                type: 'checkbox',
                key: 'randomRotation',
                label: 'Random Rotation',
                enabledWhen: isRm
            },
            {
                section: 'motion-props',
                type: 'checkbox',
                key: 'randomScaleChanges',
                label: 'Random Scale Changes',
                enabledWhen: isRm
            }
        ];
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.RandomMotion = {
        RANDOM_MOTION_TYPES,
        RANDOM_PRESETS,
        isRandomMotion,
        drawRandomMotion,
        extractRandomSnapshot,
        applyPreset,
        resetRandomSim,
        getDefaultRandomState,
        getControlSchema,
        getMaxObjectCount
    };
})(typeof window !== 'undefined' ? window : globalThis);
