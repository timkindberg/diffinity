import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo } from '../mock-utils.js'


const NAV_CONFIG_EMPLOYER = {
  is_impersonated: false,
  profile_menu_button: {
    displayed_name: 'James Employer',
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
    jobs_menu: { jobs: true, interview_schedules: true, interview_management: true },
    people_menu: { candidates: true, contractors_summary: true, workers_summary: true },
    work_orders: true,
    invoices_menu: { invoices_summary: true, invoice_payments: true, invoice_files: true },
    timesheets_menu: { timesheet_summary: true, timesheet_archives: true },
    dashboards: true,
    reports_menu: { reports: true },
    more_menu: {
      approvals: true,
      documents: true,
      vendors: true,
      users: true,
      expenses: true,
      bulk_updates: true,
      checklists: true,
      company_settings: true,
    },
  },
}

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

const QUICK_ACTIONS_EMPLOYER = [
  { id: 'create_a_job', title: 'Create a Job', url: '/jobs/new/' },
  { id: 'fast_path', title: 'Fast Fill', url: '#' },
  { id: 'review_timesheets', title: 'Review Timesheets', url: '/time-entries/tsview/', count: '12' },
  { id: 'review_expenses', title: 'Review Expenses', url: '/expenses', count: '5' },
  { id: 'approvals', title: 'Approvals', url: '/approvals/', count: '3' },
  { id: 'checklist_actions', title: 'Checklist Actions', url: '/checklist_actions', count: '8' },
]

const QUICK_ACTIONS_VENDOR = [
  { id: 'add_candidates', title: 'Add Candidates', url: '/candidates/' },
  { id: 'apply_candidates', title: 'Apply Candidates', url: '/vendors/applied-candidates/', count: '4' },
  { id: 'review_timesheets', title: 'Review Timesheets', url: '/time-entries/tsview/' },
  { id: 'approvals', title: 'Approvals', url: '/approvals/', count: '2' },
]

const STATS_EMPLOYER = {
  header_items: [
    {
      id: 'jobs', title: 'Jobs', content: '47', url: '/jobs',
      sub_header1: 'Open', sub_content1: '23', sub_url1: '/jobs?status=open',
      sub_header2: 'Pending', sub_content2: '8', sub_url2: '/jobs?status=pending',
    },
    {
      id: 'work_orders', title: 'Work Orders', content: '156', url: '/work_orders/all',
      sub_header1: 'Active', sub_content1: '89', sub_url1: '/work_orders/all?status=active',
      sub_header2: 'Pending', sub_content2: '24', sub_url2: '/work_orders/all?status=pending',
    },
    {
      id: 'contractors', title: 'Contractors', content: '203', url: '/contractors/',
      sub_header1: 'Active', sub_content1: '156', sub_url1: '/contractors/?status=active',
      sub_header2: 'Ending Soon', sub_content2: '12', sub_url2: '/contractors/?status=ending_soon',
    },
    {
      id: 'wo_mods', title: 'WO Mods', content: '18', url: '/approvals/',
      sub_header1: 'Pending', sub_content1: '14', sub_url1: '/approvals/',
      sub_header2: 'Approved', sub_content2: '4', sub_url2: '/approvals/',
    },
  ],
}

const STATS_VENDOR = {
  header_items: [
    {
      id: 'work_orders', title: 'Work Orders', content: '23', url: '/work_orders/all',
      sub_header1: 'Active', sub_content1: '18', sub_url1: '/work_orders/all?status=active',
      sub_header2: 'Pending', sub_content2: '5', sub_url2: '/work_orders/all?status=pending',
    },
    {
      id: 'contractors', title: 'Contractors', content: '45', url: '/contractors/',
      sub_header1: 'Active', sub_content1: '38', sub_url1: '/contractors/?status=active',
      sub_header2: 'Ending Soon', sub_content2: '4', sub_url2: '/contractors/?status=ending_soon',
    },
  ],
}

const NOTIFICATIONS = paginated([
    { id: '101', message: 'Jane Smith applied for Senior Software Engineer position at TechBridge Solutions', is_viewed: false, created_at: daysAgo(0) },
    { id: '102', message: 'Work order #WO-2341 requires your approval — modification requested by Acme Staffing', is_viewed: false, created_at: daysAgo(0) },
    { id: '103', message: 'Invoice #INV-5678 submitted by Acme Staffing for $12,450.00', is_viewed: false, created_at: daysAgo(1) },
    { id: '104', message: 'Bob Johnson timesheet for week of Mar 24–28 is pending review', is_viewed: true, created_at: daysAgo(1) },
    { id: '105', message: 'New candidate applied: Maria Garcia for Data Engineer role', is_viewed: false, created_at: daysAgo(2) },
])

