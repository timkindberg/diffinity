import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import type { ReportData, PageData, FlatItem } from './types'
import { Sidebar, computePills } from './Sidebar'
import { DiffPanel } from './DiffPanel'
import { Viewer } from './Viewer'
import { clearHighlights } from './highlight'
import './styles.css'

declare global {
  interface Window { VR_DATA?: ReportData | PageData[] }
}

const VIEWPORTS = [1440, 768, 375]

type ViewMode = 'split' | 'before' | 'after'
type FocusedPane = 'sidebar' | 'diff'

function loadData(): { pages: PageData[]; dataViewports: number[] } {
  const raw = window.VR_DATA
  if (!raw) return { pages: [], dataViewports: [1440] }
  if (Array.isArray(raw)) return { pages: raw, dataViewports: [1440] }
  return {
    pages: raw.pages ?? [],
    dataViewports: raw.viewports?.length ? raw.viewports : [1440],
  }
}

export function App() {
  const { pages, dataViewports } = loadData()

  const [selected, setSelected] = useState<number | null>(pages.length > 0 ? 0 : null)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [diffPanelOpen, setDiffPanelOpen] = useState(true)
  const [focusedPane, setFocusedPane] = useState<FocusedPane>('sidebar')
  const [diffCursorIdx, setDiffCursorIdx] = useState(-1)
  const [sidebarQuery, setSidebarQuery] = useState('')
  const [diffQuery, setDiffQuery] = useState('')

  const savedVp = parseInt(localStorage.getItem('vr-viewport') || String(VIEWPORTS[0]))
  const [activeViewport, setActiveViewport] = useState(
    VIEWPORTS.includes(savedVp) ? savedVp : VIEWPORTS[0]
  )

  const flatItemsRef = useRef<FlatItem[]>([])
  const flatCountRef = useRef(0)

  const selectItem = useCallback((idx: number) => {
    setSelected(idx)
    setDiffCursorIdx(-1)
    clearHighlights()
  }, [])

  const changeViewport = useCallback((vp: number) => {
    setActiveViewport(vp)
    localStorage.setItem('vr-viewport', String(vp))
  }, [])

  const cycleViewport = useCallback(() => {
    setActiveViewport(prev => {
      const idx = VIEWPORTS.indexOf(prev)
      const next = VIEWPORTS[(idx + 1) % VIEWPORTS.length]
      localStorage.setItem('vr-viewport', String(next))
      return next
    })
  }, [])

  const setFocus = useCallback((pane: FocusedPane) => {
    setFocusedPane(pane)
    if (pane === 'sidebar') {
      setDiffCursorIdx(-1)
    }
    if (pane === 'diff') {
      setDiffCursorIdx(prev => prev < 0 ? 0 : prev)
    }
  }, [])

  // Keyboard handler
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') (document.activeElement as HTMLElement).blur()
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (focusedPane === 'diff') setFocus('sidebar')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (focusedPane === 'sidebar' && diffPanelOpen) setFocus('diff')
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (focusedPane === 'sidebar') {
          if (selected == null) selectItem(0)
          else if (selected > 0) selectItem(selected - 1)
        } else if (focusedPane === 'diff') {
          setDiffCursorIdx(prev => Math.max(0, prev - 1))
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (focusedPane === 'sidebar') {
          if (selected == null) selectItem(0)
          else if (selected < pages.length - 1) selectItem(selected + 1)
        } else if (focusedPane === 'diff') {
          setDiffCursorIdx(prev => Math.min(flatCountRef.current - 1, prev + 1))
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (focusedPane === 'diff' && diffCursorIdx >= 0) {
          e.preventDefault()
          const scrollEl = document.getElementById('diff-scroll')
          const items = scrollEl?.querySelectorAll('.el-diff')
          items?.[diffCursorIdx]?.classList.toggle('open')
        }
      } else if (e.key === '1') {
        setViewMode('split')
      } else if (e.key === '2') {
        setViewMode('before')
      } else if (e.key === '3') {
        setViewMode('after')
      } else if (e.key === 'v' || e.key === 'V') {
        cycleViewport()
      } else if (e.key === 'd' || e.key === 'D') {
        setDiffPanelOpen(prev => {
          const next = !prev
          if (!next && focusedPane === 'diff') setFocus('sidebar')
          return next
        })
      } else if (e.key === 'f' || e.key === 'F') {
        // Focus search in current pane
        const searchEl = focusedPane === 'sidebar'
          ? document.querySelector<HTMLInputElement>('.sidebar-search')
          : document.querySelector<HTMLInputElement>('.diff-search')
        searchEl?.focus()
      } else if (e.key === '[') {
        const bothClosed = !sidebarOpen && !diffPanelOpen
        if (bothClosed) {
          setSidebarOpen(true)
          setDiffPanelOpen(true)
        } else {
          setSidebarOpen(false)
          setDiffPanelOpen(false)
          if (focusedPane === 'diff') setFocus('sidebar')
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [focusedPane, diffPanelOpen, sidebarOpen, selected, diffCursorIdx, pages.length])

  // Panel resize handler
  useEffect(() => {
    const overlay = document.querySelector<HTMLDivElement>('.drag-overlay')
    if (!overlay) return

    function initResize(handle: Element) {
      const targetId = (handle as HTMLElement).dataset.target!
      const panel = document.getElementById(targetId)!
      const cssVar = targetId === 'sidebar' ? '--panel-width' : '--diff-panel-width'
      const storageKey = `vr-${targetId}-width`
      const saved = localStorage.getItem(storageKey)
      if (saved) document.documentElement.style.setProperty(cssVar, `${saved}px`)

      handle.addEventListener('mousedown', (e: Event) => {
        const me = e as MouseEvent
        me.preventDefault()
        ;(handle as HTMLElement).classList.add('dragging')
        overlay!.style.display = 'block'
        const startX = me.clientX
        const startW = panel.getBoundingClientRect().width

        function onMove(e: MouseEvent) {
          const newW = Math.max(150, Math.min(600, startW + e.clientX - startX))
          document.documentElement.style.setProperty(cssVar, `${newW}px`)
        }
        function onUp() {
          ;(handle as HTMLElement).classList.remove('dragging')
          overlay!.style.display = 'none'
          const finalW = panel.getBoundingClientRect().width
          localStorage.setItem(storageKey, String(Math.round(finalW)))
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })
    }

    document.querySelectorAll('.resize-handle').forEach(initResize)
  }, [])

  const pills = computePills(pages, activeViewport, dataViewports)

  return (
    <>
      <div id="app-header">
        <button id="panel-toggle" title="Toggle sidebar ([)" onClick={() => setSidebarOpen(p => !p)}>[</button>
        <h1>Semantic Diff Report</h1>
        <div class="header-pills">
          {!!pills.significant && <span class="h-pill" style="color:var(--red)"><span class="h-pill-count">{pills.significant}</span> significant</span>}
          {!!pills.changed && <span class="h-pill" style="color:var(--orange)"><span class="h-pill-count">{pills.changed}</span> changed</span>}
          {!!pills.minor && <span class="h-pill" style="color:var(--yellow)"><span class="h-pill-count">{pills.minor}</span> minor</span>}
          {!!pills.identical && <span class="h-pill" style="color:var(--green)"><span class="h-pill-count">{pills.identical}</span> identical</span>}
        </div>
      </div>

      <div id="app-body">
        <div style={sidebarOpen ? 'display:contents' : 'display:none'}>
          <Sidebar
            pages={pages}
            selected={selected}
            activeViewport={activeViewport}
            dataViewports={dataViewports}
            focused={focusedPane === 'sidebar'}
            query={sidebarQuery}
            onQueryChange={setSidebarQuery}
            onSelect={(idx) => { setFocus('sidebar'); selectItem(idx) }}
          />
        </div>

        <div style={diffPanelOpen ? 'display:contents' : 'display:none'}>
          <DiffPanel
            pages={pages}
            selected={selected}
            activeViewport={activeViewport}
            dataViewports={dataViewports}
            focused={focusedPane === 'diff'}
            cursorIdx={diffCursorIdx}
            query={diffQuery}
            onQueryChange={(q) => { setDiffCursorIdx(-1); setDiffQuery(q) }}
            onSetCursor={setDiffCursorIdx}
            onFocus={() => setFocus('diff')}
            flatItemsRef={flatItemsRef}
            flatCountRef={flatCountRef}
          />
        </div>

        <Viewer
          pages={pages}
          selected={selected}
          viewMode={viewMode}
          activeViewport={activeViewport}
          dataViewports={dataViewports}
          viewports={VIEWPORTS}
          onViewModeChange={setViewMode}
          onViewportChange={changeViewport}
        />
      </div>

      <div id="app-footer">
        <span class="footer-hint">
          <kbd>&larr;</kbd><kbd>&rarr;</kbd> switch pane
          <span class="footer-hint-sep">|</span>
          <kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate
          <span class="footer-hint-sep">|</span>
          <kbd>Enter</kbd> expand/collapse
          <span class="footer-hint-sep">|</span>
          <kbd>1</kbd> Side-by-side <kbd>2</kbd> Before <kbd>3</kbd> After
          <span class="footer-hint-sep">|</span>
          <kbd>V</kbd> viewport
          <span class="footer-hint-sep">|</span>
          <kbd>D</kbd> diff panel
          <span class="footer-hint-sep">|</span>
          <kbd>[</kbd> panels
        </span>
      </div>

      <div class="drag-overlay" />
    </>
  )
}
