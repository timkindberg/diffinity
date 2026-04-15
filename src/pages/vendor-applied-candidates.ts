import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow } from '../mock-utils.js'


const JOB_ID = 123

/** Shape matches `ActivityLogListSerializer` / `Log` (ActivityLogRow + renderLogMessage). */
const jobActivityLogEntry = (params: {
  log_id: string
  log: string
  created_at: string
  user_full_name: string
  user_id?: number | null
  log_contains_vendor_info?: boolean
}) => ({
  log_id: params.log_id,
  log: params.log,
  user_id: params.user_id ?? 10,
  component: 'job',
  component_id: String(JOB_ID),
  created_at: params.created_at,
  date: params.created_at,
  impersonator_name: null,
  viewed_by_user_with_wo_end_perm_only: null,
  log_contains_vendor_info: params.log_contains_vendor_info ?? false,
  user_full_name: params.user_full_name,
  was_sow_skipped: null,
  bulk_update_id: null,
})

const JOB_ACTIVITY_LOG = [
  jobActivityLogEntry({
    log_id: 'vac-log-1',
    log: '**Job** **Senior Software Engineer** was published and distributed to **Acme Staffing** and **2** other vendors.',
    created_at: daysAgo(10),
    user_full_name: 'Alice Manager',
    user_id: 201,
  }),
  jobActivityLogEntry({
    log_id: 'vac-log-2',
    log: '**Acme Staffing** acknowledged job distribution — capacity confirmed for **2** submissions.',
    created_at: daysAgo(9),
    user_full_name: 'Sarah Vendor',
    user_id: 20,
    log_contains_vendor_info: true,
  }),
  jobActivityLogEntry({
    log_id: 'vac-log-3',
    log: '**Application** submitted by vendor for **Jordan Lee** (rate **118 USD/hr**, available **immediate**).',
    created_at: daysAgo(7),
    user_full_name: 'Sarah Vendor',
    user_id: 20,
    log_contains_vendor_info: true,
  }),
  jobActivityLogEntry({
    log_id: 'vac-log-4',
    log: '**Application** submitted by vendor for **Priya Nair** (rate **122 USD/hr**).',
    created_at: daysAgo(6),
    user_full_name: 'Sarah Vendor',
    user_id: 20,
    log_contains_vendor_info: true,
  }),
  jobActivityLogEntry({
    log_id: 'vac-log-5',
    log: '**Resource Manager** requested **rate clarification** on **Jordan Lee** — comment: align to **120–125** band.',
    created_at: daysAgo(5),
    user_full_name: 'Alice Manager',
    user_id: 201,
  }),
  jobActivityLogEntry({
    log_id: 'vac-log-6',
    log: 'Vendor updated submission for **Jordan Lee** — bill rate **118 → 121 USD/hr**; resume **v3** attached.',
    created_at: daysAgo(4),
    user_full_name: 'Sarah Vendor',
    user_id: 20,
    log_contains_vendor_info: true,
  }),
  jobActivityLogEntry({
    log_id: 'vac-log-7',
    log: '**Shortlist** updated: **Priya Nair** moved to **Interview**; **Jordan Lee** remains **Under review**.',
    created_at: daysAgo(3),
    user_full_name: 'James Employer',
    user_id: 10,
  }),
  jobActivityLogEntry({
    log_id: 'vac-log-8',
    log: '**Interview** scheduled for **Priya Nair** — **Wed 10:00 PT**, panel **Alice Manager**, **Carol Davis**.',
    created_at: daysAgo(2),
    user_full_name: 'Alice Manager',
    user_id: 201,
  }),
  jobActivityLogEntry({
    log_id: 'vac-log-9',
    log: '**System** reminder: **2** open positions; **5** total applications across vendors.',
    created_at: daysAgo(1),
    user_full_name: 'System',
    user_id: null,
  }),
]

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

