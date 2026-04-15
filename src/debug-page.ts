/**
 * Open a single VR page in a headed browser with all mocks active.
 *
 * Usage:
 *   npx tsx src/debug-page.ts <page-id> [role]
 *
 * Examples:
 *   npx tsx src/debug-page.ts sow
 *   npx tsx src/debug-page.ts contractor-detail employer
 *   npx tsx src/debug-page.ts vendor-candidate-detail vendor
 *
 * The browser stays open until you close it or press Ctrl+C.
 */

import { chromium } from 'playwright'
import { config } from './config.js'
import { login, blockHmr } from './auth.js'
import { type Role } from './types.js'
import { pageRegistry } from './pages/index.js'

const pageId = process.argv[2]
const roleArg = process.argv[3] as Role | undefined

if (!pageId) {
  console.error('Usage: npx tsx src/debug-page.ts <page-id> [role]')
  console.error(`\nAvailable pages:\n  ${pageRegistry.map((p) => p.id).join('\n  ')}`)
  process.exit(1)
}

const pageDef = pageRegistry.find((p) => p.id === pageId)
if (!pageDef) {
  console.error(`Unknown page: ${pageId}`)
  console.error(`Available: ${pageRegistry.map((p) => p.id).join(', ')}`)
  process.exit(1)
}

const role: Role = roleArg ?? pageDef.roles[0]
if (!pageDef.roles.includes(role)) {
  console.error(`Page "${pageId}" doesn't support role "${role}". Available: ${pageDef.roles.join(', ')}`)
  process.exit(1)
}

const username = config.users[role]

async function main() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  })

  console.log(`Logging in as ${username} (${role})...`)
  await login(context, username)

  const page = await context.newPage()
  await blockHmr(page)

  // Freeze animations
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })

  // Set up all the page's API mocks
  await pageDef.setup(page, role)

  const url = `${config.baseUrl}${pageDef.path}`
  console.log(`Navigating to ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

  if (pageDef.waitForReady) {
    await pageDef.waitForReady(page)
  } else {
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      console.log('Warning: networkidle timeout, proceeding anyway')
    }
    await page.waitForTimeout(1000)
  }

  console.log(`\n✓ Page "${pageDef.name}" is open. Browser stays open until you close it or Ctrl+C.\n`)

  // Keep the process alive until browser closes
  await new Promise<void>((resolve) => {
    browser.on('disconnected', resolve)
  })
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
