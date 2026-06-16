# Okami Signal Lab — Architecture Direction

Product goal: **free web tool now**, **paid desktop app later** (Electron or Tauri).
Build Signal Lab as a **reusable app**, not a website widget.

---

## Layer model

```
┌─────────────────────────────────────────────────────────┐
│  Web shell (tools/signal-lab.html, styles.css)            │
│  Website nav, SPA init, construction/visibility guards    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Web UI adapter (tools/signal-lab/app.js)               │
│  DOM, controls, module list, status, pop-out/snapshot   │
│  Must NOT contain canvas drawing or pattern math          │
└──────────────────────────┬──────────────────────────────┘
                           │ reads/writes shared state
┌──────────────────────────▼──────────────────────────────┐
│  Shared state (outputState shape — see output-state.js)  │
│  activeModuleId, moduleState{}, outputSettings{}, clock   │
│  Portable to desktop; no DOM references                 │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Core engine (tools/signal-lab/engine/)                   │
│  RenderEngine, pattern resolution, export, audio, sync    │
│  Canvas-only; accept state + timestamp in, pixels out     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Feature modules (tools/signal-lab/modules/)              │
│  Patterns, motion, branding, sync, LED utilities, etc.    │
│  registerRenderer(); render(ctx, frame); getControlSchema │
└─────────────────────────────────────────────────────────┘

Separate surfaces (same core, different hosts):
  • Main preview canvas     — app.js + RenderEngine
  • Output / pop-out view   — signal-lab-output.* (future: dedicated window)
  • Export pipeline         — pattern-exporter.js (offscreen render)
  • Audio                   — audio-engine.js, sync-audio.js
```

---

## Folder responsibilities

| Path | Role | Desktop-portable? |
|------|------|-------------------|
| `engine/render-engine.js` | HiDPI canvas, pattern buffer, scale-to-fit | Yes |
| `engine/pattern-resolution.js` | Output/pattern size presets | Yes |
| `engine/okami-calibration-pattern.js` | Canvas drawing sections | Yes |
| `engine/pattern-exporter.js` | High-res PNG/JPG export | Yes |
| `engine/audio-engine.js` | Web Audio tones/noise | Yes (Web Audio in Electron) |
| `engine/sync-audio.js` | AV sync click synth | Yes |
| `engine/output-state.js` | Canonical state snapshot + apply | Yes |
| `engine/control-utils.js` | Numeric clamp/display helpers | Yes |
| `engine/screen-placement.js` | Multi-monitor (browser API) | Web-only adapter; replace in desktop |
| `modules/*.js` | Feature plugins + pattern definitions | Mostly yes |
| `modules/registry.js` | Module catalog | Yes |
| `app.js` | **Web UI only** | Replace with desktop UI shell |
| `../signal-lab-output.*` | **Output window host** | Replace with Electron `BrowserWindow` |

---

## Shared state contract

Future desktop and web hosts should share this shape (see `OutputState.buildOutputState`):

```js
{
  activeModuleId: string,
  moduleState: { [moduleId]: { ...settings } },  // includes logo dataURLs
  outputSettings: {
    patternResolution, patternWidth, patternHeight, scaleMode, ...
  },
  animation: { motionTime, syncedWallAt, ... },  // clock sync for output window
  sentAt: number
}
```

Rules:
- **State is data**, not live DOM or engine instances.
- Host applies state → engine → render frame.
- Logo/images stay as `dataURL` strings in state (portable, serializable).

---

## Module plugin contract

Each module in `modules/` should:

- Export `render(ctx, frame)` — canvas only, no `document`
- Export `getControlSchema()` — UI host maps schema to native controls
- Optional: `shouldAnimate`, `onAttach`, `onDetach`, `onStateChange`
- Register via `ModuleRegistry.registerRenderer(id, module)`

Avoid in modules:
- Direct `document.getElementById` (move DOM side effects to web UI adapter)
- Hard-coded website strings/layout
- Assuming a specific canvas size without using `frame.width` / `frame.height`

---

## Do / Don't (ongoing development)

**Do**
- One small change at a time; test main preview after each change
- Add drawing logic under `engine/` or `modules/`, not `app.js`
- Pass settings through `moduleState` / `outputSettings`
- Keep pop-out/output as a thin host that reuses `RenderEngine` + state
- Gate browser APIs (`getScreenDetails`, `BroadcastChannel`) in adapter layers

**Don't**
- Put pattern math or canvas draws in `app.js` or HTML inline scripts
- Couple renderer to Okami website CSS class names
- Store settings only in DOM input values without mirroring to state
- Large refactors without explicit request
- Quick fixes that duplicate render paths ( caused pop-out drift — use one apply + render path when re-enabled )

---

## Desktop migration (future, not now)

| Web today | Desktop target |
|-----------|----------------|
| `app.js` | Main window UI (Tauri/Electron) |
| `signal-lab-output.html` | Dedicated output `BrowserWindow` |
| `screen-placement.js` | OS display APIs |
| `localStorage` / none | File-based presets, user data dir |
| Free tools page | Licensed pro build, offline bundle |

Core package to extract later: `engine/` + `modules/` + state types → npm/local package imported by both web and desktop hosts.

---

## Current checkpoint

Tag: `signal-lab-checkpoint` — stable web preview, snapshot pop-out, modular engine in place.
Re-enable live output sync as a **small, isolated change** to the output host only — do not rewrite `app.js` render loop.
