#!/usr/bin/env node
// Walk every demo page and flag diffs that seem beyond the intentional mutation.
// Heuristic: for each case, examine what the mutation CSS/attributes were,
// then check if each reported diff's changed properties match.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const demoPath = join(__dirname, '..', 'demo', 'index.html')

const html = readFileSync(demoPath, 'utf-8')
const m = html.match(/window\.VR_DATA = (\{.*?\});/s)
const data = JSON.parse(m[1])

// For each page, classify each diff change as intended or noise
// Based on section/case name, we expect certain properties to change
const EXPECTED_PROPS = {
  'text content': ['text'],
  'text change on a button': ['text'],
  'heading text change': ['text'],
  'paragraph text change': ['text'],
  'nav link text change': ['text'],
  'text change on element': ['text'],
  'children count suppression': ['element'],
  'drops parent diff when only change is children count': ['element'],
  'font color': ['color'],
  'font-size': ['font-size'],
  'font-weight': ['font-weight'],
  'link color': ['color'],
  'text-decoration': ['text-decoration'],
  'background-color': ['background-color'],
  'transparent to opaque': ['background-color'],
  'status badge background': ['background-color', 'color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'padding change': ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'margin change': ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  'border-width': ['border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'border-color': ['border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-radius': ['border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
  'button padding + border-radius': ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
  'added element': ['element'],
  'removed element': ['element'],
  'added banner': ['element'],
  'removed button': ['element'],
  'element moved': ['element', 'color', 'font-size', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'display change': ['display'],
  'flex-direction': ['flex-direction', 'display'],
  'gap change': ['gap', 'row-gap', 'column-gap', 'display'],
  'explicit width': ['width'],
  'explicit height': ['height'],
  'color inherited': ['color'],
  'parent border change': ['border-width', 'border-color', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'inserted banner causes height cascade': ['element'],
  'padding change causes subpixel': ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'color change on link with heading': ['color'],
  'color change on plain link': ['color'],
  'groups multiple': ['background-color', 'color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'different fingerprints': ['color'],
  '3+ elements with same width': ['width'],
  'border-accent on sections': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-color', 'border-width', 'border-style', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style', 'border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
  'collapses identical quad border-radius': ['border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
  'does NOT collapse non-uniform border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
  'collapses identical quad border-color': ['border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'strips bbox': ['color', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'bbox-only shifts': ['height'],
  'table header': ['background-color', 'color'],
  'table cell padding': ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'hidden last column': ['element'],
  'active tab': ['border-bottom-color', 'color', 'border-color'],
  'BETA badge': ['element'],
  'footer background': ['background-color', 'color'],
  'input border-color': ['border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'box-shadow addition': ['box-shadow', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'sidebar width': ['width', 'min-width'],
  'border added to avatar': ['border-width', 'border-color', 'border-style', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
  'h3 color change': ['color'],
  'multiple mutations': ['text', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'heading rename + banner + button': ['text', 'element', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
  'added/removed elements score': ['element'],
  'text change (for scoring': ['text'],
  'size change (for scoring': ['width'],
  'same color in different formats': [],
  'opacity change': ['opacity'],
  'padding and margin-bottom increase': ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-bottom'],
  'nav background color darkening': ['background-color'],
  'new info row': ['element'],
  'filter chip added': ['element'],
  'breadcrumb nav removal': ['element'],
  'accessible name': ['text', 'color'],
  'progress bar background': ['background-color'],
  'transparent to light gray': ['background-color'],
  'empty body': [],
  'deeply nested': ['text'],
  'very small color': ['color', 'background-color'],
  'large number of identical': ['color'],
  'cascade cluster with 4+': ['width'],
  'does not cluster fewer': ['width'],
  'clusters by direction': ['width', 'element'],
  'children count suppression': ['element'],
  'suppresses position-only': [],
  'captures elements inside height:0': [],
  'detects style changes inside height': ['background-color'],
  'independent diff results': ['element'],
  'complete ViewportDiffResult': ['element'],
  'transform scale': ['transform'],
  'transform rotate': ['transform'],
  'transform translate': ['transform'],
  'flat to elevated': ['box-shadow'],
  'shadow intensity': ['box-shadow'],
  'z-index change': ['z-index'],
  'overflow hidden to visible': ['overflow-x', 'overflow-y', 'overflow'],
  'overflow visible to hidden': ['overflow-x', 'overflow-y', 'overflow'],
  'justify-content': ['justify-content'],
  'align-items': ['align-items'],
  'grid-template-columns': ['grid-template-columns', 'display'],
  'SVG wrapper color': ['color', 'fill'],
  'SVG shape swap': ['element'],
  'CSS variable change': ['color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'identical re-render': [],
  'whitespace-only': [],
  'explicit value matches inherited': [],
  'browser-defaulted properties': [],
  'explicit width change scores higher': ['width'],
  'implicit child width change': ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'width'],
  'explicit height change scores higher': ['height'],
  'font-size change on child suppresses': ['font-size'],
  'explicit height on parent survives': ['font-size', 'height', 'element'],
  'multi-level implicit height cascade': ['font-size'],
}

function matchCase(pageRole, pagePage) {
  // Match against role only (case name), not page.page (section name) which is too broad.
  // Prefer longest match to avoid "display" beating "flex-direction".
  const key = pageRole.toLowerCase()
  let best = null
  for (const [pat, props] of Object.entries(EXPECTED_PROPS)) {
    if (key.includes(pat.toLowerCase())) {
      if (!best || pat.length > best.pattern.length) best = { pattern: pat, props }
    }
  }
  return best
}

// "element" is a special marker for add/remove/structural changes
function isNoiseChange(change, expected) {
  if (expected.includes('element')) return false // anything goes for structural
  if (expected.includes(change.property)) return false
  return true
}

let noisyPages = 0
const noiseReport = []

for (const page of data.pages) {
  const vp = page.viewportDiffs[1440]
  if (!vp) continue

  const match = matchCase(page.role, page.page)
  if (!match) {
    noiseReport.push({ page: `${page.page} / ${page.role}`, issue: 'No expected-props mapping', diffs: [] })
    continue
  }

  const noisy = []
  for (const d of vp.diffs) {
    if (d.type === 'added' || d.type === 'removed' || d.type === 'moved') continue
    for (const ch of d.changes) {
      if (isNoiseChange(ch, match.props)) {
        noisy.push({ where: `${d.label} (${d.importance})`, prop: ch.property, before: ch.before, after: ch.after })
      }
    }
  }
  for (const g of vp.groups) {
    for (const ch of g.changes) {
      if (isNoiseChange(ch, match.props)) {
        noisy.push({ where: `[GROUP x${g.members.length}]`, prop: ch.property, before: ch.before, after: ch.after })
      }
    }
  }
  // cascade clusters: only flag if the cluster's property doesn't match expected
  for (const cl of vp.cascadeClusters || []) {
    const deltaProp = (cl.delta || '').split(' ')[0] // "width decreased ~40px" → "width"
    if (!match.props.includes(deltaProp) && !match.props.includes('element')) {
      noisy.push({ where: `[CASCADE ${cl.elementCount}]`, prop: cl.delta, before: '', after: '' })
    }
  }

  if (noisy.length > 0) {
    noisyPages++
    noiseReport.push({
      page: `${page.page} / ${page.role}`,
      pattern: match.pattern,
      expected: match.props.join(', ') || '(none)',
      noisy,
    })
  }
}

// CLI flags
const filterProp = process.argv.find(a => a.startsWith('--prop='))?.split('=')[1]
const summaryOnly = process.argv.includes('--summary')

console.log(`\n=== NOISE REPORT ===`)
console.log(`Pages with noise: ${noisyPages} / ${data.pages.length}`)
if (filterProp) console.log(`Filtering: only showing noise on property "${filterProp}"`)
console.log()
for (const r of noiseReport) {
  if (filterProp) {
    const filtered = r.noisy?.filter(n => n.prop.includes(filterProp))
    if (!filtered?.length) continue
    console.log(`\x1b[33m${r.page}\x1b[0m`)
    if (!summaryOnly) for (const n of filtered) {
      console.log(`  \x1b[31m✗\x1b[0m ${n.where}: ${n.prop}${n.before ? `: ${n.before} → ${n.after}` : ''}`)
    }
    continue
  }
  console.log(`\x1b[33m${r.page}\x1b[0m`)
  if (r.issue) { console.log(`  ⚠ ${r.issue}`); continue }
  if (summaryOnly) { console.log(`  ${r.noisy.length} noisy diffs`); continue }
  console.log(`  expected: ${r.expected}`)
  for (const n of r.noisy) {
    console.log(`  \x1b[31m✗\x1b[0m ${n.where}: ${n.prop}${n.before ? `: ${n.before} → ${n.after}` : ''}`)
  }
}
