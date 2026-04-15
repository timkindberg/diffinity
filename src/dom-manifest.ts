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

  log(`  DOM manifest: ${result.totalElements} elements, ${namesResolved} accessible names (${domWalkMs}ms walk + ${cdpMs}ms CDP = ${totalMs}ms)`)

  return {
    capturedAt: new Date().toISOString(),
    captureTimeMs: totalMs,
    ...result,
  }
}
