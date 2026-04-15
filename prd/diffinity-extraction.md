# PRD: Diffinity — Extract & Publish as Project-Agnostic Package

**Status:** Approved
**Date:** 2026-04-14
**Package name:** `diffinity`
**Repo:** `timkindberg/visual-regression` (to be renamed `timkindberg/diffinity`)

## Problem

The visual regression engine is a sophisticated semantic DOM diffing system — not a pixel differ. It captures DOM manifests, matches elements via heuristics, produces magnitude-aware semantic diffs, detects cascade clusters, and generates interactive reports. This is genuinely novel and valuable beyond the VNDLY codebase it was built for.

Currently, the engine is tangled with VNDLY-specific code: 45 page definitions with mock data, VNDLY auth flow, hardcoded URLs, feature flag toggling, and Django middleware integration. This prevents anyone else from using it.

## Goal

Extract the core engine into a publishable npm package called `diffinity`. VNDLY2 (`~/projects/vndly2/visual-regression/`) continues to own all app-specific code and imports `diffinity` as a dependency.

**MVP = v0.1.0 on npm. No new features, no hardening. Just extract, generalize, publish. VNDLY2 must work without regressions.**

## Architecture Decisions

### Input boundary

Diffinity receives a **Playwright `Page` object** — the consumer owns browser launch, auth, navigation, mocking, and "page is ready" determination. Playwright is a **peer dependency**.

```ts
import { capture, compare } from 'diffinity'

// Consumer handles browser, auth, nav, mocking...
// Then hands diffinity a ready page:
const before = await capture(page, { outputDir: './vr', label: 'before', pageId: 'home' })
```

**Why:** The DOM manifest capture (`dom-manifest.ts`) and HTML capture (`html-capture.ts`) need live access to `page.evaluate()`, CDP sessions, and response caches. Passing pre-extracted data would force consumers to replicate the complex DOM walking and HTML inlining logic.

### Public API (MVP)

Two functions + CLI:

```ts
// Library API
capture(page: Page, options: CaptureOptions): Promise<CaptureResult>
compare(before: string, after: string, options?: CompareOptions): Promise<void>
// compare() reads snapshots from disk, runs match+diff+consolidate+cascade, generates report

// CLI (for compare only — capture requires Playwright Page)
npx diffinity compare ./before ./after
```

`compare` always generates the HTML report. A `--json` flag for headless CI output can come later.

**Why:** Most users capture in their test suite (library API) and may want to run compare separately (CLI). Compare and report are one step because you compare *in order to* see results.

### Orchestration

**Consumer owns the page loop.** Diffinity is a library, not a framework. No batch helpers in MVP.

**Why:** Owning orchestration pulls toward owning browser lifecycle, concurrency strategy, and error handling — all things that vary per project. VNDLY2 already has its own capture loop; it just swaps the guts to call `capture()`.

### Output structure

**Diffinity owns internal directory layout.** Consumer picks top-level dir and label. Diffinity writes:

```
<outputDir>/<label>/<pageId>/
  dom-manifest-<width>.json
  html-<width>/index.html
  <width>.manifest.json
<outputDir>/<label>/_assets/
  (shared content-hashed assets)
```

**Why:** `compare()` needs to know where to find manifests and HTML. Consistent internal layout makes this reliable.

### Validation

**What diffinity keeps (capture mechanics):**
- MutationObserver stability wait (wait for DOM to stop mutating for 1s)
- JS timer freeze (deterministic snapshot)
- Fidelity verification (pixel-compare captured HTML vs live screenshot)

**What moves to consumer:**
- Console error detection and benign pattern suppression
- DOM error detection (Chakra alerts, role="alert", etc.)
- Unmocked API route tracking

Consumer can pass a `validate` callback in future versions. For MVP, diffinity just captures.

**Why:** The stability wait and freeze are universally useful capture mechanics. The fidelity check is diffinity validating its own work. Everything else is app-specific — consumers know their error patterns.

### Report

**Preact app bundled to a single self-contained HTML file.**

- Consumer experience: `open report.html` — same as today
- Dev experience: real components, JSX, proper state management
- Bundled via Vite at publish time into one HTML file

**Why:** The current vanilla JS report in a single HTML file will become a bottleneck for adding features (filters, synced scrolling, deep linking). Preact is 3KB, API-compatible with React (easy migration if needed), and bundles trivially to one file.

### Build tooling

- **tsup** for the library (ESM + CJS + `.d.ts`)
- **Vite** for the Preact report (single HTML output)

### Package distribution

- npm package: `npm install diffinity`
- CLI: `npx diffinity compare <before> <after>`
- Playwright as peer dependency

