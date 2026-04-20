import { type ElementNode, type DomManifest } from './dom-manifest.js'
import { type MatchResult } from './match.js'

// ─── Types ──────────────────────────────────────────────────────────

export type ChangeCategory =
  | 'box-model'
  | 'typography'
  | 'visual'
  | 'layout'
  | 'grid'
  | 'position'
  | 'sizing'
  | 'other-style'
  | 'text'
  | 'bbox'
  | 'attribute'
  | 'structure'

export type Change = {
  category: ChangeCategory
  property: string
  before: string | null
  after: string | null
  description: string
}

export type ImportanceLevel = 'critical' | 'major' | 'moderate' | 'minor'

export type ElementDiff = {
  type: 'changed' | 'added' | 'removed' | 'moved' | 'moved+changed'
  beforeIdx: number | null
  afterIdx: number | null
  label: string
  selector: string
  changes: Change[]
  score: number
  importance: ImportanceLevel
}

export type DiffGroup = {
  fingerprint: string
  changes: Change[]
  type: ElementDiff['type']
  score: number
  importance: ImportanceLevel
  members: { label: string; beforeIdx: number | null; afterIdx: number | null }[]
}

export type DiffResult = {
  diffs: ElementDiff[]
  groups: DiffGroup[]
  summary: {
    changed: number
    added: number
    removed: number
    moved: number
    unchanged: number
    totalChanges: number
    groupCount: number
    groupedElementCount: number
  }
  timeMs: number
}

// ─── Style property → category mapping ──────────────────────────────

const STYLE_CATEGORIES: Record<string, ChangeCategory> = {}

for (const prop of [
  'width', 'height',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'box-sizing',
  'padding', 'margin',
]) STYLE_CATEGORIES[prop] = 'box-model'

for (const prop of [
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'word-spacing', 'text-align', 'text-decoration',
  'text-decoration-color', 'text-decoration-style', 'text-transform',
  'text-shadow', 'color', 'text-overflow',
]) STYLE_CATEGORIES[prop] = 'typography'

for (const prop of [
  'background-color', 'background-image', 'background-size', 'background-position',
  'opacity', 'box-shadow', 'outline-width', 'outline-style', 'outline-color',
  'filter', 'backdrop-filter',
]) STYLE_CATEGORIES[prop] = 'visual'

for (const prop of [
  'display', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'justify-content', 'align-items', 'align-self', 'align-content',
  'gap', 'column-gap', 'row-gap', 'order', 'float', 'clear',
]) STYLE_CATEGORIES[prop] = 'layout'

for (const prop of [
  'grid-template-columns', 'grid-template-rows', 'grid-template-areas',
  'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows',
  'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
]) STYLE_CATEGORIES[prop] = 'grid'

for (const prop of [
  'position', 'top', 'right', 'bottom', 'left', 'vertical-align',
]) STYLE_CATEGORIES[prop] = 'position'

for (const prop of [
  'z-index', 'overflow-x', 'overflow-y',
]) STYLE_CATEGORIES[prop] = 'visual'

for (const prop of [
  'min-width', 'max-width', 'min-height', 'max-height',
]) STYLE_CATEGORIES[prop] = 'sizing'

for (const prop of [
  'visibility', 'clip-path', 'object-fit', 'object-position',
  'transform', 'cursor', 'content', 'list-style-type', 'list-style-position',
]) STYLE_CATEGORIES[prop] = 'other-style'

// ─── Element labeling ───────────────────────────────────────────────

const FRAMEWORK_ID_RE = /^:r\d+:|^react-|^__next|^chakra-|^radix-/

function isUserAuthoredId(id: string | null): boolean {
  if (!id) return false
  return !FRAMEWORK_ID_RE.test(id)
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str
}

const TAG_DISPLAY: Record<string, string> = {
  a: 'Link', button: 'Button', input: 'Input', select: 'Select', textarea: 'Textarea',
  img: 'Image', picture: 'Picture', svg: 'Icon', video: 'Video', audio: 'Audio',
  table: 'Table', thead: 'Table Head', tbody: 'Table Body', tfoot: 'Table Foot',
  tr: 'Row', td: 'Cell', th: 'Header Cell',
  nav: 'Nav', header: 'Header', footer: 'Footer', main: 'Main', aside: 'Aside',
  section: 'Section', article: 'Article', form: 'Form', label: 'Label',
  h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading', h6: 'Heading',
  p: 'Text', span: 'Span', div: 'Container', ul: 'List', ol: 'List', li: 'List Item',
  fieldset: 'Fieldset', legend: 'Legend', dialog: 'Dialog',
}

function displayTag(tag: string): string {
  return TAG_DISPLAY[tag] || tag
}

/**
 * Human-readable label for an element. Priority:
 * 1. Accessible name  2. data-testid  3. role + text  4. aria-label
 * 5. name attr  6. User-authored id  7. role  8. text  9. classes  10. tag
 */
function elementLabel(node: ElementNode): string {
  const dt = displayTag(node.tag)

  if (node.accessibleName) {
    return `${dt} "${node.accessibleName}"`
  }
  if (node.testId) {
    return `${dt} [${node.testId}]`
  }
  if (node.role && node.text) {
    return `${dt} "${node.text}"`
  }
  if (node.ariaLabel) {
    return `${dt} "${node.ariaLabel}"`
  }
  if (node.attrs.name) {
    return `${dt} "${node.attrs.name}"`
  }
  if (isUserAuthoredId(node.id)) {
    return `${dt} #${node.id}`
  }
  if (node.role) {
    return `${dt} [${node.role}]`
  }
  if (node.text) {
    return `${dt} "${node.text}"`
  }

  const cls = node.attrs.class
  if (cls) {
    const classes = cls.split(/\s+/).filter(c => !c.startsWith('css-') && !c.startsWith('chakra-')).slice(0, 2)
    if (classes.length) return `${dt}.${classes.join('.')}`
  }

  return dt
}

