import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, dateOnly } from '../mock-utils.js'

const dateStr = (n: number) => dateOnly(daysAgo(n))

// Current week: end_date = last Sunday relative to anchor date (2026-01-15 is Thursday, so last Sunday = 2026-01-11)
const END_DATE = '2026-01-11'

const NAV_CONFIG_EMPLOYER = {
  is_impersonated: false,
  profile_menu_button: { displayed_name: 'James Employer', avatar_img: null },
  profile_menu: {
    my_profile: { is_profile_complete: true },
    notification_preferences: true,
    switch_account: false,
    delegate_access: false,
    sign_out: { sign_out_url: '/sign_out' },
  },
  main_menu: {
    home: true,
    jobs_menu: { jobs: true, interview_schedules: true, interview_management: true },
    people_menu: { candidates: true, contractors_summary: true, workers_summary: true },
    work_orders: true,
    invoices_menu: { invoices_summary: true, invoice_payments: true, invoice_files: true },
    timesheets_menu: { timesheet_summary: true, timesheet_archives: true },
    dashboards: true,
    reports_menu: { reports: true },
    more_menu: {
      approvals: true, documents: true, vendors: true, users: true,
      expenses: true, bulk_updates: true, checklists: true, company_settings: true,
    },
  },
}

const NAV_CONFIG_VENDOR = {
  is_impersonated: false,
  profile_menu_button: { displayed_name: 'Sarah Vendor', avatar_img: null },
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

// Timesheets list results — what /api/v2/time/time-entries/ returns
// Each item is a "managed candidate" with a timeentry_set
const makeTimesheets = (isVendor: boolean) => paginated([
  {
    id: 101, full_name: 'Jane Smith', vendor_entity_name: isVendor ? null : 'Acme Staffing',
    hiredcandidate_set: [1001],
    timeentry_set: [{
      id: 2001, status: 'Submitted', status_id: 2, notes: [], can_approve_timesheet: !isVendor,
      documents: [],
      approved_by: null, approval_time: null,
      updated_by: 'Jane Smith', updated_at: daysAgo(1),
      total_hours: 40, reg_hours: 40, ot_hours: 0,
      bill_rate: 125.00, total_amount: 5000.00,
    }],
  },
  {
    id: 102, full_name: 'Bob Johnson', vendor_entity_name: isVendor ? null : 'TechBridge Solutions',
    hiredcandidate_set: [1002],
    timeentry_set: [{
      id: 2002, status: 'Approved', status_id: 3, notes: ['Great week!'], can_approve_timesheet: false,
      documents: [{ id: 1, name: 'timesheet_signed.pdf' }],
      approved_by: 'James Employer', approval_time: daysAgo(1),
      updated_by: 'Bob Johnson', updated_at: daysAgo(2),
      total_hours: 42, reg_hours: 40, ot_hours: 2,
      bill_rate: 150.00, total_amount: 6300.00,
    }],
  },
  {
    id: 103, full_name: 'Maria Garcia', vendor_entity_name: isVendor ? null : 'Apex Workforce',
    hiredcandidate_set: [1003],
    timeentry_set: [{
      id: 2003, status: 'Saved', status_id: 1, notes: [], can_approve_timesheet: false,
      documents: [],
      approved_by: null, approval_time: null,
      updated_by: 'Maria Garcia', updated_at: daysAgo(0),
      total_hours: 32, reg_hours: 32, ot_hours: 0,
      bill_rate: 110.00, total_amount: 3520.00,
    }],
  },
  {
    id: 104, full_name: 'David Lee', vendor_entity_name: isVendor ? null : 'Acme Staffing',
    hiredcandidate_set: [1004],
    timeentry_set: [{
      id: 2004, status: 'Submitted', status_id: 2, notes: [], can_approve_timesheet: !isVendor,
      documents: [],
      approved_by: null, approval_time: null,
      updated_by: 'David Lee', updated_at: daysAgo(1),
      total_hours: 40, reg_hours: 40, ot_hours: 0,
      bill_rate: 175.00, total_amount: 7000.00,
    }],
  },
  {
    id: 105, full_name: 'Emily Chen', vendor_entity_name: isVendor ? null : 'GlobalStaff Inc',
    hiredcandidate_set: [1005],
    timeentry_set: [{
      id: 2005, status: 'Rejected', status_id: 4, notes: ['Missing Monday hours'], can_approve_timesheet: false,
      documents: [],
      approved_by: null, approval_time: null,
      updated_by: 'James Employer', updated_at: daysAgo(2),
      total_hours: 36, reg_hours: 36, ot_hours: 0,
      bill_rate: 130.00, total_amount: 4680.00,
    }],
  },
  {
    id: 106, full_name: 'Carlos Rivera', vendor_entity_name: isVendor ? null : 'TechBridge Solutions',
    hiredcandidate_set: [1006],
    timeentry_set: [{
      id: 2006, status: 'Approved', status_id: 3, notes: [], can_approve_timesheet: false,
      documents: [],
      approved_by: 'Alice Manager', approval_time: daysAgo(1),
      updated_by: 'Carlos Rivera', updated_at: daysAgo(3),
      total_hours: 40, reg_hours: 40, ot_hours: 0,
      bill_rate: 165.00, total_amount: 6600.00,
    }],
  },
  {
    id: 107, full_name: 'Priya Sharma', vendor_entity_name: isVendor ? null : 'Apex Workforce',
    hiredcandidate_set: [1007],
    timeentry_set: [{
      id: 2007, status: 'Submitted', status_id: 2, notes: [], can_approve_timesheet: !isVendor,
      documents: [],
      approved_by: null, approval_time: null,
      updated_by: 'Priya Sharma', updated_at: daysAgo(1),
      total_hours: 38, reg_hours: 38, ot_hours: 0,
      bill_rate: 140.00, total_amount: 5320.00,
    }],
  },
  {
    id: 108, full_name: 'Michael Torres', vendor_entity_name: isVendor ? null : 'Acme Staffing',
    hiredcandidate_set: [1008],
    timeentry_set: [{
      id: 2008, status: 'Saved', status_id: 1, notes: [], can_approve_timesheet: false,
      documents: [],
      approved_by: null, approval_time: null,
      updated_by: 'Michael Torres', updated_at: daysAgo(0),
      total_hours: 20, reg_hours: 20, ot_hours: 0,
      bill_rate: 95.00, total_amount: 1900.00,
    }],
  },
  {
    id: 109, full_name: 'Sarah Williams', vendor_entity_name: isVendor ? null : 'GlobalStaff Inc',
    hiredcandidate_set: [1009],
    timeentry_set: [{
      id: 2009, status: 'Approved', status_id: 3, notes: [], can_approve_timesheet: false,
      documents: [{ id: 2, name: 'timesheet_week.pdf' }],
      approved_by: 'James Employer', approval_time: daysAgo(2),
      updated_by: 'Sarah Williams', updated_at: daysAgo(4),
      total_hours: 40, reg_hours: 40, ot_hours: 0,
      bill_rate: 120.00, total_amount: 4800.00,
    }],
  },
  {
    id: 110, full_name: 'Kevin Park', vendor_entity_name: isVendor ? null : 'TechBridge Solutions',
    hiredcandidate_set: [1010],
    timeentry_set: [{
      id: 2010, status: 'Submitted', status_id: 2, notes: [], can_approve_timesheet: !isVendor,
      documents: [],
      approved_by: null, approval_time: null,
      updated_by: 'Kevin Park', updated_at: daysAgo(1),
      total_hours: 44, reg_hours: 40, ot_hours: 4,
      bill_rate: 200.00, total_amount: 8800.00,
    }],
  },
  {
    id: 111, full_name: 'Amanda Foster', vendor_entity_name: isVendor ? null : 'Apex Workforce',
    hiredcandidate_set: [1011],
    timeentry_set: [{
      id: 2011, status: 'Approved', status_id: 3, notes: [], can_approve_timesheet: false,
      documents: [],
      approved_by: 'Alice Manager', approval_time: daysAgo(1),
      updated_by: 'Amanda Foster', updated_at: daysAgo(5),
      total_hours: 40, reg_hours: 40, ot_hours: 0,
      bill_rate: 155.00, total_amount: 6200.00,
    }],
  },
  {
    id: 112, full_name: 'James Wilson', vendor_entity_name: isVendor ? null : 'Acme Staffing',
    hiredcandidate_set: [1012],
    timeentry_set: [{
      id: 2012, status: 'Submitted', status_id: 2, notes: [], can_approve_timesheet: !isVendor,
      documents: [],
      approved_by: null, approval_time: null,
      updated_by: 'James Wilson', updated_at: daysAgo(1),
      total_hours: 40, reg_hours: 40, ot_hours: 0,
      bill_rate: 115.00, total_amount: 4600.00,
    }],
  },
], { count: 60 })

// list_metadata is returned alongside results in the API response
const makeListMetadata = (isVendor: boolean) => ({
  file_transfer_type: 'TIME_SHEET',
  show_timesheet_link: true,
  show_action_buttons: !isVendor,
  show_pending_approvals: !isVendor,
  can_toggle_timesheet: true,
  allow_bulk_approval: !isVendor,
  show_upload_button: !isVendor,
  show_hired_candidate_link: !isVendor,
  can_bulk_submit: false,
})

const PENDING_APPROVAL_DATES = {
  pending_count: 4,
  weeks: [
    { end_date: END_DATE, start_day: 0 },
    { end_date: dateStr(7), start_day: 0 },
  ],
}

/**
 * Time Entries page (/time-entries/tsview/)
 * Django template rendered by VR middleware with mock context.
 * React `time` bundle reads props from inline JS in the template.
 */
export const timeEntries: PageDefinition = {
  id: 'time-entries',
  name: 'Time Entries',
  path: '/time-entries/tsview/',
  roles: ['employer', 'vendor'],
  fullPage: true,
  django: true,

  async waitForReady(page: Page) {
    // Wait for the timesheet list to render rows
    try {
      await page.waitForSelector('#TimesheetList-body', { timeout: 25000 })
      // Wait a bit more for data to populate
      await page.waitForTimeout(2000)
    } catch {
      console.log('DEBUG: TimesheetList-body not found, waiting...')
      await page.waitForTimeout(4000)
    }
    await page.waitForTimeout(1000)
  },

  async setup(page: Page, role: Role) {
    const isVendor = role === 'vendor'

    // Account me
    await page.route('**/api/v2/accounts/me/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: isVendor ? 20 : 10,
          full_name: isVendor ? 'Sarah Vendor' : 'James Employer',
          email: isVendor ? 'sarah@acmestaffing.com' : 'james@cruisecorp.com',
          role: isVendor ? 'vendor' : 'employer',
          rbac_role: isVendor ? 'vendor_admin' : 'employer_admin',
          tenant: 'cruise',
          environment: 'local',
          timezone: 'America/New_York',
          locale: 'en',
          vendor_id: isVendor ? 5 : null,
          vendor_entity_id: isVendor ? 5 : null,
          employer_id: isVendor ? null : 1,
          isVendorRole: isVendor,
          isCandidateRole: false,
          isEmployerRole: !isVendor,
        }),
      })
    })

    // Navigation menu
    await page.route('**/api/v2/nav/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isVendor ? NAV_CONFIG_VENDOR : NAV_CONFIG_EMPLOYER),
      })
    })

    // Feature flags
    await page.route('**/api/v2/client/feature-flags/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true),
      })
    })

    // Contact us config
    await page.route('**/api/contact-us-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })

    // Main timesheet list API — /api/v2/time/time-entries/?...
    // Returns paginated candidates with timeentry_set + list_metadata
    await page.route(/.*\/api\/v2\/time\/time-entries\//, (route) => {
      const timesheets = makeTimesheets(isVendor)
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...timesheets,
          list_metadata: makeListMetadata(isVendor),
        }),
      })
    })

    // Pending approval dates (used to populate "Pending Approvals" dropdown)
    await page.route(/.*\/api\/v2\/time\/pending-approval/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PENDING_APPROVAL_DATES),
      })
    })

    // Is approver check — employer gets true, vendor gets false
    await page.route(/.*\/time_entry_details\/time_approver\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isApprover: !isVendor,
          count: isVendor ? 0 : 4,
        }),
      })
    })

    // Saved entry count (for bulk submit)
    await page.route(/.*\/time_entry_details\/saved_entry_count\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(2),
      })
    })

    // User tasks list (nav task drawer)
    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, title: 'Review timesheet for Bob Johnson', status: 1, due_date: daysAgo(-2), category: 'Timesheet', priority: 'high' },
          { id: 2, title: 'Approve work order modification', status: 1, due_date: daysAgo(-1), category: 'Work Order', priority: 'medium' },
          { id: 3, title: 'Review invoice #INV-5678', status: 1, due_date: daysAgo(0), category: 'Invoice', priority: 'low' },
        ])),
      })
    })
  },
}
