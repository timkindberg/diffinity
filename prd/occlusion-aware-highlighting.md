# PRD — Occlusion-Aware Highlight Annotation

**Date:** 2026-04-24
**Source:** Extracted from `vndly-integration-feedback.md` (Issue 2a)
**Priority:** Nice-to-have. Defer until it causes recurring confusion.

---

## Problem

A parent element can have a genuine computed-style change (e.g. `background-color`)
while every rendered pixel belonging to it is covered by descendants that have
their own solid styles. Diffinity honestly reports the change and the report UI
honestly outlines the element — but the reviewer sees no pixel difference in
the element's own area, which feels like a false positive.

**Concrete example from VNDLY integration:**
`candidate-timesheets--vendor`, `<thead>` element changes
`background-color: rgba(0,0,0,0) → rgb(30,41,59)`. Each `<th>` has its own
solid bg. The thead's new navy is covered in every cell. The outline of the
entire thead implies "all cells changed", but only the few cells whose *own*
bg changed look different.

## Goal

Offer reviewers a lightweight signal that the flagged element's own pixels
are not visible (because descendants occlude them). This preserves the
honest diff signal while explaining why the eye can't see it.

## Non-goals

- Do not filter or hide occluded diffs. The data is real and may matter.
- Do not introduce a pixel-diff pass. We still want to stay semantic-first.

## Sketch of approaches

1. **Runtime occlusion probe (report UI).** When highlighting, sample 3-5
   pixels across the element's bounding box via `document.elementFromPoint()`.
   If none of them return the highlighted element itself, mark it occluded.
   Render a dashed outline and/or a badge like "visually occluded by
   descendants".

2. **Capture-time occlusion flag.** During manifest capture, pre-compute the
   occluded state per element and store it on `ElementNode`. Simpler for the
   report but heavier on capture.

3. **Category-specific annotation only.** Occlusion only matters for visual
   categories (`background-*`, `box-shadow`, `border-*`). Annotate those
   diffs with "parent-visual" flag when the element has non-transparent
   descendant backgrounds covering it.

## Preferred starting point

Option 1 (runtime probe). Zero pipeline changes, purely additive in the
listener. We can promote to capture-time later if the probe proves too
expensive for large pages.

## Acceptance criteria

- Hovering an occluded diff shows a visually distinct outline (dashed or
  lower-opacity) and a label/tooltip indicating occlusion.
- Hovering a non-occluded diff looks identical to today.
- No change to diff JSON schema (for Option 1).
- No new false positives: if occlusion detection is ambiguous, default to
  the normal outline.

## Open questions

- Threshold for "occluded"? Any single visible pixel attributable to self?
  Or some % of bounding box?
- How to handle partial occlusion (e.g. thead with 6 occluded cells and 2
  that show the change)? Probably "fully occluded" is the only actionable
  state.
- Should dashed outline imply "possibly wrong / maybe ignore"? Or stay
  neutral and let the reviewer decide?
