/**
 * Post-consolidation pixel-impact classification.
 *
 * For each diff that survives the match → diff → consolidate → cascade pipeline,
 * crop the element's bounding box from the before/after live-page screenshots and
 * compare them with pixelmatch. Diffs whose rendered pixels are effectively
 * identical (mismatchPercent ≤ 0.1% of the element area) are flagged so the
 * report UI can demote them to a collapsed "no visual effect" section.
 *
 * The thresholds here match the fidelity check in capture.ts: `threshold: 0.1`
 * (perceptual) plus mismatchPercent ≤ 0.1%.
 */
import { readFileSync, existsSync } from 'fs'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import type { ElementNode, DomManifest } from './dom-manifest.js'

export type VisualImpactVerdict = 'visual' | 'pixel-identical'

/**
 * Why a diff landed in the "not visible in the static capture" panel.
 * Only populated when `verdict === 'pixel-identical'`.
 *
 *  - `no-delta`         — pixelmatch returned zero mismatched pixels.
 *  - `below-threshold`  — mismatch > 0 but ≤ maxMismatchPercent.
 *  - `same-computed`    — all authored CSS changes resolve to identical values
 *                         once font stacks / quotes / casing are normalized;
 *                         a stronger claim than `no-delta`. Set in a later pass
 *                         (see compare-v2.ts) because it requires access to the
 *                         diff's `changes`, which visual-impact.ts doesn't see.
 */
export type VisualImpactReason =
  | 'no-delta'
  | 'below-threshold'
  | 'same-computed'

export type VisualImpact = {
  mismatchPixels: number
  mismatchPercent: number
  verdict: VisualImpactVerdict
  reason?: VisualImpactReason
}

export type ClassifyOptions = {
  /** pixelmatch perceptual threshold (0..1). Default: 0.1 */
  threshold?: number
  /** Element classified pixel-identical when mismatchPercent ≤ this. Default: 0.1 */
  maxMismatchPercent?: number
}

const DEFAULT_THRESHOLD = 0.1
const DEFAULT_MAX_MISMATCH_PERCENT = 0.1

type Png = InstanceType<typeof PNG>

function buildIndex(node: ElementNode | null, out?: Map<number, ElementNode>): Map<number, ElementNode> {
  const map = out ?? new Map<number, ElementNode>()
  if (!node) return map
  map.set(node.idx, node)
  for (const c of node.children) buildIndex(c, map)
  return map
}

function cropRegion(png: Png, x: number, y: number, w: number, h: number): Png | null {
  const ix = Math.max(0, Math.floor(x))
  const iy = Math.max(0, Math.floor(y))
  const iw = Math.min(png.width - ix, Math.floor(w))
  const ih = Math.min(png.height - iy, Math.floor(h))
  if (iw <= 0 || ih <= 0) return null
  const out = new PNG({ width: iw, height: ih })
  PNG.bitblt(png, out, ix, iy, iw, ih, 0, 0)
  return out
}

/**
 * Compare a single element pair. Returns null if the pair cannot be evaluated
 * (zero-area bbox, size drift between before/after, or out-of-bounds crop).
 */
export function classifyElementPair(
  beforePng: Png,
  afterPng: Png,
  beforeNode: ElementNode,
  afterNode: ElementNode,
  opts: ClassifyOptions = {},
): VisualImpact | null {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD
  const maxMismatchPercent = opts.maxMismatchPercent ?? DEFAULT_MAX_MISMATCH_PERCENT
  const bb = beforeNode.bbox
  const ab = afterNode.bbox

  if (bb.w < 1 || bb.h < 1 || ab.w < 1 || ab.h < 1) return null
  // Size drift is a visual diff by definition — don't muddy the classification.
  if (bb.w !== ab.w || bb.h !== ab.h) return null

  const bc = cropRegion(beforePng, bb.x, bb.y, bb.w, bb.h)
  const ac = cropRegion(afterPng, ab.x, ab.y, ab.w, ab.h)
  if (!bc || !ac) return null
  if (bc.width !== ac.width || bc.height !== ac.height) return null

  const diffImg = new PNG({ width: bc.width, height: bc.height })
  const mismatchPixels = pixelmatch(bc.data, ac.data, diffImg.data, bc.width, bc.height, { threshold })
  const total = bc.width * bc.height
  const mismatchPercent = total > 0 ? (mismatchPixels / total) * 100 : 0
  const verdict: VisualImpactVerdict = mismatchPercent <= maxMismatchPercent ? 'pixel-identical' : 'visual'

  const impact: VisualImpact = { mismatchPixels, mismatchPercent, verdict }
  if (verdict === 'pixel-identical') {
    impact.reason = mismatchPixels === 0 ? 'no-delta' : 'below-threshold'
  }
  return impact
}

