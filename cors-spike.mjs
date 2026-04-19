import { chromium } from 'playwright'

// Simulate cross-origin by loading a real CDN stylesheet
const HTML = `<!DOCTYPE html>
<html><head>
  <!-- Cross-origin CSS (Google Fonts loads a stylesheet from fonts.googleapis.com) -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap">
  <!-- Cross-origin CSS framework -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <style>
    .my-card { padding: 24px; background: #f0f0f0; border-radius: 8px; }
    .my-card h2 { color: #333; font-size: 20px; }
  </style>
</head>
<body>
  <div class="container my-card mt-4">
    <h2 class="text-primary">Hello Bootstrap</h2>
    <p class="lead">This uses cross-origin CSS</p>
    <button class="btn btn-primary">Click me</button>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('about:blank')
await page.setContent(HTML, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

// Test 1: What does the in-browser approach see?
const browserResult = await page.evaluate(() => {
  const sheets = []
  let accessibleRules = 0
  let blockedSheets = 0
  
  for (const sheet of document.styleSheets) {
    let ruleCount = 0
    let blocked = false
    try {
      ruleCount = sheet.cssRules.length
      accessibleRules += ruleCount
    } catch(e) {
      blocked = true
      blockedSheets++
    }
    sheets.push({
      href: sheet.href?.slice(0, 80) || '(inline)',
      rules: ruleCount,
      blocked,
    })
  }
  
  return { sheets, accessibleRules, blockedSheets }
})

console.log('=== Stylesheet access ===')
for (const s of browserResult.sheets) {
  console.log(`  ${s.blocked ? '❌ BLOCKED' : '✅ OK'} (${s.rules} rules) ${s.href}`)
}
console.log(`\nAccessible rules: ${browserResult.accessibleRules}`)
console.log(`Blocked sheets: ${browserResult.blockedSheets}`)

// Test 2: What does CDP see for the same elements?
const client = await page.context().newCDPSession(page)
await client.send('DOM.enable')
await client.send('CSS.enable')
const { root } = await client.send('DOM.getDocument')

const selectors = ['.btn-primary', '.container', '.text-primary', '.lead', '.my-card h2']
for (const sel of selectors) {
  try {
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel })
    if (!nodeId) { console.log(`\n${sel}: not found`); continue }
    
    const matched = await client.send('CSS.getMatchedStylesForNode', { nodeId })
    const cdpProps = new Set()
    for (const match of matched.matchedCSSRules || []) {
      // Check if rule comes from cross-origin
      const origin = match.rule.origin
      for (const prop of match.rule.style.cssProperties) {
        if (!prop.implicit && prop.value) cdpProps.add(prop.name)
      }
    }
    
    // Compare with browser approach
    const browserProps = await page.evaluate(({ s }) => {
      const el = document.querySelector(s)
      if (!el) return []
      const explicit = new Set()
      for (const sheet of document.styleSheets) {
        let rules
        try { rules = sheet.cssRules } catch { continue }
        for (const rule of rules) {
          if (!(rule instanceof CSSStyleRule)) continue
          try { if (!el.matches(rule.selectorText)) continue } catch { continue }
          for (let i = 0; i < rule.style.length; i++) {
            explicit.add(rule.style[i])
          }
        }
      }
      for (let i = 0; i < (el.style?.length || 0); i++) {
        explicit.add(el.style[i])
      }
      return [...explicit].sort()
    }, { s: sel })
    
    const cdpList = [...cdpProps].sort()
    const onlyCdp = cdpList.filter(p => !browserProps.includes(p))
    
    console.log(`\n${sel}:`)
    console.log(`  CDP:     ${cdpList.length} props`)
    console.log(`  Browser: ${browserProps.length} props`)
    console.log(`  Missing from browser: ${onlyCdp.length} props`)
    if (onlyCdp.length > 0 && onlyCdp.length <= 15) {
      console.log(`  Examples: ${onlyCdp.slice(0, 10).join(', ')}`)
    }
  } catch(e) {
    console.log(`\n${sel}: error - ${e.message}`)
  }
}

await client.detach()
await browser.close()
