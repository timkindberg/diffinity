#!/usr/bin/env npx tsx
/**
 * Kitchen-sink demo runner — captures the "Helix Ops Console" site
 * (demo-app/, built via build:demo-app) across 3 pages, applies 3 CSS
 * mutation scenarios, and generates a diffinity report per scenario.
 *
 * Output:
 *   site/
 *     app/              (from build:demo-app)
 *     captures/
 *       baseline/<page>/
 *       targeted/<page>/
 *       refactor/<page>/
 *       theme/<page>/
 *     scenarios/
 *       targeted/index.html
 *       refactor/index.html
 *       theme/index.html
 *
 * Usage: npm run demo
 */
import { chromium, type Page, type BrowserContext } from 'playwright'
import { readFileSync, existsSync } from 'fs'
import { createServer, type Server } from 'http'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { capture, compare } from './index.js'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

const REPO_ROOT = join(_dirname, '..')
const SITE_DIR = join(REPO_ROOT, 'site')
const APP_DIR = join(SITE_DIR, 'app')
const CAPTURES_DIR = join(SITE_DIR, 'captures')
const SCENARIOS_DIR = join(SITE_DIR, 'scenarios')
const SCENARIO_CSS_DIR = join(REPO_ROOT, 'demo-app', 'src', 'scenarios')

const VIEWPORT_WIDTH = 1440
const VIEWPORT_HEIGHT = 900

type PageDef = { id: string; hash: string; title: string }
const PAGES: PageDef[] = [
  { id: 'dashboard', hash: '#/',         title: 'Dashboard' },
  { id: 'table',     hash: '#/table',    title: 'Customers' },
  { id: 'settings',  hash: '#/settings', title: 'Settings' },
]

type Scenario = {
  id: 'targeted' | 'refactor' | 'theme'
  label: string
  cssFile: string
  /** Optional DOM patches applied before capture (for non-CSS-only mutations). */
  patch?: (page: Page) => Promise<void>
}

const SCENARIOS: Scenario[] = [
  {
    id: 'targeted',
    label: 'Button redesign (targeted)',
    cssFile: 'targeted.css',
  },
  {
    id: 'refactor',
    label: 'Sidebar flex → grid (refactor)',
    cssFile: 'refactor.css',
  },
  {
    id: 'theme',
    label: 'Full rebrand (theme)',
    cssFile: 'theme.css',
    patch: async (page) => {
      await page.evaluate(() => {
        const brandText = document.querySelector('.nav-brand span:last-child')
        if (brandText) brandText.textContent = 'Northwind Pro'
        const mark = document.querySelector('.nav-brand-mark')
        if (mark) mark.textContent = 'N'
        document.title = 'Northwind Pro — Admin'
      })
    },
  },
]

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico':  'image/x-icon',
  '.map':  'application/json',
}

/**
 * Minimal static server for the built site/app/. Hash-routed SPA, so
 * any URL without an extension falls back to index.html.
 */
function startStaticServer(rootDir: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0])
        let filePath = join(rootDir, urlPath)
        if (urlPath === '/' || !extname(urlPath)) {
          filePath = join(rootDir, 'index.html')
        }
        if (!existsSync(filePath)) {
          res.statusCode = 404
          res.end('not found')
          return
        }
        const ext = extname(filePath).toLowerCase()
        res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-store')
        res.end(readFileSync(filePath))
      } catch (err) {
        res.statusCode = 500
        res.end(String(err))
      }
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        resolve({ server, url: `http://127.0.0.1:${addr.port}` })
      } else {
        reject(new Error('could not determine server address'))
      }
    })
  })
}

async function capturePage_(
  context: BrowserContext,
  baseUrl: string,
  p: PageDef,
  phase: string,
  scenario?: Scenario,
  scenarioCss?: string,
): Promise<void> {
  // Fresh page per capture: diffinity's capture() freezes timers on the page,
  // so reusing a page across captures breaks the next DOM-stability wait.
  const page = await context.newPage()
  try {
    await page.goto(`${baseUrl}/${p.hash}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(150) // let Preact mount
    if (scenarioCss) {
      await page.addStyleTag({ content: scenarioCss })
    }
    if (scenario?.patch) {
      await scenario.patch(page)
    }
    await page.waitForTimeout(100) // let styles/patches settle

    await capture(page, {
      outputDir: CAPTURES_DIR,
      label: phase,
      pageId: p.id,
      widths: [VIEWPORT_WIDTH],
    })
  } finally {
    await page.close()
  }
}

async function capturePhase(
  context: BrowserContext,
  baseUrl: string,
  phase: string,
  scenario?: Scenario,
): Promise<void> {
  const scenarioCss = scenario
    ? readFileSync(join(SCENARIO_CSS_DIR, scenario.cssFile), 'utf-8')
    : undefined

  for (const p of PAGES) {
    process.stdout.write(`  ${phase} · ${p.title}... `)
    await capturePage_(context, baseUrl, p, phase, scenario, scenarioCss)
    console.log('✓')
  }
}

async function main(): Promise<void> {
  console.log('Diffinity Kitchen-Sink Demo\n')

  if (!existsSync(join(APP_DIR, 'index.html'))) {
    console.error(`No built site at ${APP_DIR}. Run "npm run build:demo-app" first.`)
    process.exit(1)
  }

  const { server, url } = await startStaticServer(APP_DIR)
  console.log(`Serving ${APP_DIR} at ${url}\n`)

  const browser = await chromium.launch({ args: ['--disable-web-security'] })
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
  })

  try {
    console.log('[1/4] Capturing baseline...')
    await capturePhase(context, url, 'baseline')

    for (let i = 0; i < SCENARIOS.length; i++) {
      const s = SCENARIOS[i]
      console.log(`\n[${i + 2}/4] Capturing scenario: ${s.label}`)
      await capturePhase(context, url, s.id, s)
    }
  } finally {
    await context.close()
    await browser.close()
    server.close()
  }

  console.log('\n─── Generating reports ───────────────────────────────')
  for (const s of SCENARIOS) {
    console.log(`\n▸ ${s.label}`)
    await compare(
      join(CAPTURES_DIR, 'baseline'),
      join(CAPTURES_DIR, s.id),
      { reportDir: join(SCENARIOS_DIR, s.id) },
    )
  }

  console.log('\n─── Done ─────────────────────────────────────────────')
  for (const s of SCENARIOS) {
    console.log(`  ${s.id}: ${join(SCENARIOS_DIR, s.id, 'index.html')}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
