import { type Page } from 'playwright'

// ~90 visually meaningful computed style properties (see semantic-vr-prd.md appendix)
const VISUAL_STYLE_PROPS = [
  // Box Model
  'width', 'height',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'box-sizing',
  // Typography
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'word-spacing', 'text-align', 'text-decoration',
  'text-decoration-color', 'text-decoration-style', 'text-transform',
  'text-shadow', 'color', 'text-overflow',
  // Visual
  'background-color', 'background-image', 'background-size', 'background-position',
  'opacity', 'box-shadow', 'outline-width', 'outline-style', 'outline-color',
  'filter', 'backdrop-filter',
  // Layout / Flexbox
  'display', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'justify-content', 'align-items', 'align-self', 'align-content',
  'gap', 'column-gap', 'row-gap', 'order', 'float', 'clear',
  // Grid
  'grid-template-columns', 'grid-template-rows', 'grid-template-areas',
  'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows',
  'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
  // Positioning
  'position', 'top', 'right', 'bottom', 'left', 'z-index',
  'overflow-x', 'overflow-y', 'vertical-align',
  // Sizing constraints
  'min-width', 'max-width', 'min-height', 'max-height',
  // Other visual
  'visibility', 'clip-path', 'object-fit', 'object-position',
  'transform', 'cursor', 'content', 'list-style-type', 'list-style-position',
]

export type PseudoStateRule = {
  pseudoClasses: string[]
  properties: string[]
}

export type ElementNode = {
  idx: number
  tag: string
  id: string | null
  testId: string | null
  role: string | null
  ariaLabel: string | null
  accessibleName: string | null
  attrs: Record<string, string>
  text: string | null
  bbox: { x: number; y: number; w: number; h: number }
  styles: Record<string, string>
  explicitProps?: string[]
  pseudoStateRules?: PseudoStateRule[]
  children: ElementNode[]
}

export type DomManifest = {
  capturedAt: string
  captureTimeMs: number
  url: string
  viewportWidth: number
  viewportHeight: number
  totalElements: number
  root: ElementNode | null
}

/**
 * Browser-side function passed to page.evaluate().
 * Walks the visible DOM tree, capturing computed styles, bounding boxes,
 * text content, attributes, and a recursive structure signature per element.
 */
