/**
 * Semantic visual diff comparison between before/ and after/ capture directories.
 * Loads per-viewport DOM manifests, runs element matching + semantic diffing
 * independently per viewport, outputs report data.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync, symlinkSync, realpathSync, lstatSync, unlinkSync } from 'fs'
import { join, relative } from 'path'
import { diffManifestsByViewport, type ViewportDiffResult } from './viewport-diff.js'
import type { DomManifest } from './dom-manifest.js'
import { classifyPairs, aggregateImpact, applyPseudoStateOverridesToViewport, type Pair, type VisualImpact } from './visual-impact.js'
import { areChangesSameComputed } from './visual-reason.js'

export type ComparePageOptions = {
  /** Directory containing 'before' captures */
  beforeDir: string
  /** Directory containing 'after' captures */
  afterDir: string
  /** Viewport widths to compare (default: auto-detected from manifests) */
  widths?: number[]
  /** Directory to write report output (default: parent of beforeDir) */
  reportDir?: string
  /** Log function (default: console.log) */
  log?: (msg: string) => void
}

type PageRole = {
  dirName: string
  page: string
  role: string
}

type PageRoleResult = PageRole & {
  viewportDiffs: Record<number, ViewportDiffResult & { hasBeforeHtml: boolean; hasAfterHtml: boolean }>
}

export type CompareResult = {
  pages: PageRoleResult[]
  reportDataPath: string
  reportHtmlPath: string
}

/**
 * Auto-detect viewport widths from manifest files in a directory.
 */
function detectViewports(phaseDir: string): number[] {
  const widths = new Set<number>()
  if (!existsSync(phaseDir)) return []
  for (const entry of readdirSync(phaseDir)) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue
    const fullPath = join(phaseDir, entry)
    if (!statSync(fullPath).isDirectory()) continue
    for (const file of readdirSync(fullPath)) {
      const match = file.match(/^dom-manifest-(\d+)\.json$/)
      if (match) widths.add(parseInt(match[1]))
    }
  }
  return [...widths].sort((a, b) => b - a)
}

function findPageRoleDirs(phaseDir: string, viewports: number[]): PageRole[] {
  if (!existsSync(phaseDir)) return []
  const results: PageRole[] = []
  for (const entry of readdirSync(phaseDir)) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue
    const fullPath = join(phaseDir, entry)
    if (!statSync(fullPath).isDirectory()) continue
    const hasManifest = viewports.some(w => existsSync(join(fullPath, `dom-manifest-${w}.json`)))
    if (!hasManifest) continue

    const dashIdx = entry.lastIndexOf('--')
    const page = dashIdx !== -1 ? entry.slice(0, dashIdx) : entry
    const role = dashIdx !== -1 ? entry.slice(dashIdx + 2) : 'default'
    results.push({ dirName: entry, page, role })
  }
  return results
}

