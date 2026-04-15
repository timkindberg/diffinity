import { chromium, type Page, type BrowserContext } from 'playwright'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { config } from './config.js'
import { login, blockHmr } from './auth.js'
import { type PageDefinition, type Role } from './types.js'
import { pageRegistry } from './pages/index.js'
import { capturePageHtml, attachResponseCache } from './html-capture.js'
import { captureDomManifest } from './dom-manifest.js'

type Viewport = (typeof config.viewports)[number]

// Known benign patterns — these don't indicate missing mocks or UI issues
const BENIGN_PATTERNS = [
  /did not match.*Server.*Client/i, // React hydration ID mismatch
  /legacyBehavior.*deprecated/i, // Next.js link warning
  /api\/v2\/analytics/i, // Analytics endpoint (not mocked, doesn't affect UI)
  /favicon\.ico/i, // Missing favicon
  /webpack-hmr/i, // HMR websocket (blocked by our helper)
  /\/static\//i, // Static assets (logos, images, fonts)
  /\.(svg|png|jpg|jpeg|gif|woff|woff2|ttf|eot|css|js|map)(\?|$)/i, // Asset file extensions
  /^Failed to load resource:.*404/i, // Generic 404 from static assets (no URL in console text)
  /validateDOMNesting/i, // React DOM nesting warnings from Chakra UI in legacy Django pages
  /React does not recognize the .* prop on a DOM element/i, // Chakra forwarding unknown props to DOM
  /childContextTypes API which is no longer supported/i, // Legacy React context in old Webpack pages
  /contextTypes API which is no longer supported/i, // Legacy React static contextType in old Webpack pages
  /Invalid `id` of undefined supplied to useMsg/i, // Missing l10n key in legacy timesheet app
  /Each child in a list should have a unique "key" prop/i, // React key prop warning in library components
  /pseudo class.*:first-child.*unsafe.*server-side rendering/i, // Chakra/Emotion CSS-in-JS SSR warning
  /pseudo class.*:nth-child.*unsafe.*server-side rendering/i, // Chakra/Emotion CSS-in-JS SSR warning (interviews / design system)
  /Support for defaultProps will be removed from function components/i, // React 18+ warning in third-party libs (e.g. react-markdown)
  /All created TinyMCE editors are configured to be read-only/i, // TinyMCE read-only mode warning (expected when edit=false)
  /Invalid prop `formComponent` supplied to `FormWithConditionals`/i, // rjsf-conditionals PropTypes warning when schema has no properties
  /no window resources after 10 seconds/i, // job_form.html polling script — form still renders static content
  /Expected useImperativeHandle\(\) first argument/i, // jQuery/React interop in legacy Django pages — jQuery refs passed to React hooks
  /kebab-case for css properties/i, // Chakra/Emotion dev warning from invoice line items / design system
  /props object containing a ["']key["'] prop is being spread into JSX/i, // React dev warning when {...props} includes key
  /VndlySimpleTable: prop type.*columns\[0\]\.Cell.*invalid/i, // legacy react-table columns use Footer elements; PropTypes false positive
  /ReactDOM\.unstable_renderSubtreeIntoContainer/i, // legacy webpack SOW bundle on React 18 shared root
]

function isBenign(error: string): boolean {
  return BENIGN_PATTERNS.some((p) => p.test(error))
}

type FailedRequest = { url: string; status: number; method: string }
type DomError = { selector: string; text: string }

type FidelityResult = {
  mismatchCount: number
  mismatchPercent: number
}

type ValidationResult = {
  page: string
  role: string
  width: number
  file: string
  pass: boolean
  consoleErrors: { benign: string[]; actionable: string[] }
  consoleWarnings: string[]
  failedRequests: FailedRequest[]
  domErrors: DomError[]
  warnings: DomError[]
  mockedRoutePatterns: string[]
  interceptedUrls: string[]
  htmlFidelity?: FidelityResult
}

type Manifest = {
  capturedAt: string
  pageId: string
  role: string
  width: number
  mockedRoutePatterns: string[]
  interceptedUrls: string[]
  unmockedUrls: FailedRequest[]
  domErrors: DomError[]
  warnings: DomError[]
  consoleErrors: { benign: number; actionable: string[] }
  consoleWarnings: string[]
}

/**
 * Check the rendered DOM for visible error states and warnings.
 *
 * ERRORS (cause FAIL):
 * - Chakra Alert with status="error" (PageErrorState, SadStates)
 * - role="alert" with error-like text
 * - Visible text matching error message patterns
 *
 * WARNINGS (reported but don't fail):
 * - EmptyState containers (since we mock all data, empty states likely mean
 *   a missing mock — but could be intentional for some widgets)
 */
async function detectDomIssues(page: Page): Promise<{ errors: DomError[]; warnings: DomError[] }> {
  const errors: DomError[] = []
  const warnings: DomError[] = []
  const seen = new Set<string>()

  // --- ERRORS ---

  // 1. Chakra Alert with error status — PageErrorState renders as <Alert status="error">
  for (const el of await page.locator('[data-status="error"]').all()) {
    if (await el.isVisible()) {
      const text = (await el.textContent())?.trim() || ''
      if (text.length > 0 && !seen.has(text)) {
        seen.add(text)
        errors.push({ selector: '[data-status="error"]', text: text.slice(0, 200) })
      }
    }
  }

  // 2. role="alert" with error-like text (not already caught above)
  for (const el of await page.locator('[role="alert"]:not([data-status="error"])').all()) {
    if (await el.isVisible()) {
      const text = (await el.textContent())?.trim() || ''
      if (text.length > 0 && /error|fail|unable|went wrong/i.test(text) && !seen.has(text)) {
        seen.add(text)
        errors.push({ selector: '[role="alert"]', text: text.slice(0, 200) })
      }
    }
  }

  // 3. Error-like text patterns
  const errorTextPatterns = [
    'error processing your request',
    'something went wrong',
    'failed to load',
    'unable to load',
    'please try again later',
  ]

  for (const pattern of errorTextPatterns) {
    for (const el of await page.getByText(pattern, { exact: false }).all()) {
      if (await el.isVisible()) {
        const text = (await el.textContent())?.trim() || ''
        if (text.length > 0 && !seen.has(text)) {
          seen.add(text)
          errors.push({ selector: `text="${pattern}"`, text: text.slice(0, 200) })
        }
      }
    }
  }

  // --- WARNINGS ---

  // 4. EmptyState containers — likely means a missing or bad mock
  for (const el of await page.locator('[data-empty-state-container]').all()) {
    if (await el.isVisible()) {
      const text = (await el.textContent())?.trim() || ''
      if (text.length > 0 && !seen.has(text)) {
        seen.add(text)
        warnings.push({ selector: '[data-empty-state-container]', text: text.slice(0, 200) })
      }
    }
  }

  return { errors, warnings }
}

const VR_INIT_STYLES = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
  body > div[style*="position"][style*="fixed"],
  body > div:has(button[title="Close dev panel"]),
  .ReactQueryDevtools { display: none !important; }
`

const DEFAULT_CONCURRENCY = 2

async function runWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++
      results[i] = await fn(items[i])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

type CaptureOutput = {
  results: ValidationResult[]
  logs: string[]
}

async function verifyHtmlCapture(
  context: BrowserContext,
  liveScreenshot: Buffer,
  htmlPath: string,
  outputDir: string,
  viewport: Viewport,
  log: (msg: string) => void,
  label = 'html',
): Promise<{ match: boolean; mismatchCount: number; mismatchPercent: number }> {
  const verifyPage = await context.newPage()
  try {
    await verifyPage.setViewportSize({ width: viewport.width, height: viewport.height })
    await verifyPage.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 15000 })
    await verifyPage.evaluate(() => document.fonts.ready)
    await verifyPage.waitForTimeout(500)

    const htmlScreenshot = await verifyPage.screenshot({ fullPage: true })

    const liveImg = PNG.sync.read(liveScreenshot)
    const htmlImg = PNG.sync.read(htmlScreenshot)

    // Compare only the overlapping region — height differences from scroll
    // height drift are reported separately, not counted as pixel mismatches.
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
    writeFileSync(join(outputDir, `${label}.png`), PNG.sync.write(htmlImg))

    if (mismatchCount > 0 || heightDiff > 0) {
      writeFileSync(join(outputDir, `diff-${label}.png`), PNG.sync.write(diff))
      const parts = [`${mismatchCount} pixels differ (${mismatchPercent.toFixed(2)}%)`]
      if (heightDiff > 0) parts.push(`height drift: ${liveImg.height} vs ${htmlImg.height} (${heightDiff}px)`)
      log(`  ⚠ ${label} fidelity: ${parts.join(', ')}`)
    } else {
      log(`  ✓ ${label} fidelity: pixel-perfect match`)
    }

    return { match: mismatchCount === 0 && heightDiff === 0, mismatchCount, mismatchPercent }
  } catch (err) {
    log(`  ⚠ ${label} fidelity check failed: ${err instanceof Error ? err.message : err}`)
    return { match: false, mismatchCount: -1, mismatchPercent: -1 }
  } finally {
    await verifyPage.close()
  }
}

/**
 * Capture all viewports for a single page using an already-authenticated context.
 * Opens a fresh tab (clean route handlers), navigates once, resizes for each viewport.
 * Buffers all log output so parallel captures don't interleave.
 */
async function capturePage(
  context: BrowserContext,
  pageDef: PageDefinition,
  role: Role,
  viewports: Viewport[],
  phase: 'before' | 'after',
): Promise<CaptureOutput> {
  const results: ValidationResult[] = []
  const logs: string[] = []
  const log = (msg: string) => logs.push(msg)

  log(`\n  ${pageDef.name} (${viewports.map((v) => `${v.width}px`).join(' → ')})`)

  const page = await context.newPage()
  await blockHmr(page)

  await page.addInitScript((css: string) => {
    const style = document.createElement('style')
    style.setAttribute('data-vr-capture-only', '')
    style.textContent = css
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  }, VR_INIT_STYLES)

  const consoleErrors = { benign: [] as string[], actionable: [] as string[] }
  const consoleWarnings: string[] = []
  const failedRequests: FailedRequest[] = []
  const mockedRoutePatterns: string[] = []
  const interceptedUrls: string[] = []

  page.on('console', (msg) => {
    const text = msg.text()
    if (msg.type() === 'error') {
      if (isBenign(text)) consoleErrors.benign.push(text)
      else consoleErrors.actionable.push(text)
    } else if (msg.type() === 'warning') {
      if (!isBenign(text)) consoleWarnings.push(text)
    }
  })

  page.on('response', (response) => {
    const status = response.status()
    const url = response.url()
    if (status >= 400 && !isBenign(url)) {
      failedRequests.push({ url: url.replace(config.baseUrl, ''), status, method: response.request().method() })
    }
  })

  // Cache font/image/css responses during page load for HTML capture
  const responseCache = attachResponseCache(page)

  const originalRoute = page.route.bind(page)
  page.route = (async (url: string | RegExp, handler: (route: import('playwright').Route) => void | Promise<void>, options?: { times?: number }) => {
    mockedRoutePatterns.push(String(url))
    return originalRoute(url, (route: import('playwright').Route) => {
      interceptedUrls.push(route.request().url().replace(config.baseUrl, ''))
      return handler(route)
    }, options)
  }) as typeof page.route

  await pageDef.setup(page, role)

  const url = `${config.baseUrl}${pageDef.path}`
  log(`  Navigating to ${url}...`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

  if (pageDef.waitForReady) {
    await pageDef.waitForReady(page)
  } else {
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      log(`  Warning: networkidle timeout, proceeding anyway`)
    }
    await page.waitForTimeout(1000)
  }

  // Wait for the DOM to stabilize (no mutations for 1s) before capturing.
  // React async renders, lazy icon loading, etc. can change the DOM after networkidle.
  await page.evaluate('new Promise(function(resolve) {' +
    'var timer;' +
    'var obs = new MutationObserver(function() { clearTimeout(timer); timer = setTimeout(done, 1000); });' +
    'function done() { obs.disconnect(); resolve(); }' +
    'obs.observe(document.body, { childList: true, subtree: true, attributes: true });' +
    'timer = setTimeout(done, 1000);' +
    '})')

  const domIssues = await detectDomIssues(page)

  // Freeze the page: stop all JS timers, animations, and React updates
  // so the page state doesn't drift between the live screenshot and HTML serialization.
  await page.evaluate('(() => {' +
    'for (var i = 1; i < 100000; i++) { clearTimeout(i); clearInterval(i); }' +
    'window.setTimeout = window.setInterval = function() { return 0; };' +
    'window.requestAnimationFrame = window.requestIdleCallback = function() { return 0; };' +
    '})()'
  )

  const pageDir = join(config.screenshotDir, phase, `${pageDef.id}--${role}`)
  const sharedAssetsDir = join(config.screenshotDir, phase, '_assets')
  mkdirSync(pageDir, { recursive: true })
  mkdirSync(sharedAssetsDir, { recursive: true })

  for (let i = 0; i < viewports.length; i++) {
    const viewport = viewports[i]

    if (i > 0) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.waitForTimeout(500)
    }

    // Screenshot the live page before any DOM instrumentation
    const liveScreenshot = await page.screenshot({ fullPage: true })

    // DOM manifest — tags elements with data-vr-idx so HTML capture preserves them
    try {
      const domManifest = await captureDomManifest(page, log)
      writeFileSync(join(pageDir, `dom-manifest-${viewport.width}.json`), JSON.stringify(domManifest))
    } catch (err) {
      log(`  DOM manifest (${viewport.width}) failed: ${err instanceof Error ? err.message : err}`)
    }

    // HTML capture — data-vr-idx attributes from manifest step are included
    const htmlDir = join(pageDir, `html-${viewport.width}`)
    mkdirSync(htmlDir, { recursive: true })
    let htmlFidelity: ValidationResult['htmlFidelity']
    try {
      const htmlStats = await capturePageHtml(page, responseCache, htmlDir, sharedAssetsDir, log)
      log(`  HTML ${viewport.width}px (${htmlStats.assetsExtracted} assets, ${(htmlStats.sizeBytes / 1024).toFixed(0)}KB)`)

      // Verify captured HTML against the live screenshot
      const htmlPath = join(htmlDir, 'index.html')
      const fidelityResult = await verifyHtmlCapture(context, liveScreenshot, htmlPath, htmlDir, viewport, log)
      htmlFidelity = { mismatchCount: fidelityResult.mismatchCount, mismatchPercent: fidelityResult.mismatchPercent }
    } catch (err) {
      log(`  HTML capture (${viewport.width}) failed: ${err instanceof Error ? err.message : err}`)
    }

    const result: ValidationResult = {
      page: pageDef.id,
      role,
      width: viewport.width,
      file: join(pageDir, `dom-manifest-${viewport.width}.json`),
      pass: true,
      consoleErrors,
      consoleWarnings,
      failedRequests,
      domErrors: domIssues.errors,
      warnings: domIssues.warnings,
      mockedRoutePatterns,
      interceptedUrls,
      htmlFidelity,
    }

    result.pass = consoleErrors.actionable.length === 0 && failedRequests.length === 0 && domIssues.errors.length === 0

    const manifest: Manifest = {
      capturedAt: new Date().toISOString(),
      pageId: pageDef.id,
      role,
      width: viewport.width,
      mockedRoutePatterns,
      interceptedUrls: [...new Set(interceptedUrls)].sort(),
      unmockedUrls: failedRequests,
      domErrors: domIssues.errors,
      warnings: domIssues.warnings,
      consoleErrors: { benign: consoleErrors.benign.length, actionable: consoleErrors.actionable },
      consoleWarnings,
    }
    writeFileSync(join(pageDir, `${viewport.width}.manifest.json`), JSON.stringify(manifest, null, 2))

    const status = result.pass ? '✓' : '✗'
    log(`  ${status} ${viewport.width}px`)

    results.push(result)
  }

  if (failedRequests.length > 0) {
    log(`  UNMOCKED APIs (${failedRequests.length}):`)
    for (const req of failedRequests) log(`    ${req.method} ${req.url} → ${req.status}`)
  }
  if (domIssues.errors.length > 0) {
    log(`  DOM ERRORS (${domIssues.errors.length}):`)
    for (const err of domIssues.errors) log(`    [${err.selector}] ${err.text}`)
  }
  if (consoleErrors.actionable.length > 0) {
    log(`  CONSOLE ERRORS (${consoleErrors.actionable.length}):`)
    for (const err of consoleErrors.actionable.slice(0, 5)) log(`    - ${err.slice(0, 200)}`)
    if (consoleErrors.actionable.length > 5) log(`    ... and ${consoleErrors.actionable.length - 5} more`)
  }
  if (domIssues.warnings.length > 0) {
    log(`  WARNINGS (${domIssues.warnings.length}):`)
    for (const w of domIssues.warnings) log(`    [${w.selector}] ${w.text}`)
  }
  if (consoleErrors.benign.length > 0) {
    log(`  (${consoleErrors.benign.length} benign console errors suppressed)`)
  }

  await page.close()
  return { results, logs }
}

function parseArgs() {
  const args = process.argv.slice(2)
  const getArg = (flag: string) => args.includes(flag) ? args[args.indexOf(flag) + 1] : null
  return {
    pageFilter: getArg('--page'),
    widthFilter: getArg('--width') ? parseInt(getArg('--width')!, 10) : null,
    phase: (getArg('--phase') || config.phase) as 'before' | 'after',
    concurrency: getArg('--concurrency') ? parseInt(getArg('--concurrency')!, 10) : DEFAULT_CONCURRENCY,
  }
}

async function main() {
  const { pageFilter, widthFilter, phase, concurrency } = parseArgs()

  let pages: PageDefinition[]
  if (pageFilter) {
    const match = pageRegistry.find((p) => p.id === pageFilter)
    if (!match) {
      console.error(`Unknown page: ${pageFilter}`)
      console.error(`Available: ${pageRegistry.map((p) => p.id).join(', ')}`)
      process.exit(1)
    }
    pages = [match]
  } else {
    pages = pageRegistry
  }

  let viewports = config.viewports
  if (widthFilter) {
    const match = viewports.find((v) => v.width === widthFilter)
    if (!match) {
      console.error(`Unknown width: ${widthFilter}`)
      console.error(`Available: ${viewports.map((v) => `${v.width} (${v.label})`).join(', ')}`)
      process.exit(1)
    }
    viewports = [match]
  }

  // Clean the phase output folder on full runs to prevent stale data from
  // removed/renamed pages. Skip when using --page for single-page retries.
  if (!pageFilter) {
    const phaseDir = join(config.screenshotDir, phase)
    rmSync(phaseDir, { recursive: true, force: true })
  }

  console.log(`\nVisual Regression Capture (phase: ${phase}, concurrency: ${concurrency})`)
  console.log(`Base URL: ${config.baseUrl}`)
  console.log(`Pages to capture: ${pages.length}`)
  console.log(`Viewports: ${viewports.map((v) => `${v.width}px`).join(', ')}`)
  console.log(`---`)

  const roleGroups = new Map<Role, PageDefinition[]>()
  for (const pageDef of pages) {
    for (const role of pageDef.roles) {
      if (!roleGroups.has(role)) roleGroups.set(role, [])
      roleGroups.get(role)!.push(pageDef)
    }
  }

  const results: ValidationResult[] = []

  for (const [role, pagesForRole] of roleGroups) {
    const username = config.users[role]
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`Logging in as ${username} (${role}) — ${pagesForRole.length} pages, ${concurrency} at a time`)
    console.log(`${'─'.repeat(60)}`)

    let browser = await chromium.launch({ headless: true })
    let context = await browser.newContext({
      viewport: { width: viewports[0].width, height: viewports[0].height },
      ignoreHTTPSErrors: true,
    })
    await login(context, username)

    async function restartBrowser() {
      try { await browser.close() } catch {}
      console.log('  ⟳ Browser crashed — restarting and re-authenticating...')
      browser = await chromium.launch({ headless: true })
      context = await browser.newContext({
        viewport: { width: viewports[0].width, height: viewports[0].height },
        ignoreHTTPSErrors: true,
      })
      await login(context, username)
    }

    function makeCrashResult(pageDef: PageDefinition, msg: string): CaptureOutput {
      const crashResults: ValidationResult[] = viewports.map((viewport) => ({
        page: pageDef.id,
        role,
        width: viewport.width,
        file: '',
        pass: false,
        consoleErrors: { benign: [], actionable: [msg] },
        consoleWarnings: [],
        failedRequests: [],
        domErrors: [],
        warnings: [],
        mockedRoutePatterns: [],
        interceptedUrls: [],
      }))
      return { results: crashResults, logs: [`\n  ${pageDef.name}`, `  CRASHED: ${msg}`] }
    }

    const outputs = await runWithConcurrency(pagesForRole, concurrency, async (pageDef): Promise<CaptureOutput> => {
      try {
        return await capturePage(context, pageDef, role, viewports, phase)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isBrowserDead = msg.includes('Target page, context or browser has been closed')
          || msg.includes('Browser has been closed')
        if (isBrowserDead) {
          await restartBrowser()
          try {
            return await capturePage(context, pageDef, role, viewports, phase)
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr)
            return makeCrashResult(pageDef, retryMsg)
          }
        }
        return makeCrashResult(pageDef, msg)
      }
    })

    for (const output of outputs) {
      for (const line of output.logs) console.log(line)
      results.push(...output.results)
    }

    await browser.close()
  }

  // Summary
  const passed = results.filter((r) => r.pass)
  const failed = results.filter((r) => !r.pass)
  const warned = results.filter((r) => r.pass && r.warnings.length > 0)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`RESULTS: ${passed.length} passed, ${failed.length} failed, ${warned.length} with warnings (${results.length} total)`)
  console.log(`${'='.repeat(60)}`)

  if (failed.length > 0) {
    console.log(`\nFAILED CAPTURES:`)
    for (const f of failed) {
      console.log(`\n  ${f.page} (${f.role}, ${f.width}px):`)
      if (f.failedRequests.length > 0) {
        console.log(`    Unmocked APIs:`)
        for (const req of f.failedRequests) console.log(`      ${req.method} ${req.url} → ${req.status}`)
      }
      if (f.domErrors.length > 0) {
        console.log(`    DOM errors:`)
        for (const err of f.domErrors) console.log(`      ${err.text.slice(0, 100)}`)
      }
      if (f.consoleErrors.actionable.length > 0) {
        console.log(`    Console errors: ${f.consoleErrors.actionable.length}`)
      }
    }
  }

  if (warned.length > 0) {
    console.log(`\nWARNINGS (passed but worth reviewing):`)
    for (const w of warned) {
      console.log(`  ${w.page} (${w.role}, ${w.width}px):`)
      for (const warn of w.warnings) console.log(`    ${warn.text.slice(0, 100)}`)
    }
  }

  const imperfect = results.filter((r) => r.htmlFidelity && r.htmlFidelity.mismatchCount > 0)
  const perfect = results.filter((r) => r.htmlFidelity && r.htmlFidelity.mismatchCount === 0)
  if (imperfect.length > 0) {
    console.log(`\nHTML FIDELITY (${perfect.length} pixel-perfect, ${imperfect.length} with diffs):`)
    const sorted = [...imperfect].sort((a, b) => (b.htmlFidelity!.mismatchPercent - a.htmlFidelity!.mismatchPercent))
    for (const r of sorted) {
      const f = r.htmlFidelity!
      console.log(`  ${r.page}--${r.role}: ${f.mismatchPercent.toFixed(2)}% (${f.mismatchCount}px)`)
    }
  } else if (perfect.length > 0) {
    console.log(`\nHTML FIDELITY: all ${perfect.length} pages pixel-perfect ✓`)
  }

  // Write machine-readable results
  const reportDir = join(config.screenshotDir, phase)
  mkdirSync(reportDir, { recursive: true })
  const reportPath = join(reportDir, '_validation.json')
  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(`\nValidation report: ${reportPath}`)

  // Exit with error if any captures failed
  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
