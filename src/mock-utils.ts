/**
 * Shared mock utilities for page definitions.
 *
 * Helpers for generating realistic API response shapes so that
 * paginated lists, filters, and UI controls render properly.
 */

/**
 * Fixed anchor date for visual regression mocks.
 *
 * All date helpers below are anchored to this constant so that mock data
 * produces the same dates on every run, eliminating screenshot diff noise
 * caused by "today" advancing over time.
 *
 * Anchor: 2026-01-15 (Thursday)
 */
const ANCHOR = new Date('2026-01-15T12:00:00.000Z')

export const daysAgo = (n: number) => new Date(ANCHOR.getTime() - n * 86400000).toISOString()
export const daysFromNow = (n: number) => new Date(ANCHOR.getTime() + n * 86400000).toISOString()
/** Trim an ISO datetime to a YYYY-MM-DD date string. */
export const dateOnly = (iso: string) => iso.slice(0, 10)
/** Today's date as YYYY-MM-DD, fixed at the anchor date. */
export const TODAY = dateOnly(ANCHOR.toISOString())

/**
 * Wraps an array of results in the standard VNDLY OffsetLimitPaginationResponse shape.
 *
 * By default, inflates `count` to suggest ~5 pages of data exist beyond the current results.
 * This makes pagination controls (page numbers, "next" buttons) render realistically
 * without needing to mock multiple pages of actual data.
 *
 * @param results - The actual items to return on this "page"
 * @param opts.count - Total item count across all pages (default: results.length * 5)
 * @param opts.limit - Page size (default: results.length)
 * @param opts.offset - Current offset (default: 0 = first page)
 */
export function paginated<T>(
  results: T[],
  opts: { count?: number; limit?: number; offset?: number } = {},
) {
  const limit = opts.limit ?? results.length
  const offset = opts.offset ?? 0
  const count = opts.count ?? results.length * 5
  const page = limit ? Math.floor(offset / limit) + 1 : 1
  const total_pages = limit ? Math.ceil(count / limit) : 1
  const next_params = offset + limit >= count ? null : { offset: offset + limit, limit }
  const previous_params = offset <= 0 ? null : { offset: Math.max(0, offset - limit), limit }

  return {
    count,
    limit,
    offset,
    page,
    total_pages,
    next_link: next_params ? `?limit=${next_params.limit}&offset=${next_params.offset}` : null,
    next_params,
    previous_link: previous_params ? `?limit=${previous_params.limit}&offset=${previous_params.offset}` : null,
    previous_params,
    results,
  }
}
