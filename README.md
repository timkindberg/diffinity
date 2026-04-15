# Visual Regression Baseline Capture

Captures "before" and "after" screenshots of VNDLY pages for the Canvas v4 token rebrand.
Uses Playwright with mocked API data for consistent, repeatable captures.

## Setup

```bash
cd visual-regression
npm install
npx playwright install chromium

# Copy env template and adjust if needed
cp env.example .env

# Create dedicated test users in local DB (requires Django running)
npm run setup-users
```

## Usage

### Full before → after → compare pipeline

```bash
npm run sana:report
```

This runs `run-comparison.sh` which toggles the `sana_rebrand_enabled` feature flag off/on and captures before/after automatically, then generates the comparison report.

### Capture baselines (before rebrand)

```bash
npm run capture:before          # All pages
npm run capture:before -- --page home  # Single page
```

### Capture after rebrand

```bash
npm run capture:after           # All pages
npm run capture:after -- --page home   # Single page
```

### Compare before vs after

```bash
npm run compare
```

Produces `screenshots/report-data.js` consumed by `screenshots/report_v2.html`. Open `report_v2.html` in a browser to view the interactive side-by-side HTML diff with semantic change descriptions, importance-ranked diff items, color swatches, and element highlighting.

### Debug a single page in a headed browser

```bash
npx tsx src/debug-page.ts --page home --role employer
```

Opens the page with all mocks applied in a visible browser window, then pauses so you can inspect it.

### Semantic diff (HTML-based)

```bash
# Generate synthetic "after" data from before captures (for testing)
npm run capture:after:faked

# Run semantic comparison (element matching + diff)
npm run compare
```

The report features:
- **Magnitude-aware scoring** — diffs ranked as critical/major/moderate/minor. Scoring accounts for property dominance (e.g., `background-color` weighs more than `border-width`), change magnitude (color distance with alpha/opacity support, pixel deltas), diminishing returns for same-category changes, and visual area weighting (larger elements score higher)
- **Humanized names** — "Header Cell 'Work Type'" not `thead > tr > th[name="Work Type"]`
- **Smart grouping** — elements sharing identical changes collapsed into "Multiple Similar ×N" items; px-delta cascade clustering groups layout-shift noise
- **Two-row diff items** — badges row (importance + type) then title, scannable at a glance
- **Hover highlighting** — hover a diff item to flash-highlight the element in the before/after views with contextual labels ("before"/"after", "removed"/"added", "moved"); groups highlight all members at once. Animation: 100ms flash → 0.5s ease-out fade → border pulse
- **Color swatches** — inline before/after color squares for all color properties (including collapsed "foreground color" and "border-color"), with alpha/opacity displayed
- **Keyboard navigation** — arrow keys, `[` to toggle panels, 1/2/3 for view modes, F for zoom

## How it works

Each page has a definition in `src/pages/{page-id}.ts` that:
1. Declares the URL path and applicable roles (employer/vendor)
2. Sets up `page.route()` interceptors with mock API responses
3. Provides mock data that fills the page with realistic content

The capture script:
1. Launches headless Chromium
2. Logs in via API (two-step: identity + password)
3. Wraps `page.route()` to record which patterns were registered and which URLs were intercepted
4. Sets up route mocks per the page definition
5. Navigates to the page and waits for it to load
6. Waits for DOM stability (no mutations for 1 second)
7. Freezes JS timers/animations to prevent state drift
8. Takes a full-page screenshot (used as the live reference)
9. Captures the DOM manifest (element tree with styles, bbox, accessible names)
10. Captures the HTML via JSON DOM serialization + programmatic reconstruction
11. Verifies HTML fidelity by pixel-comparing the reconstructed HTML against the live screenshot
12. Saves manifests and validation results

## HTML Capture — JSON DOM Reconstruction

Instead of serializing via `outerHTML` (which goes through the HTML5 parser and "corrects" invalid nesting), the capture pipeline:

