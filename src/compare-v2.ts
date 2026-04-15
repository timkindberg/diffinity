/**
 * Semantic visual diff comparison between before/ and after/ capture directories.
 * Loads per-viewport DOM manifests, runs element matching + semantic diffing
 * independently per viewport, outputs report data.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs'
import { join } from 'path'
import { diffManifestsByViewport, type ViewportDiffResult } from './viewport-diff.js'
import type { DomManifest } from './dom-manifest.js'

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
    }

    results.push({ ...pr, viewportDiffs })

    // Log summary for the primary viewport
    const primaryVp = viewports[0]
    const s = viewportDiffs[primaryVp].summary
    const hasBefore = viewportManifests[primaryVp].before
    const hasAfter = viewportManifests[primaryVp].after
    const status = !hasBefore ? 'AFTER ONLY'
      : !hasAfter ? 'BEFORE ONLY'
      : s.totalChanges === 0 ? 'IDENTICAL'
      : s.totalChanges < 5 ? 'MINOR'
      : s.totalChanges < 20 ? 'CHANGED'
      : 'SIGNIFICANT'

    const vpSummaries = viewports.map(w => {
      const vs = viewportDiffs[w].summary
      return `${w}:${vs.totalChanges}`
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
  const dataJs = `window.VR_DATA = ${JSON.stringify(vrData)};`
  const dataPath = join(reportDir, 'report-data.js')
  writeFileSync(dataPath, dataJs)
  log(`\nReport data: ${dataPath}`)

  return { pages: results, reportDataPath: dataPath }
}
