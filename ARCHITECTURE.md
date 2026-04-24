# The Architecture of Diffinity

*A field guide to the clever ideas inside a semantic visual regression engine.*

---

## Prologue: The problem with pixels

Imagine two photographs of the same office, taken a week apart. Something is different. A pixel-diff tool circles the changed pixels with a red marker and hands you the photo. *"312 pixels differ."* Great. Is the building on fire, or did someone move a coffee cup?

Every mainstream visual regression tool — Percy, Chromatic, BackstopJS — works this way. They compare screenshots and highlight color deltas. They cannot tell you *what* changed, only *where*. A 1-pixel border tweak and a complete layout collapse look identical to them: both are "red pixels on a page."

Diffinity takes the photograph and the **architect's blueprints** at the same time, then compares the blueprints. Before it looks at pixels, it reads the DOM like a detective — ninety-some computed styles per element, bounding boxes, accessible names, which CSS rules actually authored each value — and matches elements across time using the same multi-signal reasoning a forensic scientist uses to match DNA.

The result is a report that says: *"The header's background shifted from `#1a1a2e` to `#2d2d44`. Major change."*

This document is about **how**. Not the API (the README covers that), but the clever ideas. The places where CSS's lunacy forced us into surprising corners, and the elegant escapes we found. Each section stands alone — jump to whichever makes you curious.

---

## Part I — The Capture: Freezing a Moving Target

> **Visual metaphor:** *A time-stopped laboratory. A scientist in a clean room, surrounded by frozen clockwork — every gear mid-rotation, every light-ray mid-flight. They reach into the frozen air and pluck out transparent blueprints of the scene.*

### 1. The silent watcher

A web page is never still. React hydrates, icons lazy-load, CSS transitions settle, fonts swap. Screenshotting a moving page produces a different picture every time, which poisons every diff downstream.

Diffinity waits for the page to go quiet. A `MutationObserver` watches `document.body` for any DOM change — child additions, attribute flips, subtree mutations — and every change **resets a one-second timer**. The observer disconnects only when a full second of perfect silence elapses. It is not "wait two seconds and hope"; it is "wait *until* nothing has moved for a beat." Data-driven, not time-driven.

### 2. The freeze-frame

Stability is fragile. The moment you screenshot, a stray `setTimeout` might fire and re-animate the page. So Diffinity **freezes time itself** before capturing:

```javascript
for (var i = 1; i < 100000; i++) { clearTimeout(i); clearInterval(i); }
window.setTimeout = window.setInterval = function() { return 0; };
window.requestAnimationFrame = window.requestIdleCallback = function() { return 0; };
```

Brute-force elegant: cancel every scheduled timer up to 100,000 (enough for any real app), then replace the scheduling APIs themselves with no-ops. The live screenshot and the DOM serialization now see exactly the same moment. The clockwork stops mid-tick.

### 3. Reading the *authored* styles, not the computed ones

Here is where most tools go wrong, and where Diffinity made its most consequential bet.

`getComputedStyle()` is the easy API, but it returns a resolved *result* — a hall of mirrors where the browser has already mixed in UA defaults, cascade overrides, custom property substitutions, and font-stack fallbacks. Diff two such results and you will see phantom changes that no human authored.

Instead, Diffinity walks `document.styleSheets` — the **CSS Object Model**, the source of truth. Every rule, every selector, every property as the author wrote it. For each rule, it runs `querySelectorAll(rule.selectorText)` to find the elements it targets, then records each declared property *and its authored value* into that element's `authoredStyles` map. One sweep through the stylesheets yields authored intent — name and value — for every element in the page.

`var(--x)` references are resolved at capture time. If the author writes `grid-template-columns: var(--cols)` and a theme update changes `--cols` from `1fr 1fr` to `1fr 2fr`, the stored authored value moves with it. The diff engine sees real intent, not indirected text.

This gives Diffinity a second identity for each style property: did a human write this value, or did the browser derive it from the cascade? Crucially, the engine can compare the **authored value** on both sides of a diff. `width: 100%` unchanged in authoredStyles but different in pixels = container reflow, not author change. `width: 100% → width: 50%` in authoredStyles = author change, regardless of pixel delta. That distinction becomes the backbone of noise reduction later.