1. **Inlines all resources** — external stylesheets become `<style>` tags, CSS `url()` references and `<img>` sources become data URIs
2. **Serializes the DOM to a JSON tree** — walks the live DOM using `toJsonNode()`, capturing `nodeType`, `tagName`, `namespaceURI`, attributes, and children recursively
3. **Generates a reconstruction HTML** — a minimal HTML file with the `<head>` content (CSS) parsed normally, plus a `<script>` that rebuilds the `<body>` using `createElement`/`appendChild`
4. **Extracts assets** — data URIs are extracted to content-hashed files in a shared `_assets/` directory

This approach bypasses the HTML5 parser entirely for the body, preserving "invalid" nesting that React creates via DOM APIs (e.g., `<div>` inside `<tr>`, `<p>` inside `<p>`, `<a>` inside `<a>`). The browser tolerates these structures when built programmatically — it only "corrects" them during HTML parsing.

**Fidelity verification**: After writing the reconstruction HTML, the capture script opens it in a new browser tab, screenshots it, and pixel-compares against the live page screenshot. Typical result: 28+ of 45 pages pixel-perfect, remainder <0.1% diff from subpixel font rendering (`https://` vs `file://` protocol).

## Validation — how captures pass/fail

The capture script validates each screenshot automatically:

- **PASS** — no unmocked APIs, no DOM errors, no actionable console errors
- **FAIL** — any of: unmocked API (4xx), visible error state in DOM, actionable console error

After a PASS the script also reports **WARNINGS** (empty states, console warnings) which don't
block but usually indicate a missing or malformed mock worth fixing.

## Manifests — API regression baseline

Every successful capture writes a sidecar manifest file alongside the screenshot:

```
screenshots/before/
  home--employer/
    1440.manifest.json   ← saved automatically
    dom-manifest-1440.json
    html-1440/
      index.html         ← JSON DOM reconstruction
```

The manifest records:
- **`mockedRoutePatterns`** — the `page.route()` patterns the page definition registered
- **`interceptedUrls`** — the actual URLs that were handled by our mocks (with real query params)
- **`unmockedUrls`** — any requests that hit the real server with 4xx (should be empty on PASS)
- **`domErrors`** / **`warnings`** — DOM state at capture time
- **`consoleErrors`** / **`consoleWarnings`** — actual error text + count of benign errors

**Why manifests matter:** When the app changes and you re-run captures months later, the
manifest tells you the *baseline* state. If a capture that used to pass now fails with
new unmocked URLs, you know exactly what changed — the manifest shows what the page called
last time vs what it calls now. The delta is the fix.

## Re-validating / fixing an existing page

When a previously-passing page starts failing (app changed, new APIs added, shapes changed):

1. Run the capture for that page: `npm run capture:before -- --page {page-id}`
2. The script reports UNMOCKED APIs — new endpoints the app now calls that aren't mocked
3. Compare against the manifest to understand what changed:
   - New URL in `unmockedUrls` that wasn't there before? → add a `page.route()` mock for it
   - URL disappeared from `interceptedUrls`? → endpoint was renamed/removed, update the mock pattern
4. Read the app source to understand the new endpoint's response shape
5. Update `src/pages/{page-id}.ts` with the new/updated mock
6. Re-run until the capture passes again
7. The new manifest replaces the old one as the updated baseline

## Django Template Pages

Some pages (job-detail, job-edit, work-order-detail, etc.) are **server-rendered by Django**
rather than client-rendered by Next.js. These need a **two-layer mocking approach**:

1. **Layer 1 — Django middleware** renders the HTML template with mock context data
2. **Layer 2 — Playwright route mocks** handle API calls from React components embedded in the page

### How it works

A real Django middleware (`vr_django.middleware.VRMockMiddleware`) intercepts requests matching
registered URL patterns and calls `django.shortcuts.render()` with a mock context dict — instead
of executing the real view (which would need real DB data). The middleware runs **after**
auth/session/tenant middleware, so `request.user`, `request.tenant`, and template tags like
`feature_flag_enabled`, `l10n_format`, and `render_bundle` all resolve naturally.

