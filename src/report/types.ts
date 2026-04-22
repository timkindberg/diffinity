export type Change = {
  property: string
  category: string
  before?: string
  after?: string
}

export type VisualImpactReason = 'no-delta' | 'below-threshold' | 'same-computed'

export type VisualImpactData = {
  mismatchPixels: number
  mismatchPercent: number
  verdict: 'visual' | 'pixel-identical'
  /** Subcategory for the "not visible in the static capture" panel. Only set when verdict is pixel-identical. */
  reason?: VisualImpactReason
  pseudoStateSensitive?: boolean
  pseudoClasses?: string[]
  /** Per-pseudo-class member match counts; only set for partial group matches. */
  pseudoClassMemberCounts?: { pc: string; matched: number; total: number }[]
}

export type ElementDiffData = {
  label: string
  selector?: string
  type: string
  importance?: string
  score: number
  changes: Change[]
  beforeIdx?: number
  afterIdx?: number
  visualImpact?: VisualImpactData
}

export type GroupMember = {
  label: string
  beforeIdx?: number
  afterIdx?: number
}

export type DiffGroupData = {
  type: string
  importance?: string
  score: number
  changes: Change[]
  members: GroupMember[]
  visualImpact?: VisualImpactData
}

export type CascadeClusterData = {
  delta: string
  elementCount: number
  properties: string[]
  rootCause?: {
    label: string
    property: string
    before: string
    after: string
  }
  members: GroupMember[]
  visualImpact?: VisualImpactData
}

export type DiffSummary = {
  changed: number
  added: number
  removed: number
  moved: number
  unchanged: number
  /** All diffs including demoted ones (= visualChanges + structuralChanges). */
  totalChanges: number
  /** Change-rollup count of diffs whose visualImpact verdict is NOT pixel-identical. */
  visualChanges: number
  /** Change-rollup count of diffs whose visualImpact verdict IS pixel-identical. */
  structuralChanges: number
  groupCount: number
  groupedElementCount: number
}

export type ViewportDiffData = {
  diffs: ElementDiffData[]
  groups: DiffGroupData[]
  cascadeClusters: CascadeClusterData[]
  summary: DiffSummary
  hasBeforeHtml: boolean
  hasAfterHtml: boolean
}

export type PageData = {
  dirName: string
  page: string
  role: string
  viewportDiffs: Record<number, ViewportDiffData>
}

export type ReportData = {
  viewports: number[]
  pages: PageData[]
}

/** Unified flat item for keyboard navigation in the diff panel */
export type FlatItem =
  | { kind: 'diff'; diff: ElementDiffData }
  | { kind: 'group'; group: DiffGroupData }
  | { kind: 'cascade'; cluster: CascadeClusterData }
