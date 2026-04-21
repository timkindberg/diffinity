import { describe, it, expect, beforeEach } from 'vitest'
import { PNG } from 'pngjs'
import { classifyElementPair, classifyPairs, aggregateImpact, type VisualImpact } from '../visual-impact.js'
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
