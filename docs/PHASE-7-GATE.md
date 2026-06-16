# Phase 7 gate — load project, offline cache, account stub

Phase 7 extends desktop-ready workflows: **load saved LED projects**, **offline entitlement cache** for desktop shells, and a **magic-link account stub** for staging sign-in UI.

## Default (unchanged)

Commercial off = all features unlocked. No magic-link endpoint unless stub env is set. Offline cache is passive until entitlements are fetched successfully.

## LED wall — Load Project

| Action | Feature key | Minimum tier |
|--------|-------------|--------------|
| **Load Project** | `ledWall.saveProject` | Standard (same as Save) |

- Accepts `.json` files saved by **Save Project**
- Validates product id and schema version
- Restores all calculator inputs and refreshes preview

## Desktop offline entitlement cache

`client/commercial/offline-cache.js` stores config + entitlements in `localStorage` (7-day TTL).

- Written after successful `/api/commercial/config` and `/api/commercial/entitlements`
- On network failure: desktop shell prefers cached entitlements; web uses cache only when commercial gating is active
- Cleared on license sign-out (`clearLicense`)

Desktop hosts should load scripts in order:

```html
<script src="client/commercial/offline-cache.js"></script>
<script src="client/commercial/commercial-client.js"></script>
<script src="client/desktop/shell-bridge.js"></script>
```

## Account magic link (stub)

Staging only:

```env
OKAMI_COMMERCIAL_ENABLED=true
OKAMI_ACCOUNT_MAGIC_LINK_STUB=true
```

`POST /api/commercial/account/magic-link` with `{ "email": "user@example.com" }` returns `{ ok: true, stub: true }` — **no email is sent**.

Production: wire `OKAMI_ACCOUNT_SERVICE_URL` and replace the stub in `server/commercial/account-magic-link-stub.js`.

## Tests

```bash
npm run test:project-io
npm run test:gate
npm run test:commercial   # optional: enable OKAMI_ACCOUNT_MAGIC_LINK_STUB in staging script
```

## Next (Phase 8+)

- Production legal page content
- Real OAuth / magic-link provider integration
- Desktop secure storage (OS keychain) instead of localStorage
- Project library / multi-wall saves