const JOB_DETAIL = {
  id: JOB_ID,
  title: 'Senior Software Engineer',
  status: 4,
  status_display: 'Active',
  is_closed: false,
  is_on_hold: false,
  is_pending_approval: false,
  is_pending_vendor: false,
  is_approval_rejected: false,
  is_active: true,
  business_unit: 1,
  business_unit_display: 'Engineering',
  contract_pay_type: 1,
  currency_code: 'USD',
  hire_type: 1,
  no_of_position: 3,
  total_no_of_position: 3,
  total_no_of_onboarded_position: 1,
  number_of_open_positions: 2,
  number_of_pending_positions: 0,
  location: 1,
  location_id: 1,
  resource_manager: 1,
  job_template: 1,
  job_template_job_type: 1,
  job_template_job_type_display: 'Staff Augmentation',
  job_template_is_active: true,
  start_date: daysFromNow(7),
  end_date: daysFromNow(180),
  updated_at: daysAgo(1),
  created_at: daysAgo(14),
  updated_by: 20,
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
  application_count: 5,
  job_category: 1,
  apply_shifts: false,
}

const JOB_VIEW = {
  id: JOB_ID,
  title: 'Senior Software Engineer',
  status: 4,
  status_display: 'Active',
  hire_type: 1,
  contract_pay_type: 1,
  currency_code: 'USD',
  base_currency_code: 'USD',
  contract_type: [1],
  rate_type: 4,
  program_rate_type: 'bill_rate',
  no_of_position: 3,
  location: 1,
  business_unit: 1,
  business_unit_name: 'Engineering',
  resource_manager: 1,
  resource_manager_name: 'Alice Manager',
  job_template: 1,
  job_template_job_type: 1,
  job_template_job_type_display: 'Staff Augmentation',
  start_date: daysFromNow(7),
  end_date: daysFromNow(180),
  company_name: 'CruiseCorp Inc.',
  external_id: 'EXT-SSE-2024-005',
  project_site_name: 'San Francisco HQ',
  job_category_name: 'Information Technology',
  job_code: 'IT-SWE-SR',
  weekly_paid_travel: 'no',
  job_fill_procedure: 0,
  provisioning_eligible: false,
  hiring_team_names: ['Bob Johnson', 'Carol Davis'],
  program_team_names: ['Engineering PMO'],
  program_team_entity_name: null,
  timesheet_approver_names: ['Alice Manager'],
  expense_approver_names: ['Alice Manager'],
  work_week: 40,
  work_hours_per_day: 8,
  job_rate: {
    type: 'rate',
    rate: 120,
    pay_rate: 96,
    markup: 25,
    min_pay_rate: null,
    max_pay_rate: null,
    min_hours: null,
    not_qualified_rate: null,
  },
  is_pay_rate_driven: false,
  min_suggested_rate: 110,
  max_suggested_rate: 140,
  preferred_rate: 120,
  min_experience: 3,
  max_experience: 7,
  total_budget: 60000,
  base_budget: 60000,
  chose_premium_rate: false,
  ot_applicability: 1,
  expense_type: 'no',
  module: 0,
}

const JOB_RECORD_CONFIG = {
  can_clone_job: false,
  can_email_vendors: false,
  can_reopen_job: false,
  display_checklists: false,
  hide_edit: true,
  is_vendor: true,
  is_preid_enabled: false,
  end_job_reasons: [],
  end_job_sub_reasons: [],
  has_pre_onboarding_checklists: false,
  can_waive_verifications: false,
  can_apply_candidates: true,
  can_view_job_activity_logs: true,
  can_send_email_to_vendor: false,
  show_waive_verifications: false,
  can_close_unfilled_positions: false,
  close_position_for_all_workflows: false,
  close_unfilled_positions_on_job: false,
  show_candidate_experience: true,
  show_work_type_profile: false,
  show_calendar_pay_profile: false,
  show_overtime_profile: false,
  show_shifts: false,
  show_compensation: true,
  has_contractor_bill_rate_read: false,
  has_vendor_company_read: false,
  has_work_order_end_date_read: true,
  is_vendor_visible: true,
  remove_recommendation: false,
  show_recommendations: false,
  are_recommendations_revealed: false,
  event_based_expenses: { can_view: false, can_edit: false },
  unfilled_positions_count: 2,
  can_apply_preid: false,
  show_tenure: false,
  can_edit_job_distributions: false,
}

