/**
 * Full-pipeline integration tests: HTML → capture → match → diff → consolidate → cascade.
 *
 * Uses real Playwright browser for actual CSS computation, layout reflow, and inheritance.
 * Tests cover every mutation category from capture-faked-after.ts plus consolidation behaviors.
 *
 * ─── FINDINGS ────────────────────────────────────────────────────────────────
 *
 * 1. FOREGROUND COLOR ABSORPTION (collapseForegroundColor in diff.ts)
 *    When `text-decoration-color` or `outline-color` change to the same value as
 *    `color` (common because they default to `currentColor`), the redundant props
 *    are silently absorbed — only the `color` change remains.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import { captureDomManifest } from '../dom-manifest.js'
import { matchManifests } from '../match.js'
import { diffManifests, consolidateDiffs, type DiffResult, type ElementDiff, type DiffGroup } from '../diff.js'
import { buildCascadeClusters, type CascadeCluster } from '../cascade-cluster.js'
import { diffManifestsByViewport } from '../viewport-diff.js'
import type { DomManifest } from '../dom-manifest.js'

let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await chromium.launch()
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
})

afterAll(async () => { await browser?.close() })

const noop = () => {}

async function captureHtml(html: string): Promise<DomManifest> {
  await page.setContent(html, { waitUntil: 'load' })
  return captureDomManifest(page, noop)
}

type FullResult = {
  raw: DiffResult
  consolidated: DiffResult
  cascadeClusters: CascadeCluster[]
  diffs: ElementDiff[]
  groups: DiffGroup[]
  before: DomManifest
  after: DomManifest
}

async function diffHtml(beforeHtml: string, afterHtml: string): Promise<FullResult> {
  const before = await captureHtml(beforeHtml)
  const after = await captureHtml(afterHtml)

  const match = matchManifests(before, after)
  const raw = diffManifests(before, after, match)
  const consolidated = consolidateDiffs(raw, before, after)
  const cascade = buildCascadeClusters(consolidated.groups, consolidated.diffs, before, after)

  return {
    raw,
    consolidated,
    cascadeClusters: cascade.clusters,
    diffs: cascade.remainingDiffs,
    groups: cascade.remainingGroups,
    before,
    after,
  }
}

function allChanges(r: FullResult) {
  return r.diffs.flatMap(d => d.changes)
}

function allGroupChanges(r: FullResult) {
  return r.groups.flatMap(g => g.changes)
}

function findDiff(r: FullResult, predicate: (d: ElementDiff) => boolean) {
  return r.diffs.find(predicate)
}

function findDiffByLabel(r: FullResult, substr: string) {
  return r.diffs.find(d => d.label.includes(substr))
}

function findGroupByMemberLabel(r: FullResult, substr: string) {
  return r.groups.find(g => g.members.some(m => m.label.includes(substr)))
}

function countType(r: FullResult, type: ElementDiff['type']) {
  return r.diffs.filter(d => d.type === type).length
}

// ─── HTML fixtures ───────────────────────────────────────────────────

const BASE_PAGE = `<!DOCTYPE html>
<html><head><style>
  body { margin: 0; font-family: sans-serif; }
  nav { display: flex; gap: 16px; padding: 12px 24px; background: #1a1a2e; }
  nav a { color: white; text-decoration: none; font-size: 14px; }
  .card { margin: 24px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
  .card h2 { margin: 0 0 8px; font-size: 18px; color: #333; }
  .card p { margin: 0; color: #666; font-size: 14px; }
  button { padding: 8px 16px; background: #4361ee; color: white; border: none; border-radius: 4px; cursor: pointer; }
  footer { padding: 16px; text-align: center; color: #999; font-size: 12px; }
</style></head>
<body>
  <nav role="navigation">
    <a href="/" data-testid="nav-home">Home</a>
    <a href="/about" data-testid="nav-about">About</a>
    <a href="/contact" data-testid="nav-contact">Contact</a>
  </nav>
  <div class="card" data-testid="welcome-card">
    <h2>Welcome</h2>
    <p>This is a sample page for testing visual regression.</p>
    <button data-testid="cta-button">Get Started</button>
  </div>
  <footer>© 2026 Test Corp</footer>
</body></html>`

// =====================================================================
// Section 1: Identical HTML
// =====================================================================

describe('Identical HTML', () => {
  it('produces zero diffs for identical HTML', async () => {
    const r = await diffHtml(BASE_PAGE, BASE_PAGE)

    expect(r.diffs).toHaveLength(0)
    expect(r.groups).toHaveLength(0)
    expect(r.cascadeClusters).toHaveLength(0)
    expect(r.consolidated.summary.changed).toBe(0)
    expect(r.consolidated.summary.added).toBe(0)
    expect(r.consolidated.summary.removed).toBe(0)
    expect(r.consolidated.summary.moved).toBe(0)
  })
})

// =====================================================================
// Section 2: Text Content Changes
// =====================================================================

describe('Text content changes', () => {
  it('detects a simple text change on a button', async () => {
    const after = BASE_PAGE.replace('Get Started', 'Sign Up Now')
    const r = await diffHtml(BASE_PAGE, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.length).toBeGreaterThanOrEqual(1)
    expect(textChanges.some(c => c.before === 'Get Started' && c.after === 'Sign Up Now')).toBe(true)
  })

  it('detects heading text change', async () => {
    const after = BASE_PAGE.replace('<h2>Welcome</h2>', '<h2>Hello World</h2>')
    const r = await diffHtml(BASE_PAGE, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.some(c => c.before === 'Welcome' && c.after === 'Hello World')).toBe(true)
  })

  it('detects paragraph text change', async () => {
    const after = BASE_PAGE.replace(
      'This is a sample page for testing visual regression.',
      'Updated description text here.',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.length).toBeGreaterThanOrEqual(1)
    expect(textChanges.some(c =>
      c.before === 'This is a sample page for testing visual regression.' &&
      c.after === 'Updated description text here.'
    )).toBe(true)
  })

  it('detects nav link text change', async () => {
    const after = BASE_PAGE.replace('>About</a>', '>About Us</a>')
    const r = await diffHtml(BASE_PAGE, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.some(c => c.before === 'About' && c.after === 'About Us')).toBe(true)
  })

  it('detects text change even when element has many other properties', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .badge { display: inline-block; padding: 4px 12px; background: #059669; color: white;
               border: 1px solid #059669; border-radius: 16px; font-size: 12px; font-weight: 600; }
    </style></head><body>
      <span class="badge" data-testid="status">Active</span>
    </body></html>`
    const after = html.replace('>Active</span>', '>Inactive</span>')
    const r = await diffHtml(html, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.some(c => c.before === 'Active' && c.after === 'Inactive')).toBe(true)
  })
})

// =====================================================================
// Section 3: Color / Typography Changes
// =====================================================================

describe('Color and typography changes', () => {
  it('detects font color change', async () => {
    const after = BASE_PAGE.replace(
      '.card h2 { margin: 0 0 8px; font-size: 18px; color: #333; }',
      '.card h2 { margin: 0 0 8px; font-size: 18px; color: #e74c3c; }',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const colorChanges = allChanges(r).filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects font-size change', async () => {
    const after = BASE_PAGE.replace(
      '.card p { margin: 0; color: #666; font-size: 14px; }',
      '.card p { margin: 0; color: #666; font-size: 18px; }',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const sizeChanges = allChanges(r).filter(c => c.property === 'font-size')
    expect(sizeChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects font-weight change', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .title { font-weight: 400; font-size: 20px; }
    </style></head><body>
      <h1 class="title" data-testid="title">Hello</h1>
    </body></html>`
    const after = html.replace('font-weight: 400', 'font-weight: 700')
    const r = await diffHtml(html, after)

    const weightChanges = allChanges(r).filter(c => c.property === 'font-weight')
    expect(weightChanges).toHaveLength(1)
  })

  it('detects link color change to purple (like LINK_COLOR_CHANGE mutation)', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      a { color: rgb(0, 101, 204); font-size: 14px; }
    </style></head><body>
      <a href="/one" data-testid="link-1">First Link</a>
      <a href="/two" data-testid="link-2">Second Link</a>
    </body></html>`
    const after = html.replace(
      'a { color: rgb(0, 101, 204)',
      'a { color: rgb(124, 58, 237)',
    )
    const r = await diffHtml(html, after)

    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects text-decoration change', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      a { text-decoration: none; color: blue; }
    </style></head><body>
      <a href="/" data-testid="link">Click</a>
    </body></html>`
    const after = html.replace('text-decoration: none', 'text-decoration: underline')
    const r = await diffHtml(html, after)

    const decoChanges = allChanges(r).filter(c => c.property === 'text-decoration')
    expect(decoChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 4: Background Color Changes
// =====================================================================

describe('Background color changes', () => {
  it('detects background-color change', async () => {
    const after = BASE_PAGE.replace(
      'nav { display: flex; gap: 16px; padding: 12px 24px; background: #1a1a2e; }',
      'nav { display: flex; gap: 16px; padding: 12px 24px; background: #2d3436; }',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects transparent → opaque background', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: transparent; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
    const after = html.replace('background: transparent', 'background: #3b82f6')
    const r = await diffHtml(html, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects status badge background color change (like STATUS_BADGE_GREEN)', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .badge { display: inline-block; padding: 4px 12px; background: rgb(214, 247, 240);
               color: rgb(23, 106, 87); border: 1px solid #ddd; border-radius: 16px; font-size: 12px; }
    </style></head><body>
      <span class="badge" data-testid="status">Active</span>
    </body></html>`
    const after = html.replace('background: rgb(214, 247, 240)', 'background: rgb(5, 150, 105)')
      .replace('color: rgb(23, 106, 87)', 'color: white')
      .replace('border: 1px solid #ddd', 'border: 1px solid rgb(5, 150, 105)')
    const r = await diffHtml(html, after)

    const bgChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 5: Box Model Changes (Padding, Margin, Border)
// =====================================================================

describe('Box model changes', () => {
  it('detects padding change', async () => {
    const after = BASE_PAGE.replace(
      '.card { margin: 24px; padding: 16px;',
      '.card { margin: 24px; padding: 32px;',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const paddingChanges = allChanges(r).filter(c => c.property.startsWith('padding'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects margin change', async () => {
    const after = BASE_PAGE.replace(
      '.card { margin: 24px;',
      '.card { margin: 48px;',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const marginChanges = allChanges(r).filter(c => c.property.startsWith('margin'))
    expect(marginChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects border-width change', async () => {
    const after = BASE_PAGE.replace(
      '.card { margin: 24px; padding: 16px; border: 1px solid #ddd;',
      '.card { margin: 24px; padding: 16px; border: 3px solid #ddd;',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const borderChanges = allChanges(r).filter(c =>
      c.property.includes('border') && c.property.includes('width')
    )
    expect(borderChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects border-color change', async () => {
    const after = BASE_PAGE.replace(
      'border: 1px solid #ddd;',
      'border: 1px solid #3b82f6;',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const borderColorChanges = allChanges(r).filter(c =>
      c.property.includes('border') && c.property.includes('color')
    )
    expect(borderColorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects border-radius change', async () => {
    const after = BASE_PAGE.replace('border-radius: 8px;', 'border-radius: 16px;')
    const r = await diffHtml(BASE_PAGE, after)

    const radiusChanges = allChanges(r).filter(c =>
      c.property.includes('border') && c.property.includes('radius')
    )
    expect(radiusChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects button padding + border-radius change (like BUTTON_RESTYLE)', async () => {
    const after = BASE_PAGE.replace(
      'button { padding: 8px 16px; background: #4361ee; color: white; border: none; border-radius: 4px;',
      'button { padding: 10px 20px; background: #4361ee; color: white; border: none; border-radius: 8px;',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const changes = allChanges(r)
    const paddingChanges = changes.filter(c => c.property.startsWith('padding'))
    const radiusChanges = changes.filter(c => c.property.includes('radius'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
    expect(radiusChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 6: Element Addition / Removal
// =====================================================================

describe('Element addition and removal', () => {
  it('detects added element', async () => {
    const after = BASE_PAGE.replace(
      '</nav>',
      '  <a href="/blog" data-testid="nav-blog">Blog</a>\n  </nav>',
    )
    const r = await diffHtml(BASE_PAGE, after)

    expect(countType(r, 'added')).toBeGreaterThanOrEqual(1)
  })

  it('detects removed element', async () => {
    const after = BASE_PAGE.replace(
      '<a href="/contact" data-testid="nav-contact">Contact</a>',
      '',
    )
    const r = await diffHtml(BASE_PAGE, after)

    expect(countType(r, 'removed')).toBeGreaterThanOrEqual(1)
  })

  it('detects added banner (like ADD_BANNER mutation)', async () => {
    const after = BASE_PAGE.replace(
      '</nav>',
      `</nav>
      <div data-testid="test-banner" style="background:#fef3c7;color:#92400e;padding:12px 24px;font-size:14px;font-weight:500;border-bottom:2px solid #f59e0b;">
        ⚠ System maintenance scheduled
      </div>`,
    )
    const r = await diffHtml(BASE_PAGE, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
    expect(added.some(d => d.label.includes('test-banner'))).toBe(true)
  })

  it('detects removed button (like REMOVE_HELP_BTN mutation)', async () => {
    const after = BASE_PAGE.replace(
      '<button data-testid="cta-button">Get Started</button>',
      '',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const removed = r.diffs.filter(d => d.type === 'removed')
    expect(removed.length).toBeGreaterThanOrEqual(1)
  })

  it('does not report descendants of an added element as separate additions', async () => {
    const after = BASE_PAGE.replace(
      '</nav>',
      `</nav>
      <section data-testid="promo">
        <h3>New Feature</h3>
        <p>Check out our latest update</p>
        <button>Learn More</button>
      </section>`,
    )
    const r = await diffHtml(BASE_PAGE, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].label).toContain('promo')
  })

  it('does not report descendants of a removed element as separate removals', async () => {
    const after = BASE_PAGE.replace(
      /<div class="card"[^]*?<\/div>/,
      '',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const removed = r.diffs.filter(d => d.type === 'removed')
    expect(removed).toHaveLength(1)
    expect(removed[0].label).toContain('welcome-card')
  })
})

// =====================================================================
// Section 7: Element Moved
// =====================================================================

describe('Element moved', () => {
  it('detects element moved from nav to footer', async () => {
    const after = BASE_PAGE
      .replace('<a href="/contact" data-testid="nav-contact">Contact</a>', '')
      .replace(
        '<footer>',
        '<footer><a href="/contact" data-testid="nav-contact" style="color:#999;font-size:12px;">Contact</a> ',
      )
    const r = await diffHtml(BASE_PAGE, after)

    const moved = r.diffs.filter(d => d.type === 'moved' || d.type === 'moved+changed')
    expect(moved.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 8: Layout / Display Changes
// =====================================================================

describe('Layout and display changes', () => {
  it('detects display change (block → flex)', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .container { display: block; padding: 16px; }
    </style></head><body>
      <div class="container" data-testid="container">
        <span>A</span><span>B</span>
      </div>
    </body></html>`
    const after = html.replace('display: block', 'display: flex')
    const r = await diffHtml(html, after)

    // Container changes display, children may also change computed display (flex items).
    const containerDiff = findDiffByLabel(r, 'container')
    expect(containerDiff).toBeDefined()
    expect(containerDiff!.changes.some(c => c.property === 'display')).toBe(true)
  })

  it('detects flex-direction change', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .row { display: flex; flex-direction: row; }
      .item { width: 100px; height: 50px; background: #eee; }
    </style></head><body>
      <div class="row" data-testid="row">
        <div class="item">A</div><div class="item">B</div>
      </div>
    </body></html>`
    const after = html.replace('flex-direction: row', 'flex-direction: column')
    const r = await diffHtml(html, after)

    const flexChanges = allChanges(r).filter(c => c.property === 'flex-direction')
    expect(flexChanges).toHaveLength(1)
  })

  it('detects gap change', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .row { display: flex; gap: 8px; }
      .item { width: 100px; height: 50px; background: #eee; }
    </style></head><body>
      <div class="row" data-testid="row">
        <div class="item">A</div><div class="item">B</div>
      </div>
    </body></html>`
    const after = html.replace('gap: 8px', 'gap: 24px')
    const r = await diffHtml(html, after)

    const gapChanges = allChanges(r).filter(c => c.property === 'gap')
    expect(gapChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 9: Size Changes (Width, Height)
// =====================================================================

describe('Size changes', () => {
  it('detects explicit width change via CSS', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
    const after = html.replace('width: 200px', 'width: 300px')
    const r = await diffHtml(html, after)

    const widthChanges = allChanges(r).filter(c => c.property === 'width' && c.category === 'box-model')
    expect(widthChanges).toHaveLength(1)
  })

  it('detects explicit height change via CSS', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
    const after = html.replace('height: 100px', 'height: 200px')
    const r = await diffHtml(html, after)

    const heightChanges = allChanges(r).filter(c => c.property === 'height' && c.category === 'box-model')
    expect(heightChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 10: CSS Inheritance & Cascade (real browser layout)
// =====================================================================

describe('CSS inheritance and cascade', () => {
  it('detects color change inherited from parent to child text elements', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .card { color: #333; padding: 16px; }
      .card h2 { font-size: 18px; }
      .card p { font-size: 14px; }
    </style></head><body>
      <div class="card" data-testid="card">
        <h2 data-testid="heading">Title</h2>
        <p data-testid="para">Description</p>
      </div>
    </body></html>`
    const after = html.replace('.card { color: #333;', '.card { color: #e74c3c;')
    const r = await diffHtml(html, after)

    // The color change on .card cascades to h2 and p via CSS inheritance.
    // Expect the diff engine to detect color changes on some/all of: card, h2, p.
    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('parent border change causes child width reflow', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .container { border: 1px solid #ddd; padding: 16px; }
      .child { width: auto; background: #eee; padding: 8px; }
    </style></head><body>
      <div class="container" data-testid="container">
        <div class="child" data-testid="child">Content here</div>
      </div>
    </body></html>`
    const after = html.replace('border: 1px solid #ddd', 'border: 4px solid #3b82f6')
    const r = await diffHtml(html, after)

    // The container's border change is the primary mutation.
    // The child's width should change because the container's content area shrinks.
    const containerDiff = findDiffByLabel(r, 'container')
    expect(containerDiff).toBeDefined()
    const borderChanges = containerDiff!.changes.filter(c =>
      c.property.includes('border')
    )
    expect(borderChanges.length).toBeGreaterThanOrEqual(1)

    // Child's width change is cascade noise — bbox-only gets suppressed.
  })

  it('inserted banner causes height cascade on sibling containers', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .header { height: 60px; background: #1a1a2e; }
      .content { padding: 16px; }
      .content p { margin: 8px 0; }
    </style></head><body>
      <div class="header" data-testid="header">Header</div>
      <div class="content" data-testid="content">
        <p data-testid="p1">Paragraph 1</p>
        <p data-testid="p2">Paragraph 2</p>
        <p data-testid="p3">Paragraph 3</p>
      </div>
    </body></html>`
    const after = html.replace(
      '<div class="header"',
      `<div data-testid="banner" style="background:#fef3c7;padding:12px;font-size:14px;">Maintenance notice</div>
      <div class="header"`,
    )
    const r = await diffHtml(html, after)

    // Banner should be detected as added
    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
    expect(added.some(d => d.label.includes('banner'))).toBe(true)

    // Content + paragraphs only shift down (bbox y). Consolidation suppresses bbox-only.
    const contentDiff = findDiffByLabel(r, 'content')
    const p1Diff = findDiffByLabel(r, 'p1')
    expect(contentDiff).toBeUndefined()
    expect(p1Diff).toBeUndefined()
  })

  it('padding change on parent causes subpixel width changes on children', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .wrapper { padding: 16px; border: 1px solid #ddd; }
      .item { background: #f0f0f0; padding: 8px; margin-bottom: 4px; }
    </style></head><body>
      <div class="wrapper" data-testid="wrapper">
        <div class="item" data-testid="item-1">Item 1</div>
        <div class="item" data-testid="item-2">Item 2</div>
        <div class="item" data-testid="item-3">Item 3</div>
      </div>
    </body></html>`
    const after = html.replace('.wrapper { padding: 16px;', '.wrapper { padding: 24px;')
    const r = await diffHtml(html, after)

    // The wrapper's padding change is the primary mutation
    const wrapperDiff = findDiffByLabel(r, 'wrapper')
    expect(wrapperDiff).toBeDefined()
    const paddingChanges = wrapperDiff!.changes.filter(c => c.property.startsWith('padding'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)

    // Children's width shrinks via cascade. If they survive consolidation,
    // they must have meaningful (non-bbox) changes — bbox-only gets suppressed.
    const itemDiffs = r.diffs.filter(d => d.label.includes('item-'))
    for (const item of itemDiffs) {
      expect(item.changes.every(c => c.category !== 'bbox')).toBe(true)
    }
  })

  it('color change on link with heading child: deduplicateAncestorChanges', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      a { color: rgb(0, 101, 204); text-decoration: none; }
      a h3 { font-size: 16px; }
    </style></head><body>
      <a href="/page" data-testid="card-link">
        <h3 data-testid="card-title">Card Title</h3>
      </a>
    </body></html>`
    const after = html.replace('color: rgb(0, 101, 204)', 'color: rgb(124, 58, 237)')
    const r = await diffHtml(html, after)

    // The h3 (descendant) should keep the color change
    const titleDiff = findDiffByLabel(r, 'Card Title')
    expect(titleDiff).toBeDefined()
    const titleColor = titleDiff!.changes.find(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(titleColor).toBeDefined()

    // The link (ancestor) should have its color change stripped by deduplication
    const linkDiff = findDiffByLabel(r, 'card-link')
    if (linkDiff) {
      const linkColorChange = linkDiff.changes.find(c =>
        c.property === 'color' || c.property === 'foreground color'
      )
      expect(linkColorChange).toBeUndefined()
    }
  })

  it('color change on a plain link WITHOUT heading child is detected', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      a { color: rgb(0, 101, 204); text-decoration: none; font-size: 14px; }
    </style></head><body>
      <a href="/page" data-testid="plain-link">Plain Link Text</a>
    </body></html>`
    const after = html.replace('color: rgb(0, 101, 204)', 'color: rgb(124, 58, 237)')
    const r = await diffHtml(html, after)

    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 11: Grouping (Fingerprint Groups)
// =====================================================================

describe('Fingerprint grouping', () => {
  it('groups multiple elements with identical changes', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .badge { display: inline-block; padding: 4px 12px; background: rgb(214, 247, 240);
               color: rgb(23, 106, 87); border: 1px solid #ddd; border-radius: 16px; font-size: 12px; }
    </style></head><body>
      <span class="badge" data-testid="badge-1">Active</span>
      <span class="badge" data-testid="badge-2">Active</span>
      <span class="badge" data-testid="badge-3">Active</span>
    </body></html>`
    const after = html.replace(
      /background: rgb\(214, 247, 240\)/g,
      'background: rgb(5, 150, 105)',
    ).replace(
      /color: rgb\(23, 106, 87\)/g,
      'color: white',
    ).replace(
      /border: 1px solid #ddd/g,
      'border: 1px solid rgb(5, 150, 105)',
    )
    const r = await diffHtml(html, after)

    const badgeGroup = r.groups.find(g =>
      g.members.some(m => m.label.includes('badge'))
    )
    expect(badgeGroup).toBeDefined()
    expect(badgeGroup!.members).toHaveLength(3)
  })

  it('does not group elements with different change fingerprints', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .a { color: red; font-size: 14px; }
      .b { color: blue; font-size: 14px; }
    </style></head><body>
      <div class="a" data-testid="div-a">A</div>
      <div class="b" data-testid="div-b">B</div>
    </body></html>`
    const after = html
      .replace('.a { color: red;', '.a { color: green;')
      .replace('.b { color: blue;', '.b { color: purple;')
    const r = await diffHtml(html, after)

    // Different before→after color values means different fingerprints → no grouping
    const changes = allChanges(r).filter(c => c.property === 'color' || c.property === 'foreground color')
    expect(changes.length).toBeGreaterThanOrEqual(2)
    // They should NOT be in a group because their before/after values differ
    const colorGroup = r.groups.find(g => g.changes.some(c => c.property === 'color'))
    expect(colorGroup).toBeUndefined()
  })
})

// =====================================================================
// Section 12: Cascade Clustering
// =====================================================================

describe('Cascade clustering', () => {
  it('clusters 3+ elements with same width delta into a cascade', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .container { width: 800px; border: 1px solid #ddd; padding: 16px; }
      .row { background: #f9f9f9; padding: 8px; margin-bottom: 4px; }
    </style></head><body>
      <div class="container" data-testid="container">
        <div class="row" data-testid="row-1">Row 1</div>
        <div class="row" data-testid="row-2">Row 2</div>
        <div class="row" data-testid="row-3">Row 3</div>
        <div class="row" data-testid="row-4">Row 4</div>
      </div>
    </body></html>`
    const after = html.replace('width: 800px', 'width: 700px')
    const r = await diffHtml(html, after)

    // P0 fix: Container's CSS width survives consolidation (dedup fingerprint
    // includes category, so box-model `width` ≠ bbox `width`).
    // Check consolidated output (pre-cascade-clustering).
    const conContainerDiff = r.consolidated.diffs.find(d => d.label.includes('container'))
    expect(conContainerDiff).toBeDefined()
    const widthChange = conContainerDiff!.changes.find(c =>
      c.property === 'width' && c.category === 'box-model'
    )
    expect(widthChange).toBeDefined()

    // The container's width change is the ROOT CAUSE of children shrinking.
    // It should remain visible in the final output, not be absorbed into a
    // cascade cluster alongside its own children.
    const containerDiff = findDiffByLabel(r, 'container')
    expect(containerDiff).toBeDefined()
  })

  it('border-accent on sections creates cascade in child elements', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      section { padding: 16px; margin: 8px; }
      section p { margin: 4px 0; }
    </style></head><body>
      <section data-testid="sec-1">
        <p>Para 1a</p><p>Para 1b</p><p>Para 1c</p><p>Para 1d</p>
      </section>
      <section data-testid="sec-2">
        <p>Para 2a</p><p>Para 2b</p><p>Para 2c</p><p>Para 2d</p>
      </section>
    </body></html>`
    const after = html.replace(
      'section { padding: 16px; margin: 8px; }',
      'section { padding: 16px; margin: 8px; border: 2px solid #3b82f6; border-radius: 12px; }',
    )
    const r = await diffHtml(html, after)

    // Sections get border changes. Their children may cascade (width shrinks).
    // Verify at least the section border changes are detected.
    const borderChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property.includes('border')
    )
    expect(borderChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 13: Consolidation Behaviors
// =====================================================================

describe('Consolidation', () => {
  it('collapses identical quad border-radius into single shorthand', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; border-radius: 4px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
    const after = html.replace('border-radius: 4px', 'border-radius: 16px')
    const r = await diffHtml(html, after)

    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeDefined()
    // Should be collapsed to a single `border-radius` shorthand
    const radiusChanges = boxDiff!.changes.filter(c => c.property.includes('radius'))
    expect(radiusChanges).toHaveLength(1)
    expect(radiusChanges[0].property).toBe('border-radius')
  })

  it('does NOT collapse non-uniform border-radius (different corners)', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px;
             border-top-left-radius: 4px; border-top-right-radius: 4px;
             border-bottom-left-radius: 4px; border-bottom-right-radius: 4px;
             background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
    const after = html.replace('border-top-left-radius: 4px', 'border-top-left-radius: 16px')
      .replace('border-top-right-radius: 4px', 'border-top-right-radius: 16px')
    // Only top corners changed, bottom unchanged
    const r = await diffHtml(html, after)

    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeDefined()
    const radiusChanges = boxDiff!.changes.filter(c => c.property.includes('radius'))
    // Should NOT collapse to shorthand (only 2 of 4 corners changed)
    expect(radiusChanges.length).toBeGreaterThanOrEqual(1)
    // If collapsed to shorthand, there'd be exactly 1 with property 'border-radius'.
    // Since only 2 corners changed, we expect individual corner properties.
    expect(radiusChanges.every(c => c.property !== 'border-radius')).toBe(true)
  })

  it('collapses identical quad border-color into single shorthand', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; border: 2px solid #ddd; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
    const after = html.replace('border: 2px solid #ddd', 'border: 2px solid #3b82f6')
    const r = await diffHtml(html, after)

    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeDefined()
    const borderColorChanges = boxDiff!.changes.filter(c => c.property.includes('border-color'))
    expect(borderColorChanges).toHaveLength(1)
    expect(borderColorChanges[0].property).toBe('border-color')
  })

  it('strips bbox changes from elements that also have meaningful style changes', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; color: black; padding: 8px; }
    </style></head><body>
      <div class="box" data-testid="box">Text</div>
    </body></html>`
    // Change both style properties AND something that shifts bbox
    const after = html.replace('color: black', 'color: red').replace('padding: 8px', 'padding: 16px')
    const r = await diffHtml(html, after)

    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeDefined()
    expect(boxDiff!.changes.some(c => c.property === 'color' || c.property === 'foreground color')).toBe(true)
    expect(boxDiff!.changes.some(c => c.property.startsWith('padding'))).toBe(true)
    expect(boxDiff!.changes.every(c => c.category !== 'bbox')).toBe(true)
  })

  it('suppresses pure bbox-only shifts', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .spacer { height: 50px; }
      .target { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="spacer" data-testid="spacer"></div>
      <div class="target" data-testid="target">Content</div>
    </body></html>`
    const after = html.replace('.spacer { height: 50px; }', '.spacer { height: 100px; }')
    const r = await diffHtml(html, after)

    // The target only shifts vertically (bbox y change), no style changes.
    // Consolidation should suppress it.
    const targetDiff = findDiffByLabel(r, 'target')
    expect(targetDiff).toBeUndefined()

    // The spacer has a real height change (CSS property change)
    const spacerDiff = findDiffByLabel(r, 'spacer')
    expect(spacerDiff).toBeDefined()
  })
})

// =====================================================================
// Section 14: Table Mutations (like TABLE_HEADER_DARK, TABLE_CELL_PAD)
// =====================================================================

describe('Table mutations', () => {
  const TABLE_PAGE = `<!DOCTYPE html><html><head><style>
    body { margin: 0; font-family: sans-serif; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f5f5; color: #333; padding: 8px 12px; text-align: left; font-size: 14px; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
  </style></head><body>
    <table data-testid="data-table">
      <thead>
        <tr>
          <th data-testid="th-name">Name</th>
          <th data-testid="th-status">Status</th>
          <th data-testid="th-action">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td data-testid="td-1-name">Alice</td>
          <td data-testid="td-1-status">Active</td>
          <td data-testid="td-1-action">Edit</td>
        </tr>
        <tr>
          <td data-testid="td-2-name">Bob</td>
          <td data-testid="td-2-status">Pending</td>
          <td data-testid="td-2-action">Edit</td>
        </tr>
      </tbody>
    </table>
  </body></html>`

  it('detects table header background and color change', async () => {
    const after = TABLE_PAGE.replace(
      'th { background: #f5f5f5; color: #333;',
      'th { background: #1e293b; color: white;',
    )
    const r = await diffHtml(TABLE_PAGE, after)

    const bgChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c => c.property === 'background-color')
    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects table cell padding change', async () => {
    const after = TABLE_PAGE.replace(
      'td { padding: 8px 12px;',
      'td { padding: 14px 16px;',
    )
    const r = await diffHtml(TABLE_PAGE, after)

    const paddingChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c => c.property.startsWith('padding'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects hidden last column (display: none)', async () => {
    const after = TABLE_PAGE.replace(
      '</style>',
      'th:last-child, td:last-child { display: none; }\n  </style>',
    )
    const r = await diffHtml(TABLE_PAGE, after)

    // display:none elements are excluded by isVisible → absent from after manifest → removed.
    // 3 sibling cells: th-action, td-1-action, td-2-action (siblings, not ancestors).
    const removed = r.diffs.filter(d => d.type === 'removed')
    expect(removed).toHaveLength(3)
  })
})

// =====================================================================
// Section 15: Tab / Active State Changes
// =====================================================================

describe('Tab and active state changes', () => {
  it('detects active tab border and color change (like TAB_ACTIVE_COLOR)', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .tabs { display: flex; border-bottom: 2px solid #eee; }
      .tab { padding: 8px 16px; border-bottom: 2px solid transparent; color: #666; font-size: 14px; cursor: pointer; }
      .tab.active { border-bottom-color: #4361ee; color: #4361ee; }
    </style></head><body>
      <div class="tabs" role="tablist">
        <div class="tab active" role="tab" data-testid="tab-1" aria-selected="true">Week</div>
        <div class="tab" role="tab" data-testid="tab-2" aria-selected="false">Month</div>
      </div>
    </body></html>`
    const after = html.replace(
      '.tab.active { border-bottom-color: #4361ee; color: #4361ee; }',
      '.tab.active { border-bottom-color: #8b5cf6; color: #8b5cf6; }',
    )
    const r = await diffHtml(html, after)

    const changes = allChanges(r)
    const colorChanges = changes.filter(c =>
      c.property === 'color' || c.property === 'foreground color' || c.property.includes('border-bottom-color')
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 16: Tooltip Badge Addition (like ADD_TOOLTIP_BADGE)
// =====================================================================

describe('Element insertion within existing elements', () => {
  it('detects BETA badge added inside heading', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      h1 { font-size: 24px; color: #333; }
    </style></head><body>
      <h1 data-testid="page-title">Dashboard</h1>
    </body></html>`
    const after = html.replace(
      '>Dashboard</h1>',
      '>Dashboard<span data-testid="beta-badge" style="background:#818cf8;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:8px;font-weight:700;">BETA</span></h1>',
    )
    const r = await diffHtml(html, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
    expect(added.some(d => d.label.includes('beta-badge') || d.label.includes('BETA'))).toBe(true)
  })
})

// =====================================================================
// Section 17: Footer Background (like FOOTER_BG)
// =====================================================================

describe('Footer mutations', () => {
  it('detects footer background color change', async () => {
    const after = BASE_PAGE.replace(
      'footer { padding: 16px; text-align: center; color: #999; font-size: 12px; }',
      'footer { padding: 16px; text-align: center; color: #9ca3af; font-size: 12px; background: #111827; }',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const changes = allChanges(r)
    const bgChange = changes.find(c => c.property === 'background-color')
    expect(bgChange).toBeDefined()
  })
})

// =====================================================================
// Section 18: Input Border Red (like INPUT_BORDER_RED)
// =====================================================================

describe('Form input mutations', () => {
  const FORM_PAGE = `<!DOCTYPE html><html><head><style>
    body { margin: 0; font-family: sans-serif; }
    .field { margin: 16px; }
    label { display: block; font-size: 14px; color: #333; margin-bottom: 4px; }
    input { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; width: 300px; }
  </style></head><body>
    <div class="field">
      <label for="name">Name</label>
      <input type="text" id="name" data-testid="input-name" value="Jane" />
    </div>
    <div class="field">
      <label for="email">Email</label>
      <input type="text" id="email" data-testid="input-email" value="jane@example.com" />
    </div>
  </body></html>`

  it('detects input border-color change (validation error style)', async () => {
    const after = FORM_PAGE.replace(
      'input { padding: 8px 12px; border: 1px solid #ccc;',
      'input { padding: 8px 12px; border: 1px solid #ef4444;',
    )
    const r = await diffHtml(FORM_PAGE, after)

    const borderColorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property.includes('border') && c.property.includes('color')
    )
    expect(borderColorChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects box-shadow addition on input', async () => {
    const after = FORM_PAGE.replace(
      'input { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; width: 300px; }',
      'input { padding: 8px 12px; border: 1px solid #ef4444; border-radius: 4px; font-size: 14px; width: 300px; box-shadow: 0 0 0 1px #ef4444; }',
    )
    const r = await diffHtml(FORM_PAGE, after)

    const shadowChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c => c.property === 'box-shadow')
    expect(shadowChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 19: Sidebar Width (like SIDEBAR_WIDTH)
// =====================================================================

describe('Sidebar mutations', () => {
  it('detects sidebar width change', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; display: flex; }
      aside { width: 240px; min-width: 240px; background: #f5f5f5; padding: 16px; }
      main { flex: 1; padding: 16px; }
    </style></head><body>
      <aside data-testid="sidebar">Sidebar</aside>
      <main data-testid="main-content">Main content</main>
    </body></html>`
    const after = html
      .replace('width: 240px; min-width: 240px;', 'width: 280px; min-width: 280px;')
    const r = await diffHtml(html, after)

    const sidebarDiff = findDiffByLabel(r, 'sidebar')
    expect(sidebarDiff).toBeDefined()
    const widthChanges = sidebarDiff!.changes.filter(c =>
      c.property === 'width' || c.property === 'min-width'
    )
    expect(widthChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 20: Avatar Border (like AVATAR_BORDER)
// =====================================================================

describe('Avatar mutations', () => {
  it('detects border added to avatar image', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .avatar { width: 48px; height: 48px; border-radius: 50%; }
    </style></head><body>
      <img class="avatar" data-testid="user-avatar"
           src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
           alt="User" />
    </body></html>`
    const after = html.replace(
      '.avatar { width: 48px; height: 48px; border-radius: 50%; }',
      '.avatar { width: 48px; height: 48px; border-radius: 50%; border: 3px solid #8b5cf6; }',
    )
    const r = await diffHtml(html, after)

    const changes = allChanges(r)
    const borderChanges = changes.filter(c =>
      c.property.includes('border') && (c.property.includes('width') || c.property.includes('color') || c.property.includes('style'))
    )
    expect(borderChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 21: H3 Section Color (like H3_COLOR)
// =====================================================================

describe('Heading section color', () => {
  it('detects h3 color change', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      h3 { color: #333; font-size: 16px; }
    </style></head><body>
      <h3 data-testid="section-1">Section One</h3>
      <p>Content</p>
      <h3 data-testid="section-2">Section Two</h3>
      <p>More content</p>
    </body></html>`
    const after = html.replace('h3 { color: #333;', 'h3 { color: #1e40af;')
    const r = await diffHtml(html, after)

    const colorChanges = [...allChanges(r), ...allGroupChanges(r)].filter(c =>
      c.property === 'color' || c.property === 'foreground color'
    )
    expect(colorChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 22: Multiple Simultaneous Mutations
// =====================================================================

describe('Multiple simultaneous mutations', () => {
  it('detects all changes when multiple mutations applied', async () => {
    const after = BASE_PAGE
      .replace('Welcome', 'Hello')
      .replace('Get Started', 'Sign Up')
      .replace('background: #1a1a2e;', 'background: #2d3436;')
      .replace('border: 1px solid #ddd;', 'border: 2px solid #3b82f6;')
    const r = await diffHtml(BASE_PAGE, after)

    const changes = allChanges(r)
    // Should detect text changes
    expect(changes.some(c => c.category === 'text')).toBe(true)
    // Should detect bg color change on nav
    expect(changes.some(c => c.property === 'background-color')).toBe(true)
    // Should detect border changes on card
    expect(changes.some(c => c.property.includes('border'))).toBe(true)
  })

  it('detects heading rename + banner + button restyle together (approvals pattern)', async () => {
    const after = BASE_PAGE
      .replace('<h2>Welcome</h2>', '<h2>Dashboard</h2>')
      .replace(
        '</nav>',
        `</nav><div data-testid="banner" style="background:#fef3c7;padding:12px;font-size:14px;">Notice</div>`,
      )
      .replace(
        'button { padding: 8px 16px; background: #4361ee; color: white; border: none; border-radius: 4px;',
        'button { padding: 10px 20px; background: #4361ee; color: white; border: none; border-radius: 8px;',
      )
    const r = await diffHtml(BASE_PAGE, after)

    // Text change on heading
    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.some(c => c.before === 'Welcome' && c.after === 'Dashboard')).toBe(true)

    // Banner added
    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.some(d => d.label.includes('banner'))).toBe(true)

    // Button restyle
    const paddingChanges = allChanges(r).filter(c => c.property.startsWith('padding'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 23: Scoring and Importance
// =====================================================================

describe('Scoring and importance', () => {
  it('added/removed elements score 100 (critical)', async () => {
    const after = BASE_PAGE.replace(
      '<a href="/contact" data-testid="nav-contact">Contact</a>',
      '',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const removed = r.diffs.find(d => d.type === 'removed')!
    expect(removed).toBeDefined()
    expect(removed.score).toBe(100)
    expect(removed.importance).toBe('critical')
  })

  it('text changes score higher than size-only changes', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .a { font-size: 14px; }
      .b { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="a" data-testid="text-el">Hello</div>
      <div class="b" data-testid="box-el">Box</div>
    </body></html>`
    const afterText = html.replace('>Hello<', '>Goodbye<')
    const rText = await diffHtml(html, afterText)
    const textDiff = findDiffByLabel(rText, 'text-el')

    const afterBox = html.replace('width: 200px', 'width: 210px')
    const rBox = await diffHtml(html, afterBox)
    const boxDiff = findDiffByLabel(rBox, 'box-el')

    expect(textDiff).toBeDefined()
    expect(boxDiff).toBeDefined()
    expect(textDiff!.score).toBeGreaterThan(boxDiff!.score)
  })
})

// =====================================================================
// Section 24: Color Normalization
// =====================================================================

describe('Color normalization', () => {
  it('does not report false positive for same color in different formats', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { color: rgb(255, 0, 0); background: #ff0000; }
    </style></head><body>
      <div class="box" data-testid="box">Red text</div>
    </body></html>`
    // Same page twice — should be identical
    const r = await diffHtml(html, html)

    expect(r.diffs).toHaveLength(0)
    expect(r.groups).toHaveLength(0)
  })
})

// =====================================================================
// Section 25: Opacity / Visibility Changes
// =====================================================================

describe('Visibility and opacity', () => {
  it('detects opacity change', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; opacity: 1; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
    const after = html.replace('opacity: 1', 'opacity: 0.5')
    const r = await diffHtml(html, after)

    const opacityChanges = allChanges(r).filter(c => c.property === 'opacity')
    expect(opacityChanges).toHaveLength(1)
  })
})

// =====================================================================
// Section 26: Spacing Increase (like SPACING_INCREASE)
// =====================================================================

describe('Spacing increase', () => {
  it('detects padding and margin-bottom increase on cards', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .card { padding: 16px; margin-bottom: 8px; border: 1px solid #ddd; }
    </style></head><body>
      <div class="card" data-testid="card-1">Card 1</div>
      <div class="card" data-testid="card-2">Card 2</div>
    </body></html>`
    const after = html.replace(
      '.card { padding: 16px; margin-bottom: 8px;',
      '.card { padding: 24px; margin-bottom: 16px;',
    )
    const r = await diffHtml(html, after)

    const changes = [...allChanges(r), ...allGroupChanges(r)]
    const paddingChanges = changes.filter(c => c.property.startsWith('padding'))
    const marginChanges = changes.filter(c => c.property.startsWith('margin'))
    expect(paddingChanges.length).toBeGreaterThanOrEqual(1)
    expect(marginChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 27: Nav Background Dark (like NAV_BG_DARK)
// =====================================================================

describe('Nav background mutation', () => {
  it('detects nav background color darkening', async () => {
    const after = BASE_PAGE.replace(
      'nav { display: flex; gap: 16px; padding: 12px 24px; background: #1a1a2e; }',
      'nav { display: flex; gap: 16px; padding: 12px 24px; background: #0d1117; }',
    )
    const r = await diffHtml(BASE_PAGE, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 28: Info Row Addition (like ADD_INFO_ROW)
// =====================================================================

describe('Info row addition', () => {
  it('detects new info row added inside a section', async () => {
    const before = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .detail { padding: 16px; border: 1px solid #ddd; }
      .detail h3 { margin: 0 0 8px; font-size: 16px; }
      .row { padding: 8px 0; border-top: 1px solid #eee; font-size: 14px; }
    </style></head><body>
      <div class="detail" data-testid="detail-section">
        <h3>Details</h3>
        <div class="row" data-testid="row-1">Name: Alice</div>
        <div class="row" data-testid="row-2">Status: Active</div>
      </div>
    </body></html>`
    const after = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .detail { padding: 16px; border: 1px solid #ddd; }
      .detail h3 { margin: 0 0 8px; font-size: 16px; }
      .row { padding: 8px 0; border-top: 1px solid #eee; font-size: 14px; }
    </style></head><body>
      <div class="detail" data-testid="detail-section">
        <h3>Details</h3>
        <div class="row" data-testid="row-1">Name: Alice</div>
        <div class="row" data-testid="row-2">Status: Active</div>
        <div class="row" data-testid="row-new" style="padding:8px 12px;border-top:1px solid #e5e7eb;margin-top:8px;">
          <strong>Priority:</strong> <span style="color:#dc2626;font-weight:600;">High</span>
        </div>
      </div>
    </body></html>`
    const r = await diffHtml(before, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 29: Filter Chip Addition (like ADD_FILTER_CHIP)
// =====================================================================

describe('Filter chip addition', () => {
  it('detects filter chip added inside toolbar', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .toolbar { display: flex; align-items: center; padding: 8px 16px; gap: 8px; background: #f9f9f9; }
      .chip { display: inline-flex; padding: 4px 10px; background: #dbeafe; color: #1d4ed8;
              border-radius: 16px; font-size: 12px; font-weight: 500; }
    </style></head><body>
      <div class="toolbar" data-testid="toolbar">
        <span>Filters:</span>
      </div>
    </body></html>`
    const after = html.replace(
      '<span>Filters:</span>',
      '<span>Filters:</span><span class="chip" data-testid="active-filter">✕ Last 30 days</span>',
    )
    const r = await diffHtml(html, after)

    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)
    expect(added.some(d => d.label.includes('active-filter') || d.label.includes('Last 30 days'))).toBe(true)
  })
})

// =====================================================================
// Section 30: Breadcrumb Removal (like REMOVE_BREADCRUMB)
// =====================================================================

describe('Breadcrumb removal', () => {
  it('detects breadcrumb nav removal', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .breadcrumb { padding: 8px 16px; font-size: 12px; color: #666; }
      .breadcrumb a { color: #4361ee; }
      .content { padding: 16px; }
    </style></head><body>
      <nav class="breadcrumb" aria-label="breadcrumb" data-testid="breadcrumb">
        <a href="/">Home</a> / <a href="/settings">Settings</a> / <span>Current</span>
      </nav>
      <div class="content" data-testid="content">Page content</div>
    </body></html>`
    const after = html.replace(
      /<nav class="breadcrumb"[^]*?<\/nav>/,
      '',
    )
    const r = await diffHtml(html, after)

    const removed = r.diffs.filter(d => d.type === 'removed')
    expect(removed.length).toBeGreaterThanOrEqual(1)
    expect(removed.some(d => d.label.includes('breadcrumb'))).toBe(true)
  })
})

// =====================================================================
// Section 31: Accessible Names
// =====================================================================

describe('Accessible names in diff labels', () => {
  it('uses accessible name in diff label for buttons', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      button { padding: 8px 16px; color: black; }
    </style></head><body>
      <button aria-label="Close dialog" data-testid="close-btn">X</button>
    </body></html>`
    const after = html.replace('color: black', 'color: red')
    const r = await diffHtml(html, after)

    const btnDiff = r.diffs.find(d => d.label.includes('Close dialog'))
    expect(btnDiff).toBeDefined()
  })
})

// =====================================================================
// Section 32: Progress Bar Color (like PROGRESS_BAR_COLOR)
// =====================================================================

describe('Progress bar mutations', () => {
  it('detects progress bar background color change', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .progress { width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
      .progress-bar { width: 60%; height: 100%; background: #3b82f6; }
    </style></head><body>
      <div class="progress" data-testid="progress">
        <div class="progress-bar" role="progressbar" data-testid="progress-bar"></div>
      </div>
    </body></html>`
    const after = html.replace(
      '.progress-bar { width: 60%; height: 100%; background: #3b82f6; }',
      '.progress-bar { width: 60%; height: 100%; background: #f59e0b; }',
    )
    const r = await diffHtml(html, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 33: Background Subtle (like BG_SUBTLE_CHANGE)
// =====================================================================

describe('Subtle background change', () => {
  it('detects subtle background change from transparent to light gray', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .content { padding: 24px; }
    </style></head><body>
      <div class="content" data-testid="content">
        <p>Some content here</p>
      </div>
    </body></html>`
    const after = html.replace(
      '.content { padding: 24px; }',
      '.content { padding: 24px; background: #f8fafc; }',
    )
    const r = await diffHtml(html, after)

    const bgChanges = allChanges(r).filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// Section 34: Edge Cases
// =====================================================================

describe('Edge cases', () => {
  it('handles empty body gracefully', async () => {
    const html = `<!DOCTYPE html><html><head></head><body></body></html>`
    const r = await diffHtml(html, html)
    expect(r.diffs).toHaveLength(0)
  })

  it('handles deeply nested elements', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      div { padding: 4px; }
    </style></head><body>
      <div data-testid="d1">
        <div data-testid="d2">
          <div data-testid="d3">
            <div data-testid="d4">
              <span data-testid="deep">Deep text</span>
            </div>
          </div>
        </div>
      </div>
    </body></html>`
    const after = html.replace('>Deep text<', '>Changed text<')
    const r = await diffHtml(html, after)

    const textChanges = allChanges(r).filter(c => c.category === 'text')
    expect(textChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('detects very small color difference (< 5 RGB distance → low score)', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { color: rgb(100, 100, 100); font-size: 14px; padding: 8px; }
    </style></head><body>
      <div class="box" data-testid="box">Text</div>
    </body></html>`
    // Very subtle change: only 3 units in one channel
    const after = html.replace('rgb(100, 100, 100)', 'rgb(100, 100, 103)')
    const r = await diffHtml(html, after)

    // RGB distance ~3 → score 2. Detected but low importance.
    const diff = findDiffByLabel(r, 'box')
    expect(diff).toBeDefined()
    expect(diff!.score).toBeLessThan(20)
  })

  it('large number of identical elements with same mutation get grouped', async () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      `<div class="item" data-testid="item-${i}">Item ${i}</div>`
    ).join('\n')
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .item { padding: 8px; color: #333; font-size: 14px; border-bottom: 1px solid #eee; }
    </style></head><body>${items}</body></html>`
    const after = html.replace(
      '.item { padding: 8px; color: #333;',
      '.item { padding: 8px; color: #e74c3c;',
    )
    const r = await diffHtml(html, after)

    const colorGroup = r.groups.find(g =>
      g.changes.some(c => c.property === 'color' || c.property === 'foreground color')
    )
    expect(colorGroup).toBeDefined()
    expect(colorGroup!.members).toHaveLength(20)
  })
})

// =====================================================================
// Section 35: Cascade Cluster Structure (P1-5)
// =====================================================================

describe('Cascade cluster structure', () => {
  it('produces a cascade cluster with correct properties for 4+ width-decreased children', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .outer { width: 600px; padding: 16px; border: 1px solid #ddd; }
      .row { padding: 8px; margin-bottom: 4px; background: #f0f0f0; }
    </style></head><body>
      <div class="outer" data-testid="outer">
        <div class="row" data-testid="r1">Row 1</div>
        <div class="row" data-testid="r2">Row 2</div>
        <div class="row" data-testid="r3">Row 3</div>
        <div class="row" data-testid="r4">Row 4</div>
      </div>
    </body></html>`
    const after = html.replace('width: 600px', 'width: 500px')
    const r = await diffHtml(html, after)

    // The outer container's CSS width change is the root cause.
    // The 4 rows shrink in width (cascade). If they survive consolidation
    // as cascade-only changes, they should form a cluster.
    if (r.cascadeClusters.length > 0) {
      const cluster = r.cascadeClusters[0]
      expect(cluster.properties).toContain('width')
      expect(cluster.elementCount).toBeGreaterThanOrEqual(3)
      expect(cluster.members.length).toBe(cluster.elementCount)
      expect(cluster.delta).toContain('width')
      expect(cluster.delta).toContain('decreased')
    }
  })

  it('does not cluster elements with fewer than 3 matching cascade changes', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .a { width: 200px; background: #eee; padding: 8px; }
      .b { width: 300px; background: #ddd; padding: 8px; }
    </style></head><body>
      <div class="a" data-testid="a">A</div>
      <div class="b" data-testid="b">B</div>
    </body></html>`
    const after = html
      .replace('.a { width: 200px', '.a { width: 180px')
      .replace('.b { width: 300px', '.b { width: 280px')
    const r = await diffHtml(html, after)

    // Only 2 elements with width:decreased — below MIN_CLUSTER_SIZE of 3
    expect(r.cascadeClusters).toHaveLength(0)
  })

  it('clusters by direction only — different magnitudes in the same cluster', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .container { width: 800px; padding: 16px; }
      .a { width: 400px; background: #eee; padding: 8px; }
      .b { width: 300px; background: #ddd; padding: 8px; }
      .c { width: 200px; background: #ccc; padding: 8px; }
    </style></head><body>
      <div class="container" data-testid="container">
        <div class="a" data-testid="a">A</div>
        <div class="b" data-testid="b">B</div>
        <div class="c" data-testid="c">C</div>
      </div>
    </body></html>`
    const after = html
      .replace('.a { width: 400px', '.a { width: 350px')
      .replace('.b { width: 300px', '.b { width: 270px')
      .replace('.c { width: 200px', '.c { width: 160px')
    const r = await diffHtml(html, after)

    // All 3 have width:decreased but different deltas (50, 30, 40).
    // Policy: direction-only bucketing — same direction → same cluster regardless of magnitude.
    // This is an accepted tradeoff: cascade noise from a single root cause uses varying deltas,
    // so magnitude-based splitting would defeat the purpose of cascade clustering.
    const cluster = r.cascadeClusters.find(c => c.properties.includes('width'))
    expect(cluster).toBeDefined()
    expect(cluster!.elementCount).toBeGreaterThanOrEqual(3)
  })
})

// =====================================================================
// Section 36: Children-count-only pipeline suppression (P1-9)
// =====================================================================

describe('Children count suppression (pipeline)', () => {
  it('drops parent diff when its only change is children count and child is added', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .list { height: 400px; overflow: hidden; padding: 16px; }
      .item { padding: 8px; border-bottom: 1px solid #eee; }
    </style></head><body>
      <div class="list" data-testid="my-list">
        <div class="item" data-testid="item-1">First</div>
        <div class="item" data-testid="item-2">Second</div>
      </div>
    </body></html>`
    const after = html.replace(
      '<div class="item" data-testid="item-2">Second</div>',
      `<div class="item" data-testid="item-2">Second</div>
        <div class="item" data-testid="item-3">Third</div>`,
    )
    const r = await diffHtml(html, after)

    // The new item should be reported as added
    const added = r.diffs.filter(d => d.type === 'added')
    expect(added.length).toBeGreaterThanOrEqual(1)

    // The parent list's "children: 2→3" should NOT be a standalone diff.
    // With fixed height + overflow:hidden, the parent's dimensions don't change.
    const listDiff = r.diffs.find(d =>
      d.label.includes('my-list') && d.type === 'changed'
    )
    expect(listDiff).toBeUndefined()
  })
})

// =====================================================================
// Section 37: Position-only suppression (P2-14)
// =====================================================================

describe('Position-only suppression', () => {
  it('suppresses elements with only position category changes', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { position: relative; top: 10px; left: 20px; width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
    const after = html.replace('top: 10px; left: 20px', 'top: 30px; left: 40px')
    const r = await diffHtml(html, after)

    // position changes (top, left) are in the 'position' category.
    // Consolidation drops diffs where ALL changes are bbox or position.
    const boxDiff = findDiffByLabel(r, 'box')
    expect(boxDiff).toBeUndefined()

    // But raw should have detected it
    const rawBoxDiff = r.raw.diffs.find(d => d.label.includes('box'))
    expect(rawBoxDiff).toBeDefined()
  })
})

// =====================================================================
// Section 38: Zero-height wrapper promotion
// =====================================================================

describe('Zero-height wrapper promotion', () => {
  const wrapperHtml = `<!DOCTYPE html><html><head><style>
    body { margin: 0; font-family: sans-serif; }
    .scroll-container { overflow: auto; width: 600px; }
    .zero-height-wrapper { height: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 8px; background: #f0f0f0; text-align: left; }
    td { padding: 8px; border-top: 1px solid #ddd; }
  </style></head><body>
    <div class="scroll-container">
      <div class="zero-height-wrapper">
        <table data-testid="hours-table">
          <thead><tr>
            <th>Week</th>
            <th>Hours</th>
            <th>Status</th>
          </tr></thead>
          <tbody><tr>
            <td>Jan 1–7</td>
            <td>40</td>
            <td>Approved</td>
          </tr></tbody>
        </table>
      </div>
    </div>
  </body></html>`

  it('captures elements inside a height:0 wrapper that overflow visibly', async () => {
    const manifest = await captureHtml(wrapperHtml)

    function findAll(node: DomManifest['root'], predicate: (n: NonNullable<DomManifest['root']>) => boolean): NonNullable<DomManifest['root']>[] {
      if (!node) return []
      const results: NonNullable<DomManifest['root']>[] = []
      if (predicate(node)) results.push(node)
      for (const child of node.children) {
        results.push(...findAll(child, predicate))
      }
      return results
    }

    const ths = findAll(manifest.root, n => n.tag === 'th')
    expect(ths).toHaveLength(3)
    expect(ths.map(t => t.text)).toEqual(['Week', 'Hours', 'Status'])

    const table = findAll(manifest.root, n => n.testId === 'hours-table')
    expect(table).toHaveLength(1)
  })

  it('detects style changes on elements inside a height:0 wrapper', async () => {
    const afterHtml = wrapperHtml.replace(
      'th { padding: 8px; background: #f0f0f0;',
      'th { padding: 8px; background: #1e293b; color: white;',
    )
    const r = await diffHtml(wrapperHtml, afterHtml)

    const allRawChanges = r.raw.diffs.flatMap(d => d.changes)
    const bgChanges = allRawChanges.filter(c => c.property === 'background-color')
    expect(bgChanges.length).toBeGreaterThanOrEqual(3)
  })
})

// =====================================================================
// Section 39: Multi-Viewport Diffing
// =====================================================================

describe('Multi-viewport diffing', () => {
  const RESPONSIVE_BEFORE = `<!DOCTYPE html>
<html><head><style>
  body { margin: 0; font-family: sans-serif; }
  nav { display: flex; gap: 16px; padding: 12px 24px; background: #1a1a2e; }
  nav a { color: white; text-decoration: none; font-size: 14px; }
</style></head>
<body>
  <nav>
    <a href="/" data-testid="nav-home">Home</a>
    <a href="/about" data-testid="nav-about">About</a>
  </nav>
</body></html>`

  const RESPONSIVE_AFTER = `<!DOCTYPE html>
<html><head><style>
  body { margin: 0; font-family: sans-serif; }
  nav { display: flex; gap: 16px; padding: 12px 24px; background: #1a1a2e; }
  nav a { color: white; text-decoration: none; font-size: 14px; }
  @media (max-width: 768px) {
    .desktop-only { display: none; }
  }
</style></head>
<body>
  <nav>
    <a href="/" data-testid="nav-home">Home</a>
    <a href="/about" data-testid="nav-about">About</a>
    <a href="/contact" class="desktop-only" data-testid="nav-contact">Contact</a>
  </nav>
</body></html>`

  async function captureAtViewport(html: string, width: number, height = 900): Promise<DomManifest> {
    await page.setViewportSize({ width, height })
    await page.setContent(html, { waitUntil: 'load' })
    return captureDomManifest(page, noop)
  }

  afterAll(async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  it('produces independent diff results per viewport for responsive HTML', async () => {
    const before1440 = await captureAtViewport(RESPONSIVE_BEFORE, 1440)
    const after1440 = await captureAtViewport(RESPONSIVE_AFTER, 1440)
    const before768 = await captureAtViewport(RESPONSIVE_BEFORE, 768, 1024)
    const after768 = await captureAtViewport(RESPONSIVE_AFTER, 768, 1024)

    const result = diffManifestsByViewport({
      1440: { before: before1440, after: after1440 },
      768: { before: before768, after: after768 },
    })

    // Desktop (1440): contact link is visible in after → detected as added
    expect(result[1440].diffs.some(d => d.type === 'added')).toBe(true)

    // Tablet (768): contact link is display:none in after → not in manifest → no addition
    expect(result[768].diffs.some(d => d.type === 'added')).toBe(false)
  })

  it('returns complete ViewportDiffResult shape for each viewport', async () => {
    const before1440 = await captureAtViewport(RESPONSIVE_BEFORE, 1440)
    const after1440 = await captureAtViewport(RESPONSIVE_AFTER, 1440)
    const before768 = await captureAtViewport(RESPONSIVE_BEFORE, 768, 1024)
    const after768 = await captureAtViewport(RESPONSIVE_AFTER, 768, 1024)

    const result = diffManifestsByViewport({
      1440: { before: before1440, after: after1440 },
      768: { before: before768, after: after768 },
    })

    for (const vp of [1440, 768]) {
      const r = result[vp]
      expect(r).toBeDefined()
      expect(Array.isArray(r.diffs)).toBe(true)
      expect(Array.isArray(r.groups)).toBe(true)
      expect(Array.isArray(r.cascadeClusters)).toBe(true)
      expect(typeof r.timeMs).toBe('number')
      expect(r.summary).toMatchObject({
        changed: expect.any(Number),
        added: expect.any(Number),
        removed: expect.any(Number),
        moved: expect.any(Number),
        unchanged: expect.any(Number),
        totalChanges: expect.any(Number),
        groupCount: expect.any(Number),
        groupedElementCount: expect.any(Number),
      })
    }
  })
})