const MESSAGES = {
  conv: [
    {
      id: '201',
      cfrom: { first_name: 'Alice' },
      cto: { first_name: 'James' },
      is_read: false,
      created_at: daysAgo(0),
      message: 'Can you approve the updated work order extension for the data team?',
    },
    {
      id: '202',
      cfrom: { first_name: 'Charlie' },
      cto: { first_name: 'James' },
      is_read: false,
      created_at: daysAgo(1),
      message: 'The candidate has accepted the offer. Onboarding starts Monday.',
    },
    {
      id: '203',
      cfrom: { first_name: 'Diana' },
      cto: { first_name: 'James' },
      is_read: true,
      created_at: daysAgo(2),
      message: 'Invoice payment has been processed for TechBridge Solutions — $18,200.',
    },
  ],
  message_count: 8,
  is_in_app_messaging_disabled: false,
}

const TASK_SUMMARY = {
  results: {
    'Billing Cycle': { key: 'Billing Cycle', label: 'Billing Cycle', pending_count: 0, overdue_count: 0 },
    Contractor: { key: 'Contractor', label: 'Contractor', pending_count: 2, overdue_count: 0 },
    Expenses: { key: 'Expenses', label: 'Expenses', pending_count: 5, overdue_count: 1 },
    Interview: { key: 'Interview', label: 'Interview', pending_count: 3, overdue_count: 0 },
    Invoice: { key: 'Invoice', label: 'Invoice', pending_count: 4, overdue_count: 2 },
    Job: { key: 'Job', label: 'Job', pending_count: 0, overdue_count: 0 },
    'Job Applicant': { key: 'Job Applicant', label: 'Job Applicant', pending_count: 7, overdue_count: 3 },
    'Job Offer': { key: 'Job Offer', label: 'Job Offer', pending_count: 1, overdue_count: 0 },
    'Statement Of Work': { key: 'Statement Of Work', label: 'Statement Of Work', pending_count: 2, overdue_count: 0 },
    Timesheet: { key: 'Timesheet', label: 'Timesheet', pending_count: 8, overdue_count: 0 },
    Vendor: { key: 'Vendor', label: 'Vendor', pending_count: 0, overdue_count: 0 },
    'Worker Tracker': { key: 'Worker Tracker', label: 'Worker Tracker', pending_count: 1, overdue_count: 0 },
    'Worker Provisioning': { key: 'Worker Provisioning', label: 'Worker Provisioning', pending_count: 0, overdue_count: 0 },
    'Work Order': { key: 'Work Order', label: 'Work Order', pending_count: 3, overdue_count: 1 },
  },
}

const FAVORITE_REPORTS = paginated([
    { id: 1, report_type: 'custom', name: 'Active Contractors by Vendor Q1', description: 'Headcount and spend by vendor for Q1', url: '/custom_reports/custom/1' },
    { id: 2, report_type: 'custom', name: 'Monthly Invoice Summary', description: 'Total invoiced amounts grouped by month', url: '/custom_reports/custom/2' },
    { id: 3, report_type: 'custom', name: 'Time to Fill by Job Category', description: 'Average days from post to hire per category', url: '/custom_reports/custom/3' },
    { id: 4, report_type: 'custom', name: 'Timesheet Exceptions Report', description: 'Identifies missing or late timesheets', url: '/custom_reports/custom/4' },
])

/** Dashboard chart queries (POST /api/custom_reports/dashboard_query/:id/) — field names match named query definitions */
const DASHBOARD_SPEND_BY_MONTH = {
  data: [
    { billing_cycle_month: 'Nov 2025', total_amount: '118,250.00' },
    { billing_cycle_month: 'Dec 2025', total_amount: '132,400.50' },
    { billing_cycle_month: 'Jan 2026', total_amount: '125,900.00' },
    { billing_cycle_month: 'Feb 2026', total_amount: '141,175.25' },
    { billing_cycle_month: 'Mar 2026', total_amount: '128,640.00' },
    { billing_cycle_month: 'Apr 2026', total_amount: '95,200.00' },
  ],
  columns: [
    { id: 'billing_cycle_month', name: 'billing_cycle_month' },
    { id: 'total_amount', name: 'total_amount' },
  ],
}

const DASHBOARD_HEADCOUNT_BY_VENDOR = {
  data: [
    { vendor_name: 'Acme Staffing', total_headcount: '48' },
    { vendor_name: 'TechBridge Solutions', total_headcount: '35' },
    { vendor_name: 'GlobalTech Recruiting', total_headcount: '22' },
    { vendor_name: 'CyberTalent Inc', total_headcount: '18' },
    { vendor_name: 'DataTalent Co', total_headcount: '14' },
  ],
  columns: [
    { id: 'vendor_name', name: 'vendor_name' },
    { id: 'total_headcount', name: 'total_headcount' },
  ],
}

