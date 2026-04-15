import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'

const END_DATE_YM = '2026-03'
const MONTH_START = '2026-03-01'
const MONTH_END = '2026-03-31'
const TIMESHEET_ID = 91001
const HC_ID = 8801
const CANDIDATE_ID = 7701
const USER_ID = 6601
const WORK_ORDER_ID = 2001
const TIME_TYPE_ID = 5001

/** Week start for the second week tab (fully within March). */
const DEFAULT_WEEK_START = '2026-03-02'

const NAV_CONFIG_VENDOR = {
  is_impersonated: false,
  profile_menu_button: {
    displayed_name: 'Jane Contractor',
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
    home: true,
    jobs_menu: { jobs: true },
    work_orders: true,
    timesheets_menu: { timesheet_summary: true },
    more_menu: { approvals: true, documents: true },
  },
}

const WORK_TYPE_REGULAR = {
  id: 1,
  name: 'Regular',
  classification: 1,
  nonworking_hours: false,
  is_passive: false,
  is_break: false,
  is_callback: false,
  is_system: false,
}

const WORK_ORDER = {
  id: WORK_ORDER_ID,
  displayId: 'WO-2001',
  title: 'Senior Software Engineer',
  work_types: [WORK_TYPE_REGULAR],
  business_unit: 1,
  shifts: [],
  shift_strategy: [],
  is_monthly: true,
  canReadWorkOrder: true,
  contract_pay_type: 'monthly',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  work_type_profile: { id: 1, premium_rates: [] },
  is_active: true,
  allocation_types: [],
}

const MONTHLY_TIMESHEET = {
  id: TIMESHEET_ID,
  display_id: 'MTS-91001',
  status: 1,
  work_orders: [WORK_ORDER],
  permissions: ['time.hours.update', 'time.submit', 'time.allocations.update'],
  holidays: [],
  alerts: [
    {
      order: 1,
      status: 'info',
      title: 'Reminder',
      description: 'Submit March hours by the last business day of the month.',
    },
  ],
}

const HIRED_CANDIDATE = {
  id: HC_ID,
  name: 'Jane Contractor',
  link: '/contractors/8801/',
  vendor: { id: 5, name: 'Acme Staffing', link: '/vendors/5/' },
}

const CANDIDATE = {
  id: CANDIDATE_ID,
  name: 'Jane Contractor',
  hc_id: HC_ID,
  timezone: 'America/New_York',
  vendor: { id: 5, name: 'Acme Staffing', link: '/vendors/5/' },
}

const TIME_TYPE_ROW = {
  id: TIME_TYPE_ID,
  time_entry: TIMESHEET_ID,
  work_order: WORK_ORDER_ID,
  work_type: 'Regular',
  work_type_id: 1,
  charge_code: { id: 0, type: '', title: '', codes: [] },
  shift: null,
  generic_fields: {},
}

const MONTHLY_METADATA = {
  start_date: MONTH_START,
  end_date: MONTH_END,
  imported: false,
  hired_candidate: HIRED_CANDIDATE,
  candidate: CANDIDATE,
  time_types: [TIME_TYPE_ROW],
  default_time_types: null,
  aggregated_totals: {
    total_quantity: 40,
    time_type_week_totals: { [String(TIME_TYPE_ID)]: { [DEFAULT_WEEK_START]: 40 } },
    work_order_date_totals: {
      [String(WORK_ORDER_ID)]: {
        '2026-03-02': 8,
        '2026-03-03': 8,
        '2026-03-04': 8,
        '2026-03-05': 8,
        '2026-03-06': 8,
      },
    },
    work_order_week_totals: { [String(WORK_ORDER_ID)]: { [DEFAULT_WEEK_START]: 40 } },
    work_type_totals: { Regular: 40 },
  },
  generic_field_metadata: {},
  timekeeping_settings: {
    disable_time_import_validations: false,
    global_lock_date: null,
    motd: 'Confirm March hours before the billing cutoff.',
    work_week_start_day: 1,
  },
  time_misc: {
    display: { showMotdAsModal: false },
  },
  unit_of_time: 'hours',
  other_month_totals: {},
}

