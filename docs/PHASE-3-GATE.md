# Phase 3 Gate — Server API Hardening

**Depends on:** Phase 2 complete

**Goal:** Production-ready API surface; admin mutations protected; commercial routes tested.

## Completed

- `server/config/app-config.js` — `NODE_ENV`, CORS allowlist, analytics rate limits
- `server/middleware/cors.js` — permissive in dev, allowlist in production
- `server/middleware/admin-auth.js` — `requireAdmin` via `okami_admin` cookie
- `server/middleware/rate-limit.js` — in-memory limit on `POST /api/analytics/view`
- Admin-only: `PUT /api/site-settings`, file upload/delete/replace, `GET /api/analytics`, `POST /api/analytics/reset`
- Public: `GET /api/site-settings`, `GET /api/files`, `POST /api/analytics/view`, all `/api/commercial/*`
- Enhanced `GET /api/health` — version + commercial enabled flag
- Commercial env validation on startup (warns; `OKAMI_COMMERCIAL_STRICT=true` to fail)
- `scripts/api-integration-tests.mjs` — in-process server tests

## Verify

```bash
npm run test:api
npm run test:gate
```

Restart your dev server after pulling so admin protection is active.

## Admin API

Mutating admin routes require a valid `okami_admin_session` httpOnly cookie from `POST /api/admin/login`. Public site reads (settings, files, analytics view recording) stay open.

## Environment

See `.env.example` for `OKAMI_CORS_ALLOWED_ORIGINS`, rate limits, and commercial vars.

## Next phase

Phase 4 — Licensing integration (enable flags in staging only).
