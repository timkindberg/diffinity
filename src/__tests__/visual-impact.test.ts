import { describe, it, expect, beforeEach } from 'vitest'
import { PNG } from 'pngjs'
import {
  classifyElementPair, classifyPairs, aggregateImpact,
  detectPseudoStateSensitivity, applyPseudoStateOverride,
  applyPseudoStateOverridesToViewport,
  type VisualImpact,
} from '../visual-impact.js'
import type { ElementNode } from '../dom-manifest.js'
import { el, manifest, resetIdx } from './test-helpers.js'

beforeEach(() => resetIdx())

/** Build a solid-color PNG, optionally flipping one rectangle to a different color. */
function solidPng(
  width: number,
  height: number,
  color: [number, number, number, number],
  patches: { x: number; y: number; w: number; h: number; color: [number, number, number, number] }[] = [],
): InstanceType<typeof PNG> {
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      png.data[i] = color[0]
      png.data[i + 1] = color[1]
      png.data[i + 2] = color[2]
      png.data[i + 3] = color[3]
    }
  }
  for (const p of patches) {
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x; x < p.x + p.w; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue
        const i = (y * width + x) * 4
        png.data[i] = p.color[0]
        png.data[i + 1] = p.color[1]
        png.data[i + 2] = p.color[2]
        png.data[i + 3] = p.color[3]
      }
    }
  }
  return png
}

