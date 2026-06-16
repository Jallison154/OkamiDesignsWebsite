# Phase 0 Gate — Stabilize & Document

**Purpose:** Lock a known-good baseline before commercial Phase 1 (code cleanup).

**Checkpoint tag:** `pre-commercial-phase-1`

## Run acceptance tests

```bash
node server.js
# separate terminal:
node scripts/phase-0-acceptance.mjs
```

Optional custom base URL:

```bash
node scripts/phase-0-acceptance.mjs http://localhost:3001
```

## Manual checks (recommended once per release)

| Check | URL / action | Expected |
|-------|----------------|----------|
| Signal Lab loads | `/tools/signal-lab.html` | Calibration pattern visible; status shows ready |
| Controls live | Change pattern / slider | Preview updates |
| Sidebar scroll | Scroll controls panel | All buttons reachable at bottom |
| LED calculator | `/tools/led-wall-visualizer.html` | Summary updates after chip selection |
| SPA nav | Home → Tools → Signal Lab via nav | Page loads without full reload errors |
| Commercial off | Browser console | No blocking errors from `/api/commercial/*` |

## Baseline flags (must stay off until Phase 4)

- `client/commercial/commercial-client.js` → `COMMERCIAL_ENABLED = false`
- `client/commercial/commercial-ui.js` → `COMMERCIAL_UI_AUTO_INIT = false`
- `.env` → `OKAMI_COMMERCIAL_ENABLED=false` (or unset)

## Rollback

```bash
git checkout pre-commercial-phase-1
```

## Next phase

See root planning doc / Phase 1 in commercial roadmap: code cleanup (admin settings dedupe, debug overlay off, docs sync).
