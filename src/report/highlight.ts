import type { Change } from './types'

export function getChangedProps(changes: Change[]): string[] {
  return changes.map(c => c.property)
}

function getIframes(): HTMLIFrameElement[] {
  return Array.from(document.querySelectorAll<HTMLIFrameElement>('#html-panes iframe'))
}

export function highlightElement(
  beforeIdx: number | undefined,
  afterIdx: number | undefined,
  type: string,
  changedProps: string[] = [],
) {
  clearHighlights()
  for (const iframe of getIframes()) {
    const phase = iframe.dataset.phase
    const idx = phase === 'before' ? beforeIdx : afterIdx
    if (idx == null) continue
    try {
      iframe.contentWindow?.postMessage({
        source: 'vr-report', action: 'highlight', idx,
        type: type || 'changed', changedProps,
        phase,
      }, '*')
    } catch { /* cross-origin ignore */ }
  }
}

export function clearHighlights() {
  for (const iframe of getIframes()) {
    try {
      iframe.contentWindow?.postMessage({ source: 'vr-report', action: 'clear' }, '*')
    } catch { /* cross-origin ignore */ }
  }
}

export function highlightMulti(
  members: { beforeIdx?: number; afterIdx?: number }[],
  type: string,
  changedProps: string[] = [],
) {
  clearHighlights()
  for (const iframe of getIframes()) {
    const phase = iframe.dataset.phase
    const indices: number[] = []
    for (const m of members) {
      const idx = phase === 'before' ? m.beforeIdx : m.afterIdx
      if (idx != null) indices.push(idx)
    }
    if (indices.length === 0) continue
    try {
      iframe.contentWindow?.postMessage({
        source: 'vr-report', action: 'highlight-multi',
        indices, type, changedProps, phase,
      }, '*')
    } catch { /* cross-origin ignore */ }
  }
}
