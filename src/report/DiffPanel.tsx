import { useRef, useEffect, useState } from 'preact/hooks'
import type {
  PageData, ViewportDiffData, ElementDiffData, DiffGroupData,
  CascadeClusterData, Change, FlatItem, VisualImpactReason,
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

function PseudoStateBadge({ impact }: { impact?: { pseudoStateSensitive?: boolean; pseudoClasses?: string[] } }) {
  if (!impact?.pseudoStateSensitive) return null
  const classes = impact.pseudoClasses ?? []
  if (classes.length === 0) return null
  const label = classes.map(c => `:${c}`).join(', ')
  return (
    <span
      class="pseudo-state-badge"
      title="A rule targeting this pseudo-class sets a changed property — rendered pixels look identical, but interactive state may differ."
    >
      may affect {label}
    </span>
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

type SortEntry =
  | { kind: 'group'; group: DiffGroupData; score: number; importance: string }
  | { kind: 'diff'; diff: ElementDiffData; score: number; importance: string }

function isPixelIdentical(e: SortEntry): boolean {
  const impact = e.kind === 'diff' ? e.diff.visualImpact : e.group.visualImpact
  return impact?.verdict === 'pixel-identical'
}

// Labels for the reason badges shown on each item in the demoted panel and
// tallied in the panel header. Keep phrasing short enough to fit in a badge
// (≤ ~24 chars) — the tooltip at the header carries the long-form explanation.
const REASON_LABEL: Record<VisualImpactReason, string> = {
  'no-delta': 'no rendered delta',
  'same-computed': 'same computed value',
  'below-threshold': 'below threshold',
}

// Title text for the panel header tooltip. Mirrors REASON_LABEL keys.
const REASON_TOOLTIP =
  'Why each item landed here:\n'
  + '• no rendered delta — pixelmatch saw zero difference in this element.\n'
  + '• same computed value — the CSS changed textually but resolves to the same rendered CSS (e.g. a font-family swap where both stacks fall back to the same system font).\n'
  + '• below threshold — some pixels differed but stayed under the visual-impact tolerance.'

function reasonOf(entry: SortEntry | CascadeClusterData): VisualImpactReason | undefined {
  if ('kind' in entry) {
    const impact = entry.kind === 'diff' ? entry.diff.visualImpact : entry.group.visualImpact
    return impact?.reason
  }
  return entry.visualImpact?.reason
}

function ReasonBadge({ reason }: { reason: VisualImpactReason | undefined }) {
  if (!reason) return null
  return <span class={`reason-badge reason-${reason}`}>{REASON_LABEL[reason]}</span>
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
  const [showNoEffect, setShowNoEffect] = useState(false)

  // Build sorted entries
  const entries: SortEntry[] = []
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

  // Partition visual vs pixel-identical ("no visual effect") items. Pixel-identical
  // items are demoted to a collapsed section so they don't compete with real
  // visual diffs — they're preserved for audit, not surfaced as noise.
  const mainEntries = entries.filter(e => !isPixelIdentical(e))
  const demotedEntries = entries.filter(e => isPixelIdentical(e))
  const mainClusters = filtered.cascadeClusters.filter(cc => cc.visualImpact?.verdict !== 'pixel-identical')
  const demotedClusters = filtered.cascadeClusters.filter(cc => cc.visualImpact?.verdict === 'pixel-identical')
  const demotedCount = demotedEntries.length + demotedClusters.length

  const isEmpty = !item
    || (mainEntries.length === 0 && mainClusters.length === 0 && demotedCount === 0)

  // Build flat items for keyboard navigation — main items first, then demoted
  // (only when expanded) so the cursor skips hidden rows.
  const flatItems: FlatItem[] = []
  for (const e of mainEntries) {
    if (e.kind === 'group') flatItems.push({ kind: 'group', group: e.group })
    else flatItems.push({ kind: 'diff', diff: e.diff })
  }
  for (const cc of mainClusters) {
    flatItems.push({ kind: 'cascade', cluster: cc })
  }
  if (showNoEffect) {
    for (const e of demotedEntries) {
      if (e.kind === 'group') flatItems.push({ kind: 'group', group: e.group })
      else flatItems.push({ kind: 'diff', diff: e.diff })
    }
    for (const cc of demotedClusters) {
      flatItems.push({ kind: 'cascade', cluster: cc })
    }
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
            {mainEntries.length === 0 && mainClusters.length === 0 && demotedCount > 0 && (
              <div class="diff-empty diff-empty-demoted">No visual diffs — only structural changes with no pixel impact.</div>
            )}
            {mainEntries.map((entry, ei) => {
              const fi = flatItems.indexOf(
                entry.kind === 'group'
                  ? flatItems.find(f => f.kind === 'group' && f.group === entry.group)!
                  : flatItems.find(f => f.kind === 'diff' && f.diff === entry.diff)!
              )
              return entry.kind === 'group'
                ? <GroupEntry key={`g-${ei}`} group={entry.group} flatIdx={fi} focused={focused} cursorIdx={cursorIdx} onSetCursor={onSetCursor} onFocus={onFocus} />
                : <DiffEntry key={`d-${ei}`} diff={entry.diff} flatIdx={fi} focused={focused} cursorIdx={cursorIdx} onSetCursor={onSetCursor} onFocus={onFocus} />
            })}
            {mainClusters.length > 0 && (
              <>
                <div class="cascade-section-header">Layout Cascade</div>
                <div class="cascade-section-desc">Size changes inherited from a parent reflow — grouped by property &amp; direction, avg delta shown.</div>
                {mainClusters.map((cc, ci) => {
                  const fi = flatItems.findIndex(f => f.kind === 'cascade' && f.cluster === cc)
                  return <CascadeEntry key={`c-${ci}`} cluster={cc} flatIdx={fi} focused={focused} cursorIdx={cursorIdx} onSetCursor={onSetCursor} onFocus={onFocus} />
                })}
              </>
            )}
            {demotedCount > 0 && (() => {
              // Tally reasons for the header breakdown.
              const reasonCounts: Record<string, number> = {}
              for (const e of demotedEntries) {
                const r = reasonOf(e) ?? 'unknown'
                reasonCounts[r] = (reasonCounts[r] ?? 0) + 1
              }
              for (const cc of demotedClusters) {
                const r = cc.visualImpact?.reason ?? 'unknown'
                reasonCounts[r] = (reasonCounts[r] ?? 0) + 1
              }
              const breakdown: { reason: VisualImpactReason | 'unknown'; count: number; label: string }[] = []
              for (const r of ['no-delta', 'below-threshold', 'same-computed'] as VisualImpactReason[]) {
                if (reasonCounts[r]) breakdown.push({ reason: r, count: reasonCounts[r], label: REASON_LABEL[r] })
              }
              if (reasonCounts['unknown']) breakdown.push({ reason: 'unknown', count: reasonCounts['unknown'], label: 'unclassified' })

              return (
                <div class="no-effect-section">
                  <button
                    type="button"
                    class={`no-effect-toggle${showNoEffect ? ' expanded' : ''}`}
                    onClick={() => setShowNoEffect(v => !v)}
                  >
                    <span class="no-effect-triangle">{showNoEffect ? '\u25be' : '\u25b8'}</span>
                    <span class="no-effect-title">Changes not visible in the static capture</span>
                    <span
                      class="no-effect-help"
                      title={REASON_TOOLTIP}
                      onClick={(e) => e.stopPropagation()}
                    >?</span>
                    <span class="no-effect-count">{summary?.structuralChanges ?? demotedCount}</span>
                  </button>
                  {showNoEffect && (
                    <>
                      {breakdown.length > 0 && (
                        <div class="no-effect-breakdown">
                          {breakdown.map((b, i) => (
                            <span key={i} class={`no-effect-breakdown-item reason-${b.reason}`}>
                              <span class="no-effect-breakdown-count">{b.count}</span> {b.label}
                              {i < breakdown.length - 1 && <span class="no-effect-breakdown-sep"> · </span>}
                            </span>
                          ))}
                        </div>
                      )}
                      <div class="no-effect-desc">CSS properties changed but rendered pixels are identical. Preserved for audit, de-emphasized from the main list.</div>
                      <div class="no-effect-items">
                        {demotedEntries.map((entry, ei) => {
                          const fi = flatItems.indexOf(
                            entry.kind === 'group'
                              ? flatItems.find(f => f.kind === 'group' && f.group === entry.group)!
                              : flatItems.find(f => f.kind === 'diff' && f.diff === entry.diff)!
                          )
                          return entry.kind === 'group'
                            ? <GroupEntry key={`nd-g-${ei}`} group={entry.group} flatIdx={fi} focused={focused} cursorIdx={cursorIdx} onSetCursor={onSetCursor} onFocus={onFocus} reason={entry.group.visualImpact?.reason} />
                            : <DiffEntry key={`nd-d-${ei}`} diff={entry.diff} flatIdx={fi} focused={focused} cursorIdx={cursorIdx} onSetCursor={onSetCursor} onFocus={onFocus} reason={entry.diff.visualImpact?.reason} />
                        })}
                        {demotedClusters.map((cc, ci) => {
                          const fi = flatItems.findIndex(f => f.kind === 'cascade' && f.cluster === cc)
                          return <CascadeEntry key={`nd-c-${ci}`} cluster={cc} flatIdx={fi} focused={focused} cursorIdx={cursorIdx} onSetCursor={onSetCursor} onFocus={onFocus} reason={cc.visualImpact?.reason} />
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
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
  reason?: VisualImpactReason
}

function DiffEntry({ diff, flatIdx, focused, cursorIdx, onSetCursor, onFocus, reason }: DiffEntryProps) {
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
          <ReasonBadge reason={reason} />
          <PseudoStateBadge impact={diff.visualImpact} />
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
  reason?: VisualImpactReason
}

function GroupEntry({ group, flatIdx, focused, cursorIdx, onSetCursor, onFocus, reason }: GroupEntryProps) {
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
          <ReasonBadge reason={reason} />
          <PseudoStateBadge impact={group.visualImpact} />
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
  reason?: VisualImpactReason
}

function CascadeEntry({ cluster, flatIdx, focused, cursorIdx, onSetCursor, onFocus, reason }: CascadeEntryProps) {
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
          <ReasonBadge reason={reason} />
          <PseudoStateBadge impact={cluster.visualImpact} />
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
