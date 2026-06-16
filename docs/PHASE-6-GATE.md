# Phase 6 gate — upstream licensing, LED wall I/O, desktop bridge

Phase 6 connects the commercial stack to **external license and update providers**, adds **LED wall save/report** with tier gates, and introduces a **desktop shell bridge** for Electron/Tauri hosts.

## Default (unchanged)

Commercial off = all features unlocked. No upstream calls unless env is configured **and** commercial is on.

## Upstream license server

When `OKAMI_COMMERCIAL_ENABLED=true` and both are set:

```env
OKAMI_LICENSE_SERVER_URL=https://licenses.your-provider.com
OKAMI_LICENSE_API_KEY=server-only-secret
OKAMI_LICENSE_VERIFY_PATH=/verify
```

`POST {OKAMI_LICENSE_SERVER_URL}{OKAMI_LICENSE_VERIFY_PATH}` with JSON:

```json
{ "licenseKey": "...", "productId": "okami-signal-lab" }
```

Header: `Authorization: Bearer {OKAMI_LICENSE_API_KEY}`

Responses are normalized in `server/commercial/license-upstream.js` (supports `valid`/`tier`, `status: active`, `plan`, nested `license` objects).

Dev key (`OKAMI_LICENSE_DEV_ACCEPT_KEY`) is still checked first. Tier is configurable via `OKAMI_LICENSE_DEV_ACCEPT_TIER`.

## Update feed

```env
OKAMI_UPDATE_FEED_URL=https://updates.example.com/okami/manifest.json
```

Expected JSON (per channel or flat):

```json
{
  "web": { "latestVersion": "1.1.0", "updateUrl": "...", "releaseNotesUrl": "..." },
  "desktop": { "latestVersion": "1.0.1", "updateUrl": "..." }
}
```

## LED wall calculator

New actions in the sidebar footer:

| Action | Feature key | Minimum tier |
|--------|-------------|--------------|
| **Save Project** | `ledWall.saveProject` | Standard |
| **Export Report** | `ledWall.exportReport` | Standard |

Implementation: `tools/led-wall-calculator/project-io.js` (JSON project + plain-text report).

## Desktop shell bridge

`client/desktop/shell-bridge.js` detects `window.okamiDesktop` (or `?desktop` query) and exposes:

- `OkamiDesktopShell.isDesktopShell()`
- `OkamiDesktopShell.initDesktopShell({ productId, checkUpdates })`
- `OkamiDesktopShell.checkForUpdates()` → `/api/commercial/version?channel=desktop`

Desktop hosts should inject:

```js
window.okamiDesktop = {
  isDesktop: () => true,
  getVersion: () => '1.0.0',
  productId: 'okami-signal-lab'
};
```

## Tests

```bash
npm run test:gate              # includes license-upstream unit tests
npm run test:commercial        # includes mock upstream provider
npm run test:license-upstream
```

## Next (Phase 7+)

- Load Project from saved JSON
- Account OAuth / magic links
- Desktop offline entitlement cache
- Production legal pages