/**
 * Home page (/home/all)
 * Tier 1 — highest traffic page.
 *
 * Shows stat cards, quick actions, task widget, notifications/messages tabs,
 * and favorite reports. Employer and vendor views differ in stats and quick actions.
 */
export const home: PageDefinition = {
  id: 'home',
  name: 'Home',
  path: '/home/all',
  roles: ['employer', 'vendor'],
  fullPage: true,

  async setup(page: Page, role: Role) {
    const isVendor = role === 'vendor'

    // Account me — drives role-specific rendering (messages sender/recipient label, etc.)
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

    // Feature flags — return true for all flags (interviews v2 migration complete = hide Events tab)
    await page.route('**/api/v2/client/feature-flags/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true),
      })
    })

    // Chart widgets — permissions (vendor sessions may 500 on real API without this mock)
    await page.route('**/api/dashboard_permissions/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          has_access_to_custom_report_templates: false,
          can_export_custom_reports: false,
        }),
      })
    })

    // Home config — reports/tasks + dashboard widgets (Spend by Month, Headcount by Vendor)
    await page.route('**/api/home/config/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contact_us: { enabled: false, custom_message: null, hide_form: true },
          dashboards: { enabled: true, can_access_dashboard: true },
          reports: { can_access_custom_reports: true, can_access_favorite_reports: true },
          bulkupdates: {
            can_access_bulkupdates: true,
            support_wt: false,
            support_wo_cont: true,
            support_wo_sow: false,
            support_candidate: true,
            support_job: true,
            support_wo_bulk_update_via_file: false,
          },
          tasks: { can_dismiss_all: true },
          set_event_tab_as_default: false,
        }),
      })
    })

    // Quick actions carousel
    await page.route('**/api/home/quick_actions/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isVendor ? QUICK_ACTIONS_VENDOR : QUICK_ACTIONS_EMPLOYER),
      })
    })

    // Program health stat cards
    await page.route('**/api/home/program_health_stats/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isVendor ? STATS_VENDOR : STATS_EMPLOYER),
      })
    })

    // Notifications (called with query params: ?limit=5&is_viewed=false)
    await page.route(/.*\/api\/v2\/notifications\/notifications/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NOTIFICATIONS),
      })
    })

    // Messages tab
    await page.route('**/api/home/messages/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MESSAGES),
      })
    })

    // Events tab (hidden when is_interviews_v2_migration_completed = true, but mock anyway)
    await page.route('**/api/home/events/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          todays_events: [],
          todays_events_count: 0,
          upcoming_events: [],
          upcoming_count: 0,
        }),
      })
    })

    // Favorite reports (called with query params: ?limit=5&offset=0)
    await page.route(/.*\/api\/custom_reports\/favorite_reports/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAVORITE_REPORTS),
      })
    })

    // Dashboard widgets — bulk filter PATCH (must not match .../dashboard_query/spend_by_month/ etc.)
    await page.route(
      (url) => {
        try {
          const path = new URL(url).pathname.replace(/\/+$/, '')
          return path === '/api/custom_reports/dashboard_query'
        } catch {
          return false
        }
      },
      (route) => {
        if (route.request().method() === 'PATCH') {
          route.fulfill({ status: 204 })
          return
        }
        route.fallback()
      }
    )

    await page.route(/.*\/api\/custom_reports\/dashboard_query\/spend_by_month/i, (route) => {
      if (route.request().method() !== 'POST') {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DASHBOARD_SPEND_BY_MONTH),
      })
    })

    await page.route(/.*\/api\/custom_reports\/dashboard_query\/headcount_by_vendor/i, (route) => {
      if (route.request().method() !== 'POST') {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DASHBOARD_HEADCOUNT_BY_VENDOR),
      })
    })

    // Task summary widget
    await page.route('**/api/v2/user_tasks/summary', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TASK_SUMMARY),
      })
    })

    // User tasks list (nav task drawer — different from task summary widget)
    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
            { id: 1, title: 'Review timesheet for Bob Johnson', status: 1, due_date: daysAgo(-2), category: 'Timesheet', priority: 'high' },
            { id: 2, title: 'Approve work order modification', status: 1, due_date: daysAgo(-1), category: 'Work Order', priority: 'medium' },
            { id: 3, title: 'Complete onboarding checklist', status: 2, due_date: daysAgo(-3), category: 'Contractor', priority: 'high' },
            { id: 4, title: 'Review invoice #INV-5678', status: 1, due_date: daysAgo(0), category: 'Invoice', priority: 'low' },
            { id: 5, title: 'Update job posting', status: 1, due_date: daysAgo(-5), category: 'Job', priority: 'medium' },
        ])),
      })
    })

    // Contact us config (used by ContactUsDrawer)
    await page.route('**/api/contact-us-config/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })
  },
}
