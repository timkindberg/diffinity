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
import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import type { ElementNode, DomManifest, PseudoStateRule } from './dom-manifest.js'

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
  /**
   * True when a changed property on this element is also set by a rule
   * targeting a tracked interactive pseudo-class (`:hover`, `:focus`, ...).
   * The verdict is overridden to `visual` in this case so the diff stays
   * in the main list even when static rendered pixels are identical.
   */
  pseudoStateSensitive?: boolean
  /** Pseudo-class names (without the leading colon) that drive the sensitivity. */
  pseudoClasses?: string[]
  /**
   * Per-pseudo-class member match counts. Only populated for groups/clusters
   * where at least one pseudo-class is partial (matched < total). Unanimous
   * groups and single-item diffs leave this unset — the `(N of M)` fraction
   * is only rendered when it carries information.
   */
  pseudoClassMemberCounts?: { pc: string; matched: number; total: number }[]
}

export type ClassifyOptions = {
  /** pixelmatch perceptual threshold (0..1). Default: 0.02 */
  threshold?: number
  /** Element classified pixel-identical when mismatchPercent ≤ this. Default: 0.1 */
  maxMismatchPercent?: number
}

// pixelmatch's YIQ distance under-weights hue-only shifts (purple→green pastels
// register as similar). 0.02 catches those without swamping us in subpixel
// font noise, which we further tamp down with includeAA: false.
const DEFAULT_THRESHOLD = 0.02
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

type BBox = { x: number; y: number; w: number; h: number }

type PairArtifacts = {
  impact: VisualImpact
  bc: Png
  ac: Png
  diffImg: Png
  bb: BBox
  ab: BBox
  threshold: number
  maxMismatchPercent: number
}

function classifyElementPairFull(
  beforePng: Png,
  afterPng: Png,
  beforeNode: ElementNode,
  afterNode: ElementNode,
  opts: ClassifyOptions = {},
): PairArtifacts | null {
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
  const mismatchPixels = pixelmatch(bc.data, ac.data, diffImg.data, bc.width, bc.height, { threshold, includeAA: false })
  const total = bc.width * bc.height
  const mismatchPercent = total > 0 ? (mismatchPixels / total) * 100 : 0
  const verdict: VisualImpactVerdict = mismatchPercent <= maxMismatchPercent ? 'pixel-identical' : 'visual'

  const impact: VisualImpact = { mismatchPixels, mismatchPercent, verdict }
  if (verdict === 'pixel-identical') {
    impact.reason = mismatchPixels === 0 ? 'no-delta' : 'below-threshold'
  }

  return {
    impact,
    bc,
    ac,
    diffImg,
    bb,
    ab,
    threshold,
    maxMismatchPercent,
  }
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
  return classifyElementPairFull(beforePng, afterPng, beforeNode, afterNode, opts)?.impact ?? null
}

/**
 * Opt-in debug dump: write the cropped before/after PNGs, the pixelmatch diff
 * image, and per-pair metadata to disk so humans can verify what the classifier
 * actually compared. Activated by `VR_DEBUG_VISUAL_IMPACT=1` or by callers
 * passing `ComparePageOptions.debugVisualImpactDir`.
 */
export type DumpContext = {
  /** Root debug directory (e.g. `<reportDir>/_debug`). */
  dumpDir: string
  /** Page identifier (e.g. scenario dir name). */
  pageId: string
  /** Viewport width in pixels. */
  viewport: number
}

export type ClassifyContext = {
  beforeManifest: DomManifest
  afterManifest: DomManifest
  beforeLivePngPath: string
  afterLivePngPath: string
  options?: ClassifyOptions
  dump?: DumpContext
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
    const full = classifyElementPairFull(beforePng, afterPng, bn, an, ctx.options)
    if (!full) continue
    out.set(`${p.beforeIdx}:${p.afterIdx}`, full.impact)
    if (ctx.dump) {
      writePairDump(ctx.dump, p.beforeIdx, p.afterIdx, full)
    }
  }
  return out
}