function loadManifest(phaseDir: string, dirName: string, width: number): DomManifest | null {
  const path = join(phaseDir, dirName, `dom-manifest-${width}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

/**
 * Ensure that reportDir/<name> is a directory (or symlink to one) that resolves
 * to captureDir. No-op if the expected path already matches captureDir.
 * Creates a relative symlink otherwise (zero-copy, portable for GH Pages,
 * keeps the report's hardcoded `before/`|`after/` iframe paths working regardless
 * of where captures actually live).
 */
function ensureCaptureLink(reportDir: string, name: 'before' | 'after', captureDir: string): void {
  const target = join(reportDir, name)
  const captureReal = realpathSync(captureDir)
  if (existsSync(target)) {
    try {
      if (realpathSync(target) === captureReal) return // already correct
    } catch { /* broken symlink, fall through to recreate */ }
    // Path exists but points elsewhere — refuse to clobber a real directory
    const stat = lstatSync(target)
    if (!stat.isSymbolicLink()) {
      throw new Error(`compare(): ${target} is a directory, not a symlink. Refusing to clobber. Move or remove it manually.`)
    }
    // Stale symlink — remove and recreate below
    unlinkSync(target)
  }
  // Create relative symlink so the report dir is portable (move + symlinks stay valid)
  const rel = relative(reportDir, captureReal)
  symlinkSync(rel, target, 'dir')
}

// ─── Report template ──────────────────────────────────────────────

function getReportTemplate(): string | null {
  // Only the BUILT template (inlined JS, no module src) is viable for file:// viewing.
  // The source template uses `<script type="module" src="./main.tsx">` which breaks on file://.
  const possiblePaths = [
    join(_dirname, '..', 'dist', 'report', 'index.html'), // from src/ during development (preferred)
    join(_dirname, 'report', 'index.html'),               // dist/report/index.html (published package)
  ]
  for (const p of possiblePaths) {
    if (!existsSync(p)) continue
    const content = readFileSync(p, 'utf-8')
    // Skip the raw source template — it references external TSX files
    if (content.includes('src="./main.tsx"') || content.includes('src="/main.tsx"')) continue
    return content
  }
  return null
}

function buildReportHtml(template: string, vrData: object): string {
  const dataScript = `<script>window.VR_DATA = ${JSON.stringify(vrData)};</script>`
  // Inject data script before the first <script> tag so it's available when the app boots
  const firstScript = template.indexOf('<script>')
  if (firstScript !== -1) {
    return template.slice(0, firstScript) + dataScript + '\n    ' + template.slice(firstScript)
  }
  // Fallback: inject before </head>
  return template.replace('</head>', dataScript + '\n  </head>')
}

// ─── Inject highlight script into HTML captures ─────────────────────

function getHighlightScript(): string {
  // Try to load from the report directory; this file is part of the diffinity package
  const possiblePaths = [
    join(_dirname, 'report', 'highlight-listener.js'),
    join(_dirname, '..', 'src', 'report', 'highlight-listener.js'),
  ]
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      const src = readFileSync(p, 'utf-8')
      return `<script data-vr-injected>\n${src}\n</script>`
    }
  }
  return ''
}

// __dirname for both ESM and CJS
import { dirname } from 'path'
import { fileURLToPath } from 'url'
const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

function injectHighlightScript(results: PageRoleResult[], beforeDir: string, afterDir: string, viewports: number[]) {
  const highlightScript = getHighlightScript()
  if (!highlightScript) return

  for (const r of results) {
    for (const phase of ['before', 'after'] as const) {
      const phaseDir = phase === 'before' ? beforeDir : afterDir
      for (const width of viewports) {
        const htmlPath = join(phaseDir, r.dirName, `html-${width}`, 'index.html')
        if (!existsSync(htmlPath)) continue
        let content = readFileSync(htmlPath, 'utf-8')
        content = content.replace(/<script data-vr-injected[^>]*>[\s\S]*?<\/script>/g, '')
        content = content.replace(/<style data-vr-capture-only[^>]*>[\s\S]*?<\/style>/g, '')
        const lastBody = content.lastIndexOf('</body>')
        if (lastBody !== -1) content = content.slice(0, lastBody) + highlightScript + content.slice(lastBody)
        writeFileSync(htmlPath, content)
      }
    }
  }
}

// ─── Visual-impact classification ───────────────────────────────────

type ClassifyViewportInput = {
  viewportDiff: ViewportDiffResult
  beforeManifest: DomManifest | null
  afterManifest: DomManifest | null
  beforeLivePngPath: string
  afterLivePngPath: string
}

/**
 * Post-consolidation pass: crop each diff's element bbox from the live before/after
 * PNGs and run pixelmatch. Tags diffs, groups, and cascade clusters with a
 * `visualImpact` verdict so the report UI can demote pixel-identical items
 * into a collapsed "no visual effect" section.
 *
 * Mutates `viewportDiff` in place. Silently skips if PNGs or manifests are
 * missing — the report just won't show the demoted section for those pages.
 */
function classifyViewportVisualImpact(input: ClassifyViewportInput): void {
  const { viewportDiff, beforeManifest, afterManifest, beforeLivePngPath, afterLivePngPath } = input
  if (!beforeManifest || !afterManifest) return
  if (!existsSync(beforeLivePngPath) || !existsSync(afterLivePngPath)) return

  const pairs: Pair[] = []
  for (const d of viewportDiff.diffs) {
    pairs.push({ beforeIdx: d.beforeIdx, afterIdx: d.afterIdx })
  }
  for (const g of viewportDiff.groups) {
    for (const m of g.members) pairs.push({ beforeIdx: m.beforeIdx, afterIdx: m.afterIdx })
  }
  for (const c of viewportDiff.cascadeClusters) {
    for (const m of c.members) pairs.push({ beforeIdx: m.beforeIdx, afterIdx: m.afterIdx })
  }
  if (pairs.length === 0) return

  const impacts = classifyPairs(pairs, {
    beforeManifest,
    afterManifest,
    beforeLivePngPath,
    afterLivePngPath,
  })

  const key = (p: Pair) =>
    p.beforeIdx == null || p.afterIdx == null ? null : `${p.beforeIdx}:${p.afterIdx}`

  for (const d of viewportDiff.diffs) {
    const k = key({ beforeIdx: d.beforeIdx, afterIdx: d.afterIdx })
    if (k) {
      const impact = impacts.get(k)
      if (impact) d.visualImpact = impact
    }
  }

  const classifyGroup = (members: { beforeIdx: number | null; afterIdx: number | null }[]): VisualImpact | null => {
    const memberImpacts: (VisualImpact | null)[] = members.map(m => {
      const k = key(m)
      return k ? impacts.get(k) ?? null : null
    })
    return aggregateImpact(memberImpacts)
  }

  for (const g of viewportDiff.groups) {
    const agg = classifyGroup(g.members)
    if (agg) g.visualImpact = agg
  }
  for (const c of viewportDiff.cascadeClusters) {
    const agg = classifyGroup(c.members)
    if (agg) c.visualImpact = agg
  }

  // Pass 2: upgrade `no-delta` to `same-computed` where we can prove the
  // textual diff resolves to equivalent CSS (font-stack fallback cases,
  // quote/case noise). `same-computed` is a strictly stronger claim than
  // `no-delta` — it says "this diff shouldn't have existed" rather than
  // "this diff had no effect HERE". Cascade clusters are left alone: they
  // track numeric size deltas by definition, not CSS-string equivalence.
  for (const d of viewportDiff.diffs) {
    if (d.visualImpact?.verdict === 'pixel-identical'
      && d.visualImpact.reason === 'no-delta'
      && areChangesSameComputed(d.changes)) {
      d.visualImpact.reason = 'same-computed'
    }
  }
  for (const g of viewportDiff.groups) {
    if (g.visualImpact?.verdict === 'pixel-identical'
      && g.visualImpact.reason === 'no-delta'
      && areChangesSameComputed(g.changes)) {
      g.visualImpact.reason = 'same-computed'
    }
  }

  // Pass 3: promote pixel-identical diffs back to `visual` when a changed
  // property is also set by a rule targeting a tracked interactive pseudo-
  // class on this element. Runs last so it wins over the `same-computed`
  // upgrade — pseudo-state sensitivity is a reason to *show* the diff,
  // whereas `same-computed` is a reason to demote it.
  applyPseudoStateOverridesToViewport(viewportDiff, beforeManifest, afterManifest)

  recomputeVisualStructuralCounts(viewportDiff)
}

/**
 * After visual-impact classification runs, partition the change rollup into
 * `visualChanges` (real pixel diffs) and `structuralChanges` (pixel-identical
 * diffs, demoted by the report UI). Uses the same rollup shape as `totalChanges`:
 * diffs contribute `changes.length`; groups contribute `changes.length × members.length`.
 * Anything without a classified verdict counts toward `visualChanges` — "unknown
 * impact" defaults to visible so we never silently demote unverified diffs.
 */
export function recomputeVisualStructuralCounts(viewportDiff: ViewportDiffResult): void {
  let visual = 0
  let structural = 0
  for (const d of viewportDiff.diffs) {
    const bucket = d.visualImpact?.verdict === 'pixel-identical' ? 'structural' : 'visual'
    if (bucket === 'visual') visual += d.changes.length
    else structural += d.changes.length
  }
  for (const g of viewportDiff.groups) {
    const weight = g.changes.length * g.members.length
    const bucket = g.visualImpact?.verdict === 'pixel-identical' ? 'structural' : 'visual'
    if (bucket === 'visual') visual += weight
    else structural += weight
  }
  viewportDiff.summary.visualChanges = visual
  viewportDiff.summary.structuralChanges = structural
  viewportDiff.summary.totalChanges = visual + structural
}

// ─── Main comparison function ───────────────────────────────────────

/**
 * Compare before/ and after/ capture directories and generate report data.
 *
 * Runs the full match → diff → consolidate → cascade pipeline per viewport,
 * injects highlight scripts into HTML captures, and writes report-data.js.
 */
export function compareDirs(options: ComparePageOptions): CompareResult {
  const { beforeDir, afterDir } = options
  const log = options.log ?? console.log

  // Auto-detect viewports if not specified
  const viewports = options.widths ?? [
    ...new Set([...detectViewports(beforeDir), ...detectViewports(afterDir)]),
  ].sort((a, b) => b - a)

  if (viewports.length === 0) {
    throw new Error('No viewport manifests found in before/ or after/ directories')
  }

  const reportDir = options.reportDir ?? join(beforeDir, '..')

  log('Diffinity — Semantic Diff Comparison')
  log(`Viewports: ${viewports.join(', ')}px`)

  const beforePages = findPageRoleDirs(beforeDir, viewports)
  const afterPages = findPageRoleDirs(afterDir, viewports)

  if (beforePages.length === 0 && afterPages.length === 0) {
    throw new Error('No page directories with dom-manifest files found in before/ or after/')
  }

  const allDirNames = new Set([
    ...beforePages.map(p => p.dirName),
    ...afterPages.map(p => p.dirName),
  ])

  const pageRoleMap = new Map<string, PageRole>()
  for (const p of [...beforePages, ...afterPages]) {
    pageRoleMap.set(p.dirName, p)
  }

  const results: PageRoleResult[] = []

  for (const dirName of allDirNames) {
    const pr = pageRoleMap.get(dirName)!

    const viewportManifests: Record<number, { before: DomManifest | null; after: DomManifest | null }> = {}
    for (const width of viewports) {
      viewportManifests[width] = {
        before: loadManifest(beforeDir, dirName, width),
        after: loadManifest(afterDir, dirName, width),
      }
    }

    const vpDiffs = diffManifestsByViewport(viewportManifests)

    const viewportDiffs: PageRoleResult['viewportDiffs'] = {}
    for (const width of viewports) {
      viewportDiffs[width] = {
        ...vpDiffs[width],
        hasBeforeHtml: existsSync(join(beforeDir, dirName, `html-${width}`, 'index.html')),
        hasAfterHtml: existsSync(join(afterDir, dirName, `html-${width}`, 'index.html')),
      }

      classifyViewportVisualImpact({
        viewportDiff: viewportDiffs[width],
        beforeManifest: viewportManifests[width].before,
        afterManifest: viewportManifests[width].after,
        beforeLivePngPath: join(beforeDir, dirName, `html-${width}`, 'live.png'),
        afterLivePngPath: join(afterDir, dirName, `html-${width}`, 'live.png'),
      })
    }

    results.push({ ...pr, viewportDiffs })

    // Log summary for the primary viewport. Use visualChanges so pixel-identical
    // diffs (demoted in the report UI) don't bump the headline past IDENTICAL.
    const primaryVp = viewports[0]
    const s = viewportDiffs[primaryVp].summary
    const hasBefore = viewportManifests[primaryVp].before
    const hasAfter = viewportManifests[primaryVp].after
    const status = !hasBefore ? 'AFTER ONLY'
      : !hasAfter ? 'BEFORE ONLY'
      : s.visualChanges === 0 ? 'IDENTICAL'
      : s.visualChanges < 5 ? 'MINOR'
      : s.visualChanges < 20 ? 'CHANGED'
      : 'SIGNIFICANT'

    const vpSummaries = viewports.map(w => {
      const vs = viewportDiffs[w].summary
      return `${w}:${vs.visualChanges}`
    }).join(' ')

    log(`  ${dirName}: ${status} (${vpSummaries})`)
  }

  injectHighlightScript(results, beforeDir, afterDir, viewports)

  const reportData = results.map(r => ({
    dirName: r.dirName,
    page: r.page,
    role: r.role,
    viewportDiffs: r.viewportDiffs,
  }))

  const vrData = {
    viewports,
    pages: reportData,
  }

  mkdirSync(reportDir, { recursive: true })

  // The report's iframe src uses hardcoded `before/<page>/html-<width>/index.html`
  // and `after/...` paths (relative to the report's index.html). When beforeDir
  // and afterDir are NOT already at reportDir/before and reportDir/after
  // (e.g. kitchen-sink demo has captures in site/captures/baseline and scenario reports
  // in site/scenarios/<id>), ensure relative symlinks exist so iframes can resolve.
  ensureCaptureLink(reportDir, 'before', beforeDir)
  ensureCaptureLink(reportDir, 'after', afterDir)

  const dataJs = `window.VR_DATA = ${JSON.stringify(vrData)};`
  const dataPath = join(reportDir, 'report-data.js')
  writeFileSync(dataPath, dataJs)

  // Build self-contained report HTML with embedded data
  const reportHtmlPath = join(reportDir, 'index.html')
  const template = getReportTemplate()
  if (template) {
    writeFileSync(reportHtmlPath, buildReportHtml(template, vrData))
    log(`\nReport: ${reportHtmlPath}`)
  } else {
    log(`\nReport data: ${dataPath} (report template not found — run "npm run report:build")`)
  }

  return { pages: results, reportDataPath: dataPath, reportHtmlPath }
}
