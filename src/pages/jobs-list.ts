import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow } from '../mock-utils.js'


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

const JOBS_CONFIG = {
  is_shortlisting_enabled: true,
  is_card_view_enabled: true,
  is_job_resource_manager_visible: true,
  is_business_unit_visible: true,
  is_program_team_visible: true,
  is_provisioning_enabled: true,
  program_team_label: 'Program Team',
  show_experience: true,
  show_weekly_paid_travel: false,
  close_position_for_all_workflows: false,
  can_view_calculation_pack: false,
  is_vendor_visible: true,
  time_entry_unit: 'hours',
  show_job_code: true,
  show_expense_type: true,
  show_program_team: true,
  show_hiring_team: true,
  show_timesheet_approver: true,
  show_expense_approver: true,
  show_hire_type: true,
  show_contractor_std_hrs_week: true,
  show_monthly_std_hrs_per_day: false,
  show_contract_type: true,
  show_not_qualified_rate: false,
  show_preferred_bill_rate: false,
  show_premium_rate: false,
  show_must_have_skills: true,
  show_nice_to_have_skills: true,
  exemption_status_default: 1,
}

const JOB_STATUSES = {
  results: [
    { text: 'Active', value: 'Active' },
    { text: 'Draft', value: 'Draft' },
    { text: 'Pending Approval', value: 'Pending Approval' },
    { text: 'Hold', value: 'Hold' },
    { text: 'Closed', value: 'Closed' },
    { text: 'Pending', value: 'Pending' },
    { text: 'Rejected', value: 'Rejected' },
  ],
}

const makeJob = (
  id: number,
  title: string,
  status: number,
  statusDisplay: string,
  opts: Record<string, any> = {}
) => ({
  id,
  title,
  status,
  status_display: statusDisplay,
  application_count: opts.application_count ?? 0,
  job_rate: opts.job_rate ?? {
    type: 'max_rate',
    rate: opts.rate ?? 85,
    min_rate: null,
    max_rate: null,
    pay_rate: opts.pay_rate ?? 70,
    min_pay_rate: null,
    currency_code: 'USD',
  },
  contract_pay_type: 1,
  rate_type: opts.rate_type ?? 1,
  is_pay_rate_driven: false,
  business_unit: 1,
  business_unit_display: opts.business_unit_display ?? 'Engineering',
  calculation_pack: null,
  created_by_name: opts.created_by_name ?? 'James Employer',
  currency_code: 'USD',
  end_date: opts.end_date ?? daysFromNow(180),
  hire_type_display: opts.hire_type_display ?? 'Contingent',
  is_fast_path: opts.is_fast_path ?? false,
  is_favorite: opts.is_favorite ?? false,
  is_rejected: status === 8,
  job_category_display: opts.job_category_display ?? 'Information Technology',
  job_summary: opts.job_summary ?? 'We are looking for a skilled professional to join our team.',
  job_template_job_type: opts.job_template_job_type ?? 'Standard',
  location: opts.location ?? 'San Francisco, CA',
  location_id: opts.location_id ?? 1,
  markup: 20,
  no_of_position: opts.no_of_position ?? 1,
  pay_rate: opts.pay_rate ?? 70,
  pay_type: opts.pay_type ?? 'Per Hour',
  preidentified_count: opts.preidentified_count ?? 0,
  program_team_names: opts.program_team_names ?? [],
  reason_display: opts.reason_display ?? null,
  rejected_by: opts.rejected_by ?? null,
  resource_manager: 1,
  resource_manager_name: opts.resource_manager_name ?? 'Alice Manager',
  total_no_of_position: opts.total_no_of_position ?? 1,
  shortlisted_count: opts.shortlisted_count ?? 0,
  start_date: opts.start_date ?? daysFromNow(14),
  vendor_distribution: opts.vendor_distribution ?? null,
  can_vendor_dist_be_acknowledged: opts.can_vendor_dist_be_acknowledged ?? false,
  created_at: opts.created_at ?? daysAgo(id + 5),
  updated_at: daysAgo(1),
  shift_strategy: opts.shift_strategy ?? null,
  shifts: opts.shifts ?? null,
  program_team_entity_name: opts.program_team_entity_name ?? null,
})

