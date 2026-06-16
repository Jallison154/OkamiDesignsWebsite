(function(global) {
    'use strict';

    const MODULE_FAIL_MESSAGE = 'This module failed to load.';

    const guardedRenderers = new WeakMap();

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getModuleLabel(moduleId) {
        const registry = global.OkamiSignalLab?.ModuleRegistry;
        if (!registry || !moduleId) {
            return 'Module';
        }

        const meta = registry.getModuleById(moduleId);
        if (meta?.label) {
            return meta.label;
        }

        const sidebar = registry.getSidebarModules?.().find(
            (entry) => entry.id === moduleId || entry.rendererId === moduleId
        );
        return sidebar?.label || moduleId;
    }

    function formatLoadError(moduleId) {
        return `${MODULE_FAIL_MESSAGE} ${getModuleLabel(moduleId)}`;
    }

    function reportError(moduleId, phase, error) {
        const label = getModuleLabel(moduleId);
        console.error(`[Okami Signal Lab] ${label} (${phase}):`, error);

        const payload = {
            moduleId,
            label,
            phase,
            error,
            message: formatLoadError(moduleId)
        };

        if (typeof global.OkamiSignalLab?.onModuleError === 'function') {
            global.OkamiSignalLab.onModuleError(payload);
        }

        return payload;
    }

    function safeRun(moduleId, phase, fn, fallback) {
        try {
            return fn();
        } catch (error) {
            reportError(moduleId, phase, error);
            if (typeof fallback === 'function') {
                return fallback(error);
            }
            return undefined;
        }
    }

    function drawCanvasError(ctx, width, height, moduleId) {
        if (!ctx) {
            return;
        }

        const w = Math.max(1, width || 1);
        const h = Math.max(1, height || 1);
        const label = getModuleLabel(moduleId);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#140808';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
        ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.004);
        const pad = Math.max(12, Math.min(w, h) * 0.02);
        ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffb4b4';
        ctx.font = `600 ${Math.max(12, Math.min(w, h) * 0.028)}px system-ui, sans-serif`;
        ctx.fillText(MODULE_FAIL_MESSAGE, w / 2, h / 2 - Math.max(8, h * 0.012));

        ctx.fillStyle = 'rgba(255, 180, 180, 0.9)';
        ctx.font = `500 ${Math.max(11, Math.min(w, h) * 0.022)}px system-ui, sans-serif`;
        ctx.fillText(label, w / 2, h / 2 + Math.max(10, h * 0.016));
        ctx.restore();
    }

    function buildPanelErrorHtml(moduleId) {
        return `<div class="signal-lab-module-panel-error" role="alert">${escapeHtml(formatLoadError(moduleId))}</div>`;
    }

    function guardRenderer(renderer, moduleId) {
        if (!renderer) {
            return null;
        }

        if (guardedRenderers.has(renderer)) {
            return guardedRenderers.get(renderer);
        }

        const id = moduleId || renderer.id;
        const guarded = Object.create(renderer);
        guarded.__errorGuarded = true;
        guarded.id = id;

        if (typeof renderer.render === 'function') {
            guarded.render = function renderGuarded(ctx, frame) {
                return safeRun(id, 'render', () => renderer.render(ctx, frame), () => {
                    drawCanvasError(ctx, frame?.width, frame?.height, id);
                });
            };
        }

        if (typeof renderer.onAttach === 'function') {
            guarded.onAttach = function onAttachGuarded(engine) {
                return safeRun(id, 'attach', () => renderer.onAttach(engine));
            };
        }

        if (typeof renderer.onDetach === 'function') {
            guarded.onDetach = function onDetachGuarded(engine) {
                return safeRun(id, 'detach', () => renderer.onDetach(engine));
            };
        }

        if (typeof renderer.onStateChange === 'function') {
            guarded.onStateChange = function onStateChangeGuarded(engine, state, key) {
                return safeRun(id, 'state', () => renderer.onStateChange(engine, state, key));
            };
        }

        if (typeof renderer.handleAction === 'function') {
            guarded.handleAction = function handleActionGuarded(action, context, state) {
                return safeRun(id, 'action', () => renderer.handleAction(action, context, state));
            };
        }

        guardedRenderers.set(renderer, guarded);
        return guarded;
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.ModuleErrorBoundary = {
        MODULE_FAIL_MESSAGE,
        getModuleLabel,
        formatLoadError,
        reportError,
        safeRun,
        drawCanvasError,
        buildPanelErrorHtml,
        guardRenderer
    };
})(typeof window !== 'undefined' ? window : globalThis);
