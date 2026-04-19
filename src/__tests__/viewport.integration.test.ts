import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORT_URL = 'file://' + join(__dirname, '../../dist/report/index.html')

const MOCK_PAGE = {
  dirName: 'home--admin',
  page: 'home',
  role: 'admin',
  viewportDiffs: {
    1440: {
      diffs: [],
      groups: [],
      cascadeClusters: [],
      summary: {
        changed: 0, added: 0, removed: 0, moved: 0, unchanged: 5,
        totalChanges: 0, groupCount: 0, groupedElementCount: 0,
      },
      hasBeforeHtml: true,
      hasAfterHtml: true,
    },
  },
}

const MOCK_DATA = {
  viewports: [1440, 768, 375],
  pages: [MOCK_PAGE],
}

let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await chromium.launch({ args: ['--disable-web-security'] })
})

afterAll(async () => {
  await browser?.close()
})

/** Click a viewport button and wait for the Preact re-render + rAF to apply */
async function clickViewport(p: Page, vp: string) {
  await p.evaluate((v) => {
    const btn = document.querySelector(`.vp-btn[data-vp="${v}"]`) as HTMLElement
    btn.click()
  }, vp)
  await p.waitForFunction((v) => {
    const iframe = document.querySelector('#pane-before .iframe-wrap iframe') as HTMLIFrameElement | null
    return iframe?.style.width === `${v}px`
  }, vp)
}

