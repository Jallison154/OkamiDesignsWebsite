# Adding & updating projects

Every project on the site (the cards on `/tools`, Featured Projects on the homepage, and
the detail pages at `/projects/<slug>`) comes from one of three places:

| Source | Where the content lives | Use it for |
|---|---|---|
| **Markdown file** | `projects/<slug>.md` | Anything you want to describe on the site: in-repo tools, external apps, hardware, write-ups |
| **Portainer** | Docker labels on a container | Self-hosted apps. They appear automatically and show live Online/Offline status |
| **Admin (manual)** | Admin → Tools tab | Quick one-off links. Prefer a Markdown file so it's versioned in git |

The admin Tools tab still controls **publish/hide, homepage featuring, and order** for every
project, whatever its source. Content (text, links, images) is edited at the source.

---

## 1. Add a project with a Markdown file

1. Copy `projects/_TEMPLATE.md` to `projects/<slug>.md`. The file name becomes the URL slug.
2. Fill in the front matter (see the reference below).
3. Write the detail page in Markdown under the front matter. If the file has body text, the
   project gets a page at `/projects/<slug>`.
4. Put images in `projects/assets/` and refer to them by file name (`icon: my-tool.svg`).
5. Commit and deploy. No other files need to change.

To **update** a project, edit its file: bump `version`, add a changelog line, change `status`.

### Front-matter reference

| Key | Example | Notes |
|---|---|---|
| `title` | `DMX Patch Planner` | Required |
| `summary` | `Plan DMX universes…` | Card text (1–2 sentences) |
| `category` | `Calculator` | Card eyebrow label |
| `url` | `/tools/dmx-patch-planner` or `https://…` | Main button target. If omitted, it links to the detail page |
| `button` | `Open tool →` | Button text |
| `status` | `live` · `beta` · `alpha` · `coming-soon` · `archived` | Non-live statuses show a badge |
| `version` | `0.3.0` | Shown as a `v0.3.0` chip |
| `featured` | `true` | Show in Featured Projects on the homepage |
| `order` | `10` | Lower comes first (until an admin reorders) |
| `icon` | `dmx.svg` · `/images/x.png` · `https://…` | Card image. A bare name means `projects/assets/` |
| `websiteLogo` | `true` | Fetch the logo from the `url` website instead (cached 7 days) |
| `hero` | `dmx-hero.png` | Large image on the detail page |
| `tags` | `[Lighting, DMX]` | Shown on the detail page |
| `features` | block list | Bullet list on the detail page |
| `screenshots` | block list | Gallery on the detail page |
| `repo` | `owner/repo` | Adds a "Source code" link |
| `support` | `/support` | Adds a "Get support" link |
| `newTab` | `true` | Open `url` in a new tab (default for `https://` links) |
| `detailPage` | `false` | Force the detail page off (or `true` to force it on) |
| `listOnToolsPage` | `false` | Homepage only, not on `/tools` |
| `hidden` | `true` | Keep the file but don't publish it |
| `pageKey` | `ledVideoWallCalculator` | Only for tools registered in `shared/registry/pages.js` |
| `id` | `okami-signal-lab` | Only needed to keep an existing id; defaults to the slug |

Files starting with `_` are ignored. Use that for drafts.

---

## 2. Add a new in-repo tool (an interactive page on this site)

1. Create `tools/<slug>/index.html` (start from `page-template.html`). It's served at
   `/tools/<slug>` automatically.
   - Use **absolute** asset paths: `/styles.css`, `/tools/<slug>/app.js`.
   - Include the [standard script block](SCRIPT-LOAD-ORDER.md).
   - Keep logic in `tools/<slug>/engine/` and UI in `tools/<slug>/app.js` (see CONTRIBUTING layer rules).
2. Add `projects/<slug>.md` with `url: /tools/<slug>` so it gets a card.
3. Only if the tool needs admin visibility toggles or analytics as its own page, register it in
   `shared/registry/pages.js` as well.

