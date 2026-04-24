import { type ElementNode, type DomManifest } from '../dom-manifest.js'

let _idx = 0

/** Reset the auto-incrementing idx counter between tests */
export function resetIdx() { _idx = 0 }

type LegacyNodeOptions = Partial<Omit<ElementNode, 'children' | 'authoredStyles'>> & {
  children?: ElementNode[]
  /**
   * Ergonomic shorthand for tests predating the authored-value migration:
   * list of prop names that should be treated as authored. The test helper
   * populates `authoredStyles` by copying the corresponding entries from
   * `styles` — the typical case where the authored and computed values agree.
   */
  explicitProps?: string[]
  authoredStyles?: Record<string, string>
}

/** Build a minimal ElementNode with sensible defaults */
export function el(tag: string, opts: LegacyNodeOptions = {}): ElementNode {
  const node: ElementNode = {
    idx: opts.idx ?? _idx++,
    tag,
    id: opts.id ?? null,
    testId: opts.testId ?? null,
    role: opts.role ?? null,
    ariaLabel: opts.ariaLabel ?? null,
    accessibleName: opts.accessibleName ?? null,
    attrs: opts.attrs ?? {},
    text: opts.text ?? null,
    bbox: opts.bbox ?? { x: 0, y: 0, w: 100, h: 50 },
    styles: opts.styles ?? {},
    children: opts.children ?? [],
  }

  const authored: Record<string, string> = { ...(opts.authoredStyles ?? {}) }
  if (opts.explicitProps) {
    const styles = opts.styles ?? {}
    for (const prop of opts.explicitProps) {
      if (authored[prop] != null) continue
      const v = styles[prop]
      if (v != null) authored[prop] = v
    }
  }
  if (Object.keys(authored).length > 0) node.authoredStyles = authored

  if (opts.pseudoStateRules) node.pseudoStateRules = opts.pseudoStateRules
  return node
}

/** Wrap a root ElementNode into a DomManifest */
export function manifest(root: ElementNode): DomManifest {
  let count = 0
  function walk(n: ElementNode) { count++; n.children.forEach(walk) }
  walk(root)
  return {
    capturedAt: '2026-04-06T00:00:00.000Z',
    captureTimeMs: 0,
    url: 'https://test.local',
    viewportWidth: 1440,
    viewportHeight: 900,
    totalElements: count,
    root,
  }
}
