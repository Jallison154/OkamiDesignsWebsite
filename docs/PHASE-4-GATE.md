# Phase 4 gate — licensing integration (staging)

Phase 4 wires server-driven commercial config, client gating helpers, and the first premium gates in Signal Lab **without changing behavior when commercial is off**.

## Default (production-safe)

| Setting | Value | Effect |
|---------|-------|--------|
| `OKAMI_COMMERCIAL_ENABLED` | `false` (or unset) | Server returns professional tier / all features |
| `OKAMI_CLIENT_COMMERCIAL_UI` | `false` (or unset) | No license panel or upgrade UI |
| Client `COMMERCIAL_UI_AUTO_INIT` | `false` | No auto footer on public pages |

**Acceptance:** All tools work as before. No license errors in the console. PNG 1080p exports work.

## Staging (enable gating locally)

```bash
# .env
OKAMI_COMMERCIAL_ENABLED=true
OKAMI_CLIENT_COMMERCIAL_UI=true
OKAMI_LICENSE_DEV_ACCEPT_KEY=your-staging-secret
```

Restart the server, open Signal Lab, expand **License** in the header, and activate with the dev key.

### Gated features (Signal Lab export module)

When `OKAMI_COMMERCIAL_ENABLED=true`:

- **Free:** PNG at 1080p and below
- **Blocked without `signalLab.exportBatch`:** JPG, 4K, 8K, custom resolution exports

Dev accept key grants **standard** tier (LED wall save/report, not batch export). Use a future professional license path for full export access.

## Tests

```bash
npm run test:gate              # commercial OFF — must pass (no behavior change)
npm run test:commercial        # commercial ON in-process — tier + verify flows
```

## Files added / changed

- `client/commercial/commercial-gate.js` — `canUseFeature`, `checkExportAllowed`, `initForProduct`
- `client/commercial/commercial-client.js` — server-driven `isGatingActive` / `isUiActive`
- `client/commercial/license-panel.js` — staging license activation UI
- `server/commercial/routes.js` — `clientCommercialUiEnabled`, `featureGatingEnabled` in `/api/commercial/config`
- `tools/signal-lab/modules/pattern-export.js` — export gate on download
- `tools/signal-lab.html` — loads shared commercial scripts

## Next (Phase 5+)

- Persist activated license in signed session cookie
- Upstream license provider in `verifyWithUpstream`
- Gate additional modules (pop-out live sync, premium patterns, LED wall reports)
- Desktop shell integration
