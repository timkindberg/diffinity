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

const emptyLinkedUsages = {
  api_integration: false,
  sftp_integration: false,
  email_integration: false,
  invoices: [] as { id: string; name: string; permission: boolean }[],
}

const makeReport = (
  id: number,
  name: string,
  report_type: 'saved' | 'base' | 'standard',
  opts: {
    description?: string
    dataset?: string
    section_name?: string | null
    is_favorite?: boolean
    last_ran?: string | null
    share_settings?: Record<string, unknown> | null
    linked_usages?: typeof emptyLinkedUsages
    url?: string
  } = {},
) => ({
  id,
  name,
  report_type,
  description: opts.description ?? '',
  dataset: opts.dataset ?? 'Work Order',
  is_favorite: opts.is_favorite ?? false,
  last_ran: opts.last_ran ?? null,
  config_export_enabled: true,
  export_hyperlink_enabled: false,
  url:
    opts.url ??
    (report_type === 'standard'
      ? `/custom_reports/standard/${id}/results/`
      : `/custom_reports/${report_type}/${id}/results/`),
  created_by: report_type === 'base' ? 0 : 1,
  created_at: daysAgo(60 - id),
  section_name: opts.section_name ?? 'Work Orders',
  share_settings: opts.share_settings ?? null,
  linked_usages: opts.linked_usages ?? emptyLinkedUsages,
})

/** Main list (/reporting) — varied types and sections */
const REPORTS_LIST = [
  makeReport(501, 'Q1 Contractor Spend by Business Unit', 'saved', {
    description: 'Rolling spend totals grouped by BU with vendor breakdown',
    dataset: 'Invoice Details',
    section_name: 'Invoices & Payments',
    is_favorite: true,
    last_ran: daysAgo(1),
  }),
  makeReport(502, 'Active Work Orders — Engineering', 'saved', {
    description: 'Open WOs with hiring manager, rate, and projected end date',
    dataset: 'Work Order',
    section_name: 'Work Orders',
    last_ran: daysAgo(3),
    linked_usages: { ...emptyLinkedUsages, email_integration: true },
  }),
  makeReport(503, 'Vendor Scorecard — On-Time Submission', 'saved', {
    description: 'Timesheet and invoice timeliness by vendor for the last 90 days',
    dataset: 'Timesheet',
    section_name: 'Timekeeping',
  }),
  makeReport(101, 'Job Posting Response Rate', 'base', {
    description: 'Applications and views per job with response-rate metrics',
    dataset: 'Job',
    section_name: 'Jobs',
  }),
  makeReport(102, 'Organization Master Data', 'base', {
    description: 'Hierarchy of org units, codes, and cost centers',
    dataset: 'Organization Unit',
    section_name: 'Master Data',
  }),
  makeReport(888, 'Legacy Invoice Summary (Standard)', 'standard', {
    description: 'Standard report: invoice lines with tax and discount columns',
    dataset: 'Invoice Details',
    section_name: 'Invoices & Payments',
    url: '/custom_reports/standard/888/results/',
  }),
  makeReport(504, 'SOW Milestone Billing Status', 'saved', {
    description: 'Milestones, percent complete, and billed-to-date by SOW',
    dataset: 'Statement Of Work',
    section_name: 'SOW',
    share_settings: {
      first_shared_at: daysAgo(10),
      is_shared_by_me: false,
      shared_with: [],
      shared_by: 'Alice Chen',
      is_shared_with_me: true,
    },
  }),
  makeReport(103, 'Contractor Daily Hours', 'base', {
    description: 'Daily hours booked by contractor and work order',
    dataset: 'Timesheet',
    section_name: 'Contractors',
  }),
  makeReport(505, 'Interview Pipeline — Open Reqs', 'saved', {
    description: 'Stages, days-in-stage, and next steps for active reqs',
    dataset: 'Job Applicant',
    section_name: 'Jobs',
    is_favorite: true,
    last_ran: daysAgo(0),
  }),
  makeReport(104, 'Vendor Companies', 'base', {
    description: 'Vendor profiles, tiers, and primary contacts',
    dataset: 'Vendor Company',
    section_name: 'Vendors',
  }),
]

/** Modal “create from template” queries base reports only (ordering nameAZ) */
const BASE_REPORTS_FOR_MODAL = REPORTS_LIST.filter((r) => r.report_type === 'base').sort((a, b) =>
  a.name.localeCompare(b.name),
)

