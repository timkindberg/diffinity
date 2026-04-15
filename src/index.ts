import type { Page } from 'playwright'

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
}

export interface CompareOptions {
  /** Directory to write the report output */
  reportDir?: string
}

/**
 * Capture a DOM manifest and self-contained HTML snapshot from a Playwright page.
 *
 * The consumer owns browser launch, authentication, navigation, and "page is ready"
 * determination. Diffinity receives a ready Page object and captures it.
 */
export async function capture(page: Page, options: CaptureOptions): Promise<CaptureResult> {
  // Phase 2 will implement: dom-manifest capture + html-capture + stability wait + JS freeze
  throw new Error('capture() not yet implemented — see Phase 2')
}

/**
 * Compare two captures and generate an interactive HTML report.
 *
 * Reads snapshot directories from disk, runs the match → diff → consolidate → cascade
 * pipeline, and writes a self-contained HTML report.
 */
export async function compare(before: string, after: string, options?: CompareOptions): Promise<void> {
  // Phase 2 will implement: match + diff + consolidate + cascade + report generation
  throw new Error('compare() not yet implemented — see Phase 2')
}