describe('classifyElementPair', () => {
  it('flags a region as pixel-identical when before/after PNGs match within the element bbox', () => {
    // Both PNGs are solid white — the diff engine might have flagged authored
    // CSS changes (flex → grid) but the rendered pixels are identical.
    const before = solidPng(200, 200, [255, 255, 255, 255])
    const after = solidPng(200, 200, [255, 255, 255, 255])
    const bn = el('div', { bbox: { x: 10, y: 10, w: 100, h: 50 } })
    const an = el('div', { bbox: { x: 10, y: 10, w: 100, h: 50 } })

    const impact = classifyElementPair(before, after, bn, an)
    expect(impact).not.toBeNull()
    expect(impact!.verdict).toBe('pixel-identical')
    expect(impact!.mismatchPixels).toBe(0)
    expect(impact!.mismatchPercent).toBe(0)
  })

  it('flags a region as visual when the cropped pixels differ beyond the threshold', () => {
    // The "after" PNG repaints a large chunk of the element's bbox in red.
    const before = solidPng(200, 200, [255, 255, 255, 255])
    const after = solidPng(200, 200, [255, 255, 255, 255], [
      { x: 20, y: 20, w: 60, h: 30, color: [255, 0, 0, 255] },
    ])
    const bn = el('div', { bbox: { x: 10, y: 10, w: 100, h: 50 } })
    const an = el('div', { bbox: { x: 10, y: 10, w: 100, h: 50 } })

    const impact = classifyElementPair(before, after, bn, an)
    expect(impact).not.toBeNull()
    expect(impact!.verdict).toBe('visual')
    expect(impact!.mismatchPixels).toBeGreaterThan(0)
    expect(impact!.mismatchPercent).toBeGreaterThan(0.1)
  })

  it('skips elements with zero-area bboxes', () => {
    const before = solidPng(100, 100, [255, 255, 255, 255])
    const after = solidPng(100, 100, [255, 255, 255, 255])
    const bn = el('div', { bbox: { x: 10, y: 10, w: 0, h: 50 } })
    const an = el('div', { bbox: { x: 10, y: 10, w: 0, h: 50 } })

    expect(classifyElementPair(before, after, bn, an)).toBeNull()
  })

  it('skips elements when before/after bbox dimensions differ (size drift)', () => {
    const before = solidPng(200, 200, [255, 255, 255, 255])
    const after = solidPng(200, 200, [255, 255, 255, 255])
    const bn = el('div', { bbox: { x: 10, y: 10, w: 100, h: 50 } })
    const an = el('div', { bbox: { x: 10, y: 10, w: 120, h: 50 } })

    expect(classifyElementPair(before, after, bn, an)).toBeNull()
  })

  it('skips when the crop is entirely out of bounds', () => {
    const before = solidPng(50, 50, [255, 255, 255, 255])
    const after = solidPng(50, 50, [255, 255, 255, 255])
    const bn = el('div', { bbox: { x: 200, y: 200, w: 100, h: 50 } })
    const an = el('div', { bbox: { x: 200, y: 200, w: 100, h: 50 } })

    expect(classifyElementPair(before, after, bn, an)).toBeNull()
  })

  it('respects a stricter maxMismatchPercent option', () => {
    // One tiny patch → low mismatch percent. With the default 0.1% it would be
    // classified pixel-identical; tightening the threshold flips the verdict.
    const before = solidPng(1000, 1000, [255, 255, 255, 255])
    const after = solidPng(1000, 1000, [255, 255, 255, 255], [
      { x: 0, y: 0, w: 3, h: 3, color: [255, 0, 0, 255] }, // 9 px on 1M px element
    ])
    const bn = el('div', { bbox: { x: 0, y: 0, w: 1000, h: 1000 } })
    const an = el('div', { bbox: { x: 0, y: 0, w: 1000, h: 1000 } })

    const loose = classifyElementPair(before, after, bn, an, { maxMismatchPercent: 0.1 })
    const strict = classifyElementPair(before, after, bn, an, { maxMismatchPercent: 0.0005 })
    expect(loose!.verdict).toBe('pixel-identical')
    expect(strict!.verdict).toBe('visual')
  })

  it('tags pixel-identical with reason: no-delta when zero pixels differ', () => {
    const before = solidPng(100, 100, [255, 255, 255, 255])
    const after = solidPng(100, 100, [255, 255, 255, 255])
    const bn = el('div', { bbox: { x: 0, y: 0, w: 100, h: 100 } })
    const an = el('div', { bbox: { x: 0, y: 0, w: 100, h: 100 } })
    const impact = classifyElementPair(before, after, bn, an)
    expect(impact!.reason).toBe('no-delta')
  })

  it('tags pixel-identical with reason: below-threshold when some pixels differ but stay under tolerance', () => {
    // 9 mismatched pixels on a 1M-pixel element is well under the 0.1% default.
    const before = solidPng(1000, 1000, [255, 255, 255, 255])
    const after = solidPng(1000, 1000, [255, 255, 255, 255], [
      { x: 0, y: 0, w: 3, h: 3, color: [255, 0, 0, 255] },
    ])
    const bn = el('div', { bbox: { x: 0, y: 0, w: 1000, h: 1000 } })
    const an = el('div', { bbox: { x: 0, y: 0, w: 1000, h: 1000 } })
    const impact = classifyElementPair(before, after, bn, an)
    expect(impact!.verdict).toBe('pixel-identical')
    expect(impact!.reason).toBe('below-threshold')
  })

  it('leaves reason unset on visual verdicts', () => {
    const before = solidPng(200, 200, [255, 255, 255, 255])
    const after = solidPng(200, 200, [255, 255, 255, 255], [
      { x: 20, y: 20, w: 60, h: 30, color: [255, 0, 0, 255] },
    ])
    const bn = el('div', { bbox: { x: 10, y: 10, w: 100, h: 50 } })
    const an = el('div', { bbox: { x: 10, y: 10, w: 100, h: 50 } })
    const impact = classifyElementPair(before, after, bn, an)
    expect(impact!.verdict).toBe('visual')
    expect(impact!.reason).toBeUndefined()
  })
})

