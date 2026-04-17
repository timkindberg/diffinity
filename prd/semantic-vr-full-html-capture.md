# Semantic Visual Regression Diffing — PRD

## Problem

Current VR suite uses pixel-based diffing (pixelmatch). It catches changes but suffers from:
- **Cascading shift problem**: a global spacing change lights up every downstream element
- **No semantic understanding**: reports "87% pixels differ" instead of "card padding increased 4px"
- **No structural awareness**: can't distinguish "added" vs "removed" vs "modified"

## Goal

A diffing system that produces **semantically meaningful change descriptions** with an interactive visual report — like "git diff for rendered web pages."

## Capture

For each page × role × viewport, capture:

1. **Screenshot** (existing — keep for quick visual reference)
2. **Self-contained HTML** — full page DOM with all styles inlined and external resources embedded (fonts, images → data URIs). One file per viewport (`html-{width}/index.html`) since runtime JS may alter DOM based on viewport (confirmed: 0/45 pages produce identical HTML across viewports).
3. **Element manifest (JSON)** — recursive tree of every visible element's:
   - Bounding box (x, y, width, height)
   - ~90 visually meaningful computed styles (see appendix)
   - Text content (direct text nodes only)
   - Tag name, attributes (id, class, role, aria-*, data-testid, name, href, src, type)
   - Accessible name (W3C spec, via CDP — same as testing-library uses)
   - Children array (tree structure derived on demand during matching)

### Self-contained HTML approach (validated via spike)

**Chosen: Option B — Preserve CSS, inline external resources.**

Two approaches were spiked. Option A (compute styles per element, generate atomic CSS) produced 5MB files with 28% pixel diff. Option B (preserve original CSS cascade, inline resources) produced 1.2MB files with 0.33% pixel diff in 400ms. Option B wins on every dimension.

Pipeline:
1. **Response cache**: Capture all font/image/CSS responses during page load via `page.on('response')` — handles fonts served by Next.js that 404 on re-fetch
2. **External stylesheets**: Fetch `<link rel="stylesheet">` contents via `page.request.get()`, replace CSS `url()` references with base64 data URIs, inject as `<style>` blocks
3. **Inline styles**: Walk existing `<style>` tags (Chakra/Emotion runtime CSS), replace `url()` references with data URIs from response cache
4. **Images**: Fetch `<img>` src and `<source srcset>` (for `<picture>` elements) via `page.request.get()`, convert to data URIs. Resolve relative URLs against page origin. Canvas fallback for same-origin images
5. **Cleanup**: Strip `<script>`, `<noscript>`, preload/prefetch links
6. **Serialize**: `document.documentElement.outerHTML` — save + restore DOM in-place to avoid clone issues

Spike results (settings-security page, 1440px):
- Capture time: ~400ms
- File size: 1.26 MB (87 resources embedded inline)
- Pixel accuracy: 100% (0.000% diff — perfect match)

Size breakdown (1.26 MB):
- CSS (469 style tags): 1,108 KB (86%)
- Data URIs (fonts + images, embedded in CSS + HTML): 800 KB (62%, overlaps with CSS)
- HTML markup: ~150 KB

### Post-capture optimizations (implemented)

1. **Extract shared assets** — fonts, images extracted from data URIs to a shared `_assets/` directory at the phase level, referenced via relative URLs (`../../_assets/`). Content-hashed filenames (MD5) naturally deduplicate identical files across pages.
2. **Purge unused CSS** — PurgeCSS removes rules that don't match any element in the frozen DOM. Chakra/Emotion injects rules for every component variant; most are unused on any given page. Falls back gracefully if CSS syntax is unparseable (some Chakra runtime CSS). Safelists `css-*`, `chakra*`, pseudo-elements.
3. **Merge style tags** — consolidate ~469 `<style>` tags → 1. Minor savings from tag overhead.

