# PRD: Capture Library (Replace before/after with Named Snapshots)

## Problem

The current model is rigidly two-slot: `screenshots/before/` and `screenshots/after/`. This assumes a single A→B comparison, which works for the sana migration but breaks down for:

- Comparing across multiple branches or feature flags
- Re-running a capture without losing the previous one
- Reviewing how the UI evolved over time (A→B→C→D)
- Sharing a capture set with a teammate as a reference point

## Goal

Replace before/after with a capture library. Each capture is a named, timestamped snapshot set. Any two snapshots can be compared.

## Proposed Design

### Storage Layout

```
screenshots/
├── captures/
│   ├── 2026-04-10T14-30-00_pre-sana/
│   │   ├── _meta.json
│   │   ├── _assets/
│   │   ├── home--employer/
│   │   ├── home--vendor/
│   │   └── ...
│   ├── 2026-04-10T15-45-00_post-sana/
│   │   ├── _meta.json
│   │   └── ...
│   ├── 2026-04-12T09-00-00_spacing-fix/
│   │   └── ...
│   └── 2026-04-14T11-20-00_latest/
│       └── ...
├── report_v2.html
└── report-data.js
```

Folder name format: `{ISO-timestamp}_{label}` — timestamp for sort order, label for human identification.

### Capture Metadata (`_meta.json`)

```json
{
  "label": "post-sana",
  "createdAt": "2026-04-10T15:45:00.000Z",
  "branch": "VNDLY-60238-sana-rebrand",
  "commit": "78afd11",
  "baseUrl": "https://cruise.localqa.vndly.com",
  "pageCount": 37,
  "viewports": [{ "width": 1440, "height": 900, "label": "desktop" }],
  "notes": "After enabling sana_rebrand_enabled feature flag"
}
```

Auto-populated from git and config. `notes` is optional (from CLI flag).

### CLI Interface

**Capture:**
```bash
# Basic — auto-timestamps, label required
npm run capture -- --label pre-sana

# With notes
npm run capture -- --label post-sana --notes "FF sana_rebrand_enabled=true"

# Single page retry into existing snapshot (overwrites that page only)
npm run capture -- --label post-sana --page home
```

**List captures:**
```bash
npm run captures

# Output:
# CAPTURES (4 snapshots)
#
#   post-sana          2026-04-14 11:20   37 pages   VNDLY-60238  78afd11
#     After enabling sana_rebrand_enabled feature flag
#   spacing-fix        2026-04-12 09:00   37 pages   VNDLY-60238  a1b2c3d
#   pre-sana           2026-04-10 15:45   37 pages   VNDLY-60238  54454c1
#   baseline-master    2026-04-08 14:30   37 pages   master       e4f5a6b
```

Sorted by timestamp descending (most recent first). Shows label, date, page count, branch, short commit.

**Compare:**
```bash
# By label
npm run compare -- --from pre-sana --to post-sana

# Interactive (if no args) — show list, pick two
npm run compare

# Compare latest capture against a named baseline
npm run compare -- --from baseline-master --to latest
```

**Delete:**
```bash
npm run capture:delete -- --label spacing-fix
```

### Label Resolution

- Labels are unique within the library. Attempting to capture with a duplicate label prompts overwrite confirmation (or use `--force`).
- `latest` is a reserved alias — always resolves to the most recent capture by timestamp.
- Partial label matching: `--from pre` resolves to `pre-sana` if unambiguous. Error if ambiguous.

### Migration from before/after

- `capture:before` and `capture:after` npm scripts become aliases:
  - `capture:before` → `npm run capture -- --label before`
  - `capture:after` → `npm run capture -- --label after`
- `npm run compare` with no args defaults to `--from before --to after` if those labels exist (backward compat)
- `run-comparison.sh` updated to use labels

### What Changes in capture.ts

Minimal — the output directory calculation changes from:
```typescript
const phaseDir = join(config.screenshotDir, phase)          // screenshots/before/
```
to:
```typescript
const captureDir = join(config.screenshotDir, 'captures', `${timestamp}_${label}`)
```

Everything else (page capture, DOM manifest, HTML capture, fidelity check) is unchanged. The `phase` concept is removed from config; `label` replaces it.

### What Changes in compare-v2.ts

Instead of hardcoded `before`/`after` directory paths, accepts two capture directory paths resolved from labels. The diff pipeline itself is unchanged — it already operates on pairs of DOM manifests regardless of where they live on disk.

## Considerations

- **Disk usage**: each capture is ~500MB-1GB (HTML captures with inlined assets). The `_assets/` deduplication helps, but assets are per-capture (not shared across captures) since the app's assets change over time. Consider a `capture:prune` command to delete captures older than N days.
- **Partial captures**: `--page home` into an existing label should overwrite only that page's directory, not the whole snapshot. `_meta.json` tracks which pages were captured.
- **Atomic writes**: write to a temp directory, then rename on success. Interrupted captures shouldn't leave corrupt snapshots in the library.

## Effort Estimate

| Step | Effort |
|------|--------|
| New directory layout + `_meta.json` generation | Small |
| CLI arg parsing (`--label`, `--notes`, `--from`, `--to`) | Small |
| `captures` list command | Small |
| Update `capture.ts` output path | Small |
| Update `compare-v2.ts` input resolution | Small |
| Label resolution (partial match, `latest` alias) | Small |
| Backward-compat aliases for before/after | Small |
| **Total** | ~1-2 days |

## Success Criteria

- `npm run capture -- --label foo` creates a timestamped, labeled snapshot
- `npm run captures` lists all snapshots with metadata
- `npm run compare -- --from X --to Y` compares any two snapshots
- Existing `run-comparison.sh` workflow still works via aliases
- Old before/after directories are no longer created

## Non-Goals

- Cloud storage for captures — local only for now
- Automatic baseline selection (e.g., "compare against master") — manual label selection is fine
- Branching/merging of baselines (that's Applitools territory)
