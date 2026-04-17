/**
 * Basic diffinity example — capture before/after states and compare.
 *
 * Usage:
 *   npx tsx examples/basic.ts
 *
 * Prerequisites:
 *   npm install diffinity
 *   npx playwright install chromium
 */
import { chromium } from 'playwright'
import { capture, compare } from 'diffinity'

const OUTPUT_DIR = './vr-output'
const TARGET_URL = 'https://example.com'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  // ─── Capture "before" ──────────────────────────────────────────
  console.log('Capturing before state...')
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' })
  await capture(page, {
    outputDir: OUTPUT_DIR,
    label: 'before',
    pageId: 'home',
  })

  // ─── Make a change ─────────────────────────────────────────────
  // In a real workflow, you'd deploy a new version, toggle a feature flag,
  // or switch branches here. For this example, we mutate the page directly.
  await page.evaluate(() => {
    document.querySelector('h1')!.textContent = 'Example Domain (modified)'
    document.querySelector('p')!.style.color = 'red'
  })

  // ─── Capture "after" ──────────────────────────────────────────
  console.log('Capturing after state...')
  await capture(page, {
    outputDir: OUTPUT_DIR,
    label: 'after',
    pageId: 'home',
  })

  await browser.close()

  // ─── Compare and generate report ──────────────────────────────
  console.log('Comparing...')
  await compare(`${OUTPUT_DIR}/before`, `${OUTPUT_DIR}/after`, {
    reportDir: OUTPUT_DIR,
  })

  console.log(`\nDone! Open ${OUTPUT_DIR}/index.html to view the report.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