---

## 3. Show a Portainer container on the site

Add labels to the container (compose file or Portainer → container → Labels) and redeploy.
The site checks Portainer every 5 minutes, or press **Sync now** from the admin API.

```yaml
services:
  show-control:
    image: ghcr.io/you/show-control:1.4.2
    labels:
      okami.public: "true"                        # REQUIRED: opt in to the public site
      homepage.name: Show Control
      homepage.description: Live cue status for the rig.
      homepage.href: https://show.okamidesigns.com
      homepage.group: Apps                        # category label
      homepage.icon: grafana.svg                  # dashboard-icons name, /path, or https:// URL
      # Optional okami.* labels (override homepage.* if both are set)
      # okami.featured: "true"
      # okami.status: beta
      # okami.slug: show-control
      # okami.details: "Markdown shown on /projects/show-control"
      # okami.button: "Open dashboard →"
      # okami.order: "20"
```

- The `homepage.*` labels are the same ones the [Homepage](https://gethomepage.dev) dashboard
  reads, so one set of labels can drive a private dashboard and the public site.
- **Only containers with `okami.public=true` are ever shown.** Databases, Portainer itself, and
  anything else unlabelled stay private.
- Only `http(s)://` links are used. Internal IPs and ports are never shown unless you put them in a label.
- Version comes from `org.opencontainers.image.version` or the image tag.
- Running containers show **Online**, unhealthy shows **Degraded**, stopped shows **Offline**.
  Removed containers are hidden but remembered for 30 days, so your admin settings survive a redeploy.
- Swarm services: put the labels under `labels:` (container labels), not `deploy.labels:`.

### Connecting the site to Portainer (one-time)

1. In Portainer create a user with **read-only** access to the environments you want listed.
2. Log in as that user → My account → Access tokens → create a token.
3. In the website's `.env`:
   ```
   PORTAINER_URL=http://<portainer-host>:9000
   PORTAINER_API_KEY=<token>
   ```
   Optional: `PORTAINER_ENDPOINT_IDS`, `PORTAINER_SYNC_INTERVAL_MS`, `PORTAINER_PUBLIC_LABEL` (see `.env.example`).
4. Restart the API container. The log shows `🐳 Portainer sync enabled`.

Admin endpoints: `GET /api/tools/sources` (sync status) and `POST /api/tools/portainer/sync` (sync now).

---

## Prompts for new Claude sessions

**New tool built into the site:**

```
Add a new tool to the Okami Designs site: <name>: <one-line description>.
Follow docs/ADDING-A-PROJECT.md section 2 exactly:
- Build it in tools/<slug>/ (index.html served automatically at /tools/<slug>, absolute asset paths).
- Add projects/<slug>.md for its card and detail page (status: beta, version: 0.1.0).
- Don't edit shared catalog/registry files unless the doc says it's required.
- Follow the layer rules in docs/CONTRIBUTING.md and run `npm run test:gate` before committing.
```

**Add or describe an external project / app:**

```
Add a project card to the Okami Designs site for <name> (<url>): <description>.
Create projects/<slug>.md per docs/ADDING-A-PROJECT.md section 1. No other files.
```

**Update an existing project:**

```
Update the <name> project on the Okami Designs site: <what changed>.
Edit projects/<slug>.md only: bump version, add a changelog entry, adjust status/summary.
```

---

## How it works (for maintainers)

- `server/projects/markdown-projects.js` reads `projects/*.md`.
- `server/projects/portainer-sync.js` polls Portainer and caches results in `files/portainer-projects.json`.
- `server/tools/catalog-service.js` merges both with admin entries from `files/tools.json`.
  For file/Portainer projects, `tools.json` holds only a stub
  `{ id, source, overrides }`, and overrides only record values an admin changed, so source edits keep working.
- `files/projects-public.json` is a public snapshot used as the browser fallback when the API is down.
- Tests: `npm run test:projects`.
