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

## Live demo

See diffinity in action at **[timkindberg.github.io/diffinity](https://timkindberg.github.io/diffinity/)** — three scenarios (targeted CSS fix, flex→grid refactor, full rebrand) plus the full test fixture catalog.

## Install

```bash
npm install diffinity
npx playwright install chromium  # peer dependency
```

Requires Node 20+. Diffinity launches Chromium with `--disable-web-security` internally so it can read cross-origin CSS (Tailwind/Bootstrap CDN, Google Fonts, etc.) via the CSSOM. If you pass in your own Playwright browser instance, you'll want the same flag for the capture to see those stylesheets.

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

See `examples/basic.ts` for a minimal end-to-end runnable script.

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

## How element matching works

The core difficulty in semantic diffing is matching elements across before/after states without reliable IDs. Diffinity's matcher uses a layered identity-signal approach, ranked roughly by strength:

1. **`data-testid`** — most reliable; if both elements share a test ID, they're the same
2. **Author-provided `id`** — same, minus framework-generated patterns (React `:r0:`, MUI `mui-42`, etc., normalized away)
3. **ARIA role + accessible name** — works for buttons, headings, inputs, landmarks
4. **`for` attribute** — labels matched to their inputs
5. **Ancestor path + tag + position** — fallback for anonymous divs/spans

Each candidate pair gets a score across these signals; pairs that meet a confidence threshold are matched, the rest become "added"/"removed".

This is why diffinity works well on React/Vue apps that don't expose stable ids by default — you don't need to instrument your code, the matcher degrades gracefully.

## How noise reduction works

A naive DOM diff produces hundreds of false positives — computed styles drift in ways that don't reflect author intent. Diffinity's consolidation pipeline applies a stack of targeted suppressions so the default report surfaces only changes a human cares about.

### Authored-vs-computed (explicitProps)

Each captured element carries `explicitProps` — the set of CSS properties actually written by the author (via stylesheet rules or inline styles). Values like `auto`, `initial`, `inherit`, `unset` are excluded, since they mean "browser figures it out."

This matters for scoring. An authored `width: 400px → 200px` is major; a width change caused by flow reflow (sibling grew) is minor. The engine checks the union of before+after `explicitProps` — adding, removing, or changing an authored value all count as authored intent.

### Implicit ancestor suppression

When a descendant's change propagates up the tree (e.g., a child's `font-size` grows, making the parent's computed `height` grow), the ancestor's computed change is suppressed. The user sees the `font-size` diff on the child and nothing else — the cascade isn't reported as noise.

### currentColor border suppression

CSS `border-color`, `outline-color`, `text-decoration-color` default to `currentColor` — they mirror the element's `color` property. When `color` changes, these mirror it in computed styles even though no rule touched them. Diffinity detects this and reports only the `color` diff.

### `1em` margin scaling suppression

The browser's default margins on `<p>` and `<h1–h6>` are `1em` — they scale with `font-size`. When `font-size` changes, those margins change proportionally; the diff on margins is purely derived. Detected and suppressed when `margin == font-size` on both sides.

### Per-property implicit-size stripping

When an element has a mix of authored changes (border-width, border-color) AND implicit size drift (width changed because parent's box changed), the implicit size changes are stripped from the diff rather than suppressing the whole thing. The user sees the real change without the cascade noise hitching a ride.

### Grid-template and flex-item phantom values

When `display: flex → grid`, the browser fabricates concrete `grid-template-rows/columns` values out of nothing. Diffinity recognizes this pattern and suppresses those phantom diffs, keeping only the authored `display` change.

### Shorthand collapse

When all 4 sides of padding/margin/border change to the same value, they collapse to a single `padding: 16px → 32px` entry in the report instead of 4 separate rows. Same for `border-radius`, `border-color`, `border-width`, `border-style`.

### Cascade clustering

When 3+ elements all shift by the same amount in the same direction (e.g., every row in a table dropped 4px), diffinity collapses them into one "cascade cluster" item with a shared root cause, rather than repeating the same diff 30 times.

### Fingerprint grouping

Distinct elements that underwent an identical set of changes — same properties, same before/after values — are grouped into a "Multiple Similar ×N" item with member preview. Common for design-token swaps that touch many elements the same way.

### Zero-height wrapper promotion

Elements with `height: 0` wrappers (common React pattern for accessibility-hidden containers) have their visible descendants promoted into the parent's child list so diffs don't look like they happened on an invisible element.

### Pixel-fidelity verification at capture time

For each element captured, diffinity also pixel-compares its live screenshot against the reconstructed HTML and records a fidelity score. If capture drift occurs, you see it in the report rather than silently diffing incorrect inputs.

---

## How capture works

Diffinity's HTML capture uses JSON DOM reconstruction rather than `outerHTML` serialization. This preserves "invalid" nesting that React creates via DOM APIs (e.g., `<div>` inside `<tr>`, `<p>` inside `<p>`) which the HTML5 parser would "correct" if serialized through `outerHTML`.

The process:
1. Inline all resources (stylesheets → `<style>`, images/fonts → data URIs)
2. Serialize the live DOM to a JSON tree (nodeType, tagName, attributes, children)
3. Generate a reconstruction HTML that rebuilds the DOM via `createElement`/`appendChild`
4. Extract data URIs to content-hashed files in a shared `_assets/` directory

After capture, diffinity pixel-compares the reconstructed HTML against the live page to verify fidelity.

## Development

Clone and set up:

```bash
git clone https://github.com/timkindberg/diffinity.git
cd diffinity
npm install
npx playwright install chromium
```

### Scripts

The scripts are grouped into three namespaces: core library, `report:*` (the Preact app embedded in every diff report), and `demo:*` (the kitchen-sink site diffinity captures in scenarios, plus the landing page and fixture catalog).

**Library + tests:**

```bash
npm test              # run tests once
npm run test:watch    # watch mode
npm run typecheck     # tsc --noEmit
npm run build         # full build: library + report bundle (what `npm publish` ships)
npm run lib:build     # library only (tsup, no report bundle) — fast iteration when you aren't touching src/report/
```

**Iterate on the report UI** (the interactive HTML diff report):

```bash
npm run report:dev    # vite dev server with hot reload, points at src/report/
npm run report:build  # production build → dist/report/ (bundled into `npm run build`)
```

**Iterate on the demo app** (the "Helix Ops Console" sample site that scenarios capture):

```bash
npm run demo:dev      # vite dev server for demo-app/, hot reload
npm run demo:build    # production build of demo-app/ → site/app/
```

**Run the full demo pipeline locally** (end-to-end — what GitHub Pages ships):

```bash
npm run demo:run       # 3 scenario reports (targeted / refactor / theme)
npm run demo:fixtures  # full test-fixture catalog
npm run demo:landing   # stage landing/index.html into site/
npm run demo:all      # all three above in sequence (what CI runs)
```

Then open `site/index.html`.

> **Do I have to build before running?** `demo:run` internally runs `report:build` and `demo:build` first, so a cold `npm run demo:all` works on a fresh checkout. Use `report:dev` / `demo:dev` only when you want hot reload while editing.

## Publishing the demo site

The live demo at [timkindberg.github.io/diffinity](https://timkindberg.github.io/diffinity/) is built and deployed by `.github/workflows/pages.yml` on every push to `main` (it runs `npm run build && npm run demo:all`). To (re)enable Pages for a fork:

1. **Settings → Pages → Build and deployment → Source**: select **GitHub Actions**.
2. Push to `main` (or trigger the workflow manually from the Actions tab). The first successful run publishes to `https://<user>.github.io/<repo>/`.

## License

**Source-available, all rights reserved.** See [LICENSE](./LICENSE) for the full text.

This code is published publicly so people can read it, learn from it, and discuss the ideas — but **no rights to use, copy, modify, or redistribute it are currently granted**. If you want to run diffinity on your own project, or build on it, please reach out first.

### Why the restriction?

Diffinity was designed and built while I'm employed at Workday, and I'm still working through the right way to share it openly. I'd like this to land under a permissive or source-available open-source license (MIT, Apache 2.0, PolyForm Noncommercial, or BUSL are all on the table), but I want to get that right — with the proper approvals — rather than pick a license now and regret it later.

Until a formal license is issued in writing, treat this repository as source-visible proprietary code. The restrictive stance is intentionally conservative and I fully expect to relax it once the open-source path is settled.

If you're interested in using diffinity and can't wait, open an issue or get in touch.