### Activation

Set `VR_MODE=1` in the **main app's** `.env` file (not this project's `.env`). The middleware
is only added when both `DEBUG=True` and `VR_MODE` is non-empty. No app restart is needed if
using gunicorn with `--reload`, but allow ~8 seconds for the worker to respawn.

```bash
# In the main vndly2/.env file:
VR_MODE=1
```

### Architecture

```
visual-regression/
└── vr_django/                          # Importable by main Django app
    ├── middleware.py                    # VRMockMiddleware — intercepts URLs, renders templates
    ├── contexts/
    │   ├── __init__.py                 # Auto-imports all context modules to trigger registration
    │   └── job_detail.py               # Mock context for /jobs/job_details/<id>/
    └── (add more context modules here)
```

The main app's `vndly/common.py` (settings) conditionally adds the middleware and puts
`visual-regression/` on `sys.path` so `vr_django` is importable.

### Adding a new Django page mock

1. **Find the real view and template.** Look for the URL pattern in `app/*/urls.py` and the
   view function that calls `render(request, 'some/template.html', context)`. Note the template
   name and all context keys.

2. **Create a context module** at `vr_django/contexts/{page_name}.py`:

   ```python
   from types import SimpleNamespace
   from vr_django.middleware import register_mock

   def build_context(request, **kwargs):
       # request.user and request.tenant are real — use them
       return {
           'user': request.user,
           'some_object': SimpleNamespace(id=1, name='Mock Name'),
           # ... all context keys the template accesses
       }

   register_mock(
       url_pattern=r'^/some/url/pattern/\d+/',
       template_name='app/template.html',
       context_builder=build_context,
   )
   ```

3. **Register the import** in `vr_django/contexts/__init__.py`:

   ```python
   from vr_django.contexts import job_detail  # noqa: F401
   from vr_django.contexts import your_new_page  # noqa: F401
   ```

4. **Mock the embedded React APIs** in `src/pages/{page-id}.ts` — Django renders the HTML
   shell, but React components that mount inside it still fetch data via API calls. These need
   Playwright `page.route()` mocks just like any other page.

5. **Set `django: true`** on the PageDefinition so the capture script knows this page relies
   on Django middleware.

### Key patterns for Django mock context

- **SimpleNamespace** instead of model instances — Django templates use `getattr()` which
  works on SimpleNamespace. Example: `SimpleNamespace(id=1, name='Engineering')`.

- **FakeManager** for M2M / related-manager fields — templates call `.all()`, `.count()`,
  `.order_by()`, etc. See `_make_manager()` in `vr_django/contexts/job_detail.py` for a
  reusable pattern.

- **`date` objects, not strings** — template tags like `l10n_format` call `.isoformat()`,
  so use `from datetime import date` and `date(2026, 5, 1)`.

- **Real helper functions where safe** — e.g., `get_job_form_config()` reads from DB/cache
  using the real tenant, which is correct. Only fake the model instance, not the config.

### Debugging Django pages

- Check gunicorn logs for `[VR]` prefixed messages (middleware logs interceptions and errors)
- If the middleware isn't intercepting, verify `VR_MODE` is set and gunicorn restarted
- Template errors return a 500 with a full traceback in the response body
- Webpack dev server must be running — `{% render_bundle %}` blocks for 45s if
  `webpack-stats.json` shows `"status":"compiling"`

## Adding a new page

### Step 1: Identify the page type

- **Next.js page** → file under `pages/` (e.g., `pages/settings/users/index.tsx`). Only needs Playwright API mocks.
- **Django template page** → rendered by a Django view via `render(request, 'template.html', context)`. Needs both a Django mock context (Layer 1) and Playwright API mocks for embedded React (Layer 2). See "Django Template Pages" above.

### Step 2: Find the source code and trace API calls

