import { describe, it, expect, beforeEach } from 'vitest'
import { matchManifests } from '../match.js'
import { diffManifests, scoreDiff, type DiffResult } from '../diff.js'
import { el, manifest, resetIdx } from './test-helpers.js'

beforeEach(() => resetIdx())

function diffFromTrees(beforeRoot: ReturnType<typeof el>, afterRoot: ReturnType<typeof el>): DiffResult {
  const b = manifest(beforeRoot)
  resetIdx()
  const a = manifest(afterRoot)
  const match = matchManifests(b, a)
  return diffManifests(b, a, match)
}

describe('diffManifests', () => {
  it('reports no diffs for identical trees', () => {
    const tree = () => el('body', { children: [
      el('div', { testId: 'card', styles: { color: 'red' }, text: 'hello' }),
    ]})

    const result = diffFromTrees(tree(), tree())
    expect(result.diffs).toHaveLength(0)
    expect(result.summary.unchanged).toBe(2)
  })

  it('detects style changes', () => {
    const before = el('body', { children: [
      el('div', { testId: 'box', styles: { 'padding-top': '8px', color: 'rgb(0,0,0)' } }),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'box', styles: { 'padding-top': '16px', color: 'rgb(0,0,0)' } }),
    ]})

    const result = diffFromTrees(before, after)
    expect(result.summary.changed).toBe(1)

    const boxDiff = result.diffs.find(d => d.type === 'changed')!
    expect(boxDiff).toBeDefined()

    const paddingChange = boxDiff.changes.find(c => c.property === 'padding-top')!
    expect(paddingChange.category).toBe('box-model')
    expect(paddingChange.before).toBe('8px')
    expect(paddingChange.after).toBe('16px')
    expect(paddingChange.description).toContain('8px → 16px')
  })

  it('detects text changes', () => {
    const before = el('body', { children: [
      el('h1', { testId: 'title', text: 'Hello World' }),
    ]})

    const after = el('body', { children: [
      el('h1', { testId: 'title', text: 'Goodbye World' }),
    ]})

    const result = diffFromTrees(before, after)
    const textChange = result.diffs[0]?.changes.find(c => c.category === 'text')
    expect(textChange).toBeDefined()
    expect(textChange!.before).toBe('Hello World')
    expect(textChange!.after).toBe('Goodbye World')
  })

  it('detects bounding box changes', () => {
    const before = el('body', { children: [
      el('div', { testId: 'resize', bbox: { x: 0, y: 0, w: 200, h: 100 } }),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'resize', bbox: { x: 0, y: 0, w: 300, h: 100 } }),
    ]})

    const result = diffFromTrees(before, after)
    const bboxChange = result.diffs[0]?.changes.find(c => c.property === 'width')
    expect(bboxChange).toBeDefined()
    expect(bboxChange!.before).toBe('200px')
    expect(bboxChange!.after).toBe('300px')
  })

  it('detects attribute changes', () => {
    const before = el('body', { children: [
      el('a', { testId: 'link', attrs: { href: '/old' } }),
    ]})

    const after = el('body', { children: [
      el('a', { testId: 'link', attrs: { href: '/new' } }),
    ]})

    const result = diffFromTrees(before, after)
    const attrChange = result.diffs[0]?.changes.find(c => c.property === 'href')
    expect(attrChange).toBeDefined()
    expect(attrChange!.category).toBe('attribute')
  })

  it('skips class attribute diffs (too noisy)', () => {
    const before = el('body', { children: [
      el('div', { testId: 'x', attrs: { class: 'old-class' } }),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'x', attrs: { class: 'new-class' } }),
    ]})

    const result = diffFromTrees(before, after)
    const classChange = result.diffs.flatMap(d => d.changes).find(c => c.property === 'class')
    expect(classChange).toBeUndefined()
  })

  it('reports removed elements', () => {
    const before = el('body', { children: [
      el('div', { testId: 'keep' }),
      el('div', { testId: 'doomed', text: 'bye' }),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'keep' }),
    ]})

    const result = diffFromTrees(before, after)
    expect(result.summary.removed).toBe(1)

    const removed = result.diffs.find(d => d.type === 'removed')!
    expect(removed).toBeDefined()
    expect(removed.changes[0].description).toContain('removed')
  })

  it('reports added elements', () => {
    const before = el('body', { children: [
      el('div', { testId: 'existing' }),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'existing' }),
      el('div', { testId: 'fresh', text: 'new content' }),
    ]})

    const result = diffFromTrees(before, after)
    expect(result.summary.added).toBe(1)

    const added = result.diffs.find(d => d.type === 'added')!
    expect(added).toBeDefined()
    expect(added.changes[0].description).toContain('added')
  })

  it('detects moved elements', () => {
    const before = el('body', { children: [
      el('nav', { testId: 'nav', children: [
        el('a', { testId: 'home-link', accessibleName: 'Home' }),
      ]}),
      el('main', { testId: 'main' }),
    ]})

    const after = el('body', { children: [
      el('nav', { testId: 'nav' }),
      el('main', { testId: 'main', children: [
        el('a', { testId: 'home-link', accessibleName: 'Home' }),
      ]}),
    ]})

    const result = diffFromTrees(before, after)
    const movedDiffs = result.diffs.filter(d => d.type === 'moved' || d.type === 'moved+changed')
    expect(movedDiffs.length).toBeGreaterThanOrEqual(1)
    expect(result.summary.moved).toBeGreaterThanOrEqual(1)
  })

  it('detects moved+changed elements', () => {
    const before = el('body', { children: [
      el('div', { testId: 'sidebar', children: [
        el('button', { testId: 'action', text: 'Click me' }),
      ]}),
      el('div', { testId: 'content' }),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'sidebar' }),
      el('div', { testId: 'content', children: [
        el('button', { testId: 'action', text: 'Press here' }),
      ]}),
    ]})

    const result = diffFromTrees(before, after)
    const movedChanged = result.diffs.find(d => d.type === 'moved+changed')
    expect(movedChanged).toBeDefined()
    expect(movedChanged!.changes.some(c => c.category === 'text')).toBe(true)
  })

  it('reports children count changes', () => {
    const before = el('body', { children: [
      el('ul', { testId: 'list', children: [
        el('li', { text: 'a' }),
        el('li', { text: 'b' }),
      ]}),
    ]})

    const after = el('body', { children: [
      el('ul', { testId: 'list', children: [
        el('li', { text: 'a' }),
        el('li', { text: 'b' }),
        el('li', { text: 'c' }),
      ]}),
    ]})

    const result = diffFromTrees(before, after)
    const listDiff = result.diffs.find(d => d.label.includes('list'))
    expect(listDiff).toBeDefined()
    const structChange = listDiff!.changes.find(c => c.property === 'children')
    expect(structChange).toBeDefined()
    expect(structChange!.before).toBe('2')
    expect(structChange!.after).toBe('3')
  })

  it('categorizes style changes correctly', () => {
    const before = el('body', { children: [
      el('div', { testId: 'styled', styles: {
        'font-size': '14px',
        'display': 'block',
        'grid-template-columns': '1fr',
        'position': 'relative',
        'min-width': '0px',
        'transform': 'none',
      }}),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'styled', styles: {
        'font-size': '16px',
        'display': 'flex',
        'grid-template-columns': '1fr 1fr',
        'position': 'absolute',
        'min-width': '100px',
        'transform': 'scale(1.1)',
      }}),
    ]})

    const result = diffFromTrees(before, after)
    const changes = result.diffs[0]!.changes
    const categories = new Set(changes.map(c => c.category))
    expect(categories).toContain('typography')
    expect(categories).toContain('layout')
    expect(categories).toContain('grid')
    expect(categories).toContain('position')
    expect(categories).toContain('sizing')
    expect(categories).toContain('other-style')
  })

  it('handles multiple simultaneous changes in one element', () => {
    const before = el('body', { children: [
      el('div', {
        testId: 'multi',
        text: 'old text',
        bbox: { x: 10, y: 20, w: 100, h: 50 },
        styles: { color: 'red', 'padding-top': '8px' },
        attrs: { 'data-value': '1' },
      }),
    ]})

    const after = el('body', { children: [
      el('div', {
        testId: 'multi',
        text: 'new text',
        bbox: { x: 10, y: 20, w: 200, h: 50 },
        styles: { color: 'blue', 'padding-top': '16px' },
        attrs: { 'data-value': '2' },
      }),
    ]})

    const result = diffFromTrees(before, after)
    const diff = result.diffs.find(d => d.type === 'changed')!
    expect(diff.changes.length).toBeGreaterThanOrEqual(4) // style × 2, text, bbox, attr
    const categories = new Set(diff.changes.map(c => c.category))
    expect(categories).toContain('text')
    expect(categories).toContain('bbox')
    expect(categories).toContain('attribute')
    expect(categories).toContain('typography')
    expect(categories).toContain('box-model')
  })

  it('totalChanges sums across all diffs', () => {
    const before = el('body', { children: [
      el('div', { testId: 'a', styles: { color: 'red' } }),
      el('div', { testId: 'b', text: 'old' }),
    ]})

    const after = el('body', { children: [
      el('div', { testId: 'a', styles: { color: 'blue' } }),
      el('div', { testId: 'b', text: 'new' }),
    ]})

    const result = diffFromTrees(before, after)
    expect(result.summary.totalChanges).toBe(
      result.diffs.reduce((sum, d) => sum + d.changes.length, 0)
    )
  })

  it('scores explicit width changes higher than implicit (cascade) width changes', () => {
    // Explicit: element has width in explicitProps → full base score
    const beforeExplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { width: '200px' },
        explicitProps: ['width'],
        bbox: { x: 0, y: 0, w: 200, h: 50 },
      }),
    ]})
    const afterExplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { width: '300px' },
        explicitProps: ['width'],
        bbox: { x: 0, y: 0, w: 300, h: 50 },
      }),
    ]})

    const explicitResult = diffFromTrees(beforeExplicit, afterExplicit)
    const explicitDiff = explicitResult.diffs.find(d => d.type === 'changed')!
    expect(explicitDiff).toBeDefined()

    // Implicit: element has NO width in explicitProps → 0.4× cascade reduction
    resetIdx()
    const beforeImplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { width: '200px' },
        bbox: { x: 0, y: 0, w: 200, h: 50 },
      }),
    ]})
    const afterImplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { width: '300px' },
        bbox: { x: 0, y: 0, w: 300, h: 50 },
      }),
    ]})

    const implicitResult = diffFromTrees(beforeImplicit, afterImplicit)
    const implicitDiff = implicitResult.diffs.find(d => d.type === 'changed')!
    expect(implicitDiff).toBeDefined()

    // Explicit should score higher than implicit
    expect(explicitDiff.score).toBeGreaterThan(implicitDiff.score)
  })

  it('scores explicit height changes higher than implicit height changes', () => {
    const beforeExplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { height: '100px' },
        explicitProps: ['height'],
        bbox: { x: 0, y: 0, w: 100, h: 100 },
      }),
    ]})
    const afterExplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { height: '200px' },
        explicitProps: ['height'],
        bbox: { x: 0, y: 0, w: 100, h: 200 },
      }),
    ]})

    const explicitResult = diffFromTrees(beforeExplicit, afterExplicit)
    const explicitDiff = explicitResult.diffs.find(d => d.type === 'changed')!
    expect(explicitDiff).toBeDefined()

    resetIdx()
    const beforeImplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { height: '100px' },
        bbox: { x: 0, y: 0, w: 100, h: 100 },
      }),
    ]})
    const afterImplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { height: '200px' },
        bbox: { x: 0, y: 0, w: 100, h: 200 },
      }),
    ]})

    const implicitResult = diffFromTrees(beforeImplicit, afterImplicit)
    const implicitDiff = implicitResult.diffs.find(d => d.type === 'changed')!
    expect(implicitDiff).toBeDefined()

    expect(explicitDiff.score).toBeGreaterThan(implicitDiff.score)
  })

  it('uses union of before/after explicitProps for scoring', () => {
    // Width is explicit only in "after" (author added it) — should still score full
    const before = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { width: '200px' },
        bbox: { x: 0, y: 0, w: 200, h: 50 },
      }),
    ]})
    const after = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { width: '300px' },
        explicitProps: ['width'],
        bbox: { x: 0, y: 0, w: 300, h: 50 },
      }),
    ]})

    const result = diffFromTrees(before, after)
    const diff = result.diffs.find(d => d.type === 'changed')!
    expect(diff).toBeDefined()

    // Score should be at full base (not 0.4× reduced) because after has explicit width
    resetIdx()
    const beforeNoExplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { width: '200px' },
        bbox: { x: 0, y: 0, w: 200, h: 50 },
      }),
    ]})
    const afterNoExplicit = el('body', { children: [
      el('div', {
        testId: 'box',
        styles: { width: '300px' },
        bbox: { x: 0, y: 0, w: 300, h: 50 },
      }),
    ]})

    const implicitResult = diffFromTrees(beforeNoExplicit, afterNoExplicit)
    const implicitDiff = implicitResult.diffs.find(d => d.type === 'changed')!

    expect(diff.score).toBeGreaterThan(implicitDiff.score)
  })
})
