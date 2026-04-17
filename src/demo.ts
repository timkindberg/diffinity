#!/usr/bin/env npx tsx
/**
 * Demo runner — generates a visual report from all shared test fixtures.
 *
 * Usage: npm run demo
 *
 * Launches Playwright, runs the full capture→compare pipeline on every fixture,
 * and outputs a single multi-page report at demo/index.html.
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { captureDomManifest } from './dom-manifest.js'
import { matchManifests } from './match.js'
import { diffManifests, consolidateDiffs } from './diff.js'
import { buildCascadeClusters } from './cascade-cluster.js'
import { sections } from './__tests__/fixtures/index.js'
import type { DomManifest } from './dom-manifest.js'
import type { ReportData, PageData, ViewportDiffData } from './report/types.js'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

const DEMO_DIR = join(_dirname, '..', 'demo')
const VIEWPORT_WIDTH = 1440
const VIEWPORT_HEIGHT = 900

const noop = () => {}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getReportTemplate(): string | null {
  const paths = [
    join(_dirname, '..', 'dist', 'report', 'index.html'),
    join(_dirname, 'report', 'index.html'),
  ]
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p, 'utf-8')
  }
  return null
}

function buildReportHtml(template: string, vrData: object): string {
  const dataScript = `<script>window.VR_DATA = ${JSON.stringify(vrData)};</script>`
  const firstScript = template.indexOf('<script>')
  if (firstScript !== -1) {
    return template.slice(0, firstScript) + dataScript + '\n    ' + template.slice(firstScript)
  }
  return template.replace('</head>', dataScript + '\n  </head>')
}

async function main() {
  console.log('Diffinity Demo — generating report from test fixtures\n')

  // Ensure report template is built
  const template = getReportTemplate()
  if (!template) {
    console.error('Report template not found. Run "npm run build" first.')
    process.exit(1)
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT } })

  async function captureHtml(html: string): Promise<DomManifest> {
    await page.setContent(html, { waitUntil: 'load' })
    return captureDomManifest(page, noop)
  }

  const pages: PageData[] = []
  let totalCases = 0
  let totalDiffs = 0

  for (const section of sections) {
    const sectionSlug = slugify(section.name)

    for (const testCase of section.cases) {
      const caseSlug = slugify(testCase.name)
      const dirName = `${sectionSlug}--${caseSlug}`

      process.stdout.write(`  ${section.name} / ${testCase.name}...`)

      const before = await captureHtml(testCase.before)
      const after = await captureHtml(testCase.after)

      const match = matchManifests(before, after)
      const raw = diffManifests(before, after, match)
      const consolidated = consolidateDiffs(raw, before, after)
      const cascade = buildCascadeClusters(
        consolidated.groups,
        consolidated.diffs,
        before,
        after,
      )

      const vpData: ViewportDiffData = {
        diffs: cascade.remainingDiffs,
        groups: cascade.remainingGroups,
        cascadeClusters: cascade.clusters,
        summary: consolidated.summary,
        hasBeforeHtml: false,
        hasAfterHtml: false,
      }

      const changeSummary = consolidated.summary.totalChanges
      console.log(` ${changeSummary} change${changeSummary !== 1 ? 's' : ''}`)

      pages.push({
        dirName,
        page: section.name,
        role: testCase.name,
        viewportDiffs: { [VIEWPORT_WIDTH]: vpData },
      })

      totalCases++
      totalDiffs += consolidated.summary.totalChanges
    }
  }

  await browser.close()

  // Build report
  mkdirSync(DEMO_DIR, { recursive: true })

  const vrData: ReportData = {
    viewports: [VIEWPORT_WIDTH],
    pages,
  }

  const reportHtml = buildReportHtml(template, vrData)
  const reportPath = join(DEMO_DIR, 'index.html')
  writeFileSync(reportPath, reportHtml)

  console.log(`\n${totalCases} cases, ${totalDiffs} total changes`)
  console.log(`Report: ${reportPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
