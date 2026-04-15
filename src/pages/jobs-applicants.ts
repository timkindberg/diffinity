import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow } from '../mock-utils.js'

const JOB_ID = 123

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

// Full job detail — used by useJobQuery in JobHeader
const JOB_DETAIL = {
  id: JOB_ID,
  title: 'Senior Software Engineer',
  status: 4, // Active
  status_display: 'Active',
  is_closed: false,
  is_on_hold: false,
  is_pending_approval: false,
  business_unit: 1,
  business_unit_display: 'Engineering',
  contract_pay_type: 1, // hourly
  currency_code: 'USD',
  hire_type: 1, // Contingent
  no_of_position: 3,
  total_no_of_position: 3,
  total_no_of_onboarded_position: 1,
  number_of_open_positions: 2,
  number_of_pending_positions: 0,
  location: 1,
  resource_manager: 1,
  job_template: 1,
  job_template_job_type: 1,
  job_template_job_type_display: null,
  job_template_is_active: true,
  start_date: daysFromNow(14),
  end_date: daysFromNow(180),
  updated_at: daysAgo(1),
  created_at: daysAgo(10),
  updated_by: 10,
  created_by: 10,
  shift_details: null,
  event_based_expense_details: [],
  default_event_based_expense_cc_data: null,
  vendor_distribution: null,
  latest_bulk_action_record: null,
  latest_bulk_action_record_details: null,
  is_latest_bulk_action_record_read: true,
  is_workday_position_managed: false,
  apply_maximum_no_of_applications_per_vendor_limit: false,
  maximum_no_of_applications_per_vendor: null,
  application_submission_limit_type: null,
  application_count: 12,
}

// Compact job details — used by useJobListCompactDetailsQuery (for apply modal limits)
const JOB_LIST_COMPACT = {
  id: JOB_ID,
  title: 'Senior Software Engineer',
  status: 4,
  currency_code: 'USD',
  hire_type: 1,
  contract_pay_type: 1,
  maximum_no_of_applications_per_vendor: null,
  previously_applied_candidates: [],
}

// Job for applicant list — used by useJobForJobAppListQuery
const JOB_FOR_APP_LIST = {
  id: JOB_ID,
  status: 4, // Active
  contract_pay_type: 1,
  currency_code: 'USD',
  hire_type: 1,
  business_unit: 1,
  number_of_open_positions: 2,
  is_workday_position_managed: false,
  latest_bulk_action_record: null,
  latest_bulk_action_record_details: null,
  is_latest_bulk_action_record_read: true,
}

// Job record config — used by useJobRecordConfig in JobHeader
const JOB_RECORD_CONFIG = {
  can_clone_job: true,
  can_email_vendors: true,
  can_reopen_job: false,
  display_checklists: true,
  hide_edit: false,
  is_vendor: false,
  is_preid_enabled: true,
  end_job_reasons: [],
  end_job_sub_reasons: [],
  has_pre_onboarding_checklists: false,
  can_waive_verifications: false,
  can_apply_candidates: true,
  can_view_job_activity_logs: true,
  can_send_email_to_vendor: true,
  show_waive_verifications: false,
  can_close_unfilled_positions: true,
  close_position_for_all_workflows: false,
  close_unfilled_positions_on_job: false,
  show_candidate_experience: false,
  show_work_type_profile: false,
  show_calendar_pay_profile: false,
  show_overtime_profile: false,
  show_shifts: false,
  show_compensation: false,
  has_contractor_bill_rate_read: true,
  has_vendor_company_read: true,
  has_work_order_end_date_read: true,
  is_vendor_visible: true,
  remove_recommendation: true,
  show_recommendations: true,
  are_recommendations_revealed: true,
  event_based_expenses: { can_view: false, can_edit: false },
  unfilled_positions_count: 2,
  can_apply_preid: false,
  show_tenure: true,
  can_edit_job_distributions: true,
}

const JOB_RECORD_CONFIG_VENDOR = {
  ...JOB_RECORD_CONFIG,
  is_vendor: true,
  can_email_vendors: false,
  can_clone_job: false,
  hide_edit: true,
}

// Job application config — drives which actions/columns appear
const JOB_APP_CONFIG = {
  phone_number_required: false,
  video_link_required: false,
  office365_meeting_suggestions_enabled: false,
  can_message: true,
  default_manager_filter_to_shortlisted: false,
  is_bmi_enabled: false,
  can_resubmit_rejected_candidates: true,
  can_bulk_onboard: true,
  can_bulk_reject: false,
  can_view_bulk_action_result: true,
  can_edit_interview: true,
  can_cancel_interview: true,
  can_view_contractor_bill_rate: true,
  can_view_vendor_company: true,
  can_view_shortlisted_only: false,
  is_bulk_onboard_update_all_enabled: true,
  can_read_feedback_rating: true,
  can_write_feedback_rating: true,
  can_read_feedback_notes: true,
  can_write_feedback_notes: true,
  show_hired_score_grade: true,
}

