# Contributing to Okami Designs

## Layer rules

Keep business logic in the right layer. This prevents licensing secrets from leaking and lets tools run on web and desktop.

| Layer | Path | Put here |
|-------|------|----------|
| **UI** | `tools/*/app.js`, `*-visualizer.js`, HTML | DOM, events, preview wiring, layout |
| **Shared** | `shared/`, `tools/*/engine/`, `tools/led-wall-calculator/` | Pure math, page registry, settings merge, visibility policy |
| **Server** | `server.js`, `server/commercial/` | Secrets, license verify, entitlements, file API |

**Do not** put license keys, API secrets, or validation logic in browser code.

## Adding a public page

1. Create the HTML file.
2. Register it in `shared/registry/pages.js` (`PUBLIC_PAGES`).
3. Add the [standard script block](SCRIPT-LOAD-ORDER.md) before `site-visibility.js`.
4. Admin visibility toggles and analytics pick it up automatically from the registry.

## Adding a tool

1. Put portable logic in `engine/` or `led-wall-calculator/`-style modules.
2. Keep UI in `app.js` or `*-visualizer.js`.
3. Register the tool page in `shared/registry/pages.js` with a `productId` when commercial metadata applies.
4. Use `full-height-tool` on `main` for full-viewport tool layouts.

## Commercial / licensing

Commercial features are **off by default**. See `ARCHITECTURE-COMMERCIAL.md` and `docs/PHASE-0-GATE.md`.

Do not enable `COMMERCIAL_ENABLED`, `COMMERCIAL_UI_AUTO_INIT`, or `OKAMI_COMMERCIAL_ENABLED` until Phase 4 of the commercial roadmap.

## Tests before opening a PR

```bash
node server.js
node scripts/phase-0-acceptance.mjs
npm run test:calculations
npm run test:api
npm run test:gate
```

Manual smoke: Signal Lab preview, LED calculator summary, admin visibility save (with API running and admin logged in).

## Checkpoint tags

- `pre-commercial-phase-1` — Phase 0 baseline (tools working, commercial scaffold inert)

## Calculation tests

Golden tests for LED wall math:

```bash
npm run test:calculations
```
