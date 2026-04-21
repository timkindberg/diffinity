import type { Page } from 'playwright'
import { join } from 'path'
import { capturePage, attachResponseCache } from './capture.js'
import { compareDirs } from './compare-v2.js'

export interface CaptureOptions {
  /** Directory to write capture output */
  outputDir: string
  /** Label for this capture (e.g. 'before', 'after') */
  label: string
  /** Unique page identifier (used in directory names) */
  pageId: string
  /** Viewport widths to capture (default: [1280]) */
  widths?: number[]
}

export interface CaptureResult {
  /** Path to the capture output directory */
  outputDir: string
  /** Label used for this capture */
  label: string
  /** Page identifier */
  pageId: string
  /** Widths that were captured */
  widths: number[]
  /** Path to the page's capture directory */
  pageDir: string
}

export interface CompareOptions {
  /** Directory to write the report output */
  reportDir?: string
  /** Viewport widths to compare (default: auto-detected from manifests) */
  widths?: number[]
}

/**
 * Capture a DOM manifest and self-contained HTML snapshot from a Playwright page.
 *
 * The consumer owns browser launch, authentication, navigation, and "page is ready"
 * determination. Diffinity receives a ready Page object and captures it.
 *
 * Output structure:
 *   <outputDir>/<label>/<pageId>/
 *     dom-manifest-<width>.json
 *     html-<width>/index.html
 *     <width>.manifest.json
 *   <outputDir>/<label>/_assets/
 *     (shared content-hashed assets)
 */
export async function capture(page: Page, options: CaptureOptions): Promise<CaptureResult> {
  const { outputDir, label, pageId, widths = [1280] } = options
  const pageDir = join(outputDir, label, pageId)
  const sharedAssetsDir = join(outputDir, label, '_assets')

  await capturePage(page, {
    pageDir,
    sharedAssetsDir,
    widths,
  })

  return {
    outputDir,
    label,
    pageId,
    widths,
    pageDir,
  }
}

/**
 * Compare two captures and generate an interactive HTML report.
 *
 * Reads snapshot directories from disk, runs the match → diff → consolidate → cascade
 * pipeline, and writes report data for the HTML report.
 *
 * @param before - Path to the 'before' capture directory (e.g. './vr/before')
 * @param after - Path to the 'after' capture directory (e.g. './vr/after')
 */
export async function compare(before: string, after: string, options?: CompareOptions): Promise<void> {
  compareDirs({
    beforeDir: before,
    afterDir: after,
    reportDir: options?.reportDir,
    widths: options?.widths,
  })
}

// Re-export engine internals for advanced usage
export { capturePage, attachResponseCache } from './capture.js'
export { compareDirs } from './compare-v2.js'
export { captureDomManifest } from './dom-manifest.js'
export { capturePageHtml } from './html-capture.js'
export { matchManifests } from './match.js'
export { diffManifests, consolidateDiffs } from './diff.js'
export { buildCascadeClusters } from './cascade-cluster.js'
export { diffManifestsByViewport } from './viewport-diff.js'
export { classifyElementPair, classifyPairs, aggregateImpact } from './visual-impact.js'

// Re-export types consumers may need
export type { CapturePageOptions, CapturePageResult, CaptureViewportResult, FidelityResult } from './capture.js'
export type { ComparePageOptions, CompareResult } from './compare-v2.js'
export type { DomManifest, ElementNode } from './dom-manifest.js'
export type { ResponseCache } from './html-capture.js'
export type { MatchResult, MatchedPair } from './match.js'
export type { DiffResult, ElementDiff, DiffGroup, Change, ChangeCategory, ImportanceLevel } from './diff.js'
export type { CascadeCluster, CascadeRootCause } from './cascade-cluster.js'
export type { ViewportDiffResult } from './viewport-diff.js'
export type { VisualImpact, VisualImpactVerdict, VisualImpactReason, ClassifyOptions, ClassifyContext, Pair } from './visual-impact.js'
