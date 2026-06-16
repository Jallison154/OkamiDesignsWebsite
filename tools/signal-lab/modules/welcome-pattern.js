(function(global) {
    'use strict';

    const ACCENT = '#FF6A2D';

    const WelcomePattern = {
        id: 'welcome',
        needsAnimationLoop: true,

        onAttach(engine) {
            engine.setState({ phase: 0 });
        },

        render(ctx, frame) {
            const { displayWidth: w, displayHeight: h, timestamp, state } = frame;
            const phase = (timestamp / 1000) * 0.15;

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, w, h);

            const barCount = 8;
            const barWidth = w / barCount;
            const colors = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000'];

            for (let i = 0; i < barCount; i += 1) {
                ctx.fillStyle = colors[i];
                ctx.fillRect(i * barWidth, 0, barWidth, h * 0.72);
            }

            ctx.fillStyle = '#111';
            ctx.fillRect(0, h * 0.72, w, h * 0.28);

            const gridSize = Math.max(24, Math.min(w, h) / 16);
            ctx.strokeStyle = 'rgba(255, 106, 45, 0.22)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0; x <= w; x += gridSize) {
                ctx.moveTo(x + 0.5, h * 0.72);
                ctx.lineTo(x + 0.5, h);
            }
            for (let y = h * 0.72; y <= h; y += gridSize) {
                ctx.moveTo(0, y + 0.5);
                ctx.lineTo(w, y + 0.5);
            }
            ctx.stroke();

            const cx = w / 2;
            const cy = h * 0.86;
            const radius = Math.min(w, h) * 0.06;
            ctx.strokeStyle = ACCENT;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius + Math.sin(phase * Math.PI * 2) * 4, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = ACCENT;
            ctx.font = `700 ${Math.max(11, Math.min(w, h) * 0.028)}px Montserrat, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('OKAMI SIGNAL LAB', cx, cy - radius - 14);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = `500 ${Math.max(10, Math.min(w, h) * 0.022)}px Montserrat, sans-serif`;
            ctx.fillText('Rendering engine ready', cx, cy + radius + 16);
        }
    };

    if (global.OkamiSignalLab?.ModuleRegistry) {
        global.OkamiSignalLab.ModuleRegistry.registerRenderer('welcome', WelcomePattern);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.WelcomePattern = WelcomePattern;
})(typeof window !== 'undefined' ? window : globalThis);