> Early versions used computed styles. Re-rendering a captured page diverged from the live page by 28%. Switching to the CSSOM-authored approach dropped that to **0.000%** — bit-for-bit identical rendering.

### 4. The JSON DOM: bypassing the HTML5 parser

React has a dirty secret: it creates HTML that isn't HTML. Via the DOM APIs (`createElement`, `appendChild`), React can nest a `<div>` inside a `<tr>`, or a `<p>` inside a `<p>`, or any other "invalid" configuration. The browser renders these perfectly — the DOM tree is the truth. But the moment you serialize via `outerHTML` and re-parse, the **HTML5 parser quietly "corrects" the tree**, relocating the misplaced elements. The pixels change.

Diffinity refuses to go through that parser. Instead, it walks the live DOM and emits a compact JSON tree:

```json
{ "t": 1, "n": "div", "a": {...}, "c": [ ... ] }
```

The captured HTML file contains that JSON plus a tiny bootstrapper that rebuilds the tree with `createElement` and `appendChild`, one node at a time. The HTML5 parser never sees it. The invalid-but-rendered tree survives the round trip.

The same bootstrapper also re-applies DOM *properties* that attributes can't capture — `checked`, `selected`, `open`, form values. These live on the element object, not in the markup, and frameworks set them programmatically. Diffinity reads them off the live node and replays them on the reconstructed one.

### 5. Content-hashed assets, inlined cross-origin

