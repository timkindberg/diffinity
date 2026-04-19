import { useRef, useEffect } from 'preact/hooks'
import type {
  PageData, ViewportDiffData, ElementDiffData, DiffGroupData,
  CascadeClusterData, Change, FlatItem,
} from './types'
import { highlightElement, highlightMulti, clearHighlights, getChangedProps } from './highlight'

type Props = {
  pages: PageData[]
  selected: number | null
  activeViewport: number
  dataViewports: number[]
  focused: boolean
  cursorIdx: number
  query: string
  onQueryChange: (q: string) => void
  onSetCursor: (idx: number) => void
  onFocus: () => void
  flatItemsRef: { current: FlatItem[] }
  flatCountRef: { current: number }
}

const TYPE_CHAR: Record<string, string> = {
  changed: '~', added: '+', removed: '\u2212', moved: '\u2194', 'moved+changed': '\u2194',
}
const IMP_ORDER: Record<string, number> = { critical: 0, major: 1, moderate: 2, minor: 3 }
const PREVIEW_MAX = 4

const COLOR_PROPS = [
  'color', 'background-color', 'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color', 'text-decoration-color', 'outline-color',
  'box-shadow', 'text-shadow', 'foreground color', 'border-color',
]
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\))$/i

function isColorValue(val: string | undefined): val is string {
  return !!val && COLOR_RE.test(val.trim())
}

function rgbToOklch(val: string): string {
  const m = val.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/)
  if (!m) return val
  let alpha = 1
  const am = val.match(/^rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\s*\)$/)
  if (am) alpha = parseFloat(am[1])
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const lr = toLinear(parseFloat(m[1]) / 255)
  const lg = toLinear(parseFloat(m[2]) / 255)
  const lb = toLinear(parseFloat(m[3]) / 255)
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const ob = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  const C = Math.sqrt(a * a + ob * ob)
  const H = (Math.atan2(ob, a) * 180 / Math.PI + 360) % 360
  const round = (v: number, d: number) => { const f = Math.pow(10, d); return Math.round(v * f) / f }
  if (alpha < 1) return `oklch(${round(L, 4)} ${round(C, 4)} ${round(H, 2)} / ${round(alpha, 2)})`
  return `oklch(${round(L, 4)} ${round(C, 4)} ${round(H, 2)})`
}

function Swatch({ val }: { val: string }) {
  if (!isColorValue(val)) return null
  return <span class="color-swatch" style={{ background: val.trim() }} title={val} />
}

function ValLine({ sign, cls, val, isColor }: { sign: string; cls: string; val: string; isColor: boolean }) {
  const display = isColor && isColorValue(val) ? rgbToOklch(val) : val
  return (
    <div class="change-val-line">
      <span class={`val-sign ${cls}`}>{sign}</span>
      {isColor && isColorValue(val) && <Swatch val={val} />}
      <span class={`val-text ${cls}`}>{display}</span>
    </div>
  )
}

function ChangeRow({ c }: { c: Change }) {
  const isColor = COLOR_PROPS.includes(c.property)
  let lines
  if (c.before && c.after) {
    lines = <>
      <ValLine sign={'\u2212'} cls="before" val={c.before} isColor={isColor} />
      <ValLine sign="+" cls="after" val={c.after} isColor={isColor} />
    </>
  } else if (c.before) {
    lines = <>
      <ValLine sign={'\u2212'} cls="before" val={c.before} isColor={isColor} />
      <div class="change-val-line"><span class="val-sign after">+</span><span class="val-text added-note">removed</span></div>
    </>
  } else if (c.after) {
    lines = <>
      <div class="change-val-line"><span class="val-sign before">{'\u2212'}</span><span class="val-text added-note">none</span></div>
      <ValLine sign="+" cls="after" val={c.after} isColor={isColor} />
    </>
  }
  return (
    <div class="change-row">
      <div class="change-header">
        <span class="change-prop">{c.property}</span>
        <span class="change-cat">{c.category}</span>
      </div>
      {lines}
    </div>
  )
}

function matchesQuery(query: string, d: { label?: string; type?: string; changes?: Change[] }) {
  if (d.label && d.label.toLowerCase().includes(query)) return true
  if (d.type && d.type.toLowerCase().includes(query)) return true
  for (const c of d.changes ?? []) {
    if (c.property.toLowerCase().includes(query)) return true
    if (c.category.toLowerCase().includes(query)) return true
    if (c.before && c.before.toLowerCase().includes(query)) return true
    if (c.after && c.after.toLowerCase().includes(query)) return true
  }
  return false
}

