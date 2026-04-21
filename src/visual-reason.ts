/**
 * Post-classification refinement: detect when all Change records in a diff
 * are "same computed value" — i.e. the authored CSS differs textually but
 * resolves to the same rendered CSS.
 *
 * Upgrades the `no-delta` reason to `same-computed` when we can prove the
 * textual diff is semantic noise (quote/case/whitespace differences, or
 * font-stack changes where the actually-rendered font is the same).
 *
 * We don't have a real browser-side resolver here, so font handling uses a
 * conservative allowlist of fonts assumed to be universally available
 * (generic families + Apple/Windows/Linux system fonts). Anything outside
 * the allowlist (Inter, Roboto, etc.) is assumed unloaded and skipped over
 * when finding the "effective first font". This mirrors the fallback
 * behaviour most capture environments see.
 */
import type { Change } from './diff.js'

// Fonts we assume are available everywhere. Custom / web fonts are NOT in
// this set — they're treated as potentially unloaded and fall through.
const LOADED_FONTS: ReadonlySet<string> = new Set([
  // Generic families (always resolve)
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'math',
  // Common cross-platform system fonts
  '-apple-system', 'blinkmacsystemfont', 'segoe ui',
  'helvetica neue', 'helvetica', 'arial', 'liberation sans',
  'courier new', 'courier', 'monaco', 'consolas', 'menlo',
  'times new roman', 'times', 'georgia',
])

/**
 * Reduce a font-family stack to its effective first resolvable token.
 * Custom fonts (not in LOADED_FONTS) are skipped — mirroring what the browser
 * does when a web font isn't loaded.
 */
export function resolveFontStack(val: string): string {
  const tokens = val
    .split(',')
    .map(t => t.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
    .filter(t => t.length > 0)
  const firstLoaded = tokens.find(t => LOADED_FONTS.has(t))
  return firstLoaded ?? (tokens[tokens.length - 1] ?? '')
}

/**
 * Normalize a CSS value for cross-authoring equality. Property-aware:
 * font-family collapses through the resolve-font-stack heuristic; everything
 * else gets whitespace/case normalization.
 */
export function normalizeCssValue(property: string, val: string | null): string {
  if (val == null) return ''
  if (property === 'font-family') return resolveFontStack(val)
  return val.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * True when every change in the list has before/after values that normalize
 * to equal strings. The caller is expected to only invoke this for diffs
 * that are already verdicted `pixel-identical` — it's a refinement, not a
 * classifier in its own right.
 *
 * Empty `changes` returns false: no evidence of equivalence to report.
 */
export function areChangesSameComputed(changes: Change[]): boolean {
  if (changes.length === 0) return false
  for (const c of changes) {
    // Structural changes (added/removed text, attribute flips) have null
    // before or after — those genuinely changed; don't call them equal.
    if (c.before == null || c.after == null) return false
    const b = normalizeCssValue(c.property, c.before)
    const a = normalizeCssValue(c.property, c.after)
    if (b !== a) return false
  }
  return true
}
