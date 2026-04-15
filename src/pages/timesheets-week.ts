import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
/** Week Sun–Sat ending 2026-03-28 (matches pages/timesheets/[end_date]). */
const DAYS = [
  '2026-03-22',
  '2026-03-23',
  '2026-03-24',
  '2026-03-25',
  '2026-03-26',
  '2026-03-27',
  '2026-03-28',
] as const
const START_DATE = DAYS[0]
const END_DATE = DAYS[6]
const TZ = 'America/New_York'

const NAV_CONFIG_CANDIDATE = {
  version: 1,
  is_impersonated: false,
  profile_menu_button: {
    displayed_name: 'Jane Smith',
    avatar_img: null,
  },
  profile_menu: {
    my_profile: { is_profile_complete: true },
    notification_preferences: true,
    switch_account: false,
    delegate_access: false,
    sign_out: { sign_out_url: '/sign_out' },
  },
  main_menu: {
    candidate_timesheets: true,
    candidate_expenses: true,
  },
}

const WT_REG = {
  id: 1,
  name: 'Regular',
  is_break: false,
  classification: 1,
  is_passive: false,
  is_system: false,
  nonworking_hours: false,
}
const WT_OT = {
  id: 2,
  name: 'Overtime',
  is_break: false,
  classification: 2,
  is_passive: false,
  is_system: false,
  nonworking_hours: false,
}

const WORK_ORDER = {
  id: 2001,
  displayId: 'WO-2001',
  title: 'Senior Software Engineer',
  work_types: [WT_REG, WT_OT],
  business_unit: 0,
  shifts: [],
  shift_strategy: [],
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  work_type_profile: { id: 1, premium_rates: [] },
  canReadWorkOrder: true,
  is_active: true,
  allocation_types: [],
  is_monthly: false,
}

function dayRow(date: string, seconds = 0): { date: string; seconds: number; is_active: boolean; duration: string } {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return {
    date,
    seconds,
    is_active: true,
    duration: `${h}h${m}m${s}s`,
  }
}

function weekEntries(hoursPerDay: number[]) {
  return DAYS.map((entry_date, i) => ({
    id: 100 + i,
    entry_date,
    total_hours: hoursPerDay[i] ?? 0,
  }))
}

/**
 * GET /api/v2/time/clocks — snake_case shape expected by clock+assign (`GetTimeResponse`).
 * STATUS_SAVED = 1
 */