function captureManifestInBrowser(styleProps: string[]) {
  const SKIP_TAGS = new Set(['SCRIPT', 'NOSCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE', 'BASE', 'BR', 'HR'])
  const ATTR_PICK = ['name', 'href', 'src', 'type', 'placeholder', 'value', 'for', 'action', 'method']

  // React useId() produces non-deterministic IDs like :r7:, :rc:, :r1e: that change
  // between page loads. Normalize them to sequential placeholders by order of first
  // appearance so identical component trees produce identical manifests.
  const REACT_ID_RE = /:r[a-z0-9]+:/g
  const reactIdMap = new Map<string, string>()
  let reactIdCounter = 0
  function normalizeReactIds(value: string): string {
    return value.replace(REACT_ID_RE, (match) => {
      let replacement = reactIdMap.get(match)
      if (!replacement) {
        replacement = `:r${reactIdCounter++}:`
        reactIdMap.set(match, replacement)
      }
      return replacement
    })
  }

  let idx = 0

  type Node = {
    idx: number
    tag: string
    id: string | null
    testId: string | null
    role: string | null
    ariaLabel: string | null
    accessibleName: string | null
    attrs: Record<string, string>
    text: string | null
    bbox: { x: number; y: number; w: number; h: number }
    styles: Record<string, string>
    children: Node[]
  }

  function isVisible(el: Element): boolean {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    // Catch "visually hidden" pattern: 1×1px elements used for a11y (e.g. Chakra checkbox inputs)
    if (rect.width <= 1 && rect.height <= 1) return false
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    return true
  }

  function getDirectText(el: Element): string | null {
    let text = ''
    for (const node of el.childNodes) {
      if (node.nodeType === 3 /* TEXT_NODE */) {
        text += node.textContent || ''
      }
    }
    const trimmed = text.trim()
    return trimmed.length > 0 ? trimmed.slice(0, 500) : null
  }

  function collectChildren(el: Element): Node[] {
    const children: Node[] = []
    for (const child of el.children) {
      walk(child, children)
    }
    return children
  }

  function walk(el: Element, out: Node[]): void {
    if (SKIP_TAGS.has(el.tagName)) return

    if (!isVisible(el)) {
      // Element itself is invisible (e.g. height:0 wrapper) but may have
      // visible children that overflow. Promote them into the parent's list.
      collectChildren(el).forEach(c => out.push(c))
      return
    }

    const rect = el.getBoundingClientRect()
    const sx = window.scrollX
    const sy = window.scrollY

    const computed = getComputedStyle(el)
    const styles: Record<string, string> = {}
    for (const prop of styleProps) {
      styles[prop] = computed.getPropertyValue(prop)
    }

    const attrs: Record<string, string> = {}
    for (const name of ATTR_PICK) {
      const val = el.getAttribute(name)
      if (val != null) attrs[name] = val
    }
    const className = el.getAttribute('class')
    if (className) attrs['class'] = className

    const children = collectChildren(el)

    // Tag element so CDP AX tree can map back to our idx
    const currentIdx = idx++
    el.setAttribute('data-vr-idx', String(currentIdx))

    const rawId = el.id || null
    const normalizedId = rawId && REACT_ID_RE.test(rawId) ? normalizeReactIds(rawId) : rawId
    if (attrs['for'] && REACT_ID_RE.test(attrs['for'])) {
      attrs['for'] = normalizeReactIds(attrs['for'])
    }

    out.push({
      idx: currentIdx,
      tag: el.tagName.toLowerCase(),
      id: normalizedId,
      testId: el.getAttribute('data-testid') || null,
      role: el.getAttribute('role') || null,
      ariaLabel: el.getAttribute('aria-label') || null,
      accessibleName: null,
      attrs,
      text: getDirectText(el),
      bbox: {
        x: Math.round(rect.x + sx),
        y: Math.round(rect.y + sy),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
      styles,
      children,
    })
  }

  const roots: Node[] = []
  walk(document.body, roots)
  const root = roots.length === 1 ? roots[0] : null

  return {
    url: location.href,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    totalElements: idx,
    root,
  }
}

/**
 * Walk the CDP DOM tree to build a map of backendNodeId → data-vr-idx.
 * The DOM tree from CDP stores attributes as a flat [name, value, name, value, ...] array.
 */
function buildBackendNodeIdMap(node: any, map: Map<number, string> = new Map()): Map<number, string> {
  const attrs: string[] = node.attributes || []
  for (let i = 0; i < attrs.length; i += 2) {
    if (attrs[i] === 'data-vr-idx') {
      map.set(node.backendNodeId, attrs[i + 1])
      break
    }
  }
  for (const child of node.children || []) {
    buildBackendNodeIdMap(child, map)
  }
  return map
}

/**
 * Browser-side function passed to page.evaluate().
 * Walks document.styleSheets (rule-first) and inline styles to identify
 * which CSS properties were explicitly authored for each tagged element.
 * Returns a map of data-vr-idx → list of authored property names.
 */
function captureExplicitPropsInBrowser(styleProps: string[]) {
  const tracked = new Set(styleProps)
  const SIZE_PROPS = new Set(['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'])
  const AUTO_VALUES = new Set(['auto', 'initial', 'inherit', 'unset', 'revert', 'revert-layer'])
  const map = new Map<string, Set<string>>()

  function addProp(idx: string, prop: string, value?: string) {
    if (!tracked.has(prop)) return
    if (value && SIZE_PROPS.has(prop) && AUTO_VALUES.has(value.trim())) return
    let set = map.get(idx)
    if (!set) { set = new Set(); map.set(idx, set) }
    set.add(prop)
  }

  function walkRules(rules: CSSRuleList) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]
      if (rule instanceof CSSStyleRule) {
        let matches: NodeListOf<Element>
        try { matches = document.querySelectorAll(rule.selectorText) } catch { continue }
        for (const el of matches) {
          const idx = el.getAttribute('data-vr-idx')
          if (!idx) continue
          for (let j = 0; j < rule.style.length; j++) {
            const propName = rule.style[j]
            addProp(idx, propName, rule.style.getPropertyValue(propName))
          }
        }
      } else if ('cssRules' in rule) {
        walkRules((rule as CSSGroupingRule).cssRules)
      }
    }
  }

  for (const sheet of document.styleSheets) {
    try { walkRules(sheet.cssRules) } catch { continue }
  }

  // Inline styles
  for (const el of document.querySelectorAll('[data-vr-idx]')) {
    if (!(el instanceof HTMLElement)) continue
    const idx = el.getAttribute('data-vr-idx')!
    for (let i = 0; i < el.style.length; i++) {
      const propName = el.style[i]
      addProp(idx, propName, el.style.getPropertyValue(propName))
    }
  }

  // Serialize to plain object
  const result: Record<string, string[]> = {}
  for (const [idx, set] of map) {
    result[idx] = [...set]
  }
  return result
}