const REPORT_SETTINGS_RESPONSE = {
  settings: {
    exporting: {
      include_column_headers: true,
      export_file_extension: 'tsv',
      export_format: 'tsv',
      include_report_heading: true,
    },
    sharing: {
      exporting: { export_format: 'xls', include_header: true, export_file_extension: 'xlsx' },
      report_sharing_role_tags: [1, 2, 3, 4, 5],
      allow_report_sharing_with_vendors: true,
    },
    date_formats: { default_format: 'd_b_Y_default' },
    current_time_invoice_summary_table: 'report_time_invoice_summary_a',
  },
  permissions: {
    canShareReport: true,
    canExportReport: true,
    canAuthorReport: { full: true },
    canScheduleSftpReport: true,
    canScheduleEmailReport: true,
    canPublishReport: true,
    canEditBaseReports: true,
    canVsyncReport: true,
    canImportReportDefinitions: true,
    canExportReportDefinitions: true,
    isReportSuperuser: true,
    canShareReportWithVendors: true,
    canShareReportWithProgramTeams: false,
    canVendorShareReportRoleTags: false,
    canAccessCustomReports: true,
    isReportScheduleAdmin: true,
    isReportSettingsAdmin: true,
    hasAdminSettings: true,
  },
  filters: [
    {
      id: 'report_type',
      type: 'list',
      default_is_open: true,
      title: 'Report Type',
      options: [
        { id: 'saved', text: 'Saved Report', subtext: 'Your Reports', value: 'saved' },
        { id: 'base', text: 'Base Report', subtext: 'Shared templates', value: 'base' },
        { id: 'standard', text: 'Standard Report', subtext: 'Legacy offering', value: 'standard' },
      ],
    },
    {
      id: 'report_section',
      type: 'list',
      default_is_open: false,
      title: 'Report Section',
      options: [
        { id: 'Jobs', text: 'Jobs', subtext: null, value: 'Jobs' },
        { id: 'Work Orders', text: 'Work Orders', subtext: null, value: 'Work Orders' },
        { id: 'Invoices & Payments', text: 'Invoices & Payments', subtext: null, value: 'Invoices & Payments' },
        { id: 'Timekeeping', text: 'Timekeeping', subtext: null, value: 'Timekeeping' },
        { id: 'SOW', text: 'SOW', subtext: null, value: 'SOW' },
        { id: 'Master Data', text: 'Master Data', subtext: null, value: 'Master Data' },
        { id: 'Vendors', text: 'Vendors', subtext: null, value: 'Vendors' },
        { id: 'Contractors', text: 'Contractors', subtext: null, value: 'Contractors' },
      ],
    },
    {
      id: 'report_sharing',
      type: 'list',
      default_is_open: false,
      title: 'Report Sharing',
      options: [
        { id: 'shared_with_me', text: 'Shared with me', subtext: null, value: 'shared_with_me' },
        { id: 'shared_by_me', text: 'Shared by me', subtext: null, value: 'shared_by_me' },
      ],
    },
  ],
}

/**
 * Reporting home (/reporting)
 *
 * Next.js page: `pages/reporting/index.tsx` → `ReportsHome` (saved/base/standard list, filters, header actions).
 */
export const reporting: PageDefinition = {
  id: 'reporting',
  name: 'Reporting',
  path: '/reporting',
  roles: ['employer'],
  fullPage: true,

  async waitForReady(page: Page) {
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // proceed
    }
    // Tab list renders asynchronously after report data loads.
    // Wait for the tab links to appear so element count is deterministic.
    try {
      await page.waitForSelector('[data-testid="tab-list"] a', { timeout: 5000 })
    } catch {
      // proceed — page may not have tabs in all states
    }
    await page.waitForTimeout(500)
  },

  async setup(page: Page, _role: Role) {
    await page.route('**/api/v2/accounts/me/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 10,
          full_name: 'James Employer',
          email: 'james@cruisecorp.com',
          role: 'employer',
          rbac_role: 'employer_admin',
          tenant: 'cruise',
          environment: 'local',
          timezone: 'America/New_York',
          locale: 'en',
          vendor_id: null,
          vendor_entity_id: null,
          employer_id: 1,
          isVendorRole: false,
          isCandidateRole: false,
          isEmployerRole: true,
        }),
      })
    })

    await page.route('**/api/v2/nav/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NAV_CONFIG_EMPLOYER),
      })
    })

    await page.route('**/api/v2/client/feature-flags/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true),
      })
    })

    await page.route(/.*\/api\/custom_reports\/settings\/misc\/reports/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(REPORT_SETTINGS_RESPONSE),
      })
    })

    await page.route(/.*\/api\/reports\/list\/?/, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
      const url = new URL(route.request().url())
      const reportType = url.searchParams.get('report_type')
      const ordering = url.searchParams.get('ordering')

      if (reportType === 'base' && ordering === 'nameAZ') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            paginated(BASE_REPORTS_FOR_MODAL, { limit: BASE_REPORTS_FOR_MODAL.length, count: BASE_REPORTS_FOR_MODAL.length }),
          ),
        })
        return
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(REPORTS_LIST, { limit: 10, count: 47 })),
      })
    })

    await page.route('**/api/contact-us-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })

    await page.route(/.*\/api\/v2\/work-orders\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_view_contractor_bill_rate: true,
          can_view_organization_unit: true,
          can_view_resource_manager: true,
          can_view_attachments: true,
          can_view_vendors: true,
          can_bulk_update: true,
          outbound_provisioning_enabled: false,
        }),
      })
    })

    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated([
            { id: 1, title: 'Review timesheet for Bob Johnson', status: 1, due_date: daysAgo(-2), category: 'Timesheet', priority: 'high' },
            { id: 2, title: 'Approve work order modification', status: 1, due_date: daysAgo(-1), category: 'Work Order', priority: 'medium' },
          ]),
        ),
      })
    })

    await page.route('**/api/v2/user_tasks/summary', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: {
            Timesheet: { key: 'Timesheet', label: 'Timesheet', pending_count: 4, overdue_count: 0 },
            Invoice: { key: 'Invoice', label: 'Invoice', pending_count: 2, overdue_count: 1 },
          },
        }),
      })
    })
  },
}