const CLOCKS_TIMESHEET_DATA = {
  id: 5001,
  display_id: 'TS-5001',
  start_date: START_DATE,
  end_date: END_DATE,
  status: 1,
  totals: {
    hours: 44,
    regular: 40,
    overtime: 4,
    double: 0,
    holiday: 0,
    billable: 44,
    nonBillable: 0,
  },
  candidate: {
    id: 201,
    name: 'Jane Smith',
    vendor: { id: 5, name: 'Acme Staffing', link: '/vendors/5/' },
    timezone: TZ,
    hc_id: 301,
  },
  hired_candidate: {
    id: 301,
    name: 'Jane Smith',
    candidate_id: 201,
    vendor: { id: 5, name: 'Acme Staffing', link: '/vendors/5/' },
    timezone: TZ,
    link: '/candidates/201/',
    hc_id: 301,
  },
  read_only: false,
  imported: false,
  documents: [],
  approval_details: [],
  permissions: ['time.read', 'time.hours.update', 'time.allocations.update', 'time.submit', 'time.adjust', 'time.unapprove'],
  settings: {
    time_keeping: {
      motd: 'Confirm billable hours with your manager if unsure.',
      timesheet_type: 'clock+assign',
      timesheet_classification: 'manual',
      disable_time_import_validations: false,
      force_current_time_for_vendor: false,
      force_current_time_for_contractor: false,
    },
    time_shifts: {
      enforce_shift_day_validations_on_timesheets: false,
      enforce_shift_time_validations_on_timesheets: false,
    },
  },
  days: DAYS.map((d, i) => {
    const sec = [0, 28800, 28800, 28800, 28800, 28800, 0][i] ?? 0
    return dayRow(d, sec)
  }),
  break_days: DAYS.map((d) => dayRow(d, 0)),
  clocked_times: [] as unknown[],
  details: [
    {
      entries: weekEntries([0, 8, 8, 8, 8, 8, 0]),
      work_type: { id: 1, is_break: false, classification: 1, name: 'Regular' },
      work_order: { id: 2001, title: 'Senior Software Engineer' },
      charge_code: { id: 0, type: '', codes: [] },
    },
    {
      entries: weekEntries([0, 0, 2, 2, 0, 0, 0]),
      work_type: { id: 2, is_break: false, classification: 2, name: 'Overtime' },
      work_order: { id: 2001, title: 'Senior Software Engineer' },
      charge_code: { id: 0, type: '', codes: [] },
    },
  ],
  work_orders: [WORK_ORDER],
  work_types: [WT_REG, WT_OT],
  alerts: [
    {
      order: 1,
      status: 'info',
      title: 'Reminder',
      description: 'Submit this timesheet by end of day Friday.',
    },
  ],
  holidays: [
    {
      id: 8801,
      name: 'Company Spring Holiday',
      holiday_profile: 1,
      start_date: '03/25/2026',
      start_time: null,
      end_date: '03/25/2026',
      end_time: null,
      created_by: 0,
    },
  ],
  last_time_entry: null,
  next_time_entry: { end_date: '2026-04-04', url: '/timesheets/2026-04-04' },
  triggered_expenses: [],
  force_current_time: false,
  switch_allocation_eligible: false,
  time_shifts_settings: {
    enforce_shift_day_validations_on_timesheets: false,
    enforce_shift_time_validations_on_timesheets: false,
  },
  data_by_date: Object.fromEntries(DAYS.map((d) => [d, { non_working_hrs: [] }])),
  work_week_start_time: '00:00:00',
}

/**
 * Next.js clock+assign week view (/timesheets/[end_date]).
 * Capture uses vendor login; `accounts/me` is mocked as candidate so the page does not redirect to tsviewv2.
 */
export const timesheetsWeek: PageDefinition = {
  id: 'timesheets-week',
  name: 'Timesheets week (clock & assign)',
  path: '/timesheets/2026-03-28',
  roles: ['vendor'],
  fullPage: true,

  async setup(page: Page, _role: Role) {
    await page.route('**/api/v2/accounts/me/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 201,
          full_name: 'Jane Smith',
          email: 'jane.smith@contractor.local',
          role: 'candidate',
          rbac_role: 'candidate',
          tenant: 'cruise',
          environment: 'local',
          timezone: TZ,
          locale: 'en',
          vendor_id: null,
          vendor_entity_id: null,
          employer_id: null,
          hired_candidate_id: 301,
          isVendorRole: false,
          isCandidateRole: true,
          isEmployerRole: false,
        }),
      })
    })

    await page.route('**/api/v2/nav/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NAV_CONFIG_CANDIDATE),
      })
    })

    await page.route('**/api/v2/client/feature-flags/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true),
      })
    })

    await page.route(/.*\/api\/v2\/time\/activity_log.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 0,
          limit: 30,
          offset: 0,
          page: 1,
          total_pages: 0,
          next_link: null,
          next_params: null,
          previous_link: null,
          previous_params: null,
          results: [],
        }),
      })
    })

    await page.route(/\/api\/v2\/time\/clocks(\?|$)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CLOCKS_TIMESHEET_DATA),
      })
    })

    await page.route('**/api/v2/entities/settings/misc/banners/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })

    await page.route('**/api/contact-us-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })

    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [], total_pages: 0 }),
      })
    })

    await page.route('**/api/v2/user_tasks/summary', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: {} }),
      })
    })
  },

  async waitForReady(page: Page) {
    await page.waitForSelector('[data-testid="global-navigation-menu"]', { state: 'visible', timeout: 20000 })
    await page.waitForSelector(
      '[data-testid="week-view-web"], [data-testid^="day_card_"], [data-testid="timesheet-status"]',
      { state: 'visible', timeout: 20000 },
    )
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // non-fatal
    }
    await page.waitForTimeout(1500)
  },
}
