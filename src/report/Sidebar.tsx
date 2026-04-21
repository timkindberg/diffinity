import type { PageData, ViewportDiffData } from './types'

type Props = {
  pages: PageData[]
  selected: number | null
  activeViewport: number
  dataViewports: number[]
  focused: boolean
  query: string
  onQueryChange: (q: string) => void
  onSelect: (idx: number) => void
}

function getActiveVpData(item: PageData, activeViewport: number, dataViewports: number[]): ViewportDiffData | undefined {
  return item.viewportDiffs[activeViewport] ?? item.viewportDiffs[dataViewports[0]]
}

function getStatus(item: PageData, activeViewport: number, dataViewports: number[]) {
  const vpData = getActiveVpData(item, activeViewport, dataViewports)
  if (!vpData) return { label: 'unknown', cls: '' }
  if (!vpData.hasBeforeHtml && vpData.hasAfterHtml) return { label: 'new', cls: 'only' }
  if (vpData.hasBeforeHtml && !vpData.hasAfterHtml) return { label: 'removed', cls: 'only' }
  const t = vpData.summary?.visualChanges ?? 0
  if (t === 0) return { label: 'identical', cls: 'identical' }
  if (t < 5) return { label: `${t} changes`, cls: 'minor' }
  if (t < 20) return { label: `${t} changes`, cls: 'changed' }
  return { label: `${t} changes`, cls: 'significant' }
}

export function Sidebar({ pages, selected, activeViewport, dataViewports, focused, query, onQueryChange, onSelect }: Props) {
  const filtered = pages
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      if (!query) return true
      const q = query.toLowerCase()
      return item.page.toLowerCase().includes(q) || item.role.toLowerCase().includes(q)
    })

  return (
    <div id="sidebar" class={`${focused ? 'pane-focused' : ''}`}>
      <div id="sidebar-header">
        <span id="sidebar-title">Pages</span>
        <input
          class="sidebar-search"
          type="text"
          placeholder="Filter pages..."
          autocomplete="off"
          spellcheck={false}
          value={query}
          onInput={(e) => onQueryChange((e.target as HTMLInputElement).value)}
        />
      </div>
      <div id="sidebar-scroll">
        {filtered.map(({ item, idx }) => {
          const s = getStatus(item, activeViewport, dataViewports)
          return (
            <div
              key={item.dirName}
              class={`sb-item${selected === idx ? ' selected' : ''}`}
              onClick={() => onSelect(idx)}
            >
              <div class="sb-labels">
                <span class="sb-name">{item.page}</span>
                <span class="sb-role">{item.role}</span>
              </div>
              <span class={`sb-badge ${s.cls}`}>{s.label}</span>
            </div>
          )
        })}
      </div>
      <div class="resize-handle" data-target="sidebar" />
    </div>
  )
}

/** Compute header pills from page data */
export function computePills(pages: PageData[], activeViewport: number, dataViewports: number[]) {
  let identical = 0, minor = 0, changed = 0, significant = 0
  for (const item of pages) {
    const s = getStatus(item, activeViewport, dataViewports)
    if (s.cls === 'identical') identical++
    else if (s.cls === 'minor') minor++
    else if (s.cls === 'changed') changed++
    else if (s.cls === 'significant') significant++
  }
  return { identical, minor, changed, significant }
}
