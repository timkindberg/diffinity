# Diffinity

Semantic DOM diffing engine for visual regression testing. Unlike pixel-diff tools that compare screenshots, diffinity captures the DOM tree with computed styles, matches elements across before/after states using heuristic scoring, and produces human-readable diffs ranked by visual importance.

## What makes it different

**Pixel diff tools** (Percy, Chromatic, BackstopJS) compare screenshots and highlight changed pixels. They can't tell you *what* changed or *why* — a 1px border change and a complete layout reflow look the same.

**Diffinity** captures the DOM manifest (element tree with ~90 computed styles, bounding boxes, accessible names) and runs a semantic diff pipeline:

1. **Match** — pairs elements across before/after using identity signals (test IDs, roles, accessible names, text, classes, ancestor paths)
2. **Diff** — compares matched pairs with magnitude-aware scoring (color distance with alpha, pixel deltas, property dominance, area weighting)
3. **Consolidate** — suppresses descendant noise, collapses identical changes into groups, clusters layout-shift cascades
4. **Report** — interactive HTML report with side-by-side views, element highlighting, keyboard navigation

The result: "Header background changed from `#1a1a2e` to `#2d2d44` (major)" instead of "312 pixels differ."

## Install

```bash
npm install diffinity
npx playwright install chromium  # peer dependency
```

## Quick start

```ts
import { chromium } from 'playwright'
import { capture, compare } from 'diffinity'

const browser = await chromium.launch()
const page = await browser.newPage()

// You own the browser, auth, navigation, and "page is ready" logic.
// Diffinity receives a ready Page object.

// Capture "before" state
await page.goto('https://your-app.test')
await capture(page, {
  outputDir: './vr',
  label: 'before',
  pageId: 'home',
})

// ... make changes (deploy, toggle feature flag, etc.) ...

// Capture "after" state
await page.goto('https://your-app.test')
await capture(page, {
  outputDir: './vr',
  label: 'after',
  pageId: 'home',
})

// Compare and generate report
await compare('./vr/before', './vr/after')
// Opens: ./vr/index.html

await browser.close()
```

## CLI

Compare existing capture directories without writing code:

```bash
npx diffinity compare ./vr/before ./vr/after
```

Options:

```
npx diffinity compare <before-dir> <after-dir> [options]

Options:
  --report-dir <dir>   Directory to write the report (default: parent of before-dir)
  --widths <widths>    Comma-separated viewport widths (default: auto-detected)
  --help               Show this help message

Exit codes:
  0  No changes detected
  1  Changes detected
```

The exit code makes it easy to use in CI:

```bash
npx diffinity compare ./vr/before ./vr/after || echo "Visual changes detected"
```

## API Reference

### `capture(page, options)`

Capture a DOM manifest and self-contained HTML snapshot from a Playwright page.

```ts
import type { Page } from 'playwright'

capture(page: Page, options: CaptureOptions): Promise<CaptureResult>
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputDir` | `string` | *required* | Directory to write capture output |
| `label` | `string` | *required* | Label for this capture (e.g. `'before'`, `'after'`) |
| `pageId` | `string` | *required* | Unique page identifier (used in directory names) |
| `widths` | `number[]` | `[1280]` | Viewport widths to capture |

**What it does:**

1. Waits for DOM stability (no mutations for 1 second)
2. Freezes JS timers and animations
3. Captures DOM manifest (~90 computed styles, bounding boxes, accessible names per element)
4. Captures self-contained HTML via JSON DOM reconstruction (bypasses HTML5 parser to preserve React's programmatic DOM)
5. Verifies fidelity (pixel-compares captured HTML against live page)

**Output structure:**

```
<outputDir>/<label>/<pageId>/
  dom-manifest-<width>.json
  html-<width>/index.html
  <width>.manifest.json
<outputDir>/<label>/_assets/
  (shared content-hashed assets)
```

### `compare(before, after, options?)`

Compare two capture directories and generate an interactive HTML report.

```ts
compare(before: string, after: string, options?: CompareOptions): Promise<void>
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `reportDir` | `string` | parent of `before` | Directory to write the report |
| `widths` | `number[]` | auto-detected | Viewport widths to compare |

### Advanced exports

For custom pipelines, diffinity also exports the internal engine functions:

```ts
import {
  capturePage,           // Low-level capture (stability wait, freeze, manifest, HTML)
  attachResponseCache,   // Set up resource caching before navigation
  captureDomManifest,    // DOM tree walker with computed styles
  capturePageHtml,       // Self-contained HTML capture
  matchManifests,        // Element matching algorithm
  diffManifests,         // Semantic diffing
  consolidateDiffs,      // Noise reduction
  buildCascadeClusters,  // Layout-shift clustering
  diffManifestsByViewport, // Multi-viewport orchestration
  compareDirs,           // Full compare pipeline (sync)
} from 'diffinity'
```

## Report features

The HTML report is a self-contained file you can open in any browser:

- **Magnitude-aware ranking** — diffs scored as critical/major/moderate/minor based on property importance, change magnitude, and visual area
- **Humanized labels** — "Header Cell 'Work Type'" not `thead > tr > th[name="Work Type"]`
- **Smart grouping** — elements with identical changes collapsed into "Multiple Similar ×N"
- **Cascade clustering** — groups related layout-shift changes to reduce noise
- **Side-by-side HTML views** — before/after captured HTML with synchronized scrolling
- **Element highlighting** — hover a diff item to highlight the element in both views
- **Keyboard navigation** — arrow keys to navigate, `V` to cycle viewports, `1`/`2`/`3` for view modes
- **Color swatches** — inline before/after color previews for all color properties

## How capture works

Diffinity's HTML capture uses JSON DOM reconstruction rather than `outerHTML` serialization. This preserves "invalid" nesting that React creates via DOM APIs (e.g., `<div>` inside `<tr>`, `<p>` inside `<p>`) which the HTML5 parser would "correct" if serialized through `outerHTML`.

The process:
1. Inline all resources (stylesheets → `<style>`, images/fonts → data URIs)
2. Serialize the live DOM to a JSON tree (nodeType, tagName, attributes, children)
3. Generate a reconstruction HTML that rebuilds the DOM via `createElement`/`appendChild`
4. Extract data URIs to content-hashed files in a shared `_assets/` directory

After capture, diffinity pixel-compares the reconstructed HTML against the live page to verify fidelity.

## License

MIT
