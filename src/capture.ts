/**
 * Core capture engine — stability wait, JS freeze, DOM manifest, HTML capture,
 * and fidelity verification. Consumer owns browser launch, auth, navigation,
 * and "page is ready" determination.
 */
import { type Page, type BrowserContext } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { capturePageHtml, attachResponseCache, type ResponseCache } from './html-capture.js'
import { captureDomManifest } from './dom-manifest.js'

export type CapturePageOptions = {
  /** Directory to write capture output for this page */
  pageDir: string
  /** Shared assets directory (content-hashed, deduped across pages) */
  sharedAssetsDir: string
  /** Viewport widths to capture (default: [1280]) */
  widths?: number[]
  /** Log function (default: console.log) */
  log?: (msg: string) => void
}

export type FidelityResult = {
  mismatchCount: number
  mismatchPercent: number
}

export type CaptureViewportResult = {
  width: number
  domManifestPath: string | null
  htmlDir: string | null
  fidelity: FidelityResult | null
}

export type CapturePageResult = {
  pageDir: string
  viewports: CaptureViewportResult[]
}

/**
 * Wait for the DOM to stabilize — no mutations for 1 second.
 * Handles React async renders, lazy icon loading, etc.
 */
async function waitForDomStability(page: Page): Promise<void> {
  await page.evaluate('new Promise(function(resolve) {' +
    'var timer;' +
    'var obs = new MutationObserver(function() { clearTimeout(timer); timer = setTimeout(done, 1000); });' +
    'function done() { obs.disconnect(); resolve(); }' +
    'obs.observe(document.body, { childList: true, subtree: true, attributes: true });' +
    'timer = setTimeout(done, 1000);' +
    '})')
}

/**
 * Freeze the page: stop all JS timers, animations, and React updates
 * so the page state doesn't drift between the live screenshot and HTML serialization.
 */
async function freezePage(page: Page): Promise<void> {
  await page.evaluate('(() => {' +
    'for (var i = 1; i < 100000; i++) { clearTimeout(i); clearInterval(i); }' +
    'window.setTimeout = window.setInterval = function() { return 0; };' +
    'window.requestAnimationFrame = window.requestIdleCallback = function() { return 0; };' +
    '})()'
  )
}

/**
 * Verify that captured HTML renders pixel-identically to the live page.
 */
async function verifyHtmlCapture(
  context: BrowserContext,
  liveScreenshot: Buffer,
  htmlPath: string,
  outputDir: string,
  viewportWidth: number,
  viewportHeight: number,
  log: (msg: string) => void,
): Promise<FidelityResult> {
  const verifyPage = await context.newPage()
  try {
    await verifyPage.setViewportSize({ width: viewportWidth, height: viewportHeight })
    await verifyPage.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 15000 })
    await verifyPage.evaluate(() => document.fonts.ready)
    await verifyPage.waitForTimeout(500)

    const htmlScreenshot = await verifyPage.screenshot({ fullPage: true })

    const liveImg = PNG.sync.read(liveScreenshot)
    const htmlImg = PNG.sync.read(htmlScreenshot)

    const width = Math.min(liveImg.width, htmlImg.width)
    const height = Math.min(liveImg.height, htmlImg.height)
    const heightDiff = Math.abs(liveImg.height - htmlImg.height)

    const cropToSize = (img: InstanceType<typeof PNG>): InstanceType<typeof PNG> => {
      if (img.width === width && img.height === height) return img
      const cropped = new PNG({ width, height })
      PNG.bitblt(img, cropped, 0, 0, width, height, 0, 0)
      return cropped
    }
    const live = cropToSize(liveImg)
    const html = cropToSize(htmlImg)

    const diff = new PNG({ width, height })
    const mismatchCount = pixelmatch(live.data, html.data, diff.data, width, height, { threshold: 0.1 })
    const totalPixels = width * height
    const mismatchPercent = (mismatchCount / totalPixels) * 100

    writeFileSync(join(outputDir, 'live.png'), PNG.sync.write(liveImg))
    writeFileSync(join(outputDir, 'html.png'), PNG.sync.write(htmlImg))

    if (mismatchCount > 0 || heightDiff > 0) {
      writeFileSync(join(outputDir, 'diff-html.png'), PNG.sync.write(diff))
      const parts = [`${mismatchCount} pixels differ (${mismatchPercent.toFixed(2)}%)`]
      if (heightDiff > 0) parts.push(`height drift: ${liveImg.height} vs ${htmlImg.height} (${heightDiff}px)`)
      log(`  ⚠ fidelity: ${parts.join(', ')}`)
    } else {
      log(`  ✓ fidelity: pixel-perfect match`)
    }

    return { mismatchCount, mismatchPercent }
  } catch (err) {
    log(`  ⚠ fidelity check failed: ${err instanceof Error ? err.message : err}`)
    return { mismatchCount: -1, mismatchPercent: -1 }
  } finally {
    await verifyPage.close()
  }
}