/** Merge explicit props into the manifest tree by idx. */
function mergeExplicitProps(node: ElementNode, propsMap: Record<string, string[]>) {
  const props = propsMap[String(node.idx)]
  if (props) node.explicitProps = props
  for (const child of node.children) {
    mergeExplicitProps(child, propsMap)
  }
}

/**
 * Browser-side function passed to page.evaluate().
 * Walks document.styleSheets for rules whose selector contains a tracked
 * pseudo-class (e.g. `:hover`, `:focus`). For each matching rule, strips the
 * pseudo-classes to find candidate elements and records which properties the
 * rule sets against each element's data-vr-idx.
 *
 * Used downstream to keep diffs in the main report list when a changed property
 * would also affect that element's `:hover` / `:focus` / etc. states — even if
 * static rendered pixels are identical.
 */
function capturePseudoStateRulesInBrowser(args: [string[], string[]]) {
  const [styleProps, statePseudos] = args
  const tracked = new Set(styleProps)

  const map = new Map<string, { pseudoClasses: string[]; properties: string[] }[]>()

  function extractPseudos(selector: string): string[] {
    const found = new Set<string>()
    for (const p of statePseudos) {
      const re = new RegExp(`(?<!:):${p}(?![a-z-])`)
      if (re.test(selector)) found.add(p)
    }
    return [...found]
  }

  function stripPseudos(selector: string): string {
    let out = selector
    for (const p of statePseudos) {
      const re = new RegExp(`(?<!:):${p}(?:\\([^)]*\\))?`, 'g')
      out = out.replace(re, '')
    }
    return out.trim()
  }

  function addRule(idx: string, pseudoClasses: string[], properties: string[]) {
    let list = map.get(idx)
    if (!list) { list = []; map.set(idx, list) }
    list.push({ pseudoClasses, properties })
  }

  function walkRules(rules: CSSRuleList) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]
      if (rule instanceof CSSStyleRule) {
        const pseudoClasses = extractPseudos(rule.selectorText)
        if (pseudoClasses.length === 0) continue

        const stripped = stripPseudos(rule.selectorText)
        if (!stripped) continue

        const properties: string[] = []
        for (let j = 0; j < rule.style.length; j++) {
          const propName = rule.style[j]
          if (tracked.has(propName)) properties.push(propName)
        }
        if (properties.length === 0) continue

        let matches: NodeListOf<Element>
        try { matches = document.querySelectorAll(stripped) } catch { continue }
        for (const el of matches) {
          const idx = el.getAttribute('data-vr-idx')
          if (!idx) continue
          addRule(idx, pseudoClasses, properties)
        }
      } else if ('cssRules' in rule) {
        walkRules((rule as CSSGroupingRule).cssRules)
      }
    }
  }

  for (const sheet of document.styleSheets) {
    try { walkRules(sheet.cssRules) } catch { continue }
  }

  const result: Record<string, { pseudoClasses: string[]; properties: string[] }[]> = {}
  for (const [idx, list] of map) result[idx] = list
  return result
}

/** Merge pseudo-state rule data into the manifest tree by idx. */
function mergePseudoStateRules(
  node: ElementNode,
  rulesMap: Record<string, { pseudoClasses: string[]; properties: string[] }[]>,
) {
  const rules = rulesMap[String(node.idx)]
  if (rules && rules.length > 0) node.pseudoStateRules = rules
  for (const child of node.children) {
    mergePseudoStateRules(child, rulesMap)
  }
}

/**
 * Interactive pseudo-classes tracked for the pseudo-state-sensitive classifier.
 * Structural pseudo-classes (`:nth-child`, `:first-of-type`, ...) are not
 * included — they describe static DOM position, not interactive state.
 */