// Activity log — used by JobHeader and useJobActivityLogs
const ACTIVITY_LOG = [
  { id: 1, user_full_name: 'James Employer', action: 'created', created_at: daysAgo(10), details: 'Job created' },
  { id: 2, user_full_name: 'Alice Manager', action: 'updated', created_at: daysAgo(5), details: 'Updated positions' },
  { id: 3, user_full_name: 'James Employer', action: 'updated', created_at: daysAgo(1), details: 'Status changed' },
]

// Applicant list items — varied statuses
const makeApplicant = (
  id: number,
  name: string,
  status: number,
  opts: Record<string, any> = {}
) => ({
  id,
  applicant: String(id * 10),
  applicant_name: name,
  job_applied_title: 'Senior Software Engineer',
  work_order_id: id * 2,
  current_status: status,
  process_state: 1, // STATE_VENDOR_APPLIED
  profile_pic: '',
  is_duplicate: opts.is_duplicate ?? false,
  is_shortlisted: opts.is_shortlisted ?? false,
  is_pending_bulk_update: false,
  vendor_company_name: opts.vendor ?? 'Acme Staffing',
  optimized_rate: opts.rate ?? 125,
  optimized_rate_display: `${opts.rate ?? 125} USD per hour`,
  candidate_pay_rate: opts.pay_rate ?? 100,
  rating: opts.rating ?? null,
  bmi: null,
  hiredscore_grade: opts.hiredscore_grade ?? null,
  created_at: opts.created_at ?? daysAgo(id),
  updated_at: daysAgo(1),
  start_date_no_tz: daysFromNow(14),
  end_date: daysFromNow(180),
  previous_experience_at_client: opts.prev_exp ?? null,
  work_order_history_details: opts.wo_history ?? 0,
  are_rates_valid: {
    is_above_bill_rate: false,
    is_below_bill_rate: false,
    is_above_pay_rate: false,
    is_below_pay_rate: false,
  },
  candidate_source_display: opts.source ?? 'Standard',
  experience: opts.experience ?? '3-5 years',
  contractor_classification: null,
  weekday_travel: null,
  contract_to_hire: null,
  direct_hire: null,
  markup: '20.00',
  permitted_actions: {
    can_release_offer: opts.can_release_offer ?? false,
    can_onboard_candidate: opts.can_onboard ?? false,
    can_reject_applications: opts.can_reject ?? true,
  },
})

// 12 applicants with diverse statuses
const APPLICANTS_EMPLOYER = [
  makeApplicant(1, 'Jane Smith', 1, { // VendorApplied
    vendor: 'Acme Staffing', rate: 135, pay_rate: 110, is_shortlisted: true,
    created_at: daysAgo(2), can_release_offer: true, can_reject: true,
    hiredscore_grade: 'A',
  }),
  makeApplicant(2, 'Bob Johnson', 1, { // VendorApplied
    vendor: 'TechBridge Solutions', rate: 120, pay_rate: 98,
    created_at: daysAgo(4), can_release_offer: true, can_reject: true,
    rating: 4,
    hiredscore_grade: 'B',
  }),
  makeApplicant(3, 'Maria Garcia', 2, { // ClientInterviewing
    vendor: 'GlobalTech Recruiting', rate: 145, pay_rate: 120,
    is_shortlisted: true, created_at: daysAgo(6), can_release_offer: true, can_reject: true,
    rating: 5,
    hiredscore_grade: 'C',
  }),
  makeApplicant(4, 'David Lee', 10, { // ReadyToOnboard
    vendor: 'Acme Staffing', rate: 130, pay_rate: 105,
    created_at: daysAgo(9), can_onboard: true, can_reject: false,
    wo_history: 2,
    hiredscore_grade: 'D',
  }),
  makeApplicant(5, 'Sarah Chen', 10, { // ReadyToOnboard
    vendor: 'TechBridge Solutions', rate: 140, pay_rate: 115,
    created_at: daysAgo(7), can_onboard: true, can_reject: false,
    wo_history: 1,
    hiredscore_grade: 'A',
  }),
  makeApplicant(6, 'Michael Torres', 4, { // PendingOfferRelease
    vendor: 'GlobalTech Recruiting', rate: 128, pay_rate: 103,
    created_at: daysAgo(5), can_reject: false,
  }),
  makeApplicant(7, 'Emily Davis', 11, { // ContractedOnboarded
    vendor: 'Acme Staffing', rate: 125, pay_rate: 100,
    created_at: daysAgo(20), can_reject: false, work_order_id: 9001,
    wo_history: 3,
    hiredscore_grade: 'B',
  }),
  makeApplicant(8, 'James Wilson', 3, { // ClientRejected
    vendor: 'TechBridge Solutions', rate: 110, pay_rate: 88,
    created_at: daysAgo(12), can_reject: false,
    permitted_actions_override: { can_reject_applications: true },
    hiredscore_grade: 'N/A',
  }),
  makeApplicant(9, 'Priya Patel', 1, { // VendorApplied
    vendor: 'Acme Staffing', rate: 142, pay_rate: 118,
    is_shortlisted: false, created_at: daysAgo(1), can_release_offer: true, can_reject: true,
    rating: 3,
  }),
  makeApplicant(10, 'Carlos Reyes', 2, { // ClientInterviewing
    vendor: 'GlobalTech Recruiting', rate: 138, pay_rate: 112,
    is_shortlisted: true, created_at: daysAgo(3), can_release_offer: true, can_reject: true,
    experience: '5-7 years',
    hiredscore_grade: 'A',
  }),
  makeApplicant(11, 'Aisha Okafor', 5, { // ClientOfferReleased
    vendor: 'TechBridge Solutions', rate: 135, pay_rate: 108,
    created_at: daysAgo(8), can_reject: false,
    hiredscore_grade: 'C',
  }),
  makeApplicant(12, 'Tom Nguyen', 1, { // VendorApplied — duplicate
    vendor: 'Acme Staffing', rate: 115, pay_rate: 92,
    is_duplicate: true, created_at: daysAgo(2), can_release_offer: true, can_reject: true,
  }),
]