/** Global jobs list config (`/api/v2/jobs/config`) — full shape so JobOverview reads flags without undefined gaps. */
const JOB_CONFIG = {
  is_shortlisting_enabled: true,
  is_card_view_enabled: true,
  is_job_resource_manager_visible: true,
  is_business_unit_visible: true,
  is_program_team_visible: true,
  is_provisioning_enabled: false,
  program_team_label: 'Program team',
  is_vendor_visible: true,
  close_position_for_all_workflows: false,
  show_experience: true,
  show_weekly_paid_travel: false,
  show_job_code: true,
  show_expense_type: false,
  show_program_team: true,
  show_hiring_team: true,
  show_timesheet_approver: true,
  show_expense_approver: true,
  show_hire_type: false,
  show_contract_type: false,
  show_preferred_bill_rate: false,
  show_not_qualified_rate: false,
  show_contractor_std_hrs_week: true,
  show_monthly_std_hrs_per_day: false,
  show_premium_rate: false,
  show_must_have_skills: true,
  show_nice_to_have_skills: true,
  time_entry_unit: 1,
  can_view_calculation_pack: false,
  exemption_status_default: 1,
  exemption_status: { display: false, default: 1 },
}

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

/**
 * Vendor Applied Candidates page (/vendors/applied-candidates/5/?title=True)
 * Django template rendered by VR middleware with mock context.
 * React job_details bundle reads props from inline JS in the template.
 */
