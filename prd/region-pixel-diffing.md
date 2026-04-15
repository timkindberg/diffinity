# PRD: Region-Level Pixel Diffing (Semantic-First, Pixel-to-Confirm)

## Problem

The semantic diff engine reports property-level changes (e.g., `background-color` changed from X to Y) but cannot detect rendering-level issues: font substitution, SVG rendering bugs, image corruption, subpixel layout quirks. Full-page pixel diffing solves this but generates overwhelming false positives from anti-aliasing and cascade noise.

## Goal

Automatically produce cropped before/after pixel diffs of the specific regions that changed, scoped by the semantic diff output. Semantic diff tells us *what* changed; region pixel diff confirms *how it actually renders*.

## Proposed Approach

### Core Flow

1. Semantic diff runs as today (match → diff → consolidate → cluster)
2. For each diff item, look up its bounding box from the DOM manifest
3. Apply size filtering (see below) to decide which elements get pixel captures
4. Crop the corresponding region from the before/after full-page screenshots (already captured as `live.png`)
5. Run pixelmatch on the cropped pair
6. Attach the cropped before/after/diff images to the report item

### Size Filtering Strategy

Large regions (full-width containers, page sections) would produce pixel diffs as noisy as full-page diffs. Strategy is automatic with an opt-in escape hatch.

**Automatic (preferred):**

- **Max area threshold** — skip pixel capture for elements exceeding a configurable area (e.g., 500,000 px², roughly a 1000x500 region). These are layout containers, not visual components.
- **Min area threshold** — skip elements below ~100 px² (tiny invisible overflows, 1px borders). Not useful as pixel crops.
- **Aspect ratio guard** — skip elements that are extremely wide and short (e.g., full-width dividers, 1400x2px) or tall and narrow. These are structural, not visual. Threshold: skip if either dimension is >10x the other.
- **Depth heuristic** — prefer deeper DOM nodes (leaf-ish components) over shallow ancestors. If both a container and its child are in the diff, only pixel-capture the child. The consolidation pipeline already suppresses descendant diffs of removed/added elements; extend this logic to prefer descendants for pixel capture too.
- **Cluster exclusion** — cascade cluster members (the "89 elements all shifted 18px" groups) should not get individual pixel captures. Optionally capture a single representative member.
- **Group sampling** — for "Multiple Similar x N" fingerprint groups, capture 1-2 representatives, not all N.

**Manual override (`data-vr-region`):**

- Developers can add `data-vr-region` (or `data-vr-el`) to any element to force pixel capture regardless of size thresholds
- Use case: large but visually important regions (hero sections, data tables, charts) that the automatic filter would skip
- The DOM manifest capture already reads attributes — just add this to the picked attribute list
- Elements marked with `data-vr-region` bypass all automatic size/aspect filters

**Configurable thresholds:**

```typescript
regionCapture: {
  maxArea: 500_000,       // px² — skip larger elements
  minArea: 100,           // px² — skip tiny elements
  maxAspectRatio: 10,     // skip if width/height or height/width > 10
  padding: 8,             // px — padding around the crop box for context
  maxPerPage: 30,         // cap total captures per page to bound output size
}
```

### Cropping Implementation

- Source: existing `live.png` full-page screenshots (already captured before DOM instrumentation)
- Use `pngjs` to crop — read the full PNG, extract the bounding box region (+padding), write as a new PNG
- Before/after crops must use identical coordinates (from matched element pair's bounding boxes). If element moved, use the union of both bounding boxes.
- When a diff item is a group, compute the bounding box of the group (union of all member bboxes) — if within thresholds, capture it; otherwise fall back to representative sampling.

### Report Integration

Each diff item in the report gains an optional image section:

- Thumbnail before/after side-by-side (inline in the diff list)
- Pixel diff overlay image (red highlights on changed pixels)
- Click to expand to full-resolution view
- Mismatch pixel count + percentage shown as a badge

For items without pixel captures (filtered out by size), the report shows the existing property-level diff only — no loss of current functionality.

## Scoring Refinement (Companion Enhancement)

The pixel diff results can feed back into scoring:

- If semantic diff says a property changed but the pixel crop shows 0 mismatched pixels → auto-downgrade to "minor" (the change is invisible at render time)
- If pixel crop shows significant mismatch but semantic diff scored low → boost the score (rendering-level issue the semantic engine undervalued)
- This creates a feedback loop: semantic scopes the region, pixel validates the impact

## Considerations

- **Screenshot timing**: the `live.png` is captured before DOM manifest instrumentation, so `data-vr-idx` overlays are not present. This is already correct for pixel comparison.
- **Scroll position**: bounding boxes in the DOM manifest are relative to the viewport scroll position (captured via `window.scrollX/Y`). Full-page screenshots include the entire scroll height. Need to map bbox coordinates to absolute screenshot coordinates.
- **Output size**: each cropped PNG is small (a few KB), but 30 per page x 37 pages x 2 phases = ~2200 files. Use the shared `_assets/` directory pattern with content hashing to deduplicate identical crops.
- **Fidelity**: before/after screenshots are taken on different browser sessions. Subpixel rendering differences between sessions could cause false pixel diffs. The existing pixelmatch threshold (0.1) should absorb most of this, but worth monitoring.

## Effort Estimate

| Step | Effort |
|------|--------|
| Crop utility (pngjs-based region extraction) | Small |
| Size filtering logic | Small |
| `data-vr-region` attribute pickup in DOM manifest | Small |
| Integration into compare pipeline (after consolidation, before report) | Medium |
| Report UI (thumbnail before/after/diff per item) | Medium |
| Scoring feedback loop (pixel validates semantic) | Medium |
| **Total** | ~3-5 days |

## Success Criteria

- Changed elements within size thresholds automatically get cropped before/after/diff images in the report
- No manual configuration needed for typical pages — automatic filtering produces useful captures out of the box
- `data-vr-region` override works for edge cases
- Report load time not significantly impacted (lazy-load images)
- False positive rate on pixel crops is low (<5%) since they are scoped to regions with known semantic changes

## Non-Goals

- Replacing the semantic diff engine — pixel crops are supplementary, not primary
- Full-page pixel diffing — explicitly avoided; that's the problem we're solving
- AI-based region detection — automatic heuristics + manual override is sufficient