Cross-origin stylesheets (Tailwind CDN, Google Fonts, a marketing team's S3 bucket) cannot normally be read back, because browsers guard them. Diffinity launches Chromium with `--disable-web-security` *just for capture* — the browser is ephemeral, the pages are local. This unlocks the full CSSOM.

Fonts and images are harder. Many only exist as ephemeral responses to the initial page load (Next.js's dynamic font route, for instance, may 404 on a second request). So Diffinity attaches a **response cache** to the Playwright page *before* navigation: every font, image, and stylesheet response is captured in-flight. During HTML capture, these cached bytes become base64 data URIs embedded directly in the HTML — no CORS, no re-fetch.

Then those data URIs are extracted into a shared `_assets/` directory with **content-addressed filenames** — the first 12 characters of the MD5 of the base64 body, plus a MIME-derived extension. Two identical fonts on two captures collapse to one file. On the demo's 45-page fixture run, deduplication saves ~15% of disk.

### 6. Pixel-fidelity verification

Capture is a lie until you prove it isn't. After writing the reconstructed HTML, Diffinity opens it in a fresh browser and runs `pixelmatch` against the live screenshot. The fidelity score is recorded in the manifest. If drift appears, it appears *in the report itself* — you see the capture has diverged, rather than silently diffing corrupted input. On a real app, fidelity routinely hits 0.000% — the capture is bit-identical to the source.

> **Image prompt:** *A scientist in a sterile white lab freezes time with a wave of their hand. Behind glass, a translucent skeletal diagram of a webpage floats in midair — a blueprint made of glowing wireframes. In the foreground, two identical blueprints sit side by side on a lightbox, overlaid at 100% alignment. Cool blue palette, cinematic, volumetric light.*

---

## Part II — The Match: A Forensic Scientist Meets a DOM Tree

> **Visual metaphor:** *Two family photo albums spread across a desk. A detective with a magnifying glass draws gossamer threads between faces across the two albums — some bright and certain, others thin and uncertain. The ones that cross the threshold become pairs; the rest are circled as "arrived" or "departed."*

### The signals

The core problem: element X in the *before* capture and element Y in the *after* capture — are they the same element? There are no primary keys. IDs are often framework-generated and unstable. Diffinity uses a **layered identity-signal scoring system**, ranking each potential pair across many weak signals:


| Signal                               | Weight   | Notes                                     |
| ------------------------------------ | -------- | ----------------------------------------- |
| Tag match (baseline)                 | +10      | Everyone starts here                      |
| `data-testid` match                  | +50      | Strongest signal; author-stable           |
| User-authored `id`                   | +30      | Framework IDs excluded (see below)        |
| `role`                               | +15      | Accessibility landmark                    |
| `aria-label`                         | +20      | Authored intent                           |
| Accessible name                      | +20      | Computed via the browser's own W3C engine |
| Full text equality                   | +15      | Exact content                             |
| Partial text (first 20 chars)        | +5       | Fuzzy                                     |
| Class overlap                        | 0–10     | Normalized by set size                    |
| Stable attrs (`name`, `href`, `src`) | +10 each | Form/link/image                           |
| Children-count equality              | +5 / +2  | Exact / within 2                          |
| Ancestor-path similarity             | 0–15     | Proportional to matched depth             |


Any pair scoring below **15** is too distant to bother with. Above that, the algorithm greedily matches highest-scoring pairs first. Survivors become matched pairs; the leftovers become "added" (on the after side) or "removed" (on the before side).

### Defusing framework IDs

React's `useId()` returns identifiers like `:r7:`, `:rc:`, `:r1e:` — deterministic *within* a render, random *between* renders. MUI emits `mui-42`. Radix, Chakra, Next.js — they all sprinkle opaque, unstable IDs across the DOM.

Diffinity normalizes these before scoring. When an author-ish ID matches a known pattern, it's rewritten to a stable sequence (`:r0:`, `:r1:`, `:r2:` in order of appearance). The same component tree produces the same normalized IDs on both captures. The matcher sees through the disguise.

### The W3C accessible name, borrowed

Computing an accessible name from scratch is a months-long odyssey: the WAI-ARIA algorithm is a baroque cascade of `aria-labelledby`, `aria-label`, `<label for>`, `alt`, `title`, content fallback, recursion. Rather than reimplement it, Diffinity leans on Chromium itself via the **Chrome DevTools Protocol**:

- `DOM.getDocument` returns the tree with `backendNodeId` per node
- `Accessibility.getFullAXTree` returns the accessibility tree with accessible names already computed by the browser's W3C implementation
- Crossref the two via `backendNodeId`, merge into the manifest

It's the same name that `getByRole('button', { name: 'Submit' })` would find. Testing-library and Diffinity agree, because they ask the same oracle.

> **Image prompt:** *A detective's corkboard. On one side, a grid of photograph-cards of webpage elements labeled "BEFORE"; on the other side, "AFTER." Colored threads run between them — thick confident red threads, thin dashed blue threads, some ending mid-air at a circle marked "NEW." Warm desk-lamp light, noir aesthetic.*

---

## Part III — The Diff: Scoring What a Human Would Care About

> **Visual metaphor:** *A volume mixer on a studio console. Each slider represents a dimension of change — color distance, pixel magnitude, visual area, property importance. Sliders combine into a single final level that lights up one of four bulbs: critical, major, moderate, minor.*

A naive property-by-property diff between two matched elements produces dozens of equally-weighted alerts, most of them noise. Diffinity's scorer asks: *how much would a human care?*

### The dimensions

- **Category weight.** Not all properties are equal. `SCORE_WEIGHTS` bakes in: structure `100`, text `70`, visual/typography `60`, layout `50`, box-model `40`, grid `40`, position/sizing `30`, attribute `20`, raw bounding-box drift `5`.
- **Property dominance.** Some individual properties carry their own override weight because they saturate visual area — `background-color` and `background-image` score `80`, `opacity` scores `70`.
- **Color distance, alpha-aware.** The distance between two colors is the Euclidean distance in RGBA space: `sqrt(dr² + dg² + db² + (Δα × 255)²)`. Near-identical colors (distance < 5) score 2 points. Distant colors (> 150) score at 150% of base. Importantly, alpha is a full dimension — `rgb(0,0,0)` vs. `rgba(0,0,0,0.77)` is treated as a small difference on a white background, because visually it is.
- **Pixel magnitude.** A 1px change is 2 points. A 5px change is 50%. Over 20px is 150%. But **implicit cascade properties** (width/height changes that resulted from a sibling growing, not an authored rule) are dampened to 40% — they're usually derivative, not intent.
- **Visual area.** A change to a 20,000-pixel banner matters more than the same change to a 50-pixel badge. Area multipliers: `<1k → 0.7×`, `<10k → 0.85×`, `<50k → 1.0×`, `<200k → 1.2×`, `≥200k → 1.4×`.
- **Diminishing returns.** The second change in the same category on the same element counts for half. Ten small font tweaks shouldn't outrank a single color swap. Total score capped at 200.

The final number lands in one of four buckets:

- `≥ 100` → **critical**
- `≥ 60` → **major**
- `≥ 25` → **moderate**
- `< 25` → **minor**

These are the labels on every row of the report. They are also how the UI decides what to surface first.

---

## Part IV — The Consolidator: Eight Lies the Browser Tells

> **Visual metaphor:** *A noise-cancelling filter bank. Raw signal enters on the left — thousands of screaming diff-notes. Eight curved filter stages sit in sequence, each labeled with a specific source of noise. On the right, a handful of clear, meaningful tones emerge.*

This is the part where CSS becomes Lovecraftian, and Diffinity becomes heroic. Every one of these suppressions is a separate battle, fought and won.

### 1. Implicit ancestor suppression

A child's font grew. The parent's computed height grew too, automatically, because the box reflowed. The browser reports both changes. Only the first one is real.

Diffinity walks the matched tree. When a parent's change can be wholly explained by a child's change (size properties, and the child has explicit intent), the parent's diff is dropped. One change reported, not ten.

### 2. The `currentColor` chameleon

CSS has a secret default: `border-color`, `outline-color`, and `text-decoration-color` all default to `currentColor` — they *mirror* the element's `color`. Change `color: red → blue` and suddenly five "diffs" show up: color changed, border-top-color changed, border-right-color changed, border-bottom-color changed, border-left-color changed. All the same change.

Diffinity recognizes this: if `color` changed, and any of the mirrors changed to the same before/after values, the mirrors are absorbed into the `color` diff. One row in the report, not five.

### 3. The `1em` margin trick

User-agent stylesheets give `<p>` and `<h1>`–`<h6>` a default margin of `1em`. That's `1em` in the *child's* font-size, so changing font-size silently changes margins in lockstep. Another phantom cascade.

Diffinity's check is almost poetic in its tininess: if `beforeMargin === beforeFontSize` and `afterMargin === afterFontSize`, it's a browser default scaling with its anchor. Drop the margin diff; keep the font-size diff.

### 4. Grid-template phantoms

Toggle `display: flex` to `display: grid` and the browser suddenly reports *concrete* values for `grid-template-rows` and `grid-template-columns`. No rule set them. They appeared out of the void, because a grid without a template has an implicit one.

Diffinity cross-references: if `display` flipped into or out of grid, and the `grid-template-`* properties aren't in `authoredStyles`, they are phantoms. Drop them. Keep the single `display` change that caused it all.

### 5. Shorthand collapse

When `padding-top`, `padding-right`, `padding-bottom`, and `padding-left` all changed to the same value, you don't want four rows in the report. You want `padding: 16px → 32px`. Diffinity detects matching quads and collapses them into the shorthand. Same for margin, border-width, border-color, border-style, border-radius.

### 6. Per-property implicit size stripping

Subtler case: an element has *both* authored changes (border-width, border-color) *and* cascade-induced size drift. You don't want to suppress the whole element — the authored change is real. You want to strip only the noise.

Diffinity does per-property surgery: keep the authored properties; drop the cascade-induced ones from the same diff. The real change stands alone.

The strip rule is **authored-value equality**, not mere presence. For sizing properties (`width`, `height`, `min-*`, `max-*`, `grid-template-columns`, `grid-template-rows`, `flex-basis`) the engine compares the authored value on both sides:

- Same authored value both sides → cascade noise, strip.
- Different authored values → author changed intent, preserve.
- Authored on one side only → add/remove of a rule, preserve.

This handles the classic pattern where a card with `width: 100%` reports `520px → 518px` purely because its parent reflowed by two pixels. The authored rule is unchanged; the report stays silent. Same logic for grids with `grid-template-columns: 1fr 1fr` that shift by a couple of pixels when the viewport or container resizes.

### 7. Cascade clustering

When the same change ripples through 3+ elements — every row in a table slid down 4px, every card's width shrank by 18px — you don't want thirty repetitions of the same line. You want one: *"width decreased ~18px across 89 elements, caused by `max-width` change on `.container`."*

Diffinity keys clusters by property + direction, then finds the **lowest common ancestor** and checks if it has a matching authored change. When it does, the ancestor is tagged as the root cause and kept separate (it's the source, not the effect). The 89 affected children collapse into a single cluster card with a preview.

### 8. Fingerprint grouping

Different elements that underwent *identical* change sets — same properties, same before-values, same after-values — are merged into a "Multiple Similar ×N" group. Fingerprint: `type + sorted(category|property|before|after)`. Design-token swaps often produce dozens of these; the report shows one row with a member-preview instead of dozens of rows of the same diff.

> **Image prompt:** *Eight glowing cogs arranged in a row, each a different shape — a keyhole, a sieve, a prism, a magnet, a fingerprint scanner. Raw, chaotic streams of colorful static pour into the first cog; by the last cog only a few bright, meaningful sparks remain, flowing into a clean output. Technical illustration style, blueprint-on-black palette.*

---

## Part V — The Pixel Judge: Is This Actually Visible?

> **Visual metaphor:** *A late-stage court of appeals. Each surviving diff walks up to a lightbox where its before and after screenshots are overlaid pixel-for-pixel. A judge in robes asks one question: "Does this matter to the eye?" If no — the diff is demoted to a quiet shelf, not discarded, still findable.*

After every suppression above, one class of false positive still slips through: changes that *should* be visual but aren't. A `display: flex → grid` refactor that produces pixel-identical output. A `font-family` swap to a different name for the same physical font stack. A structural change with no visual consequence.

So Diffinity runs one final gate: every diff has its element's bounding box cropped from both the before and after screenshots and passed through `pixelmatch` with **tight perceptual thresholds**:

- YIQ perceptual threshold: **0.02** (aggressive; catches hue-only shifts that pixelmatch's default under-weights)
- `includeAA: false` — anti-alias halos are ignored
- Mismatch ceiling: **0.1%** of the element's pixels

If the element is pixel-identical, the diff is **demoted** — moved to a collapsed "no visual effect" section with a reason tag:

- `no-delta` — literally zero pixels differ
- `below-threshold` — some perceptual noise, but under 0.1%
- `same-computed` — different CSS tokens that resolve to the same value (font-stack fallback, quote/case normalization)

The diffs aren't deleted; they're parked. If you care, you can open the shelf.

### The pseudo-state override

Then one last twist. Even if a change is pixel-identical at rest, it might not be pixel-identical under `:hover`, `:focus`, or `:active`. A color change on a button that only ever appears when hovered is invisible in the static screenshot, but very visible to a user.

Diffinity checks: for each demoted diff, are any of the changed properties *also* set by a pseudo-state rule on that element? If yes — the verdict is flipped back to visible, and the diff is tagged `:hover` or `:focus` in the UI with a "(3 of 5)" fraction when some members match and others don't. The interaction-sensitive regressions that every other tool misses, Diffinity catches.

---

## Part VI — The Report: A Single File with Superpowers

> **Visual metaphor:** *A self-contained artifact. A single HTML file, no server, no CDN, no network — and yet inside it, two live browsers run side by side, sharing thoughts through a telepathic wire.*

### The single-file trick

The report is a full Preact app — React's smaller cousin — bundled via Vite. But a Vite app normally ships as an `index.html` plus a `/assets/` folder of JS and CSS modules. If you open that at `file://`, the browser refuses to load ES modules (CORS won't permit it from a disk path). Useless for shipping reports in CI artifacts, Slack messages, or email attachments.

So Diffinity adds a custom Vite plugin that, post-build, inlines everything: the CSS goes into a `<style>` tag, the JS modules are flattened into a single inline `<script>`, small images become base64. The result is one ~300KB HTML file. Double-click and it works. No server, no dependencies, no network.

### Two iframes, one mind

The report shows the captured before and after pages side-by-side in two iframes. When you hover a diff in the sidebar, **both iframes highlight the same element simultaneously** — a box glow, a label badge, overlays for margin and padding, a soft fade and pulse.

The mechanism: during capture, every element was tagged with `data-vr-idx={n}` — a sequential index that matches the DOM manifest position. A small `highlight-listener.js` IIFE is injected into each captured HTML file and listens for `postMessage` calls:

```javascript
iframe.contentWindow.postMessage({
  source: 'vr-report',
  action: 'highlight',
  idx: 42,
  type: 'changed',
  changedProps: ['color', 'background-color'],
  phase: 'before',
}, '*')
```

The report app posts to both frames at once. Each listener finds `[data-vr-idx="42"]` in its document and draws the overlay. Color coding matches semantic type — amber for changed, green for added, red for removed, purple for moved. If the element is `display: none`, the listener walks up to the nearest visible ancestor and tints it instead, with an explanatory label.

### The keyboard-first UX

- Arrow keys navigate between the sidebar, diff panel, and list items
- Enter / Space expand a diff to reveal property-level changes with color swatches
- `1` / `2` / `3` cycle view modes: split, before-only, after-only
- `V` cycles viewports (desktop / tablet / mobile), persisted to `localStorage`
- `F` focuses the pane's search box
- `[` toggles the side panels entirely

Color swatches for every color property are rendered not as hex codes but as actual colored chips, labeled with the OKLch values (perceptually uniform — easier to see that a "purple" and a "pink" are actually distant in hue even when their RGB values look similar).

### Three stories to tell

The live demo on GitHub Pages runs three scenarios to showcase each half of the engine:

1. **Targeted CSS fix** — a few button styles change. Narrow, precise diffs. No layout shift. The engine's precision on display.
2. **Flex → Grid refactor** — the sidebar rewrites from flex to grid at desktop. The *intent* is zero visual change. The pixel judge agrees: every diff is demoted to "no visual effect." The engine's pixel intelligence on display.
3. **Full rebrand** — design tokens swap, purple becomes emerald, typography shifts. Dozens of cascading changes. Fingerprint grouping collapses them into a handful of actionable rows. The engine's consolidation on display.

> **Image prompt:** *A single glowing HTML file hovers in empty space. Two windows emerge from it like holograms, left and right, showing the same web page in subtly different states. Between them, bright arcs of light trace from element to element in both windows — a shared nervous system. The file itself is a cut-gem crystal.*

---

## Coda: What makes this special

Every tool is a collection of choices. A pixel-diff tool chose simplicity: compare bytes, flag differences, ship. Diffinity chose a harder path — to understand what *authored* CSS did, what the *browser* derived, what a *human* would care about, and what the *pixels* actually show — and to reconcile all four.

That required:

- A capture that freezes time so nothing moves mid-snapshot
- A DOM serializer that bypasses the HTML5 parser to preserve React's "invalid" truth
- A CSSOM crawl that recovers authored intent from behind the computed-style curtain
- A matching algorithm that treats element identity as a chorus of weak signals
- A scoring system that weighs property importance, magnitude, and visual area together
- Eight separate noise filters, each targeting a specific lie CSS tells
- A pixel-level final judge, with a pseudo-state override for interaction-sensitive regressions
- A report that inlines itself into a single file and telepathically links two iframes

None of these ideas is individually exotic. The magic is in the composition — each layer takes a class of false positives off the table, so that what survives to the report is genuinely worth a human's attention. The default output is not "312 pixels differ." It is "the header's background changed. Major. Click to see where."

That is the difference between a pixel-diff and a thought partner.

---

*Diffinity is MIT-licensed and lives at [github.com/timkindberg/diffinity](https://github.com/timkindberg/diffinity). The live demo at [timkindberg.github.io/diffinity](https://timkindberg.github.io/diffinity/) runs all three scenarios end-to-end against the "Helix Ops Console" fixture — a realistic dashboard UI designed specifically to exercise every class of regression the engine is built to catch.*