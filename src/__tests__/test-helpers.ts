import { type ElementNode, type DomManifest } from '../dom-manifest.js'

let _idx = 0

/** Reset the auto-incrementing idx counter between tests */
export function resetIdx() { _idx = 0 }

type NodeOptions = Partial<Omit<ElementNode, 'children'>> & { children?: ElementNode[] }

/** Build a minimal ElementNode with sensible defaults */
export function el(tag: string, opts: NodeOptions = {}): ElementNode {
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
  if (opts.explicitProps) node.explicitProps = opts.explicitProps
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