// Vendor sees their own candidates for this job
const APPLICANTS_VENDOR = [
  makeApplicant(1, 'Jane Smith', 1, { // VendorApplied
    vendor: 'Acme Staffing', rate: 135, pay_rate: 110, is_shortlisted: true,
    created_at: daysAgo(2),
    permitted_actions_override: { can_reject_applications: false },
    hiredscore_grade: 'A',
  }),
  makeApplicant(4, 'David Lee', 10, { // ReadyToOnboard
    vendor: 'Acme Staffing', rate: 130, pay_rate: 105,
    created_at: daysAgo(9), wo_history: 2,
    hiredscore_grade: 'B',
  }),
  makeApplicant(7, 'Emily Davis', 11, { // ContractedOnboarded
    vendor: 'Acme Staffing', rate: 125, pay_rate: 100,
    created_at: daysAgo(20), wo_history: 3,
    hiredscore_grade: 'C',
  }),
  makeApplicant(9, 'Priya Patel', 1, { // VendorApplied
    vendor: 'Acme Staffing', rate: 142, pay_rate: 118,
    created_at: daysAgo(1), rating: 3,
    hiredscore_grade: 'A',
  }),
  makeApplicant(12, 'Tom Nguyen', 7, { // VendorWithdrawn
    vendor: 'Acme Staffing', rate: 115, pay_rate: 92,
    created_at: daysAgo(5),
  }),
]

// Bulk actions info — enables bulk onboard UI for employer
const BULK_ACTIONS_INFO = {
  ready_to_onboard_count: 2,
  can_be_rejected_count: 0,
  ready_to_onboard_job_apps: [
    { id: 4, work_order_id: 8, current_status: 10 },
    { id: 5, work_order_id: 10, current_status: 10 },
  ],
  can_be_rejected_job_apps: [],
}

// Visible fields for applicant list
const VISIBLE_FIELDS_CLIENT = {
  client_data: {
    default_fields: [
      { blocked: false, display_order: 1, value: true, position: 'attributes_column', icon: 'DateRange', key: 'applied_date', label: 'Applied Date' },
      { blocked: false, display_order: 2, value: true, position: 'attributes_column', icon: 'Dollars', key: 'bill_rate', label: 'Bill Rate' },
      { blocked: false, display_order: 3, value: true, position: 'attributes_column', icon: 'Person', key: 'vendor', label: 'Vendor' },
      { blocked: false, display_order: 4, value: true, position: 'attributes_column', icon: 'History', key: 'other_work_orders', label: 'Work History' },
    ],
    fields: [],
    title: 'Applicant List Data (Client View)',
  },
  vendor_data: {
    default_fields: [
      { blocked: false, display_order: 1, value: true, position: 'attributes_column', icon: 'DateRange', key: 'applied_date', label: 'Applied Date' },
      { blocked: false, display_order: 2, value: true, position: 'attributes_column', icon: 'Dollars', key: 'bill_rate', label: 'Bill Rate' },
    ],
    fields: [],
    title: 'Applicant List Data (Vendor View)',
  },
}

