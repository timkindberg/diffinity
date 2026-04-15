import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { installCandidateTimesheetApiMocks } from './candidate-timesheets.js'
import { MOBILE_ALLOCATION_API_BODY } from './candidate-timesheets-mobile-data.js'

/**
 * Mobile allocation / summary week view (Reach route `/candidate/timesheets/allocation/`).
 * Django embeds data with `?mobile=1` — see vr_django `candidate_timesheets.build_context`.
 */
export const candidateTimesheetsMobileAllocation: PageDefinition = {
  id: 'candidate-timesheets-mobile-allocation',
  name: 'Candidate Timesheets (mobile allocation)',
  path: '/candidate/timesheets/?mobile=1&end_date=2026-03-28&hc_id=301',
  roles: ['vendor'],
  fullPage: true,
  django: true,

  async setup(page: Page, _role: Role) {
    await installCandidateTimesheetApiMocks(page, MOBILE_ALLOCATION_API_BODY)
  },

  async waitForReady(page: Page) {
    await page.waitForURL('**/candidate/timesheets/allocation**', { timeout: 20000 })
    await page.waitForSelector('[data-testid="week_date_range"]', { state: 'visible', timeout: 20000 })
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // legacy page — long-polling is OK
    }
    await page.waitForTimeout(1500)
  },
}