function weekAllocationEntries() {
  const dates = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']
  return dates.map((entry_date) => ({
    time_type: TIME_TYPE_ID,
    entry_date,
    quantity: '8',
  }))
}

const ACTIVITY_LOG_PAGE = {
  offset: 0,
  limit: 20,
  results: [] as unknown[],
  count: 0,
  page: 1,
  total_pages: 1,
  next_link: null,
  next_params: null,
  previous_link: null,
  previous_params: null,
}

/** `useGetTimeSummaryQuery` in TimeSummaryDrawer — required on load when timesheet id is set */
const TIMESHEET_SUMMARY = {
  timesheet_id: 'MTS-91001',
  timesheet_range: 'March 2026',
  weekly_data: [
    {
      week_range_display: 'Feb 23 – Mar 1, 2026',
      work_type_data: { Regular: 40 },
      missing_entries: false,
    },
    {
      week_range_display: 'Mar 2 – Mar 8, 2026',
      work_type_data: { Regular: 0 },
      missing_entries: false,
    },
    {
      week_range_display: 'Mar 9 – Mar 15, 2026',
      work_type_data: { Regular: 0 },
      missing_entries: false,
    },
    {
      week_range_display: 'Mar 16 – Mar 22, 2026',
      work_type_data: { Regular: 0 },
      missing_entries: false,
    },
    {
      week_range_display: 'Mar 23 – Mar 29, 2026',
      work_type_data: { Regular: 0 },
      missing_entries: false,
    },
    {
      week_range_display: 'Mar 30 – Apr 5, 2026',
      work_type_data: { Regular: 0 },
      missing_entries: false,
    },
  ],
  total_data: { Regular: 40 },
  over_limit_days: [] as string[],
}

/**
 * Contractor monthly timesheet (Next.js) — /timesheets/month/2026-03
 * Login uses vendor VR user; /api/v2/accounts/me/ is mocked as candidate so the page does not redirect.
 */
export const timesheetsMonth: PageDefinition = {
  id: 'timesheets-month',
  name: 'Timesheets Month',
  path: `/timesheets/month/${END_DATE_YM}`,
  roles: ['vendor'],
  fullPage: true,

  async setup(page: Page, _role: Role) {
    await page.route('**/api/v2/accounts/me/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: USER_ID,
          full_name: 'Jane Contractor',
          email: 'jane.contractor@example.com',
          role: 'candidate',
          rbac_role: 'candidate',
          tenant: 'cruise',
          environment: 'local',
          timezone: 'America/New_York',
          locale: 'en',
          vendor_id: null,
          vendor_entity_id: null,
          employer_id: null,
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
        body: JSON.stringify(NAV_CONFIG_VENDOR),
      })
    })

    await page.route('**/api/v2/client/feature-flags/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true),
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

    await page.route(/.*\/api\/v2\/time\/monthlymetadata(\?|$)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MONTHLY_METADATA),
      })
    })

    await page.route(/.*\/api\/v2\/time\/monthly(\?|$)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MONTHLY_TIMESHEET),
      })
    })

    await page.route(/.*\/api\/v2\/time\/timesheet-summary\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TIMESHEET_SUMMARY),
      })
    })

    await page.route(/.*\/api\/v2\/time\/list-monthly-allocations\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ entries: weekAllocationEntries() }),
      })
    })

    await page.route(/.*\/api\/v2\/time\/monthly-documents\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'march-receipt.pdf', signed_url: 'https://example.invalid/vr/march-receipt.pdf' },
        ]),
      })
    })

    await page.route(/.*\/api\/v2\/time\/activity_log\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVITY_LOG_PAGE),
      })
    })

    await page.route('**/api/get-time-sheet-note/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notes: [] }),
      })
    })
  },

  async waitForReady(page: Page) {
    await page.waitForSelector('[data-testid="work_order-WO-2001"]', { timeout: 25000 })
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // non-fatal
    }
    // Click the second week tab (fully within March) to avoid "Navigate to the previous month" links
    const tab = page.getByText('2 Mar - 8 Mar')
    if (await tab.isVisible()) {
      await tab.click()
      await page.waitForTimeout(1500)
    } else {
      await page.waitForTimeout(1500)
    }
  },
}
