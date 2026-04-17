# PRD: Multi-Viewport Capture Revival

## Problem Statement

The visual regression pipeline currently captures DOM manifests and HTML at a single viewport (1440px desktop). The report's viewport selector simulates narrower breakpoints by resizing the iframe, but this only triggers CSS media queries — it doesn't reflect JS-driven responsive changes (`useMediaQuery`, Chakra responsive props, conditional rendering). A page that collapses its nav at 768px via JavaScript will still show the desktop nav in the report at the 768px viewport tab.

A multi-viewport capture spike (2026-04-07) proved the approach works — capturing HTML + manifests at 1440, 768, and 375 for all 45 page-role combos. It was stashed because PNGs inflated total disk to ~1 GB. With PNGs no longer needed (HTML-based semantic diff has replaced pixel diffing), the storage math changes: HTML + manifests + shared assets = ~218 MB before+after. That's acceptable.

## Solution

Revive the stashed per-viewport capture code, skip PNG screenshots, update the diff pipeline to run per-viewport, and wire the existing report viewport selector to display viewport-specific diffs and HTML.

After this work, a reviewer switching from the 1440 tab to the 768 tab will see:
- The actual HTML captured at 768px (with JS-responsive changes baked in)
- A separate set of before/after semantic diffs specific to that viewport
- Highlights that correspond to the elements visible at that breakpoint

## User Stories

1. As a reviewer, I want the capture pipeline to save a separate HTML file per viewport, so that each viewport tab shows the real rendered page at that breakpoint rather than a CSS-only simulation.
2. As a reviewer, I want the capture pipeline to save a separate DOM manifest per viewport, so that the diff engine can detect changes specific to each breakpoint.
3. As a reviewer, I want the diff pipeline to produce independent diff results per viewport, so that I can see which CSS/DOM changes affect desktop vs tablet vs mobile.
4. As a reviewer, I want the report's viewport tabs to swap the diff panel contents when I switch viewports, so that I see only the diffs relevant to the selected breakpoint.
5. As a reviewer, I want the report's viewport tabs to swap the before/after iframe sources when I switch viewports, so that I see the actual captured HTML for that breakpoint.
6. As a reviewer, I want a change count badge on each viewport tab, so that I can quickly see which breakpoints have diffs without clicking into each one.
7. As a reviewer, I want the capture to skip PNG screenshots, so that multi-viewport capture runs faster and uses reasonable disk space.
8. As a reviewer, I want the capture to navigate only once per page and resize for subsequent viewports, so that capture time is minimized and route setup/mocks aren't duplicated.
9. As a reviewer, I want each viewport's diffs to be independent (no cross-viewport correlation), so that the system is simple and each viewport stands on its own.
10. As a reviewer, I want the report to fall back to the single `html/index.html` path if per-viewport HTML doesn't exist, so that old captures still work in the updated report.
11. As a reviewer, I want highlight overlays to work correctly at each viewport, so that hovering a diff item highlights the right element in the viewport-specific HTML.
12. As a reviewer, I want cascade clustering to run independently per viewport, so that layout reflow noise is correctly grouped within each breakpoint.

## Implementation Decisions

### Capture pipeline (`capture.ts`)

- Revive the stashed per-viewport capture loop from `git stash show -p 'stash@{0}'`
- Capture order per page: navigate → `waitForReady`/`networkidle` → then for each viewport: `setViewportSize` (skip for first) → 500ms settle → `captureDomManifest` → `capturePageHtml`
- Per-viewport file naming: `html-{width}/index.html`, `dom-manifest-{width}.json` (matching stash convention)
- Comment out PNG `page.screenshot()` calls rather than deleting — code is retained for potential future use
- The validation manifest (`{width}.manifest.json`) stays per-viewport since it records console errors and DOM issues that may vary by breakpoint
- `data-vr-idx` is assigned independently per viewport walk — indices are not stable across viewports

### Diff pipeline (`compare-v2.ts`)