// 12 jobs with varied statuses, categories, locations, vendors
const JOBS_EMPLOYER = [
  makeJob(1001, 'Senior Software Engineer', 4, 'Active', {
    application_count: 8, rate: 145, pay_rate: 120, is_favorite: true,
    job_category_display: 'Software Engineering', location: 'San Francisco, CA',
    resource_manager_name: 'Alice Manager', no_of_position: 3, total_no_of_position: 3,
    shortlisted_count: 2, created_at: daysAgo(5),
    program_team_names: ['Priya Nair', 'Marcus Lee'],
  }),
  makeJob(1002, 'Data Engineer', 4, 'Active', {
    application_count: 5, rate: 120, pay_rate: 100,
    job_category_display: 'Data & Analytics', location: 'Austin, TX',
    resource_manager_name: 'Bob Director', no_of_position: 2, total_no_of_position: 2,
    created_at: daysAgo(8),
    program_team_names: ['Elena Vasquez'],
  }),
  makeJob(1003, 'UX Designer', 4, 'Active', {
    application_count: 12, rate: 95, pay_rate: 80, is_fast_path: true,
    job_category_display: 'Design', location: 'Remote',
    resource_manager_name: 'Carol Lead', no_of_position: 1, total_no_of_position: 1,
    preidentified_count: 2, created_at: daysAgo(3),
    program_team_names: ['Jordan Smith', 'Priya Nair'],
  }),
  makeJob(1004, 'Product Manager', 2, 'Pending Approval', {
    rate: 130, pay_rate: 110,
    job_category_display: 'Product Management', location: 'New York, NY',
    resource_manager_name: 'Dave VP', created_at: daysAgo(1),
  }),
  makeJob(1005, 'DevOps Engineer', 4, 'Active', {
    application_count: 3, rate: 135, pay_rate: 112,
    job_category_display: 'Infrastructure', location: 'Chicago, IL',
    resource_manager_name: 'Alice Manager', no_of_position: 1, total_no_of_position: 2,
    created_at: daysAgo(12),
    program_team_names: ['Marcus Lee'],
  }),
  makeJob(1006, 'Marketing Analyst', 5, 'Closed', {
    job_category_display: 'Marketing', location: 'Boston, MA',
    reason_display: 'Position Filled', created_at: daysAgo(45),
    end_date: daysAgo(7),
  }),
  makeJob(1007, 'Financial Analyst', 3, 'Hold', {
    rate: 90, pay_rate: 75,
    job_category_display: 'Finance', location: 'Denver, CO',
    resource_manager_name: 'Emma Finance', created_at: daysAgo(20),
  }),
  makeJob(1008, 'QA Engineer', 4, 'Active', {
    application_count: 6, rate: 100, pay_rate: 82, is_favorite: true,
    job_category_display: 'Quality Assurance', location: 'Seattle, WA',
    resource_manager_name: 'Carol Lead', no_of_position: 2, total_no_of_position: 2,
    created_at: daysAgo(9),
  }),
  makeJob(1009, 'Business Analyst', 8, 'Rejected', {
    job_category_display: 'Business Operations', location: 'Atlanta, GA',
    rejected_by: 'Dave VP', created_at: daysAgo(15),
  }),
  makeJob(1010, 'Cloud Architect', 1, 'Draft', {
    rate: 175, pay_rate: 145,
    job_category_display: 'Software Engineering', location: 'San Francisco, CA',
    resource_manager_name: 'Bob Director', created_at: daysAgo(2),
  }),
  makeJob(1011, 'HR Coordinator', 6, 'Pending', {
    job_category_display: 'Human Resources', location: 'Miami, FL',
    resource_manager_name: 'Alice Manager', created_at: daysAgo(6),
  }),
  makeJob(1012, 'Security Engineer', 4, 'Active', {
    application_count: 2, rate: 155, pay_rate: 128,
    job_category_display: 'Information Security', location: 'Washington, DC',
    resource_manager_name: 'Dave VP', no_of_position: 1, total_no_of_position: 1,
    created_at: daysAgo(4),
    program_team_names: ['Elena Vasquez', 'Jordan Smith'],
  }),
]