const STATE_PSEUDO_CLASSES = [
  'hover', 'focus', 'focus-visible', 'focus-within', 'active', 'visited',
]

/** Merge accessible names into the manifest tree by idx. */
function mergeAccessibleNames(node: ElementNode, nameMap: Map<number, string>) {
  const name = nameMap.get(node.idx)
  if (name) node.accessibleName = name
  for (const child of node.children) {
    mergeAccessibleNames(child, nameMap)
  }
}

// AX node roles that don't correspond to DOM elements we capture
const SKIP_AX_ROLES = new Set(['StaticText', 'InlineTextBox', 'none', 'generic'])

/**
 * Capture a DOM manifest for the current page state.
 *
 * 1. page.evaluate() — walks visible DOM, captures styles/bbox/attrs, tags elements with data-vr-idx
 * 2. CDP DOM.getDocument — full DOM tree with backendNodeId + attributes (1 call)
 * 3. CDP Accessibility.getFullAXTree — AX tree with computed accessible names (1 call)
 * 4. Cross-reference: backendDOMNodeId → data-vr-idx → merge names into manifest
 */
export async function captureDomManifest(
  page: Page,
  log: (msg: string) => void,
): Promise<DomManifest> {
  // tsx/esbuild injects __name() calls into functions passed to page.evaluate()
  await page.evaluate(() => { (window as any).__name = (fn: any) => fn })

  const t0 = Date.now()
  const result = await page.evaluate(captureManifestInBrowser, VISUAL_STYLE_PROPS)
  const domWalkMs = Date.now() - t0

  // CSSOM pass: capture which properties were explicitly authored via stylesheets/inline,
  // plus pseudo-state rules (:hover, :focus, ...) so the visual-impact classifier can
  // keep pixel-identical diffs in the main list when a changed property also drives
  // an interactive state.
  const t1a = Date.now()
  if (result.root) {
    try {
      const explicitPropsMap = await page.evaluate(captureExplicitPropsInBrowser, VISUAL_STYLE_PROPS)
      mergeExplicitProps(result.root as ElementNode, explicitPropsMap)
    } catch (err) {
      log(`  CSSOM explicit props pass failed: ${err instanceof Error ? err.message : err}`)
    }
    try {
      const pseudoStateMap = await page.evaluate(
        capturePseudoStateRulesInBrowser,
        [VISUAL_STYLE_PROPS, STATE_PSEUDO_CLASSES] as [string[], string[]],
      )
      mergePseudoStateRules(result.root as ElementNode, pseudoStateMap)
    } catch (err) {
      log(`  CSSOM pseudo-state pass failed: ${err instanceof Error ? err.message : err}`)
    }
  }
  const cssomMs = Date.now() - t1a

  // CDP pass: get accessible names via the browser's W3C accessible name computation
  const t1 = Date.now()
  let namesResolved = 0
  if (result.root) {
    try {
      const client = await page.context().newCDPSession(page)

      const [domTree, axTree] = await Promise.all([
        client.send('DOM.getDocument', { depth: -1 }),
        client.send('Accessibility.getFullAXTree'),
      ])

      // backendNodeId → data-vr-idx string
      const backendToIdx = buildBackendNodeIdMap(domTree.root)

      // data-vr-idx (as number) → accessible name
      const nameMap = new Map<number, string>()
      for (const axNode of axTree.nodes) {
        if (!axNode.name?.value || !axNode.backendDOMNodeId) continue
        if (SKIP_AX_ROLES.has(axNode.role?.value)) continue
        const vrIdx = backendToIdx.get(axNode.backendDOMNodeId)
        if (vrIdx != null) {
          nameMap.set(parseInt(vrIdx), axNode.name.value)
        }
      }

      mergeAccessibleNames(result.root, nameMap)
      namesResolved = nameMap.size

      await client.detach()
    } catch (err) {
      log(`  CDP accessible name pass failed: ${err instanceof Error ? err.message : err}`)
    }
  }
  const cdpMs = Date.now() - t1
  const totalMs = Date.now() - t0

  log(`  DOM manifest: ${result.totalElements} elements, ${namesResolved} accessible names (${domWalkMs}ms walk + ${cssomMs}ms CSSOM + ${cdpMs}ms CDP = ${totalMs}ms)`)

  return {
    capturedAt: new Date().toISOString(),
    captureTimeMs: totalMs,
    ...result,
  }
}