/**
 * CSS-selector-like path for an element, shown in expanded details.
 */
function elementSelector(node: ElementNode, ancestorPath?: string[]): string {
  let sel = node.tag
  if (isUserAuthoredId(node.id)) sel += `#${node.id}`
  else if (node.testId) sel += `[data-testid="${node.testId}"]`
  else if (node.role) sel += `[role="${node.role}"]`

  if (ancestorPath && ancestorPath.length > 1) {
    const tail = ancestorPath.slice(-3, -1)
    if (tail.length > 0) return tail.join(' > ') + ' > ' + sel
  }
  return sel
}

/**
 * Disambiguate duplicate labels within a set of diffs by appending parent context.
 */
export function disambiguateLabels(
  diffs: ElementDiff[],
  beforeRoot: ElementNode | null,
  afterRoot: ElementNode | null,
): void {
  const labelCounts = new Map<string, number>()
  for (const d of diffs) {
    labelCounts.set(d.label, (labelCounts.get(d.label) || 0) + 1)
  }

  const dupes = new Set<string>()
  for (const [label, count] of labelCounts) {
    if (count > 1) dupes.add(label)
  }
  if (dupes.size === 0) return

  const beforeNames = buildNamedAncestorMap(beforeRoot)
  const afterNames = buildNamedAncestorMap(afterRoot)

  for (const d of diffs) {
    if (!dupes.has(d.label)) continue

    const idx = d.beforeIdx ?? d.afterIdx
    if (idx == null) continue

    const ancestorMap = d.beforeIdx != null ? beforeNames : afterNames
    const parentName = ancestorMap.get(idx)
    if (parentName) {
      d.label = `${d.label} (in ${parentName})`
    }
  }
}

function buildNamedAncestorMap(root: ElementNode | null): Map<number, string> {
  const map = new Map<number, string>()
  if (!root) return map

  function walk(node: ElementNode, nearestName: string | null) {
    const dt = displayTag(node.tag)
    const name = node.accessibleName ? `${dt} "${node.accessibleName}"`
      : node.testId ? `${dt} [${node.testId}]`
      : (node.role && node.text) ? `${dt} "${node.text}"`
      : node.attrs.name ? `${dt} "${node.attrs.name}"`
      : isUserAuthoredId(node.id) ? `${dt} #${node.id}`
      : null

    const current = name || nearestName
    for (const child of node.children) {
      if (current) map.set(child.idx, current)
      walk(child, current)
    }
  }

  walk(root, null)
  return map
}

// ─── Ancestor path computation ──────────────────────────────────────

function computeAncestorPaths(node: ElementNode, path: string[] = [], map: Map<number, string[]> = new Map()): Map<number, string[]> {
  const label = node.tag + (node.testId ? `[testid=${node.testId}]` : node.id ? `#${node.id}` : '')
  const current = [...path, label]
  map.set(node.idx, current)
  for (const child of node.children) {
    computeAncestorPaths(child, current, map)
  }
  return map
}

// ─── Diff logic ─────────────────────────────────────────────────────

function diffStyles(before: Record<string, string>, after: Record<string, string>): Change[] {
  const changes: Change[] = []
  const allProps = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const prop of allProps) {
    let bVal: string | null = before[prop] ?? null
    let aVal: string | null = after[prop] ?? null

    if (COLOR_PROPS.has(prop)) {
      bVal = bVal ? normalizeColor(bVal) : null
      aVal = aVal ? normalizeColor(aVal) : null
    }

    if (bVal === aVal) continue

    const category = STYLE_CATEGORIES[prop] || 'other-style'
    changes.push({
      category,
      property: prop,
      before: bVal,
      after: aVal,
      description: bVal && aVal
        ? `${prop}: ${bVal} → ${aVal}`
        : bVal
          ? `${prop}: ${bVal} (removed)`
          : `${prop}: ${aVal} (added)`,
    })
  }

  return changes
}

function diffBbox(before: ElementNode['bbox'], after: ElementNode['bbox']): Change[] {
  const changes: Change[] = []
  const dims: (keyof ElementNode['bbox'])[] = ['x', 'y', 'w', 'h']
  const labels: Record<string, string> = { x: 'x', y: 'y', w: 'width', h: 'height' }

  for (const dim of dims) {
    if (before[dim] !== after[dim]) {
      changes.push({
        category: 'bbox',
        property: labels[dim],
        before: `${before[dim]}px`,
        after: `${after[dim]}px`,
        description: `${labels[dim]}: ${before[dim]}px → ${after[dim]}px`,
      })
    }
  }

  return changes
}

function diffText(before: string | null, after: string | null): Change[] {
  if (before === after) return []
  return [{
    category: 'text',
    property: 'text',
    before,
    after,
    description: before && after
      ? `text: "${before.slice(0, 40)}" → "${after.slice(0, 40)}"`
      : before
        ? `text removed: "${before.slice(0, 40)}"`
        : `text added: "${after!.slice(0, 40)}"`,
  }]
}

function diffAttributes(before: Record<string, string>, after: Record<string, string>): Change[] {
  const changes: Change[] = []
  const SKIP = new Set(['class']) // class overlap is already a matching signal, too noisy to diff
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    if (SKIP.has(key)) continue
    const bVal = before[key] ?? null
    const aVal = after[key] ?? null
    if (bVal === aVal) continue

    changes.push({
      category: 'attribute',
      property: key,
      before: bVal,
      after: aVal,
      description: bVal && aVal
        ? `${key}: "${bVal.slice(0, 30)}" → "${aVal.slice(0, 30)}"`
        : bVal
          ? `${key} removed`
          : `${key} added: "${aVal!.slice(0, 30)}"`,
    })
  }

  return changes
}