// Application statuses for filter sidebar
const APPLICATION_STATUSES = {
  results: [
    { id: 1, value: 1, text: 'Applied' },
    { id: 2, value: 2, text: 'Interviewing' },
    { id: 3, value: 3, text: 'Rejected' },
    { id: 4, value: 4, text: 'Pending Offer Release' },
    { id: 5, value: 5, text: 'Offer Released' },
    { id: 6, value: 6, text: 'Offer Declined' },
    { id: 7, value: 7, text: 'Withdrawn' },
    { id: 10, value: 10, text: 'Ready To Onboard' },
    { id: 11, value: 11, text: 'Onboarded' },
    { id: 12, value: 12, text: 'Job Closed' },
    { id: 14, value: 14, text: 'Pending Onboard Approvals' },
  ],
}

// Matches `get_hiredscore_grade_options` — AsyncCheckboxList jsonata uses `results: response?.results ?? response`
const HIREDSCORE_GRADE_OPTIONS = [
  { text: 'A', value: 'A' },
  { text: 'B', value: 'B' },
  { text: 'C', value: 'C' },
  { text: 'D', value: 'D' },
  { text: 'N/A', value: 'N/A' },
]

/**
 * Jobs Applicants page (/jobs/:id/applicants)
 * Tier 1 — shows a paginated list of applicants for a specific job.
 *
 * Employer: applicant cards with status badges, bill rates, shortlist/reject/offer/onboard actions.
 * Vendor: applicant cards showing own submitted candidates with withdraw/resubmit actions.
 * Both: filter sidebar (status, shortlisted, candidate source, rating), sort bar, action bar.
 */
