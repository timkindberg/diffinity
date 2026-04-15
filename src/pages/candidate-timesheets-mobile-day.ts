import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { installCandidateTimesheetApiMocks } from './candidate-timesheets.js'
import { MOBILE_DAY_API_BODY, VR_MOBILE_FROZEN_DATE } from './candidate-timesheets-mobile-data.js'

/**
 * Mobile day view (time in / time out).
 * Deep-link to `/candidate/timesheets/day/:date` so we do not depend on freezing `Date` (real "today"
 * is often outside the mocked week, which would redirect to week view instead).
 */
export const candidateTimesheetsMobileDay: PageDefinition = {
  id: 'candidate-timesheets-mobile-day',
  name: 'Candidate Timesheets (mobile day)',
  path: `/candidate/timesheets/day/${VR_MOBILE_FROZEN_DATE}?mobile=1&tito=1&end_date=2026-03-28&hc_id=301`,
  roles: ['vendor'],
  fullPage: true,
  django: true,

  async setup(page: Page, _role: Role) {
    await installCandidateTimesheetApiMocks(page, MOBILE_DAY_API_BODY)
  },

  async waitForReady(page: Page) {
    await page.waitForURL(`**/candidate/timesheets/day/${VR_MOBILE_FROZEN_DATE}**`, { timeout: 20000 })
    await page.waitForSelector('[data-testid="DayView"]', { state: 'visible', timeout: 20000 })
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // legacy page
    }
    await page.waitForTimeout(1500)
  },
}
