/**
 * Regression tests for html-capture's handling of form control state.
 *
 * React/Preact (and direct DOM APIs) commonly set `value`, `checked`, `selected`,
 * and `open` as DOM properties rather than HTML attributes. A naive serializer
 * that iterates `el.attributes` would miss them, causing the reconstructed HTML
 * to render without those initial values/states and drift from the live page.
 *
 * Driven by vr-ekg: Settings page fidelity drift (837 px) caused by missing
 * value= on text inputs and checked="" on checkboxes/radios.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { capturePageHtml } from '../html-capture.js'

let browser: Browser
let context: BrowserContext
let page: Page

beforeAll(async () => {
  browser = await chromium.launch({ args: ['--disable-web-security'] })
  context = await browser.newContext({ viewport: { width: 800, height: 600 } })
  page = await context.newPage()
})

afterAll(async () => { await browser?.close() })

const noop = () => {}

/** Capture the page as reconstruction HTML and extract the serialized JSON DOM. */
async function captureAndExtractJson(): Promise<any[]> {
  const dir = mkdtempSync(join(tmpdir(), 'html-capture-test-'))
  try {
    const htmlDir = join(dir, 'html')
    const assetsDir = join(dir, 'assets')
    await capturePageHtml(page, new Map(), htmlDir, assetsDir, noop)
    const html = readFileSync(join(htmlDir, 'index.html'), 'utf8')
    const m = html.match(/var bc=(\[.+?\]);\nfunction b/s)
    if (!m) throw new Error('could not extract bodyChildren JSON from reconstruction HTML')
    // Un-escape the `<\/` → `</` that escapeForScript applies for <script> safety
    return JSON.parse(m[1].replace(/<\\\//g, '</'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Walk captured body JSON and collect the first node matching a tag filter. */
function findAll(nodes: any[], pred: (n: any) => boolean): any[] {
  const out: any[] = []
  function walk(n: any) {
    if (n?.t === 1 && pred(n)) out.push(n)
    if (n?.c) for (const c of n.c) walk(c)
  }
  for (const n of nodes) walk(n)
  return out
}

describe('html-capture form control state', () => {
  it('captures .value set via DOM property on text/email/number inputs', async () => {
    await page.setContent(`<!doctype html><html><body>
      <input id="t" type="text">
      <input id="e" type="email">
      <input id="n" type="number">
      <input id="r" type="range" min="0" max="10">
    </body></html>`, { waitUntil: 'load' })

    // Set via property, not attribute — this is what Preact/React do
    await page.evaluate(() => {
      ;(document.getElementById('t') as HTMLInputElement).value = 'hello'
      ;(document.getElementById('e') as HTMLInputElement).value = 'a@b.co'
      ;(document.getElementById('n') as HTMLInputElement).value = '42'
      ;(document.getElementById('r') as HTMLInputElement).value = '7'
    })

    const body = await captureAndExtractJson()
    const inputs = findAll(body, (n) => n.n === 'input')
    const byId = (id: string) => inputs.find((n) => n.a?.id === id)

    expect(byId('t')?.a?.value).toBe('hello')
    expect(byId('e')?.a?.value).toBe('a@b.co')
    expect(byId('n')?.a?.value).toBe('42')
    expect(byId('r')?.a?.value).toBe('7')
  })

  it('captures checked state on checkbox/radio set via DOM property', async () => {
    await page.setContent(`<!doctype html><html><body>
      <input id="cb1" type="checkbox">
      <input id="cb2" type="checkbox">
      <input id="rd1" type="radio" name="g">
      <input id="rd2" type="radio" name="g">
    </body></html>`, { waitUntil: 'load' })

    await page.evaluate(() => {
      ;(document.getElementById('cb1') as HTMLInputElement).checked = true
      ;(document.getElementById('rd2') as HTMLInputElement).checked = true
    })

    const body = await captureAndExtractJson()
    const inputs = findAll(body, (n) => n.n === 'input')
    const byId = (id: string) => inputs.find((n) => n.a?.id === id)

    expect(byId('cb1')?.a?.checked).toBe('')
    expect(byId('cb2')?.a?.checked).toBeUndefined()
    expect(byId('rd1')?.a?.checked).toBeUndefined()
    expect(byId('rd2')?.a?.checked).toBe('')
  })

  it('captures textarea .value as child text', async () => {
    await page.setContent(`<!doctype html><html><body>
      <textarea id="ta"></textarea>
    </body></html>`, { waitUntil: 'load' })

    await page.evaluate(() => {
      ;(document.getElementById('ta') as HTMLTextAreaElement).value = 'line one\nline two'
    })

    const body = await captureAndExtractJson()
    const ta = findAll(body, (n) => n.n === 'textarea')[0]
    expect(ta?.c?.[0]).toEqual({ t: 3, v: 'line one\nline two' })
  })

  it('captures <option selected> when select.value is set via property', async () => {
    await page.setContent(`<!doctype html><html><body>
      <select id="s">
        <option value="a">A</option>
        <option value="b">B</option>
        <option value="c">C</option>
      </select>
    </body></html>`, { waitUntil: 'load' })

    await page.evaluate(() => {
      ;(document.getElementById('s') as HTMLSelectElement).value = 'b'
    })

    const body = await captureAndExtractJson()
    const opts = findAll(body, (n) => n.n === 'option')
    expect(opts.map((o) => ({ v: o.a?.value, sel: o.a?.selected }))).toEqual([
      { v: 'a', sel: undefined },
      { v: 'b', sel: '' },
      { v: 'c', sel: undefined },
    ])
  })

  it('captures <details open> when toggled via property', async () => {
    await page.setContent(`<!doctype html><html><body>
      <details id="d"><summary>x</summary>hidden</details>
    </body></html>`, { waitUntil: 'load' })

    await page.evaluate(() => {
      ;(document.getElementById('d') as HTMLDetailsElement).open = true
    })

    const body = await captureAndExtractJson()
    const det = findAll(body, (n) => n.n === 'details')[0]
    expect(det?.a?.open).toBe('')
  })

  it('does not emit checked="" on unchecked inputs that had no prior attribute', async () => {
    await page.setContent(`<!doctype html><html><body>
      <input id="cb" type="checkbox" checked>
    </body></html>`, { waitUntil: 'load' })

    // Uncheck via property after HTML attribute said checked — the current
    // DOM state should win.
    await page.evaluate(() => {
      ;(document.getElementById('cb') as HTMLInputElement).checked = false
    })

    const body = await captureAndExtractJson()
    const cb = findAll(body, (n) => n.n === 'input')[0]
    expect(cb?.a?.checked).toBeUndefined()
  })
})
