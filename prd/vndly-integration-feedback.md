# Diffinity Issues — Discovered via VNDLY Integration

**Written:** 2026-04-24
**Diffinity commit:** `6ae97b3` (chore: switch to source-available license…)
**VNDLY commit:** `78afd11abf3` on branch `spike/diffinity-integration`
**Run data source:** `visual-regression/screenshots/report-data.js` produced by
`npm run report:faked` on 2026-04-24 ~13:42 EDT.

Feedback captured while reviewing `npm run report:faked` output on the VNDLY app.

> **Framing:** "I can't easily see the visual difference" does **not** mean the
> diff should be reclassified as non-visual. A real padding change *is* a visual
> change — even a 1px shift — and that's exactly why diffinity is valuable: it
> catches things the eye misses. The question these issues raise is whether the
> **report UI is doing its job of showing me the change** (padding overlays,
> tight highlight scope, scrolled-into-view context) so I can confirm it.

---

## Open bugs to fix NOW

### Issue 1 — Padding highlights not appearing on multi-similar padding diff

**Where seen:** `approvals--employer`. Diff group labeled "multi-similar ×2"
targeting the top-nav `<button>`s for **Jobs** and **People**.

**Data (from `report-data.js`):**

- `padding-top`: `12px → 10px` (−2)
- `padding-right`: `12px → 20px` (+8)
- `padding-bottom`: `12px → 10px` (−2)
- `padding-left`: `12px → 20px` (+8)
- `border-radius`: `4px → 8px` (already collapsed from 4 corners — good)
- Members: Button "Jobs" (beforeIdx=5, afterIdx=5), Button "People" (9/9)
- `importance: major`, `score: 68`
- Buttons get ~16px wider total. Real, measurable, visually meaningful.

**Root cause (confirmed in source):**

`DiffPanel.tsx` hover on a multi-similar **group** calls:

```ts
onMouseEnter={() => highlightMulti(group.members, group.type)}
```

— no `changedProps` passed.

`highlight.ts` → `highlightMulti()` signature doesn't accept `changedProps`,
so they can't be threaded through to the iframe.

`highlight-listener.js` → `'highlight-multi'` branch (lines 415-428) calls
`highlightSingle()` per member but **never** calls `drawBoxModelOverlays()`.
Only the `'highlight'` branch (line 408) calls the overlay fn.

Same bug applies to group-member hover (`:514`) and cascade hover/member
(`:549`, `:584`) — all drop `changedProps`.

**Fix sketch:**

1. Extend `highlightMulti(members, type, changedProps?)` signature.
2. Extend `'highlight-multi'` postMessage payload with `changedProps`.
3. In the listener, after `highlightSingle()` per member, also call
  `drawBoxModelOverlays(el, changedProps)`.
4. Update `DiffPanel.tsx` call sites (group hover, group-member hover,
  cascade hover, cascade-member hover) to pass changed props — from
   `group.changes` via `getChangedProps()`.

---

### Issue 1b — Padding quad should collapse to `padding` shorthand even when sides differ

**Where seen:** Same approvals buttons. Report shows **four** separate
padding-* changes instead of one `padding: 12px → 10px 20px`.

**Why this matters:** diff groups are fingerprinted by their change set. If
each page's padding changes expand into 4 properties, the fingerprint for
"this component's padding changed" varies unnecessarily, bloats the sidebar,
and makes the report feel noisier than it is. Also, the listener's box-model
overlay code already supports the `'padding'` shorthand as "all 4 sides".

**Root cause (confirmed in source):**

`collapseQuad()` in `diff.ts:474` collapses 4 side properties into a shorthand
**only when all 4 before→after deltas are identical**:

```ts
const allSame = quadChanges.every(c =>
  c!.before === first.before && c!.after === first.after
)
if (!allSame) return changes
```

CSS `padding` shorthand supports non-uniform values too:

- 1 value: all 4 sides (current behavior)
- 2 values: `vertical horizontal`
- 3 values: `top horizontal bottom`
- 4 values: `top right bottom left`

So the collapse should always fire when all 4 sides are present, and emit the
shortest shorthand form that reproduces the input.

**Concrete expected outputs for our two real cases:**


| Page                         | Before sides (T R B L) | After sides (T R B L) | Collapsed change                 |
| ---------------------------- | ---------------------- | --------------------- | -------------------------------- |
| `approvals` buttons          | 12 / 12 / 12 / 12      | 10 / 20 / 10 / 20     | `padding: 12px → 10px 20px`      |
| `candidate-timesheets` cells | 20 / 15 / 20 / 15      | 14 / 16 / 14 / 16     | `padding: 20px 15px → 14px 16px` |


Apply the same to margin quad.

**Fix sketch:**

1. Replace `collapseQuad` with a version that always fires when all 4 sides
  are present and emits the minimal-length shorthand form per side.
2. Add a helper `formatQuadValues(t, r, b, l)` that returns the canonical
  CSS shorthand string.
3. Keep existing behavior for `border-radius`, `border-width`, `border-color`,
  `border-style` quads — those collapse to a single value today when all 4
   match. Decide separately whether they should also support multi-value
   shorthand (likely yes for consistency).

---

### Issue 3 — Same pattern as Issue 1, different page

**Where seen:** `candidate-timesheets--vendor`. Diff group "multi-similar ×3".

**Data:**

- `padding-top`: `20px → 14px` (−6)
- `padding-right`: `15px → 16px` (+1)
- `padding-bottom`: `20px → 14px` (−6)
- `padding-left`: `15px → 16px` (+1)
- Members: `Cell "Regular"`, `Cell "6200-ENG Cost allocation…"`,
`Cell "CO-1001 Cost allocation…"`
- `importance: major`

6px vertical shrink per padding side = ~12px per row. Real visual change.

**Root cause:** Same as Issues 1 and 1b. All fixed by the same patch.

---

## Deferred — tracked in separate PRDs

- **Issue 2a — occlusion-aware highlighting** (thead bg change covered by
child cells). Not a bug. See `[occlusion-aware-highlighting.md](./occlusion-aware-highlighting.md)`.
- **Issue 2b — preserve viewport context for removed/added elements** (after
pane stays blank/unscrolled when hovering a removed diff). Enhancement.
See `[removed-added-context-preservation.md](./removed-added-context-preservation.md)`.

---

## Fix order (this PRD)

Fix Issue 1, 1b, 3 together in one patch:

1. Rewrite `collapseQuad` in `diff.ts` to always collapse the 4 sides into a
  CSS shorthand with the minimal number of values.
2. Thread `changedProps` through `highlightMulti()` → `'highlight-multi'`
  postMessage → `drawBoxModelOverlays()` in the listener.
3. Update all four DiffPanel call sites to pass `getChangedProps(group.changes)`
  / equivalent for cascades.
4. Rebuild diffinity (`npm run lib:build`).
5. Re-run `npm run report:faked` in vndly; verify:
  - `approvals` group header now reads `padding: 12px → 10px 20px`
   (plus `border-radius: 4px → 8px`).
  - Hovering the group shows the green padding overlay on both buttons.
  - Hovering a member shows the overlay on just that button.
  - `candidate-timesheets` ×3 group similarly collapses and renders overlay.