const DEFAULT_WIDTHS = [1280]
const DEFAULT_HEIGHT = 900

/**
 * Capture a DOM manifest and self-contained HTML snapshot from a Playwright page.
 *
 * The consumer owns browser launch, authentication, navigation, and "page is ready"
 * determination. This function receives a ready Page object and:
 * 1. Waits for DOM stability (MutationObserver — no mutations for 1s)
 * 2. Freezes the page (stops timers, animations, RAF)
 * 3. Captures DOM manifest (computed styles, bbox, accessible names via CDP)
 * 4. Captures self-contained HTML (inlined resources, JSON DOM reconstruction)
 * 5. Verifies fidelity (pixel-compares captured HTML vs live page)
 */
export async function capturePage(
  page: Page,
  options: CapturePageOptions,
): Promise<CapturePageResult> {
  const { pageDir, sharedAssetsDir, widths = DEFAULT_WIDTHS } = options
  const log = options.log ?? console.log

  mkdirSync(pageDir, { recursive: true })
  mkdirSync(sharedAssetsDir, { recursive: true })

  // Cache font/image/css responses during page load for HTML capture
  const responseCache = attachResponseCache(page)

  // Wait for the DOM to stabilize
  await waitForDomStability(page)

  // Freeze the page so state doesn't drift between screenshots and serialization
  await freezePage(page)

  const context = page.context()
  const viewportResults: CaptureViewportResult[] = []

  for (let i = 0; i < widths.length; i++) {
    const width = widths[i]

    if (i > 0) {
      await page.setViewportSize({ width, height: DEFAULT_HEIGHT })
      await page.waitForTimeout(500)
    }

    // Screenshot the live page before any DOM instrumentation
    const liveScreenshot = await page.screenshot({ fullPage: true })

    const result: CaptureViewportResult = {
      width,
      domManifestPath: null,
      htmlDir: null,
      fidelity: null,
    }

    // DOM manifest — tags elements with data-vr-idx so HTML capture preserves them
    try {
      const domManifest = await captureDomManifest(page, log)
      const manifestPath = join(pageDir, `dom-manifest-${width}.json`)
      writeFileSync(manifestPath, JSON.stringify(domManifest))
      result.domManifestPath = manifestPath
    } catch (err) {
      log(`  DOM manifest (${width}) failed: ${err instanceof Error ? err.message : err}`)
    }

    // HTML capture — data-vr-idx attributes from manifest step are included
    const htmlDir = join(pageDir, `html-${width}`)
    mkdirSync(htmlDir, { recursive: true })
    try {
      const htmlStats = await capturePageHtml(page, responseCache, htmlDir, sharedAssetsDir, log)
      result.htmlDir = htmlDir
      log(`  HTML ${width}px (${htmlStats.assetsExtracted} assets, ${(htmlStats.sizeBytes / 1024).toFixed(0)}KB)`)

      // Verify captured HTML against the live screenshot
      const htmlPath = join(htmlDir, 'index.html')
      const viewport = page.viewportSize() ?? { width, height: DEFAULT_HEIGHT }
      const fidelity = await verifyHtmlCapture(
        context, liveScreenshot, htmlPath, htmlDir,
        viewport.width, viewport.height, log,
      )
      result.fidelity = fidelity
    } catch (err) {
      log(`  HTML capture (${width}) failed: ${err instanceof Error ? err.message : err}`)
    }

    // Write viewport manifest metadata
    const manifestMeta = {
      capturedAt: new Date().toISOString(),
      width,
      htmlFidelity: result.fidelity,
    }
    writeFileSync(join(pageDir, `${width}.manifest.json`), JSON.stringify(manifestMeta, null, 2))

    viewportResults.push(result)
  }

  return { pageDir, viewports: viewportResults }
}

// Re-export for consumers who want to set up response caching before navigation
export { attachResponseCache, type ResponseCache }