export const vendorAppliedCandidates: PageDefinition = {
  id: 'vendor-applied-candidates',
  name: 'Vendor Applied Candidates',
  path: `/vendors/applied-candidates/${JOB_ID}/?title=True`,
  roles: ['vendor'],
  fullPage: true,
  django: true,

  async waitForReady(page: Page) {
    try {
      await page.waitForSelector('[data-testid="overview-all"]', { timeout: 20000 })
    } catch {
      const hasJobBody = await page.$('[data-react="JobBody"]')
      const hasJobHeader = await page.$('[data-react="JobHeader"]')
      console.log('DEBUG: JobBody:', !!hasJobBody, 'JobHeader:', !!hasJobHeader)
      await page.waitForTimeout(3000)
    }
    await page.waitForTimeout(1000)
  },

  async setup(page: Page, _role: Role) {
    // Account me — vendor role
    await page.route('**/api/v2/accounts/me/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 20,
          full_name: 'Sarah Vendor',
          email: 'sarah@acmestaffing.com',
          role: 'vendor',
          rbac_role: 'vendor_admin',
          tenant: 'cruise',
          environment: 'local',
          timezone: 'America/New_York',
          locale: 'en',
          vendor_id: 5,
          vendor_entity_id: 5,
          employer_id: null,
          isVendorRole: true,
          isCandidateRole: false,
          isEmployerRole: false,
        }),
      })
    })

    // Navigation menu
    await page.route('**/api/v2/nav/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NAV_CONFIG_VENDOR),
      })
    })

    // Feature flags — single flag → boolean; comma-separated → `{ [flag]: true }` (matches client `getFeatureFlags`)
    await page.route('**/api/v2/client/feature-flags/**', (route) => {
      const url = route.request().url()
      const m = url.match(/\/feature-flags\/([^?]+)/)
      const keys = m ? decodeURIComponent(m[1]).split(',').map((k) => k.trim()).filter(Boolean) : []
      const body = keys.length <= 1 ? true : Object.fromEntries(keys.map((k) => [k, true]))
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })

    // Full job detail (useJobQuery in JobHeader)
    await page.route(new RegExp(`.*\\/api\\/v2\\/jobs\\/job\\/${JOB_ID}\\/?(\\?.*)?$`), (route) => {
      const url = route.request().url()
      if (/\/jobs\/job\/\d+\/[a-z_]/.test(url)) {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_DETAIL),
      })
    })

    // Job view (useJobViewQuery in JobOverview)
    await page.route(new RegExp(`.*\\/api\\/v2\\/jobs\\/job\\/${JOB_ID}\\/view\\/`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_VIEW),
      })
    })

    // Job record config
    await page.route(new RegExp(`.*\\/api\\/v2\\/jobs\\/job\\/${JOB_ID}\\/config\\/(\\?.*)?$`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_RECORD_CONFIG),
      })
    })

    // Job activity log (JobHeader drawer + legacy activity card when FF off)
    await page.route(`**/api/v2/jobs/job/${JOB_ID}/activity_log**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_ACTIVITY_LOG),
      })
    })

    // Job config
    await page.route('**/api/v2/jobs/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_CONFIG),
      })
    })

    // Job compensation settings
    await page.route('**/api/v2/jobs/compensation/settings', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ budget_calculator: false }),
      })
    })

    // Rate card config
    await page.route('**/api/v2/job-rate-cards/config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ is_pay_parity_enabled: false, pay_parity_enabled_worksites: [] }),
      })
    })

    // Multi-PMO enabled
    await page.route('**/api/v2/program-team/multi_pmo_enabled/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      })
    })

    // Job compact list detail (useJobListCompactDetailsQuery — used by ApplyCandidateModal)
    await page.route(`**/api/v2/jobs/list/${JOB_ID}/`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_LIST_COMPACT),
      })
    })

    // Job distribution config
    await page.route(`**/api/v2/get-job-distribution-config/${JOB_ID}/`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_edit_job_distributions: false,
          can_vendor_dist_be_acknowledged: false,
          can_vendor_accept_or_decline: false,
          can_view_vendor_profile: false,
          can_vendor_apply_candidates: true,
          can_vendor_change_acceptance: false,
        }),
      })
    })

    // Job publish approvals
    await page.route(/.*\/api\/v2\/job_publish_approvals\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      })
    })

    // All approvers
    await page.route(/.*\/api\/v2\/.*\/all_approvers\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ workflows: [], approval_chain: [], workflow_definition: null }),
      })
    })

    // Shift rules vendor list
    await page.route('**/api/v2/shifts/rules_vendors/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Criteria shifts / default shifts
    await page.route(/.*\/api\/v2\/shifts\/default/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ shifts: null, shift_differential_mapping: null }),
      })
    })

    // Interviews config
    await page.route('**/api/v2/interviews/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ can_create_interview: false, can_view_interviews: false, is_enabled: false }),
      })
    })

    // User tasks list (nav task drawer)
    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, title: 'Apply candidate to Senior Software Engineer', status: 1, due_date: daysFromNow(3), category: 'Job Applicant', priority: 'high' },
          { id: 2, title: 'Review work order for Bob Johnson', status: 1, due_date: daysFromNow(5), category: 'Work Order', priority: 'medium' },
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

    // Business unit config
    await page.route('**/api/v2/business_units/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ is_enabled: true, label: 'Organisation Unit', level_labels: ['Division', 'Department'] }),
      })
    })

    // Business unit detail
    await page.route(/.*\/api\/v2\/business_units\/\d+\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, name: 'Engineering', level: 2, parent: null }),
      })
    })

    // Business units list
    await page.route(/.*\/api\/v2\/business_units\/(\?.*)?$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, name: 'Engineering', level: 2, parent: null },
          { id: 2, name: 'Product', level: 2, parent: null },
          { id: 3, name: 'Operations', level: 2, parent: null },
        ])),
      })
    })

    // Work sites generic (handles both work-sites and work_sites URL variants)
    await page.route(/.*\/api\/v2\/work[-_]sites\//, (route) => {
      const url = route.request().url()
      if (/\/work[-_]sites\/\d+/.test(url)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: JOB_DETAIL.location,
            name: 'San Francisco HQ',
            address: '100 Mission Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94105',
            country: 'US',
          }),
        })
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    // Job attachments
    await page.route(/.*\/api\/v2\/jobs\/job\/\d+\/attachments\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, file_name: 'job_description.pdf', extension: 'pdf', can_vendor_view: true },
          { id: 2, file_name: 'requirements.docx', extension: 'docx', can_vendor_view: true },
        ])),
      })
    })
  },
}
