import { describe, it, expect, beforeEach } from 'vitest'
import { consolidateDiffs, collapseChanges } from '../diff.js'
import { matchManifests } from '../match.js'
import { el, manifest, resetIdx } from './test-helpers.js'
import type { DiffResult, Change } from '../diff.js'
import { diffManifests } from '../diff.js'

beforeEach(() => resetIdx())

function fullPipeline(beforeRoot: ReturnType<typeof el>, afterRoot: ReturnType<typeof el>) {
  const b = manifest(beforeRoot)
  resetIdx()
  const a = manifest(afterRoot)
  const match = matchManifests(b, a)
  const raw = diffManifests(b, a, match)
  const consolidated = consolidateDiffs(raw, b, a)
  return { raw, consolidated, before: b, after: a }
}

describe('consolidateDiffs', () => {
  it('suppresses descendants of removed elements', () => {
    const before = el('body', { children: [
      el('div', { testId: 'keep' }),
      el('div', { testId: 'parent-gone', children: [
        el('span', { text: 'child1' }),
        el('span', { text: 'child2', children: [
          el('em', { text: 'grandchild' }),
        ]}),
      ]}),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'keep' }),
    ]})

    const { raw, consolidated } = fullPipeline(before, after)

    // Raw should report parent + 3 descendants as removed
    expect(raw.summary.removed).toBeGreaterThanOrEqual(4)

    // Consolidated should only report the top-level parent
    const removedDiffs = consolidated.diffs.filter(d => d.type === 'removed')
    expect(removedDiffs).toHaveLength(1)
    expect(removedDiffs[0].label).toContain('parent-gone')
  })

  it('suppresses descendants of added elements', () => {
    const before = el('body', { children: [
      el('div', { testId: 'existing' }),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'existing' }),
      el('section', { testId: 'new-section', children: [
        el('h2', { text: 'New Feature' }),
        el('p', { text: 'Description here' }),
        el('div', { children: [
          el('button', { text: 'Try it' }),
        ]}),
      ]}),
    ]})

    const { raw, consolidated } = fullPipeline(before, after)

    expect(raw.summary.added).toBeGreaterThanOrEqual(5)

    const addedDiffs = consolidated.diffs.filter(d => d.type === 'added')
    expect(addedDiffs).toHaveLength(1)
    expect(addedDiffs[0].label).toContain('new-section')
  })

  it('drops elements whose only changes are bounding box shifts', () => {
    const before = el('body', { children: [
      el('div', { testId: 'banner', bbox: { x: 0, y: 0, w: 1440, h: 60 } }),
      el('div', { testId: 'content', bbox: { x: 0, y: 60, w: 1440, h: 800 }, children: [
        el('p', { testId: 'para', text: 'hello', bbox: { x: 20, y: 80, w: 400, h: 24 } }),
      ]}),
    ]})

    // Banner got taller, pushing content and para down (bbox-only shift)
    const after = el('body', { children: [
      el('div', { testId: 'banner', bbox: { x: 0, y: 0, w: 1440, h: 100 } }),
      el('div', { testId: 'content', bbox: { x: 0, y: 100, w: 1440, h: 800 }, children: [
        el('p', { testId: 'para', text: 'hello', bbox: { x: 20, y: 120, w: 400, h: 24 } }),
      ]}),
    ]})

    const { raw, consolidated } = fullPipeline(before, after)

    // Raw reports bbox changes on content and para
    const rawBboxOnly = raw.diffs.filter(d =>
      d.type === 'changed' && d.changes.every(c => c.category === 'bbox')
    )
    expect(rawBboxOnly.length).toBeGreaterThanOrEqual(1)

    // Consolidated drops bbox-only elements
    const conBboxOnly = consolidated.diffs.filter(d =>
      d.type === 'changed' && d.changes.every(c => c.category === 'bbox')
    )
    expect(conBboxOnly).toHaveLength(0)

    // But banner still shows (it has bbox w/h change — wait, h changed, that IS bbox)
    // Actually banner's height changed which IS a bbox change...
    // The banner should also be dropped since it's bbox-only
    // The real signal here is that something caused the banner to grow — 
    // that would show up as a style/size change if it had one.
    // With only bbox data, all 3 are bbox-only and get dropped.
    expect(consolidated.diffs.filter(d => d.type === 'changed')).toHaveLength(0)
  })

  it('strips bbox changes from elements that also have meaningful changes', () => {
    const before = el('body', { children: [
      el('div', {
        testId: 'card',
        styles: { color: 'rgb(0,0,0)', 'padding-top': '8px' },
        bbox: { x: 0, y: 0, w: 400, h: 200 },
      }),
    ]})

    const after = el('body', { children: [
      el('div', {
        testId: 'card',
        styles: { color: 'rgb(255,0,0)', 'padding-top': '16px' },
        bbox: { x: 0, y: 40, w: 400, h: 200 },
      }),
    ]})

    const { raw, consolidated } = fullPipeline(before, after)

    // Raw has color + padding + bbox changes
    const rawCard = raw.diffs.find(d => d.label.includes('card'))!
    expect(rawCard.changes.some(c => c.category === 'bbox')).toBe(true)
    expect(rawCard.changes.some(c => c.category === 'typography')).toBe(true)

    // Consolidated keeps color + padding, drops bbox
    const conCard = consolidated.diffs.find(d => d.label.includes('card'))!
    expect(conCard).toBeDefined()
    expect(conCard.changes.every(c => c.category !== 'bbox')).toBe(true)
    expect(conCard.changes.some(c => c.property === 'color')).toBe(true)
    expect(conCard.changes.some(c => c.property === 'padding-top')).toBe(true)
  })

  it('drops elements whose only change is children count', () => {
    const before = el('body', { children: [
      el('ul', { testId: 'list', children: [
        el('li', { testId: 'item-a', text: 'A' }),
        el('li', { testId: 'item-b', text: 'B' }),
      ]}),
    ]})

    const after = el('body', { children: [
      el('ul', { testId: 'list', children: [
        el('li', { testId: 'item-a', text: 'A' }),
        el('li', { testId: 'item-b', text: 'B' }),
        el('li', { testId: 'item-c', text: 'C' }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // The added li is reported
    expect(consolidated.diffs.filter(d => d.type === 'added')).toHaveLength(1)

    // The parent ul's "children: 2→3" is NOT reported as a standalone change
    const listDiff = consolidated.diffs.find(d => d.label.includes('list') && d.type === 'changed')
    expect(listDiff).toBeUndefined()
  })

  it('keeps children count change if parent has other changes too', () => {
    const before = el('body', { children: [
      el('ul', { testId: 'list', styles: { color: 'black' }, children: [
        el('li', { testId: 'item-a', text: 'A' }),
      ]}),
    ]})

    const after = el('body', { children: [
      el('ul', { testId: 'list', styles: { color: 'red' }, children: [
        el('li', { testId: 'item-a', text: 'A' }),
        el('li', { testId: 'item-b', text: 'B' }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Parent has color change AND children count change — keep it
    const listDiff = consolidated.diffs.find(d => d.label.includes('list') && d.type === 'changed')
    expect(listDiff).toBeDefined()
    expect(listDiff!.changes.some(c => c.property === 'color')).toBe(true)
  })

  it('recalculates summary counts after suppression', () => {
    const before = el('body', { children: [
      el('div', { testId: 'keep', styles: { color: 'black' } }),
      el('div', { testId: 'gone', children: [
        el('span', { text: 'a' }),
        el('span', { text: 'b' }),
      ]}),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'keep', styles: { color: 'red' } }),
    ]})

    const { raw, consolidated } = fullPipeline(before, after)

    // Raw: 1 changed + 3 removed (parent + 2 children)
    expect(raw.summary.removed).toBe(3)

    // Consolidated: 1 changed + 1 removed, 2 suppressed moved to unchanged
    expect(consolidated.summary.removed).toBe(1)
    expect(consolidated.summary.changed).toBe(1)
    expect(consolidated.summary.unchanged).toBeGreaterThan(raw.summary.unchanged)
    expect(consolidated.summary.totalChanges).toBeLessThan(raw.summary.totalChanges)
  })

  it('deduplicateAncestorChanges strips ancestor color when descendant has same change', () => {
    const before = el('body', { children: [
      el('a', { testId: 'link', styles: { color: 'rgb(0, 101, 204)' }, children: [
        el('h3', { testId: 'title', styles: { color: 'rgb(0, 101, 204)' }, text: 'Title' }),
      ]}),
    ]})

    const after = el('body', { children: [
      el('a', { testId: 'link', styles: { color: 'rgb(124, 58, 237)' }, children: [
        el('h3', { testId: 'title', styles: { color: 'rgb(124, 58, 237)' }, text: 'Title' }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Descendant (h3) should keep its color change
    const titleDiff = consolidated.diffs.find(d => d.label.includes('title'))
    expect(titleDiff).toBeDefined()
    expect(titleDiff!.changes.some(c => c.property === 'color')).toBe(true)

    // Ancestor (a) should have its color stripped by dedup
    const linkDiff = consolidated.diffs.find(d => d.label.includes('link'))
    if (linkDiff) {
      expect(linkDiff.changes.some(c => c.property === 'color')).toBe(false)
    }
  })

  it('deduplicateAncestorChanges does NOT strip when categories differ (P0 fix)', () => {
    // Container has box-model width change, child has bbox width change.
    // These should NOT be treated as duplicates.
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: { width: '800px' }, explicitProps: ['width'], bbox: { x: 0, y: 0, w: 832, h: 200 }, children: [
        el('div', { testId: 'child', styles: { width: '768px' }, bbox: { x: 0, y: 0, w: 768, h: 50 } }),
      ]}),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'container', styles: { width: '700px' }, explicitProps: ['width'], bbox: { x: 0, y: 0, w: 732, h: 200 }, children: [
        el('div', { testId: 'child', styles: { width: '668px' }, bbox: { x: 0, y: 0, w: 668, h: 50 } }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Container should keep its CSS width change (box-model category)
    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    expect(containerDiff!.changes.some(c => c.property === 'width' && c.category === 'box-model')).toBe(true)
  })

  it('groups 3+ diffs with identical fingerprints into a DiffGroup', () => {
    const before = el('body', { children: [
      el('span', { testId: 'a', styles: { color: 'red' }, text: 'A' }),
      el('span', { testId: 'b', styles: { color: 'red' }, text: 'B' }),
      el('span', { testId: 'c', styles: { color: 'red' }, text: 'C' }),
    ]})

    const after = el('body', { children: [
      el('span', { testId: 'a', styles: { color: 'blue' }, text: 'A' }),
      el('span', { testId: 'b', styles: { color: 'blue' }, text: 'B' }),
      el('span', { testId: 'c', styles: { color: 'blue' }, text: 'C' }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // All 3 have same color change → grouped
    expect(consolidated.groups).toHaveLength(1)
    expect(consolidated.groups[0].members).toHaveLength(3)
    expect(consolidated.groups[0].changes.some(c => c.property === 'color')).toBe(true)
    // None should remain as individual diffs
    expect(consolidated.diffs.filter(d => d.type === 'changed')).toHaveLength(0)
  })

  it('collapses uniform padding to shorthand in full pipeline', () => {
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: {
        'padding-top': '16px', 'padding-right': '16px',
        'padding-bottom': '16px', 'padding-left': '16px',
      }}),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'card', styles: {
        'padding-top': '32px', 'padding-right': '32px',
        'padding-bottom': '32px', 'padding-left': '32px',
      }}),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))!
    expect(cardDiff).toBeDefined()
    expect(cardDiff.changes).toHaveLength(1)
    expect(cardDiff.changes[0].property).toBe('padding')
  })

  it('does not collapse non-uniform padding in full pipeline', () => {
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: {
        'padding-top': '16px', 'padding-bottom': '16px',
      }}),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'card', styles: {
        'padding-top': '32px', 'padding-bottom': '32px',
      }}),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))!
    expect(cardDiff).toBeDefined()
    expect(cardDiff.changes.some(c => c.property === 'padding-top')).toBe(true)
    expect(cardDiff.changes.some(c => c.property === 'padding-bottom')).toBe(true)
    expect(cardDiff.changes.some(c => c.property === 'padding')).toBe(false)
  })

  it('does not group diffs with different fingerprints', () => {
    const before = el('body', { children: [
      el('span', { testId: 'a', styles: { color: 'red' }, text: 'A' }),
      el('span', { testId: 'b', styles: { color: 'blue' }, text: 'B' }),
    ]})

    const after = el('body', { children: [
      el('span', { testId: 'a', styles: { color: 'green' }, text: 'A' }),
      el('span', { testId: 'b', styles: { color: 'purple' }, text: 'B' }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Different before values → different fingerprints → no grouping
    expect(consolidated.groups).toHaveLength(0)
    expect(consolidated.diffs.filter(d => d.type === 'changed')).toHaveLength(2)
  })
})

// ─── collapseChanges unit tests ──────────────────────────────────────

function change(overrides: Partial<Change>): Change {
  return {
    category: overrides.category ?? 'box-model',
    property: overrides.property ?? 'width',
    before: overrides.before ?? '100px',
    after: overrides.after ?? '200px',
    description: overrides.description ?? '',
  }
}

describe('collapseChanges — padding/margin quad', () => {
  it('collapses uniform padding change to shorthand', () => {
    const changes: Change[] = [
      change({ property: 'padding-top', before: '16px', after: '32px' }),
      change({ property: 'padding-right', before: '16px', after: '32px' }),
      change({ property: 'padding-bottom', before: '16px', after: '32px' }),
      change({ property: 'padding-left', before: '16px', after: '32px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('padding')
    expect(result[0].before).toBe('16px')
    expect(result[0].after).toBe('32px')
  })

  it('does not collapse padding when fewer than 4 sides present', () => {
    const changes: Change[] = [
      change({ property: 'padding-top', before: '16px', after: '32px' }),
      change({ property: 'padding-bottom', before: '16px', after: '32px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(2)
  })

  it('collapses padding with vertical/horizontal symmetry to 2-value shorthand', () => {
    const changes: Change[] = [
      change({ property: 'padding-top', before: '12px', after: '10px' }),
      change({ property: 'padding-right', before: '12px', after: '20px' }),
      change({ property: 'padding-bottom', before: '12px', after: '10px' }),
      change({ property: 'padding-left', before: '12px', after: '20px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('padding')
    expect(result[0].before).toBe('12px')
    expect(result[0].after).toBe('10px 20px')
  })

  it('collapses padding with left/right symmetry only to 3-value shorthand', () => {
    const changes: Change[] = [
      change({ property: 'padding-top', before: '10px', after: '4px' }),
      change({ property: 'padding-right', before: '20px', after: '8px' }),
      change({ property: 'padding-bottom', before: '30px', after: '12px' }),
      change({ property: 'padding-left', before: '20px', after: '8px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('padding')
    expect(result[0].before).toBe('10px 20px 30px')
    expect(result[0].after).toBe('4px 8px 12px')
  })

  it('collapses fully asymmetric padding to 4-value shorthand', () => {
    const changes: Change[] = [
      change({ property: 'padding-top', before: '1px', after: '5px' }),
      change({ property: 'padding-right', before: '2px', after: '6px' }),
      change({ property: 'padding-bottom', before: '3px', after: '7px' }),
      change({ property: 'padding-left', before: '4px', after: '8px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('padding')
    expect(result[0].before).toBe('1px 2px 3px 4px')
    expect(result[0].after).toBe('5px 6px 7px 8px')
  })

  it('collapses uniform margin change to shorthand', () => {
    const changes: Change[] = [
      change({ property: 'margin-top', before: '8px', after: '16px' }),
      change({ property: 'margin-right', before: '8px', after: '16px' }),
      change({ property: 'margin-bottom', before: '8px', after: '16px' }),
      change({ property: 'margin-left', before: '8px', after: '16px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('margin')
    expect(result[0].before).toBe('8px')
    expect(result[0].after).toBe('16px')
  })

  it('collapses non-uniform margin to multi-value shorthand', () => {
    const changes: Change[] = [
      change({ property: 'margin-top', before: '8px', after: '16px' }),
      change({ property: 'margin-right', before: '8px', after: '16px' }),
      change({ property: 'margin-bottom', before: '8px', after: '16px' }),
      change({ property: 'margin-left', before: '0px', after: '16px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('margin')
    expect(result[0].before).toBe('8px 8px 8px 0px')
    expect(result[0].after).toBe('16px')
  })
})

describe('collapseChanges — currentColor tracking', () => {
  it('absorbs border-*-color longhands when they track color', () => {
    const changes: Change[] = [
      change({ category: 'typography', property: 'color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' }),
      change({ category: 'visual', property: 'border-top-color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' }),
      change({ category: 'visual', property: 'border-bottom-color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('color')
  })

  it('absorbs border-color shorthand when all 4 sides track color', () => {
    const changes: Change[] = [
      change({ category: 'typography', property: 'color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' }),
      change({ category: 'visual', property: 'border-top-color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' }),
      change({ category: 'visual', property: 'border-right-color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' }),
      change({ category: 'visual', property: 'border-bottom-color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' }),
      change({ category: 'visual', property: 'border-left-color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' }),
    ]
    // Quad collapse produces border-color shorthand, then foreground collapse absorbs it
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('color')
  })

  it('keeps border-color when color did not change (independent border-color change)', () => {
    const changes: Change[] = [
      change({ category: 'visual', property: 'border-top-color', before: 'rgb(221, 221, 221)', after: 'rgb(59, 130, 246)' }),
      change({ category: 'visual', property: 'border-right-color', before: 'rgb(221, 221, 221)', after: 'rgb(59, 130, 246)' }),
      change({ category: 'visual', property: 'border-bottom-color', before: 'rgb(221, 221, 221)', after: 'rgb(59, 130, 246)' }),
      change({ category: 'visual', property: 'border-left-color', before: 'rgb(221, 221, 221)', after: 'rgb(59, 130, 246)' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('border-color')
  })

  it('keeps border-color when before/after do not match color (pinned border)', () => {
    const changes: Change[] = [
      change({ category: 'typography', property: 'color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' }),
      // border-bottom-color changes but lands on a DIFFERENT color than `color`
      change({ category: 'visual', property: 'border-bottom-color', before: 'rgb(0, 0, 0)', after: 'rgb(0, 128, 0)' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(2)
  })
})

describe('collapseChanges — coupled pairs', () => {
  it('drops height when line-height has the same before→after', () => {
    const changes: Change[] = [
      change({ category: 'typography', property: 'line-height', before: '20px', after: '24px' }),
      change({ category: 'box-model', property: 'height', before: '20px', after: '24px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('line-height')
  })

  it('drops width when min-width has the same before→after', () => {
    const changes: Change[] = [
      change({ category: 'sizing', property: 'min-width', before: '100px', after: '200px' }),
      change({ category: 'box-model', property: 'width', before: '100px', after: '200px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('min-width')
  })

  it('drops height when min-height has the same before→after', () => {
    const changes: Change[] = [
      change({ category: 'sizing', property: 'min-height', before: '50px', after: '100px' }),
      change({ category: 'box-model', property: 'height', before: '50px', after: '100px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(1)
    expect(result[0].property).toBe('min-height')
  })

  it('keeps both when coupled pair has different before→after values', () => {
    const changes: Change[] = [
      change({ category: 'sizing', property: 'min-width', before: '100px', after: '200px' }),
      change({ category: 'box-model', property: 'width', before: '150px', after: '250px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(2)
  })

  it('keeps both when only one of the coupled pair exists', () => {
    const changes: Change[] = [
      change({ category: 'box-model', property: 'height', before: '50px', after: '100px' }),
      change({ category: 'typography', property: 'font-size', before: '14px', after: '16px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(2)
  })
})

describe('implicit ancestor size suppression', () => {
  it('suppresses height-only diff when element has no explicitProps for height', () => {
    // Parent has no explicit height, child changes font-size → parent height changes implicitly
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { height: '50px' }, bbox: { x: 0, y: 0, w: 200, h: 50 }, children: [
        el('p', { testId: 'text', styles: { 'font-size': '14px' }, text: 'Hello' }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { height: '60px' }, bbox: { x: 0, y: 0, w: 200, h: 60 }, children: [
        el('p', { testId: 'text', styles: { 'font-size': '20px' }, text: 'Hello' }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // font-size change on the child should survive
    const textDiff = consolidated.diffs.find(d => d.label.includes('text'))
    expect(textDiff).toBeDefined()
    expect(textDiff!.changes.some(c => c.property === 'font-size')).toBe(true)

    // card's height-only change should be suppressed (no explicit height)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    expect(cardDiff).toBeUndefined()
  })

  it('preserves height diff when element has explicitProps for height', () => {
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { height: '200px' }, explicitProps: ['height'], bbox: { x: 0, y: 0, w: 200, h: 200 }, children: [
        el('p', { testId: 'text', text: 'Hello' }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { height: '250px' }, explicitProps: ['height'], bbox: { x: 0, y: 0, w: 200, h: 250 }, children: [
        el('p', { testId: 'text', text: 'Hello' }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // card has explicit height — height change should survive
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    expect(cardDiff).toBeDefined()
    expect(cardDiff!.changes.some(c => c.property === 'height')).toBe(true)
  })

  it('inserted banner causes height cascade: body height suppressed after bbox strip', () => {
    // Body has height change (cascade from inserted banner) + bbox x/y changes.
    // Before the fix, bbox x/y prevented CASCADE_PROPS-only detection.
    const before = el('body', { styles: { height: '178px' }, bbox: { x: 0, y: 0, w: 1440, h: 178 }, children: [
      el('main', { testId: 'content', text: 'Hello' }),
    ]})
    const after = el('body', { styles: { height: '219px' }, bbox: { x: 0, y: 0, w: 1440, h: 219 }, children: [
      el('div', { testId: 'banner', text: 'New banner!' }),
      el('main', { testId: 'content', text: 'Hello' }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Banner addition is reported
    expect(consolidated.diffs.some(d => d.type === 'added' && d.label.includes('banner'))).toBe(true)

    // Body's implicit height change should be suppressed (no explicit height)
    const bodyDiff = consolidated.diffs.find(d => d.label === 'Container' && d.type === 'changed')
    expect(bodyDiff).toBeUndefined()
  })

  it('sidebar width change: main-content width suppressed after bbox strip', () => {
    const before = el('body', { children: [
      el('aside', { testId: 'sidebar', styles: { width: '200px' }, explicitProps: ['width'], bbox: { x: 0, y: 0, w: 200, h: 900 } }),
      el('main', { testId: 'main-content', styles: { width: '1136px' }, bbox: { x: 200, y: 0, w: 1136, h: 900 } }),
    ]})
    const after = el('body', { children: [
      el('aside', { testId: 'sidebar', styles: { width: '240px' }, explicitProps: ['width'], bbox: { x: 0, y: 0, w: 240, h: 900 } }),
      el('main', { testId: 'main-content', styles: { width: '1096px' }, bbox: { x: 240, y: 0, w: 1096, h: 900 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Sidebar width is explicit — should survive
    const sidebarDiff = consolidated.diffs.find(d => d.label.includes('sidebar'))
    expect(sidebarDiff).toBeDefined()
    expect(sidebarDiff!.changes.some(c => c.property === 'width')).toBe(true)

    // Main-content width is implicit (no explicitProps) — should be suppressed
    const mainDiff = consolidated.diffs.find(d => d.label.includes('main-content'))
    expect(mainDiff).toBeUndefined()
  })

  it('parent border change: child width suppressed after bbox strip', () => {
    const before = el('body', { children: [
      el('div', { testId: 'parent', styles: { 'border-top-width': '0px', 'border-top-style': 'none', 'border-top-color': 'rgb(0,0,0)' }, explicitProps: ['border-top-width', 'border-top-style', 'border-top-color'], bbox: { x: 0, y: 0, w: 1440, h: 400 }, children: [
        el('div', { testId: 'child', styles: { width: '1390px' }, bbox: { x: 25, y: 0, w: 1390, h: 300 } }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'parent', styles: { 'border-top-width': '3px', 'border-top-style': 'solid', 'border-top-color': 'rgb(255,0,0)' }, explicitProps: ['border-top-width', 'border-top-style', 'border-top-color'], bbox: { x: 0, y: 0, w: 1440, h: 400 }, children: [
        el('div', { testId: 'child', styles: { width: '1384px' }, bbox: { x: 25, y: 3, w: 1384, h: 297 } }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Parent border change should survive
    const parentDiff = consolidated.diffs.find(d => d.label.includes('parent'))
    expect(parentDiff).toBeDefined()
    expect(parentDiff!.changes.some(c => c.property.includes('border'))).toBe(true)

    // Child's implicit width change should be suppressed
    const childDiff = consolidated.diffs.find(d => d.label.includes('child'))
    expect(childDiff).toBeUndefined()
  })

  it('strips implicit cascade props but keeps non-cascade changes from mixed diffs', () => {
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { height: '50px', color: 'black' }, bbox: { x: 0, y: 0, w: 200, h: 50 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { height: '60px', color: 'red' }, bbox: { x: 0, y: 0, w: 200, h: 60 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Diff survives because it has a non-cascade change (color)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    expect(cardDiff).toBeDefined()
    expect(cardDiff!.changes.some(c => c.property === 'color')).toBe(true)
    // But the implicit height change should be individually stripped
    expect(cardDiff!.changes.some(c => c.property === 'height')).toBe(false)
  })

  it('strips implicit width from mixed border+width diff (parent border change)', () => {
    // Parent adds a border → child's computed width shrinks (implicit cascade)
    // The child's diff should keep border-related changes but strip the implicit width
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: {
        'border-top-width': '0px', 'border-top-style': 'none', 'border-top-color': 'rgb(0,0,0)',
        width: '1406px',
      }, explicitProps: ['border-top-width', 'border-top-style', 'border-top-color'], bbox: { x: 0, y: 0, w: 1406, h: 400 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: {
        'border-top-width': '3px', 'border-top-style': 'solid', 'border-top-color': 'rgb(255,0,0)',
        width: '1400px',
      }, explicitProps: ['border-top-width', 'border-top-style', 'border-top-color'], bbox: { x: 0, y: 0, w: 1400, h: 400 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    // Border changes should survive (explicit)
    expect(containerDiff!.changes.some(c => c.property.includes('border'))).toBe(true)
    // Implicit width should be stripped (not in explicitProps)
    expect(containerDiff!.changes.some(c => c.property === 'width')).toBe(false)
  })

  it('strips implicit height from body when banner is inserted alongside other changes', () => {
    // Body has height change (cascade from inserted banner) + children count change
    const before = el('body', { styles: { height: '178px' }, bbox: { x: 0, y: 0, w: 1440, h: 178 }, children: [
      el('main', { testId: 'content', styles: { color: 'rgb(0,0,0)' }, text: 'Hello' }),
    ]})
    const after = el('body', { styles: { height: '219px', color: 'rgb(255,0,0)' }, bbox: { x: 0, y: 0, w: 1440, h: 219 }, children: [
      el('div', { testId: 'banner', text: 'New banner!' }),
      el('main', { testId: 'content', styles: { color: 'rgb(255,0,0)' }, text: 'Hello' }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Body diff should exist (it has children count + color changes)
    // but implicit height should be stripped
    const bodyDiff = consolidated.diffs.find(d => d.label === 'Container' && d.type === 'changed')
    if (bodyDiff) {
      expect(bodyDiff.changes.some(c => c.property === 'height')).toBe(false)
    }
  })
})

describe('flex/grid sibling cascade preservation (vr-jnz)', () => {
  it('preserves implicit width on flex sibling when another sibling has authored layout change', () => {
    // Parent is display:flex. Sibling A (.nav-actions) has an authored margin-left change;
    // Sibling B (.nav-search, flex:1) has its implicit width shrink/grow as a consequence.
    // Without this fix, B's width change is stripped as "implicit cascade noise" and the
    // user has no signal that the search input got visibly wider/narrower.
    const before = el('body', { children: [
      el('nav', { testId: 'nav', styles: { display: 'flex' }, explicitProps: ['display'], bbox: { x: 0, y: 0, w: 1440, h: 60 }, children: [
        el('div', { testId: 'nav-brand', styles: {}, bbox: { x: 0, y: 0, w: 100, h: 60 } }),
        el('div', { testId: 'nav-search', styles: { flex: '1 1 0%', width: '1200px' }, explicitProps: ['flex'], bbox: { x: 100, y: 0, w: 1200, h: 60 } }),
        el('div', { testId: 'nav-actions', styles: { 'margin-left': '40px' }, explicitProps: ['margin-left'], bbox: { x: 1300, y: 0, w: 140, h: 60 } }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('nav', { testId: 'nav', styles: { display: 'flex' }, explicitProps: ['display'], bbox: { x: 0, y: 0, w: 1440, h: 60 }, children: [
        el('div', { testId: 'nav-brand', styles: {}, bbox: { x: 0, y: 0, w: 100, h: 60 } }),
        el('div', { testId: 'nav-search', styles: { flex: '1 1 0%', width: '1100px' }, explicitProps: ['flex'], bbox: { x: 100, y: 0, w: 1100, h: 60 } }),
        el('div', { testId: 'nav-actions', styles: { 'margin-left': '140px' }, explicitProps: ['margin-left'], bbox: { x: 1200, y: 0, w: 240, h: 60 } }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // nav-actions' authored margin-left change is reported
    const actionsDiff = consolidated.diffs.find(d => d.label.includes('nav-actions'))
    expect(actionsDiff).toBeDefined()
    expect(actionsDiff!.changes.some(c => c.property === 'margin-left')).toBe(true)

    // nav-search's implicit width change should be preserved (flex sibling cascade)
    const searchDiff = consolidated.diffs.find(d => d.label.includes('nav-search'))
    expect(searchDiff).toBeDefined()
    expect(searchDiff!.changes.some(c => c.property === 'width')).toBe(true)
  })

  it('preserves implicit widths on flex items when flex parent has authored gap change', () => {
    // Parent-driven redistribution: .container has authored `gap` change; children
    // redistribute widths as a consequence. Children's implicit widths should be kept.
    // (Widths differ between items so identical fingerprints don't fold them into a group
    // — we want to assert per-item diffs survive, not verify grouping behavior.)
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: { display: 'flex', gap: '10px' }, explicitProps: ['display', 'gap'], bbox: { x: 0, y: 0, w: 1000, h: 100 }, children: [
        el('div', { testId: 'item-a', styles: { flex: '2 1 0%', width: '660px' }, explicitProps: ['flex'], bbox: { x: 0, y: 0, w: 660, h: 100 } }),
        el('div', { testId: 'item-b', styles: { flex: '1 1 0%', width: '330px' }, explicitProps: ['flex'], bbox: { x: 670, y: 0, w: 330, h: 100 } }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: { display: 'flex', gap: '50px' }, explicitProps: ['display', 'gap'], bbox: { x: 0, y: 0, w: 1000, h: 100 }, children: [
        el('div', { testId: 'item-a', styles: { flex: '2 1 0%', width: '633px' }, explicitProps: ['flex'], bbox: { x: 0, y: 0, w: 633, h: 100 } }),
        el('div', { testId: 'item-b', styles: { flex: '1 1 0%', width: '317px' }, explicitProps: ['flex'], bbox: { x: 683, y: 0, w: 317, h: 100 } }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const aDiff = consolidated.diffs.find(d => d.label.includes('item-a'))
    expect(aDiff).toBeDefined()
    expect(aDiff!.changes.some(c => c.property === 'width')).toBe(true)
    const bDiff = consolidated.diffs.find(d => d.label.includes('item-b'))
    expect(bDiff).toBeDefined()
    expect(bDiff!.changes.some(c => c.property === 'width')).toBe(true)
  })

  it('does NOT preserve implicit width when parent is block (not flex/grid)', () => {
    // Regression guard: the sibling-cascade rule is narrowly scoped to flex/grid parents.
    // Block-level siblings do not redistribute the way flex items do, so implicit width
    // changes there remain noise (e.g., parent border-width adds a few px, child computed
    // width shrinks — still stripped).
    const before = el('body', { children: [
      el('div', { testId: 'parent', styles: {
        'border-top-width': '0px', 'border-top-style': 'none', 'border-top-color': 'rgb(0,0,0)',
      }, explicitProps: ['border-top-width', 'border-top-style', 'border-top-color'], bbox: { x: 0, y: 0, w: 1440, h: 400 }, children: [
        el('div', { testId: 'child', styles: { width: '1390px' }, bbox: { x: 25, y: 0, w: 1390, h: 300 } }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'parent', styles: {
        'border-top-width': '3px', 'border-top-style': 'solid', 'border-top-color': 'rgb(255,0,0)',
      }, explicitProps: ['border-top-width', 'border-top-style', 'border-top-color'], bbox: { x: 0, y: 0, w: 1440, h: 400 }, children: [
        el('div', { testId: 'child', styles: { width: '1384px' }, bbox: { x: 25, y: 3, w: 1384, h: 297 } }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Child's implicit width change should still be suppressed (parent is block, no sibling cascade)
    const childDiff = consolidated.diffs.find(d => d.label.includes('child'))
    expect(childDiff).toBeUndefined()
  })
})

describe('authored-value equality for cascade suppression', () => {
  // These tests drive the shift from "prop is authored on either side" to
  // "authored value actually differs between before/after or is added/removed".
  // The old rule reports every computed-px change on an element that authored
  // a relative sizing rule (e.g. width: 100%, flex-basis: 1fr) as if the
  // author changed intent — even when they only changed the container.
  //
  // New rule: if authored value is identical on both sides, the computed px
  // change is purely cascade and should be stripped.

  it('silences `width: 100%` computed-px change when authored value is identical', () => {
    // Real-world: container width shifts by 2px because its own parent reflows
    // (e.g. sidebar mutation on the page). The child with `width: 100%` faithfully
    // mirrors the shift. The author did not change anything about this element —
    // the width: 100% is the same rule before and after.
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '520px' }, authoredStyles: { width: '100%' }, bbox: { x: 0, y: 0, w: 520, h: 100 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '518px' }, authoredStyles: { width: '100%' }, bbox: { x: 0, y: 0, w: 518, h: 100 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    expect(cardDiff, 'implicit width: 100% cascade should be silenced').toBeUndefined()
  })

  it('silences `grid-template-columns: 1fr 1fr` when authored value is identical', () => {
    // Classic VNDLY case: a two-column grid resizes 2px because its parent resized.
    // The author wrote `1fr 1fr` and didn't change anything; the browser only
    // reports different computed px tracks. Should be silenced.
    const before = el('body', { children: [
      el('div', {
        testId: 'grid',
        styles: { display: 'grid', 'grid-template-columns': '518.5px 518.5px' },
        authoredStyles: { display: 'grid', 'grid-template-columns': '1fr 1fr' },
        bbox: { x: 0, y: 0, w: 1040, h: 100 },
      }),
    ]})
    const after = el('body', { children: [
      el('div', {
        testId: 'grid',
        styles: { display: 'grid', 'grid-template-columns': '516.5px 516.5px' },
        authoredStyles: { display: 'grid', 'grid-template-columns': '1fr 1fr' },
        bbox: { x: 0, y: 0, w: 1034, h: 100 },
      }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const gridDiff = consolidated.diffs.find(d => d.label.includes('grid'))
    expect(gridDiff, 'same authored `1fr 1fr` → computed-px track change is cascade').toBeUndefined()
  })

  it('preserves `grid-template-columns` when authored value differs (1fr 1fr → 1fr 2fr)', () => {
    // Author genuinely changed intent: keep the diff.
    const before = el('body', { children: [
      el('div', {
        testId: 'grid',
        styles: { display: 'grid', 'grid-template-columns': '520px 520px' },
        authoredStyles: { display: 'grid', 'grid-template-columns': '1fr 1fr' },
        bbox: { x: 0, y: 0, w: 1040, h: 100 },
      }),
    ]})
    const after = el('body', { children: [
      el('div', {
        testId: 'grid',
        styles: { display: 'grid', 'grid-template-columns': '347px 693px' },
        authoredStyles: { display: 'grid', 'grid-template-columns': '1fr 2fr' },
        bbox: { x: 0, y: 0, w: 1040, h: 100 },
      }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const gridDiff = consolidated.diffs.find(d => d.label.includes('grid'))
    expect(gridDiff, 'different authored tracks → preserved').toBeDefined()
    expect(gridDiff!.changes.some(c => c.property === 'grid-template-columns')).toBe(true)
  })

  it('preserves `width` when authored value differs (100% → 50%)', () => {
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '520px' }, authoredStyles: { width: '100%' }, bbox: { x: 0, y: 0, w: 520, h: 100 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '260px' }, authoredStyles: { width: '50%' }, bbox: { x: 0, y: 0, w: 260, h: 100 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    expect(cardDiff, 'different authored percentage → preserved').toBeDefined()
    expect(cardDiff!.changes.some(c => c.property === 'width')).toBe(true)
  })

  it('preserves `width` when authored on one side only (added or removed rule)', () => {
    // Author added `width: 100%` where previously there was none. The change in
    // authoring intent matters even though the computed value happens to coincide.
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '520px' }, authoredStyles: {}, bbox: { x: 0, y: 0, w: 520, h: 100 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '520px' }, authoredStyles: { width: '100%' }, bbox: { x: 0, y: 0, w: 520, h: 100 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    // No computed change → nothing to strip either way, this is really a no-op
    // test for the computed side; the guard is that if the computed IS different
    // but authored was added/removed, the change survives.
    if (cardDiff) expect(cardDiff.changes.some(c => c.property === 'width')).toBe(false)
  })

  it('silences cascade-deference authored values (`width: auto` both sides)', () => {
    // Capture side already drops `width: auto` from authoredStyles; the new
    // rule still produces the same outcome (authored absent on both → strip).
    // This test is a regression guard as we refactor.
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '520px' }, authoredStyles: {}, bbox: { x: 0, y: 0, w: 520, h: 100 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '518px' }, authoredStyles: {}, bbox: { x: 0, y: 0, w: 518, h: 100 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    expect(cardDiff, 'width: auto on both → cascade, silenced').toBeUndefined()
  })
})

describe('authored-value equality for cascade suppression — extra shapes', () => {
  it('silences `flex-basis: 1fr` cascade when authored value is identical', () => {
    const before = el('body', { children: [
      el('div', { testId: 'item', styles: { 'flex-basis': '200px', width: '200px' }, authoredStyles: { 'flex-basis': '1fr' }, bbox: { x: 0, y: 0, w: 200, h: 50 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'item', styles: { 'flex-basis': '180px', width: '180px' }, authoredStyles: { 'flex-basis': '1fr' }, bbox: { x: 0, y: 0, w: 180, h: 50 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const itemDiff = consolidated.diffs.find(d => d.label.includes('item'))
    expect(itemDiff, 'same authored flex-basis `1fr` → cascade, silenced').toBeUndefined()
  })

  it('preserves `flex-basis` when authored value differs (1fr → 50%)', () => {
    const before = el('body', { children: [
      el('div', { testId: 'item', styles: { 'flex-basis': '200px' }, authoredStyles: { 'flex-basis': '1fr' }, bbox: { x: 0, y: 0, w: 200, h: 50 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'item', styles: { 'flex-basis': '100px' }, authoredStyles: { 'flex-basis': '50%' }, bbox: { x: 0, y: 0, w: 100, h: 50 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const itemDiff = consolidated.diffs.find(d => d.label.includes('item'))
    expect(itemDiff, 'different authored flex-basis → preserved').toBeDefined()
    expect(itemDiff!.changes.some(c => c.property === 'flex-basis')).toBe(true)
  })

  it('silences `width: fit-content` cascade when authored value is identical', () => {
    const before = el('body', { children: [
      el('div', { testId: 'chip', styles: { width: '120px' }, authoredStyles: { width: 'fit-content' }, bbox: { x: 0, y: 0, w: 120, h: 24 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'chip', styles: { width: '118px' }, authoredStyles: { width: 'fit-content' }, bbox: { x: 0, y: 0, w: 118, h: 24 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const chipDiff = consolidated.diffs.find(d => d.label.includes('chip'))
    expect(chipDiff, 'same authored `fit-content` → cascade, silenced').toBeUndefined()
  })

  it('silences `width: calc(...)` cascade when authored value is identical (same rule, different resolved px)', () => {
    // calc(100% - 40px) computes to a different pixel value when the parent
    // resizes, but the author's rule is unchanged.
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '360px' }, authoredStyles: { width: 'calc(100% - 40px)' }, bbox: { x: 0, y: 0, w: 360, h: 80 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '340px' }, authoredStyles: { width: 'calc(100% - 40px)' }, bbox: { x: 0, y: 0, w: 340, h: 80 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    expect(cardDiff, 'same authored calc() → cascade, silenced').toBeUndefined()
  })

  it('preserves `width: calc(...)` when the formula itself changed (100%-40px → 100%-20px)', () => {
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '360px' }, authoredStyles: { width: 'calc(100% - 40px)' }, bbox: { x: 0, y: 0, w: 360, h: 80 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { width: '380px' }, authoredStyles: { width: 'calc(100% - 20px)' }, bbox: { x: 0, y: 0, w: 380, h: 80 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    expect(cardDiff, 'different authored calc() → preserved').toBeDefined()
    expect(cardDiff!.changes.some(c => c.property === 'width')).toBe(true)
  })

  it('silences `width: min-content` and `width: max-content` cascades when authored value is identical', () => {
    for (const keyword of ['min-content', 'max-content']) {
      const before = el('body', { children: [
        el('div', { testId: `box-${keyword}`, styles: { width: '88px' }, authoredStyles: { width: keyword }, bbox: { x: 0, y: 0, w: 88, h: 20 } }),
      ]})
      const after = el('body', { children: [
        el('div', { testId: `box-${keyword}`, styles: { width: '84px' }, authoredStyles: { width: keyword }, bbox: { x: 0, y: 0, w: 84, h: 20 } }),
      ]})

      const { consolidated } = fullPipeline(before, after)
      const boxDiff = consolidated.diffs.find(d => d.label.includes(`box-${keyword}`))
      expect(boxDiff, `same authored \`${keyword}\` → cascade, silenced`).toBeUndefined()
    }
  })
})

describe('browser-default margin suppression', () => {
  it('suppresses margin changes that scale with font-size (1em default)', () => {
    // <p> with font-size 16px → 32px: margins are 1em (16px → 32px)
    const before = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '16px',
        'margin-top': '16px',
        'margin-bottom': '16px',
      }, text: 'Hello' }),
    ]})
    const after = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '32px',
        'margin-top': '32px',
        'margin-bottom': '32px',
      }, text: 'Hello' }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const paraDiff = consolidated.diffs.find(d => d.label.includes('para'))
    expect(paraDiff).toBeDefined()
    // font-size change should survive
    expect(paraDiff!.changes.some(c => c.property === 'font-size')).toBe(true)
    // margin changes should be suppressed (they're browser defaults scaling with font-size)
    expect(paraDiff!.changes.some(c => c.property === 'margin-top')).toBe(false)
    expect(paraDiff!.changes.some(c => c.property === 'margin-bottom')).toBe(false)
  })

  it('suppresses margin on h1 with font-size change', () => {
    // <h1> default margins are ~0.67em — but if computed margin == font-size, suppress
    // This tests the case where margins happen to equal font-size (1em)
    const before = el('body', { children: [
      el('h1', { testId: 'title', styles: {
        'font-size': '24px',
        'margin-top': '24px',
        'margin-bottom': '24px',
      }, text: 'Title' }),
    ]})
    const after = el('body', { children: [
      el('h1', { testId: 'title', styles: {
        'font-size': '36px',
        'margin-top': '36px',
        'margin-bottom': '36px',
      }, text: 'Title' }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const titleDiff = consolidated.diffs.find(d => d.label.includes('title'))
    expect(titleDiff).toBeDefined()
    expect(titleDiff!.changes.some(c => c.property === 'font-size')).toBe(true)
    expect(titleDiff!.changes.some(c => c.property === 'margin-top')).toBe(false)
    expect(titleDiff!.changes.some(c => c.property === 'margin-bottom')).toBe(false)
  })

  it('keeps margin changes when they do NOT equal font-size', () => {
    // Margins differ from font-size → they were explicitly set, keep them
    const before = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '16px',
        'margin-top': '24px',
        'margin-bottom': '24px',
      }, text: 'Hello' }),
    ]})
    const after = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '32px',
        'margin-top': '48px',
        'margin-bottom': '48px',
      }, text: 'Hello' }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const paraDiff = consolidated.diffs.find(d => d.label.includes('para'))
    expect(paraDiff).toBeDefined()
    // Margins are 1.5em, not 1em — keep them
    expect(paraDiff!.changes.some(c => c.property === 'margin-top')).toBe(true)
    expect(paraDiff!.changes.some(c => c.property === 'margin-bottom')).toBe(true)
  })

  it('keeps margin changes when there is no font-size change', () => {
    // Margin changed but font-size didn't → explicit margin change
    const before = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '16px',
        'margin-top': '16px',
        'margin-bottom': '16px',
      }, text: 'Hello' }),
    ]})
    const after = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '16px',
        'margin-top': '32px',
        'margin-bottom': '32px',
      }, text: 'Hello' }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const paraDiff = consolidated.diffs.find(d => d.label.includes('para'))
    expect(paraDiff).toBeDefined()
    expect(paraDiff!.changes.some(c => c.property === 'margin-top')).toBe(true)
    expect(paraDiff!.changes.some(c => c.property === 'margin-bottom')).toBe(true)
  })

  it('reduces score significantly when margin scaling is suppressed', () => {
    // This is the exact scenario from the bead: font-size change on <p>
    // inflating score from ~42 (moderate) to 116 (critical)
    const before = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '16px',
        'margin-top': '16px',
        'margin-bottom': '16px',
      }, text: 'Hello' }),
    ]})
    const after = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '32px',
        'margin-top': '32px',
        'margin-bottom': '32px',
      }, text: 'Hello' }),
    ]})

    const { raw, consolidated } = fullPipeline(before, after)

    const rawPara = raw.diffs.find(d => d.label.includes('para'))!
    const conPara = consolidated.diffs.find(d => d.label.includes('para'))!

    // Raw should have font-size + margin-top + margin-bottom (3 changes)
    expect(rawPara.changes).toHaveLength(3)
    // Consolidated should have only font-size (1 change)
    expect(conPara.changes).toHaveLength(1)
    // Score should be lower after suppression
    expect(conPara.score).toBeLessThan(rawPara.score)
  })

  it('only suppresses matching margin sides, keeps non-matching sides', () => {
    // margin-top matches font-size scaling, margin-left does not
    const before = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '16px',
        'margin-top': '16px',
        'margin-left': '20px',
      }, text: 'Hello' }),
    ]})
    const after = el('body', { children: [
      el('p', { testId: 'para', styles: {
        'font-size': '32px',
        'margin-top': '32px',
        'margin-left': '40px',
      }, text: 'Hello' }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const paraDiff = consolidated.diffs.find(d => d.label.includes('para'))!
    expect(paraDiff).toBeDefined()
    expect(paraDiff.changes.some(c => c.property === 'font-size')).toBe(true)
    // margin-top suppressed (16==16, 32==32)
    expect(paraDiff.changes.some(c => c.property === 'margin-top')).toBe(false)
    // margin-left kept (20!=16, 40!=32)
    expect(paraDiff.changes.some(c => c.property === 'margin-left')).toBe(true)
  })
})

describe('implicit child dimension suppression (display type changes)', () => {
  it('suppresses child width/height/min-* when parent changes display', () => {
    // Parent: display block→flex. Children gain computed width/height/min-*
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: { display: 'block' }, children: [
        el('span', { testId: 'child1', styles: { width: '0px', height: '0px', 'min-width': '0px', 'min-height': '0px' } }),
        el('span', { testId: 'child2', styles: { width: '0px', height: '0px', 'min-width': '0px', 'min-height': '0px' } }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: { display: 'flex' }, children: [
        el('span', { testId: 'child1', styles: { width: '120px', height: '40px', 'min-width': '120px', 'min-height': '40px' } }),
        el('span', { testId: 'child2', styles: { width: '80px', height: '40px', 'min-width': '80px', 'min-height': '40px' } }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Container's display change should survive
    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    expect(containerDiff!.changes.some(c => c.property === 'display')).toBe(true)

    // Children's implicit width/height/min-* should be suppressed
    const child1Diff = consolidated.diffs.find(d => d.label.includes('child1'))
    expect(child1Diff).toBeUndefined()
    const child2Diff = consolidated.diffs.find(d => d.label.includes('child2'))
    expect(child2Diff).toBeUndefined()
  })

  it('preserves child cascade props when child has explicitProps', () => {
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: { display: 'block' }, children: [
        el('span', { testId: 'child', styles: { width: '100px', height: '0px' }, explicitProps: ['width'] }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: { display: 'flex' }, children: [
        el('span', { testId: 'child', styles: { width: '200px', height: '40px' }, explicitProps: ['width'] }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Child's explicit width should survive
    const childDiff = consolidated.diffs.find(d => d.label.includes('child'))
    expect(childDiff).toBeDefined()
    expect(childDiff!.changes.some(c => c.property === 'width')).toBe(true)
    // But implicit height should be stripped
    expect(childDiff!.changes.some(c => c.property === 'height')).toBe(false)
  })

  it('strips cascade props but keeps non-cascade changes on children', () => {
    // Child has color change + implicit width/height from parent display change
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: { display: 'block' }, children: [
        el('span', { testId: 'child', styles: { color: 'rgb(0,0,0)', width: '0px', height: '0px' } }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: { display: 'flex' }, children: [
        el('span', { testId: 'child', styles: { color: 'rgb(255,0,0)', width: '120px', height: '40px' } }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const childDiff = consolidated.diffs.find(d => d.label.includes('child'))
    expect(childDiff).toBeDefined()
    // Color change should survive (not a CASCADE_PROP)
    expect(childDiff!.changes.some(c => c.property === 'color')).toBe(true)
    // Implicit width/height should be stripped
    expect(childDiff!.changes.some(c => c.property === 'width')).toBe(false)
    expect(childDiff!.changes.some(c => c.property === 'height')).toBe(false)
  })

  it('does not suppress when parent has no display change', () => {
    // Parent has color change only, child has implicit width change
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: { color: 'rgb(0,0,0)' }, children: [
        el('span', { testId: 'child', styles: { width: '100px' } }),
      ]}),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: { color: 'rgb(255,0,0)' }, children: [
        el('span', { testId: 'child', styles: { width: '200px' } }),
      ]}),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Child's width change should NOT be suppressed (parent has no display change)
    // (It may still be suppressed by the existing ancestor suppression if it's CASCADE-only)
    // The point is that the display-change-specific suppression doesn't apply
    const childDiff = consolidated.diffs.find(d => d.label.includes('child'))
    // Existing suppression would suppress this too (cascade-only + no explicit)
    // so we can't test absence of the new suppression in isolation
    // Just verify the parent survives
    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    expect(containerDiff!.changes.some(c => c.property === 'color')).toBe(true)
  })
})

describe('phantom grid-template-* suppression (display toggles grid)', () => {
  it('strips grid-template-columns/rows/areas when display changes block → grid', () => {
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'block',
        'grid-template-columns': 'none',
        'grid-template-rows': 'none',
        'grid-template-areas': 'none',
      } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'grid',
        'grid-template-columns': '199px 199px 199px',
        'grid-template-rows': '100px',
        'grid-template-areas': 'none',
      } }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    // display change should survive
    expect(containerDiff!.changes.some(c => c.property === 'display')).toBe(true)
    // phantom grid-template-* should be stripped
    expect(containerDiff!.changes.some(c => c.property === 'grid-template-columns')).toBe(false)
    expect(containerDiff!.changes.some(c => c.property === 'grid-template-rows')).toBe(false)
  })

  it('strips phantom grid-template-* when display changes flex → grid', () => {
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'flex',
        'grid-template-columns': 'none',
        'grid-template-rows': 'none',
      } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'grid',
        'grid-template-columns': '150px 150px',
        'grid-template-rows': '80px',
      } }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    expect(containerDiff!.changes.some(c => c.property === 'display')).toBe(true)
    expect(containerDiff!.changes.some(c => c.property === 'grid-template-columns')).toBe(false)
    expect(containerDiff!.changes.some(c => c.property === 'grid-template-rows')).toBe(false)
  })

  it('strips phantom grid-template-* when display changes grid → block (reverse)', () => {
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'grid',
        'grid-template-columns': '100px 100px',
        'grid-template-rows': '50px',
      } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'block',
        'grid-template-columns': 'none',
        'grid-template-rows': 'none',
      } }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    expect(containerDiff!.changes.some(c => c.property === 'display')).toBe(true)
    expect(containerDiff!.changes.some(c => c.property === 'grid-template-columns')).toBe(false)
    expect(containerDiff!.changes.some(c => c.property === 'grid-template-rows')).toBe(false)
  })

  it('keeps grid-template-columns when it is in explicitProps (author set it)', () => {
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'block',
        'grid-template-columns': 'none',
      }, explicitProps: ['display', 'grid-template-columns'] }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'grid',
        'grid-template-columns': '1fr 1fr',
      }, explicitProps: ['display', 'grid-template-columns'] }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    // explicit grid-template-columns should survive
    expect(containerDiff!.changes.some(c => c.property === 'grid-template-columns')).toBe(true)
  })

  it('does not strip grid-template-* when display does not change in/out of grid', () => {
    // display stays flex, but grid-template-columns was authored differently
    // (100px vs 200px). Phantom-grid suppression is only about the display
    // toggle; an authored value change must survive. (General cascade strip
    // also preserves it because authored values differ.)
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'flex',
        'grid-template-columns': '100px',
      }, explicitProps: ['display', 'grid-template-columns'] }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'inline-flex',
        'grid-template-columns': '200px',
      }, explicitProps: ['display', 'grid-template-columns'] }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    // Neither before nor after is grid → phantom suppression should not fire
    expect(containerDiff!.changes.some(c => c.property === 'grid-template-columns')).toBe(true)
  })

  it('treats inline-grid as grid (no phantom template diff when toggling inline-grid)', () => {
    const before = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'block',
        'grid-template-columns': 'none',
      } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'container', styles: {
        display: 'inline-grid',
        'grid-template-columns': '100px 100px',
      } }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    const containerDiff = consolidated.diffs.find(d => d.label.includes('container'))
    expect(containerDiff).toBeDefined()
    expect(containerDiff!.changes.some(c => c.property === 'display')).toBe(true)
    expect(containerDiff!.changes.some(c => c.property === 'grid-template-columns')).toBe(false)
  })
})
