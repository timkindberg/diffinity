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

  it('does not collapse non-uniform padding', () => {
    const changes: Change[] = [
      change({ property: 'padding-top', before: '16px', after: '32px' }),
      change({ property: 'padding-bottom', before: '16px', after: '32px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(2)
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

  it('does not collapse margin when values differ across sides', () => {
    const changes: Change[] = [
      change({ property: 'margin-top', before: '8px', after: '16px' }),
      change({ property: 'margin-right', before: '8px', after: '16px' }),
      change({ property: 'margin-bottom', before: '8px', after: '16px' }),
      change({ property: 'margin-left', before: '0px', after: '16px' }),
    ]
    const result = collapseChanges(changes)
    expect(result).toHaveLength(4)
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

  it('does not suppress when element has mixed cascade + non-cascade changes', () => {
    const before = el('body', { children: [
      el('div', { testId: 'card', styles: { height: '50px', color: 'black' }, bbox: { x: 0, y: 0, w: 200, h: 50 } }),
    ]})
    const after = el('body', { children: [
      el('div', { testId: 'card', styles: { height: '60px', color: 'red' }, bbox: { x: 0, y: 0, w: 200, h: 60 } }),
    ]})

    const { consolidated } = fullPipeline(before, after)

    // Has color change (non-cascade) so the diff should survive
    const cardDiff = consolidated.diffs.find(d => d.label.includes('card'))
    expect(cardDiff).toBeDefined()
    expect(cardDiff!.changes.some(c => c.property === 'color')).toBe(true)
  })
})