describe('Viewport selector', () => {
  beforeEach(async () => {
    page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
    await page.addInitScript({ content: `window.VR_DATA = ${JSON.stringify(MOCK_DATA)}` })
    await page.goto(REPORT_URL, { waitUntil: 'load' })
  })

  afterEach(async () => {
    await page?.close()
  })

  async function getIframeStyles() {
    return page.$$eval('#html-panes iframe', iframes =>
      iframes.map(el => ({
        phase: el.getAttribute('data-phase'),
        width: (el as HTMLElement).style.width,
        zoom: (el as HTMLElement).style.zoom,
      })),
    )
  }

  it('shows 1440 as the active viewport by default', async () => {
    const buttons = await page.$$eval('#viewport-selector .mode-btn', els =>
      els.map(el => ({ text: el.textContent?.trim(), active: el.classList.contains('active') })),
    )

    expect(buttons).toHaveLength(3)
    expect(buttons.map(b => b.text)).toEqual(['V1440', '768', '375'])

    const active = buttons.find(b => b.active)
    expect(active).toBeDefined()
    expect(active!.text).toContain('1440')
  })

  it('sets iframe width to 768px when 768 viewport is clicked', async () => {
    await clickViewport(page, '768')

    const activeText = await page.$eval('#viewport-selector .vp-btn.active', el => el.getAttribute('data-vp'))
    expect(activeText).toBe('768')

    const styles = await getIframeStyles()
    expect(styles.length).toBeGreaterThan(0)
    for (const s of styles) {
      expect(s.width).toBe('768px')
    }
  })

  it('cycles viewports 1440→768→375→1440 when pressing V', async () => {
    async function activeVp() {
      return page.$eval('#viewport-selector .vp-btn.active', el => el.getAttribute('data-vp'))
    }

    expect(await activeVp()).toBe('1440')

    await page.keyboard.press('v')
    expect(await activeVp()).toBe('768')

    await page.keyboard.press('v')
    expect(await activeVp()).toBe('375')

    await page.keyboard.press('v')
    expect(await activeVp()).toBe('1440')
  })

  it('uses zoom=1 when the pane is wider than the target viewport', async () => {
    // Switch to single-pane mode so the pane is ~600px wide (wider than 375)
    await page.keyboard.press('2')
    await clickViewport(page, '375')

    const styles = await getIframeStyles()
    const before = styles.find(s => s.phase === 'before')!
    expect(before.width).toBe('375px')
    expect(before.zoom).toBe('1')
  })

  it('scales down when the target viewport exceeds the pane width', async () => {
    // Default is split mode + 1440 viewport. Each pane is ~300px, so zoom = ~300/1440 < 1
    // Wait for the ResizeObserver + rAF to apply viewport zoom
    await page.waitForFunction(() => {
      const iframe = document.querySelector('#pane-before .iframe-wrap iframe') as HTMLIFrameElement | null
      return iframe?.style.width === '1440px'
    })
    const result = await page.evaluate(() => {
      const wrap = document.querySelector('#pane-before .iframe-wrap')!
      const iframe = wrap.querySelector('iframe')!
      return {
        paneWidth: wrap.clientWidth,
        iframeWidth: iframe.style.width,
        zoom: parseFloat(iframe.style.zoom),
      }
    })

    expect(result.iframeWidth).toBe('1440px')
    expect(result.zoom).toBeLessThan(1)
    expect(result.zoom).toBeGreaterThan(0)

    const expectedZoom = result.paneWidth / 1440
    expect(result.zoom).toBeCloseTo(expectedZoom, 4)
  })

  it('applies the same viewport width to both before and after iframes', async () => {
    // Switch to 768 in split mode
    await clickViewport(page, '768')

    const styles = await getIframeStyles()
    const before = styles.find(s => s.phase === 'before')
    const after = styles.find(s => s.phase === 'after')

    expect(before).toBeDefined()
    expect(after).toBeDefined()
    expect(before!.width).toBe('768px')
    expect(after!.width).toBe('768px')
    expect(before!.width).toBe(after!.width)
  })

  it('shows V viewport hint in the footer', async () => {
    const footerText = await page.$eval('#app-footer', el => el.textContent)

    expect(footerText).toContain('V')
    expect(footerText).toContain('viewport')
  })

  it('sets iframe height to fill the pane (height / zoom)', async () => {
    await page.waitForFunction(() => {
      const iframe = document.querySelector('#pane-before .iframe-wrap iframe') as HTMLIFrameElement | null
      return iframe?.style.height && parseFloat(iframe.style.height) > 0
    })
    const result = await page.evaluate(() => {
      const wrap = document.querySelector('#pane-before .iframe-wrap')!
      const iframe = wrap.querySelector('iframe')!
      return {
        containerHeight: wrap.clientHeight,
        iframeHeight: parseFloat(iframe.style.height),
        zoom: parseFloat(iframe.style.zoom),
      }
    })

    expect(result.iframeHeight).toBeGreaterThan(0)
    expect(result.containerHeight).toBeGreaterThan(0)
    const expectedHeight = result.containerHeight / result.zoom
    expect(result.iframeHeight).toBeCloseTo(expectedHeight, 0)
  })

  it('recalculates zoom when the browser window is resized', async () => {
    // Wait for ResizeObserver to apply initial zoom
    await page.waitForFunction(() => {
      const iframe = document.querySelector('#pane-before .iframe-wrap iframe') as HTMLIFrameElement | null
      return iframe?.style.zoom && parseFloat(iframe.style.zoom) > 0
    })
    // Capture zoom at 1200px wide
    const zoomBefore = await page.evaluate(() => {
      const iframe = document.querySelector('#pane-before .iframe-wrap iframe') as HTMLIFrameElement
      return parseFloat(iframe.style.zoom)
    })

    // Widen the window — panes get wider, zoom should increase
    await page.setViewportSize({ width: 1800, height: 800 })
    // ResizeObserver is async — give it a frame
    await page.waitForTimeout(100)

    const zoomAfter = await page.evaluate(() => {
      const iframe = document.querySelector('#pane-before .iframe-wrap iframe') as HTMLIFrameElement
      return parseFloat(iframe.style.zoom)
    })

    expect(zoomAfter).toBeGreaterThan(zoomBefore)
  })

  it('always shows hardcoded zoom viewports regardless of data viewports', async () => {
    const customPage = await browser.newPage({ viewport: { width: 1200, height: 800 } })
    const customData = {
      viewports: [1920],
      pages: [MOCK_PAGE],
    }
    await customPage.addInitScript({ content: `window.VR_DATA = ${JSON.stringify(customData)}` })
    await customPage.goto(REPORT_URL, { waitUntil: 'load' })

    const buttons = await customPage.$$eval('#viewport-selector .vp-btn', els =>
      els.map(el => el.getAttribute('data-vp')),
    )
    expect(buttons).toEqual(['1440', '768', '375'])

    await customPage.close()
  })
})

// =====================================================================
// Per-Viewport Diffs
// =====================================================================

const MOCK_DIFF_DESKTOP = {
  type: 'changed', label: 'desktop-nav', importance: 'major', score: 80,
  beforeIdx: 0, afterIdx: 0, selector: 'nav', changes: [
    { property: 'background-color', category: 'color', before: '#111', after: '#222' },
  ],
}