function writePairDump(
  dump: DumpContext,
  beforeIdx: number,
  afterIdx: number,
  full: PairArtifacts,
): void {
  const pairKey = `${beforeIdx}-${afterIdx}`
  const outDir = join(dump.dumpDir, dump.pageId, String(dump.viewport), pairKey)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'before.png'), PNG.sync.write(full.bc))
  writeFileSync(join(outDir, 'after.png'), PNG.sync.write(full.ac))
  writeFileSync(join(outDir, 'diff.png'), PNG.sync.write(full.diffImg))
  const meta = {
    beforeIdx,
    afterIdx,
    beforeBbox: full.bb,
    afterBbox: full.ab,
    mismatchPixels: full.impact.mismatchPixels,
    mismatchPercent: full.impact.mismatchPercent,
    verdict: full.impact.verdict,
    threshold: full.maxMismatchPercent,
    perceptualThreshold: full.threshold,
  }
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2))
  const line = JSON.stringify({ pageId: dump.pageId, viewport: dump.viewport, ...meta }) + '\n'
  appendFileSync(join(dump.dumpDir, 'classification.jsonl'), line)
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

// ─── Pseudo-state sensitivity ───────────────────────────────────────

/**
 * Shorthand → longhand expansion for matching diff-reported properties
 * against pseudo-state rule property lists. The diff engine collapses
 * e.g. 4 identical corner-radius changes into a single `border-radius`
 * entry, but CSSOM enumerates longhands — expand before comparing so
 * `.btn:hover { border-radius: 8px }` still lines up with a diff that
 * reports a collapsed `border-radius` change.
 */
const SHORTHAND_EXPANSIONS: Record<string, string[]> = {
  'border-radius': [
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
  ],
  'border-width': [
    'border-top-width', 'border-right-width',
    'border-bottom-width', 'border-left-width',
  ],
  'border-color': [
    'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color',
  ],
  'border-style': [
    'border-top-style', 'border-right-style',
    'border-bottom-style', 'border-left-style',
  ],
  'padding': [
    'padding-top', 'padding-right',
    'padding-bottom', 'padding-left',
  ],
  'margin': [
    'margin-top', 'margin-right',
    'margin-bottom', 'margin-left',
  ],
}

function expandProperty(prop: string): string[] {
  const exp = SHORTHAND_EXPANSIONS[prop]
  return exp ? [prop, ...exp] : [prop]
}

/**
 * Check whether any changed property overlaps with properties set by a rule
 * that targets a tracked interactive pseudo-class on this element. Returns
 * the sorted list of pseudo-classes that drive the overlap, or null if the
 * element has no pseudo-state rules or none of them touch the changed props.
 */
export function detectPseudoStateSensitivity(
  rules: PseudoStateRule[] | undefined,
  changedProperties: string[],
): string[] | null {
  if (!rules || rules.length === 0) return null
  const expanded = new Set<string>()
  for (const p of changedProperties) {
    for (const e of expandProperty(p)) expanded.add(e)
  }

  const matched = new Set<string>()
  for (const rule of rules) {
    if (rule.properties.some(p => expanded.has(p))) {
      for (const pc of rule.pseudoClasses) matched.add(pc)
    }
  }
  return matched.size > 0 ? [...matched].sort() : null
}

/**
 * Apply a pseudo-state override to an existing impact. When the element has
 * rules in a tracked interactive pseudo-class that would restyle a changed
 * property, we flip the verdict back to `visual` and record which pseudo-
 * classes apply. This prevents the report from demoting diffs that look
 * static-identical but would plainly differ on `:hover` / `:focus` / etc.
 *
 * Returns a new impact object when an override applies, or the original one
 * otherwise.
 */
export function applyPseudoStateOverride(
  impact: VisualImpact,
  pseudoClasses: string[] | null,
  memberCounts?: { pc: string; matched: number; total: number }[],
): VisualImpact {
  if (!pseudoClasses || pseudoClasses.length === 0) return impact
  // Drop `reason` when flipping to visual — it's only meaningful for
  // pixel-identical diffs (it answers "why was this demoted?").
  const { reason: _reason, ...rest } = impact
  const out: VisualImpact = {
    ...rest,
    verdict: 'visual',
    pseudoStateSensitive: true,
    pseudoClasses,
  }
  if (memberCounts && memberCounts.length > 0) {
    out.pseudoClassMemberCounts = memberCounts
  }
  return out
}

// Minimal shapes so this module stays free of cycles with viewport-diff /
// diff / cascade-cluster — they import from here, not the other way around.
type PseudoStateOverrideMember = { beforeIdx: number | null; afterIdx: number | null }
type PseudoStateOverrideDiff = PseudoStateOverrideMember & {
  changes: { property: string }[]
  visualImpact?: VisualImpact
}
type PseudoStateOverrideGroup = {
  changes: { property: string }[]
  members: PseudoStateOverrideMember[]
  visualImpact?: VisualImpact
}
type PseudoStateOverrideCluster = {
  properties: string[]
  members: PseudoStateOverrideMember[]
  visualImpact?: VisualImpact
}

