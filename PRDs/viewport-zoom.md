# PRD: Viewport-Aware Zoom

## Problem Statement

The report viewer's zoom control cycles through arbitrary percentages (25%, 33%, 50%, 75%, 100%) that have no relationship to the viewports the pages were actually captured at (1440, 768, 375). There's no way to see what a page looks like at tablet or mobile breakpoints — you're just zooming in and out on a desktop-width capture. The zoom levels don't help you understand responsive behavior.

## Solution

Replace the arbitrary zoom control with a **viewport selector** — three connected buttons (1440 / 768 / 375) that set the iframe's logical width to match captured viewport breakpoints. CSS media queries in the captured HTML respond to the iframe width, giving a partial simulation of each viewport. When the target viewport is wider than the available pane space, the iframe is auto-scaled down using CSS `zoom` to fit.

Later, when per-viewport HTML captures are wired into the report data pipeline, the viewport selector will swap iframe `src` to load the actual HTML captured at that breakpoint (with JS-responsive changes baked in). For now, all three viewports load the 1440px capture.

## User Stories

1. As a reviewer, I want to select a viewport width (1440/768/375) from the report viewer, so that the iframe renders at that logical width and CSS media queries fire for the corresponding breakpoint.
2. As a reviewer, I want the viewport selector to appear as a segmented control in the viewer header, so that all viewport options are always visible and I can switch with a single click.
3. As a reviewer, I want to press `V` to cycle through viewports, so that I can switch quickly without reaching for the mouse.
4. As a reviewer, I want the iframe to render at natural size (zoom: 1) when the target viewport fits in the pane, so that content is crisp and unscaled.
5. As a reviewer, I want the iframe to auto-scale down via CSS `zoom` when the target viewport is wider than the pane, so that the full viewport width is always visible.
6. As a reviewer, I want the zoom to auto-recalculate when I switch view modes (split/before/after), resize panels, or resize the browser window, so that the display stays correct without manual adjustment.
7. As a reviewer, I want the before iframe right-aligned and the after iframe left-aligned in split mode, so that the two viewports butt up against each other at the center divider for easier comparison.
8. As a reviewer, I want the iframe centered in single-pane mode (before-only or after-only), so that the viewport is visually balanced.
9. As a reviewer, I want a subtle border around each iframe, so that the viewport boundary is clear when the iframe is narrower than the pane.
10. As a reviewer, I want my viewport selection to persist across sessions via localStorage, so that the report remembers my preference.
11. As a reviewer, I want the default viewport to be 1440 on first visit, so that the view matches the primary captured viewport.
12. As a reviewer, I want both before and after iframes to always show the same viewport, so that comparisons are always apples-to-apples.

## Implementation Decisions

### Report UI (`report_v2.html`)

**Remove:**
- `ZOOM_LEVELS` array and `zoomIdx` / `zoomScale` state
- `applyZoom()` and `cycleZoom()` functions
- `zoom-btn` button element
- `F` keyboard shortcut for zoom cycling
- `transform: scale()` + inverse width/height on iframes

**Add: Viewport segmented control**
- Three connected buttons in the viewer header: `1440` | `768` | `375`
- Segmented control style: no gap between buttons, shared borders, outer corners rounded, inner corners square
- Active button highlighted with existing `.active` accent style
- `V` key cycles through viewports (wraps around)
- State stored as the selected viewport width (number)
- localStorage key `vr-viewport` stores selected width, default `1440`

**Add: Auto-zoom calculation**
- Use `ResizeObserver` on `.iframe-wrap` elements to track available pane width
- On viewport change or pane resize: `zoom = Math.min(1, paneWidth / targetWidth)`
- Set iframe element's CSS `zoom` property (not `transform: scale()`)
- Set iframe `width` to `targetWidth + 'px'`
- When `zoom < 1`, iframe is scaled down to fit; when `zoom === 1`, iframe renders at natural size with breathing room

**Add: Iframe positioning**
- Split mode: before pane uses `text-align: right` (or flex `justify-content: flex-end`), after pane uses `text-align: left` (or `flex-start`), so iframes butt up at the center divider
- Single-pane mode: center the iframe
- Subtle viewport boundary: `1px solid var(--border)` on the iframe when it's narrower than the pane (i.e., when zoom === 1 and targetWidth < paneWidth)

**Add: Footer hint update**
- Replace `F zoom` with `V viewport`

### Report data pipeline (`compare-v2.ts`)

- Add `viewports: [1440, 768, 375]` to the top-level `VR_DATA` output (alongside the per-page array), sourced from config
- Future-proofs for when per-viewport HTML paths and per-viewport diff results are added

### Iframe CSS changes

- Remove `transform-origin: top left` from `.html-pane iframe`
- Remove existing `transform` / `width` / `height` manipulation in `applyZoom()`
- Iframe gets `width: {targetWidth}px` and `zoom: {calculated}` applied directly

## Testing Decisions

**TDD approach** for safety — each behavior gets a test before implementation. Tests are targeted at regression-prone logic, not exhaustive.

**What makes a good test here:** Tests should verify observable behavior through the public interface. For the report UI, "public interface" means: given a pane width and viewport selection, what CSS properties end up on the iframe? Tests should survive internal refactoring of how the calculation happens.

**Testable behaviors:**
1. **Zoom calculation** — given (paneWidth, targetViewport), returns correct zoom value. Covers: target fits in pane (zoom=1), target exceeds pane (zoom=ratio), edge cases (zero width, equal widths).
2. **Viewport cycling** — given current viewport and list of viewports, returns next viewport (with wraparound).
3. **Iframe dimensions** — given (paneWidth, targetViewport), returns correct iframe width and zoom. Covers split vs single mode implicitly through different pane widths.
4. **Data format** — the existing pipeline integration test verifies the output shape; extend it to check for the new `viewports` field.

**Prior art:** `visual-regression/src/__tests__/pipeline.integration.test.ts` for the data pipeline. New UI logic tests would be simple unit tests (vitest) for extracted pure functions.

**What NOT to test:** DOM rendering, button click handlers, localStorage persistence, ResizeObserver wiring. These are browser integration concerns best verified manually.

## Out of Scope

- Per-viewport HTML capture switching (loading `html-768/` instead of `html/` based on selected viewport). This is future work — the UI will be ready for it.
- Per-viewport diff results or viewport-specific diff panel content.
- Device frame/chrome around the iframe (phone outline, etc.).
- Pinch-to-zoom or additional zoom override on top of viewport selection.
- Viewport-specific highlighting or overlay positioning adjustments.

## Further Notes

- CSS `zoom` is supported in all modern browsers including Firefox 126+ (June 2024). No polyfill needed.
- The captured HTML preserves CSS media queries, so resizing the iframe width does trigger CSS-only responsive changes. JS-driven responsive logic (useMediaQuery, Chakra responsive props) will NOT respond — that requires loading the actual per-viewport HTML capture (future work).
- The `data-vr-idx` attributes in captured HTML are viewport-specific. When per-viewport switching is implemented, highlights will need to use the correct manifest for the active viewport.
