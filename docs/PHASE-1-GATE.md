# Phase 1 Gate — Code Cleanup

**Depends on:** `pre-commercial-phase-1` (Phase 0)

**Goal:** Less duplication, no tool behavior change, commercial still off.

## Completed in this phase

- Admin uses `shared/settings/site-settings.js` for defaults and merge
- Admin visibility page list rendered from `shared/registry/pages.js`
- Signal Lab preview debug overlay off by default (`?debugScale=1` still works)
- `docs/CONTRIBUTING.md` and `docs/SCRIPT-LOAD-ORDER.md` added

## Verify

```bash
node scripts/phase-0-acceptance.mjs
```

Manual:

| Check | Expected |
|-------|----------|
| Admin → Site Visibility | Page list matches registry (7 public pages) |
| Save visibility | Still works with API running |
| Signal Lab | No debug overlay unless `?debugScale=1` |
| Tools | Same behavior as Phase 0 |

## Next phase

Phase 2 — Shared calculations: golden tests, dedupe Signal Lab LED calc with shared module.
