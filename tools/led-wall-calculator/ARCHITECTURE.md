# LED Video Wall Calculator — Architecture Direction

Product goal: **free web calculator now**, **paid desktop app later** (Electron or Tauri).

---

## Layer model

```
┌─────────────────────────────────────────────────────────┐
│  Web shell (led-wall-visualizer.html, styles.css)       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Web UI (led-wall-visualizer.js)                        │
│  DOM, controls, preview grid, formatting for display      │
└──────────────────────────┬──────────────────────────────┘
                           │ gatherInputs() → computeWallProject()
┌──────────────────────────▼──────────────────────────────┐
│  Calculation layer (led-wall-calculator/)               │
│  Pure functions, serializable inputs, no DOM              │
└─────────────────────────────────────────────────────────┘
```

---

## Calculation API

All functions live on `OkamiLedWallCalculator` and accept plain objects.

| Function | Purpose |
|----------|---------|
| `calculateCabinetResolution()` | Pixels per cabinet from pitch / presets / mesh |
| `calculateWallResolution()` | Total wall pixels from grid |
| `calculatePhysicalSize()` | mm and feet from cabinet + grid |
| `calculateAspectRatio()` | Pixel ratio + nearest standard label |
| `calculateContentOverlay()` | Content-fit rectangle inside wall |
| `calculatePortFill()` | Usable pixels per port at fill % |
| `calculateProcessorPorts()` | Ports required for pixel load |
| `calculateCabinetArtworkType()` | `square` / `tall` / custom preview art |
| `computeWallProject()` | Full snapshot from project inputs |

Constants and presets: `OkamiLedWallCalculator.Constants`.

---

## Project input shape (save/load ready)

```js
{
  displayType, cabinetPreset, pitchPreset,
  cabinetWidthMM, cabinetHeightMM, pixelPitchMM,
  meshPitchHorizontalMM, meshPitchVerticalMM,
  panelsWide, panelsTall,
  pixelWidth, pixelHeight, autoCalculateResolution,
  portCapacity, portFillThreshold,
  overlayFormat, customFormatWidth, customFormatHeight
}
```

Future: persist this JSON for projects, multi-wall arrays, PDF/PNG/SVG export, power/weight calculators, client reports — all call the same layer.

---

## Do / Don't

**Do**
- Add new math in `led-wall-calculator/calculations.js`
- Keep UI formatting (feet/inches labels, preview DOM) in `led-wall-visualizer.js`
- Pass complete input objects into calculation functions

**Don't**
- Put wall math in HTML, CSS, or preview render functions
- Read DOM inside the calculation layer
- Duplicate formulas in Signal Lab or export tools — import this layer instead

---

## Related code

- `tools/signal-lab/engine/led-wall-calculator.js` — Signal Lab metrics module; should converge on this layer over time.
- `tools/signal-lab/modules/led-wall-utilities.js` — canvas preview; uses Signal Lab engine today.
