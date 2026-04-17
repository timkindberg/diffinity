import { useEffect, useRef } from 'preact/hooks'
import type { PageData, ViewportDiffData } from './types'

type ViewMode = 'split' | 'before' | 'after'

type Props = {
  pages: PageData[]
  selected: number | null
  viewMode: ViewMode
  activeViewport: number
  dataViewports: number[]
  viewports: number[]
  onViewModeChange: (mode: ViewMode) => void
  onViewportChange: (vp: number) => void
}

function getActiveVpData(item: PageData, activeViewport: number, dataViewports: number[]): ViewportDiffData | undefined {
  return item.viewportDiffs[activeViewport] ?? item.viewportDiffs[dataViewports[0]]
}

function getViewportChangeCount(item: PageData | undefined, vp: number): number {
  if (!item?.viewportDiffs) return 0
  const vpData = item.viewportDiffs[vp]
  return vpData?.summary?.totalChanges ?? 0
}

export function Viewer({ pages, selected, viewMode, activeViewport, dataViewports, viewports, onViewModeChange, onViewportChange }: Props) {
  const panesRef = useRef<HTMLDivElement>(null)
  const item = selected != null ? pages[selected] : undefined
  const vpData = item ? getActiveVpData(item, activeViewport, dataViewports) : undefined

  const modes: { key: string; id: ViewMode; label: string }[] = [
    { key: '1', id: 'split', label: 'Side-by-side' },
    { key: '2', id: 'before', label: 'Before' },
    { key: '3', id: 'after', label: 'After' },
  ]

  // Viewport zoom: scale iframes to fit their container
  useEffect(() => {
    if (!panesRef.current) return
    const wraps = panesRef.current.querySelectorAll<HTMLDivElement>('.iframe-wrap')
    const observer = new ResizeObserver(() => applyViewport(wraps, activeViewport))
    wraps.forEach(w => observer.observe(w))
    requestAnimationFrame(() => applyViewport(wraps, activeViewport))
    return () => observer.disconnect()
  }, [selected, viewMode, activeViewport])

  const hasBefore = vpData?.hasBeforeHtml ?? false
  const hasAfter = vpData?.hasAfterHtml ?? false

  return (
    <div id="main">
      <div id="viewer-header">
        <div id="viewer-info">
          <span id="viewer-page">{item ? item.page : 'No selection'}</span>
          {item && <span class="tag">{item.role}</span>}
        </div>
        <div id="viewer-modes">
          {item && modes.map(m => (
            <button
              key={m.id}
              class={`mode-btn${viewMode === m.id ? ' active' : ''}`}
              onClick={() => onViewModeChange(m.id)}
            >
              <span class="mode-key">{m.key}</span>{m.label}
            </button>
          ))}
        </div>
        <div id="viewport-selector">
          {viewports.map((vp, i) => {
            const count = getViewportChangeCount(item, vp)
            return (
              <button
                key={vp}
                class={`mode-btn vp-btn${activeViewport === vp ? ' active' : ''}`}
                onClick={() => onViewportChange(vp)}
              >
                {i === 0 && <span class="mode-key">V</span>}
                {vp}
                {count > 0 && <span class="vp-badge">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div id="viewer-content">
        <div id="html-panes" ref={panesRef} class={viewMode !== 'split' ? 'single' : ''}>
          <div class={`html-pane${viewMode === 'after' ? ' hidden' : ''}`} id="pane-before">
            <div class="pane-label">Before</div>
            {item && hasBefore ? (
              <IframePane item={item} phase="before" alignCls="align-end" dataViewports={dataViewports} />
            ) : (
              <div class="pane-empty">{item ? 'No HTML capture' : 'Select a page to view'}</div>
            )}
          </div>
          <div class={`html-pane${viewMode === 'before' ? ' hidden' : ''}`} id="pane-after">
            <div class="pane-label">After</div>
            {item && hasAfter ? (
              <IframePane item={item} phase="after" alignCls="align-start" dataViewports={dataViewports} />
            ) : (
              <div class="pane-empty">{item ? 'No HTML capture' : 'Select a page to view'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function IframePane({ item, phase, alignCls, dataViewports }: {
  item: PageData; phase: 'before' | 'after'; alignCls: string; dataViewports: number[]
}) {
  const htmlDir = `html-${dataViewports[0]}`
  const src = `${phase}/${item.dirName}/${htmlDir}/index.html`
  return (
    <div class={`iframe-wrap ${alignCls}`}>
      <iframe src={src} data-phase={phase} />
    </div>
  )
}

function applyViewport(wraps: NodeListOf<HTMLDivElement>, activeViewport: number) {
  wraps.forEach(wrap => {
    const iframe = wrap.querySelector('iframe')
    if (!iframe) return
    const paneWidth = wrap.clientWidth
    if (paneWidth === 0) return
    const zoom = Math.min(1, paneWidth / activeViewport)
    iframe.style.width = `${activeViewport}px`
    iframe.style.height = `${wrap.clientHeight / zoom}px`
    iframe.style.zoom = String(zoom)
    iframe.style.transform = ''
    iframe.style.border = zoom === 1 && activeViewport < paneWidth ? '1px solid var(--border)' : 'none'
  })
}
