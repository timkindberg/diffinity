import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'

const NAV_CONFIG_VENDOR = {
  is_impersonated: false,
  profile_menu_button: {
    displayed_name: 'Sarah Vendor',
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

// Timesheet data shape matching what Django embeds via {{ data|json_script:"data" }}.
// Kept here for the API mock (React app re-fetches on save/refresh).
const START_DATE = '2026-03-22'
const END_DATE = '2026-03-28'

function makeDay(date: string) {
  return { date, is_active: true, seconds: 0, units: 0 }
}

/** Must use entry_date — legacy TimeEntryTable matches e.entry_date to day.date (not `date`). */
function weekEntries(hoursPerDay: number[]) {
  const dates = ['2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28']
  return dates.map((entry_date, i) => ({ entry_date, total_hours: hoursPerDay[i]!, total_units: 0 }))
}

/** Must match `settings.misc.display.chargeCodes[].type` and datasource mock URL segment. */
const VR_CHARGE_CODE_TABLE_TYPE = 'vr_cost_center'

/** Minimal charge-code datasource so ChargeCodeTimeEntryTable leaves the loading spinner. */
const VR_CHARGE_CODE_DATASOURCE = {
  id: 99001,
  type: VR_CHARGE_CODE_TABLE_TYPE,
  title: 'Cost allocation',
  row_schema: {
    type: 'object',
    required: ['gl_account', 'cost_object'],
    properties: {
      gl_account: { type: 'string', title: 'GL account' },
      cost_object: { type: 'string', title: 'Cost object' },
    },
    $vndly_features: { rows_per_page: 25 },
  },
  row_ui_schema: {
    items: { 'ui:order': ['gl_account', 'cost_object'] },
    $timesheets: {
      'ui:order': ['gl_account', 'cost_object'],
      forceValue: true,
      gl_account: {
        readonly: true,
        'ui:widget': 'select',
        'ui:options': {
          options: [
            { value: '6200-ENG', label: '6200 — Engineering labor' },
            { value: '6300-OPS', label: '6300 — Operations' },
          ],
        },
      },
      cost_object: {
        readonly: true,
        'ui:widget': 'select',
        'ui:options': {
          options: [
            { value: 'CO-1001', label: 'NextGen Portal' },
            { value: 'CO-1002', label: 'Mobile app refresh' },
          ],
        },
      },
    },
  },
  schema: {
    items: {
      properties: {
        gl_account: { type: 'string' },
        cost_object: { type: ['string', 'null'] },
      },
    },
  },
}

const VR_TIMESHEET_NOTES = [
  {
    id: 88001,
    note_date: '2026-03-26T14:00:00Z',
    note: 'Worked on-site Tuesday; lobby badge took 45m — billable from 10:00.',
    added_by: 'Jane Smith',
  },
  {
    id: 88002,
    note_date: '2026-03-24T16:00:00Z',
    note: 'OT for release week pre-approved by client manager (email 3/20).',
    added_by: 'Sarah Vendor',
  },
]

/** GET /api/related-invoice-line-items/:id/ — must be `{ invoiceLineItems, totals }`, not a bare array */
const RELATED_INVOICE_LINE_ITEMS = {
  invoiceLineItems: [
    {
      id: 7001,
      calculationPackRevisionId: 1,
      chargeCodeDisplayName: 'CC-ENG-001 · Engineering',
      clientAmount: '3200.00',
      clientRate: '80.00',
      costCodeTypeName: 'Cost center',
      currencyCode: 'USD',
      hours: '40.00',
      invoiceNumber: 'INV-240318',
      invoiceMasterId: null,
      projectCode: 'PRJ-NXT',
      projectName: 'NextGen Portal',
      timeType: 'Regular',
      workOrderCode: 'WO-2001',
      workOrderId: 2001,
      workOrderPayTypeName: 'Hourly',
      workOrderTitle: 'Senior Software Engineer',
      billingCycleStartDate: '2026-03-01',
      billingCycleEndDate: '2026-03-31',
      quantity: '40.00',
      quantityFormatted: '40',
      quantityUnit: 1,
      unitOfTimeEntry: 'hours',
    },
    {
      id: 7002,
      calculationPackRevisionId: 1,
      chargeCodeDisplayName: 'CC-ENG-001 · Engineering',
      clientAmount: '300.00',
      clientRate: '75.00',
      costCodeTypeName: 'Cost center',
      currencyCode: 'USD',
      hours: '4.00',
      invoiceNumber: 'INV-240318',
      invoiceMasterId: null,
      projectCode: 'PRJ-NXT',
      projectName: 'NextGen Portal',
      timeType: 'Overtime',
      workOrderCode: 'WO-2001',
      workOrderId: 2001,
      workOrderPayTypeName: 'Hourly OT',
      workOrderTitle: 'Senior Software Engineer',
      billingCycleStartDate: '2026-03-01',
      billingCycleEndDate: '2026-03-31',
      quantity: '4.00',
      quantityFormatted: '4',
      quantityUnit: 1,
      unitOfTimeEntry: 'hours',
    },
  ],
  totals: [
    {
      clientAmount: '3500.00',
      currencyCode: 'USD',
      hours: '44.00',
      timeType: 'TOTAL',
      quantity: '44.00',
      quantityUnit: 1,
    },
  ],
}

/** Base timesheet payload for API mock and parity with vr_django `candidate_timesheets.TIMESHEET_DATA`. */
export const CANDIDATE_TIMESHEET_API_BODY = {
  id: 5001,
  displayId: 'TS-5001',
  externalId: 'EXT-9001',
  startDate: START_DATE,
  endDate: END_DATE,
  status: 'saved',
  totals: { total: 44, regular: 40, overtime: 4, doubletime: 0 },
  candidate: {
    id: 201, name: 'Jane Smith',
    vendor: { id: 5, name: 'Acme Staffing', link: null },
    timezone: null,
  },
  hiredCandidate: {
    id: 301, name: 'Jane Smith', link: null,
    vendor: { id: 5, name: 'Acme Staffing', link: null },
    timezone: null,
  },
  projects: [
    {
      id: 401,
      code: 'PRJ-NXT',
      title: 'NextGen Portal',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      can_add_time: true,
      workOrders: [{ id: 2001, can_add_time: true }],
      tasks: [
        { id: 501, name: 'Feature development', task_code: 'DEV' },
        { id: 502, name: 'Code review', task_code: 'CR' },
      ],
    },
    {
      id: 402,
      code: 'PRJ-MOB',
      title: 'Mobile app refresh',
      startDate: '2026-02-01',
      endDate: '2026-11-30',
      can_add_time: true,
      workOrders: [{ id: 2001, can_add_time: true }],
      tasks: [{ id: 503, name: 'UI polish', task_code: 'UI' }],
    },
  ],
  workOrders: [{
    id: 2001,
    displayId: 'WO-2001',
    title: 'Senior Software Engineer',
    client_name: 'Cruise Corp',
    vendor_name: 'Acme Staffing',
    allocation_types: [],
    shift_strategy: [],
    shifts: [],
    work_types: [
      { id: 1, name: 'Regular', classification: 1 },
      { id: 2, name: 'Overtime', classification: 2 },
    ],
    is_active: true,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  }],
  workTypes: [
    {
      id: 1, name: 'Regular', classification: 1,
      is_system: false, is_passive: false, is_callback: false,
      is_break: false, nonworking_hours: false, isNonWorking: false,
    },
    {
      id: 2, name: 'Overtime', classification: 2,
      is_system: false, is_passive: false, is_callback: false,
      is_break: false, nonworking_hours: false, isNonWorking: false,
    },
  ],
  workWeek: { id: 1, start_day: 0, end_day: 6, start_time: '00:00:00', end_time: '00:00:00' },
  days: [makeDay('2026-03-22'), makeDay('2026-03-23'), makeDay('2026-03-24'), makeDay('2026-03-25'), makeDay('2026-03-26'), makeDay('2026-03-27'), makeDay('2026-03-28')],
  details: [
    {
      id: 1,
      work_order: { id: 2001 },
      work_type: { id: 1, name: 'Regular', classification: 1, is_system: false },
      work_type_name: 'Regular', work_order_title: 'Senior Software Engineer',
      charge_code: {
        type: VR_CHARGE_CODE_TABLE_TYPE,
        codes: [
          { name: 'gl_account', value: '6200-ENG', display: '6200 — Engineering labor' },
          { name: 'cost_object', value: 'CO-1001', display: 'NextGen Portal' },
        ],
      },
      premium_rate: null,
      generic_fields: {},
      entries: weekEntries([0, 8, 8, 8, 8, 8, 0]),
    },
    {
      id: 2,
      work_order: { id: 2001 },
      work_type: { id: 2, name: 'Overtime', classification: 2, is_system: false },
      work_type_name: 'Overtime', work_order_title: 'Senior Software Engineer',
      charge_code: {
        type: VR_CHARGE_CODE_TABLE_TYPE,
        codes: [
          { name: 'gl_account', value: '6200-ENG', display: '6200 — Engineering labor' },
          { name: 'cost_object', value: 'CO-1002', display: 'Mobile app refresh' },
        ],
      },
      premium_rate: null,
      generic_fields: {},
      entries: weekEntries([0, 0, 2, 2, 0, 0, 0]),
    },
  ],
  activity: [
    {
      log_id: 'vr-act-1',
      log: 'Timesheet saved as draft for week ending 2026-03-28.',
      user_id: 20,
      component: 'time_entry',
      component_id: '5001',
      created_at: '2026-03-27T14:22:00Z',
      date: '2026-03-27T14:22:00Z',
      user_full_name: 'Sarah Vendor',
      impersonator_name: null,
      viewed_by_user_with_wo_end_perm_only: false,
      was_sow_skipped: false,
      log_contains_vendor_info: false,
    },
    {
      log_id: 'vr-act-2',
      log: 'Hours updated: Regular time entries confirmed for Mon–Fri.',
      user_id: 20,
      component: 'time_entry',
      component_id: '5001',
      created_at: '2026-03-28T09:05:00Z',
      date: '2026-03-28T09:05:00Z',
      user_full_name: 'Sarah Vendor',
      impersonator_name: null,
      viewed_by_user_with_wo_end_perm_only: false,
      was_sow_skipped: false,
      log_contains_vendor_info: false,
    },
  ],
  permissions: ['time.submit', 'time.hours.update'],
  settings: {
    time_keeping: {
      timesheet_type: 'summary', timesheet_classification: 'manual',
      work_week_start: 0, use_dst: false, force_current_time: false,
      motd: 'Wednesday is a client-observed holiday — confirm billable hours with your manager if unsure.',
      disable_time_import_validations: false, message_of_the_day: null,
    },
    misc: {
      display: {
        enableChargeCodes: { enabled: true, orientation: 'left' },
        showMotdAsModal: false,
        use_ultipro: true,
        chargeCodes: [
          {
            type: VR_CHARGE_CODE_TABLE_TYPE,
            fields: [
              { name: 'gl_account', width: '160px' },
              { name: 'cost_object', width: '190px' },
            ],
          },
        ],
      },
      use_ultipro: true,
    },
  },
  metadata: { ultipro: { processed: false, source: 'manual' } },
  // readOnly skips createSyntheticDetails while still rendering the charge-code grid (synthetic rows broke VR).
  readOnly: true,
  userCanApprove: false,
  hangingLineItems: [], motd: null, genericFields: [], clockedTimes: [],
  approvalDetails: [],
  documents: [
    { id: 9101, name: 'signed-work-order.pdf', signed_url: 'https://example.invalid/vr/signed-work-order.pdf' },
    { id: 9102, name: 'week-summary.csv', signed_url: 'https://example.invalid/vr/week-summary.csv' },
    { id: 9103, name: 'client-approval-memo.pdf', signed_url: 'https://example.invalid/vr/client-approval-memo.pdf' },
    { id: 9104, name: 'badge-access-instructions.txt', signed_url: 'https://example.invalid/vr/badge-access-instructions.txt' },
  ],
  defaultChargeCodes: [],
  approved_by: null, approval_time: null,
  updated_by: 'Jane Smith', updated_at: '2026-03-28T18:00:00Z',
  toggles: { classify_clocks: false, mobile_timesheets_enabled: false, reset_v2_enabled: false },
  errors: [],
  holidaysToShow: [
    {
      id: 8801,
      name: 'Company Spring Holiday',
      holiday_profile_id: 1,
      start_date: '2026-03-25',
      start_time: null,
      end_date: '2026-03-25',
      end_time: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: 0,
    },
  ],
  forceCurrentTime: false,
  alerts: [
    {
      order: 1,
      status: 'info',
      title: 'Reminder',
      description: 'Submit this timesheet by end of day Friday so payroll can process on schedule.',
    },
    {
      order: 2,
      status: 'warning',
      title: 'Rates',
      description: 'Displayed rates are estimates until the client billing cycle closes.',
    },
  ],
  last_time_entry: null,
  next_time_entry: { end_date: '2026-04-04', url: '/candidate/timesheets/?end_date=2026-04-04&hc_id=301' },
  triggered_expenses: [
    { id: 9201, expense_number: 'EXP-1042', title: 'Parking — client site' },
    { id: 9202, expense_number: 'EXP-1043', title: 'Equipment shipping' },
  ],
  imported: false, revision_number: 1,
  dayUnits: null, timeEntryUnit: 'hours',
}

/**
 * Shared route mocks for candidate timesheet Django pages. `apiBody` must match embedded page data
 * (including `mobile=1` / `tito=1` variants from vr_django).
 */
export async function installCandidateTimesheetApiMocks(page: Page, apiBody: Record<string, unknown>) {
  await page.route('**/api/v2/accounts/me/', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 20, full_name: 'Sarah Vendor', email: 'sarah@acmestaffing.com',
        role: 'vendor', rbac_role: 'vendor_admin', tenant: 'cruise',
        environment: 'local', timezone: 'America/New_York', locale: 'en',
        vendor_id: 5, vendor_entity_id: 5, employer_id: null,
        isVendorRole: true, isCandidateRole: false, isEmployerRole: false,
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

  await page.route('**/api/v2/invoices/config', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ is_invoice_pdf_builder_enabled: false }),
    })
  })

  await page.route(/.*\/api\/v2\/time(\?|$|\/)/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiBody),
    })
  })

  await page.route(`**/api/v2/charge-code/datasources/${VR_CHARGE_CODE_TABLE_TYPE}/`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(VR_CHARGE_CODE_DATASOURCE),
    })
  })

  await page.route(`**/api/v2/charge-code/datasources/${VR_CHARGE_CODE_TABLE_TYPE}/rows/**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    })
  })

  await page.route('**/api/v2/generic_form/timesheet/timesheet/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 77001,
        name: 'timesheet',
        namespace: 'timesheet',
        display_name: 'Timesheet',
        fields: [],
      }),
    })
  })

  await page.route(/.*\/api\/v2\/invoice_line_items\/time_entry\/.*/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    })
  })

  await page.route('**/api/related-invoice-line-items/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(RELATED_INVOICE_LINE_ITEMS),
    })
  })

  await page.route('**/api/get-time-sheet-note/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(VR_TIMESHEET_NOTES),
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
}

/**
 * Candidate Timesheets page (/candidate/timesheets/)
 * Vendor-only. Django template rendered by VR middleware with mock context.
 * React `time` bundle reads data from <script id="data"> on mount.
 */
export const candidateTimesheets: PageDefinition = {
  id: 'candidate-timesheets',
  name: 'Candidate Timesheets',
  path: '/candidate/timesheets/',
  roles: ['vendor'],
  fullPage: true,
  django: true,

  async setup(page: Page, _role: Role) {
    await installCandidateTimesheetApiMocks(page, CANDIDATE_TIMESHEET_API_BODY)
  },

  async waitForReady(page: Page) {
    try {
      await page.waitForSelector('.header-timesheet, #TimesheetList-body, .timesheet-wrapper', {
        timeout: 15000,
        state: 'attached',
      })
    } catch {
      // If the selector never appears, just wait for network idle
    }
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // networkidle timeout is OK for legacy pages
    }
    await page.waitForTimeout(1500)
  },
}