describe('aggregateImpact', () => {
  const visual: VisualImpact = { mismatchPixels: 10, mismatchPercent: 1, verdict: 'visual' }
  const identical: VisualImpact = { mismatchPixels: 0, mismatchPercent: 0, verdict: 'pixel-identical', reason: 'no-delta' }
  const belowThreshold: VisualImpact = { mismatchPixels: 5, mismatchPercent: 0.01, verdict: 'pixel-identical', reason: 'below-threshold' }

  it('aggregates pixel-identical when every member is pixel-identical', () => {
    const agg = aggregateImpact([identical, identical, identical])
    expect(agg).not.toBeNull()
    expect(agg!.verdict).toBe('pixel-identical')
  })

  it('propagates reason when every member agrees', () => {
    const agg = aggregateImpact([identical, identical, identical])
    expect(agg!.reason).toBe('no-delta')
  })

  it('drops reason when members disagree on why they are pixel-identical', () => {
    const agg = aggregateImpact([identical, belowThreshold])
    expect(agg!.verdict).toBe('pixel-identical')
    expect(agg!.reason).toBeUndefined()
  })

  it('flips to visual if any member has real pixel delta', () => {
    const agg = aggregateImpact([identical, visual, identical])
    expect(agg!.verdict).toBe('visual')
  })

  it('returns null when any member is unclassified (safe default: assume visual)', () => {
    // A null member means "couldn't classify" — poison the result so the group
    // stays in the main report rather than silently demoting audits away.
    expect(aggregateImpact([identical, null, identical])).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(aggregateImpact([])).toBeNull()
  })
})