// Vendor sees jobs distributed to their company — some pending acknowledgement
const JOBS_VENDOR = [
  makeJob(1001, 'Senior Software Engineer', 4, 'Active', {
    application_count: 2, rate: 145,
    job_category_display: 'Software Engineering', location: 'San Francisco, CA',
    no_of_position: 3,
    vendor_distribution: { id: 501, status: 'accepted' },
    can_vendor_dist_be_acknowledged: false,
    created_at: daysAgo(5),
  }),
  makeJob(1002, 'Data Engineer', 4, 'Active', {
    application_count: 1, rate: 120,
    job_category_display: 'Data & Analytics', location: 'Austin, TX',
    no_of_position: 2,
    vendor_distribution: { id: 502, status: 'pending' },
    can_vendor_dist_be_acknowledged: true,
    created_at: daysAgo(8),
  }),
  makeJob(1003, 'UX Designer', 4, 'Active', {
    application_count: 3, rate: 95, is_fast_path: true,
    job_category_display: 'Design', location: 'Remote',
    no_of_position: 1,
    vendor_distribution: { id: 503, status: 'accepted' },
    can_vendor_dist_be_acknowledged: false,
    created_at: daysAgo(3),
  }),
  makeJob(1005, 'DevOps Engineer', 4, 'Active', {
    application_count: 0, rate: 135,
    job_category_display: 'Infrastructure', location: 'Chicago, IL',
    no_of_position: 1,
    vendor_distribution: { id: 504, status: 'pending' },
    can_vendor_dist_be_acknowledged: true,
    created_at: daysAgo(12),
  }),
  makeJob(1008, 'QA Engineer', 4, 'Active', {
    application_count: 1, rate: 100,
    job_category_display: 'Quality Assurance', location: 'Seattle, WA',
    no_of_position: 2,
    vendor_distribution: { id: 505, status: 'declined' },
    can_vendor_dist_be_acknowledged: false,
    created_at: daysAgo(9),
  }),
  makeJob(1012, 'Security Engineer', 4, 'Active', {
    application_count: 0, rate: 155,
    job_category_display: 'Information Security', location: 'Washington, DC',
    no_of_position: 1,
    vendor_distribution: { id: 506, status: 'accepted' },
    can_vendor_dist_be_acknowledged: false,
    created_at: daysAgo(4),
  }),
]

const SAVED_FILTERS_EMPTY: never[] = []

const VISIBLE_FIELDS_EMPLOYER = {
  id: 1,
  preference_type: 'visible_fields',
  namespace: 'job',
  data: [
    { key: 'start_date_and_end_date', label: 'Start / End Date', icon: 'calendar', position: 'card', options: null },
    { key: 'bill_rate', label: 'Bill Rate', icon: 'money', position: 'card', options: null },
    { key: 'job_category', label: 'Job Category', icon: 'tag', position: 'card', options: null },
    { key: 'work_site', label: 'Location', icon: 'location', position: 'card', options: null },
    { key: 'number_of_positions', label: 'Positions', icon: 'people', position: 'card', options: null },
    { key: 'resource_manager', label: 'Resource Manager', icon: 'person', position: 'card', options: null },
    { key: 'program_team', label: 'Program Team', icon: 'Team', position: 'card', options: null },
  ],
}

/**
 * Jobs list page (/jobs)
 * Tier 1 — shows a paginated, filterable list of jobs.
 *
 * Employer: card grid with publish/bulk-upload actions, status badges, bill rates.
 * Vendor: same card grid but with accept/decline or apply-candidates buttons.
 */