function diffChildren(before: ElementNode[], after: ElementNode[]): Change[] {
  if (before.length === after.length) return []
  return [{
    category: 'structure',
    property: 'children',
    before: String(before.length),
    after: String(after.length),
    description: `children: ${before.length} → ${after.length}`,
  }]
}

function describeElement(node: ElementNode, ancestorPath?: string[]): string {
  const parts = [elementLabel(node)]
  if (node.bbox) parts.push(`${node.bbox.w}×${node.bbox.h}px at (${node.bbox.x},${node.bbox.y})`)
  if (node.children.length > 0) parts.push(`${node.children.length} children`)
  return parts.join(' — ')
}

// ─── Per-element change collapse ────────────────────────────────────

const BORDER_RADIUS_QUAD = [
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
]
const BORDER_WIDTH_QUAD = [
  'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width',
]
const BORDER_COLOR_QUAD = [
  'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color',
]
const BORDER_STYLE_QUAD = [
  'border-top-style', 'border-right-style',
  'border-bottom-style', 'border-left-style',
]
const PADDING_QUAD = [
  'padding-top', 'padding-right',
  'padding-bottom', 'padding-left',
]
const MARGIN_QUAD = [
  'margin-top', 'margin-right',
  'margin-bottom', 'margin-left',
]

// Props that default to `currentColor` — if they change in lockstep with `color`,
// no CSS rule touched them; they're just tracking the foreground. Includes the
// `border-color` shorthand produced by the border-color quad collapse (which runs
// before collapseForegroundColor).
const FOREGROUND_COLOR_BUNDLE = [
  'color',
  'text-decoration-color',
  'outline-color',
  'border-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
]

const COUPLED_PAIRS: [string, string][] = [
  ['line-height', 'height'],
  ['min-width', 'width'],
  ['min-height', 'height'],
]

/**
 * Collapse redundant changes within a single element:
 * - Border quad collapse: 4 identical corner/side changes → 1 shorthand
 * - Foreground color: absorb text-decoration-color / outline-color / border-*-color
 *   when they change in lockstep with color (they default to currentColor)
 * - Coupled properties: line-height+height with same before→after → 1
 */
export function collapseChanges(changes: Change[]): Change[] {
  let result = collapseQuad(changes, BORDER_RADIUS_QUAD, 'border-radius')
  result = collapseQuad(result, BORDER_WIDTH_QUAD, 'border-width')
  result = collapseQuad(result, BORDER_COLOR_QUAD, 'border-color')
  result = collapseQuad(result, BORDER_STYLE_QUAD, 'border-style')
  result = collapseQuad(result, PADDING_QUAD, 'padding')
  result = collapseQuad(result, MARGIN_QUAD, 'margin')
  result = collapseForegroundColor(result)
  result = collapseCoupledPairs(result)
  return result
}

function collapseQuad(changes: Change[], quad: string[], shorthand: string): Change[] {
  const quadChanges = quad.map(p => changes.find(c => c.property === p))
  if (quadChanges.some(c => !c)) return changes

  const first = quadChanges[0]!
  const allSame = quadChanges.every(c =>
    c!.before === first.before && c!.after === first.after
  )
  if (!allSame) return changes

  const collapsed: Change = {
    category: first.category,
    property: shorthand,
    before: first.before,
    after: first.after,
    description: `${shorthand}: ${first.before} → ${first.after}`,
  }

  const quadSet = new Set(quad)
  return [...changes.filter(c => !quadSet.has(c.property)), collapsed]
}

function collapseForegroundColor(changes: Change[]): Change[] {
  const colorChange = changes.find(c => c.property === 'color')
  if (!colorChange) return changes

  const absorbed = FOREGROUND_COLOR_BUNDLE.filter(p => {
    if (p === 'color') return false
    const c = changes.find(ch => ch.property === p)
    return c && c.before === colorChange.before && c.after === colorChange.after
  })
  if (absorbed.length === 0) return changes

  const removeSet = new Set(absorbed)
  return changes.filter(c => !removeSet.has(c.property))
}

function collapseCoupledPairs(changes: Change[]): Change[] {
  const result = [...changes]
  for (const [propA, propB] of COUPLED_PAIRS) {
    const a = result.find(c => c.property === propA)
    const b = result.find(c => c.property === propB)
    if (a && b && a.before === b.before && a.after === b.after) {
      const idx = result.indexOf(b)
      if (idx !== -1) result.splice(idx, 1)
    }
  }
  return result
}

// ─── Browser-default margin suppression ────────────────────────────

const DEFAULT_MARGIN_PROPS = new Set([
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
])

/**
 * Suppress margin changes that are just browser-default 1em scaling with font-size.
 * Elements like <p>, <h1>–<h6> have UA-stylesheet margins of 1em. When font-size
 * changes, computed margins scale proportionally — producing phantom diff changes.
 * If margin == font-size at both before and after states, the margin is a browser
 * default and the change is suppressed.
 */
function suppressDefaultMarginScaling(changes: Change[]): Change[] {
  const fontSizeChange = changes.find(c => c.property === 'font-size')
  if (!fontSizeChange) return changes

  const beforeFS = parsePx(fontSizeChange.before)
  const afterFS = parsePx(fontSizeChange.after)
  if (beforeFS == null || afterFS == null) return changes

  return changes.filter(c => {
    if (!DEFAULT_MARGIN_PROPS.has(c.property)) return true
    const beforeMargin = parsePx(c.before)
    const afterMargin = parsePx(c.after)
    if (beforeMargin == null || afterMargin == null) return true
    // margin == font-size at both states → browser default 1em
    return !(beforeMargin === beforeFS && afterMargin === afterFS)
  })
}