**Not using CSS minification** — lightningcss was spiked but caused subtle pixel diffs by collapsing CSS shorthand properties in ways that altered computed values. The ~24KB savings isn't worth the risk. PurgeCSS + asset extraction already achieves 64% reduction.

### Output structure (implemented)

```
screenshots/before/
  _assets/                                   # shared across all pages (content-hashed)
    0b2ed75ab4d3.woff2
    c65d20388644.woff2
    ...
  _validation.json                           # machine-readable capture results
  settings-security--employer/               # per page+role folder
    1440.png                                 # screenshot
    1440.manifest.json                       # API/console/DOM validation manifest
    768.png
    768.manifest.json
    375.png
    375.manifest.json
    html/
      index.html                             # optimized self-contained HTML (refs ../../_assets/)
```

HTML is captured once per page+role (viewport-independent — CSS media queries are preserved).
Screenshots and manifests are per-viewport within the same folder.

## Element Matching (Before ↔ After)

### Stable ID Heuristic

Each element gets a composite fingerprint for matching. Scoring system:

| Signal | Weight | Notes |
|--------|--------|-------|
| `data-testid` | Very high | Explicitly stable |
| User-authored `id` | High | Ignore framework-generated patterns like `:r0:` |
| `aria-label` / `role` | High | Accessibility attrs tend to be stable |
| Tag name | High | Tags rarely change |
| DOM path / depth | Medium | Structural position in tree |
| Class name overlap | Medium | Classes change, but overlap is a signal |
| Text content similarity | Medium | Content can change but is identifying |
| `name`, `href`, `src` attrs | Medium | Stable for forms, links, images |
| Children structure signature | Medium-High | Shape of subtree (tag names + counts + depth) |

### Matching algorithm

**Chosen: A-smart (flat + ancestor paths).** Flatten both trees, compute ancestor path per element (e.g. `["body", "div#app", "nav", "ul", "li"]`), score every before×after pair, greedy-match highest scores. Remaining unmatched: before-only = removed, after-only = added.

Two approaches were spiked (see `spike-matching.ts`) with 5 controlled mutations on settings-security (385 elements): remove a button, add a banner, move a link across parents, change heading text, change container styles.

| Test | A-smart (flat) | B (recursive) |
|------|---------------|---------------|
| Remove element | ✓ | ✓ |
| Add element | ✓ | ✓ |
| Move across parents | ✓ (score=122) | ~ reported as remove+add |
| Text change | ✓ (score=70) | ✗ cascade failure |
| Style change | ✓ (score=40) | ✗ cascade failure |
| **Elements matched** | **377/385** | **5/385** |
| **Time** | 33ms | 1ms |

B suffered catastrophic cascade failure: top-level children of `<body>` are generic `div`s with weak identity signals. When they fail to match, all descendants are reported as removed+added. A-smart avoids this because ancestor path + accumulated signals give every element a unique-enough fingerprint regardless of tree position.

### Future enhancement

If n² becomes a bottleneck at scale (unlikely — 700² = 490K, ~100ms), a hybrid approach could use tree-guided matching first and fall back to flat matching only for unmatched elements.

## Diff Engine

For each matched pair, compare:
- **Computed styles** → semantic descriptions: `"padding: 16px → 24px"`, `"color: #333 → #666"`
- **Text content** → `"text changed: 'Submit' → 'Save'"`
- **Bounding box** → `"width: 200px → 240px"`, `"moved 8px down"`
- **Attributes** → `"class added: 'active'"`, `"aria-label changed"`
- **Children** → `"child added: <span>"`, `"child removed: <div>"`

For unmatched elements:
- **Added**: full description of new element
- **Removed**: full description of removed element

## Report

Interactive HTML report (replaces current pixelmatch report).

### Layout

Side-by-side: Before (left) | After (right), rendered from the self-contained HTML files.

### Annotations