export type ClassifyContext = {
  beforeManifest: DomManifest
  afterManifest: DomManifest
  beforeLivePngPath: string
  afterLivePngPath: string
  options?: ClassifyOptions
}

type PngCache = Map<string, Png>

function loadPng(path: string, cache: PngCache): Png | null {
  const hit = cache.get(path)
  if (hit) return hit
  if (!existsSync(path)) return null
  const img = PNG.sync.read(readFileSync(path))
  cache.set(path, img)
  return img
}

export type Pair = { beforeIdx: number | null; afterIdx: number | null }

/**
 * Classify a list of element pairs and return a map keyed by
 * `${beforeIdx}:${afterIdx}`. Missing entries mean "skipped" (no bboxes, size
 * drift, or PNG unavailable).
 *
 * A fresh PNG cache is used per call so callers don't leak memory across runs.
 */
export function classifyPairs(pairs: Pair[], ctx: ClassifyContext): Map<string, VisualImpact> {
  const out = new Map<string, VisualImpact>()
  if (pairs.length === 0) return out
  const cache: PngCache = new Map()
  const beforePng = loadPng(ctx.beforeLivePngPath, cache)
  const afterPng = loadPng(ctx.afterLivePngPath, cache)
  if (!beforePng || !afterPng) return out

  const beforeIdx = buildIndex(ctx.beforeManifest.root)
  const afterIdx = buildIndex(ctx.afterManifest.root)

  for (const p of pairs) {
    if (p.beforeIdx == null || p.afterIdx == null) continue
    const bn = beforeIdx.get(p.beforeIdx)
    const an = afterIdx.get(p.afterIdx)
    if (!bn || !an) continue
    const impact = classifyElementPair(beforePng, afterPng, bn, an, ctx.options)
    if (impact) out.set(`${p.beforeIdx}:${p.afterIdx}`, impact)
  }
  return out
}

/**
 * Aggregate a list of per-member impacts into a single verdict for a group or
 * cluster. A group is pixel-identical ONLY when every one of its classified
 * members is pixel-identical. Unclassified members (size drift, missing bbox)
 * poison the verdict back to "visual" — if we can't prove no impact, we assume
 * the group has impact.
 */
export function aggregateImpact(memberImpacts: (VisualImpact | null)[]): VisualImpact | null {
  if (memberImpacts.length === 0) return null
  let totalMismatchPixels = 0
  let totalMismatchPercent = 0
  let classified = 0
  // Track per-member reason so we only report one when the whole group agrees.
  // Mixed reasons (e.g. some no-delta + some below-threshold) leave reason unset;
  // the demoted-panel header will still show the aggregate count.
  let sharedReason: VisualImpactReason | undefined
  let reasonSeeded = false
  for (const impact of memberImpacts) {
    if (!impact) return null
    if (impact.verdict === 'visual') {
      return {
        mismatchPixels: impact.mismatchPixels,
        mismatchPercent: impact.mismatchPercent,
        verdict: 'visual',
      }
    }
    totalMismatchPixels += impact.mismatchPixels
    totalMismatchPercent += impact.mismatchPercent
    classified++
    if (!reasonSeeded) {
      sharedReason = impact.reason
      reasonSeeded = true
    } else if (sharedReason !== impact.reason) {
      sharedReason = undefined
    }
  }
  const agg: VisualImpact = {
    mismatchPixels: totalMismatchPixels,
    mismatchPercent: classified > 0 ? totalMismatchPercent / classified : 0,
    verdict: 'pixel-identical',
  }
  if (sharedReason) agg.reason = sharedReason
  return agg
}