// ─── Diff scoring ───────────────────────────────────────────────────

const SCORE_WEIGHTS: Record<ChangeCategory, number> = {
  'structure': 100,
  'text': 70,
  'visual': 60,
  'typography': 60,
  'box-model': 40,
  'layout': 50,
  'grid': 40,
  'position': 30,
  'sizing': 30,
  'attribute': 20,
  'bbox': 5,
  'other-style': 15,
}

function parsePx(val: string | null): number | null {
  if (!val) return null
  const m = val.match(/^(-?[\d.]+)px$/)
  return m ? parseFloat(m[1]) : null
}

const CASCADE_PROPS = new Set(['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'])

function isTransparentColor(color: string | null): boolean {
  if (!color) return true
  if (color === 'transparent') return true
  const m = color.match(/^rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\s*\)$/)
  return m != null && parseFloat(m[1]) === 0
}

// ─── Color parsing & distance ────────────────────────────────────────

function parseColorToRgb(color: string | null): [number, number, number] | null {
  if (!color) return null
  const rgb = color.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/)
  if (rgb) return [parseFloat(rgb[1]), parseFloat(rgb[2]), parseFloat(rgb[3])]
  const oklch = color.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  if (oklch) return oklchToRgb(parseFloat(oklch[1]), parseFloat(oklch[2]), parseFloat(oklch[3]))
  const oklab = color.match(/^oklab\(\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/)
  if (oklab) return oklabToRgb(parseFloat(oklab[1]), parseFloat(oklab[2]), parseFloat(oklab[3]))
  const hsl = color.match(/^hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/)
  if (hsl) return hslToRgb(parseFloat(hsl[1]), parseFloat(hsl[2]), parseFloat(hsl[3]))
  const hex = color.match(/^#([0-9a-fA-F]{3,8})$/)
  if (hex) {
    const h = hex[1]
    if (h.length === 3) return [parseInt(h[0]+h[0], 16), parseInt(h[1]+h[1], 16), parseInt(h[2]+h[2], 16)]
    if (h.length >= 6) return [parseInt(h.slice(0,2), 16), parseInt(h.slice(2,4), 16), parseInt(h.slice(4,6), 16)]
  }
  return null
}

function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

  const gamma = (x: number) => x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x
  const clamp = (x: number) => Math.round(Math.max(0, Math.min(255, gamma(Math.max(0, x)) * 255)))

  return [clamp(lr), clamp(lg), clamp(lb)]
}

function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const hRad = H * Math.PI / 180
  return oklabToRgb(L, C * Math.cos(hRad), C * Math.sin(hRad))
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/**
 * Extract alpha channel from any CSS color string.
 * Handles rgba() comma syntax, oklch/oklab/hsl slash syntax, #rrggbbaa hex, and 'transparent'.
 */
function parseAlpha(color: string | null): number {
  if (!color) return 1
  if (color === 'transparent') return 0
  const rgbaComma = color.match(/^rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\s*\)$/)
  if (rgbaComma) return parseFloat(rgbaComma[1])
  const slashAlpha = color.match(/\s*\/\s*([\d.]+)\s*\)$/)
  if (slashAlpha) return parseFloat(slashAlpha[1])
  const hex = color.match(/^#([0-9a-fA-F]{8})$/)
  if (hex) return parseInt(hex[1].slice(6, 8), 16) / 255
  return 1
}

/**
 * Perceptual color distance including alpha.
 * Uses RGBA Euclidean distance where alpha scales the RGB contribution,
 * so rgb(59,59,59) vs rgba(0,0,0,0.77) correctly measures as a small
 * perceptual difference (both appear as similar grays on white).
 * Range: 0–441 (same as before, alpha differences add up to ~255 more).
 */
function colorDistance(before: string | null, after: string | null): number | null {
  const a = parseColorToRgb(before)
  const b = parseColorToRgb(after)
  if (!a || !b) return null
  const aAlpha = parseAlpha(before)
  const bAlpha = parseAlpha(after)
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]
  const da = (aAlpha - bAlpha) * 255
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da)
}

// ─── Color normalization ─────────────────────────────────────────────

const COLOR_PROPS = new Set([
  'color', 'background-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-color', 'text-decoration-color',
  'caret-color', 'column-rule-color',
])

/**
 * Normalize any CSS color value to canonical rgb()/rgba() notation.
 * Eliminates format-only false positives (e.g. oklch vs oklab vs rgb for the same color).
 */
