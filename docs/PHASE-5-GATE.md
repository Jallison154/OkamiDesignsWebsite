# Phase 5 gate — license session persistence and more gates

Phase 5 adds **signed HttpOnly license cookies** so activation survives page reloads, plus additional Signal Lab gates for pop-out sync and premium patterns.

## Default (unchanged)

Commercial off = all features unlocked. No cookies set. No behavior change.

## Staging

Same env as Phase 4:

```env
OKAMI_COMMERCIAL_ENABLED=true
OKAMI_CLIENT_COMMERCIAL_UI=true
OKAMI_LICENSE_DEV_ACCEPT_KEY=your-staging-secret
OKAMI_SESSION_SECRET=long-random-string-for-production
```

Activate once in the License panel — reload the page — entitlements should remain **standard** tier until **Sign out**.

## New API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/commercial/entitlements` | Validates key and sets `okami_license` cookie on success |
| `POST /api/commercial/license/clear` | Clears license cookie (sign out) |

Cookie is HMAC-signed with `OKAMI_SESSION_SECRET` (dev fallback when unset in local staging only).

## Gated features (when commercial on)

| Feature key | Gated capability |
|-------------|------------------|
| `signalLab.exportBatch` | JPG, 4K, 8K, custom export (Phase 4) |
| `signalLab.popoutLiveSync` | Pop Out, Update Pop-Out, Pop Out Fullscreen |
| `signalLab.premiumPatterns` | Motion: Figure 8, Siemens Star, Rotating Logo; Video: SMPTE bars, grayscale ramp, pixel grid, resolution |

Premium patterns fall back to a basic pattern when not licensed (no hard error).

## Tests

```bash
npm run test:gate
npm run test:commercial   # includes cookie persistence + clear
```

## Next (Phase 6+)

- Upstream license provider (`verifyWithUpstream`)
- LED wall save/report gates when those UI actions ship
- Desktop shell + offline token exchange
- Account OAuth / magic links
