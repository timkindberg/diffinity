import { describe, it, expect } from 'vitest'
import { recomputeVisualStructuralCounts } from '../compare-v2.js'
import type { ViewportDiffResult } from '../viewport-diff.js'
import type { ElementDiff, DiffGroup } from '../diff.js'
import type { VisualImpact } from '../visual-impact.js'

const IDENTICAL: VisualImpact = { mismatchPixels: 0, mismatchPercent: 0, verdict: 'pixel-identical' }
const VISUAL: VisualImpact = { mismatchPixels: 42, mismatchPercent: 1.2, verdict: 'visual' }

function makeDiff(partial: Partial<ElementDiff> = {}): ElementDiff {
  return {
    type: 'changed',
    beforeIdx: 0,
    afterIdx: 0,
    label: 'el',
    selector: 'div',
    changes: [],
    score: 10,
    importance: 'minor',
    ...partial,
  }
}

function makeGroup(partial: Partial<DiffGroup> = {}): DiffGroup {
  return {
    fingerprint: 'fp',
    changes: [],
    type: 'changed',
    score: 10,
    importance: 'minor',
    members: [],
    ...partial,
  }
}

function makeViewportDiff(diffs: ElementDiff[], groups: DiffGroup[] = []): ViewportDiffResult {
  const totalChanges = diffs.reduce((s, d) => s + d.changes.length, 0)
    + groups.reduce((s, g) => s + g.changes.length * g.members.length, 0)
  return {
    diffs,
    groups,
    cascadeClusters: [],
    summary: {
      changed: diffs.length,
      added: 0, removed: 0, moved: 0, unchanged: 0,
      totalChanges,
      visualChanges: totalChanges,
      structuralChanges: 0,
      groupCount: groups.length,
      groupedElementCount: groups.reduce((s, g) => s + g.members.length, 0),
    },
    timeMs: 0,
  }
}

describe('recomputeVisualStructuralCounts', () => {
  it('classifies every diff as structural when all are pixel-identical', () => {
    const vpd = makeViewportDiff([
      makeDiff({
        visualImpact: IDENTICAL,
        changes: [
          { category: 'layout', property: 'display', before: 'flex', after: 'grid', description: 'd' },
          { category: 'layout', property: 'align-content', before: 'normal', after: 'start', description: 'a' },
        ],
      }),
      makeDiff({
        visualImpact: IDENTICAL,
        changes: [
          { category: 'layout', property: 'flex-direction', before: 'row', after: 'column', description: 'f' },
        ],
      }),
    ])
    const originalTotal = vpd.summary.totalChanges

    recomputeVisualStructuralCounts(vpd)

    expect(vpd.summary.visualChanges).toBe(0)
    expect(vpd.summary.structuralChanges).toBeGreaterThan(0)
    expect(vpd.summary.structuralChanges).toBe(originalTotal)
    expect(vpd.summary.totalChanges).toBe(vpd.summary.structuralChanges)
  })

  it('classifies every diff as visual when none are pixel-identical', () => {
    const vpd = makeViewportDiff([
      makeDiff({
        visualImpact: VISUAL,
        changes: [{ category: 'visual', property: 'background-color', before: '#fff', after: '#000', description: 'b' }],
      }),
      makeDiff({
        // No verdict yet — treated as visual (safe default: show rather than demote).
        changes: [{ category: 'typography', property: 'color', before: '#111', after: '#222', description: 'c' }],
      }),
    ])
    const originalTotal = vpd.summary.totalChanges

    recomputeVisualStructuralCounts(vpd)

    expect(vpd.summary.structuralChanges).toBe(0)
    expect(vpd.summary.visualChanges).toBe(originalTotal)
    expect(vpd.summary.totalChanges).toBe(vpd.summary.visualChanges)
  })

  it('buckets groups by members × changes, not element count', () => {
    // One visual group (3 members × 1 change = 3 visual) and one structural group
    // (2 members × 2 changes = 4 structural). Verifies the rollup shape.
    const vpd = makeViewportDiff(
      [],
      [
        makeGroup({
          visualImpact: VISUAL,
          changes: [{ category: 'visual', property: 'background-color', before: '#111', after: '#222', description: 'b' }],
          members: [
            { label: 'a', beforeIdx: 1, afterIdx: 1 },
            { label: 'b', beforeIdx: 2, afterIdx: 2 },
            { label: 'c', beforeIdx: 3, afterIdx: 3 },
          ],
        }),
        makeGroup({
          visualImpact: IDENTICAL,
          changes: [
            { category: 'layout', property: 'display', before: 'flex', after: 'grid', description: 'd' },
            { category: 'layout', property: 'align-content', before: 'normal', after: 'start', description: 'a' },
          ],
          members: [
            { label: 'x', beforeIdx: 10, afterIdx: 10 },
            { label: 'y', beforeIdx: 11, afterIdx: 11 },
          ],
        }),
      ],
    )

    recomputeVisualStructuralCounts(vpd)

    expect(vpd.summary.visualChanges).toBe(3)
    expect(vpd.summary.structuralChanges).toBe(4)
    expect(vpd.summary.totalChanges).toBe(7)
  })

  it('handles mixed diffs with and without classification', () => {
    const vpd = makeViewportDiff([
      makeDiff({
        visualImpact: VISUAL,
        changes: [{ category: 'visual', property: 'color', before: '#111', after: '#222', description: 'c' }],
      }),
      makeDiff({
        visualImpact: IDENTICAL,
        changes: [
          { category: 'layout', property: 'display', before: 'flex', after: 'grid', description: 'd' },
          { category: 'layout', property: 'align-content', before: 'normal', after: 'start', description: 'a' },
        ],
      }),
    ])

    recomputeVisualStructuralCounts(vpd)

    expect(vpd.summary.visualChanges).toBe(1)
    expect(vpd.summary.structuralChanges).toBe(2)
    expect(vpd.summary.totalChanges).toBe(3)
  })
})
