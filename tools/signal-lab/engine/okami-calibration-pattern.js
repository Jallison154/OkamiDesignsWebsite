(function(global) {
    'use strict';

    const ORANGE = '#FF6A2D';
    const CYAN = '#00B8D4';
    const WHITE = '#FFFFFF';
    const BG = '#050508';
    const GRID = 'rgba(255, 255, 255, 0.06)';
    const GRID_CYAN = 'rgba(0, 184, 212, 0.18)';

    let refreshEstimator = null;

    function getRefreshEstimator() {
        if (!refreshEstimator && global.OkamiSignalLab?.DisplayMetrics?.RefreshRateEstimator) {
            refreshEstimator = new global.OkamiSignalLab.DisplayMetrics.RefreshRateEstimator();
        }
        return refreshEstimator;
    }

    function fontSize(w, h, ratio, min = 8) {
        return Math.max(min, Math.round(Math.min(w, h) * ratio));
    }

    function strokePx(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
        ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
        ctx.stroke();
    }

    /**
     * Compute layout metrics shared by all section renderers.
     */
    function computeLayout(w, h) {
        const topBarH = Math.max(18, Math.round(h * 0.045));
        const sideRampW = Math.max(14, Math.round(w * 0.028));
        const bottomH = Math.max(48, Math.round(h * 0.14));
        const contentX = sideRampW;
        const contentY = topBarH;
        const contentW = w - sideRampW * 2;
        const contentH = h - topBarH - bottomH;
        const cx = contentX + contentW / 2;
        const cy = contentY + contentH / 2;
        const maxRadius = Math.min(contentW, contentH) * 0.42;
        const cornerSize = Math.max(18, Math.min(contentW, contentH) * 0.04);
        const starR = Math.max(16, Math.min(contentW, contentH) * 0.055);
        const convW = contentW * 0.22;
        const convH = contentH * 0.2;
        const motionW = contentW * 0.28;
        const motionH = contentH * 0.12;
        const pixelW = contentW * 0.14;
        const pixelH = contentH * 0.14;
        const sharpY = h - bottomH + Math.max(4, bottomH * 0.06);
        const sharpH = bottomH * 0.52;
        const sharpW = contentW * 0.62;
        const rampX = contentX + contentW * 0.64;
        const rampW = contentW * 0.36;
        const rampH = bottomH * 0.42;
        const rampY = h - rampH - 6;
        const infoW = Math.max(120, contentW * 0.17);
        const infoH = Math.max(52, contentH * 0.11);
        const crosshairLineW = Math.max(1, Math.round(Math.min(w, h) / 540));

        return {
            w,
            h,
            topBarH,
            sideRampW,
            bottomH,
            contentX,
            contentY,
            contentW,
            contentH,
            cx,
            cy,
            maxRadius,
            cornerSize,
            starR,
            convW,
            convH,
            motionW,
            motionH,
            pixelW,
            pixelH,
            sharpX: contentX,
            sharpY,
            sharpW,
            sharpH,
            rampX,
            rampY,
            rampW,
            rampH,
            infoW,
            infoH,
            crosshairLineW,
            gridStep: Math.min(contentW, contentH) / 24,
            rulerStep: Math.max(40, Math.round(contentW / 24))
        };
    }

    /* ── Private helpers (used inside section renderers) ── */

    function drawVerticalRamp(ctx, x, y, rw, rh) {
        const steps = Math.max(64, Math.floor(rh));
        const stepH = rh / steps;
        for (let i = 0; i < steps; i += 1) {
            const v = Math.round((i / (steps - 1)) * 255);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y + i * stepH, rw, stepH + 1);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        strokePx(ctx, x, y, x, y + rh);
        strokePx(ctx, x + rw, y, x + rw, y + rh);
    }

    function drawHorizontalRamp(ctx, x, y, rw, rh) {
        const steps = Math.max(64, Math.floor(rw));
        const stepW = rw / steps;
        for (let i = 0; i < steps; i += 1) {
            const v = Math.round((i / (steps - 1)) * 255);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x + i * stepW, y, stepW + 1, rh);
        }
    }

    function drawCornerMarker(ctx, x, y, size, flipX, flipY) {
        const sx = flipX ? -1 : 1;
        const sy = flipY ? -1 : 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(sx, sy);
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 2;
        strokePx(ctx, 0, 0, size, 0);
        strokePx(ctx, 0, 0, 0, size);
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 1;
        strokePx(ctx, 0, 0, size * 0.55, 0);
        strokePx(ctx, 0, 0, 0, size * 0.55);
        ctx.restore();
    }

    function drawWolfWatermark(ctx, cx, cy, size) {
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.translate(cx, cy);
        ctx.scale(size / 100, size / 100);

        ctx.fillStyle = ORANGE;
        ctx.beginPath();
        ctx.arc(0, 0, 42, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = BG;
        ctx.beginPath();
        ctx.moveTo(-28, -18);
        ctx.lineTo(-12, -52);
        ctx.lineTo(4, -22);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(28, -18);
        ctx.lineTo(12, -52);
        ctx.lineTo(-4, -22);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = WHITE;
        ctx.beginPath();
        ctx.ellipse(0, 12, 22, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = BG;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(-8, 28);
        ctx.lineTo(8, 28);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = ORANGE;
        ctx.beginPath();
        ctx.arc(-12, -4, 5, 0, Math.PI * 2);
        ctx.arc(12, -4, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawSiemensStar(ctx, cx, cy, outerR, segments) {
        const count = segments || 18;
        const innerR = outerR * 0.08;
        for (let i = 0; i < count; i += 1) {
            const a0 = (i / count) * Math.PI * 2;
            const a1 = ((i + 1) / count) * Math.PI * 2;
            ctx.fillStyle = i % 2 === 0 ? WHITE : '#111';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, outerR, a0, a1);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = BG;
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawChevron(ctx, x, y, size, direction) {
        ctx.beginPath();
        if (direction > 0) {
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y);
            ctx.lineTo(x, y + size);
        } else {
            ctx.moveTo(x, y - size);
            ctx.lineTo(x - size, y);
            ctx.lineTo(x, y + size);
        }
        ctx.closePath();
        ctx.fill();
    }

    function drawInfoBox(ctx, x, y, bw, bh, title, lines) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(x, y, bw, bh);
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);

        const pad = Math.max(4, bw * 0.04);
        const titleSize = fontSize(bw, bh, 0.09, 9);
        const lineSize = fontSize(bw, bh, 0.075, 8);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = ORANGE;
        ctx.font = `700 ${titleSize}px Montserrat, sans-serif`;
        ctx.fillText(title, x + pad, y + pad);

        ctx.fillStyle = WHITE;
        ctx.font = `600 ${lineSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        lines.forEach((line, i) => {
            ctx.fillText(line, x + pad, y + pad + titleSize * 1.35 + i * (lineSize * 1.25));
        });
    }

    function drawPixelGridZone(ctx, x, y, pw, ph) {
        ctx.fillStyle = '#08080c';
        ctx.fillRect(x, y, pw, ph);
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);

        const cell = Math.max(2, Math.round(Math.min(pw, ph) / 24));
        for (let py = 0; py < ph; py += cell) {
            for (let px = 0; px < pw; px += cell) {
                const checker = ((px / cell) + (py / cell)) % 2 === 0;
                ctx.fillStyle = checker ? '#ffffff' : '#000000';
                ctx.fillRect(x + px, y + py, cell, cell);
            }
        }

        ctx.fillStyle = CYAN;
        ctx.font = `600 ${fontSize(pw, ph, 0.04, 7)}px Montserrat, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('PIXEL GRID', x + 4, y + 4);
    }

    /* ── Public section renderers ── */

    function drawBackgroundGrid(ctx, layout) {
        const step = Math.max(16, Math.round(layout.gridStep));
        ctx.strokeStyle = GRID;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = layout.contentX; gx <= layout.contentX + layout.contentW; gx += step) {
            ctx.moveTo(gx + 0.5, layout.contentY);
            ctx.lineTo(gx + 0.5, layout.contentY + layout.contentH);
        }
        for (let gy = layout.contentY; gy <= layout.contentY + layout.contentH; gy += step) {
            ctx.moveTo(layout.contentX, gy + 0.5);
            ctx.lineTo(layout.contentX + layout.contentW, gy + 0.5);
        }
        ctx.stroke();
    }

    function drawColorBars(ctx, layout) {
        const { w, topBarH } = layout;
        const colors = ['#000000', '#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff'];
        const barW = w / colors.length;
        colors.forEach((color, i) => {
            ctx.fillStyle = color;
            ctx.fillRect(i * barW, 0, barW + (i === colors.length - 1 ? 0 : 1), topBarH);
        });
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 1;
        strokePx(ctx, 0, topBarH, w, topBarH);
    }

    function drawAlignmentCrosshair(ctx, layout) {
        const {
            contentX, contentY, contentW, contentH,
            cx, cy, maxRadius, cornerSize, crosshairLineW
        } = layout;
        const arm = maxRadius * 0.38;

        const radii = [0.12, 0.2, 0.28, 0.36].map((f) => maxRadius * f);
        radii.forEach((r, i) => {
            ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255, 106, 45, 0.45)';
            ctx.lineWidth = i === 0 ? 2 : 1;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        });

        drawWolfWatermark(ctx, cx, cy, maxRadius * 0.85);

        ctx.strokeStyle = WHITE;
        ctx.lineWidth = crosshairLineW;
        strokePx(ctx, cx - arm, cy, cx + arm, cy);
        strokePx(ctx, cx, cy - arm, cx, cy + arm);

        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = Math.max(1, crosshairLineW - 1);
        const inner = arm * 0.35;
        strokePx(ctx, cx - inner, cy, cx + inner, cy);
        strokePx(ctx, cx, cy - inner, cx, cy + inner);

        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, arm * 0.08, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, arm * 0.045, 0, Math.PI * 2);
        ctx.stroke();

        drawCornerMarker(ctx, contentX + 8, contentY + 8, cornerSize, false, false);
        drawCornerMarker(ctx, contentX + contentW - 8, contentY + 8, cornerSize, true, false);
        drawCornerMarker(ctx, contentX + 8, contentY + contentH - 8, cornerSize, false, true);
        drawCornerMarker(ctx, contentX + contentW - 8, contentY + contentH - 8, cornerSize, true, true);
    }

    function drawSafeAreaGuides(ctx, layout) {
        const { cx, cy, contentW, contentH } = layout;
        const boxes = [
            { ratio: 16 / 9, color: ORANGE, label: '16:9', dash: [] },
            { ratio: 4 / 3, color: CYAN, label: '4:3', dash: [6, 4] },
            { ratio: 2.39, color: 'rgba(255,255,255,0.55)', label: '2.39:1', dash: [3, 5] }
        ];

        boxes.forEach((box) => {
            let boxW = contentW * 0.92;
            let boxH = boxW / box.ratio;
            if (boxH > contentH * 0.88) {
                boxH = contentH * 0.88;
                boxW = boxH * box.ratio;
            }

            const x = cx - boxW / 2;
            const y = cy - boxH / 2;
            ctx.save();
            ctx.setLineDash(box.dash);
            ctx.strokeStyle = box.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, boxW, boxH);
            ctx.setLineDash([]);
            ctx.fillStyle = box.color;
            ctx.font = `600 ${fontSize(boxW, boxH, 0.028, 9)}px Montserrat, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(box.label, x + 6, y + 6);
            ctx.restore();
        });
    }

    function drawRulers(ctx, layout) {
        const { contentX, contentY, contentW, contentH, rulerStep } = layout;
        const step = Math.max(32, Math.round(rulerStep));

        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(0, 184, 212, 0.75)';
        ctx.font = `600 ${fontSize(contentW, contentH, 0.012, 7)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let i = 0; i <= contentW; i += step) {
            const major = i % (step * 4) === 0;
            const tickH = major ? 10 : 5;
            strokePx(ctx, contentX + i, contentY, contentX + i, contentY + tickH);
            if (major && i > 0 && i < contentW) {
                ctx.fillText(String(i), contentX + i, contentY + tickH + 2);
            }
        }

        ctx.textBaseline = 'bottom';
        for (let i = 0; i <= contentW; i += step) {
            const major = i % (step * 4) === 0;
            const tickH = major ? 10 : 5;
            strokePx(ctx, contentX + i, contentY + contentH, contentX + i, contentY + contentH - tickH);
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let j = 0; j <= contentH; j += step) {
            const major = j % (step * 4) === 0;
            const tickW = major ? 10 : 5;
            strokePx(ctx, contentX, contentY + j, contentX + tickW, contentY + j);
            strokePx(ctx, contentX + contentW, contentY + j, contentX + contentW - tickW, contentY + j);
        }
    }

    function drawGrayRamps(ctx, layout) {
        const {
            w, h, sideRampW, contentY, contentH,
            contentX, contentW, rampX, rampY, rampW, rampH, bottomH
        } = layout;

        drawVerticalRamp(ctx, 0, contentY, sideRampW, contentH);
        drawVerticalRamp(ctx, w - sideRampW, contentY, sideRampW, contentH);
        drawHorizontalRamp(ctx, rampX, rampY, rampW, rampH);

        ctx.strokeStyle = GRID_CYAN;
        ctx.lineWidth = 1;
        strokePx(ctx, contentX, h - bottomH, contentX + contentW, h - bottomH);
    }

    function drawSharpnessTests(ctx, layout) {
        const { sharpX, sharpY, sharpW, sharpH } = layout;
        const pitches = [1, 2, 3, 4, 5];
        const blockW = sharpW / pitches.length;
        const lineH = Math.max(12, Math.round(sharpH * 0.55));
        const labelY = sharpY + lineH + Math.max(6, sharpH * 0.12);
        const labelSize = fontSize(sharpW, sharpH, 0.022, 8);

        ctx.fillStyle = '#0c0c10';
        ctx.fillRect(sharpX, sharpY, sharpW, sharpH);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sharpX + 0.5, sharpY + 0.5, sharpW - 1, sharpH - 1);

        pitches.forEach((pitch, index) => {
            const bx = sharpX + index * blockW + blockW * 0.08;
            const bw = blockW * 0.84;
            const count = Math.max(4, Math.floor(bw / pitch));
            const startX = bx + (bw - count * pitch) / 2;

            ctx.fillStyle = WHITE;
            for (let i = 0; i < count; i += 1) {
                ctx.fillRect(
                    Math.round(startX + i * pitch),
                    Math.round(sharpY + (sharpH - lineH) / 2),
                    1,
                    lineH
                );
            }

            ctx.fillStyle = ORANGE;
            ctx.font = `700 ${labelSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${pitch}PX`, bx + bw / 2, labelY);
        });
    }

    function drawSiemensStars(ctx, layout) {
        const { contentX, contentY, contentW, contentH, starR } = layout;
        drawSiemensStar(ctx, contentX + contentW * 0.18, contentY + contentH * 0.22, starR);
        drawSiemensStar(ctx, contentX + contentW * 0.82, contentY + contentH * 0.22, starR);
        drawSiemensStar(ctx, contentX + contentW * 0.18, contentY + contentH * 0.78, starR);
        drawSiemensStar(ctx, contentX + contentW * 0.82, contentY + contentH * 0.78, starR);
    }

    function drawConvergenceGrid(ctx, layout) {
        const { contentX, contentY, contentW, contentH, convW, convH } = layout;
        const x = contentX + 10;
        const y = contentY + contentH - convH - 10;
        const rows = 11;
        const rowH = convH / rows;

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y, convW, convH);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        for (let r = 0; r <= rows; r += 1) {
            strokePx(ctx, x, y + r * rowH, x + convW, y + r * rowH);
        }
        for (let c = 0; c <= 8; c += 1) {
            strokePx(ctx, x + (c / 8) * convW, y, x + (c / 8) * convW, y + convH);
        }

        for (let r = 0; r < rows; r += 1) {
            const py = y + r * rowH + rowH / 2;
            const shift = (r - (rows - 1) / 2) * 0.35;
            [
                { color: '#ff0000', oy: -shift },
                { color: '#00ff00', oy: 0 },
                { color: '#0000ff', oy: shift }
            ].forEach((ch) => {
                ctx.strokeStyle = ch.color;
                ctx.lineWidth = 1;
                strokePx(ctx, x + 4, py + ch.oy, x + convW - 4, py + ch.oy);
            });
        }

        ctx.fillStyle = CYAN;
        ctx.font = `600 ${fontSize(convW, convH, 0.03, 8)}px Montserrat, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('RGB CONVERGENCE', x + 4, y + 4);
    }

    function drawMotionZone(ctx, layout, frame) {
        const { contentX, contentY, contentW, contentH, motionW, motionH } = layout;
        const x = contentX + contentW - motionW - 10;
        const y = contentY + contentH - motionH - 10;
        const timestamp = frame?.timestamp || 0;
        const state = frame?.state || {};
        const playing = state.motionPlaying !== false;

        ctx.fillStyle = '#0a0a0e';
        ctx.fillRect(x, y, motionW, motionH);
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, motionW - 1, motionH - 1);

        ctx.fillStyle = CYAN;
        ctx.font = `600 ${fontSize(motionW, motionH, 0.035, 8)}px Montserrat, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('MOTION TEST', x + 6, y + 4);

        const chevronSize = Math.max(6, Math.round(Math.min(motionW, motionH) * 0.08));
        const rowY = y + motionH * 0.55;
        const spacing = chevronSize * 2.5;
        let offset = 0;
        if (playing) {
            if (state._motionPhaseOffset !== undefined && state._motionSyncedWallAt !== undefined) {
                offset = (state._motionPhaseOffset + (Date.now() - state._motionSyncedWallAt) / 12) % spacing;
            } else {
                offset = (timestamp / 12) % spacing;
            }
        }

        ctx.fillStyle = WHITE;
        for (let i = -1; i < Math.ceil(motionW / spacing) + 2; i += 1) {
            drawChevron(ctx, x + i * spacing + offset, rowY, chevronSize, 1);
        }

        ctx.fillStyle = ORANGE;
        for (let i = -1; i < Math.ceil(motionW / spacing) + 2; i += 1) {
            drawChevron(ctx, x + i * spacing + offset + spacing * 0.5, rowY + chevronSize * 1.6, chevronSize * 0.75, -1);
        }

        if (!playing) {
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.font = `600 ${fontSize(motionW, motionH, 0.028, 7)}px Montserrat, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('PAUSED', x + motionW / 2, y + motionH - 6);
        }
    }

    function drawBranding(ctx, layout) {
        const { cx, cy, w, h } = layout;
        const titleSize = fontSize(w, h, 0.034, 14);
        const subSize = fontSize(w, h, 0.022, 10);
        const tagSize = fontSize(w, h, 0.014, 8);
        const offsetY = Math.min(w, h) * 0.14;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ORANGE;
        ctx.font = `800 ${titleSize}px Montserrat, sans-serif`;
        ctx.fillText('OKAMI DESIGNS', cx, cy - offsetY);
        ctx.fillStyle = WHITE;
        ctx.font = `700 ${subSize}px Montserrat, sans-serif`;
        ctx.fillText('TEST PATTERN', cx, cy - offsetY + titleSize * 1.05);
        ctx.fillStyle = CYAN;
        ctx.font = `600 ${tagSize}px Montserrat, sans-serif`;
        ctx.fillText('ALIGN • FOCUS • COLOR • SCALE', cx, cy - offsetY + titleSize * 1.05 + subSize * 1.2);
    }

    function drawInfoBoxes(ctx, layout, frame) {
        const { contentX, contentY, contentW, w, h, infoW, infoH } = layout;
        const timestamp = frame?.timestamp || 0;
        const motionPlaying = frame?.state?.motionPlaying !== false;
        const aspect = global.OkamiSignalLab?.DisplayMetrics?.formatAspectRatio(w, h) || `${w}:${h}`;

        drawInfoBox(ctx, contentX + 8, contentY + 8, infoW, infoH, 'RESOLUTION', [
            `${w} × ${h}`,
            aspect
        ]);

        const estimator = getRefreshEstimator();
        let hzLabel = 'Estimating…';
        if (estimator) {
            const hz = estimator.update(timestamp);
            hzLabel = hz > 0 ? `~${hz} Hz` : 'Estimating…';
        }

        drawInfoBox(ctx, contentX + contentW - infoW - 8, contentY + 8, infoW, infoH, 'REFRESH', [
            hzLabel,
            motionPlaying ? 'Motion active' : 'Motion paused'
        ]);
    }

    /* ── Orchestrator ── */

    function drawOkamiCalibrationPattern(ctx, w, h, frame) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, w, h);

        const layout = computeLayout(w, h);

        drawColorBars(ctx, layout);
        drawGrayRamps(ctx, layout);
        drawBackgroundGrid(ctx, layout);
        drawRulers(ctx, layout);
        drawSafeAreaGuides(ctx, layout);
        drawAlignmentCrosshair(ctx, layout);
        drawBranding(ctx, layout);
        drawSiemensStars(ctx, layout);
        drawConvergenceGrid(ctx, layout);
        drawMotionZone(ctx, layout, frame);
        drawPixelGridZone(
            ctx,
            layout.contentX + layout.contentW - layout.pixelW - 10,
            layout.contentY + 10,
            layout.pixelW,
            layout.pixelH
        );
        drawSharpnessTests(ctx, layout);
        drawInfoBoxes(ctx, layout, frame);
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.drawOkamiCalibrationPattern = drawOkamiCalibrationPattern;
    global.OkamiSignalLab.CalibrationPattern = {
        computeLayout,
        drawBackgroundGrid,
        drawColorBars,
        drawAlignmentCrosshair,
        drawSafeAreaGuides,
        drawRulers,
        drawGrayRamps,
        drawSharpnessTests,
        drawSiemensStars,
        drawConvergenceGrid,
        drawMotionZone,
        drawBranding,
        drawInfoBoxes,
        drawOkamiCalibrationPattern
    };
})(typeof window !== 'undefined' ? window : globalThis);