### Repo

Rename existing `timkindberg/visual-regression` to `timkindberg/diffinity`. Preserve git history.

## What's VNDLY-specific (to be removed from diffinity)

| File(s) | What it does | Where it goes |
|---------|-------------|---------------|
| `src/pages/` (45 files) | Page definitions with route mocks | Already in VNDLY2 |
| `src/auth.ts` | VNDLY two-step login flow | VNDLY2 |
| `src/config.ts` | Hardcoded VNDLY URLs, credentials | Replace with generic config |
| `src/mock-utils.ts` | VNDLY pagination helpers | VNDLY2 |
| `src/setup-users.ts` | VNDLY test user DB creation | VNDLY2 |
| `src/capture-faked-after.ts` | Synthetic mutation for testing | VNDLY2 or examples/ |
| `src/debug-page.ts` | Debug helper (VNDLY-specific nav) | VNDLY2 |
| `run-comparison.sh` | Feature flag toggle + pipeline | VNDLY2 |
| `env.example` | VNDLY credentials | Replace with generic |
| BENIGN_PATTERNS in `capture.ts` | 40+ VNDLY-specific error patterns | VNDLY2 |

## What stays in diffinity (the engine)

| File | Purpose |
|------|---------|
| `src/dom-manifest.ts` | DOM tree walker, 90 computed styles, accessible names via CDP |
| `src/html-capture.ts` | Self-contained HTML with inlined resources, PurgeCSS, fidelity check |
| `src/match.ts` | A-smart element matching algorithm |
| `src/diff.ts` | Semantic diffing with magnitude-aware scoring |
| `src/cascade-cluster.ts` | Layout reflow detection and clustering |
| `src/viewport-diff.ts` | Multi-viewport orchestration |
| `src/compare-v2.ts` | Diff pipeline orchestration + report generation |
| `src/report/highlight-listener.js` | Overlay highlighting system injected into captured HTML |
| `screenshots/report_v2.html` | Interactive report (to be rebuilt as Preact app) |
| `src/__tests__/` | All existing tests (match, diff, consolidate, pipeline integration) |

## What's NOT in MVP (future work, no beads now)

- Multi-viewport capture revival
- Noise reduction improvements (7 patterns from diff-analysis.md)
- Color normalization (oklch -> rgb)
- Capture library (named snapshots, any-to-any compare)
- Region pixel diffing
- CI integration helpers
- Synced scrolling, filters, progressive report loading
- Validation hooks / callback API
- Batch orchestration helpers

## VNDLY2 integration path

VNDLY2 already has a copy of all page definitions at `~/projects/vndly2/visual-regression/`. After diffinity is published:

1. `npm install diffinity` in VNDLY2's visual-regression folder
2. Swap local engine imports (`./dom-manifest`, `./html-capture`, `./match`, `./diff`, etc.) for `import { capture, compare } from 'diffinity'`
3. Keep all page definitions, auth, mocking, orchestration loop locally
4. Remove duplicated engine code from VNDLY2

## Implementation phases

### Phase 1: Repo setup & structure
- Rename GitHub repo to `diffinity`
- Update `package.json` (name, version 0.1.0, peer deps, exports)
- Add tsup config for library build
- Set up Vite for report build
- Create `src/index.ts` with public API exports
- Add Preact + Vite scaffolding for report app

### Phase 2: Extract engine
- Create `capture()` function — wraps dom-manifest + html-capture, accepts Page object
- Create `compare()` function — wraps match + diff + consolidate + cascade + report generation
- Remove VNDLY-specific files from repo
- Replace `config.ts` with options-based configuration (no env vars, no hardcoded URLs)
- Refactor `capture.ts` — strip page loop, auth, mocking, validation, benign patterns; keep stability wait, JS freeze, fidelity check
- Update all internal imports

### Phase 3: Report migration
- Port `report_v2.html` to Preact components
- Bundle to single HTML file via Vite
- Wire `compare()` to output the bundled report with embedded data
- Verify report feature parity (sidebar, diff panel, viewport selector, keyboard nav, highlighting)

### Phase 4: CLI
- Add `bin` entry to package.json
- Implement `diffinity compare <before> <after>` command
- Reads snapshot dirs from disk, runs compare pipeline, writes report

### Phase 5: Tests & docs
- Adapt existing tests for new API surface
- Ensure pipeline integration tests still pass
- Write README with getting-started example
- Add examples/ folder with minimal integration sample

### Phase 6: Publish
- Verify VNDLY2 integration works (swap imports, run captures, compare results)
- npm publish v0.1.0
- Tag release on GitHub
