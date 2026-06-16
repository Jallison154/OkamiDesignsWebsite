# Phase 2 Gate — Shared Calculations

**Depends on:** Phase 1 complete (`pre-commercial-phase-1` or later)

**Goal:** One canonical LED calculation layer; golden tests; Signal Lab uses shared metrics.

## Completed

- `tools/led-wall-calculator/metrics.js` — `calculateLedWall`, aspect helpers, scaling warnings
- Signal Lab shim re-exports shared metrics (no duplicate math in engine)
- `scripts/led-wall-golden-tests.mjs` — 6 golden cases
- `npm run test:calculations` and `npm run test:gate`

## Verify

```bash
npm run test:calculations
npm run test:gate
# or with server running:
node scripts/phase-0-acceptance.mjs
```

Manual:

| Check | Expected |
|-------|----------|
| LED calculator | Same results as before (10×6 P2.6 → 1920×1152, 4 ports) |
| Signal Lab → LED Wall utilities module | Metrics + warnings update live |

## Script load order (Signal Lab)

```html
<script src="../led-wall-calculator/constants.js"></script>
<script src="../led-wall-calculator/calculations.js"></script>
<script src="../led-wall-calculator/metrics.js"></script>
<script src="signal-lab/engine/led-wall-calculator.js"></script>
```

## Next phase

Phase 3 — Optional server API hardening (integration tests, CORS, env validation).