- Check `pages/` for the Next.js route, then trace into `assets/js/{feature}/` for components
- Look at React Query hooks in `assets/js/api/` for API endpoint URLs and response shapes
- Pay attention to filter sidebars — each filter dropdown has its own `optionsFromApi` URL
- Check for config endpoints, permissions endpoints, feature flags

### Step 3: Create the page mock file

Create `src/pages/{page-id}.ts` following existing pages as a reference:

```typescript
import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated } from '../mock-utils.js'

export const myPage: PageDefinition = {
  id: 'my-page',
  name: 'My Page',
  path: '/my/page/',
  roles: ['employer'],       // or ['employer', 'vendor']
  fullPage: true,             // capture full scrollable page
  // django: true,            // add for Django template pages

  async waitForReady(page: Page) {
    await page.waitForSelector('text=Expected Content', { timeout: 20000 })
    await page.waitForTimeout(1500)
  },

  async setup(page: Page, _role: Role) {
    // Mock ALL API endpoints the page calls on load
    await page.route('**/api/v2/accounts/me/', (route) => /* ... */)
    await page.route('**/api/v2/nav/config', (route) => /* ... */)
    await page.route('**/api/v2/client/feature-flags/**', (route) => /* ... */)
    // ... page-specific APIs ...
  },
}
```

Common mocks needed by most pages: `accounts/me`, `nav/config`, `feature-flags/**`, `user_tasks`, `contact-us-config`. Use `paginated()` from `mock-utils.ts` for all list/paginated API responses.

### Step 4: Register the page

Add import and entry in `src/pages/index.ts`.

### Step 5: Iterate until PASS

```bash
cd visual-regression
npx tsx src/capture.ts --page my-page --width 1440
```

The capture script validates automatically — check its output for:
- **UNMOCKED APIs** — add a `page.route()` mock for each
- **DOM ERRORS** — a mock is missing or returning wrong data
- **CONSOLE ERRORS** — non-benign errors (benign ones are auto-suppressed)

Fix issues and re-run until the script exits 0 (PASS).

### Step 6: Visually verify

After PASS, check the screenshot to confirm:
- Tables have rows, lists have items, cards have content
- No spinners stuck or loading states
- No blank white areas where content should be
- Data looks realistic and varied

## DOM Manifest

Each page capture also produces a **DOM manifest** (`dom-manifest-{width}.json`) — a recursive tree of every
visible element with computed styles, bounding boxes, text content, attributes, and accessible names.
This is the foundation for semantic diffing (comparing before/after at the element level rather than pixel level).