- Load manifests per viewport: try `dom-manifest-{width}.json`, fall back to `dom-manifest.json` for backward compatibility
- Run `matchManifests` + `diffManifests` + `consolidateDiffs` + `buildCascadeClusters` independently per viewport
- Output data shape — nested viewports per page-role (Shape A):
  ```
  {
    page, role, dirName,
    viewportDiffs: {
      1440: { diffs, groups, cascadeClusters, summary, timeMs, hasBeforeHtml, hasAfterHtml },
      768:  { ... },
      375:  { ... }
    }
  }
  ```
- `report-data.js` top-level shape unchanged: `{ viewports: [1440, 768, 375], pages: [...] }`

### Report UI (`report_v2.html`)

- Viewport selector already exists (segmented control, `V` to cycle, localStorage persistence)
- Wire `setViewport()` to swap diff panel contents from `viewportDiffs[activeViewport]`
- Wire `setViewport()` to update iframe `src` from `html/index.html` to `html-{width}/index.html`, with fallback to `html/index.html`
- Add per-viewport change count badge on viewport buttons
- `injectHighlightScript` in `compare-v2.ts` must inject into all `html-{width}/index.html` files, not just `html/index.html`

### What is NOT changing

- Sidebar structure — still one entry per page-role, not per viewport
- Matching algorithm — A-smart, unchanged
- Diff engine / scoring / naming — unchanged
- Cascade clustering logic — unchanged, just runs per viewport
- Keyboard shortcuts — unchanged (`V` cycles viewport, arrows navigate, etc.)

## Testing Decisions

Good tests for this feature verify external behavior (captured files exist, diff results are correct per viewport, report data shape is valid) without testing internal implementation details.

### Modules to test

**Diff pipeline integration** — extend `pipeline.integration.test.ts` with a multi-viewport scenario: provide before/after manifests at multiple widths, verify `viewportDiffs` shape has independent diff results per viewport. Verify backward compatibility: a page-role with only `dom-manifest.json` (no width suffix) still produces results under the default viewport key.

**Capture output structure** — if capture integration tests exist, verify that per-viewport files (`html-{width}/`, `dom-manifest-{width}.json`) are written and that no PNG files are created.

### Prior art

- `src/__tests__/pipeline.integration.test.ts` — 11 integration tests running full pipeline in a real Playwright browser
- `src/__tests__/diff.test.ts` — 14 unit tests for semantic diffing
- `src/__tests__/consolidate.test.ts` — 7 unit tests for diff consolidation

### What NOT to test

- Cross-viewport element identity (not a feature of this work)
- Report UI interactions (manual testing is sufficient for the viewport selector wiring)
- PNG absence (low value, just verify the code path is commented out)

## Out of Scope

- **Cross-viewport diff correlation** — identifying the same element across viewports to surface "change only at mobile" insights. Requires solving cross-viewport element identity.
- **Manifest delta storage** — splitting manifests into structure + presentation layers, storing deltas for non-base viewports. Deferred until disk is a real constraint.
- **Style dictionary dedup** — deduplicating identical computed style objects across elements.
- **In-browser delta capture** — faster recapture at non-primary viewports by reusing `data-vr-idx` from the base viewport. Risk of React re-renders invalidating imperatively added attributes.
- **Semantic HTML diffing (`diffDOM`)** — storing cross-viewport HTML as semantic patches. Deferred; 3 pages stack-overflowed in spike.
- **Lazy-loading report data** — splitting `report-data.js` into per-page files. Not needed yet but will become relevant as page count × viewport count grows.
- **PNG screenshots** — code retained but writes skipped. Can be re-enabled if pixel-based diffing is ever needed again.

## Further Notes

- The stashed code is at `git stash show -p 'stash@{0}'` — "multi-viewport capture spike (src changes)". It contains per-viewport HTML/manifest capture in `capture.ts` and backward-compatible path resolution in `compare-v2.ts`.
- The 500ms settle time after `setViewportSize` may need tuning — Chakra/Emotion CSS-in-JS class generation after responsive re-renders could be async. If flaky captures appear at narrower viewports, increase the settle or add a more targeted wait.
- Projected disk: ~218 MB before+after for 45 pages × 3 viewports. If this grows with page count, gzip on JSON/HTML files is the simplest lever (~90% compression, zero architectural complexity).
