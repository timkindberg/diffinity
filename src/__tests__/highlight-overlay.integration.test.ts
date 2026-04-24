import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LISTENER_SRC = readFileSync(join(__dirname, '../report/highlight-listener.js'), 'utf-8')

/**
 * Build an HTML document that loads the highlight-listener script and renders a
 * button with known padding. The button is the "iframe contents" from the
 * report UI's perspective — the listener attaches to its document and responds
 * to postMessages as if sent by the report parent frame.
 */
function testDoc(extraHtml = ''): string {
  return `<!doctype html>
<html><head><style>
  body { margin: 0; padding: 100px; background: #fff; font-family: sans-serif; }
  .btn { padding: 20px 30px; border-radius: 4px; background: #eee; border: 0; display: inline-block; }
</style></head><body>
  <button class="btn" data-vr-idx="5">Jobs</button>
  <button class="btn" data-vr-idx="9" style="margin-left:40px">People</button>
  ${extraHtml}
  <script>${LISTENER_SRC}</script>
</body></html>`
}

let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser?.close()
})

beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  await page.setContent(testDoc(), { waitUntil: 'load' })
})

afterEach(async () => {
  await page?.close()
})

function postHighlight(p: Page, msg: Record<string, unknown>) {
  return p.evaluate((m) => window.postMessage({ source: 'vr-report', ...m }, '*'), msg)
}

async function visibleBoxOverlays(p: Page) {
  return p.$$eval('#vr-hl-stage .vr-box-overlay', (els) =>
    els
      .filter((el) => (el as HTMLElement).style.display === 'block')
      .map((el) => {
        const s = (el as HTMLElement).style
        return {
          left: parseFloat(s.left),
          top: parseFloat(s.top),
          width: parseFloat(s.width),
          height: parseFloat(s.height),
          background: s.background,
        }
      }),
  )
}

describe('highlight-listener — padding overlays', () => {
  it('highlight action draws 4 padding overlays when padding-* props changed', async () => {
    await postHighlight(page, {
      action: 'highlight',
      idx: 5,
      type: 'changed',
      changedProps: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
      phase: 'before',
    })

    const overlays = await visibleBoxOverlays(page)
    expect(overlays).toHaveLength(4)
    // All overlays use the padding green color
    for (const o of overlays) {
      expect(o.background).toContain('147, 196, 125')
    }
  })

  it('highlight action draws all 4 padding overlays when `padding` shorthand is the changed prop', async () => {
    // Mirrors what the new collapsed quad produces for non-uniform padding.
    await postHighlight(page, {
      action: 'highlight',
      idx: 5,
      type: 'changed',
      changedProps: ['padding'],
      phase: 'before',
    })

    const overlays = await visibleBoxOverlays(page)
    expect(overlays).toHaveLength(4)
  })

  it('highlight-multi (group hover) draws padding overlays on EVERY member', async () => {
    // Regression test for the VNDLY-reported bug: group hover silently dropped
    // changedProps so the padding overlay never rendered.
    await postHighlight(page, {
      action: 'highlight-multi',
      indices: [5, 9],
      type: 'changed',
      changedProps: ['padding'],
      phase: 'before',
    })

    const overlays = await visibleBoxOverlays(page)
    // 4 sides × 2 members = 8 overlays
    expect(overlays).toHaveLength(8)
    for (const o of overlays) {
      expect(o.background).toContain('147, 196, 125')
    }
  })

  it('highlight-multi draws nothing for padding when changedProps is absent', async () => {
    await postHighlight(page, {
      action: 'highlight-multi',
      indices: [5, 9],
      type: 'changed',
      phase: 'before',
    })

    const overlays = await visibleBoxOverlays(page)
    expect(overlays).toHaveLength(0)
  })

  it('highlight-multi with non-box-model changedProps does not draw box overlays', async () => {
    await postHighlight(page, {
      action: 'highlight-multi',
      indices: [5, 9],
      type: 'changed',
      changedProps: ['background-color'],
      phase: 'before',
    })

    const overlays = await visibleBoxOverlays(page)
    expect(overlays).toHaveLength(0)
  })

  it('padding overlays are positioned at the element edges (sanity check sizes)', async () => {
    // The .btn has padding:20px 30px; so top/bottom should be 20px tall
    // and left/right should be 30px wide.
    await postHighlight(page, {
      action: 'highlight',
      idx: 5,
      type: 'changed',
      changedProps: ['padding'],
      phase: 'before',
    })

    const overlays = await visibleBoxOverlays(page)
    expect(overlays).toHaveLength(4)

    // Two overlays with height ≈ 20 (top + bottom bands)
    const bands20 = overlays.filter((o) => Math.round(o.height) === 20)
    expect(bands20).toHaveLength(2)

    // Two overlays with width ≈ 30 (left + right bands)
    const bands30 = overlays.filter((o) => Math.round(o.width) === 30)
    expect(bands30).toHaveLength(2)
  })
})

describe('highlight-listener — clear', () => {
  it('clear action hides all box overlays', async () => {
    await postHighlight(page, {
      action: 'highlight-multi',
      indices: [5, 9],
      type: 'changed',
      changedProps: ['padding'],
      phase: 'before',
    })
    expect((await visibleBoxOverlays(page)).length).toBeGreaterThan(0)

    await postHighlight(page, { action: 'clear' })

    expect(await visibleBoxOverlays(page)).toHaveLength(0)
  })
})