function getFiltered(vpData: ViewportDiffData | undefined, query: string) {
  if (!vpData) return { diffs: [], groups: [], cascadeClusters: [] }
  const { diffs, groups, cascadeClusters = [] } = vpData
  if (!query) return { diffs, groups, cascadeClusters }
  const q = query.toLowerCase()
  return {
    diffs: diffs.filter(d => matchesQuery(q, d)),
    groups: groups.filter(g => {
      if (matchesQuery(q, g)) return true
      return g.members.some(m => m.label.toLowerCase().includes(q))
    }),
    cascadeClusters: cascadeClusters.filter(cc => {
      if (cc.delta && cc.delta.toLowerCase().includes(q)) return true
      return cc.members.some(m => m.label.toLowerCase().includes(q))
    }),
  }
}

export function DiffPanel({
  pages, selected, activeViewport, dataViewports, focused, cursorIdx,
  query, onQueryChange, onSetCursor, onFocus, flatItemsRef, flatCountRef,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const item = selected != null ? pages[selected] : undefined
  const vpData = item
    ? (item.viewportDiffs[activeViewport] ?? item.viewportDiffs[dataViewports[0]])
    : undefined

  const filtered = getFiltered(vpData, query)
  const isEmpty = !item || (filtered.diffs.length === 0 && filtered.groups.length === 0 && filtered.cascadeClusters.length === 0)

  // Build sorted entries
  type Entry = { kind: 'group'; group: DiffGroupData; score: number; importance: string }
    | { kind: 'diff'; diff: ElementDiffData; score: number; importance: string }
  const entries: Entry[] = []
  for (const g of filtered.groups) {
    entries.push({ kind: 'group', group: g, score: g.score, importance: g.importance || 'minor' })
  }
  for (const d of filtered.diffs) {
    entries.push({ kind: 'diff', diff: d, score: d.score, importance: d.importance || 'minor' })
  }
  entries.sort((a, b) => {
    const ia = IMP_ORDER[a.importance] ?? 4
    const ib = IMP_ORDER[b.importance] ?? 4
    return ia !== ib ? ia - ib : b.score - a.score
  })

  // Build flat items for keyboard navigation
  const flatItems: FlatItem[] = []
  for (const e of entries) {
    if (e.kind === 'group') flatItems.push({ kind: 'group', group: e.group })
    else flatItems.push({ kind: 'diff', diff: e.diff })
  }
  for (const cc of filtered.cascadeClusters) {
    flatItems.push({ kind: 'cascade', cluster: cc })
  }
  flatItemsRef.current = flatItems
  flatCountRef.current = flatItems.length

  // Summary
  const summary = vpData?.summary
  const allCount = vpData ? (vpData.diffs.length + vpData.groups.length + (vpData.cascadeClusters?.length ?? 0)) : 0
  const emptyMsg = !item ? 'Select a page' : allCount === 0 ? 'No differences detected' : 'No matches'

  // Auto-scroll focused item into view
  useEffect(() => {
    if (!focused || cursorIdx < 0 || !scrollRef.current) return
    const items = scrollRef.current.querySelectorAll('.el-diff')
    items[cursorIdx]?.scrollIntoView({ block: 'nearest' })
    // Also highlight
    const fi = flatItems[cursorIdx]
    if (fi) {
      if (fi.kind === 'diff') highlightElement(fi.diff.beforeIdx, fi.diff.afterIdx, fi.diff.type, getChangedProps(fi.diff.changes))
      else if (fi.kind === 'group') highlightMulti(fi.group.members, fi.group.type)
      else if (fi.kind === 'cascade') highlightMulti(fi.cluster.members, 'changed')
    }
  }, [cursorIdx, focused])

  return (
    <div id="diff-panel" class={focused ? 'pane-focused' : ''}>
      <div id="diff-panel-header">
        <div class="diff-header-row">
          <h3>Changes</h3>
          <div class="diff-summary">
            {summary && <>
              {!!summary.changed && <span class="diff-summary-item" style="background:color-mix(in srgb,var(--orange) 15%,transparent);color:var(--orange)">{summary.changed} changed</span>}
              {!!summary.moved && <span class="diff-summary-item" style="background:color-mix(in srgb,var(--purple) 15%,transparent);color:var(--purple)">{summary.moved} moved</span>}
              {!!summary.added && <span class="diff-summary-item" style="background:color-mix(in srgb,var(--green) 15%,transparent);color:var(--green)">{summary.added} added</span>}
              {!!summary.removed && <span class="diff-summary-item" style="background:color-mix(in srgb,var(--red) 15%,transparent);color:var(--red)">{summary.removed} removed</span>}
              {!!summary.groupCount && <span class="diff-summary-item" style="background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent)">{summary.groupCount} groups</span>}
              {filtered.cascadeClusters.length > 0 && (() => {
                const total = filtered.cascadeClusters.reduce((s, c) => s + c.elementCount, 0)
                return <span class="diff-summary-item" style="background:color-mix(in srgb,var(--text3) 15%,transparent);color:var(--text3)">{total} cascade</span>
              })()}
            </>}
          </div>
        </div>
        <input
          class="diff-search"
          type="text"
          placeholder="Filter changes..."
          autocomplete="off"
          spellcheck={false}
          value={query}
          onInput={(e) => onQueryChange((e.target as HTMLInputElement).value)}
        />
      </div>
      <div id="diff-scroll" ref={scrollRef}>
        {isEmpty ? (
          <div class="diff-empty">{emptyMsg}</div>
        ) : (
          <>
            {entries.map((entry, ei) => {
              const fi = flatItems.indexOf(
                entry.kind === 'group'
                  ? flatItems.find(f => f.kind === 'group' && f.group === entry.group)!
                  : flatItems.find(f => f.kind === 'diff' && f.diff === entry.diff)!
              )
              return entry.kind === 'group'
                ? <GroupEntry key={`g-${ei}`} group={entry.group} flatIdx={fi} focused={focused} cursorIdx={cursorIdx} onSetCursor={onSetCursor} onFocus={onFocus} />
                : <DiffEntry key={`d-${ei}`} diff={entry.diff} flatIdx={fi} focused={focused} cursorIdx={cursorIdx} onSetCursor={onSetCursor} onFocus={onFocus} />
            })}
            {filtered.cascadeClusters.length > 0 && (
              <>
                <div class="cascade-section-header">Layout Cascade</div>
                <div class="cascade-section-desc">Size changes inherited from a parent reflow — grouped by property &amp; direction, avg delta shown.</div>
                {filtered.cascadeClusters.map((cc, ci) => {
                  const fi = flatItems.findIndex(f => f.kind === 'cascade' && f.cluster === cc)
                  return <CascadeEntry key={`c-${ci}`} cluster={cc} flatIdx={fi} focused={focused} cursorIdx={cursorIdx} onSetCursor={onSetCursor} onFocus={onFocus} />
                })}
              </>
            )}
          </>
        )}
      </div>
      <div class="resize-handle" data-target="diff-panel" />
    </div>
  )
}

type DiffEntryProps = {
  diff: ElementDiffData
  flatIdx: number
  focused: boolean
  cursorIdx: number
  onSetCursor: (idx: number) => void
  onFocus: () => void
}

function DiffEntry({ diff, flatIdx, focused, cursorIdx, onSetCursor, onFocus }: DiffEntryProps) {
  const imp = diff.importance || 'minor'
  const isFocused = focused && cursorIdx === flatIdx
  return (
    <div
      class={`el-diff importance-${imp}${isFocused ? ' kb-focused' : ''}`}
      onMouseEnter={() => highlightElement(diff.beforeIdx, diff.afterIdx, diff.type, getChangedProps(diff.changes))}
      onMouseLeave={() => clearHighlights()}
    >
      <div class="el-diff-header" onClick={(e) => {
        const el = (e.currentTarget as HTMLElement).parentElement!
        onFocus()
        onSetCursor(flatIdx)
        requestAnimationFrame(() => el.classList.toggle('open'))
      }}>
        <div class="el-diff-badges">
          <span class={`el-diff-importance imp-${imp}`}>{imp}</span>
          <span class={`el-diff-type ${diff.type}`}>{TYPE_CHAR[diff.type] || '~'}</span>
        </div>
        <div class="el-diff-title-row">
          <span class="el-diff-label">{diff.label}</span>
          {diff.changes.length > 1 && <span class="el-diff-count">{diff.changes.length}</span>}
        </div>
      </div>
      <div class="el-diff-body">
        {diff.selector && <div class="el-diff-selector">{diff.selector}</div>}
        {diff.changes.map((c, i) => <ChangeRow key={i} c={c} />)}
      </div>
    </div>
  )
}

type GroupEntryProps = {
  group: DiffGroupData
  flatIdx: number
  focused: boolean
  cursorIdx: number
  onSetCursor: (idx: number) => void
  onFocus: () => void
}

function GroupEntry({ group, flatIdx, focused, cursorIdx, onSetCursor, onFocus }: GroupEntryProps) {
  const imp = group.importance || 'minor'
  const isFocused = focused && cursorIdx === flatIdx
  const preview = group.members.slice(0, PREVIEW_MAX).map(m => m.label)
  const moreCount = group.members.length - PREVIEW_MAX
  const propNames = group.changes.map(c => c.property).join(', ')

  return (
    <div
      class={`el-diff importance-${imp}${isFocused ? ' kb-focused' : ''}`}
      onMouseEnter={() => highlightMulti(group.members, group.type)}
      onMouseLeave={() => clearHighlights()}
    >
      <div class="el-diff-header" onClick={(e) => {
        const el = (e.currentTarget as HTMLElement).parentElement!
        onFocus()
        onSetCursor(flatIdx)
        requestAnimationFrame(() => el.classList.toggle('open'))
      }}>
        <div class="el-diff-badges">
          <span class={`el-diff-importance imp-${imp}`}>{imp}</span>
          <span class={`el-diff-type ${group.type}`}>{TYPE_CHAR[group.type] || '~'}</span>
        </div>
        <div class="el-diff-title-row">
          <span class="el-diff-label">Multiple Similar &times;{group.members.length}</span>
          <span class="group-changes-summary">{propNames}</span>
        </div>
        <div class="group-members-preview">
          {preview.join(', ')}
          {moreCount > 0 && <>, <span class="more">+{moreCount} more...</span></>}
        </div>
      </div>
      <div class="el-diff-body">
        {group.changes.map((c, i) => <ChangeRow key={i} c={c} />)}
        <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px">
          {group.members.map((m, mi) => (
            <div
              key={mi}
              class="group-member-item"
              onMouseEnter={(e) => {
                e.stopPropagation()
                highlightElement(m.beforeIdx, m.afterIdx, group.type)
              }}
              onMouseLeave={(e) => {
                e.stopPropagation()
                highlightMulti(group.members, group.type)
              }}
            >
              <span class="member-label">{m.label}</span>
              <span class="member-arrow">{'\u2192'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type CascadeEntryProps = {
  cluster: CascadeClusterData
  flatIdx: number
  focused: boolean
  cursorIdx: number
  onSetCursor: (idx: number) => void
  onFocus: () => void
}

function CascadeEntry({ cluster, flatIdx, focused, cursorIdx, onSetCursor, onFocus }: CascadeEntryProps) {
  const isFocused = focused && cursorIdx === flatIdx
  const preview = cluster.members.slice(0, PREVIEW_MAX).map(m => m.label)
  const moreCount = cluster.members.length - PREVIEW_MAX

  return (
    <div
      class={`el-diff is-cascade${isFocused ? ' kb-focused' : ''}`}
      onMouseEnter={() => highlightMulti(cluster.members, 'changed')}
      onMouseLeave={() => clearHighlights()}
    >
      <div class="el-diff-header" onClick={(e) => {
        const el = (e.currentTarget as HTMLElement).parentElement!
        onFocus()
        onSetCursor(flatIdx)
        requestAnimationFrame(() => el.classList.toggle('open'))
      }}>
        <div class="el-diff-badges">
          <span class="el-diff-type changed">{'\u2248'}</span>
        </div>
        <div class="el-diff-title-row">
          <span class="cascade-count">{cluster.elementCount} elements</span>
          <span class="cascade-delta">{cluster.delta}</span>
        </div>
        {cluster.rootCause && (
          <div class="cascade-root-cause">
            Caused by <strong>{cluster.rootCause.label}</strong>: {cluster.rootCause.property} {cluster.rootCause.before} {'\u2192'} {cluster.rootCause.after}
          </div>
        )}
      </div>
      <div class="el-diff-body">
        <div class="group-members-preview">
          {preview.join(', ')}
          {moreCount > 0 && <>, <span class="more">+{moreCount} more...</span></>}
        </div>
        {cluster.members.map((m, mi) => (
          <div
            key={mi}
            class="group-member-item"
            onMouseEnter={(e) => {
              e.stopPropagation()
              highlightElement(m.beforeIdx, m.afterIdx, 'changed')
            }}
            onMouseLeave={(e) => {
              e.stopPropagation()
              highlightMulti(cluster.members, 'changed')
            }}
          >
            <span class="member-label">{m.label}</span>
            <span class="member-arrow">{'\u2192'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
