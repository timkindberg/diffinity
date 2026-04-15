/**
 * Semantic visual diff comparison between before/ and after/ captures.
 * Loads per-viewport DOM manifests, runs element matching + semantic diffing
 * independently per viewport, outputs report-data.js to screenshots/.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import { diffManifestsByViewport, type ViewportDiffResult } from './viewport-diff.js'
import type { DomManifest } from './dom-manifest.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const screenshotDir = config.screenshotDir
const beforeDir = join(screenshotDir, 'before')
const afterDir = join(screenshotDir, 'after')
const VIEWPORTS = config.viewports.map(v => v.width)

type PageRole = {
  dirName: string
  page: string
  role: string
}

type PageRoleResult = PageRole & {
  viewportDiffs: Record<number, ViewportDiffResult & { hasBeforeHtml: boolean, hasAfterHtml: boolean }>
}

function findPageRoleDirs(phaseDir: string): PageRole[] {
  if (!existsSync(phaseDir)) return []
  const results: PageRole[] = []
  for (const entry of readdirSync(phaseDir)) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue
    const fullPath = join(phaseDir, entry)
    if (!statSync(fullPath).isDirectory()) continue
    const hasManifest = VIEWPORTS.some(w => existsSync(join(fullPath, `dom-manifest-${w}.json`)))
    if (!hasManifest) continue

    const dashIdx = entry.lastIndexOf('--')
    const page = dashIdx !== -1 ? entry.slice(0, dashIdx) : entry
    const role = dashIdx !== -1 ? entry.slice(dashIdx + 2) : 'unknown'
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

const HIGHLIGHT_SCRIPT_SRC = readFileSync(join(__dirname, 'report', 'highlight-listener.js'), 'utf-8')
const HIGHLIGHT_SCRIPT = `<script data-vr-injected>\n${HIGHLIGHT_SCRIPT_SRC}\n</script>`

function injectHighlightScript(results: PageRoleResult[]) {
  for (const r of results) {
    for (const phase of ['before', 'after'] as const) {
      for (const width of VIEWPORTS) {
        const htmlPath = join(screenshotDir, phase, r.dirName, `html-${width}`, 'index.html')
        if (!existsSync(htmlPath)) continue
        let content = readFileSync(htmlPath, 'utf-8')
        content = content.replace(/<script data-vr-injected[^>]*>[\s\S]*?<\/script>/g, '')
        content = content.replace(/<style data-vr-capture-only[^>]*>[\s\S]*?<\/style>/g, '')
        content = content.replace(/\s*\*,\s*\*::before,\s*\*::after\s*\{[^}]*transition-duration:\s*0s\s*!important[^}]*\}\s*body\s*>\s*div\[style\*="position"\]\[style\*="fixed"\],\s*div:has\(>\s*\[aria-label\*="React Hook Form"\]\)\s*\{[^}]*\}/g, '')
        const lastBody = content.lastIndexOf('</body>')
        if (lastBody !== -1) content = content.slice(0, lastBody) + HIGHLIGHT_SCRIPT + content.slice(lastBody)
        writeFileSync(htmlPath, content)
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────

function main() {
  console.log('Visual Regression v2 — Semantic Diff Report')
  console.log('============================================\n')

  const beforePages = findPageRoleDirs(beforeDir)
  const afterPages = findPageRoleDirs(afterDir)

  if (beforePages.length === 0 && afterPages.length === 0) {
    console.error('No page directories with per-viewport dom-manifest files found in before/ or after/')
    process.exit(1)
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

    const viewportManifests: Record<number, { before: DomManifest | null, after: DomManifest | null }> = {}
    for (const width of VIEWPORTS) {
      viewportManifests[width] = {
        before: loadManifest(beforeDir, dirName, width),
        after: loadManifest(afterDir, dirName, width),
      }
    }

    const vpDiffs = diffManifestsByViewport(viewportManifests)

    const viewportDiffs: PageRoleResult['viewportDiffs'] = {}
    for (const width of VIEWPORTS) {
      viewportDiffs[width] = {
        ...vpDiffs[width],
        hasBeforeHtml: existsSync(join(beforeDir, dirName, `html-${width}`, 'index.html')),
        hasAfterHtml: existsSync(join(afterDir, dirName, `html-${width}`, 'index.html')),
      }
    }

    results.push({ ...pr, viewportDiffs })

    // Log summary for the primary viewport
    const primaryVp = VIEWPORTS[0]
    const s = viewportDiffs[primaryVp].summary
    const hasBefore = viewportManifests[primaryVp].before
    const hasAfter = viewportManifests[primaryVp].after
    const status = !hasBefore ? 'AFTER ONLY'
      : !hasAfter ? 'BEFORE ONLY'
      : s.totalChanges === 0 ? 'IDENTICAL'
      : s.totalChanges < 5 ? 'MINOR'
      : s.totalChanges < 20 ? 'CHANGED'
      : 'SIGNIFICANT'

    const vpSummaries = VIEWPORTS.map(w => {
      const vs = viewportDiffs[w].summary
      return `${w}:${vs.totalChanges}`
    }).join(' ')

    console.log(`  ${dirName}: ${status} (${vpSummaries})`)
  }

  injectHighlightScript(results)

  const reportData = results.map(r => ({
    dirName: r.dirName,
    page: r.page,
    role: r.role,
    viewportDiffs: r.viewportDiffs,
  }))

  const vrData = {
    viewports: VIEWPORTS,
    pages: reportData,
  }
  const dataJs = `window.VR_DATA = ${JSON.stringify(vrData)};`
  const dataPath = join(screenshotDir, 'report-data.js')
  writeFileSync(dataPath, dataJs)
  console.log(`\nData: ${dataPath}`)

  console.log(`Report: ${join(screenshotDir, 'report_v2.html')}`)
}

main()