describe('classifyPairs (end-to-end, synthetic PNGs)', () => {
  it('classifies multiple pairs in one pass using in-memory PNG fixtures via disk', async () => {
    // Write synthetic PNGs to a temp dir and run through the public entry point.
    // This exercises the file-loading + manifest-indexing path that compare-v2 uses.
    const { mkdtempSync, writeFileSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const dir = mkdtempSync(join(tmpdir(), 'vr-p3v-'))

    const beforePng = solidPng(300, 300, [255, 255, 255, 255])
    const afterPng = solidPng(300, 300, [255, 255, 255, 255], [
      { x: 150, y: 10, w: 100, h: 80, color: [255, 0, 0, 255] }, // only the second element changes
    ])
    const beforePath = join(dir, 'before.png')
    const afterPath = join(dir, 'after.png')
    writeFileSync(beforePath, PNG.sync.write(beforePng))
    writeFileSync(afterPath, PNG.sync.write(afterPng))

    const identicalEl = el('div', { bbox: { x: 10, y: 10, w: 100, h: 80 } })
    const visualEl = el('div', { bbox: { x: 150, y: 10, w: 100, h: 80 } })
    const bm = manifest(el('body', { children: [identicalEl, visualEl] }))
    // Mirror indexes on "after" — matches the shape the match engine produces.
    resetIdx()
    const identicalElA = el('div', { bbox: { x: 10, y: 10, w: 100, h: 80 } })
    const visualElA = el('div', { bbox: { x: 150, y: 10, w: 100, h: 80 } })
    const am = manifest(el('body', { children: [identicalElA, visualElA] }))

    const impacts = classifyPairs(
      [
        { beforeIdx: identicalEl.idx, afterIdx: identicalElA.idx },
        { beforeIdx: visualEl.idx, afterIdx: visualElA.idx },
      ],
      {
        beforeManifest: bm,
        afterManifest: am,
        beforeLivePngPath: beforePath,
        afterLivePngPath: afterPath,
      },
    )

    const identicalImpact = impacts.get(`${identicalEl.idx}:${identicalElA.idx}`)
    const visualImpact = impacts.get(`${visualEl.idx}:${visualElA.idx}`)
    expect(identicalImpact?.verdict).toBe('pixel-identical')
    expect(visualImpact?.verdict).toBe('visual')
  })

  it('writes before/after/diff/meta artifacts + classification.jsonl when dump is enabled', async () => {
    const { mkdtempSync, writeFileSync, existsSync, readFileSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const dir = mkdtempSync(join(tmpdir(), 'vr-9t3-'))

    const beforePng = solidPng(300, 300, [255, 255, 255, 255])
    const afterPng = solidPng(300, 300, [255, 255, 255, 255], [
      { x: 150, y: 10, w: 100, h: 80, color: [255, 0, 0, 255] },
    ])
    const beforePath = join(dir, 'before.png')
    const afterPath = join(dir, 'after.png')
    writeFileSync(beforePath, PNG.sync.write(beforePng))
    writeFileSync(afterPath, PNG.sync.write(afterPng))

    const identicalEl = el('div', { bbox: { x: 10, y: 10, w: 100, h: 80 } })
    const visualEl = el('div', { bbox: { x: 150, y: 10, w: 100, h: 80 } })
    const bm = manifest(el('body', { children: [identicalEl, visualEl] }))
    resetIdx()
    const identicalElA = el('div', { bbox: { x: 10, y: 10, w: 100, h: 80 } })
    const visualElA = el('div', { bbox: { x: 150, y: 10, w: 100, h: 80 } })
    const am = manifest(el('body', { children: [identicalElA, visualElA] }))

    const dumpDir = join(dir, '_debug')
    classifyPairs(
      [
        { beforeIdx: identicalEl.idx, afterIdx: identicalElA.idx },
        { beforeIdx: visualEl.idx, afterIdx: visualElA.idx },
      ],
      {
        beforeManifest: bm,
        afterManifest: am,
        beforeLivePngPath: beforePath,
        afterLivePngPath: afterPath,
        dump: { dumpDir, pageId: 'dashboard', viewport: 1440 },
      },
    )

    // Per-pair artifacts exist for both classified pairs.
    for (const [bIdx, aIdx] of [[identicalEl.idx, identicalElA.idx], [visualEl.idx, visualElA.idx]]) {
      const pairDir = join(dumpDir, 'dashboard', '1440', `${bIdx}-${aIdx}`)
      expect(existsSync(join(pairDir, 'before.png'))).toBe(true)
      expect(existsSync(join(pairDir, 'after.png'))).toBe(true)
      expect(existsSync(join(pairDir, 'diff.png'))).toBe(true)
      expect(existsSync(join(pairDir, 'meta.json'))).toBe(true)
      const meta = JSON.parse(readFileSync(join(pairDir, 'meta.json'), 'utf-8'))
      expect(meta.beforeIdx).toBe(bIdx)
      expect(meta.afterIdx).toBe(aIdx)
      expect(meta.beforeBbox).toEqual({ x: bIdx === identicalEl.idx ? 10 : 150, y: 10, w: 100, h: 80 })
      expect(typeof meta.mismatchPercent).toBe('number')
      expect(['pixel-identical', 'visual']).toContain(meta.verdict)
    }

    // classification.jsonl has one line per pair, each with pageId + viewport.
    const jsonl = readFileSync(join(dumpDir, 'classification.jsonl'), 'utf-8').trim().split('\n')
    expect(jsonl).toHaveLength(2)
    const parsed = jsonl.map(l => JSON.parse(l))
    expect(parsed.every(r => r.pageId === 'dashboard' && r.viewport === 1440)).toBe(true)
    expect(parsed.find(r => r.beforeIdx === identicalEl.idx)?.verdict).toBe('pixel-identical')
    expect(parsed.find(r => r.beforeIdx === visualEl.idx)?.verdict).toBe('visual')
  })

  it('returns an empty map when the PNGs are missing', () => {
    const root = el('body', { children: [] })
    const m = manifest(root)
    const impacts = classifyPairs(
      [{ beforeIdx: 0, afterIdx: 0 }],
      {
        beforeManifest: m,
        afterManifest: m,
        beforeLivePngPath: '/tmp/does-not-exist-before.png',
        afterLivePngPath: '/tmp/does-not-exist-after.png',
      },
    )
    expect(impacts.size).toBe(0)
  })
})

describe('detectPseudoStateSensitivity', () => {
  it('returns null when the element has no pseudo-state rules', () => {
    expect(detectPseudoStateSensitivity(undefined, ['border-radius'])).toBeNull()
    expect(detectPseudoStateSensitivity([], ['border-radius'])).toBeNull()
  })

  it('returns null when none of the rule properties overlap with changed props', () => {
    const rules = [{ pseudoClasses: ['hover'], properties: ['background-color'] }]
    expect(detectPseudoStateSensitivity(rules, ['color'])).toBeNull()
  })

  it('matches the collapsed `border-radius` shorthand against longhand rule props', () => {
    // The diff engine collapses 4 identical corner radius changes into a single
    // `border-radius` diff; CSSOM enumerates longhands — we must expand before
    // comparing.
    const rules = [{
      pseudoClasses: ['hover'],
      properties: ['border-top-left-radius', 'border-top-right-radius',
                   'border-bottom-left-radius', 'border-bottom-right-radius'],
    }]
    expect(detectPseudoStateSensitivity(rules, ['border-radius'])).toEqual(['hover'])
  })

  it('unions pseudo-classes across matching rules and sorts the result', () => {
    const rules = [
      { pseudoClasses: ['hover'], properties: ['background-color'] },
      { pseudoClasses: ['focus-visible'], properties: ['background-color'] },
      { pseudoClasses: ['active'], properties: ['color'] },
    ]
    expect(detectPseudoStateSensitivity(rules, ['background-color'])).toEqual(['focus-visible', 'hover'])
  })
})

describe('applyPseudoStateOverride', () => {
  const identical: VisualImpact = { mismatchPixels: 0, mismatchPercent: 0, verdict: 'pixel-identical' }

  it('flips a pixel-identical verdict to visual and records pseudo-classes', () => {
    const out = applyPseudoStateOverride(identical, ['hover', 'focus'])
    expect(out.verdict).toBe('visual')
    expect(out.pseudoStateSensitive).toBe(true)
    expect(out.pseudoClasses).toEqual(['hover', 'focus'])
  })

  it('returns the original impact when no pseudo-classes apply', () => {
    expect(applyPseudoStateOverride(identical, null)).toBe(identical)
    expect(applyPseudoStateOverride(identical, [])).toBe(identical)
  })

  it('preserves pixel mismatch numbers while overriding the verdict', () => {
    const almost: VisualImpact = { mismatchPixels: 2, mismatchPercent: 0.04, verdict: 'pixel-identical' }
    const out = applyPseudoStateOverride(almost, ['hover'])
    expect(out.mismatchPixels).toBe(2)
    expect(out.mismatchPercent).toBe(0.04)
    expect(out.verdict).toBe('visual')
  })
})

describe('applyPseudoStateOverridesToViewport (integration)', () => {
  const IDENTICAL: VisualImpact = { mismatchPixels: 0, mismatchPercent: 0, verdict: 'pixel-identical' }
  const VISUAL: VisualImpact = { mismatchPixels: 42, mismatchPercent: 1.2, verdict: 'visual' }

  const btnHoverRadiusRules = [{
    pseudoClasses: ['hover'],
    properties: ['border-top-left-radius', 'border-top-right-radius',
                 'border-bottom-left-radius', 'border-bottom-right-radius'],
  }]

  function buildManifests(beforeOpts: Partial<ElementNode>, afterOpts: Partial<ElementNode>) {
    resetIdx()
    const beforeBtn = el('button', beforeOpts)
    const beforeRoot = el('body', { children: [beforeBtn] })
    const before = manifest(beforeRoot)

    resetIdx()
    const afterBtn = el('button', afterOpts)
    const afterRoot = el('body', { children: [afterBtn] })
    const after = manifest(afterRoot)

    return { before, after, beforeBtn, afterBtn }
  }

  it('promotes a pixel-identical `border-radius` diff to visual when .btn:hover touches it', () => {
    // Mirrors the canonical example from vr-c8q: `.btn` border-radius 4→8px.
    // Static pixels are identical (white-on-white resting state), but
    // `.btn:hover` sets border-radius so the change would clearly show on hover.
    const { before, after, beforeBtn, afterBtn } = buildManifests(
      { pseudoStateRules: btnHoverRadiusRules },
      { pseudoStateRules: btnHoverRadiusRules },
    )

    const vp = {
      diffs: [{
        beforeIdx: beforeBtn.idx,
        afterIdx: afterBtn.idx,
        changes: [{ property: 'border-radius' }],
        visualImpact: { ...IDENTICAL },
      }],
      groups: [],
      cascadeClusters: [],
    }

    applyPseudoStateOverridesToViewport(vp, before, after)

    const impact = vp.diffs[0].visualImpact!
    expect(impact.verdict).toBe('visual')
    expect(impact.pseudoStateSensitive).toBe(true)
    expect(impact.pseudoClasses).toEqual(['hover'])
  })

  it('leaves a diff alone when changed props do not overlap with the pseudo-state rule', () => {
    // Rule on :hover only touches border-radius. The diff only changed color —
    // no pseudo-state sensitivity, the demoted verdict stands.
    const { before, after, beforeBtn, afterBtn } = buildManifests(
      { pseudoStateRules: btnHoverRadiusRules },
      { pseudoStateRules: btnHoverRadiusRules },
    )

    const vp = {
      diffs: [{
        beforeIdx: beforeBtn.idx,
        afterIdx: afterBtn.idx,
        changes: [{ property: 'color' }],
        visualImpact: { ...IDENTICAL },
      }],
      groups: [],
      cascadeClusters: [],
    }

    applyPseudoStateOverridesToViewport(vp, before, after)

    expect(vp.diffs[0].visualImpact!.verdict).toBe('pixel-identical')
    expect(vp.diffs[0].visualImpact!.pseudoStateSensitive).toBeUndefined()
  })

  it('promotes a pixel-identical group when any member has a matching pseudo-state rule', () => {
    // Six nav buttons share a grouped border-radius change. Only `.btn` (not
    // `.nav-icon-btn`) has a :hover rule that touches border-radius, but that
    // single overlap is enough to keep the group in the main list.
    resetIdx()
    const btnA = el('button', { pseudoStateRules: btnHoverRadiusRules })
    const btnB = el('button')
    const beforeRoot = el('body', { children: [btnA, btnB] })
    const before = manifest(beforeRoot)

    resetIdx()
    const btnAA = el('button', { pseudoStateRules: btnHoverRadiusRules })
    const btnBA = el('button')
    const afterRoot = el('body', { children: [btnAA, btnBA] })
    const after = manifest(afterRoot)

    const vp = {
      diffs: [],
      groups: [{
        changes: [{ property: 'border-radius' }],
        members: [
          { beforeIdx: btnA.idx, afterIdx: btnAA.idx },
          { beforeIdx: btnB.idx, afterIdx: btnBA.idx },
        ],
        visualImpact: { ...IDENTICAL },
      }],
      cascadeClusters: [],
    }

    applyPseudoStateOverridesToViewport(vp, before, after)

    expect(vp.groups[0].visualImpact!.verdict).toBe('visual')
    expect(vp.groups[0].visualImpact!.pseudoStateSensitive).toBe(true)
    expect(vp.groups[0].visualImpact!.pseudoClasses).toEqual(['hover'])
  })

  it('does not badge an already-visual verdict', () => {
    // Pixelmatch already classified this diff as "visual" (the element looks
    // plainly different in the static capture). Adding a "may affect :hover"
    // badge here is noise — the tooltip would lie about pixels being
    // identical. Leave the impact untouched.
    const { before, after, beforeBtn, afterBtn } = buildManifests(
      { pseudoStateRules: btnHoverRadiusRules },
      { pseudoStateRules: btnHoverRadiusRules },
    )

    const vp = {
      diffs: [{
        beforeIdx: beforeBtn.idx,
        afterIdx: afterBtn.idx,
        changes: [{ property: 'border-radius' }],
        visualImpact: { ...VISUAL },
      }],
      groups: [],
      cascadeClusters: [],
    }

    applyPseudoStateOverridesToViewport(vp, before, after)

    expect(vp.diffs[0].visualImpact!.verdict).toBe('visual')
    expect(vp.diffs[0].visualImpact!.pseudoStateSensitive).toBeUndefined()
    expect(vp.diffs[0].visualImpact!.pseudoClasses).toBeUndefined()
  })

  it('records (N of M) counts when only some group members are pseudo-sensitive', () => {
    // Input "Search" has a :focus rule touching the changed property.
    // Select "Filter" has no :focus rule. Grouped border-radius-style change
    // would otherwise promote the whole group with a misleading badge; the
    // fraction tells readers which members actually drive the override.
    const focusRules = [{
      pseudoClasses: ['focus'],
      properties: ['border-top-left-radius', 'border-top-right-radius',
                   'border-bottom-left-radius', 'border-bottom-right-radius'],
    }]
    resetIdx()
    const input = el('input', { pseudoStateRules: focusRules })
    const select = el('select')
    const beforeRoot = el('body', { children: [input, select] })
    const before = manifest(beforeRoot)

    resetIdx()
    const inputA = el('input', { pseudoStateRules: focusRules })
    const selectA = el('select')
    const afterRoot = el('body', { children: [inputA, selectA] })
    const after = manifest(afterRoot)

    const vp = {
      diffs: [],
      groups: [{
        changes: [{ property: 'border-radius' }],
        members: [
          { beforeIdx: input.idx, afterIdx: inputA.idx },
          { beforeIdx: select.idx, afterIdx: selectA.idx },
        ],
        visualImpact: { ...IDENTICAL },
      }],
      cascadeClusters: [],
    }

    applyPseudoStateOverridesToViewport(vp, before, after)

    const impact = vp.groups[0].visualImpact!
    expect(impact.verdict).toBe('visual')
    expect(impact.pseudoStateSensitive).toBe(true)
    expect(impact.pseudoClasses).toEqual(['focus'])
    expect(impact.pseudoClassMemberCounts).toEqual([{ pc: 'focus', matched: 1, total: 2 }])
  })

  it('omits memberCounts when every group member has the pseudo rule', () => {
    const focusRules = [{
      pseudoClasses: ['focus'],
      properties: ['border-top-left-radius', 'border-top-right-radius',
                   'border-bottom-left-radius', 'border-bottom-right-radius'],
    }]
    resetIdx()
    const a = el('input', { pseudoStateRules: focusRules })
    const b = el('input', { pseudoStateRules: focusRules })
    const beforeRoot = el('body', { children: [a, b] })
    const before = manifest(beforeRoot)

    resetIdx()
    const aA = el('input', { pseudoStateRules: focusRules })
    const bA = el('input', { pseudoStateRules: focusRules })
    const afterRoot = el('body', { children: [aA, bA] })
    const after = manifest(afterRoot)

    const vp = {
      diffs: [],
      groups: [{
        changes: [{ property: 'border-radius' }],
        members: [
          { beforeIdx: a.idx, afterIdx: aA.idx },
          { beforeIdx: b.idx, afterIdx: bA.idx },
        ],
        visualImpact: { ...IDENTICAL },
      }],
      cascadeClusters: [],
    }

    applyPseudoStateOverridesToViewport(vp, before, after)

    const impact = vp.groups[0].visualImpact!
    expect(impact.pseudoClasses).toEqual(['focus'])
    expect(impact.pseudoClassMemberCounts).toBeUndefined()
  })

  it('is a no-op when manifests have no pseudo-state rules', () => {
    const { before, after, beforeBtn, afterBtn } = buildManifests({}, {})

    const vp = {
      diffs: [{
        beforeIdx: beforeBtn.idx,
        afterIdx: afterBtn.idx,
        changes: [{ property: 'border-radius' }],
        visualImpact: { ...IDENTICAL },
      }],
      groups: [],
      cascadeClusters: [],
    }

    applyPseudoStateOverridesToViewport(vp, before, after)

    expect(vp.diffs[0].visualImpact!.verdict).toBe('pixel-identical')
    expect(vp.diffs[0].visualImpact!.pseudoStateSensitive).toBeUndefined()
  })
})

