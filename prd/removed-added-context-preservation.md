# PRD — Preserve Viewport Context for Removed/Added Elements

**Date:** 2026-04-24
**Source:** Extracted from `vndly-integration-feedback.md` (Issue 2b)
**Priority:** Medium. Affects reviewability of structural diffs in tables,
overflow-hidden containers, and offscreen regions.

---

## Problem

When a diff of type `removed` is hovered in the report, the **before** viewport
correctly highlights the removed element. The **after** viewport shows nothing
and doesn't scroll. If the removed element lived inside a scrollable /
overflow-hidden region, the reviewer can't see the same area in "after" to
visually confirm the removal landed in the right place.

By symmetry the problem exists for `added` diffs: the **before** pane has
nothing to highlight and doesn't scroll.

**Concrete example from VNDLY integration:**
`candidate-timesheets--vendor` has three removed cells at `x=1364` on a
1440-wide viewport — far right of a horizontally-scrolling table. The
"before" pane shows them highlighted (at their original scroll-visible
position via capture). The "after" pane stays wherever it was, typically
not scrolled to that region.

## Goal

For `removed` diffs, highlight or scroll-to the **nearest surviving ancestor**
in the "after" viewport so both panes show the same region. Symmetric for
`added` diffs in the "before" viewport.

## Non-goals

- Do not attempt to render a ghost of the removed element (too heavy and
  potentially misleading).
- Do not auto-scroll if the opposite pane is already viewing the relevant
  region (avoid fighting the user).

## Design sketch

### Data model

Extend `ElementDiff` in `diff.ts`:

```ts
export type ElementDiff = {
  // … existing fields …
  /** For `removed` diffs: idx in the AFTER tree of the nearest surviving ancestor. */
  ancestorAfterIdx?: number | null
  /** For `added` diffs: idx in the BEFORE tree of the nearest surviving ancestor. */
  ancestorBeforeIdx?: number | null
}
```

### Computation

During diff generation:
- For each `removed` element with `beforeIdx = X`, walk the BEFORE tree up
  from X's parent. For each ancestor, check the match map for a corresponding
  `afterIdx`. First hit wins → store as `ancestorAfterIdx`.
- Symmetric for `added`.
- If no ancestor matches (very rare — implies root-level restructure), leave
  null and the report falls back to "no scroll".

This requires either:
- Adding a `parentIdx?` to `ElementNode` (small change), or
- Deriving parent from the tree walk already in `flattenTree` (match.ts
  already has `ancestorPath`, but it's string labels, not idx — would need
  idx path too).

### Report UI behavior

In `highlight-listener.js`:
- When an element for the current phase is missing, but the message payload
  includes an `ancestorIdx` for this phase, query for that and apply a
  "context" highlight: dashed outline, ~60% opacity, with a label like
  "removed from here" or "will appear here".
- Scroll the ancestor into view using the existing scroll logic.

In `highlight.ts`:
- Extend `highlightElement()` signature to accept ancestor idx fallback.
- Thread through to `postMessage` payload.

## Acceptance criteria

- Hovering a `removed` diff: after pane scrolls to closest surviving ancestor
  with a dashed/ghost outline.
- Hovering an `added` diff: before pane scrolls to closest surviving ancestor
  with a dashed/ghost outline.
- Hovering a `changed` or `moved` diff: no change from today.
- Group/multi hover: if members include removed/added, handle gracefully
  (may skip ancestor-highlighting when multiple ancestors would conflict,
  or pick the deepest shared ancestor).

## Edge cases

- Ancestor itself also appears in another diff (e.g. changed): need to pick
  a visual treatment that doesn't collide with a primary highlight on the
  same element.
- Removed element was direct child of `<body>`: ancestor is `<body>`;
  scrolling to body is a no-op. Fine — document it.
- Iframe content: out of scope for now; ancestor path stops at the iframe
  boundary.
- Multiple removed siblings: probably all resolve to the same ancestor;
  de-dup the context highlight to one outline.

## Open questions

- Should the context outline color match the diff type (red for removed,
  green for added) at low opacity, or stay neutral gray to avoid implying
  the ancestor itself changed?
- Include a small arrow/indicator pointing to "where the element was"
  inside the ancestor? Probably v2.
- Should we add a user setting to disable auto-scroll for users who prefer
  to navigate manually?