- ~90 visually meaningful computed style properties per element (box model, typography, visual, layout, positioning)
- Accessible names via CDP (W3C spec — same algorithm as testing-library's `getByRole` name matching)
- Each element gets a `data-vr-idx` attribute in the live DOM during capture, persisted into the HTML snapshot
- Filters out visually hidden elements (0×0px, ≤1×1px Chakra "visually hidden" pattern, `display:none`, `visibility:hidden`, `opacity:0`)
- Captured once per page+role at 1440px viewport
- Typical: 300-700 elements, ~1MB, 250-450ms capture time

**Important order dependency**: `captureDomManifest` runs *before* `capturePageHtml` in `capture.ts`. The manifest step tags elements with `data-vr-idx` in the live DOM; the HTML step then captures those tags. This coupling is tested in `pipeline.integration.test.ts` and will break if reordered.

**Viewport limitation**: DOM manifest and semantic diff are currently computed at 1440px only. The report's zoom feature uses `transform: scale()` + iframe width changes, which triggers CSS media queries inside the iframe — meaning styles may change at different zoom levels, but the diff data only reflects 1440px.

## Semantic Diff Pipeline

The semantic diff pipeline runs offline on captured data (no live app needed):

1. **Load** before/after `dom-manifest-{width}.json` files for each page+role
2. **Match** elements between trees using A-smart algorithm (`match.ts`) — scores identity signals (testId, id, role, accessible name, text, classes, ancestor path) and greedily pairs highest-scoring matches
3. **Diff** matched pairs (`diff.ts`) — compares styles, text, bbox, attributes; generates human-readable `Change[]` with magnitude-aware scoring (color distance including alpha, pixel deltas, property dominance, area weighting, diminishing returns)
4. **Consolidate** (`consolidateDiffs()`) — reduces noise by suppressing descendant changes, dropping bbox/position-only diffs, cascade clustering
5. **Clean** captured HTML — strips capture-only CSS (animation/transition freeze used for deterministic screenshots) and any previously injected scripts
6. **Inject** highlight script into HTML files — enables hover-to-highlight in the report
7. **Write** `report-data.js` — consumed by the static `report_v2.html` UI

Run: `npm run compare`

## Structure

```
visual-regression/
├── README.md                # This file — entry point for agents and humans
├── run-comparison.sh        # Full pipeline: toggle FF → capture before → toggle FF → capture after → compare
├── PRDs/                    # Design documents (historical reference)
├── vr_django/               # Django middleware + mock contexts (imported by main app)
│   ├── middleware.py        # VRMockMiddleware — URL interception + template rendering
│   └── contexts/            # One file per Django page with mock context builder
│       ├── __init__.py      # Auto-imports all context modules
│       └── job_detail.py    # Reference Django mock — read this first
├── src/
│   ├── config.ts            # Base URL, credentials, viewport settings
│   ├── auth.ts              # API login flow
│   ├── types.ts             # PageDefinition, ElementNode, DiffResult types
│   ├── mock-utils.ts        # paginated() helper for OffsetLimitPaginationResponse shape
│   ├── capture.ts           # Main capture runner (validates, saves manifests, captures HTML, fidelity verification)
│   ├── html-capture.ts      # JSON DOM serialization + reconstruction HTML generation (asset extraction, resource inlining)
│   ├── dom-manifest.ts      # DOM manifest capture (styles, bbox, text, accessible names via CDP)
│   ├── debug-page.ts        # Open a single page with mocks in a headed browser for inspection
│   ├── match.ts             # Element matching (A-smart: flat + ancestor paths + greedy scoring)
│   ├── cascade-cluster.ts   # Layout-shift noise clustering for diff consolidation
│   ├── diff.ts              # Semantic diff engine + consolidateDiffs() noise reduction (color distance with alpha)
│   ├── compare-v2.ts        # Semantic diff pipeline — loads manifests, matches, diffs, writes report-data.js
│   ├── capture-faked-after.ts # Generates synthetic "after" data by mutating "before" captures
│   ├── setup-users.ts       # Creates VR test users in local DB
│   ├── report/
│   │   └── highlight-listener.js  # Injected into captured HTML — handles postMessage hover highlighting
│   ├── __tests__/
│   │   ├── match.test.ts          # Unit tests for element matching
│   │   ├── diff.test.ts           # Unit tests for semantic diffing
│   │   ├── consolidate.test.ts    # Unit tests for diff consolidation
│   │   └── pipeline.integration.test.ts  # Integration tests (full pipeline in real browser)
│   └── pages/               # One file per page with route mocks
│       ├── index.ts         # Page registry
│       ├── home.ts          # Reference implementation — read this first
│       └── ...
└── screenshots/             # All gitignored except report_v2.html
    ├── report_v2.html           # Interactive semantic diff report UI (committed source)
    ├── report-data.js           # Generated by compare-v2.ts (gitignored)
    ├── before/                  # Baseline captures (gitignored)
    │   ├── _assets/             # Shared fonts/images (content-hashed, deduped across pages)
    │   ├── _validation.json     # Machine-readable capture results (includes fidelity data)
    │   └── {page}--{role}/      # Per-page folder
    │       ├── 1440.manifest.json
    │       ├── dom-manifest-1440.json   # DOM tree with styles, bbox, accessible names
    │       └── html-1440/
    │           └── index.html           # JSON DOM reconstruction (refs ../../_assets/)
    ├── after/                   # Post-change captures (same structure, gitignored)
    └── diff/                    # Diff images from pixel compare (same nested structure)
```
