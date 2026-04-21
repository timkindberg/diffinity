import { type Change, type ElementDiff, type DiffGroup, type ImportanceLevel } from './diff.js'
import { type ElementNode, type DomManifest } from './dom-manifest.js'
import type { VisualImpact } from './visual-impact.js'

/**
 * Cascade clustering: collapse groups of elements that share the same
 * set of changed properties with similar numeric deltas.
 *
 * Example: 89 elements all had "width: 1388px → 1370px" — that's a single
 * layout cascade from a parent width change. This collapses them into one
 * CascadeCluster item instead of 89 individual diffs or a fingerprint group.
 *
 * Also detects root cause by finding the lowest common ancestor and checking
 * if it has a matching property change.
 */

export type CascadeRootCause = {
  label: string
  property: string
  before: string
  after: string
}

export type CascadeCluster = {
  id: string
  properties: string[]
  delta: string
  elementCount: number
  importance: ImportanceLevel
  members: { label: string; beforeIdx: number | null; afterIdx: number | null }[]
  rootCause: CascadeRootCause | null
  visualImpact?: VisualImpact
}

type PropDelta = {
  property: string
  direction: 'increased' | 'decreased' | 'changed'
  avgDelta: number
}

const CASCADE_PROPS = new Set([
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
])

function parsePx(val: string | null): number | null {
  if (!val) return null
  const m = val.match(/^(-?[\d.]+)px$/)
  return m ? parseFloat(m[1]) : null
}

function isCascadeCandidate(changes: Change[]): boolean {
  return changes.length > 0 && changes.every(c => CASCADE_PROPS.has(c.property))
}

function computeDeltas(changes: Change[]): PropDelta[] | null {
  const deltas: PropDelta[] = []
  for (const c of changes) {
    const before = parsePx(c.before)
    const after = parsePx(c.after)
    if (before == null || after == null) return null
    const diff = after - before
    deltas.push({
      property: c.property,
      direction: diff > 0 ? 'increased' : diff < 0 ? 'decreased' : 'changed',
      avgDelta: Math.abs(diff),
    })
  }
  return deltas
}

function cascadeKey(deltas: PropDelta[]): string {
  return deltas
    .map(d => `${d.property}:${d.direction}`)
    .sort()
    .join('|')
}

function formatDelta(deltas: PropDelta[]): string {
  return deltas
    .map(d => {
      const rounded = Math.round(d.avgDelta)
      return `${d.property} ${d.direction} ~${rounded}px`
    })
    .join(', ')
}

type MemberInfo = {
  label: string
  beforeIdx: number | null
  afterIdx: number | null
  deltas: PropDelta[]
  sourceType: 'group' | 'diff'
  sourceIdx: number
}

const MIN_CLUSTER_SIZE = 3

function isAncestorOfAny(idx: number, allIndices: number[], parentMap: Map<number, number>): boolean {
  for (const other of allIndices) {
    if (other === idx) continue
    let cur = parentMap.get(other)
    while (cur != null) {
      if (cur === idx) return true
      cur = parentMap.get(cur)
    }
  }
  return false
}

// ─── DOM tree helpers ────────────────────────────────────────────

function buildParentMap(root: ElementNode | null): Map<number, number> {
  const map = new Map<number, number>()
  if (!root) return map
  function walk(node: ElementNode, parentIdx: number | null) {
    if (parentIdx != null) map.set(node.idx, parentIdx)
    for (const c of node.children) walk(c, node.idx)
  }
  walk(root, null)
  return map
}

function buildNodeMap(root: ElementNode | null): Map<number, ElementNode> {
  const map = new Map<number, ElementNode>()
  if (!root) return map
  function walk(node: ElementNode) {
    map.set(node.idx, node)
    for (const c of node.children) walk(c)
  }
  walk(root)
  return map
}

function getAncestors(idx: number, parentMap: Map<number, number>): number[] {
  const ancestors: number[] = []
  let cur = idx
  while (parentMap.has(cur)) {
    cur = parentMap.get(cur)!
    ancestors.push(cur)
  }
  return ancestors
}

function findLCA(indices: number[], parentMap: Map<number, number>): number | null {
  if (indices.length === 0) return null
  if (indices.length === 1) return parentMap.get(indices[0]) ?? null

  const firstAncestors = getAncestors(indices[0], parentMap)
  const ancestorSet = new Set(firstAncestors)

  let candidates = firstAncestors
  for (let i = 1; i < indices.length; i++) {
    const anc = getAncestors(indices[i], parentMap)
    candidates = candidates.filter(idx => new Set(anc).has(idx))
  }

  return candidates.length > 0 ? candidates[0] : null
}

