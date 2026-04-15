import { type ElementNode, type DomManifest } from './dom-manifest.js'

// ─── Types ──────────────────────────────────────────────────────────

type FlatElement = ElementNode & { ancestorPath: string[] }

export type MatchedPair = {
  beforeIdx: number
  afterIdx: number
  score: number
}

export type MatchResult = {
  matched: MatchedPair[]
  removed: number[]
  added: number[]
  beforeTotal: number
  afterTotal: number
  timeMs: number
}

// ─── Tree flattening ────────────────────────────────────────────────

function nodeLabel(node: ElementNode): string {
  if (node.testId) return `${node.tag}[testid=${node.testId}]`
  if (node.id && !node.id.match(/^:r\d+:$/)) return `${node.tag}#${node.id}`
  if (node.role) return `${node.tag}[role=${node.role}]`
  if (node.accessibleName) return `${node.tag}[name=${node.accessibleName.slice(0, 20)}]`
  return node.tag
}

function flattenTree(node: ElementNode, ancestors: string[] = []): FlatElement[] {
  const path = [...ancestors, nodeLabel(node)]
  const result: FlatElement[] = [{ ...node, ancestorPath: path }]
  for (const child of node.children) {
    result.push(...flattenTree(child, path))
  }
  return result
}

// ─── Scoring ────────────────────────────────────────────────────────

const MIN_SCORE_THRESHOLD = 15

function score(a: FlatElement, b: FlatElement): number {
  if (a.tag !== b.tag) return 0

  let s = 10 // tag match base

  // data-testid (very high)
  if (a.testId && a.testId === b.testId) s += 50

  // User-authored id (high — skip framework-generated :r0: patterns)
  if (a.id && b.id && a.id === b.id && !a.id.match(/^:r\d+:$/)) s += 30

  // role
  if (a.role && a.role === b.role) s += 15

  // aria-label
  if (a.ariaLabel && a.ariaLabel === b.ariaLabel) s += 20

  // accessible name
  if (a.accessibleName && a.accessibleName === b.accessibleName) s += 20

  // text content
  if (a.text && b.text) {
    if (a.text === b.text) s += 15
    else if (a.text.slice(0, 20) === b.text.slice(0, 20)) s += 5
  }

  // class overlap
  const aClasses = new Set((a.attrs.class || '').split(/\s+/).filter(Boolean))
  const bClasses = new Set((b.attrs.class || '').split(/\s+/).filter(Boolean))
  if (aClasses.size > 0 && bClasses.size > 0) {
    let overlap = 0
    for (const c of aClasses) if (bClasses.has(c)) overlap++
    s += Math.min(10, Math.round((overlap / Math.max(aClasses.size, bClasses.size)) * 10))
  }

  // Stable attrs: name, href, src
  for (const attr of ['name', 'href', 'src']) {
    if (a.attrs[attr] && a.attrs[attr] === b.attrs[attr]) s += 10
  }

  // Children count similarity
  const aKids = a.children.length
  const bKids = b.children.length
  if (aKids === bKids) s += 5
  else if (Math.abs(aKids - bKids) <= 2) s += 2

  // Ancestor path similarity
  const maxLen = Math.max(a.ancestorPath.length, b.ancestorPath.length)
  if (maxLen > 0) {
    let pathMatch = 0
    for (let i = 0; i < Math.min(a.ancestorPath.length, b.ancestorPath.length); i++) {
      if (a.ancestorPath[i] === b.ancestorPath[i]) pathMatch++
    }
    s += Math.round((pathMatch / maxLen) * 15)
  }

  return s
}

// ─── Matching ───────────────────────────────────────────────────────

/**
 * Match elements between two DOM manifests using the A-smart approach:
 * flatten both trees with ancestor paths, score all pairs, greedy-match.
 */
export function matchManifests(before: DomManifest, after: DomManifest): MatchResult {
  const t0 = Date.now()

  if (!before.root || !after.root) {
    return { matched: [], removed: [], added: [], beforeTotal: 0, afterTotal: 0, timeMs: 0 }
  }

  const flatBefore = flattenTree(before.root)
  const flatAfter = flattenTree(after.root)

  // Score all pairs above threshold
  const pairs: { bi: number; ai: number; s: number }[] = []
  for (let bi = 0; bi < flatBefore.length; bi++) {
    for (let ai = 0; ai < flatAfter.length; ai++) {
      const s = score(flatBefore[bi], flatAfter[ai])
      if (s > MIN_SCORE_THRESHOLD) pairs.push({ bi, ai, s })
    }
  }

  // Greedy match: highest scores first
  pairs.sort((a, b) => b.s - a.s)
  const usedBefore = new Set<number>()
  const usedAfter = new Set<number>()
  const matched: MatchedPair[] = []

  for (const { bi, ai, s } of pairs) {
    if (usedBefore.has(bi) || usedAfter.has(ai)) continue
    usedBefore.add(bi)
    usedAfter.add(ai)
    matched.push({ beforeIdx: flatBefore[bi].idx, afterIdx: flatAfter[ai].idx, score: s })
  }

  const removed = flatBefore.filter((_, i) => !usedBefore.has(i)).map((n) => n.idx)
  const added = flatAfter.filter((_, i) => !usedAfter.has(i)).map((n) => n.idx)

  return {
    matched,
    removed,
    added,
    beforeTotal: flatBefore.length,
    afterTotal: flatAfter.length,
    timeMs: Date.now() - t0,
  }
}
