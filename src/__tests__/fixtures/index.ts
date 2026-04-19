/**
 * Shared test fixtures — before/after HTML pairs for every pipeline integration test section.
 *
 * This module is the single source of truth for HTML fixtures.
 * Both `pipeline.integration.test.ts` and `npm run demo` import from here.
 *
 * Fixtures are pure data: each case is a { name, before, after } triple.
 * Assertions live in the test file, not here.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type TestCase = {
  name: string
  before: string
  after: string
}

export type TestSection = {
  name: string
  cases: TestCase[]
}

// ─── Base HTML pages ────────────────────────────────────────────────

export const BASE_PAGE = `<!DOCTYPE html>
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

export const TABLE_PAGE = `<!DOCTYPE html><html><head><style>
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

export const FORM_PAGE = `<!DOCTYPE html><html><head><style>
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

export const WRAPPER_HTML = `<!DOCTYPE html><html><head><style>
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

export const RESPONSIVE_BEFORE = `<!DOCTYPE html>
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

export const RESPONSIVE_AFTER = `<!DOCTYPE html>
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

// ─── Section fixtures ───────────────────────────────────────────────

// Section 1: Identical HTML
const s01: TestSection = {
  name: 'Identical HTML',
  cases: [
    { name: 'identical HTML produces zero diffs', before: BASE_PAGE, after: BASE_PAGE },
  ],
}

// Section 2: Text Content Changes
const s02: TestSection = {
  name: 'Text content changes',
  cases: [
    {
      name: 'simple text change on a button',
      before: BASE_PAGE,
      after: BASE_PAGE.replace('Get Started', 'Sign Up Now'),
    },
    {
      name: 'heading text change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace('<h2>Welcome</h2>', '<h2>Hello World</h2>'),
    },
    {
      name: 'paragraph text change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        'This is a sample page for testing visual regression.',
        'Updated description text here.',
      ),
    },
    {
      name: 'nav link text change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace('>About</a>', '>About Us</a>'),
    },
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .badge { display: inline-block; padding: 4px 12px; background: #059669; color: white;
               border: 1px solid #059669; border-radius: 16px; font-size: 12px; font-weight: 600; }
    </style></head><body>
      <span class="badge" data-testid="status">Active</span>
    </body></html>`
      return {
        name: 'text change on element with many properties',
        before: html,
        after: html.replace('>Active</span>', '>Inactive</span>'),
      }
    })(),
  ],
}

// Section 3: Color / Typography Changes
const s03: TestSection = {
  name: 'Color and typography changes',
  cases: [
    {
      name: 'font color change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '.card h2 { margin: 0 0 8px; font-size: 18px; color: #333; }',
        '.card h2 { margin: 0 0 8px; font-size: 18px; color: #e74c3c; }',
      ),
    },
    {
      name: 'font-size change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '.card p { margin: 0; color: #666; font-size: 14px; }',
        '.card p { margin: 0; color: #666; font-size: 18px; }',
      ),
    },
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .title { font-weight: 400; font-size: 20px; }
    </style></head><body>
      <h1 class="title" data-testid="title">Hello</h1>
    </body></html>`
      return {
        name: 'font-weight change',
        before: html,
        after: html.replace('font-weight: 400', 'font-weight: 700'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      a { color: rgb(0, 101, 204); font-size: 14px; }
    </style></head><body>
      <a href="/one" data-testid="link-1">First Link</a>
      <a href="/two" data-testid="link-2">Second Link</a>
    </body></html>`
      return {
        name: 'link color change to purple',
        before: html,
        after: html.replace(
          'a { color: rgb(0, 101, 204)',
          'a { color: rgb(124, 58, 237)',
        ),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      a { text-decoration: none; color: blue; }
    </style></head><body>
      <a href="/" data-testid="link">Click</a>
    </body></html>`
      return {
        name: 'text-decoration change',
        before: html,
        after: html.replace('text-decoration: none', 'text-decoration: underline'),
      }
    })(),
  ],
}

// Section 4: Background Color Changes
const s04: TestSection = {
  name: 'Background color changes',
  cases: [
    {
      name: 'background-color change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        'nav { display: flex; gap: 16px; padding: 12px 24px; background: #1a1a2e; }',
        'nav { display: flex; gap: 16px; padding: 12px 24px; background: #2d3436; }',
      ),
    },
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: transparent; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      return {
        name: 'transparent to opaque background',
        before: html,
        after: html.replace('background: transparent', 'background: #3b82f6'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .badge { display: inline-block; padding: 4px 12px; background: rgb(214, 247, 240);
               color: rgb(23, 106, 87); border: 1px solid #ddd; border-radius: 16px; font-size: 12px; }
    </style></head><body>
      <span class="badge" data-testid="status">Active</span>
    </body></html>`
      return {
        name: 'status badge background color change',
        before: html,
        after: html.replace('background: rgb(214, 247, 240)', 'background: rgb(5, 150, 105)')
          .replace('color: rgb(23, 106, 87)', 'color: white')
          .replace('border: 1px solid #ddd', 'border: 1px solid rgb(5, 150, 105)'),
      }
    })(),
  ],
}

// Section 5: Box Model Changes
const s05: TestSection = {
  name: 'Box model changes',
  cases: [
    {
      name: 'padding change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '.card { margin: 24px; padding: 16px;',
        '.card { margin: 24px; padding: 32px;',
      ),
    },
    {
      name: 'margin change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '.card { margin: 24px;',
        '.card { margin: 48px;',
      ),
    },
    {
      name: 'border-width change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '.card { margin: 24px; padding: 16px; border: 1px solid #ddd;',
        '.card { margin: 24px; padding: 16px; border: 3px solid #ddd;',
      ),
    },
    {
      name: 'border-color change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        'border: 1px solid #ddd;',
        'border: 1px solid #3b82f6;',
      ),
    },
    {
      name: 'border-radius change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace('border-radius: 8px;', 'border-radius: 16px;'),
    },
    {
      name: 'button padding + border-radius change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        'button { padding: 8px 16px; background: #4361ee; color: white; border: none; border-radius: 4px;',
        'button { padding: 10px 20px; background: #4361ee; color: white; border: none; border-radius: 8px;',
      ),
    },
  ],
}

// Section 6: Element Addition / Removal
const s06: TestSection = {
  name: 'Element addition and removal',
  cases: [
    {
      name: 'added element',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '</nav>',
        '  <a href="/blog" data-testid="nav-blog">Blog</a>\n  </nav>',
      ),
    },
    {
      name: 'removed element',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '<a href="/contact" data-testid="nav-contact">Contact</a>',
        '',
      ),
    },
    {
      name: 'added banner',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '</nav>',
        `</nav>
      <div data-testid="test-banner" style="background:#fef3c7;color:#92400e;padding:12px 24px;font-size:14px;font-weight:500;border-bottom:2px solid #f59e0b;">
        ⚠ System maintenance scheduled
      </div>`,
      ),
    },
    {
      name: 'removed button',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '<button data-testid="cta-button">Get Started</button>',
        '',
      ),
    },
    {
      name: 'added element with descendants (no separate additions)',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '</nav>',
        `</nav>
      <section data-testid="promo">
        <h3>New Feature</h3>
        <p>Check out our latest update</p>
        <button>Learn More</button>
      </section>`,
      ),
    },
    {
      name: 'removed element with descendants (no separate removals)',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        /<div class="card"[^]*?<\/div>/,
        '',
      ),
    },
  ],
}

// Section 7: Element Moved
const s07: TestSection = {
  name: 'Element moved',
  cases: [
    {
      name: 'element moved from nav to footer',
      before: BASE_PAGE,
      after: BASE_PAGE
        .replace('<a href="/contact" data-testid="nav-contact">Contact</a>', '')
        .replace(
          '<footer>',
          '<footer><a href="/contact" data-testid="nav-contact" style="color:#999;font-size:12px;">Contact</a> ',
        ),
    },
  ],
}

// Section 8: Layout / Display Changes
const s08: TestSection = {
  name: 'Layout and display changes',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .container { display: block; padding: 16px; }
    </style></head><body>
      <div class="container" data-testid="container">
        <span>A</span><span>B</span>
      </div>
    </body></html>`
      return {
        name: 'display change (block to flex)',
        before: html,
        after: html.replace('display: block', 'display: flex'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .row { display: flex; flex-direction: row; }
      .item { width: 100px; height: 50px; background: #eee; }
    </style></head><body>
      <div class="row" data-testid="row">
        <div class="item">A</div><div class="item">B</div>
      </div>
    </body></html>`
      return {
        name: 'flex-direction change',
        before: html,
        after: html.replace('flex-direction: row', 'flex-direction: column'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .row { display: flex; gap: 8px; }
      .item { width: 100px; height: 50px; background: #eee; }
    </style></head><body>
      <div class="row" data-testid="row">
        <div class="item">A</div><div class="item">B</div>
      </div>
    </body></html>`
      return {
        name: 'gap change',
        before: html,
        after: html.replace('gap: 8px', 'gap: 24px'),
      }
    })(),
  ],
}

// Section 9: Size Changes
const s09: TestSection = {
  name: 'Size changes',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      return {
        name: 'explicit width change',
        before: html,
        after: html.replace('width: 200px', 'width: 300px'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      return {
        name: 'explicit height change',
        before: html,
        after: html.replace('height: 100px', 'height: 200px'),
      }
    })(),
  ],
}

// Section 10: CSS Inheritance & Cascade
const s10: TestSection = {
  name: 'CSS inheritance and cascade',
  cases: [
    (() => {
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
      return {
        name: 'color inherited from parent to children',
        before: html,
        after: html.replace('.card { color: #333;', '.card { color: #e74c3c;'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .container { border: 1px solid #ddd; padding: 16px; }
      .child { width: auto; background: #eee; padding: 8px; }
    </style></head><body>
      <div class="container" data-testid="container">
        <div class="child" data-testid="child">Content here</div>
      </div>
    </body></html>`
      return {
        name: 'parent border change causes child width reflow',
        before: html,
        after: html.replace('border: 1px solid #ddd', 'border: 4px solid #3b82f6'),
      }
    })(),
    (() => {
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
      return {
        name: 'inserted banner causes height cascade',
        before: html,
        after: html.replace(
          '<div class="header"',
          `<div data-testid="banner" style="background:#fef3c7;padding:12px;font-size:14px;">Maintenance notice</div>
      <div class="header"`,
        ),
      }
    })(),
    (() => {
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
      return {
        name: 'padding change causes subpixel width changes on children',
        before: html,
        after: html.replace('.wrapper { padding: 16px;', '.wrapper { padding: 24px;'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      a { color: rgb(0, 101, 204); text-decoration: none; }
      a h3 { font-size: 16px; }
    </style></head><body>
      <a href="/page" data-testid="card-link">
        <h3 data-testid="card-title">Card Title</h3>
      </a>
    </body></html>`
      return {
        name: 'color change on link with heading child (deduplicateAncestorChanges)',
        before: html,
        after: html.replace('color: rgb(0, 101, 204)', 'color: rgb(124, 58, 237)'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      a { color: rgb(0, 101, 204); text-decoration: none; font-size: 14px; }
    </style></head><body>
      <a href="/page" data-testid="plain-link">Plain Link Text</a>
    </body></html>`
      return {
        name: 'color change on plain link without heading child',
        before: html,
        after: html.replace('color: rgb(0, 101, 204)', 'color: rgb(124, 58, 237)'),
      }
    })(),
  ],
}

// Section 11: Grouping (Fingerprint Groups)
const s11: TestSection = {
  name: 'Fingerprint grouping',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .badge { display: inline-block; padding: 4px 12px; background: rgb(214, 247, 240);
               color: rgb(23, 106, 87); border: 1px solid #ddd; border-radius: 16px; font-size: 12px; }
    </style></head><body>
      <span class="badge" data-testid="badge-1">Active</span>
      <span class="badge" data-testid="badge-2">Active</span>
      <span class="badge" data-testid="badge-3">Active</span>
    </body></html>`
      return {
        name: 'groups multiple elements with identical changes',
        before: html,
        after: html.replace(
          /background: rgb\(214, 247, 240\)/g,
          'background: rgb(5, 150, 105)',
        ).replace(
          /color: rgb\(23, 106, 87\)/g,
          'color: white',
        ).replace(
          /border: 1px solid #ddd/g,
          'border: 1px solid rgb(5, 150, 105)',
        ),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .a { color: red; font-size: 14px; }
      .b { color: blue; font-size: 14px; }
    </style></head><body>
      <div class="a" data-testid="div-a">A</div>
      <div class="b" data-testid="div-b">B</div>
    </body></html>`
      return {
        name: 'does not group elements with different fingerprints',
        before: html,
        after: html
          .replace('.a { color: red;', '.a { color: green;')
          .replace('.b { color: blue;', '.b { color: purple;'),
      }
    })(),
  ],
}

// Section 12: Cascade Clustering
const s12: TestSection = {
  name: 'Cascade clustering',
  cases: [
    (() => {
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
      return {
        name: '3+ elements with same width delta form cascade',
        before: html,
        after: html.replace('width: 800px', 'width: 700px'),
      }
    })(),
    (() => {
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
      return {
        name: 'border-accent on sections creates cascade in children',
        before: html,
        after: html.replace(
          'section { padding: 16px; margin: 8px; }',
          'section { padding: 16px; margin: 8px; border: 2px solid #3b82f6; border-radius: 12px; }',
        ),
      }
    })(),
  ],
}

// Section 13: Consolidation Behaviors
const s13: TestSection = {
  name: 'Consolidation',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; border-radius: 4px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      return {
        name: 'collapses identical quad border-radius into shorthand',
        before: html,
        after: html.replace('border-radius: 4px', 'border-radius: 16px'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px;
             border-top-left-radius: 4px; border-top-right-radius: 4px;
             border-bottom-left-radius: 4px; border-bottom-right-radius: 4px;
             background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      return {
        name: 'does NOT collapse non-uniform border-radius',
        before: html,
        after: html.replace('border-top-left-radius: 4px', 'border-top-left-radius: 16px')
          .replace('border-top-right-radius: 4px', 'border-top-right-radius: 16px'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; border: 2px solid #ddd; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      return {
        name: 'collapses identical quad border-color into shorthand',
        before: html,
        after: html.replace('border: 2px solid #ddd', 'border: 2px solid #3b82f6'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; color: black; padding: 8px; }
    </style></head><body>
      <div class="box" data-testid="box">Text</div>
    </body></html>`
      return {
        name: 'strips bbox from elements with meaningful style changes',
        before: html,
        after: html.replace('color: black', 'color: red').replace('padding: 8px', 'padding: 16px'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .spacer { height: 50px; }
      .target { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="spacer" data-testid="spacer"></div>
      <div class="target" data-testid="target">Content</div>
    </body></html>`
      return {
        name: 'suppresses pure bbox-only shifts',
        before: html,
        after: html.replace('.spacer { height: 50px; }', '.spacer { height: 100px; }'),
      }
    })(),
  ],
}

// Section 14: Table Mutations
const s14: TestSection = {
  name: 'Table mutations',
  cases: [
    {
      name: 'table header background and color change',
      before: TABLE_PAGE,
      after: TABLE_PAGE.replace(
        'th { background: #f5f5f5; color: #333;',
        'th { background: #1e293b; color: white;',
      ),
    },
    {
      name: 'table cell padding change',
      before: TABLE_PAGE,
      after: TABLE_PAGE.replace(
        'td { padding: 8px 12px;',
        'td { padding: 14px 16px;',
      ),
    },
    {
      name: 'hidden last column (display: none)',
      before: TABLE_PAGE,
      after: TABLE_PAGE.replace(
        '</style>',
        'th:last-child, td:last-child { display: none; }\n  </style>',
      ),
    },
  ],
}

// Section 15: Tab / Active State Changes
const s15: TestSection = {
  name: 'Tab and active state changes',
  cases: [
    (() => {
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
      return {
        name: 'active tab border and color change',
        before: html,
        after: html.replace(
          '.tab.active { border-bottom-color: #4361ee; color: #4361ee; }',
          '.tab.active { border-bottom-color: #8b5cf6; color: #8b5cf6; }',
        ),
      }
    })(),
  ],
}

// Section 16: Tooltip Badge Addition
const s16: TestSection = {
  name: 'Element insertion within existing elements',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      h1 { font-size: 24px; color: #333; }
    </style></head><body>
      <h1 data-testid="page-title">Dashboard</h1>
    </body></html>`
      return {
        name: 'BETA badge added inside heading',
        before: html,
        after: html.replace(
          '>Dashboard</h1>',
          '>Dashboard<span data-testid="beta-badge" style="background:#818cf8;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:8px;font-weight:700;">BETA</span></h1>',
        ),
      }
    })(),
  ],
}

// Section 17: Footer Background
const s17: TestSection = {
  name: 'Footer mutations',
  cases: [
    {
      name: 'footer background color change',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        'footer { padding: 16px; text-align: center; color: #999; font-size: 12px; }',
        'footer { padding: 16px; text-align: center; color: #9ca3af; font-size: 12px; background: #111827; }',
      ),
    },
  ],
}

// Section 18: Input Border Red
const s18: TestSection = {
  name: 'Form input mutations',
  cases: [
    {
      name: 'input border-color change (validation error)',
      before: FORM_PAGE,
      after: FORM_PAGE.replace(
        'input { padding: 8px 12px; border: 1px solid #ccc;',
        'input { padding: 8px 12px; border: 1px solid #ef4444;',
      ),
    },
    {
      name: 'box-shadow addition on input',
      before: FORM_PAGE,
      after: FORM_PAGE.replace(
        'input { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; width: 300px; }',
        'input { padding: 8px 12px; border: 1px solid #ef4444; border-radius: 4px; font-size: 14px; width: 300px; box-shadow: 0 0 0 1px #ef4444; }',
      ),
    },
  ],
}

// Section 19: Sidebar Width
const s19: TestSection = {
  name: 'Sidebar mutations',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; display: flex; }
      aside { width: 240px; min-width: 240px; background: #f5f5f5; padding: 16px; }
      main { flex: 1; padding: 16px; }
    </style></head><body>
      <aside data-testid="sidebar">Sidebar</aside>
      <main data-testid="main-content">Main content</main>
    </body></html>`
      return {
        name: 'sidebar width change',
        before: html,
        after: html.replace('width: 240px; min-width: 240px;', 'width: 280px; min-width: 280px;'),
      }
    })(),
  ],
}

// Section 20: Avatar Border
const s20: TestSection = {
  name: 'Avatar mutations',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .avatar { width: 48px; height: 48px; border-radius: 50%; }
    </style></head><body>
      <img class="avatar" data-testid="user-avatar"
           src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
           alt="User" />
    </body></html>`
      return {
        name: 'border added to avatar image',
        before: html,
        after: html.replace(
          '.avatar { width: 48px; height: 48px; border-radius: 50%; }',
          '.avatar { width: 48px; height: 48px; border-radius: 50%; border: 3px solid #8b5cf6; }',
        ),
      }
    })(),
  ],
}

// Section 21: H3 Section Color
const s21: TestSection = {
  name: 'Heading section color',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      h3 { color: #333; font-size: 16px; }
    </style></head><body>
      <h3 data-testid="section-1">Section One</h3>
      <p>Content</p>
      <h3 data-testid="section-2">Section Two</h3>
      <p>More content</p>
    </body></html>`
      return {
        name: 'h3 color change',
        before: html,
        after: html.replace('h3 { color: #333;', 'h3 { color: #1e40af;'),
      }
    })(),
  ],
}

// Section 22: Multiple Simultaneous Mutations
const s22: TestSection = {
  name: 'Multiple simultaneous mutations',
  cases: [
    {
      name: 'multiple mutations applied at once',
      before: BASE_PAGE,
      after: BASE_PAGE
        .replace('Welcome', 'Hello')
        .replace('Get Started', 'Sign Up')
        .replace('background: #1a1a2e;', 'background: #2d3436;')
        .replace('border: 1px solid #ddd;', 'border: 2px solid #3b82f6;'),
    },
    {
      name: 'heading rename + banner + button restyle (approvals pattern)',
      before: BASE_PAGE,
      after: BASE_PAGE
        .replace('<h2>Welcome</h2>', '<h2>Dashboard</h2>')
        .replace(
          '</nav>',
          `</nav><div data-testid="banner" style="background:#fef3c7;padding:12px;font-size:14px;">Notice</div>`,
        )
        .replace(
          'button { padding: 8px 16px; background: #4361ee; color: white; border: none; border-radius: 4px;',
          'button { padding: 10px 20px; background: #4361ee; color: white; border: none; border-radius: 8px;',
        ),
    },
  ],
}

// Section 23: Scoring and Importance
const s23: TestSection = {
  name: 'Scoring and importance',
  cases: [
    {
      name: 'added/removed elements score 100 (critical)',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        '<a href="/contact" data-testid="nav-contact">Contact</a>',
        '',
      ),
    },
    // "text changes score higher" sub-case: text change
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .a { font-size: 14px; }
      .b { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="a" data-testid="text-el">Hello</div>
      <div class="b" data-testid="box-el">Box</div>
    </body></html>`
      return {
        name: 'text change (for scoring comparison)',
        before: html,
        after: html.replace('>Hello<', '>Goodbye<'),
      }
    })(),
    // "text changes score higher" sub-case: size change
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .a { font-size: 14px; }
      .b { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="a" data-testid="text-el">Hello</div>
      <div class="b" data-testid="box-el">Box</div>
    </body></html>`
      return {
        name: 'size change (for scoring comparison)',
        before: html,
        after: html.replace('width: 200px', 'width: 210px'),
      }
    })(),
  ],
}

// Section 24: Color Normalization
const s24: TestSection = {
  name: 'Color normalization',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { color: rgb(255, 0, 0); background: #ff0000; }
    </style></head><body>
      <div class="box" data-testid="box">Red text</div>
    </body></html>`
      return {
        name: 'same color in different formats (no false positive)',
        before: html,
        after: html,
      }
    })(),
  ],
}

// Section 25: Opacity / Visibility Changes
const s25: TestSection = {
  name: 'Visibility and opacity',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; opacity: 1; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      return {
        name: 'opacity change',
        before: html,
        after: html.replace('opacity: 1', 'opacity: 0.5'),
      }
    })(),
  ],
}

// Section 26: Spacing Increase
const s26: TestSection = {
  name: 'Spacing increase',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .card { padding: 16px; margin-bottom: 8px; border: 1px solid #ddd; }
    </style></head><body>
      <div class="card" data-testid="card-1">Card 1</div>
      <div class="card" data-testid="card-2">Card 2</div>
    </body></html>`
      return {
        name: 'padding and margin-bottom increase',
        before: html,
        after: html.replace(
          '.card { padding: 16px; margin-bottom: 8px;',
          '.card { padding: 24px; margin-bottom: 16px;',
        ),
      }
    })(),
  ],
}

// Section 27: Nav Background Dark
const s27: TestSection = {
  name: 'Nav background mutation',
  cases: [
    {
      name: 'nav background color darkening',
      before: BASE_PAGE,
      after: BASE_PAGE.replace(
        'nav { display: flex; gap: 16px; padding: 12px 24px; background: #1a1a2e; }',
        'nav { display: flex; gap: 16px; padding: 12px 24px; background: #0d1117; }',
      ),
    },
  ],
}

// Section 28: Info Row Addition
const s28: TestSection = {
  name: 'Info row addition',
  cases: [
    {
      name: 'new info row added inside section',
      before: `<!DOCTYPE html><html><head><style>
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
    </body></html>`,
      after: `<!DOCTYPE html><html><head><style>
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
    </body></html>`,
    },
  ],
}

// Section 29: Filter Chip Addition
const s29: TestSection = {
  name: 'Filter chip addition',
  cases: [
    (() => {
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
      return {
        name: 'filter chip added inside toolbar',
        before: html,
        after: html.replace(
          '<span>Filters:</span>',
          '<span>Filters:</span><span class="chip" data-testid="active-filter">✕ Last 30 days</span>',
        ),
      }
    })(),
  ],
}

// Section 30: Breadcrumb Removal
const s30: TestSection = {
  name: 'Breadcrumb removal',
  cases: [
    (() => {
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
      return {
        name: 'breadcrumb nav removal',
        before: html,
        after: html.replace(
          /<nav class="breadcrumb"[^]*?<\/nav>/,
          '',
        ),
      }
    })(),
  ],
}

// Section 31: Accessible Names
const s31: TestSection = {
  name: 'Accessible names in diff labels',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      button { padding: 8px 16px; color: black; }
    </style></head><body>
      <button aria-label="Close dialog" data-testid="close-btn">X</button>
    </body></html>`
      return {
        name: 'uses accessible name in diff label for buttons',
        before: html,
        after: html.replace('color: black', 'color: red'),
      }
    })(),
  ],
}

// Section 32: Progress Bar Color
const s32: TestSection = {
  name: 'Progress bar mutations',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .progress { width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
      .progress-bar { width: 60%; height: 100%; background: #3b82f6; }
    </style></head><body>
      <div class="progress" data-testid="progress">
        <div class="progress-bar" role="progressbar" data-testid="progress-bar"></div>
      </div>
    </body></html>`
      return {
        name: 'progress bar background color change',
        before: html,
        after: html.replace(
          '.progress-bar { width: 60%; height: 100%; background: #3b82f6; }',
          '.progress-bar { width: 60%; height: 100%; background: #f59e0b; }',
        ),
      }
    })(),
  ],
}

// Section 33: Background Subtle
const s33: TestSection = {
  name: 'Subtle background change',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .content { padding: 24px; }
    </style></head><body>
      <div class="content" data-testid="content">
        <p>Some content here</p>
      </div>
    </body></html>`
      return {
        name: 'transparent to light gray background',
        before: html,
        after: html.replace(
          '.content { padding: 24px; }',
          '.content { padding: 24px; background: #f8fafc; }',
        ),
      }
    })(),
  ],
}

// Section 34: Edge Cases
const s34: TestSection = {
  name: 'Edge cases',
  cases: [
    {
      name: 'empty body',
      before: `<!DOCTYPE html><html><head></head><body></body></html>`,
      after: `<!DOCTYPE html><html><head></head><body></body></html>`,
    },
    (() => {
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
      return {
        name: 'deeply nested elements',
        before: html,
        after: html.replace('>Deep text<', '>Changed text<'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { color: rgb(100, 100, 100); font-size: 14px; padding: 8px; }
    </style></head><body>
      <div class="box" data-testid="box">Text</div>
    </body></html>`
      return {
        name: 'very small color difference (low score)',
        before: html,
        after: html.replace('rgb(100, 100, 100)', 'rgb(100, 100, 103)'),
      }
    })(),
    (() => {
      const items = Array.from({ length: 20 }, (_, i) =>
        `<div class="item" data-testid="item-${i}">Item ${i}</div>`
      ).join('\n')
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .item { padding: 8px; color: #333; font-size: 14px; border-bottom: 1px solid #eee; }
    </style></head><body>${items}</body></html>`
      return {
        name: 'large number of identical mutations get grouped',
        before: html,
        after: html.replace(
          '.item { padding: 8px; color: #333;',
          '.item { padding: 8px; color: #e74c3c;',
        ),
      }
    })(),
  ],
}

// Section 35: Cascade Cluster Structure (P1-5)
const s35: TestSection = {
  name: 'Cascade cluster structure',
  cases: [
    (() => {
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
      return {
        name: 'cascade cluster with 4+ width-decreased children',
        before: html,
        after: html.replace('width: 600px', 'width: 500px'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .a { width: 200px; background: #eee; padding: 8px; }
      .b { width: 300px; background: #ddd; padding: 8px; }
    </style></head><body>
      <div class="a" data-testid="a">A</div>
      <div class="b" data-testid="b">B</div>
    </body></html>`
      return {
        name: 'does not cluster fewer than 3 matching cascade changes',
        before: html,
        after: html
          .replace('.a { width: 200px', '.a { width: 180px')
          .replace('.b { width: 300px', '.b { width: 280px'),
      }
    })(),
    (() => {
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
      return {
        name: 'clusters by direction — different magnitudes same cluster',
        before: html,
        after: html
          .replace('.a { width: 400px', '.a { width: 350px')
          .replace('.b { width: 300px', '.b { width: 270px')
          .replace('.c { width: 200px', '.c { width: 160px'),
      }
    })(),
  ],
}

// Section 36: Children-count-only suppression (P1-9)
const s36: TestSection = {
  name: 'Children count suppression',
  cases: [
    (() => {
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
      return {
        name: 'drops parent diff when only change is children count',
        before: html,
        after: html.replace(
          '<div class="item" data-testid="item-2">Second</div>',
          `<div class="item" data-testid="item-2">Second</div>
        <div class="item" data-testid="item-3">Third</div>`,
        ),
      }
    })(),
  ],
}

// Section 37: Position-only suppression (P2-14)
const s37: TestSection = {
  name: 'Position-only suppression',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { position: relative; top: 10px; left: 20px; width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      return {
        name: 'suppresses position-only changes',
        before: html,
        after: html.replace('top: 10px; left: 20px', 'top: 30px; left: 40px'),
      }
    })(),
  ],
}

// Section 38: Zero-height wrapper promotion
const s38: TestSection = {
  name: 'Zero-height wrapper promotion',
  cases: [
    {
      name: 'captures elements inside height:0 wrapper',
      before: WRAPPER_HTML,
      after: WRAPPER_HTML,
    },
    {
      name: 'detects style changes inside height:0 wrapper',
      before: WRAPPER_HTML,
      after: WRAPPER_HTML.replace(
        'th { padding: 8px; background: #f0f0f0;',
        'th { padding: 8px; background: #1e293b; color: white;',
      ),
    },
  ],
}

// Section 39: Multi-Viewport Diffing
const s39: TestSection = {
  name: 'Multi-viewport diffing',
  cases: [
    {
      name: 'independent diff results per viewport',
      before: RESPONSIVE_BEFORE,
      after: RESPONSIVE_AFTER,
    },
    {
      name: 'complete ViewportDiffResult shape per viewport',
      before: RESPONSIVE_BEFORE,
      after: RESPONSIVE_AFTER,
    },
  ],
}

// Section 40: CSS Transforms
const s40: TestSection = {
  name: 'CSS transforms',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 100px; height: 100px; background: #3b82f6; transform: scale(1); }
    </style></head><body>
      <div class="box" data-testid="box">Scaled</div>
    </body></html>`
      return {
        name: 'transform scale change',
        before: html,
        after: html.replace('transform: scale(1)', 'transform: scale(1.5)'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .icon { width: 48px; height: 48px; background: #ef4444; transform: rotate(0deg); }
    </style></head><body>
      <div class="icon" data-testid="icon">R</div>
    </body></html>`
      return {
        name: 'transform rotate change',
        before: html,
        after: html.replace('transform: rotate(0deg)', 'transform: rotate(45deg)'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .slide { width: 200px; height: 50px; background: #10b981; transform: translateX(0); }
    </style></head><body>
      <div class="slide" data-testid="slide">Translated</div>
    </body></html>`
      return {
        name: 'transform translate change',
        before: html,
        after: html.replace('transform: translateX(0)', 'transform: translateX(20px)'),
      }
    })(),
  ],
}

// Section 41: Box-shadow Elevation
const s41: TestSection = {
  name: 'Box-shadow elevation',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .card { width: 300px; padding: 16px; background: white; border: 1px solid #e5e7eb; }
    </style></head><body>
      <div class="card" data-testid="card">Flat card</div>
    </body></html>`
      return {
        name: 'flat to elevated (shadow added)',
        before: html,
        after: html.replace(
          'border: 1px solid #e5e7eb; }',
          'border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); }',
        ),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .card { width: 300px; padding: 16px; background: white;
              box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    </style></head><body>
      <div class="card" data-testid="card">Card</div>
    </body></html>`
      return {
        name: 'shadow intensity increase',
        before: html,
        after: html.replace(
          'box-shadow: 0 1px 2px rgba(0,0,0,0.05)',
          'box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
        ),
      }
    })(),
  ],
}

// Section 42: Z-index Stacking
const s42: TestSection = {
  name: 'Z-index stacking',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .overlay { position: relative; z-index: 1; width: 200px; height: 100px;
                 background: #818cf8; color: white; padding: 8px; }
    </style></head><body>
      <div class="overlay" data-testid="overlay">Overlay</div>
    </body></html>`
      return {
        name: 'z-index change on positioned element',
        before: html,
        after: html.replace('z-index: 1', 'z-index: 50'),
      }
    })(),
  ],
}

// Section 43: Overflow Changes
const s43: TestSection = {
  name: 'Overflow changes',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .container { width: 200px; height: 100px; overflow: hidden; background: #f3f4f6; padding: 8px; }
      .long { width: 300px; }
    </style></head><body>
      <div class="container" data-testid="container">
        <div class="long" data-testid="content">This content is wider than its container</div>
      </div>
    </body></html>`
      return {
        name: 'overflow hidden to visible',
        before: html,
        after: html.replace('overflow: hidden', 'overflow: visible'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .container { width: 200px; height: 100px; overflow: visible; background: #f3f4f6; padding: 8px; }
    </style></head><body>
      <div class="container" data-testid="container">
        <p>Content here</p>
      </div>
    </body></html>`
      return {
        name: 'overflow visible to hidden',
        before: html,
        after: html.replace('overflow: visible', 'overflow: hidden'),
      }
    })(),
  ],
}

// Section 44: Flex/Grid Sub-properties
const s44: TestSection = {
  name: 'Flex and grid sub-properties',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .row { display: flex; justify-content: flex-start; padding: 8px; background: #f3f4f6; }
      .item { width: 60px; height: 40px; background: #6366f1; margin: 4px; }
    </style></head><body>
      <div class="row" data-testid="row">
        <div class="item">A</div><div class="item">B</div><div class="item">C</div>
      </div>
    </body></html>`
      return {
        name: 'justify-content change',
        before: html,
        after: html.replace('justify-content: flex-start', 'justify-content: space-between'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .row { display: flex; align-items: flex-start; height: 120px; background: #f3f4f6; padding: 8px; }
      .item { width: 60px; height: 40px; background: #6366f1; margin: 4px; }
    </style></head><body>
      <div class="row" data-testid="row">
        <div class="item">A</div><div class="item">B</div>
      </div>
    </body></html>`
      return {
        name: 'align-items change',
        before: html,
        after: html.replace('align-items: flex-start', 'align-items: center'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px; }
      .cell { background: #dbeafe; padding: 12px; }
    </style></head><body>
      <div class="grid" data-testid="grid">
        <div class="cell">A</div><div class="cell">B</div>
        <div class="cell">C</div><div class="cell">D</div>
      </div>
    </body></html>`
      return {
        name: 'grid-template-columns change',
        before: html,
        after: html.replace('grid-template-columns: 1fr 1fr', 'grid-template-columns: 2fr 1fr'),
      }
    })(),
  ],
}

// Section 45: SVG Changes
const s45: TestSection = {
  name: 'SVG changes',
  cases: [
    (() => {
      // SVG fill/stroke attributes are not tracked CSS properties.
      // Test icon swap via wrapper color change + size change.
      const before = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .icon-wrap { color: #3b82f6; display: inline-block; }
    </style></head><body>
      <span class="icon-wrap" data-testid="icon-wrap">
        <svg data-testid="icon" width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </span>
    </body></html>`
      const after = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .icon-wrap { color: #ef4444; display: inline-block; }
    </style></head><body>
      <span class="icon-wrap" data-testid="icon-wrap">
        <svg data-testid="icon" width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </span>
    </body></html>`
      return {
        name: 'SVG wrapper color change',
        before,
        after,
      }
    })(),
    (() => {
      const beforeHtml = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
    </style></head><body>
      <svg data-testid="icon" width="24" height="24" viewBox="0 0 24 24">
        <path d="M12 2L2 22h20L12 2z" fill="#f59e0b" data-testid="shape" />
      </svg>
    </body></html>`
      const afterHtml = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
    </style></head><body>
      <svg data-testid="icon" width="24" height="24" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#f59e0b" data-testid="shape" />
      </svg>
    </body></html>`
      return {
        name: 'SVG shape swap (triangle to rounded rect)',
        before: beforeHtml,
        after: afterHtml,
      }
    })(),
  ],
}

// Section 46: CSS Variable Cascade
const s46: TestSection = {
  name: 'CSS variable cascade',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      :root { --primary: #3b82f6; --text: #1f2937; }
      body { margin: 0; font-family: sans-serif; }
      .header { background: var(--primary); color: white; padding: 12px 24px; }
      .btn { background: var(--primary); color: white; padding: 8px 16px; border: none; border-radius: 4px; }
      .link { color: var(--primary); }
      .badge { display: inline-block; padding: 2px 8px; border: 1px solid var(--primary);
               color: var(--primary); border-radius: 12px; font-size: 12px; }
    </style></head><body>
      <div class="header" data-testid="header">App Title</div>
      <p><a class="link" href="#" data-testid="link">Learn more</a></p>
      <button class="btn" data-testid="btn">Action</button>
      <span class="badge" data-testid="badge">New</span>
    </body></html>`
      return {
        name: 'CSS variable change cascades to multiple children',
        before: html,
        after: html.replace('--primary: #3b82f6', '--primary: #8b5cf6'),
      }
    })(),
  ],
}

// Section 47: False-positive Resistance
const s47: TestSection = {
  name: 'False-positive resistance',
  cases: [
    (() => {
      // Sub-pixel differences: parent padding change so small that child bbox
      // shifts by <1px. If rounding is consistent, no diffs should appear.
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .wrap { padding: 10px; }
      .child { width: 100px; height: 50px; background: #eee; }
    </style></head><body>
      <div class="wrap" data-testid="wrap">
        <div class="child" data-testid="child">Content</div>
      </div>
    </body></html>`
      return {
        name: 'identical re-render produces zero diffs',
        before: html,
        after: html,
      }
    })(),
    (() => {
      // Whitespace-only text difference: browsers collapse whitespace in rendering,
      // so "Hello" and "  Hello  " should render identically.
      const before = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      p { font-size: 14px; color: #333; }
    </style></head><body>
      <p data-testid="text">Hello World</p>
    </body></html>`
      const after = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      p { font-size: 14px; color: #333; }
    </style></head><body>
      <p data-testid="text">  Hello World  </p>
    </body></html>`
      return {
        name: 'whitespace-only text difference (should suppress)',
        before,
        after,
      }
    })(),
    (() => {
      // Explicit value matches inherited default: child sets color explicitly
      // to the same value it would inherit. No visual difference.
      const before = `<!DOCTYPE html><html><head><style>
      body { margin: 0; color: #333; }
      .child { font-size: 14px; }
    </style></head><body>
      <div data-testid="parent">
        <span class="child" data-testid="child">Text</span>
      </div>
    </body></html>`
      const after = `<!DOCTYPE html><html><head><style>
      body { margin: 0; color: #333; }
      .child { font-size: 14px; color: #333; }
    </style></head><body>
      <div data-testid="parent">
        <span class="child" data-testid="child">Text</span>
      </div>
    </body></html>`
      return {
        name: 'explicit value matches inherited default (no visual diff)',
        before,
        after,
      }
    })(),
    (() => {
      // Browser-defaulted property: setting a property to the browser's default
      // value should not produce a diff vs. not setting it at all.
      const before = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      const after = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; visibility: visible; opacity: 1; }
    </style></head><body>
      <div class="box" data-testid="box">Content</div>
    </body></html>`
      return {
        name: 'browser-defaulted properties (visibility/opacity at defaults)',
        before,
        after,
      }
    })(),
  ],
}

// Section 48: Explicit vs Implicit Size Scoring
const s48: TestSection = {
  name: 'Explicit vs implicit size scoring',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="explicit-box">Content</div>
    </body></html>`
      return {
        name: 'explicit width change scores higher than cascade',
        before: html,
        after: html.replace('width: 200px', 'width: 300px'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .parent { width: 500px; padding: 16px; }
      .child { background: #eee; padding: 8px; }
    </style></head><body>
      <div class="parent" data-testid="parent">
        <div class="child" data-testid="child">Implicit width from parent</div>
      </div>
    </body></html>`
      return {
        name: 'implicit child width change from parent resize scores low',
        before: html,
        after: html.replace('.parent { width: 500px', '.parent { width: 400px'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .box { width: 200px; height: 100px; background: #eee; }
    </style></head><body>
      <div class="box" data-testid="explicit-box">Content</div>
    </body></html>`
      return {
        name: 'explicit height change scores higher than cascade',
        before: html,
        after: html.replace('height: 100px', 'height: 200px'),
      }
    })(),
  ],
}

// Section 49: Implicit ancestor size suppression
const s49: TestSection = {
  name: 'Implicit ancestor size suppression',
  cases: [
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .card { padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
      .card p { font-size: 14px; }
    </style></head><body>
      <div class="card" data-testid="card">
        <p data-testid="text">Some text content</p>
      </div>
    </body></html>`
      return {
        name: 'font-size change on child suppresses implicit height on parent',
        before: html,
        after: html.replace('.card p { font-size: 14px; }', '.card p { font-size: 20px; }'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .card { height: 200px; padding: 16px; border: 1px solid #ddd; }
      .card p { font-size: 14px; }
    </style></head><body>
      <div class="card" data-testid="card">
        <p data-testid="text">Some text content</p>
      </div>
    </body></html>`
      return {
        name: 'explicit height on parent survives when child font-size changes',
        before: html,
        after: html
          .replace('height: 200px', 'height: 250px')
          .replace('.card p { font-size: 14px; }', '.card p { font-size: 20px; }'),
      }
    })(),
    (() => {
      const html = `<!DOCTYPE html><html><head><style>
      body { margin: 0; }
      .wrapper { padding: 16px; }
      .inner { padding: 8px; }
      .inner span { font-size: 14px; }
    </style></head><body>
      <div class="wrapper" data-testid="wrapper">
        <div class="inner" data-testid="inner">
          <span data-testid="label">Label text</span>
        </div>
      </div>
    </body></html>`
      return {
        name: 'multi-level implicit height cascade all suppressed',
        before: html,
        after: html.replace('.inner span { font-size: 14px; }', '.inner span { font-size: 24px; }'),
      }
    })(),
  ],
}

// ─── Exported sections array ────────────────────────────────────────

export const sections: TestSection[] = [
  s01, s02, s03, s04, s05, s06, s07, s08, s09, s10,
  s11, s12, s13, s14, s15, s16, s17, s18, s19, s20,
  s21, s22, s23, s24, s25, s26, s27, s28, s29, s30,
  s31, s32, s33, s34, s35, s36, s37, s38, s39, s40,
  s41, s42, s43, s44, s45, s46, s47, s48, s49,
]

/** Lookup helper: find a section by name */
export function getSection(name: string): TestSection {
  const s = sections.find(s => s.name === name)
  if (!s) throw new Error(`Unknown fixture section: ${name}`)
  return s
}

/** Lookup helper: find a case within a section */
export function getCase(sectionName: string, caseName: string): TestCase {
  const s = getSection(sectionName)
  const c = s.cases.find(c => c.name === caseName)
  if (!c) throw new Error(`Unknown fixture case "${caseName}" in section "${sectionName}"`)
  return c
}