- **Changed elements**: subtle colored outline (blue). Hover → bolder outline + corresponding element highlighted on other side + tooltip with semantic diff description.
- **Added elements**: green outline on After side. No corresponding element on Before.
- **Removed elements**: red outline on Before side. No corresponding element on After.

### Sidebar

- List of all changes, grouped by type or region
- Hover sidebar item → highlights corresponding element(s) in both views
- Click for expanded detail (full style diff, before/after values)

### Progressive disclosure

- Default view: subtle outlines, change count badge
- Hover: bold outline + brief description tooltip
- Click / sidebar: full semantic diff detail

## Status

### Done

- **HTML capture pipeline** — integrated into `capture.ts`, runs for every page alongside PNGs/manifests
  - `src/html-capture.ts`: captures raw HTML with all resources inlined, optimizes with PurgeCSS + asset extraction
  - Response cache captures fonts/images during page load (handles Next.js dynamic font serving)
  - Handles `<img>`, `<picture>/<source srcset>`, CSS `url()`, external stylesheets
  - PurgeCSS fallback: gracefully skips pages with unparseable CSS syntax
  - 0% pixel diff validated via pixelmatch (see `spike.ts`)
- **Per-page folder structure** — `{page}--{role}/` contains PNGs, manifests, and `html/` subfolder
- **Shared assets** — `_assets/` at phase level, content-hashed, naturally deduped across pages
- **Compare/report** — updated to walk nested directory structure (backward-compatible with flat)
- **Spike validation** — `spike.ts` proves pixel-perfect fidelity of the capture + optimization pipeline
- **DOM manifest capture** — `src/dom-manifest.ts` integrated into `capture.ts`, runs for every page alongside PNGs/HTML
  - Single `page.evaluate()` walks full visible DOM tree — all elements, no depth filtering (leaf-level bugs matter)
  - ~90 visually meaningful computed style properties per element (not all ~421 — reduced size from 39MB to 1MB, capture time from 3.8s to 224ms)
  - Bounding box, direct text content, tag, attributes (id, class, role, aria-*, data-testid, name, href, src, type)
  - **Accessible names via CDP** — 2 CDP calls (`DOM.getDocument` + `Accessibility.getFullAXTree`) cross-referenced by `backendNodeId` → `data-vr-idx`. Uses the browser's own W3C accessible name computation (same spec as testing-library's `dom-accessibility-api`). Adds ~20-35ms.
  - Tree structure stored as nested `children` array (structure signature derived on demand during matching, not precomputed)
  - Captured once per page+role at 1440px viewport. Output: `{page}--{role}/dom-manifest.json` (~1MB compact)
  - Performance: 244ms (settings-security, 385 elements), 450ms (job-detail, 735 elements)

- **Element matching** — `src/match.ts`. A-smart algorithm: flatten both trees, compute ancestor paths, score all before×after pairs, greedy-match highest scores. Tested with 10 unit tests covering identity matches, testId/text signals, add/remove detection, moves across parents, and signal priority.
- **Semantic diff engine** — `src/diff.ts`. Compares matched pairs across styles, text, bbox, attributes, children count. Produces human-readable `Change[]` per element. Change categories: box-model, typography, visual, layout, flexbox, grid, positioning, sizing, text, structure, bbox, other-style.
- **Diff consolidation** — `consolidateDiffs()` in `src/diff.ts`. Post-processes raw diffs to reduce noise:
  - Suppresses descendants of removed/added elements (keeps top-level only)
  - Drops elements whose only changes are bbox (x/y) shifts
  - Strips bbox from elements that also have meaningful changes
  - Drops redundant children-count-only diffs
  - Reduced reported changes by 62-75% in testing
