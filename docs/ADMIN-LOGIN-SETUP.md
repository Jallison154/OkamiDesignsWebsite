# Admin login setup

The admin panel (`/admin.html`) authenticates through the Node API. The server **never** reads passwords from frontend code or `localStorage`. Credentials come from environment variables only.

## Required variables (production)

| Variable | Purpose |
|----------|---------|
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of your admin password |
| `ADMIN_SESSION_SECRET` | Long random string used to sign admin session cookies |

Optional: `ADMIN_SESSION_MAX_AGE_MS` (default `1800000` = 30 minutes).

## 1. Generate a password hash

From the project root:

```bash
node scripts/generate-admin-password-hash.cjs "your-secure-password"
```

Example output:

```text
Add to your server environment (.env or host config):
ADMIN_PASSWORD_HASH=$2b$12$...
ADMIN_SESSION_SECRET=a1b2c3d4e5...
```

The script prints both values. **Do not commit the password or the `.env` file.**

## 2. Create `.env`

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
NODE_ENV=production
PORT=3000

# Single quotes required — bcrypt hashes contain $ characters
ADMIN_PASSWORD_HASH='$2b$12$paste_hash_from_generator_here'
ADMIN_SESSION_SECRET=paste_secret_from_generator_here
```

The server loads `.env` from the project root inside Docker (`/app/.env` via volume mount).

## Production server (`/opt/okami-designs`)

```bash
cd /opt/okami-designs
node scripts/generate-admin-password-hash.cjs "your-secure-password"
nano .env   # paste output — keep single quotes on ADMIN_PASSWORD_HASH
docker compose restart okami-designs-api
docker logs okami-designs-api --tail 20   # expect: Admin login configured
curl -s https://www.okamidesigns.com/api/admin/setup-status
```

`setup-status` returns `configured: true` when ready (no secrets exposed).

## 3. Restart the server

After changing environment variables:

```bash
npm start
```

Or with nodemon:

```bash
npm run dev
```

**Docker Compose:**

```bash
docker compose down
docker compose up -d
```

Ensure `docker-compose.yml` mounts the project directory (default). The API container reads `.env` from that mount — you do **not** need `env_file:` in Compose (missing files cause deploy errors).

```bash
cp .env.example .env
# edit .env, then:
docker compose down && docker compose up -d
```

Or run: `sh scripts/ensure-env.sh` to create `.env` from `.env.example` if missing.

**Cloudflare Tunnel:** restart `cloudflared` only if you changed the tunnel target or the process behind it is not running. If the Node app restarted on the same port, the tunnel usually does not need a restart.

```bash
# Linux systemd example
sudo systemctl restart okami-designs
sudo systemctl restart cloudflared   # only if needed
```

## 4. Verify

1. Open `/admin.html` and sign in with the **plain password** you hashed (not the hash itself).
2. Check server logs for: `✅ Admin login configured`
3. Optional: `GET /api/health` should include `"admin": { "configured": true }`

If login returns **“Admin login is not configured on the server.”**, the API returned `503` with `admin_auth_not_configured` — `ADMIN_PASSWORD_HASH` and/or `ADMIN_SESSION_SECRET` are missing or `.env` was not loaded.

## Local development fallback

When `NODE_ENV` is **not** `production`, you may use a dev-only shortcut instead of a bcrypt hash:

```env
NODE_ENV=development
ADMIN_DEV_PASSWORD=your-local-dev-password
```

Rules:

- Used **only** when `NODE_ENV !== "production"`
- Never enabled in production, even if `ADMIN_DEV_PASSWORD` is set
- Password stays server-side; the browser never receives it
- A fixed development session secret is used if `ADMIN_SESSION_SECRET` is unset

For anything shared or deployed, use `ADMIN_PASSWORD_HASH` + `ADMIN_SESSION_SECRET` instead.

## Production / deploy checklist

- [ ] `NODE_ENV=production`
- [ ] `ADMIN_PASSWORD_HASH` set (bcrypt hash, not plain text)
- [ ] `ADMIN_SESSION_SECRET` set (unique per environment)
- [ ] `.env` present on the server **or** the same variables set in Docker / systemd / hosting panel
- [ ] `.env` is **not** committed to git
- [ ] App restarted after env changes
- [ ] Cloudflare Tunnel points at `http://127.0.0.1:3000` (Node app root)

## Security notes

- Login is rejected with `503` when auth is not configured — no bypass.
- Wrong password returns `401` (`invalid_credentials`).
- Session cookie is `HttpOnly`, `SameSite=Strict`, and `Secure` in production.
- Rotate `ADMIN_SESSION_SECRET` if you suspect compromise (invalidates existing admin sessions).