type PseudoStateViewport = {
  diffs: PseudoStateOverrideDiff[]
  groups: PseudoStateOverrideGroup[]
  cascadeClusters: PseudoStateOverrideCluster[]
}

function buildElementIndex(node: ElementNode | null, out?: Map<number, ElementNode>): Map<number, ElementNode> {
  const map = out ?? new Map<number, ElementNode>()
  if (!node) return map
  map.set(node.idx, node)
  for (const c of node.children) buildElementIndex(c, map)
  return map
}

/**
 * Apply pseudo-state overrides across every diff, group, and cascade cluster
 * in a viewport result. Mutates `viewportDiff` in place. Safe to call even
 * when no diffs/manifests have pseudo-state rules — a no-op in that case.
 *
 * Runs after pixel-match classification so only demoted diffs get promoted —
 * the pixelmatch verdict stands for diffs that already look visual.
 */
export function applyPseudoStateOverridesToViewport(
  viewportDiff: PseudoStateViewport,
  beforeManifest: DomManifest,
  afterManifest: DomManifest,
): void {
  const beforeIndex = buildElementIndex(beforeManifest.root)
  const afterIndex = buildElementIndex(afterManifest.root)

  const elementRules = (beforeIdx: number | null, afterIdx: number | null) => {
    const b = beforeIdx != null ? beforeIndex.get(beforeIdx) : undefined
    const a = afterIdx != null ? afterIndex.get(afterIdx) : undefined
    const rules = [...(b?.pseudoStateRules ?? []), ...(a?.pseudoStateRules ?? [])]
    return rules.length > 0 ? rules : undefined
  }

  for (const d of viewportDiff.diffs) {
    if (!d.visualImpact) continue
    // Only rescue *still-demoted* diffs. A diff pixelmatch already marked
    // "visual" is visibly different — badging it "may affect :hover" would
    // be noise, and the accompanying tooltip ("pixels look identical") would
    // be wrong. Skip it.
    if (d.visualImpact.verdict !== 'pixel-identical') continue
    const rules = elementRules(d.beforeIdx, d.afterIdx)
    const props = d.changes.map(c => c.property)
    const pseudos = detectPseudoStateSensitivity(rules, props)
    if (pseudos) d.visualImpact = applyPseudoStateOverride(d.visualImpact, pseudos)
  }

  const aggregateMemberPseudos = (
    members: PseudoStateOverrideMember[],
    changedProperties: string[],
  ): { pseudoClasses: string[]; memberCounts?: { pc: string; matched: number; total: number }[] } | null => {
    const counts = new Map<string, number>()
    const total = members.length
    for (const m of members) {
      const rules = elementRules(m.beforeIdx, m.afterIdx)
      const p = detectPseudoStateSensitivity(rules, changedProperties)
      if (!p) continue
      for (const pc of p) counts.set(pc, (counts.get(pc) ?? 0) + 1)
    }
    if (counts.size === 0) return null
    const pseudoClasses = [...counts.keys()].sort()
    const anyPartial = pseudoClasses.some(pc => (counts.get(pc) ?? 0) < total)
    if (!anyPartial) return { pseudoClasses }
    const memberCounts = pseudoClasses.map(pc => ({
      pc,
      matched: counts.get(pc) ?? 0,
      total,
    }))
    return { pseudoClasses, memberCounts }
  }

  for (const g of viewportDiff.groups) {
    if (!g.visualImpact) continue
    if (g.visualImpact.verdict !== 'pixel-identical') continue
    const props = g.changes.map(c => c.property)
    const agg = aggregateMemberPseudos(g.members, props)
    if (agg) g.visualImpact = applyPseudoStateOverride(g.visualImpact, agg.pseudoClasses, agg.memberCounts)
  }

  for (const c of viewportDiff.cascadeClusters) {
    if (!c.visualImpact) continue
    if (c.visualImpact.verdict !== 'pixel-identical') continue
    const agg = aggregateMemberPseudos(c.members, c.properties)
    if (agg) c.visualImpact = applyPseudoStateOverride(c.visualImpact, agg.pseudoClasses, agg.memberCounts)
  }
}
