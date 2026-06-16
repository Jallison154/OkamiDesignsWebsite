# Script load order

Public pages must load shared modules **before** `site-visibility.js`. Use explicit `<script>` tags (not dynamic injection).

## Site root pages

`home.html`, `services.html`, `support.html`, `contact.html`, `index.html`, `page-template.html`, `admin.html`:

```html
<script src="shared/settings/site-settings.js"></script>
<script src="shared/registry/pages.js"></script>
<script src="shared/visibility/access-policy.js"></script>
<script src="page-registry.js"></script>
<script src="site-visibility.js"></script>
<script src="analytics-tracker.js"></script>
<script src="site-layout.js"></script>
<script src="script.js"></script>
```

Admin pages omit visibility/analytics/site-layout unless needed:

```html
<script src="shared/settings/site-settings.js"></script>
<script src="shared/registry/pages.js"></script>
<script src="shared/visibility/access-policy.js"></script>
<script src="page-registry.js"></script>
<!-- admin scripts -->
```

## Tool pages

`tools/*.html` — same block with `../` prefix:

```html
<script src="../shared/settings/site-settings.js"></script>
<script src="../shared/registry/pages.js"></script>
<script src="../shared/visibility/access-policy.js"></script>
<script src="../page-registry.js"></script>
<script src="../site-visibility.js"></script>
<script src="../analytics-tracker.js"></script>
<script src="../site-layout.js"></script>
<script src="../script.js"></script>
<!-- tool-specific scripts below -->
<script src="led-wall-calculator/constants.js"></script>
<script src="led-wall-calculator/calculations.js"></script>
<script src="led-wall-calculator/metrics.js"></script>
```

Signal Lab additionally loads the adapter shim after shared calculator scripts:

```html
<script src="../led-wall-calculator/constants.js"></script>
<script src="../led-wall-calculator/calculations.js"></script>
<script src="../led-wall-calculator/metrics.js"></script>
<script src="signal-lab/engine/led-wall-calculator.js"></script>
```

## Commercial client (Phase 4+ only)

Do **not** load on tool pages until licensing is ready:

```html
<script src="client/commercial/commercial-client.js"></script>
<script src="client/commercial/commercial-ui.js"></script>
```

## SPA navigation

`script.js` skips re-loading bootstrap and shared scripts when navigating client-side. Tool scripts load per destination page.

## `page-registry.js`

Validation shim only. It logs an error if shared registry scripts were omitted.