function nodeLabel(node: ElementNode): string {
  if (node.accessibleName) return node.accessibleName
  if (node.testId) return `[${node.testId}]`
  if (node.id) return `#${node.id}`
  if (node.role && node.text) return `${node.role} "${node.text}"`
  if (node.ariaLabel) return node.ariaLabel
  const classes = node.attrs?.class
  if (classes) {
    const short = classes.split(/\s+/).filter(c => !c.includes('__') && c.length < 30).slice(0, 2).join('.')
    if (short) return `${node.tag}.${short}`
  }
  if (node.tag) return `<${node.tag}>`
  return 'unknown'
}

/**
 * Build a lookup from identity keys to nodes for cross-manifest matching.
 * Indices differ between before/after captures, so we match by identity.
 */
function buildIdentityMap(root: ElementNode): Map<string, ElementNode> {
  const map = new Map<string, ElementNode>()
  function walk(node: ElementNode) {
    const keys: string[] = []
    if (node.id) keys.push(`id:${node.id}`)
    if (node.testId) keys.push(`testid:${node.testId}`)
    if (node.ariaLabel) keys.push(`aria:${node.ariaLabel}`)
    if (node.tag && node.attrs?.class) {
      keys.push(`tag-class:${node.tag}.${node.attrs.class.split(/\s+/).sort().join('.')}`)
    }
    for (const k of keys) {
      if (!map.has(k)) map.set(k, node)
    }
    for (const c of node.children) walk(c)
  }
  walk(root)
  return map
}

function findMatchingBeforeNode(afterNode: ElementNode, beforeIdentityMap: Map<string, ElementNode>): ElementNode | null {
  if (afterNode.id) {
    const m = beforeIdentityMap.get(`id:${afterNode.id}`)
    if (m) return m
  }
  if (afterNode.testId) {
    const m = beforeIdentityMap.get(`testid:${afterNode.testId}`)
    if (m) return m
  }
  if (afterNode.ariaLabel) {
    const m = beforeIdentityMap.get(`aria:${afterNode.ariaLabel}`)
    if (m) return m
  }
  if (afterNode.tag && afterNode.attrs?.class) {
    const k = `tag-class:${afterNode.tag}.${afterNode.attrs.class.split(/\s+/).sort().join('.')}`
    const m = beforeIdentityMap.get(k)
    if (m) return m
  }
  return null
}

function findRootCause(
  members: MemberInfo[],
  properties: string[],
  beforeManifest: DomManifest | null,
  afterManifest: DomManifest | null,
  allDiffs: ElementDiff[],
): CascadeRootCause | null {
  if (!afterManifest?.root) return null

  const afterParentMap = buildParentMap(afterManifest.root)
  const afterNodeMap = buildNodeMap(afterManifest.root)

  const afterIndices = members
    .map(m => m.afterIdx)
    .filter((idx): idx is number => idx != null)
  if (afterIndices.length === 0) return null

  const lcaIdx = findLCA(afterIndices, afterParentMap)
  if (lcaIdx == null) return null

  // Collect all ancestor indices from LCA upward
  const ancestorSet = new Set<number>()
  let walk: number | null = lcaIdx
  while (walk != null) {
    ancestorSet.add(walk)
    walk = afterParentMap.get(walk) ?? null
  }

  // Check remaining diffs for an ancestor with a relevant property change.
  // These diffs have correctly matched before/after values already.
  for (const d of allDiffs) {
    if (d.afterIdx == null || !ancestorSet.has(d.afterIdx)) continue
    for (const c of d.changes) {
      if (properties.includes(c.property) && c.before && c.after && c.before !== c.after) {
        return { label: d.label, property: c.property, before: c.before, after: c.after }
      }
      // Padding/margin changes on an ancestor can cause width cascades in children
      if (properties.includes('width') && (c.property === 'padding-left' || c.property === 'padding-right') && c.before && c.after) {
        const afterNode = afterNodeMap.get(d.afterIdx)
        const widthChange = d.changes.find(ch => ch.property === 'width')
        if (widthChange?.before && widthChange?.after) {
          return { label: d.label, property: 'width', before: widthChange.before, after: widthChange.after }
        }
        return { label: d.label, property: c.property, before: c.before, after: c.after }
      }
    }
  }

  // Fallback: identity-match against the before manifest
  if (!beforeManifest?.root) return null
  const beforeIdentityMap = buildIdentityMap(beforeManifest.root)

  let cur: number | null = lcaIdx
  const maxDepth = 10
  for (let depth = 0; depth < maxDepth && cur != null; depth++) {
    const afterNode = afterNodeMap.get(cur)
    if (!afterNode) { cur = afterParentMap.get(cur) ?? null; continue }

    const beforeNode = findMatchingBeforeNode(afterNode, beforeIdentityMap)
    if (!beforeNode) { cur = afterParentMap.get(cur) ?? null; continue }

    for (const prop of properties) {
      const bVal = beforeNode.styles?.[prop]
      const aVal = afterNode.styles?.[prop]
      if (bVal && aVal && bVal !== aVal) {
        return { label: nodeLabel(afterNode), property: prop, before: bVal, after: aVal }
      }
    }
    cur = afterParentMap.get(cur) ?? null
  }

  return null
}