export const jobsList: PageDefinition = {
  id: 'jobs-list',
  name: 'Jobs List',
  path: '/jobs',
  roles: ['employer', 'vendor'],
  fullPage: true,

  async setup(page: Page, role: Role) {
    const isVendor = role === 'vendor'

    // Account me — role detection used throughout the page
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

    // Feature flags — return true for all
    await page.route('**/api/v2/client/feature-flags/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true),
      })
    })

    // Jobs permissions — drives "Publish Job" and "Bulk Upload" buttons
    await page.route('**/api/v2/jobs/permissions', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ can_create_jobs: !isVendor }),
      })
    })

    // Jobs list config — drives filter sidebar visibility
    await page.route('**/api/v2/jobs/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOBS_CONFIG),
      })
    })

    // Multi PMO enabled — controls program team entity filter
    await page.route('**/api/v2/program-team/multi_pmo_enabled/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      })
    })

    // Jobs list — main data (any query params)
    await page.route(/.*\/api\/v2\/jobs\/list\//, (route) => {
      const url = route.request().url()
      // Skip detail URLs like /list/1001/
      if (/\/list\/\d+\//.test(url)) {
        route.fallback()
        return
      }
      const jobs = isVendor ? JOBS_VENDOR : JOBS_EMPLOYER
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(jobs)),
      })
    })

    // Job statuses — filter sidebar dropdown (query params: ?limit=100&offset=0)
    await page.route(/.*\/api\/v2\/jobs\/statuses/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_STATUSES),
      })
    })

    // Job distribution statuses (vendor filter)
    await page.route('**/api/v2/jobs/distribution_statuses', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { text: 'Pending', value: 'pending' },
            { text: 'Accepted', value: 'accepted' },
            { text: 'Declined', value: 'declined' },
          ],
        }),
      })
    })

    // Candidate source types filter
    await page.route('**/api/v2/jobs/candidate_source_types/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { text: 'Standard', value: 1 },
            { text: 'Pre-Identified', value: 2 },
            { text: 'Fast Path', value: 3 },
          ],
        }),
      })
    })

    // Hire types filter
    await page.route('**/api/v2/jobs/hire_types/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { text: 'Contingent', value: 1 },
            { text: 'Direct Hire', value: 2 },
          ],
        }),
      })
    })

    // Pay types filter
    await page.route('**/api/v2/jobs/pay_types', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { text: 'Per Hour', value: 1 },
            { text: 'Per Day', value: 2 },
            { text: 'Per Week', value: 3 },
            { text: 'Per Month', value: 5 },
            { text: 'Per Year', value: 6 },
          ],
        }),
      })
    })

    // Work sites / locations filter
    await page.route('**/api/v2/work_sites**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 5,
          results: [
            { id: 1, name: 'San Francisco, CA' },
            { id: 2, name: 'Austin, TX' },
            { id: 3, name: 'New York, NY' },
            { id: 4, name: 'Chicago, IL' },
            { id: 5, name: 'Remote' },
          ],
        }),
      })
    })

    // Regions filter
    await page.route('**/api/v2/regions**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 3,
          results: [
            { id: 1, name: 'West Coast' },
            { id: 2, name: 'East Coast' },
            { id: 3, name: 'Central' },
          ],
        }),
      })
    })

    // Vendor entities filter (employer only)
    await page.route('**/api/v2/vendor_entities/onboarded/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 3,
          results: [
            { id: 5, company_name: 'Acme Staffing' },
            { id: 6, company_name: 'TechBridge Solutions' },
            { id: 7, company_name: 'GlobalTech Recruiting' },
          ],
        }),
      })
    })

    // Resource managers + program team filter (same endpoint; type=program_team returns PMO roster)
    await page.route('**/api/v2/employer_manager/**', (route) => {
      const url = route.request().url()
      if (url.includes('type=program_team')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            count: 4,
            results: [
              { id: 201, full_name: 'Priya Nair' },
              { id: 202, full_name: 'Marcus Lee' },
              { id: 203, full_name: 'Elena Vasquez' },
              { id: 204, full_name: 'Jordan Smith' },
            ],
          }),
        })
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 5,
          results: [
            { id: 1, full_name: 'Alice Manager' },
            { id: 2, full_name: 'Bob Director' },
            { id: 3, full_name: 'Carol Lead' },
            { id: 4, full_name: 'Dave VP' },
            { id: 5, full_name: 'Emma Finance' },
          ],
        }),
      })
    })

    // Job titles filter
    await page.route('**/api/v2/job_titles/titles/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 4,
          results: [
            { title: 'Senior Software Engineer' },
            { title: 'Data Engineer' },
            { title: 'UX Designer' },
            { title: 'Product Manager' },
          ],
        }),
      })
    })

    // Job categories filter
    await page.route('**/api/v2/jobs/categories**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 5,
          results: [
            { id: 1, name: 'Software Engineering' },
            { id: 2, name: 'Data & Analytics' },
            { id: 3, name: 'Design' },
            { id: 4, name: 'Finance' },
            { id: 5, name: 'Information Technology' },
          ],
        }),
      })
    })

    // Created by filter
    await page.route('**/api/v2/jobs/created_by**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 2,
          results: [
            { text: 'James Employer', value: 10 },
            { text: 'Alice Manager', value: 11 },
          ],
        }),
      })
    })

    // Shift strategies filter
    await page.route('**/api/v2/shifts/strategies/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      })
    })

    // Shifts list filter
    await page.route('**/api/v2/shifts/list/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      })
    })

    // User preferences — saved filters for job namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=saved_filters.*namespace=job/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SAVED_FILTERS_EMPTY),
      })
    })

    // User preferences — visible fields for job namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=visible_fields.*namespace=job/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isVendor ? { ...VISIBLE_FIELDS_EMPLOYER, id: 2 } : VISIBLE_FIELDS_EMPLOYER),
      })
    })

    // General user preferences fallback
    await page.route('**/api/v2/user_preferences**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
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

    // User tasks list (nav task drawer — same pattern as home page)
    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
            { id: 1, title: 'Review timesheet for Bob Johnson', status: 1, due_date: daysFromNow(-2), category: 'Timesheet', priority: 'high' },
            { id: 2, title: 'Approve work order modification', status: 1, due_date: daysFromNow(-1), category: 'Work Order', priority: 'medium' },
            { id: 3, title: 'Review invoice #INV-5678', status: 1, due_date: daysFromNow(0), category: 'Invoice', priority: 'low' },
        ])),
      })
    })

    // Visible fields defaults — drives which columns show in job cards
    await page.route(/.*\/api\/v2\/settings\/visible_fields_defaults\/?\?.*namespace=job/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          client_data: {
            default_fields: [
              { blocked: false, display_order: 1, value: true, position: 'attributes_column', icon: 'DateRange', key: 'start_date_and_end_date', label: 'Start/End Dates' },
              { blocked: false, display_order: 2, value: true, position: 'attributes_column', icon: 'Dollars', key: 'bill_rate', label: 'Bill Rate' },
              { blocked: false, display_order: 5, value: true, position: 'attributes_column', icon: 'Team', key: 'program_team', label: 'Program Team' },
              { blocked: false, display_order: 6, value: true, position: 'attributes_column', icon: 'Location', key: 'work_site', label: 'Location/Work Site' },
              { blocked: false, display_order: 7, value: true, position: 'attributes_column', icon: 'Person', key: 'resource_manager', label: 'Resource Mgr' },
            ],
            fields: [],
            title: 'Job List Data (Client View)',
          },
          vendor_data: {
            default_fields: [
              { blocked: false, display_order: 1, value: true, position: 'attributes_column', icon: 'DateRange', key: 'start_date_and_end_date', label: 'Start/End Dates' },
              { blocked: false, display_order: 2, value: true, position: 'attributes_column', icon: 'Dollars', key: 'bill_rate', label: 'Bill Rate' },
              { blocked: false, display_order: 5, value: true, position: 'attributes_column', icon: 'HireType', key: 'hire_type', label: 'Hire Type' },
              { blocked: false, display_order: 6, value: true, position: 'attributes_column', icon: 'Location', key: 'work_site', label: 'Location/Work Site' },
            ],
            fields: [],
            title: 'Job List data (Vendor View)',
          },
        }),
      })
    })

    // Job distribution config — called per-job for vendor jobs with pending/accepted distributions
    await page.route(/.*\/api\/v2\/get-job-distribution-config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_edit_job_distributions: false,
          can_vendor_dist_be_acknowledged: true,
          can_vendor_accept_or_decline: true,
          can_view_vendor_profile: true,
          can_vendor_apply_candidates: true,
          can_vendor_change_acceptance: true,
        }),
      })
    })

    // Job distribution settings config
    await page.route('**/api/v2/job-distribution-settings-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ can_read_job_distribution: true }),
      })
    })

    // Program team select (used by program_team_entity filter when multi-PMO enabled)
    await page.route('**/api/v2/program-team/select/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      })
    })

    // Formula group / calculation pack options filter
    await page.route('**/api/calculation_engine/calculation_pack_options/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      })
    })
  },
}