function normalizeColor(value: string): string {
  if (value === 'transparent') return 'rgba(0, 0, 0, 0)'

  // Detect alpha: slash syntax (oklch/oklab/modern) or rgba comma syntax
  let alpha = 1
  const slashAlpha = value.match(/\s*\/\s*([\d.]+)\s*\)$/)
  if (slashAlpha) alpha = parseFloat(slashAlpha[1])
  const rgbaComma = value.match(/^rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\s*\)$/)
  if (rgbaComma) alpha = parseFloat(rgbaComma[1])

  if (alpha === 0) return 'rgba(0, 0, 0, 0)'

  const rgb = parseColorToRgb(value)
  if (!rgb) return value

  const [r, g, b] = rgb.map(Math.round)
  if (alpha < 1) return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`
  return `rgb(${r}, ${g}, ${b})`
}

// ─── Per-change scoring ──────────────────────────────────────────────

// Properties that fill more visual area than their category peers
const PROPERTY_DOMINANCE: Record<string, number> = {
  'background-color': 80,
  'background-image': 80,
  'opacity': 70,
}

function scoreChange(c: Change, explicitProps?: string[]): number {
  const base = PROPERTY_DOMINANCE[c.property] ?? SCORE_WEIGHTS[c.category] ?? 10

  // Transparent ↔ opaque background is adding/removing a visual surface
  if (c.property === 'background-color' && isTransparentColor(c.before) !== isTransparentColor(c.after)) {
    return 100
  }

  // Color magnitude: scale by perceptual distance (RGB euclidean, max ~441)
  const dist = colorDistance(c.before, c.after)
  if (dist != null) {
    if (dist < 5) return 2
    if (dist < 20) return Math.round(base * 0.3)
    if (dist < 80) return Math.round(base * 0.7)
    if (dist < 150) return base
    return Math.round(base * 1.5)
  }

  // Pixel magnitude: scale by delta size
  const bPx = parsePx(c.before)
  const aPx = parsePx(c.after)
  if (bPx != null && aPx != null) {
    const isCascade = CASCADE_PROPS.has(c.property) && (c.category === 'bbox' || c.category === 'box-model' || c.category === 'sizing')
    const isExplicit = explicitProps != null && explicitProps.includes(c.property)
    const effectiveBase = isCascade && !isExplicit ? Math.round(base * 0.4) : base
    const delta = Math.abs(aPx - bPx)
    if (delta <= 1) return 2
    if (delta <= 5) return Math.round(effectiveBase * 0.5)
    if (delta <= 20) return effectiveBase
    return Math.round(effectiveBase * 1.5)
  }

  return base
}

// ─── Visual area weighting ───────────────────────────────────────────

/** Scale score by element visual footprint — larger elements are more visually impactful. */
function areaMultiplier(area: number | undefined): number {
  if (area == null || area <= 0) return 1
  if (area < 1000) return 0.7
  if (area < 10000) return 0.85
  if (area < 50000) return 1.0
  if (area < 200000) return 1.2
  return 1.4
}

export function scoreDiff(diff: Pick<ElementDiff, 'type' | 'changes'>, area?: number, explicitProps?: string[]): number {
  if (diff.type === 'added' || diff.type === 'removed') return 100
  if (diff.type === 'moved' && diff.changes.length === 0) return 40

  // Diminishing returns: first change in each category scores full, subsequent 50%
  const categoryCounts = new Map<ChangeCategory, number>()
  let total = 0
  for (const c of diff.changes) {
    const count = categoryCounts.get(c.category) || 0
    const raw = scoreChange(c, explicitProps)
    total += count === 0 ? raw : Math.round(raw * 0.5)
    categoryCounts.set(c.category, count + 1)
  }

  total = Math.round(total * areaMultiplier(area))

  return Math.min(total, 200)
}

function scoreToImportance(score: number): ImportanceLevel {
  if (score >= 100) return 'critical'
  if (score >= 60) return 'major'
  if (score >= 25) return 'moderate'
  return 'minor'
}

// ─── Main diff function ─────────────────────────────────────────────

function buildIndex(root: ElementNode | null): Map<number, ElementNode> {
  const map = new Map<number, ElementNode>()
  if (!root) return map
  function walk(node: ElementNode) {
    map.set(node.idx, node)
    for (const child of node.children) walk(child)
  }
  walk(root)
  return map
}

/**
 * Post-process a raw DiffResult to reduce noise:
 * - Suppress descendants of removed/added elements (keep top-level only)
 * - Strip redundant `children` changes when the actual child add/remove is reported
 * - Drop elements whose only changes are bounding box shifts
 * - Drop redundant children-count-only changes
 * - Deduplicate ancestor diffs whose property changes are already reported on descendants
 */
export function consolidateDiffs(
  raw: DiffResult,
  before: DomManifest,
  after: DomManifest,
): DiffResult {
  const t0 = Date.now()

  const beforeParents = buildParentMap(before.root)
  const afterParents = buildParentMap(after.root)
  const beforeNodes = buildIndex(before.root)
  const afterNodes = buildIndex(after.root)

  function getArea(diff: ElementDiff): number | undefined {
    const node = diff.beforeIdx != null ? beforeNodes.get(diff.beforeIdx) : undefined
    return node ? node.bbox.w * node.bbox.h : undefined
  }

  function getExplicitProps(diff: ElementDiff): string[] | undefined {
    const bNode = diff.beforeIdx != null ? beforeNodes.get(diff.beforeIdx) : undefined
    const aNode = diff.afterIdx != null ? afterNodes.get(diff.afterIdx) : undefined
    const bExplicit = bNode?.explicitProps ?? []
    const aExplicit = aNode?.explicitProps ?? []
    const combined = [...new Set([...bExplicit, ...aExplicit])]
    return combined.length > 0 ? combined : undefined
  }

  // Pre-compute which elements have display property changes (for child suppression)
  const displayChangedAfterIdx = new Set<number>()
  const displayChangedBeforeIdx = new Set<number>()
  for (const diff of raw.diffs) {
    if (diff.changes.some(c => c.property === 'display')) {
      if (diff.afterIdx != null) displayChangedAfterIdx.add(diff.afterIdx)
      if (diff.beforeIdx != null) displayChangedBeforeIdx.add(diff.beforeIdx)
    }
  }

  const removedSet = new Set(raw.diffs.filter(d => d.type === 'removed').map(d => d.beforeIdx!))
  const addedSet = new Set(raw.diffs.filter(d => d.type === 'added').map(d => d.afterIdx!))

  const diffs: ElementDiff[] = []
  let suppressedCount = 0

  for (const diff of raw.diffs) {
    if (diff.type === 'removed' && diff.beforeIdx != null) {
      if (hasAncestorInSet(diff.beforeIdx, removedSet, beforeParents)) {
        suppressedCount++
        continue
      }
    }

    if (diff.type === 'added' && diff.afterIdx != null) {
      if (hasAncestorInSet(diff.afterIdx, addedSet, afterParents)) {
        suppressedCount++
        continue
      }
    }

    // Drop elements whose only changes are bbox or position (layout cascade noise)
    if ((diff.type === 'changed' || diff.type === 'moved+changed') && diff.changes.every(c => c.category === 'bbox' || c.category === 'position')) {
      suppressedCount++
      continue
    }

    let changes = diff.changes

    // Strip bbox/position noise from mixed changes (must happen BEFORE implicit
    // suppression so that bbox x/y don't prevent CASCADE_PROPS-only detection)
    if (changes.length > 0) {
      const meaningful = changes.filter(c => c.category !== 'bbox' && c.category !== 'position')
      if (meaningful.length > 0 && meaningful.length < changes.length) {
        changes = meaningful
      }
    }

    // Suppress implicit size changes per-property: strip individual CASCADE_PROPS
    // (width, height, min-*, max-*) changes when those properties are NOT in
    // explicitProps, even if the diff has other meaningful changes that should remain.
    // After stripping, re-score. If all changes stripped, suppress the entire diff.
    if ((diff.type === 'changed' || diff.type === 'moved+changed') &&
        changes.length > 0 &&
        changes.some(c => CASCADE_PROPS.has(c.property))) {
      const explicit = getExplicitProps(diff)
      const filtered = changes.filter(c => {
        if (!CASCADE_PROPS.has(c.property)) return true
        return explicit != null && explicit.includes(c.property)
      })
      if (filtered.length < changes.length) {
        changes = filtered
        if (changes.length === 0) {
          suppressedCount++
          continue
        }
      }
    }

    // Suppress implicit child dimensions from parent display type changes:
    // When a parent changes display (e.g., block→flex), children gain computed
    // width/height/min-* values they didn't have before (inline→block conversion).
    // Strip these from children that don't have those properties in explicitProps.
    if ((diff.type === 'changed' || diff.type === 'moved+changed') &&
        changes.length > 0 &&
        changes.some(c => CASCADE_PROPS.has(c.property))) {
      const afterParent = diff.afterIdx != null ? afterParents.get(diff.afterIdx) : undefined
      const beforeParent = diff.beforeIdx != null ? beforeParents.get(diff.beforeIdx) : undefined
      const parentHasDisplayChange =
        (afterParent != null && displayChangedAfterIdx.has(afterParent)) ||
        (beforeParent != null && displayChangedBeforeIdx.has(beforeParent))

      if (parentHasDisplayChange) {
        const explicit = getExplicitProps(diff)
        const filtered = changes.filter(c => {
          if (!CASCADE_PROPS.has(c.property)) return true
          return explicit != null && explicit.includes(c.property)
        })
        if (filtered.length < changes.length) {
          changes = filtered
          if (changes.length === 0) {
            suppressedCount++
            continue
          }
        }
      }
    }

    // Strip `children` count change when the actual child add/remove is already a diff item
    if (changes.some(c => c.property === 'children')) {
      const hasReportedChildChange = childHasReportedAddOrRemove(diff, addedSet, removedSet, afterNodes, beforeNodes)
      if (hasReportedChildChange) {
        changes = changes.filter(c => c.property !== 'children')
        if (changes.length === 0) {
          suppressedCount++
          continue
        }
      }
    }

    // Suppress browser-default margin scaling: if font-size changed and
    // a margin value equals font-size at both before/after states, the
    // margin is just the UA default 1em scaling with font-size.
    if (changes.length > 1) {
      const suppressed = suppressDefaultMarginScaling(changes)
      if (suppressed.length < changes.length) {
        changes = suppressed
        if (changes.length === 0) {
          suppressedCount++
          continue
        }
      }
    }

    // Apply per-element change collapse
    if (changes.length > 1) {
      const collapsed = collapseChanges(changes)
      if (collapsed.length < changes.length) {
        changes = collapsed
      }
    }

    // Drop redundant children-count-only changes
    if (diff.type === 'changed' && changes.length === 1 && changes[0].property === 'children') {
      suppressedCount++
      continue
    }

    if (changes !== diff.changes) {
      const score = scoreDiff({ type: diff.type, changes }, getArea(diff), getExplicitProps(diff))
      diffs.push({ ...diff, changes, score, importance: scoreToImportance(score) })
    } else {
      diffs.push(diff)
    }
  }

  // --- Pass 2: deduplicate ancestor property changes already on descendants ---
  const deduped = deduplicateAncestorChanges(diffs, afterParents, beforeParents, beforeNodes, afterNodes)

  disambiguateLabels(deduped, before.root, after.root)
  deduped.sort((a, b) => b.score - a.score)

  const finalSuppressed = suppressedCount + (diffs.length - deduped.length)

  const { groups, ungrouped } = buildFingerprintGroups(deduped)

  const totalChanges = ungrouped.reduce((sum, d) => sum + d.changes.length, 0)
    + groups.reduce((sum, g) => sum + g.changes.length * g.members.length, 0)

  return {
    diffs: ungrouped,
    groups,
    summary: {
      changed: deduped.filter(d => d.type === 'changed').length,
      added: deduped.filter(d => d.type === 'added').length,
      removed: deduped.filter(d => d.type === 'removed').length,
      moved: deduped.filter(d => d.type === 'moved' || d.type === 'moved+changed').length,
      unchanged: raw.summary.unchanged + finalSuppressed,
      totalChanges,
      groupCount: groups.length,
      groupedElementCount: groups.reduce((sum, g) => sum + g.members.length, 0),
    },
    timeMs: Date.now() - t0,
  }
}

/**
 * Check if a parent diff's children change is explained by a child that's
 * already reported as added or removed.
 */
function childHasReportedAddOrRemove(
  parentDiff: ElementDiff,
  addedSet: Set<number>,
  removedSet: Set<number>,
  afterNodes: Map<number, ElementNode>,
  beforeNodes: Map<number, ElementNode>,
): boolean {
  if (parentDiff.afterIdx != null) {
    const afterNode = afterNodes.get(parentDiff.afterIdx)
    if (afterNode?.children.some(c => addedSet.has(c.idx))) return true
  }
  if (parentDiff.beforeIdx != null) {
    const beforeNode = beforeNodes.get(parentDiff.beforeIdx)
    if (beforeNode?.children.some(c => removedSet.has(c.idx))) return true
  }
  return false
}

/**
 * When a parent and descendant both report the same property change
 * (same property, same before→after values), strip it from the ancestor.
 * The descendant's diff is more specific and useful. If all changes are
 * stripped from the ancestor, remove it entirely.
 *
 * Only applies to properties that genuinely cascade between ancestors and
 * descendants via CSS inheritance or layout flow. Properties like border,
 * background, box-shadow, outline, etc. are NOT inheritable — if both an
 * ancestor and descendant have the same border change, they were styled
 * independently and both should be reported.
 */

const DEDUP_ELIGIBLE_PROPERTIES = new Set([
  // CSS-inheritable properties (parent value flows to children)
  'color', 'font-family', 'font-size', 'font-style', 'font-weight',
  'font-variant', 'letter-spacing', 'line-height', 'text-align',
  'text-indent', 'text-transform', 'text-decoration', 'text-shadow',
  'white-space', 'word-spacing', 'visibility', 'cursor', 'direction',
  'list-style', 'list-style-type', 'list-style-position', 'list-style-image',
  // Collapsed display names used by the diff engine
  'foreground color',
  // Layout-cascading properties (child size changes cause parent computed size changes)
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
])

function deduplicateAncestorChanges(
  diffs: ElementDiff[],
  afterParents: Map<number, number>,
  beforeParents: Map<number, number>,
  beforeNodes?: Map<number, ElementNode>,
  afterNodes?: Map<number, ElementNode>,
): ElementDiff[] {
  type ChangeFP = string
  const afterChangesByIdx = new Map<number, Set<ChangeFP>>()
  const beforeChangesByIdx = new Map<number, Set<ChangeFP>>()

  function changeFP(c: Change): ChangeFP {
    return `${c.category}|${c.property}|${c.before ?? ''}|${c.after ?? ''}`
  }

  for (const diff of diffs) {
    if (diff.type === 'added' || diff.type === 'removed') continue
    const fps = new Set(diff.changes.filter(c => DEDUP_ELIGIBLE_PROPERTIES.has(c.property)).map(changeFP))
    if (diff.afterIdx != null) afterChangesByIdx.set(diff.afterIdx, fps)
    if (diff.beforeIdx != null) beforeChangesByIdx.set(diff.beforeIdx, fps)
  }

  function hasDescendantWithChange(idx: number, fp: ChangeFP, parentMap: Map<number, number>, changeMap: Map<number, Set<ChangeFP>>): boolean {
    for (const [elemIdx, fps] of changeMap) {
      if (elemIdx === idx) continue
      if (!fps.has(fp)) continue
      let cur = parentMap.get(elemIdx)
      while (cur != null) {
        if (cur === idx) return true
        cur = parentMap.get(cur)
      }
    }
    return false
  }

  const result: ElementDiff[] = []
  for (const diff of diffs) {
    if (diff.type === 'added' || diff.type === 'removed') {
      result.push(diff)
      continue
    }

    const remaining = diff.changes.filter(c => {
      if (!DEDUP_ELIGIBLE_PROPERTIES.has(c.property)) return true
      const fp = changeFP(c)
      if (diff.afterIdx != null && hasDescendantWithChange(diff.afterIdx, fp, afterParents, afterChangesByIdx)) return false
      if (diff.beforeIdx != null && hasDescendantWithChange(diff.beforeIdx, fp, beforeParents, beforeChangesByIdx)) return false
      return true
    })

    if (remaining.length === 0) continue
    if (remaining.length === diff.changes.length) {
      result.push(diff)
    } else {
      const bNode = diff.beforeIdx != null ? beforeNodes?.get(diff.beforeIdx) : undefined
      const aNode = diff.afterIdx != null ? afterNodes?.get(diff.afterIdx) : undefined
      const bEx = bNode?.explicitProps ?? []
      const aEx = aNode?.explicitProps ?? []
      const combined = [...new Set([...bEx, ...aEx])]
      const elExplicit = combined.length > 0 ? combined : undefined
      const score = scoreDiff({ type: diff.type, changes: remaining }, undefined, elExplicit)
      result.push({ ...diff, changes: remaining, score, importance: scoreToImportance(score) })
    }
  }

  return result
}

// ─── Fingerprint grouping ────────────────────────────────────────────

function changeFingerprint(c: Change): string {
  return `${c.category}|${c.property}|${c.before ?? ''}|${c.after ?? ''}`
}

function diffFingerprint(d: ElementDiff): string {
  return d.type + ':' + d.changes.map(changeFingerprint).sort().join(';')
}

function buildFingerprintGroups(diffs: ElementDiff[]): { groups: DiffGroup[]; ungrouped: ElementDiff[] } {
  const fpMap = new Map<string, ElementDiff[]>()
  for (const d of diffs) {
    if (d.type === 'added' || d.type === 'removed') continue
    const fp = diffFingerprint(d)
    const arr = fpMap.get(fp) || []
    arr.push(d)
    fpMap.set(fp, arr)
  }

  const groups: DiffGroup[] = []
  const groupedSet = new Set<ElementDiff>()

  for (const [fp, members] of fpMap) {
    if (members.length < 2) continue
    const maxScore = Math.max(...members.map(m => m.score))
    groups.push({
      fingerprint: fp,
      changes: members[0].changes,
      type: members[0].type,
      score: maxScore,
      importance: scoreToImportance(maxScore),
      members: members.map(m => ({
        label: m.label,
        beforeIdx: m.beforeIdx,
        afterIdx: m.afterIdx,
      })),
    })
    for (const m of members) groupedSet.add(m)
  }

  groups.sort((a, b) => b.score - a.score || b.members.length - a.members.length)

  const ungrouped = diffs.filter(d => !groupedSet.has(d))
  return { groups, ungrouped }
}

function buildParentMap(root: ElementNode | null): Map<number, number> {
  const map = new Map<number, number>()
  if (!root) return map
  function walk(node: ElementNode) {
    for (const child of node.children) {
      map.set(child.idx, node.idx)
      walk(child)
    }
  }
  walk(root)
  return map
}

function hasAncestorInSet(idx: number, set: Set<number>, parentMap: Map<number, number>): boolean {
  let current = parentMap.get(idx)
  while (current != null) {
    if (set.has(current)) return true
    current = parentMap.get(current)
  }
  return false
}

/**
 * Produce semantic diffs for all matched, added, and removed elements.
 * Only reports elements that actually differ — unchanged matched pairs are excluded.
 */
export function diffManifests(
  before: DomManifest,
  after: DomManifest,
  matchResult: MatchResult,
): DiffResult {
  const t0 = Date.now()

  const beforeIdx = buildIndex(before.root)
  const afterIdx = buildIndex(after.root)

  const beforePaths = before.root ? computeAncestorPaths(before.root) : new Map<number, string[]>()
  const afterPaths = after.root ? computeAncestorPaths(after.root) : new Map<number, string[]>()

  const diffs: ElementDiff[] = []
  let unchanged = 0

  // Matched pairs: diff each one
  for (const pair of matchResult.matched) {
    const bNode = beforeIdx.get(pair.beforeIdx)
    const aNode = afterIdx.get(pair.afterIdx)
    if (!bNode || !aNode) continue

    const changes: Change[] = [
      ...diffStyles(bNode.styles, aNode.styles),
      ...diffBbox(bNode.bbox, aNode.bbox),
      ...diffText(bNode.text, aNode.text),
      ...diffAttributes(bNode.attrs, aNode.attrs),
      ...diffChildren(bNode.children, aNode.children),
    ]

    // Check if element moved (different ancestor paths)
    const bPath = beforePaths.get(pair.beforeIdx) || []
    const aPath = afterPaths.get(pair.afterIdx) || []
    const pathsMatch = bPath.length === aPath.length && bPath.every((p, i) => p === aPath[i])
    const moved = !pathsMatch

    if (changes.length === 0 && !moved) {
      unchanged++
      continue
    }

    let type: ElementDiff['type']
    if (moved && changes.length > 0) type = 'moved+changed'
    else if (moved) type = 'moved'
    else type = 'changed'

    const elArea = bNode.bbox.w * bNode.bbox.h
    const bExplicit = bNode.explicitProps ?? []
    const aExplicit = aNode.explicitProps ?? []
    const combined = [...new Set([...bExplicit, ...aExplicit])]
    const elExplicitProps = combined.length > 0 ? combined : undefined
    const score = scoreDiff({ type, changes }, elArea, elExplicitProps)
    diffs.push({
      type,
      beforeIdx: pair.beforeIdx,
      afterIdx: pair.afterIdx,
      label: elementLabel(bNode),
      selector: elementSelector(bNode, bPath),
      changes,
      score,
      importance: scoreToImportance(score),
    })
  }

  // Removed elements
  for (const idx of matchResult.removed) {
    const node = beforeIdx.get(idx)
    if (!node) continue
    diffs.push({
      type: 'removed',
      beforeIdx: idx,
      afterIdx: null,
      label: elementLabel(node),
      selector: elementSelector(node, beforePaths.get(idx)),
      changes: [{
        category: 'structure',
        property: 'element',
        before: describeElement(node, beforePaths.get(idx)),
        after: null,
        description: `removed: ${describeElement(node, beforePaths.get(idx))}`,
      }],
      score: 100,
      importance: 'critical',
    })
  }

  // Added elements
  for (const idx of matchResult.added) {
    const node = afterIdx.get(idx)
    if (!node) continue
    diffs.push({
      type: 'added',
      beforeIdx: null,
      afterIdx: idx,
      label: elementLabel(node),
      selector: elementSelector(node, afterPaths.get(idx)),
      changes: [{
        category: 'structure',
        property: 'element',
        before: null,
        after: describeElement(node, afterPaths.get(idx)),
        description: `added: ${describeElement(node, afterPaths.get(idx))}`,
      }],
      score: 100,
      importance: 'critical',
    })
  }

  const totalChanges = diffs.reduce((sum, d) => sum + d.changes.length, 0)

  return {
    diffs,
    groups: [],
    summary: {
      changed: diffs.filter((d) => d.type === 'changed').length,
      added: diffs.filter((d) => d.type === 'added').length,
      removed: diffs.filter((d) => d.type === 'removed').length,
      moved: diffs.filter((d) => d.type === 'moved' || d.type === 'moved+changed').length,
      unchanged,
      totalChanges,
      groupCount: 0,
      groupedElementCount: 0,
    },
    timeMs: Date.now() - t0,
  }
}