export const jobsApplicants: PageDefinition = {
  id: 'jobs-applicants',
  name: 'Jobs Applicants',
  path: `/jobs/${JOB_ID}/applicants`,
  roles: ['employer', 'vendor'],
  fullPage: true,

  async waitForReady(page: Page) {
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // proceed
    }
    // Wait for late-arriving async filter data (e.g. HiredScore grades)
    // that can toggle accordion state after initial render.
    await page.waitForTimeout(2000)

    // Force ALL filter accordion items to collapsed state via CSS injection.
    // DOM manipulation gets overwritten by React re-renders, but stylesheet
    // rules with !important persist through state changes.
    await page.addStyleTag({
      content: `
        [data-testid="filters-accordion"] button[aria-expanded] svg {
          transform: none !important;
        }
        [data-testid="filters-accordion"] > [data-testid^="filter_by_"] > div:not([data-testid]) {
          display: none !important;
        }
      `,
    })
    await page.waitForTimeout(300)
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

    // Full job detail (useJobQuery in JobHeader) — matches with or without query string
    await page.route(new RegExp(`.*\\/api\\/v2\\/jobs\\/job\\/${JOB_ID}\\/?(\\?.*)?$`), (route) => {
      const url = route.request().url()
      // Don't intercept sub-paths like /config/ or /activity_log or /job_app_list_details
      if (/\/jobs\/job\/\d+\/[a-z_]/.test(url)) {
        route.fallback()
        return
      }
      const jobDetail = isVendor
        ? { ...JOB_DETAIL, vendor_distribution: { id: 501, status: 'ACCEPTED' } }
        : JOB_DETAIL
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(jobDetail),
      })
    })

    // Job record config (useJobRecordConfig in JobHeader) — matches with or without query string
    await page.route(new RegExp(`.*\\/api\\/v2\\/jobs\\/job\\/${JOB_ID}\\/config\\/(\\?.*)?$`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isVendor ? JOB_RECORD_CONFIG_VENDOR : JOB_RECORD_CONFIG),
      })
    })

    // Job for applicant list (useJobForJobAppListQuery)
    await page.route(`**/api/v2/jobs/job/${JOB_ID}/job_app_list_details`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_FOR_APP_LIST),
      })
    })

    // Job compact list detail (useJobListCompactDetailsQuery — apply modal limits)
    await page.route(`**/api/v2/jobs/list/${JOB_ID}/`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_LIST_COMPACT),
      })
    })

    // Job activity log (useJobActivityLogs)
    await page.route(`**/api/v2/jobs/job/${JOB_ID}/activity_log`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVITY_LOG),
      })
    })

    // Job application config (/api/v2/job_application/config/?job_id=123)
    await page.route(/.*\/api\/v2\/job_application\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_APP_CONFIG),
      })
    })

    // Job applications list (/api/v2/job_applications/?job_id=123&...)
    await page.route(/.*\/api\/v2\/job_applications\/\?/, (route) => {
      const applicants = isVendor ? APPLICANTS_VENDOR : APPLICANTS_EMPLOYER
      const bulkInfo = isVendor ? undefined : BULK_ACTIONS_INFO
      const response = {
        ...paginated(applicants, { count: applicants.length * 4 }),
        bulk_actions_info: bulkInfo ?? null,
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
    })

    // Application statuses filter (/api/v2/job_application/statuses/:jobId)
    await page.route(/.*\/api\/v2\/job_application\/statuses\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(APPLICATION_STATUSES),
      })
    })

    // Vendor entities filter for applicants (/api/v2/vendor_entities/?job_id=123)
    await page.route(/.*\/api\/v2\/vendor_entities\/\?/, (route) => {
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

    // HiredScore: grade filter options + empty responses for other connector paths
    await page.route('**/api/v2/connectors/hiredscore/**', (route) => {
      const url = route.request().url()
      if (url.includes('hiredscore_grade_options')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(HIREDSCORE_GRADE_OPTIONS),
        })
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([], { count: 0, limit: 50, offset: 0 })),
      })
    })

    // Visible fields defaults for job_application namespace
    await page.route(/.*\/api\/v2\/settings\/visible_fields_defaults\/.*namespace=job_application/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(VISIBLE_FIELDS_CLIENT),
      })
    })

    // User preferences — visible fields for job_application namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=visible_fields.*namespace=job_application/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          preference_type: 'visible_fields',
          namespace: 'job_application',
          data: [
            { key: 'applied_date', label: 'Applied Date', icon: 'DateRange', position: 'attributes_column', options: null },
            { key: 'bill_rate', label: 'Bill Rate', icon: 'Dollars', position: 'attributes_column', options: null },
            { key: 'vendor', label: 'Vendor', icon: 'Person', position: 'attributes_column', options: null },
            { key: 'other_work_orders', label: 'Work History', icon: 'History', position: 'attributes_column', options: null },
          ],
        }),
      })
    })

    // User preferences — saved filters for job_application namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=saved_filters.*namespace=job_application/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
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

    // Job distribution config for JobHeader (useJobDistributionConfigQuery)
    await page.route(`**/api/v2/get-job-distribution-config/${JOB_ID}/`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_edit_job_distributions: !isVendor,
          can_vendor_dist_be_acknowledged: isVendor,
          can_vendor_accept_or_decline: true,
          can_view_vendor_profile: true,
          can_vendor_apply_candidates: true,
          can_vendor_change_acceptance: true,
        }),
      })
    })

    if (isVendor) {
      await page.route(`**/api/v2/get-job-distribution-for-vendor/${JOB_ID}/`, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 501,
            created_at: daysAgo(10),
            distributed_at: daysAgo(9),
            is_vendor_onboarded: true,
            vendor_entity_id: 5,
            vendor_name: 'Acme Staffing',
            current_acknowledgement: { status: 'ACCEPTED' },
          }),
        })
      })
    }

    // Job publish approvals — called by JobHeader approval drawer
    await page.route(/.*\/api\/v2\/job_publish_approvals\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      })
    })

    // Offer release config — prefetched on mouse-over of offer/onboard buttons
    await page.route(/.*\/api\/v2\/offer_release\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_max_duration: 120,
          can_override_max_duration_of_job: true,
          can_override_work_order_max_duration: true,
          is_budget_calculator_enabled: false,
          is_monthly_timesheet_enabled: false,
          is_labor_amount_on_budget_overridden: false,
          has_permission_to_edit_labor_amount_override_on_budget: false,
          rate_config: {},
          is_classify_clocks_enabled: false,
          allow_wo_dates_to_be_outside_job_dates: false,
          specify_wo_end_time: false,
          is_workday_position_selection_applicable: false,
        }),
      })
    })

    // Interviews config (useInterviewRequestsConfig)
    await page.route('**/api/v2/interviews/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_create_interview: true,
          can_view_interviews: true,
          is_enabled: true,
        }),
      })
    })

    // Shift rules vendor list (useShiftRulesVendorListQuery)
    await page.route('**/api/v2/shifts/rules_vendors/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Criteria shifts / default shifts evaluation (useCriteriaShifts)
    await page.route(/.*\/api\/v2\/shifts\/default/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ shifts: null, shift_differential_mapping: null }),
      })
    })

    // User tasks list (nav task drawer)
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

    // Contact us config
    await page.route('**/api/contact-us-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })
  },
}