const MOCK_DIFF_TABLET = {
  type: 'added', label: 'tablet-banner', importance: 'critical', score: 100,
  beforeIdx: null, afterIdx: 1, selector: '.banner', changes: [],
}

const MOCK_VIEWPORT_PAGE = {
  dirName: 'home--admin',
  page: 'home',
  role: 'admin',
  viewportDiffs: {
    1440: {
      diffs: [MOCK_DIFF_DESKTOP],
      groups: [],
      cascadeClusters: [],
      summary: { changed: 1, added: 0, removed: 0, moved: 0, unchanged: 5, totalChanges: 1, groupCount: 0, groupedElementCount: 0 },
      timeMs: 50,
      hasBeforeHtml: true,
      hasAfterHtml: true,
    },
    768: {
      diffs: [MOCK_DIFF_TABLET],
      groups: [],
      cascadeClusters: [],
      summary: { changed: 0, added: 1, removed: 0, moved: 0, unchanged: 5, totalChanges: 1, groupCount: 0, groupedElementCount: 0 },
      timeMs: 40,
      hasBeforeHtml: true,
      hasAfterHtml: true,
    },
    375: {
      diffs: [],
      groups: [],
      cascadeClusters: [],
      summary: { changed: 0, added: 0, removed: 0, moved: 0, unchanged: 5, totalChanges: 0, groupCount: 0, groupedElementCount: 0 },
      timeMs: 30,
      hasBeforeHtml: true,
      hasAfterHtml: true,
    },
  },
}

const MOCK_VIEWPORT_DATA = {
  viewports: [1440, 768, 375],
  pages: [MOCK_VIEWPORT_PAGE],
}

describe('Per-viewport diffs', () => {
  let vpPage: Page

  beforeEach(async () => {
    vpPage = await browser.newPage({ viewport: { width: 1200, height: 800 } })
    await vpPage.addInitScript({ content: `window.VR_DATA = ${JSON.stringify(MOCK_VIEWPORT_DATA)}` })
    await vpPage.goto(REPORT_URL, { waitUntil: 'load' })
  })

  afterEach(async () => {
    await vpPage?.close()
  })

  it('shows diff panel content from the active viewport', async () => {
    // Default viewport is 1440 — should show the desktop diff
    const labels1440 = await vpPage.$$eval('.el-diff .el-diff-label', els =>
      els.map(el => el.textContent?.trim()),
    )
    expect(labels1440).toContain('desktop-nav')
    expect(labels1440).not.toContain('tablet-banner')

    // Switch to 768
    await clickViewport(vpPage, '768')

    const labels768 = await vpPage.$$eval('.el-diff .el-diff-label', els =>
      els.map(el => el.textContent?.trim()),
    )
    expect(labels768).toContain('tablet-banner')
    expect(labels768).not.toContain('desktop-nav')
  })

  it('shows change count badges on viewport buttons', async () => {
    const badges = await vpPage.$$eval('#viewport-selector .vp-btn', els =>
      els.map(el => ({
        vp: el.getAttribute('data-vp'),
        badge: el.querySelector('.vp-badge')?.textContent?.trim() ?? null,
      })),
    )

    const b1440 = badges.find(b => b.vp === '1440')
    const b768 = badges.find(b => b.vp === '768')
    const b375 = badges.find(b => b.vp === '375')

    expect(b1440?.badge).toBe('1')
    expect(b768?.badge).toBe('1')
    expect(b375?.badge).toBeNull()
  })

  it('keeps iframe src on data viewport when zoom viewport changes', async () => {
    // At 1440 (default), iframe src should use html-1440/
    const src1440 = await vpPage.$$eval('#html-panes iframe', iframes =>
      iframes.map(el => el.getAttribute('src')),
    )
    expect(src1440.length).toBeGreaterThan(0)
    for (const src of src1440) {
      expect(src).toContain('html-1440')
    }

    // Switch zoom to 768 — iframe src should still point to html-1440/
    await clickViewport(vpPage, '768')

    const srcAfterZoom = await vpPage.$$eval('#html-panes iframe', iframes =>
      iframes.map(el => el.getAttribute('src')),
    )
    expect(srcAfterZoom.length).toBeGreaterThan(0)
    for (const src of srcAfterZoom) {
      expect(src).toContain('html-1440')
    }
  })
})