// ─── Main clustering ─────────────────────────────────────────────

export function buildCascadeClusters(
  groups: DiffGroup[],
  diffs: ElementDiff[],
  beforeManifest?: DomManifest | null,
  afterManifest?: DomManifest | null,
): {
  clusters: CascadeCluster[]
  remainingGroups: DiffGroup[]
  remainingDiffs: ElementDiff[]
} {
  const buckets = new Map<string, MemberInfo[]>()
  const clusteredGroupIndices = new Set<number>()
  const clusteredDiffIndices = new Set<number>()

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]
    if (!isCascadeCandidate(g.changes)) continue
    const deltas = computeDeltas(g.changes)
    if (!deltas) continue

    const key = cascadeKey(deltas)
    if (!buckets.has(key)) buckets.set(key, [])
    const bucket = buckets.get(key)!

    for (const m of g.members) {
      bucket.push({ label: m.label, beforeIdx: m.beforeIdx, afterIdx: m.afterIdx, deltas, sourceType: 'group', sourceIdx: gi })
    }
    clusteredGroupIndices.add(gi)
  }

  for (let di = 0; di < diffs.length; di++) {
    const d = diffs[di]
    if (d.type === 'added' || d.type === 'removed') continue
    if (!isCascadeCandidate(d.changes)) continue
    const deltas = computeDeltas(d.changes)
    if (!deltas) continue

    const key = cascadeKey(deltas)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push({
      label: d.label, beforeIdx: d.beforeIdx, afterIdx: d.afterIdx, deltas, sourceType: 'diff', sourceIdx: di,
    })
    clusteredDiffIndices.add(di)
  }

  const afterParents = afterManifest?.root ? buildParentMap(afterManifest.root) : new Map<number, number>()

  const clusters: CascadeCluster[] = []
  const actuallyClusteredGroups = new Set<number>()
  const actuallyClusteredDiffs = new Set<number>()

  for (const [key, members] of buckets) {
    // Separate root-cause ancestors from cascade members.
    // An element whose CSS property change CAUSED the cascade should not be
    // absorbed into the cluster — it's the source, not the noise.
    const allAfterIndices = members
      .map(m => m.afterIdx)
      .filter((idx): idx is number => idx != null)

    const cascadeMembers = members.filter(m => {
      if (m.afterIdx == null) return true
      return !isAncestorOfAny(m.afterIdx, allAfterIndices, afterParents)
    })

    if (cascadeMembers.length < MIN_CLUSTER_SIZE) continue

    const avgDeltas: PropDelta[] = cascadeMembers[0].deltas.map((d, i) => {
      const avg = cascadeMembers.reduce((sum, m) => sum + m.deltas[i].avgDelta, 0) / cascadeMembers.length
      return { property: d.property, direction: d.direction, avgDelta: avg }
    })

    const properties = avgDeltas.map(d => d.property)
    const rootCause = findRootCause(cascadeMembers, properties, beforeManifest ?? null, afterManifest ?? null, diffs)

    clusters.push({
      id: key,
      properties,
      delta: formatDelta(avgDeltas),
      elementCount: cascadeMembers.length,
      importance: 'minor',
      members: cascadeMembers.map(m => ({
        label: m.label, beforeIdx: m.beforeIdx, afterIdx: m.afterIdx,
      })),
      rootCause,
    })

    // Only mark cascade members' sources as clustered — excluded ancestors stay in remaining
    const clusteredSourceDiffs = new Set(cascadeMembers.filter(m => m.sourceType === 'diff').map(m => m.sourceIdx))
    const clusteredSourceGroups = new Set(cascadeMembers.filter(m => m.sourceType === 'group').map(m => m.sourceIdx))

    for (const di of clusteredSourceDiffs) actuallyClusteredDiffs.add(di)
    for (const gi of clusteredSourceGroups) actuallyClusteredGroups.add(gi)
  }

  clusters.sort((a, b) => b.elementCount - a.elementCount)

  return {
    clusters,
    remainingGroups: groups.filter((_, i) => !actuallyClusteredGroups.has(i)),
    remainingDiffs: diffs.filter((_, i) => !actuallyClusteredDiffs.has(i)),
  }
}