- **Interactive report UI** — `screenshots/report_v2.html` (committed source, not generated). Dark-themed, three-panel layout: sidebar (page nav), main viewer (side-by-side HTML iframes with zoom), diff panel (semantic changes list). Keyboard shortcuts: arrows to navigate pages, 1/2/3 for view modes, F for zoom cycle, D to toggle diff panel, [ to toggle sidebar.
- **Highlight overlay** — `src/report/highlight-listener.js` injected into captured HTML files at compare time. Portal-based overlay (absolute-positioned div at bottom of `<body>`, max z-index) with padded bounding box. Hover a diff item → colored flash (35% opacity, 100ms) → 0.5s ease-out fade → infinite border pulse. Overlays include contextual labels ("before"/"after", "removed"/"added", "moved"). Smart scroll uses `block: 'nearest'` then `block: 'start'` with 80px nav offset for tall elements. CSS-hidden elements show "Element not visible at current zoom" with ancestor highlighting.
- **Report architecture** — Separated into static HTML (`screenshots/report_v2.html`, committed) and generated data (`screenshots/report-data.js`, gitignored). `compare-v2.ts` reads manifests, runs matching + diffing + consolidation, writes `report-data.js`. Report loads it via `<script src="report-data.js">` and sets `window.VR_DATA`.
- **Test data generation** — `src/create-test-after.ts`. Loads before HTML captures in a headless browser, applies targeted DOM mutations (text, style, add/remove elements), captures fresh manifest + HTML. Used to validate the pipeline end-to-end without needing the live app.
- **Test suite** — `vitest`. 42 tests across 4 files:
  - `match.test.ts` — 10 unit tests for element matching
  - `diff.test.ts` — 14 unit tests for semantic diffing
  - `consolidate.test.ts` — 7 unit tests for diff consolidation (TDD)
  - `pipeline.integration.test.ts` — 11 integration tests running full pipeline (raw HTML → capture → match → diff) in a real Playwright browser

### Done (UX refinement phase)

- [x] **Report UI restructure** — diff panel moved to left (between sidebar and viewer), added diff search/filter, keyboard navigation (left/right to switch focus between panels, up/down within panels, enter/space to expand diff items), visual focus indicators. `[` toggles both side panels.
- [x] **Diff scoring** — each diff scored by importance (0-200). Added `ImportanceLevel` type (critical/major/moderate/minor). Width/height cascade changes score at 40% base to avoid inflation. Thresholds: critical ≥100, major ≥60, moderate ≥25, minor <25.
- [x] **Color swatches** — for color-type CSS changes, inline 14×14px before/after color squares next to CSS values. Detects hex, rgb, hsl, oklch. Works for collapsed properties too ("foreground color", "border-color").
- [x] **Better semantic names** — humanized tag names (`td`→Cell, `a`→Link, `th`→Header Cell, `div`→Container, etc.). Heuristic priority: accessible name > testId > role+text > aria-label > name attr > user-authored id > tag.classes. Framework IDs excluded. Duplicate labels disambiguated with nearest named ancestor. Full-length labels in data; CSS `text-overflow: ellipsis` in UI. CSS selector path shown in expanded details only.
- [x] **Diff deduplication/grouping** — per-element collapse (border quad, foreground color bundle, coupled properties) + fingerprint grouping (≥2 identical change-sets grouped). Groups rendered as collapsible "Multiple Similar ×N" items with member name preview and change summary. Hovering group highlights all members at once via `highlight-multi` protocol.
- [x] **Report diff item layout** — two-row layout: badges row (importance outline pill + git-diff-style type char ~+−↔) then title row (label + count/summary). Groups and ungrouped diffs interleaved by importance tier, score as tiebreaker. Importance-colored left border on all items.
- [x] **Highlight fixes** — multi-element highlighting for groups, `scrollIntoView({ block: 'center' })` to avoid nav overlap, instant scroll before positioning overlay to fix elements in scrollable containers.

### Done (scoring & animation phase)

- [x] **Nuanced magnitude-aware scoring** — scoring refined beyond flat category weights:
  - *Property dominance*: `background-color` (80), `background-image` (80), `opacity` (70) score higher than category peers
  - *Color magnitude*: RGB Euclidean distance (via OKLCH→RGB conversion) scales score — <5 trivial, <20 subtle, <80 noticeable, <150 standard, 150+ amplified. Transparent↔opaque background = automatic 100
  - *Pixel magnitude*: delta-based — ≤1px trivial, ≤5px half-base, ≤20px full, >20px amplified. Cascade props (`width`, `height`, `top`, `left`) at 40% base
  - *Diminishing returns*: first change per category scores full; subsequent same-category changes 50%
  - *Visual area weighting*: scales final score by element bbox area — small elements (0.7×) to large elements (1.4×)
- [x] **Hidden element filtering** — elements ≤1×1px (Chakra "visually hidden" pattern for a11y checkboxes, etc.) excluded from DOM manifest. Position/bbox-only diffs suppressed in consolidation
- [x] **Contextual overlay labels** — highlight overlays show "before"/"after" for changed elements, "removed"/"added" for structural changes, "moved" for repositioned elements. Labels positioned in top-left corner of overlay
- [x] **Highlight animation** — flash (35% opacity fill, 100ms hold) → smooth 0.5s ease-out fade → infinite border pulse. Smart scroll with 80px nav offset
- [x] **Capture-only CSS isolation** — `VR_INIT_STYLES` (transition/animation freeze for deterministic screenshots) was being baked into saved HTML via `outerHTML` serialization, killing all CSS transitions in report iframes. Fixed: tagged with `data-vr-capture-only`, stripped before serialization in `html-capture.ts`, and stripped from existing captures in `compare-v2.ts`

### Multi-viewport spike (2026-04-07, code stashed — experiment only)

> **Stashed code**: `git stash show -p 'stash@{0}'` — "multi-viewport capture spike (src changes)". Contains per-viewport HTML/manifest capture in `capture.ts`, backward-compatible path resolution in `compare-v2.ts`, and `diff-dom` dependency. Spike scripts in `tmp/scratch.html-dedup-spike.ts`.

Ran a full multi-viewport capture experiment (45 page-role combos × 3 viewports = 135 captures) and semantic HTML diffing spike using `diff-dom`. Capture code is stashed; findings and decisions documented here.

#### Experiment 1: HTML dedup across viewports

Captured full HTML at 1440, 768, and 375 for all pages. Compared content hashes.

**Raw result: 0/45 identical.** Every page has different HTML at every viewport. Two categories of difference:
- **Self-inflicted** — our `data-vr-idx` attributes number differently per viewport (manifest walk sees different visible elements). After stripping these: 9/45 pages dropped from 3 unique to 2 unique (768 and 375 identical for those pages). Still 0/45 fully identical.
- **Real** — JS-driven responsive logic pervasive across the app: nav collapse via `useMediaQuery`, Chakra/Emotion viewport-specific CSS classes, elements showing/hiding via JS.

Disk at 45 pages × 3 viewports (before/ only): **532 MB**. PNGs dominate (~420 MB), HTML is ~70 MB, manifests ~37 MB. Content-hash dedup after stripping `data-vr-idx` would save ~44 MB (15%).

#### Experiment 2: semantic HTML diff via `diff-dom`

Used `diff-dom` library (`stringToObj` → `dd.diff()`) to produce semantic patches between 1440 HTML and 768/375 HTML for all pages. 84 comparisons total.

**Key finding: differences are sparse and mechanical.** Most pages have 1-5 DOM operations. The patterns:

| Category | Count | What it is |
|----------|-------|------------|
| `addAttribute` (inline style) | 274 | JS setting `style=""` via `useMediaQuery` / Chakra responsive props |
| `modifyAttribute` (inline style) | 189 | Same — style values changing per viewport |
| `removeElement` | 104 | ~1 per comparison — usually a `<script>` tag conditionally loaded at desktop |
| `replaceElement` | 63 | Element swapped (e.g., desktop nav → mobile nav) |
| `addElement` | 53 | Elements appearing at narrower viewports (hamburger buttons, etc.) |
| `modifyTextElement` | 22 | Mostly CSS `<style>` tag text changing slightly |
| CSS class changes | 37 | Chakra/Emotion generating different classes at different breakpoints |

**Pages ranked by structural complexity:**
- `timesheets-week` (12 structural diffs), `home` (9), `timesheets-month` (8) — most complex responsive logic
- Most pages: 1 structural diff (the script removal) + a few inline style toggles
- 3 pages stack-overflowed (`candidate-timesheets`, `time-entries`) — 19MB deeply-nested DOMs too large for `diff-dom`'s recursive algorithm

**`diff-dom` supports round-trip patching:** `dd.diff()` → serialize as JSON → `dd.apply()` to reconstruct. Patches for most pages would be 1-5 KB vs 0.5-19 MB per full HTML. Also supports `dd.undo()` for reverse.

#### HTML storage decision

Evaluated four approaches:

| Option | Approach | Compression | Inspectable | Risk |
|--------|----------|-------------|-------------|------|
| **A** | Capture all, content-hash dedup | 15% | N/A — full files | None |
| B | Custom DOM patch | High | Partially | Fragile — hand-rolled |
| C | Binary delta (bsdiff/gzip) | High | No — opaque blobs | Low |
| **D** | `diff-dom` semantic patches | ~99% (1-5 KB patches) | Yes — meaningful ops | Medium — 3 pages overflow |

**Decision:** Capture full HTML per viewport for now (simple, correct). When storage or diagnostic value matters, implement Option D with fallback to full HTML for pages that overflow. Patches are diagnostically valuable — could surface "these elements differ due to JS-responsive logic" in the report.

### Up Next

- [ ] **Multi-viewport diffing** — run match+diff independently at each viewport, produce viewport-specific diff results. Report sidebar groups viewports under same page
- [ ] **Manifest delta storage** — separate viewport-independent structure from viewport-dependent presentation (styles+bbox). Store full at 1440, sparse deltas at 768/375. ~60-70% manifest size reduction. See NEXT-STEPS.md
- [ ] **Color normalization** — normalize oklch/hsl to rgb before comparison to eliminate format-only false positives
- [ ] **Secondary tier for text/children noise** — hide text/children changes when same element has box-model/typography changes
- [ ] **Synced scrolling** — optionally sync scroll position between before/after iframe views (complex due to differing content heights)

### Deferred

- Progressive report loading (pages appear as they finish capturing)
- "Might match" second-pass matching
- Performance optimization of capture/diff at scale
- PNG-based visual diff (kept as fallback but replaced by HTML-based semantic diff for primary workflow)

## Tracer Bullet Scope

Minimal end-to-end slice to validate the full pipeline with one page, one viewport:

1. **Capture**: generate self-contained HTML + element manifest JSON alongside screenshot *(done)*
2. **Diff**: match elements between before/after manifests, produce semantic change list *(done)*
3. **Report**: render before/after self-contained HTML side-by-side with overlay annotations on changed elements *(done)*

All three tracer bullet milestones complete. Current work is UX refinement (scoring, naming, layout, color swatches).

## Appendix: Spike Results & Key Decisions

### HTML capture approach

| Approach | File size | Pixel diff | Capture time | Verdict |
|----------|-----------|------------|-------------|---------|
| A: Computed styles → atomic CSS | 5 MB | 28% | ~1s | ✗ too lossy |
| **B: Preserve CSS, inline resources** | **1.2 MB** | **0%** | **400ms** | **✓ chosen** |

### Post-capture CSS optimization

| Tool | Size reduction | Pixel diff | Verdict |
|------|---------------|------------|---------|
| **PurgeCSS** | **64%** | **0%** | **✓ chosen** |
| lightningcss (minification) | +24KB saving | 0.006% diff | ✗ collapsed shorthands caused pixel changes |

### DOM manifest: computed style scope

| Scope | File size | Capture time | Verdict |
|-------|-----------|-------------|---------|
| All ~421 properties | 39 MB | 3,848ms | ✗ too large and slow |
| **~90 visual properties** | **1 MB** | **224ms** | **✓ chosen** |

### DOM manifest: accessible names

| Approach | Coverage | Mismatches vs CDP | Speed | Verdict |
|----------|----------|-------------------|-------|---------|
| Heuristic (aria-label, label-for, text) | 105/385 | 0 mismatches, 4 missed (child alt text) | 14ms | Good, but gaps |
| Heuristic + child alt text fix | 105/385 | 0 mismatches, 0 missed | 14ms | Complete, but not future-proof |
| **CDP Accessibility.getFullAXTree** | **79/385** | **N/A (ground truth)** | **13ms** | **✓ chosen — W3C spec, always correct** |

Note: heuristic found MORE names than CDP because it applies text-content naming to headings/buttons (which CDP reports as separate StaticText AX nodes rather than on the element itself). The 79 CDP names are the semantically correct accessible names per W3C spec.

### Element matching algorithm

| Approach | Matched | Move detection | Cascade failure | Time | Verdict |
|----------|---------|----------------|----------------|------|---------|
| **A-smart (flat + ancestor paths)** | **377/385** | **✓** | **No** | **33ms** | **✓ chosen** |
| B (recursive/tree-guided) | 5/385 | ✗ | Yes — generic top-level divs fail | 1ms | ✗ |

## Appendix: Computed Styles

**Strategy**: capture only the ~90 visually meaningful properties (capturing all ~421 bloated files from 1MB to 39MB and slowed capture from 224ms to 3.8s). The list can be expanded if needed.

### Visually Meaningful Properties (~90)

#### Box Model (~20)
`width`, `height`, `padding-top`, `padding-right`, `padding-bottom`, `padding-left`, `margin-top`, `margin-right`, `margin-bottom`, `margin-left`, `border-top-width`, `border-right-width`, `border-bottom-width`, `border-left-width`, `border-top-style`, `border-right-style`, `border-bottom-style`, `border-left-style`, `border-top-color`, `border-right-color`, `border-bottom-color`, `border-left-color`, `border-top-left-radius`, `border-top-right-radius`, `border-bottom-left-radius`, `border-bottom-right-radius`, `box-sizing`

#### Typography (~15)
`font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `letter-spacing`, `word-spacing`, `text-align`, `text-decoration`, `text-decoration-color`, `text-decoration-style`, `text-transform`, `text-shadow`, `color`, `text-overflow`

#### Visual (~10)
`background-color`, `background-image`, `background-size`, `background-position`, `opacity`, `box-shadow`, `outline-width`, `outline-style`, `outline-color`, `filter`, `backdrop-filter`

#### Layout / Flexbox (~15)
`display`, `flex-direction`, `flex-wrap`, `flex-grow`, `flex-shrink`, `flex-basis`, `justify-content`, `align-items`, `align-self`, `align-content`, `gap`, `column-gap`, `row-gap`, `order`, `float`, `clear`

#### Grid (~10)
`grid-template-columns`, `grid-template-rows`, `grid-template-areas`, `grid-auto-flow`, `grid-auto-columns`, `grid-auto-rows`, `grid-column-start`, `grid-column-end`, `grid-row-start`, `grid-row-end`

#### Positioning (~10)
`position`, `top`, `right`, `bottom`, `left`, `z-index`, `overflow-x`, `overflow-y`, `vertical-align`

#### Sizing Constraints (~4)
`min-width`, `max-width`, `min-height`, `max-height`

#### Other Visual (~6)
`visibility`, `clip-path`, `object-fit`, `object-position`, `transform`, `cursor`, `content`, `list-style-type`, `list-style-position`
