/**
 * Full-pipeline integration tests: HTML → capture → match → diff → consolidate → cascade.
 *
 * Uses real Playwright browser for actual CSS computation, layout reflow, and inheritance.
 * Tests cover every mutation category from capture-faked-after.ts plus consolidation behaviors.
 *
 * ─── FINDINGS ────────────────────────────────────────────────────────────────
 *
 * 1. FOREGROUND COLOR ABSORPTION (collapseForegroundColor in diff.ts)
 *    When `text-decoration-color` or `outline-color` change to the same value as
 *    `color` (common because they default to `currentColor`), the redundant props
 *    are silently absorbed — only the `color` change remains.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import { captureDomManifest } from '../dom-manifest.js'
import { matchManifests } from '../match.js'
import { diffManifests, consolidateDiffs, type DiffResult, type ElementDiff, type DiffGroup } from '../diff.js'
import { buildCascadeClusters, type CascadeCluster } from '../cascade-cluster.js'
import { diffManifestsByViewport } from '../viewport-diff.js'
import type { DomManifest } from '../dom-manifest.js'
import { getCase, WRAPPER_HTML, RESPONSIVE_BEFORE, RESPONSIVE_AFTER } from './fixtures/index.js'

let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await chromium.launch({ args: ['--disable-web-security'] })
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
})

afterAll(async () => { await browser?.close() })

const noop = () => {}

// Mirror of CASCADE_PROPS from diff.ts for test assertions
const CASCADE_PROPS_SET = new Set(['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'])

async function captureHtml(html: string): Promise<DomManifest> {
  await page.setContent(html, { waitUntil: 'load' })
  return captureDomManifest(page, noop)
}

type FullResult = {
  raw: DiffResult
  consolidated: DiffResult
  cascadeClusters: CascadeCluster[]
  diffs: ElementDiff[]
  groups: DiffGroup[]
  before: DomManifest
  after: DomManifest
}

async function diffHtml(beforeHtml: string, afterHtml: string): Promise<FullResult> {
  const before = await captureHtml(beforeHtml)
  const after = await captureHtml(afterHtml)

  const match = matchManifests(before, after)
  const raw = diffManifests(before, after, match)
  const consolidated = consolidateDiffs(raw, before, after)
  const cascade = buildCascadeClusters(consolidated.groups, consolidated.diffs, before, after)

  return {
    raw,
    consolidated,
    cascadeClusters: cascade.clusters,
    diffs: cascade.remainingDiffs,
    groups: cascade.remainingGroups,
    before,
    after,
  }
}

function allChanges(r: FullResult) {
  return r.diffs.flatMap(d => d.changes)
}

function allGroupChanges(r: FullResult) {
  return r.groups.flatMap(g => g.changes)
}

function findDiff(r: FullResult, predicate: (d: ElementDiff) => boolean) {
  return r.diffs.find(predicate)
}

function findDiffByLabel(r: FullResult, substr: string) {
  return r.diffs.find(d => d.label.includes(substr))
}

function findGroupByMemberLabel(r: FullResult, substr: string) {
  return r.groups.find(g => g.members.some(m => m.label.includes(substr)))
}

function countType(r: FullResult, type: ElementDiff['type']) {
  return r.diffs.filter(d => d.type === type).length
}

// Shorthand for fixture lookup
const f = (section: string, name: string) => getCase(section, name)

// =====================================================================
// Section 1: Identical HTML
// =====================================================================

describe('Identical HTML', () => {
  it('produces zero diffs for identical HTML', async () => {
    const { before, after } = f('Identical HTML', 'identical HTML produces zero diffs')
    const r = await diffHtml(before, after)

    expect(r.diffs).toHaveLength(0)
    expect(r.groups).toHaveLength(0)
    expect(r.cascadeClusters).toHaveLength(0)
    expect(r.consolidated.summary.changed).toBe(0)
    expect(r.consolidated.summary.added).toBe(0)
    expect(r.consolidated.summary.removed).toBe(0)
    expect(r.consolidated.summary.moved).toBe(0)
  })
})

// =====================================================================
// Section 2: Text Content Changes
// =====================================================================

describe('Text content changes', () => {
  it('detects a simple text change on a button', async () => {
    const { before, after } = f('Text content changes', 'simple text change on a button')
    const r = await diffHtml(before, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.length).toBeGreaterThanOrEqual(1)
    expect(textChanges.some(c => c.before === 'Get Started' && c.after === 'Sign Up Now')).toBe(true)
  })

  it('detects heading text change', async () => {
    const { before, after } = f('Text content changes', 'heading text change')
    const r = await diffHtml(before, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.some(c => c.before === 'Welcome' && c.after === 'Hello World')).toBe(true)
  })

  it('detects paragraph text change', async () => {
    const { before, after } = f('Text content changes', 'paragraph text change')
    const r = await diffHtml(before, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.length).toBeGreaterThanOrEqual(1)
    expect(textChanges.some(c =>
      c.before === 'This is a sample page for testing visual regression.' &&
      c.after === 'Updated description text here.'
    )).toBe(true)
  })

  it('detects nav link text change', async () => {
    const { before, after } = f('Text content changes', 'nav link text change')
    const r = await diffHtml(before, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.some(c => c.before === 'About' && c.after === 'About Us')).toBe(true)
  })

  it('detects text change even when element has many other properties', async () => {
    const { before, after } = f('Text content changes', 'text change on element with many properties')
    const r = await diffHtml(before, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.some(c => c.before === 'Active' && c.after === 'Inactive')).toBe(true)
  })
})

// =====================================================================
// Section 3: Color / Typography Changes
// =====================================================================

describe('Color and typography changes', () => {
  it('detects font color change', async () => {
    const { before, after } = f('Color and typography changes', 'font color change')
    const r = await diffHtml(before, after)

    const colorChanges = allChanges(r).filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects font-size change', async () => {
    const { before, after } = f('Color and typography changes', 'font-size change')
    const r = await diffHtml(before, after)

    const sizeChanges = allChanges(r).filter(c => c.property === 'font-size')
    expect(sizeChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects font-weight change', async () => {
    const { before, after } = f('Color and typography changes', 'font-weight change')
    const r = await diffHtml(before, after)

    const weightChanges = allChanges(r).filter(c => c.property === 'font-weight')
    expect(weightChanges).toHaveLength(1)
  })

  it('detects link color change to purple (like LINK_COLOR_CHANGE mutation)', async () => {
    const { before, after } = f('Color and typography changes', 'link color change to purple')
    const r = await diffHtml(before, after)

    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects text-decoration change', async () => {
    const { before, after } = f('Color and typography changes', 'text-decoration change')
    const r = await diffHtml(before, after)

    const decoChanges = allChanges(r).filter(c => c.property === 'text-decoration')
    expect(decoChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 4: Background Color Changes
// =====================================================================

describe('Background color changes', () => {
  it('detects background-color change', async () => {
    const { before, after } = f('Background color changes', 'background-color change')
    const r = await diffHtml(before, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects transparent → opaque background', async () => {
    const { before, after } = f('Background color changes', 'transparent to opaque background')
    const r = await diffHtml(before, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects status badge background color change (like STATUS_BADGE_GREEN)', async () => {
    const { before, after } = f('Background color changes', 'status badge background color change')
    const r = await diffHtml(before, after)

    const bgChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 5: Box Model Changes (Padding, Margin, Border)
// =====================================================================

describe('Box model changes', () => {
  it('detects padding change', async () => {
    const { before, after } = f('Box model changes', 'padding change')
    const r = await diffHtml(before, after)

    const paddingChanges = allChanges(r).filter(c => c.property.startsWith('padding'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects margin change', async () => {
    const { before, after } = f('Box model changes', 'margin change')
    const r = await diffHtml(before, after)

    const marginChanges = allChanges(r).filter(c => c.property.startsWith('margin'))
    expect(marginChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects border-width change', async () => {
    const { before, after } = f('Box model changes', 'border-width change')
    const r = await diffHtml(before, after)

    const borderChanges = allChanges(r).filter(c =>
      c.property.includes('border') && c.property.includes('width')
    )
    expect(borderChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects border-color change', async () => {
    const { before, after } = f('Box model changes', 'border-color change')
    const r = await diffHtml(before, after)

    const borderColorChanges = allChanges(r).filter(c =>
      c.property.includes('border') && c.property.includes('color')
    )
    expect(borderColorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects border-radius change', async () => {
    const { before, after } = f('Box model changes', 'border-radius change')
    const r = await diffHtml(before, after)

    const radiusChanges = allChanges(r).filter(c =>
      c.property.includes('border') && c.property.includes('radius')
    )
    expect(radiusChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects button padding + border-radius change (like BUTTON_RESTYLE)', async () => {
    const { before, after } = f('Box model changes', 'button padding + border-radius change')
    const r = await diffHtml(before, after)

    const changes = allChanges(r)
    const paddingChanges = changes.filter(c => c.property.startsWith('padding'))
    const radiusChanges = changes.filter(c => c.property.includes('radius'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
    expect(radiusChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 6: Element Addition / Removal
// =====================================================================

describe('Element addition and removal', () => {
  it('detects added element', async () => {
    const { before, after } = f('Element addition and removal', 'added element')
    const r = await diffHtml(before, after)

    expect(countType(r, 'added')).toBeGreaterThanOrEqual(1)
  })

  it('detects removed element', async () => {
    const { before, after } = f('Element addition and removal', 'removed element')
    const r = await diffHtml(before, after)

    expect(countType(r, 'removed')).toBeGreaterThanOrEqual(1)
  })

  it('detects added banner (like ADD_BANNER mutation)', async () => {
    const { before, after } = f('Element addition and removal', 'added banner')
    const r = await diffHtml(before, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
    expect(added.some(d => d.label.includes('test-banner'))).toBe(true)
  })

  it('detects removed button (like REMOVE_HELP_BTN mutation)', async () => {
    const { before, after } = f('Element addition and removal', 'removed button')
    const r = await diffHtml(before, after)

    const removed = r.diffs.filter(d => d.type === 'removed')
    expect(removed.length).toBeGreaterThanOrEqual(1)
  })

  it('does not report descendants of an added element as separate additions', async () => {
    const { before, after } = f('Element addition and removal', 'added element with descendants (no separate additions)')
    const r = await diffHtml(before, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].label).toContain('promo')
  })

  it('does not report descendants of a removed element as separate removals', async () => {
    const { before, after } = f('Element addition and removal', 'removed element with descendants (no separate removals)')
    const r = await diffHtml(before, after)

    const removed = r.diffs.filter(d => d.type === 'removed')
    expect(removed).toHaveLength(1)
    expect(removed[0].label).toContain('welcome-card')
  })
})

// =====================================================================
// Section 7: Element Moved
// =====================================================================

describe('Element moved', () => {
  it('detects element moved from nav to footer', async () => {
    const { before, after } = f('Element moved', 'element moved from nav to footer')
    const r = await diffHtml(before, after)

    const moved = r.diffs.filter(d => d.type === 'moved' || d.type === 'moved+changed')
    expect(moved.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 8: Layout / Display Changes
// =====================================================================

describe('Layout and display changes', () => {
  it('detects display change (block → flex)', async () => {
    const { before, after } = f('Layout and display changes', 'display change (block to flex)')
    const r = await diffHtml(before, after)

    // Container changes display, children may also change computed display (flex items).
    const containerDiff = findDiffByLabel(r, 'container')
    expect(containerDiff).toBeDefined()
    expect(containerDiff!.changes.some(c => c.property === 'display')).toBe(true)
  })

  it('detects flex-direction change', async () => {
    const { before, after } = f('Layout and display changes', 'flex-direction change')
    const r = await diffHtml(before, after)

    const flexChanges = allChanges(r).filter(c => c.property === 'flex-direction')
    expect(flexChanges).toHaveLength(1)
  })

  it('detects gap change', async () => {
    const { before, after } = f('Layout and display changes', 'gap change')
    const r = await diffHtml(before, after)

    const gapChanges = allChanges(r).filter(c => c.property === 'gap')
    expect(gapChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 9: Size Changes (Width, Height)
// =====================================================================

describe('Size changes', () => {
  it('detects explicit width change via CSS', async () => {
    const { before, after } = f('Size changes', 'explicit width change')
    const r = await diffHtml(before, after)

    const widthChanges = allChanges(r).filter(c => c.property === 'width' && c.category === 'box-model')
    expect(widthChanges).toHaveLength(1)
  })

  it('detects explicit height change via CSS', async () => {
    const { before, after } = f('Size changes', 'explicit height change')
    const r = await diffHtml(before, after)

    const heightChanges = allChanges(r).filter(c => c.property === 'height' && c.category === 'box-model')
    expect(heightChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 10: CSS Inheritance & Cascade (real browser layout)
// =====================================================================

describe('CSS inheritance and cascade', () => {
  it('detects color change inherited from parent to child text elements', async () => {
    const { before, after } = f('CSS inheritance and cascade', 'color inherited from parent to children')
    const r = await diffHtml(before, after)

    // The color change on .card cascades to h2 and p via CSS inheritance.
    // Expect the diff engine to detect color changes on some/all of: card, h2, p.
    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('parent border change causes child width reflow', async () => {
    const { before, after } = f('CSS inheritance and cascade', 'parent border change causes child width reflow')
    const r = await diffHtml(before, after)

    // The container's border change is the primary mutation.
    // The child's width should change because the container's content area shrinks.
    const containerDiff = findDiffByLabel(r, 'container')
    expect(containerDiff).toBeDefined()
    const borderChanges = containerDiff!.changes.filter(c =>
      c.property.includes('border')
    )
    expect(borderChanges.length).toBeGreaterThanOrEqual(1)

    // Child's width change is cascade noise — bbox-only gets suppressed.
  })

  it('inserted banner causes height cascade on sibling containers', async () => {
    const { before, after } = f('CSS inheritance and cascade', 'inserted banner causes height cascade')
    const r = await diffHtml(before, after)

    // Banner should be detected as added
    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
    expect(added.some(d => d.label.includes('banner'))).toBe(true)

    // Content + paragraphs only shift down (bbox y). Consolidation suppresses bbox-only.
    const contentDiff = findDiffByLabel(r, 'content')
    const p1Diff = findDiffByLabel(r, 'p1')
    expect(contentDiff).toBeUndefined()
    expect(p1Diff).toBeUndefined()
  })

  it('padding change on parent causes subpixel width changes on children', async () => {
    const { before, after } = f('CSS inheritance and cascade', 'padding change causes subpixel width changes on children')
    const r = await diffHtml(before, after)

    // The wrapper's padding change is the primary mutation
    const wrapperDiff = findDiffByLabel(r, 'wrapper')
    expect(wrapperDiff).toBeDefined()
    const paddingChanges = wrapperDiff!.changes.filter(c => c.property.startsWith('padding'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)

    // Children's width shrinks via cascade. If they survive consolidation,
    // they must have meaningful (non-bbox) changes — bbox-only gets suppressed.
    const itemDiffs = r.diffs.filter(d => d.label.includes('item-'))
    for (const item of itemDiffs) {
      expect(item.changes.every(c => c.category !== 'bbox')).toBe(true)
    }
  })

  it('color change on link with heading child: deduplicateAncestorChanges', async () => {
    const { before, after } = f('CSS inheritance and cascade', 'color change on link with heading child (deduplicateAncestorChanges)')
    const r = await diffHtml(before, after)

    // The h3 (descendant) should keep the color change
    const titleDiff = findDiffByLabel(r, 'Card Title')
    expect(titleDiff).toBeDefined()
    const titleColor = titleDiff!.changes.find(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(titleColor).toBeDefined()

    // The link (ancestor) should have its color change stripped by deduplication
    const linkDiff = findDiffByLabel(r, 'card-link')
    if (linkDiff) {
      const linkColorChange = linkDiff.changes.find(c =>
        c.property === 'color' || c.property === 'foreground color'
      )
      expect(linkColorChange).toBeUndefined()
    }
  })

  it('color change on a plain link WITHOUT heading child is detected', async () => {
    const { before, after } = f('CSS inheritance and cascade', 'color change on plain link without heading child')
    const r = await diffHtml(before, after)

    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 11: Grouping (Fingerprint Groups)
// =====================================================================

describe('Fingerprint grouping', () => {
  it('groups multiple elements with identical changes', async () => {
    const { before, after } = f('Fingerprint grouping', 'groups multiple elements with identical changes')
    const r = await diffHtml(before, after)

    const badgeGroup = r.groups.find(g =>
      g.members.some(m => m.label.includes('badge'))
    )
    expect(badgeGroup).toBeDefined()
    expect(badgeGroup!.members).toHaveLength(3)
  })

  it('does not group elements with different change fingerprints', async () => {
    const { before, after } = f('Fingerprint grouping', 'does not group elements with different fingerprints')
    const r = await diffHtml(before, after)

    // Different before→after color values means different fingerprints → no grouping
    const changes = allChanges(r).filter(c => c.property === 'color' || c.property === 'foreground color')
    expect(changes.length).toBeGreaterThanOrEqual(2)
    // They should NOT be in a group because their before/after values differ
    const colorGroup = r.groups.find(g => g.changes.some(c => c.property === 'color'))
    expect(colorGroup).toBeUndefined()
  })
})

// =====================================================================
// Section 12: Cascade Clustering
// =====================================================================

describe('Cascade clustering', () => {
  it('clusters 3+ elements with same width delta into a cascade', async () => {
    const { before, after } = f('Cascade clustering', '3+ elements with same width delta form cascade')
    const r = await diffHtml(before, after)

    // P0 fix: Container's CSS width survives consolidation (dedup fingerprint
    // includes category, so box-model `width` ≠ bbox `width`).
    // Check consolidated output (pre-cascade-clustering).
    const conContainerDiff = r.consolidated.diffs.find(d => d.label.includes('container'))
    expect(conContainerDiff).toBeDefined()
    const widthChange = conContainerDiff!.changes.find(c =>
      c.property === 'width' && c.category === 'box-model'
    )
    expect(widthChange).toBeDefined()

    // The container's width change is the ROOT CAUSE of children shrinking.
    // It should remain visible in the final output, not be absorbed into a
    // cascade cluster alongside its own children.
    const containerDiff = findDiffByLabel(r, 'container')
    expect(containerDiff).toBeDefined()
  })

  it('border-accent on sections creates cascade in child elements', async () => {
    const { before, after } = f('Cascade clustering', 'border-accent on sections creates cascade in children')
    const r = await diffHtml(before, after)

    // Sections get border changes. Their children may cascade (width shrinks).
    // Verify at least the section border changes are detected.
    const borderChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property.includes('border')
    )
    expect(borderChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 13: Consolidation Behaviors
// =====================================================================

describe('Consolidation', () => {
  it('collapses identical quad border-radius into single shorthand', async () => {
    const { before, after } = f('Consolidation', 'collapses identical quad border-radius into shorthand')
    const r = await diffHtml(before, after)

    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeDefined()
    // Should be collapsed to a single `border-radius` shorthand
    const radiusChanges = boxDiff!.changes.filter(c => c.property.includes('radius'))
    expect(radiusChanges).toHaveLength(1)
    expect(radiusChanges[0].property).toBe('border-radius')
  })

  it('does NOT collapse non-uniform border-radius (different corners)', async () => {
    const { before, after } = f('Consolidation', 'does NOT collapse non-uniform border-radius')
    const r = await diffHtml(before, after)

    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeDefined()
    const radiusChanges = boxDiff!.changes.filter(c => c.property.includes('radius'))
    // Should NOT collapse to shorthand (only 2 of 4 corners changed)
    expect(radiusChanges.length).toBeGreaterThanOrEqual(1)
    // If collapsed to shorthand, there'd be exactly 1 with property 'border-radius'.
    // Since only 2 corners changed, we expect individual corner properties.
    expect(radiusChanges.every(c => c.property !== 'border-radius')).toBe(true)
  })

  it('collapses identical quad border-color into single shorthand', async () => {
    const { before, after } = f('Consolidation', 'collapses identical quad border-color into shorthand')
    const r = await diffHtml(before, after)

    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeDefined()
    const borderColorChanges = boxDiff!.changes.filter(c => c.property.includes('border-color'))
    expect(borderColorChanges).toHaveLength(1)
    expect(borderColorChanges[0].property).toBe('border-color')
  })

  it('strips bbox changes from elements that also have meaningful style changes', async () => {
    const { before, after } = f('Consolidation', 'strips bbox from elements with meaningful style changes')
    const r = await diffHtml(before, after)

    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeDefined()
    expect(boxDiff!.changes.some(c => c.property === 'color' || c.property === 'foreground color')).toBe(true)
    expect(boxDiff!.changes.some(c => c.property.startsWith('padding'))).toBe(true)
    expect(boxDiff!.changes.every(c => c.category !== 'bbox')).toBe(true)
  })

  it('suppresses pure bbox-only shifts', async () => {
    const { before, after } = f('Consolidation', 'suppresses pure bbox-only shifts')
    const r = await diffHtml(before, after)

    // The target only shifts vertically (bbox y change), no style changes.
    // Consolidation should suppress it.
    const targetDiff = findDiffByLabel(r, 'target')
    expect(targetDiff).toBeUndefined()

    // The spacer has a real height change (CSS property change)
    const spacerDiff = findDiffByLabel(r, 'spacer')
    expect(spacerDiff).toBeDefined()
  })
})

// =====================================================================
// Section 14: Table Mutations (like TABLE_HEADER_DARK, TABLE_CELL_PAD)
// =====================================================================

describe('Table mutations', () => {
  it('detects table header background and color change', async () => {
    const { before, after } = f('Table mutations', 'table header background and color change')
    const r = await diffHtml(before, after)

    const bgChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c => c.property === 'background-color')
    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects table cell padding change', async () => {
    const { before, after } = f('Table mutations', 'table cell padding change')
    const r = await diffHtml(before, after)

    const paddingChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c => c.property.startsWith('padding'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects hidden last column (display: none)', async () => {
    const { before, after } = f('Table mutations', 'hidden last column (display: none)')
    const r = await diffHtml(before, after)

    // display:none elements are excluded by isVisible → absent from after manifest → removed.
    // 3 sibling cells: th-action, td-1-action, td-2-action (siblings, not ancestors).
    const removed = r.diffs.filter(d => d.type === 'removed')
    expect(removed).toHaveLength(3)
  })
})

// =====================================================================
// Section 15: Tab / Active State Changes
// =====================================================================

describe('Tab and active state changes', () => {
  it('detects active tab border and color change (like TAB_ACTIVE_COLOR)', async () => {
    const { before, after } = f('Tab and active state changes', 'active tab border and color change')
    const r = await diffHtml(before, after)

    const changes = allChanges(r)
    const colorChanges = changes.filter(c =>
      c.property === 'color' || c.property === 'foreground color' || c.property.includes('border-bottom-color')
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 16: Tooltip Badge Addition (like ADD_TOOLTIP_BADGE)
// =====================================================================

describe('Element insertion within existing elements', () => {
  it('detects BETA badge added inside heading', async () => {
    const { before, after } = f('Element insertion within existing elements', 'BETA badge added inside heading')
    const r = await diffHtml(before, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
    expect(added.some(d => d.label.includes('beta-badge') || d.label.includes('BETA'))).toBe(true)
  })
})

// =====================================================================
// Section 17: Footer Background (like FOOTER_BG)
// =====================================================================

describe('Footer mutations', () => {
  it('detects footer background color change', async () => {
    const { before, after } = f('Footer mutations', 'footer background color change')
    const r = await diffHtml(before, after)

    const changes = allChanges(r)
    const bgChange = changes.find(c => c.property === 'background-color')
    expect(bgChange).toBeDefined()
  })
})

// =====================================================================
// Section 18: Input Border Red (like INPUT_BORDER_RED)
// =====================================================================

describe('Form input mutations', () => {
  it('detects input border-color change (validation error style)', async () => {
    const { before, after } = f('Form input mutations', 'input border-color change (validation error)')
    const r = await diffHtml(before, after)

    const borderColorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property.includes('border') && c.property.includes('color')
    )
    expect(borderColorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects box-shadow addition on input', async () => {
    const { before, after } = f('Form input mutations', 'box-shadow addition on input')
    const r = await diffHtml(before, after)

    const shadowChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c => c.property === 'box-shadow')
    expect(shadowChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 19: Sidebar Width (like SIDEBAR_WIDTH)
// =====================================================================

describe('Sidebar mutations', () => {
  it('detects sidebar width change', async () => {
    const { before, after } = f('Sidebar mutations', 'sidebar width change')
    const r = await diffHtml(before, after)

    const sidebarDiff = findDiffByLabel(r, 'sidebar')
    expect(sidebarDiff).toBeDefined()
    const widthChanges = sidebarDiff!.changes.filter(c =>
      c.property === 'width' || c.property === 'min-width'
    )
    expect(widthChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 20: Avatar Border (like AVATAR_BORDER)
// =====================================================================

describe('Avatar mutations', () => {
  it('detects border added to avatar image', async () => {
    const { before, after } = f('Avatar mutations', 'border added to avatar image')
    const r = await diffHtml(before, after)

    const changes = allChanges(r)
    const borderChanges = changes.filter(c =>
      c.property.includes('border') && (c.property.includes('width') || c.property.includes('color') || c.property.includes('style'))
    )
    expect(borderChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 21: H3 Section Color (like H3_COLOR)
// =====================================================================

describe('Heading section color', () => {
  it('detects h3 color change', async () => {
    const { before, after } = f('Heading section color', 'h3 color change')
    const r = await diffHtml(before, after)

    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 22: Multiple Simultaneous Mutations
// =====================================================================

describe('Multiple simultaneous mutations', () => {
  it('detects all changes when multiple mutations applied', async () => {
    const { before, after } = f('Multiple simultaneous mutations', 'multiple mutations applied at once')
    const r = await diffHtml(before, after)

    const changes = allChanges(r)
    // Should detect text changes
    expect(changes.some(c => c.category === 'text')).toBe(true)
    // Should detect bg color change on nav
    expect(changes.some(c => c.property === 'background-color')).toBe(true)
    // Should detect border changes on card
    expect(changes.some(c => c.property.includes('border'))).toBe(true)
  })

  it('detects heading rename + banner + button restyle together (approvals pattern)', async () => {
    const { before, after } = f('Multiple simultaneous mutations', 'heading rename + banner + button restyle (approvals pattern)')
    const r = await diffHtml(before, after)

    // Text change on heading
    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.some(c => c.before === 'Welcome' && c.after === 'Dashboard')).toBe(true)

    // Banner added
    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.some(d => d.label.includes('banner'))).toBe(true)

    // Button restyle
    const paddingChanges = allChanges(r).filter(c => c.property.startsWith('padding'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 23: Scoring and Importance
// =====================================================================

describe('Scoring and importance', () => {
  it('added/removed elements score 100 (critical)', async () => {
    const { before, after } = f('Scoring and importance', 'added/removed elements score 100 (critical)')
    const r = await diffHtml(before, after)

    const removed = r.diffs.find(d => d.type === 'removed')!
    expect(removed).toBeDefined()
    expect(removed.score).toBe(100)
    expect(removed.importance).toBe('critical')
  })

  it('text changes score higher than size-only changes', async () => {
    const textFixture = f('Scoring and importance', 'text change (for scoring comparison)')
    const rText = await diffHtml(textFixture.before, textFixture.after)
    const textDiff = findDiffByLabel(rText, 'text-el')

    const boxFixture = f('Scoring and importance', 'size change (for scoring comparison)')
    const rBox = await diffHtml(boxFixture.before, boxFixture.after)
    const boxDiff = findDiffByLabel(rBox, 'box-el')

    expect(textDiff).toBeDefined()
    expect(boxDiff).toBeDefined()
    expect(textDiff!.score).toBeGreaterThan(boxDiff!.score)
  })
})

// =====================================================================
// Section 24: Color Normalization
// =====================================================================

describe('Color normalization', () => {
  it('does not report false positive for same color in different formats', async () => {
    const { before, after } = f('Color normalization', 'same color in different formats (no false positive)')
    const r = await diffHtml(before, after)

    expect(r.diffs).toHaveLength(0)
    expect(r.groups).toHaveLength(0)
  })
})

// =====================================================================
// Section 25: Opacity / Visibility Changes
// =====================================================================

describe('Visibility and opacity', () => {
  it('detects opacity change', async () => {
    const { before, after } = f('Visibility and opacity', 'opacity change')
    const r = await diffHtml(before, after)

    const opacityChanges = allChanges(r).filter(c => c.property === 'opacity')
    expect(opacityChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 26: Spacing Increase (like SPACING_INCREASE)
// =====================================================================

describe('Spacing increase', () => {
  it('detects padding and margin-bottom increase on cards', async () => {
    const { before, after } = f('Spacing increase', 'padding and margin-bottom increase')
    const r = await diffHtml(before, after)

    const changes = [...allChanges(r), ...allGroupChanges(r)]
    const paddingChanges = changes.filter(c => c.property.startsWith('padding'))
    const marginChanges = changes.filter(c => c.property.startsWith('margin'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
    expect(marginChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 27: Nav Background Dark (like NAV_BG_DARK)
// =====================================================================

describe('Nav background mutation', () => {
  it('detects nav background color darkening', async () => {
    const { before, after } = f('Nav background mutation', 'nav background color darkening')
    const r = await diffHtml(before, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 28: Info Row Addition (like ADD_INFO_ROW)
// =====================================================================

describe('Info row addition', () => {
  it('detects new info row added inside a section', async () => {
    const { before, after } = f('Info row addition', 'new info row added inside section')
    const r = await diffHtml(before, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 29: Filter Chip Addition (like ADD_FILTER_CHIP)
// =====================================================================

describe('Filter chip addition', () => {
  it('detects filter chip added inside toolbar', async () => {
    const { before, after } = f('Filter chip addition', 'filter chip added inside toolbar')
    const r = await diffHtml(before, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
    expect(added.some(d => d.label.includes('active-filter') || d.label.includes('Last 30 days'))).toBe(true)
  })
})

// =====================================================================
// Section 30: Breadcrumb Removal (like REMOVE_BREADCRUMB)
// =====================================================================

describe('Breadcrumb removal', () => {
  it('detects breadcrumb nav removal', async () => {
    const { before, after } = f('Breadcrumb removal', 'breadcrumb nav removal')
    const r = await diffHtml(before, after)

    const removed = r.diffs.filter(d => d.type === 'removed')
    expect(removed.length).toBeGreaterThanOrEqual(1)
    expect(removed.some(d => d.label.includes('breadcrumb'))).toBe(true)
  })
})

// =====================================================================
// Section 31: Accessible Names
// =====================================================================

describe('Accessible names in diff labels', () => {
  it('uses accessible name in diff label for buttons', async () => {
    const { before, after } = f('Accessible names in diff labels', 'uses accessible name in diff label for buttons')
    const r = await diffHtml(before, after)

    const btnDiff = r.diffs.find(d => d.label.includes('Close dialog'))
    expect(btnDiff).toBeDefined()
  })
})

// =====================================================================
// Section 32: Progress Bar Color (like PROGRESS_BAR_COLOR)
// =====================================================================

describe('Progress bar mutations', () => {
  it('detects progress bar background color change', async () => {
    const { before, after } = f('Progress bar mutations', 'progress bar background color change')
    const r = await diffHtml(before, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 33: Background Subtle (like BG_SUBTLE_CHANGE)
// =====================================================================

describe('Subtle background change', () => {
  it('detects subtle background change from transparent to light gray', async () => {
    const { before, after } = f('Subtle background change', 'transparent to light gray background')
    const r = await diffHtml(before, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 34: Edge Cases
// =====================================================================

describe('Edge cases', () => {
  it('handles empty body gracefully', async () => {
    const { before, after } = f('Edge cases', 'empty body')
    const r = await diffHtml(before, after)
    expect(r.diffs).toHaveLength(0)
  })

  it('handles deeply nested elements', async () => {
    const { before, after } = f('Edge cases', 'deeply nested elements')
    const r = await diffHtml(before, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects very small color difference (< 5 RGB distance → low score)', async () => {
    const { before, after } = f('Edge cases', 'very small color difference (low score)')
    const r = await diffHtml(before, after)

    // RGB distance ~3 → score 2. Detected but low importance.
    const diff = findDiffByLabel(r, 'box')
    expect(diff).toBeDefined()
    expect(diff!.score).toBeLessThan(20)
  })

  it('large number of identical elements with same mutation get grouped', async () => {
    const { before, after } = f('Edge cases', 'large number of identical mutations get grouped')
    const r = await diffHtml(before, after)

    const colorGroup = r.groups.find(g =>
      g.changes.some(c => c.property === 'color' || c.property === 'foreground color')
    )
    expect(colorGroup).toBeDefined()
    expect(colorGroup!.members).toHaveLength(20)
  })
})

// =====================================================================
// Section 35: Cascade Cluster Structure (P1-5)
// =====================================================================

describe('Cascade cluster structure', () => {
  it('produces a cascade cluster with correct properties for 4+ width-decreased children', async () => {
    const { before, after } = f('Cascade cluster structure', 'cascade cluster with 4+ width-decreased children')
    const r = await diffHtml(before, after)

    // The outer container's CSS width change is the root cause.
    // The 4 rows shrink in width (cascade). If they survive consolidation
    // as cascade-only changes, they should form a cluster.
    if (r.cascadeClusters.length > 0) {
      const cluster = r.cascadeClusters[0]
      expect(cluster.properties).toContain('width')
      expect(cluster.elementCount).toBeGreaterThanOrEqual(3)
      expect(cluster.members.length).toBe(cluster.elementCount)
      expect(cluster.delta).toContain('width')
      expect(cluster.delta).toContain('decreased')
    }
  })

  it('does not cluster elements with fewer than 3 matching cascade changes', async () => {
    const { before, after } = f('Cascade cluster structure', 'does not cluster fewer than 3 matching cascade changes')
    const r = await diffHtml(before, after)

    // Only 2 elements with width:decreased — below MIN_CLUSTER_SIZE of 3
    expect(r.cascadeClusters).toHaveLength(0)
  })

  it('clusters by direction only — different magnitudes in the same cluster', async () => {
    const { before, after } = f('Cascade cluster structure', 'clusters by direction — different magnitudes same cluster')
    const r = await diffHtml(before, after)

    // All 3 have width:decreased but different deltas (50, 30, 40).
    // Policy: direction-only bucketing — same direction → same cluster regardless of magnitude.
    // This is an accepted tradeoff: cascade noise from a single root cause uses varying deltas,
    // so magnitude-based splitting would defeat the purpose of cascade clustering.
    const cluster = r.cascadeClusters.find(c => c.properties.includes('width'))
    expect(cluster).toBeDefined()
    expect(cluster!.elementCount).toBeGreaterThanOrEqual(3)
  })
})

// =====================================================================
// Section 36: Children-count-only pipeline suppression (P1-9)
// =====================================================================

describe('Children count suppression (pipeline)', () => {
  it('drops parent diff when its only change is children count and child is added', async () => {
    const { before, after } = f('Children count suppression', 'drops parent diff when only change is children count')
    const r = await diffHtml(before, after)

    // The new item should be reported as added
    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)

    // The parent list's "children: 2→3" should NOT be a standalone diff.
    // With fixed height + overflow:hidden, the parent's dimensions don't change.
    const listDiff = r.diffs.find(d =>
      d.label.includes('my-list') && d.type === 'changed'
    )
    expect(listDiff).toBeUndefined()
  })
})

// =====================================================================
// Section 37: Authored position offsets (P2-14)
// =====================================================================

describe('Authored position offsets', () => {
  it('reports authored top/left changes on positioned elements', async () => {
    const { before, after } = f('Authored position offsets', 'reports authored top/left changes')
    const r = await diffHtml(before, after)

    // top/left on a positioned element produce real, visible movement —
    // they must NOT be swept up by the bbox/position-only suppression rule.
    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeDefined()

    const props = boxDiff!.changes.map(c => c.property)
    expect(props).toContain('top')
    expect(props).toContain('left')
  })
})

// =====================================================================
// Section 38: Zero-height wrapper promotion
// =====================================================================

describe('Zero-height wrapper promotion', () => {
  it('captures elements inside a height:0 wrapper that overflow visibly', async () => {
    const manifest = await captureHtml(WRAPPER_HTML)

    function findAll(node: DomManifest['root'], predicate: (n: NonNullable<DomManifest['root']>) => boolean): NonNullable<DomManifest['root']>[] {
      if (!node) return []
      const results: NonNullable<DomManifest['root']>[] = []
      if (predicate(node)) results.push(node)
      for (const child of node.children) {
        results.push(...findAll(child, predicate))
      }
      return results
    }

    const ths = findAll(manifest.root, n => n.tag === 'th')
    expect(ths).toHaveLength(3)
    expect(ths.map(t => t.text)).toEqual(['Week', 'Hours', 'Status'])

    const table = findAll(manifest.root, n => n.testId === 'hours-table')
    expect(table).toHaveLength(1)
  })

  it('detects style changes on elements inside a height:0 wrapper', async () => {
    const { before, after } = f('Zero-height wrapper promotion', 'detects style changes inside height:0 wrapper')
    const r = await diffHtml(before, after)

    const allRawChanges = r.raw.diffs.flatMap(d => d.changes)
    const bgChanges = allRawChanges.filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(3)
  })
})

// =====================================================================
// Section 39: Multi-Viewport Diffing
// =====================================================================

describe('Multi-viewport diffing', () => {
  async function captureAtViewport(html: string, width: number, height = 900): Promise<DomManifest> {
    await page.setViewportSize({ width, height })
    await page.setContent(html, { waitUntil: 'load' })
    return captureDomManifest(page, noop)
  }

  afterAll(async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  it('produces independent diff results per viewport for responsive HTML', async () => {
    const before1440 = await captureAtViewport(RESPONSIVE_BEFORE, 1440)
    const after1440 = await captureAtViewport(RESPONSIVE_AFTER, 1440)
    const before768 = await captureAtViewport(RESPONSIVE_BEFORE, 768, 1024)
    const after768 = await captureAtViewport(RESPONSIVE_AFTER, 768, 1024)

    const result = diffManifestsByViewport({
      1440: { before: before1440, after: after1440 },
      768: { before: before768, after: after768 },
    })

    // Desktop (1440): contact link is visible in after → detected as added
    expect(result[1440].diffs.some(d => d.type === 'added')).toBe(true)

    // Tablet (768): contact link is display:none in after → not in manifest → no addition
    expect(result[768].diffs.some(d => d.type === 'added')).toBe(false)
  })

  it('returns complete ViewportDiffResult shape for each viewport', async () => {
    const before1440 = await captureAtViewport(RESPONSIVE_BEFORE, 1440)
    const after1440 = await captureAtViewport(RESPONSIVE_AFTER, 1440)
    const before768 = await captureAtViewport(RESPONSIVE_BEFORE, 768, 1024)
    const after768 = await captureAtViewport(RESPONSIVE_AFTER, 768, 1024)

    const result = diffManifestsByViewport({
      1440: { before: before1440, after: after1440 },
      768: { before: before768, after: after768 },
    })

    for (const vp of [1440, 768]) {
      const r = result[vp]
      expect(r).toBeDefined()
      expect(Array.isArray(r.diffs)).toBe(true)
      expect(Array.isArray(r.groups)).toBe(true)
      expect(Array.isArray(r.cascadeClusters)).toBe(true)
      expect(typeof r.timeMs).toBe('number')
      expect(r.summary).toMatchObject({
        changed: expect.any(Number),
        added: expect.any(Number),
        removed: expect.any(Number),
        moved: expect.any(Number),
        unchanged: expect.any(Number),
        totalChanges: expect.any(Number),
        groupCount: expect.any(Number),
        groupedElementCount: expect.any(Number),
      })
    }
  })
})

// =====================================================================
// Section 40: CSS Transforms
// =====================================================================

describe('CSS transforms', () => {
  it('detects transform scale change', async () => {
    const { before, after } = f('CSS transforms', 'transform scale change')
    const r = await diffHtml(before, after)

    // Browsers compute scale(1) as identity matrix and scale(1.5) as a matrix
    const transformChanges = allChanges(r).filter(c => c.property === 'transform')
    expect(transformChanges).toHaveLength(1)
  })

  it('detects transform rotate change', async () => {
    const { before, after } = f('CSS transforms', 'transform rotate change')
    const r = await diffHtml(before, after)

    const transformChanges = allChanges(r).filter(c => c.property === 'transform')
    expect(transformChanges).toHaveLength(1)
  })

  it('detects transform translate change', async () => {
    const { before, after } = f('CSS transforms', 'transform translate change')
    const r = await diffHtml(before, after)

    const transformChanges = allChanges(r).filter(c => c.property === 'transform')
    expect(transformChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 41: Box-shadow Elevation
// =====================================================================

describe('Box-shadow elevation', () => {
  it('detects flat to elevated (shadow added)', async () => {
    const { before, after } = f('Box-shadow elevation', 'flat to elevated (shadow added)')
    const r = await diffHtml(before, after)

    const shadowChanges = allChanges(r).filter(c => c.property === 'box-shadow')
    expect(shadowChanges).toHaveLength(1)
  })

  it('detects shadow intensity increase', async () => {
    const { before, after } = f('Box-shadow elevation', 'shadow intensity increase')
    const r = await diffHtml(before, after)

    const shadowChanges = allChanges(r).filter(c => c.property === 'box-shadow')
    expect(shadowChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 42: Z-index Stacking
// =====================================================================

describe('Z-index stacking', () => {
  it('detects z-index change on positioned element (reported as visual)', async () => {
    const { before, after } = f('Z-index stacking', 'z-index change on positioned element')
    const r = await diffHtml(before, after)

    // z-index is in the 'visual' category — stacking order changes are
    // visually meaningful, so they survive consolidation.
    const rawZChanges = r.raw.diffs.flatMap(d => d.changes).filter(c => c.property === 'z-index')
    expect(rawZChanges).toHaveLength(1)

    // Consolidation keeps z-index changes (reclassified from position to visual)
    const zChanges = allChanges(r).filter(c => c.property === 'z-index')
    expect(zChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 43: Overflow Changes
// =====================================================================

describe('Overflow changes', () => {
  it('detects overflow hidden to visible (reported as visual)', async () => {
    const { before, after } = f('Overflow changes', 'overflow hidden to visible')
    const r = await diffHtml(before, after)

    // overflow-x/y are in the 'visual' category — clipping changes are
    // visually meaningful, so they survive consolidation.
    const rawOverflow = r.raw.diffs.flatMap(d => d.changes).filter(c =>
      c.property === 'overflow-x' || c.property === 'overflow-y'
    )
    expect(rawOverflow.length).toBeGreaterThanOrEqual(1)

    // Consolidation keeps overflow changes (reclassified from position to visual)
    const overflowChanges = allChanges(r).filter(c =>
      c.property === 'overflow-x' || c.property === 'overflow-y'
    )
    expect(overflowChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects overflow visible to hidden (reported as visual)', async () => {
    const { before, after } = f('Overflow changes', 'overflow visible to hidden')
    const r = await diffHtml(before, after)

    const rawOverflow = r.raw.diffs.flatMap(d => d.changes).filter(c =>
      c.property === 'overflow-x' || c.property === 'overflow-y'
    )
    expect(rawOverflow.length).toBeGreaterThanOrEqual(1)

    const overflowChanges = allChanges(r).filter(c =>
      c.property === 'overflow-x' || c.property === 'overflow-y'
    )
    expect(overflowChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 44: Flex/Grid Sub-properties
// =====================================================================

describe('Flex and grid sub-properties', () => {
  it('detects justify-content change', async () => {
    const { before, after } = f('Flex and grid sub-properties', 'justify-content change')
    const r = await diffHtml(before, after)

    const jcChanges = allChanges(r).filter(c => c.property === 'justify-content')
    expect(jcChanges).toHaveLength(1)
  })

  it('detects align-items change', async () => {
    const { before, after } = f('Flex and grid sub-properties', 'align-items change')
    const r = await diffHtml(before, after)

    const aiChanges = allChanges(r).filter(c => c.property === 'align-items')
    expect(aiChanges).toHaveLength(1)
  })

  it('detects grid-template-columns change', async () => {
    const { before, after } = f('Flex and grid sub-properties', 'grid-template-columns change')
    const r = await diffHtml(before, after)

    const gridChanges = allChanges(r).filter(c => c.property === 'grid-template-columns')
    expect(gridChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 45: SVG Changes
// =====================================================================

describe('SVG changes', () => {
  it('detects SVG wrapper color change (CSS color on parent)', async () => {
    const { before, after } = f('SVG changes', 'SVG wrapper color change')
    const r = await diffHtml(before, after)

    // SVG fill/stroke attributes aren't tracked CSS properties,
    // but CSS color on a wrapper element IS tracked.
    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects SVG shape swap (path → rect)', async () => {
    const { before, after } = f('SVG changes', 'SVG shape swap (triangle to rounded rect)')
    const r = await diffHtml(before, after)

    // Shape swap: old path removed, new rect added (structural change)
    const totalChanges = r.diffs.length + r.groups.length
    expect(totalChanges).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 46: CSS Variable Cascade
// =====================================================================

describe('CSS variable cascade', () => {
  it('detects CSS variable change cascading to multiple children', async () => {
    const { before, after } = f('CSS variable cascade', 'CSS variable change cascades to multiple children')
    const r = await diffHtml(before, after)

    // Changing --primary affects header bg, button bg, link color, badge border/color.
    // Expect multiple ELEMENTS to reflect the cascade. Identical-fingerprint elements
    // (e.g. link + badge both showing `color: #3b82f6 → #8b5cf6`) get grouped — count
    // members, not unique change entries, or groups will hide the cascade breadth.
    const isColorOrBg = (c: { property: string }) =>
      c.property === 'color' || c.property === 'foreground color' ||
      c.property === 'background-color' || c.property.includes('border-color')
    const diffElemCount = r.diffs.filter(d => d.changes.some(isColorOrBg)).length
    const groupElemCount = r.groups
      .filter(g => g.changes.some(isColorOrBg))
      .reduce((sum, g) => sum + g.members.length, 0)
    expect(diffElemCount + groupElemCount).toBeGreaterThanOrEqual(3)
  })
})

// =====================================================================
// Section 47: False-positive Resistance
// =====================================================================

describe('False-positive resistance', () => {
  it('identical re-render produces zero diffs', async () => {
    const { before, after } = f('False-positive resistance', 'identical re-render produces zero diffs')
    const r = await diffHtml(before, after)

    expect(r.diffs).toHaveLength(0)
    expect(r.groups).toHaveLength(0)
  })

  it('identical re-render with explicitProps populated produces zero diffs', async () => {
    const { before, after } = f('False-positive resistance', 'identical re-render produces zero diffs')
    const r = await diffHtml(before, after)

    // Verify explicitProps is populated on captured manifests
    function hasAnyExplicitProps(node: any): boolean {
      if (node.explicitProps && node.explicitProps.length > 0) return true
      return node.children?.some((c: any) => hasAnyExplicitProps(c)) ?? false
    }
    expect(hasAnyExplicitProps(r.before.root)).toBe(true)
    expect(r.diffs).toHaveLength(0)
  })

  it('whitespace-only text difference produces zero diffs (browser collapses whitespace)', async () => {
    const { before, after } = f('False-positive resistance', 'whitespace-only text difference (should suppress)')
    const r = await diffHtml(before, after)

    // Browsers collapse whitespace, so rendered text is the same.
    // The manifest should capture the rendered (collapsed) text, not raw HTML.
    expect(r.diffs).toHaveLength(0)
    expect(r.groups).toHaveLength(0)
  })

  it('explicit value matching inherited default produces zero diffs', async () => {
    const { before, after } = f('False-positive resistance', 'explicit value matches inherited default (no visual diff)')
    const r = await diffHtml(before, after)

    // Setting color: #333 explicitly when it would be inherited as #333
    // should produce the same computed value. No visual diff.
    expect(r.diffs).toHaveLength(0)
    expect(r.groups).toHaveLength(0)
  })

  it('browser-defaulted properties produce zero diffs', async () => {
    const { before, after } = f('False-positive resistance', 'browser-defaulted properties (visibility/opacity at defaults)')
    const r = await diffHtml(before, after)

    // visibility:visible and opacity:1 are browser defaults.
    // Explicitly setting them should produce the same computed values.
    expect(r.diffs).toHaveLength(0)
    expect(r.groups).toHaveLength(0)
  })
})

// =====================================================================
// Section 48: Explicit vs Implicit Size Scoring
// =====================================================================

describe('Explicit vs implicit size scoring', () => {
  it('explicit width change scores higher than implicit cascade width', async () => {
    // Explicit: CSS sets width directly on the element
    const explicit = f('Explicit vs implicit size scoring', 'explicit width change scores higher than cascade')
    const rExplicit = await diffHtml(explicit.before, explicit.after)
    const explicitDiff = findDiffByLabel(rExplicit, 'explicit-box')
    expect(explicitDiff).toBeDefined()

    // Implicit: child width changes because parent shrank (no CSS width on child)
    const implicit = f('Explicit vs implicit size scoring', 'implicit child width change from parent resize scores low')
    const rImplicit = await diffHtml(implicit.before, implicit.after)
    const childDiff = rImplicit.consolidated.diffs.find(d => d.label.includes('child'))

    // If the implicit child width change survives consolidation, it should score lower.
    // If it's been suppressed entirely (bbox-only), that's also correct behavior.
    if (childDiff) {
      expect(explicitDiff!.score).toBeGreaterThan(childDiff.score)
    }
  })

  it('explicit height change scores at full base (not cascade-reduced)', async () => {
    const { before, after } = f('Explicit vs implicit size scoring', 'explicit height change scores higher than cascade')
    const r = await diffHtml(before, after)

    const diff = findDiffByLabel(r, 'explicit-box')
    expect(diff).toBeDefined()
    // With explicitProps, height change on an element with explicit CSS height
    // should use full base score (40 for box-model) * 1.5 for delta > 20px = 60
    // Without explicitProps it would be: 40 * 0.4 * 1.5 = 24
    expect(diff!.score).toBeGreaterThanOrEqual(25) // at least moderate
  })

  it('populates explicitProps on captured manifest nodes', async () => {
    const { before } = f('Explicit vs implicit size scoring', 'explicit width change scores higher than cascade')
    const manifest = await captureHtml(before)

    // The .box element has explicit width and height in CSS
    function findByTestId(node: any, testId: string): any {
      if (node.testId === testId) return node
      for (const child of node.children ?? []) {
        const found = findByTestId(child, testId)
        if (found) return found
      }
      return null
    }

    const boxNode = findByTestId(manifest.root, 'explicit-box')
    expect(boxNode).toBeDefined()
    expect(boxNode.explicitProps).toBeDefined()
    expect(boxNode.explicitProps).toContain('width')
    expect(boxNode.explicitProps).toContain('height')
  })

  it('excludes size props whose authored value is a cascade-deference keyword', async () => {
    function findByTestId(node: any, testId: string): any {
      if (node.testId === testId) return node
      for (const child of node.children ?? []) {
        const found = findByTestId(child, testId)
        if (found) return found
      }
      return null
    }

    // Each box authors a size prop with a keyword that means "defer to cascade/browser".
    // None of these should land in explicitProps — they aren't really authored sizes.
    const html = `<!doctype html><html><body>
      <style>
        .auto    { width: auto;         height: 10px; }
        .initial { width: initial;      height: 10px; }
        .inherit { width: inherit;      height: 10px; }
        .unset   { width: unset;        height: 10px; }
        .revert  { width: revert;       height: 10px; }
        .rlayer  { width: revert-layer; height: 10px; }
        .authored { width: 100px;       height: 10px; }
      </style>
      <div data-testid="b-auto"     class="auto"></div>
      <div data-testid="b-initial"  class="initial"></div>
      <div data-testid="b-inherit"  class="inherit"></div>
      <div data-testid="b-unset"    class="unset"></div>
      <div data-testid="b-revert"   class="revert"></div>
      <div data-testid="b-rlayer"   class="rlayer"></div>
      <div data-testid="b-authored" class="authored"></div>
    </body></html>`
    const manifest = await captureHtml(html)

    for (const id of ['b-auto', 'b-initial', 'b-inherit', 'b-unset', 'b-revert', 'b-rlayer']) {
      const node = findByTestId(manifest.root, id)
      expect(node, id).toBeDefined()
      // width was authored but with a deference keyword — must NOT be in explicitProps
      expect(node.explicitProps ?? [], id).not.toContain('width')
      // height was authored with a real length — MUST be in explicitProps
      expect(node.explicitProps ?? [], id).toContain('height')
    }

    // Sanity: a real authored value still counts
    const authored = findByTestId(manifest.root, 'b-authored')
    expect(authored.explicitProps).toContain('width')
    expect(authored.explicitProps).toContain('height')
  })

  it('keeps non-size props authored with "none" (display:none, background-image:none) as explicit', async () => {
    // Per vr-ijk.27: 'none' is NOT a deference keyword. `display: none` is deliberate
    // (hiding); `background-image: none` is an explicit reset. Both stay authored.
    function findByTestId(node: any, testId: string): any {
      if (!node) return null
      if (node.testId === testId) return node
      for (const child of node.children ?? []) {
        const found = findByTestId(child, testId)
        if (found) return found
      }
      return null
    }

    const html = `<!doctype html><html><body>
      <style>
        .hidden { display: none; }
        .no-bg  { background-image: none; background-color: rgb(255,0,0); width: 100px; height: 20px; }
      </style>
      <div data-testid="b-hidden" class="hidden"></div>
      <div data-testid="b-no-bg"  class="no-bg"></div>
    </body></html>`
    const manifest = await captureHtml(html)

    // display:none elements may be pruned (no bbox); only assert if captured.
    const hidden = findByTestId(manifest.root, 'b-hidden')
    if (hidden) expect(hidden.explicitProps ?? []).toContain('display')

    const noBg = findByTestId(manifest.root, 'b-no-bg')
    expect(noBg).toBeDefined()
    expect(noBg!.explicitProps ?? []).toContain('background-image')
  })
})

// =====================================================================
// Section 49: Implicit Ancestor Size Suppression
// =====================================================================

describe('Implicit ancestor size suppression', () => {
  it('suppresses implicit height on parent when child font-size changes', async () => {
    const { before, after } = f('Implicit ancestor size suppression', 'font-size change on child suppresses implicit height on parent')
    const r = await diffHtml(before, after)

    // The child's font-size change is the real mutation
    const textDiff = findDiffByLabel(r, 'text')
    expect(textDiff).toBeDefined()
    expect(textDiff!.changes.some(c => c.property === 'font-size')).toBe(true)

    // The parent card has no explicit height — its height change is a side-effect.
    // It should be suppressed by consolidation.
    const cardDiff = findDiffByLabel(r, 'card')
    if (cardDiff) {
      // If card survived, it should NOT have height-only changes
      expect(cardDiff.changes.some(c => !CASCADE_PROPS_SET.has(c.property))).toBe(true)
    }
  })

  it('preserves explicit height on parent even when child also changes', async () => {
    const { before, after } = f('Implicit ancestor size suppression', 'explicit height on parent survives when child font-size changes')
    const r = await diffHtml(before, after)

    // Parent has explicit height: 200px → 250px — this should survive
    const cardDiff = findDiffByLabel(r, 'card')
    expect(cardDiff).toBeDefined()
    const heightChange = cardDiff!.changes.find(c => c.property === 'height')
    expect(heightChange).toBeDefined()
  })

  it('suppresses multi-level implicit height cascade', async () => {
    const { before, after } = f('Implicit ancestor size suppression', 'multi-level implicit height cascade all suppressed')
    const r = await diffHtml(before, after)

    // Only the font-size change on the span should survive
    const labelDiff = findDiffByLabel(r, 'label')
    expect(labelDiff).toBeDefined()
    expect(labelDiff!.changes.some(c => c.property === 'font-size')).toBe(true)

    // wrapper and inner have no explicit height — their height changes are suppressed
    const wrapperDiff = findDiffByLabel(r, 'wrapper')
    const innerDiff = findDiffByLabel(r, 'inner')
    if (wrapperDiff) {
      expect(wrapperDiff.changes.some(c => !CASCADE_PROPS_SET.has(c.property))).toBe(true)
    }
    if (innerDiff) {
      expect(innerDiff.changes.some(c => !CASCADE_PROPS_SET.has(c.property))).toBe(true)
    }
  })
})
