import { matchManifests } from './match.js'
import { diffManifests, consolidateDiffs, type DiffResult, type ElementDiff, type DiffGroup } from './diff.js'
import { buildCascadeClusters, type CascadeCluster } from './cascade-cluster.js'
import type { DomManifest } from './dom-manifest.js'

export type ViewportDiffResult = {
  diffs: ElementDiff[]
  groups: DiffGroup[]
  cascadeClusters: CascadeCluster[]
  summary: DiffResult['summary']
  timeMs: number
}

export function diffManifestsByViewport(
  viewportManifests: Record<number, { before: DomManifest | null, after: DomManifest | null }>,
): Record<number, ViewportDiffResult> {
  const results: Record<number, ViewportDiffResult> = {}

  for (const [width, { before, after }] of Object.entries(viewportManifests)) {
    if (!before || !after) {
      results[Number(width)] = {
        diffs: [],
        groups: [],
        cascadeClusters: [],
        summary: { changed: 0, added: 0, removed: 0, moved: 0, unchanged: 0, totalChanges: 0, groupCount: 0, groupedElementCount: 0 },
        timeMs: 0,
      }
      continue
    }

    const match = matchManifests(before, after)
    const raw = diffManifests(before, after, match)
    const consolidated = consolidateDiffs(raw, before, after)
    const cascade = buildCascadeClusters(consolidated.groups, consolidated.diffs, before, after)

    const remainingChanges = cascade.remainingDiffs.reduce((s, d) => s + d.changes.length, 0)
      + cascade.remainingGroups.reduce((s, g) => s + g.changes.length * g.members.length, 0)
    const cascadeChanges = cascade.clusters.reduce((s, c) => s + c.elementCount * c.properties.length, 0)

    results[Number(width)] = {
      diffs: cascade.remainingDiffs,
      groups: cascade.remainingGroups,
      cascadeClusters: cascade.clusters,
      summary: {
        ...consolidated.summary,
        totalChanges: remainingChanges,
        groupCount: cascade.remainingGroups.length,
        groupedElementCount: cascade.remainingGroups.reduce((s, g) => s + g.members.length, 0),
        cascadeChanges,
        cascadeClusterCount: cascade.clusters.length,
      } as DiffResult['summary'],
      timeMs: consolidated.timeMs,
    }
  }

  return results
}
