import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow } from '../mock-utils.js'


const JOB_ID = 123

/** Matches `TaskState` in assets/js/api/approvers.ts */
const TS = { Likely: 2, Ready: 16, Completed: 32, Cancelled: 64 } as const

const jobActivityLogEntry = (params: {
  log_id: string
  log: string
  created_at: string
  user_full_name: string
  user_id?: number | null
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
  log_contains_vendor_info: false,
  user_full_name: params.user_full_name,
  was_sow_skipped: null,
  bulk_update_id: null,
})

const approverTask = (params: {
  uuid: string
  userId: number
  name: string
  email: string
  state: number
  stateText: string
  approved?: boolean
  reason?: string | null
  approvalTimestamp?: string
  canApprove?: boolean
}) => ({
  uuid: params.uuid,
  parent_uuid: 'wf-parent-root',
  task_name: `approval.${params.uuid}`,
  state: params.state,
  state_text: params.stateText,
  user: params.userId,
  name: params.name,
  subname: params.email,
  component_type: 'Jobs',
  component_id: JOB_ID,
  reason: params.reason ?? null,
  task_data: {
    email: params.email,
    namespace: 'approval',
    approved: params.approved,
    approver_email: params.email,
    approval_timestamp: params.approvalTimestamp,
  },
  can_approve: params.canApprove ?? false,
  can_override_approve: null,
  tags: [] as string[],
})

const approverRow = (params: {
  step: string
  userId: number
  name: string
  email: string
  type: 'and' | 'or' | 'optional'
  taskInstance: ReturnType<typeof approverTask> | null
}) => ({
  step: params.step,
  user_id: params.userId,
  email: params.email,
  type: params.type,
  task_instance: params.taskInstance,
  approver_name: params.name,
})

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
  job_template_job_type_display: 'Staff Augmentation',
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
  job_category: 1,
}

// Job view — used by useJobViewQuery in JobOverview (more display fields)
const JOB_VIEW = {
  id: JOB_ID,
  title: 'Senior Software Engineer',
  status: 4,
  status_display: 'Active',
  hire_type: 1, // Contingent (HireType.CONTRACTOR)
  contract_pay_type: 1, // hourly
  currency_code: 'USD',
  base_currency_code: 'USD',
  contract_type: [1], // CONTRACT_ONLY
  rate_type: 4, // SET_RATE (enum value 4 in RateType)
  program_rate_type: 'bill_rate', // ProgramRateType.BillRateBased
  no_of_position: 3,
  location: 1,
  business_unit: 1,
  business_unit_name: 'Engineering',
  resource_manager: 1,
  resource_manager_name: 'Alice Manager',
  job_template: 1,
  job_template_job_type: 1,
  job_template_job_type_display: 'Staff Augmentation',
  start_date: daysFromNow(14),
  end_date: daysFromNow(180),
  company_name: 'CruiseCorp Inc.',
  external_id: 'EXT-SSE-2024-001',
  project_site_name: 'San Francisco HQ',
  job_category_name: 'Information Technology',
  job_code: 'IT-SWE-SR',
  weekly_paid_travel: 'no',
  job_fill_procedure: 0, // Standard
  provisioning_eligible: false,
  hiring_team_names: ['Bob Johnson', 'Carol Davis'],
  program_team_names: ['Engineering PMO'],
  program_team_entity_name: null,
  timesheet_approver_names: ['Alice Manager'],
  expense_approver_names: ['Alice Manager'],
  work_week: 40,
  work_hours_per_day: 8,
  // job_rate uses JobRateType.RATE shape (single bill rate)
  job_rate: {
    type: 'rate', // JobRateType.RATE
    rate: 135,
    pay_rate: 108,
    markup: 25,
    min_pay_rate: null,
    max_pay_rate: null,
    min_hours: null,
    not_qualified_rate: null,
  },
  is_pay_rate_driven: false,
  min_suggested_rate: 120,
  max_suggested_rate: 150,
  preferred_rate: 135,
  min_experience: 3,
  max_experience: 7,
  total_budget: 75000,
  base_budget: 75000,
  chose_premium_rate: false,
  ot_applicability: 1,
  expense_type: 'no',
  module: 0, // CONTINGENT
}

// Job record config — drives which fields/actions appear
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
  show_candidate_experience: true,
  show_work_type_profile: false,
  show_calendar_pay_profile: false,
  show_overtime_profile: false,
  show_shifts: false,
  show_compensation: true,
  has_contractor_bill_rate_read: true,
  has_vendor_company_read: true,
  has_work_order_end_date_read: true,
  is_vendor_visible: true,
  remove_recommendation: false,
  show_recommendations: false,
  are_recommendations_revealed: false,
  event_based_expenses: { can_view: false, can_edit: false },
  unfilled_positions_count: 2,
  can_apply_preid: false,
  show_tenure: true,
  can_edit_job_distributions: true,
}

// Job config — controls which optional sections are shown
const JOB_CONFIG = {
  show_experience: true,
  show_weekly_paid_travel: false,
  is_business_unit_visible: true,
  is_provisioning_enabled: false,
  show_job_code: true,
  show_expense_type: false,
  show_program_team: true,
  show_hiring_team: true,
  show_timesheet_approver: true,
  show_expense_approver: true,
  is_job_resource_manager_visible: true,
  show_hire_type: false,
  show_contract_type: false,
  show_preferred_bill_rate: false,
  show_not_qualified_rate: false,
  show_contractor_std_hrs_week: true,
  show_monthly_std_hrs_per_day: false,
  show_premium_rate: false,
  time_entry_unit: 1,
  is_card_view_enabled: true,
  is_preid_enabled: true,
  can_view_calculation_pack: false,
  exemption_status: { display: false },
  components: { experience: { display: true } },
}

// Compensation settings
const COMPENSATION_SETTINGS = { budget_calculator: false }

// Rate card config
const RATE_CARD_CONFIG = {
  is_pay_parity_enabled: false,
  pay_parity_enabled_worksites: [],
}

// Activity log — shape matches ActivityLogListSerializer / `Log` (ActivityLogRow + renderLogMessage)
const ACTIVITY_LOG = [
  jobActivityLogEntry({
    log_id: 'log-1',
    log: '**Job** requisition **Senior Software Engineer** was created and saved as draft.',
    created_at: daysAgo(12),
    user_full_name: 'James Employer',
  }),
  jobActivityLogEntry({
    log_id: 'log-2',
    log: 'Workflow **Job publish approval** started — routed to Resource Manager queue.',
    created_at: daysAgo(11),
    user_full_name: 'System',
    user_id: null,
  }),
  jobActivityLogEntry({
    log_id: 'log-3',
    log: '**Alice Manager** approved job publish (step 1 of 4).',
    created_at: daysAgo(10),
    user_full_name: 'Alice Manager',
    user_id: 201,
  }),
  jobActivityLogEntry({
    log_id: 'log-4',
    log: '**Priya Patel** approved job publish (step 2 of 4) — compensation within band.',
    created_at: daysAgo(9),
    user_full_name: 'Priya Patel',
    user_id: 202,
  }),
  jobActivityLogEntry({
    log_id: 'log-5',
    log: '**Marcus Chen** approved job publish (step 3 of 4).',
    created_at: daysAgo(8),
    user_full_name: 'Marcus Chen',
    user_id: 203,
  }),
  jobActivityLogEntry({
    log_id: 'log-6',
    log: '**Job amendment** submitted: bill rate **135 → 142 USD**; approval chain re-opened for VP review.',
    created_at: daysAgo(6),
    user_full_name: 'James Employer',
  }),
  jobActivityLogEntry({
    log_id: 'log-7',
    log: '**Elena Ruiz** **rejected** rate amendment — comment: *Cap for this role is 138 USD; revise or add exception ticket.*',
    created_at: daysAgo(5),
    user_full_name: 'Elena Ruiz',
    user_id: 205,
  }),
  jobActivityLogEntry({
    log_id: 'log-8',
    log: '**James Employer** updated positions from **2** to **3** and re-submitted amendment at **138 USD**.',
    created_at: daysAgo(4),
    user_full_name: 'James Employer',
  }),
  jobActivityLogEntry({
    log_id: 'log-9',
    log: '**Elena Ruiz** approved amended rate; workflow completed.',
    created_at: daysAgo(3),
    user_full_name: 'Elena Ruiz',
    user_id: 205,
  }),
  jobActivityLogEntry({
    log_id: 'log-10',
    log: 'Job status set to **Active** and distributed to **3** vendors.',
    created_at: daysAgo(2),
    user_full_name: 'James Employer',
  }),
  jobActivityLogEntry({
    log_id: 'log-11',
    log: 'Connector **Workday** — position sync **completed** (REQ-77821).',
    created_at: daysAgo(1),
    user_full_name: 'System',
    user_id: null,
  }),
]

// all_approvers API body (workflows only — client computes allApprovalsAreComplete / workflowsHaveRejections)
const ALL_APPROVERS_BODY = {
  workflows: [
    {
      workflow_id: 5001,
      related_object: {
        id: 1,
        display_id: 'JP-123',
        text: 'Job publish approval',
        type: 'JobPublish',
      },
      comments: [
        {
          id: 901,
          comment_user: 'Priya Patel',
          comment_user_id: 202,
          action: 'comment',
          comment: 'Rates validated against FY26 IT contractor benchmarks.',
          created_at: daysAgo(9),
          updated_at: daysAgo(9),
        },
        {
          id: 902,
          comment_user: 'Marcus Chen',
          comment_user_id: 203,
          action: 'comment',
          comment: 'Headcount approved under ENG-4412; proceed.',
          created_at: daysAgo(8),
          updated_at: daysAgo(8),
        },
      ],
      approvers: [
        {
          is_active: false,
          is_rejected: false,
          approval_group_name: '',
          and_approvers: [
            approverRow({
              step: 'L1 Resource Manager',
              userId: 201,
              name: 'Alice Manager',
              email: 'alice.manager@cruisecorp.com',
              type: 'and',
              taskInstance: approverTask({
                uuid: 'appr-task-201',
                userId: 201,
                name: 'Alice Manager',
                email: 'alice.manager@cruisecorp.com',
                state: TS.Completed,
                stateText: 'Completed',
                approved: true,
                approvalTimestamp: daysAgo(10),
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
        {
          is_active: false,
          is_rejected: false,
          approval_group_name: '',
          and_approvers: [
            approverRow({
              step: 'L2 Finance BP',
              userId: 202,
              name: 'Priya Patel',
              email: 'priya.patel@cruisecorp.com',
              type: 'and',
              taskInstance: approverTask({
                uuid: 'appr-task-202',
                userId: 202,
                name: 'Priya Patel',
                email: 'priya.patel@cruisecorp.com',
                state: TS.Completed,
                stateText: 'Completed',
                approved: true,
                approvalTimestamp: daysAgo(9),
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
        {
          is_active: false,
          is_rejected: false,
          approval_group_name: '',
          and_approvers: [
            approverRow({
              step: 'L3 HRBP',
              userId: 203,
              name: 'Marcus Chen',
              email: 'marcus.chen@cruisecorp.com',
              type: 'and',
              taskInstance: approverTask({
                uuid: 'appr-task-203',
                userId: 203,
                name: 'Marcus Chen',
                email: 'marcus.chen@cruisecorp.com',
                state: TS.Completed,
                stateText: 'Completed',
                approved: true,
                approvalTimestamp: daysAgo(8),
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
        {
          is_active: true,
          is_rejected: false,
          approval_group_name: '',
          and_approvers: [
            approverRow({
              step: 'L4 VP Engineering',
              userId: 204,
              name: 'Jordan Lee',
              email: 'jordan.lee@cruisecorp.com',
              type: 'and',
              taskInstance: approverTask({
                uuid: 'appr-task-204',
                userId: 204,
                name: 'Jordan Lee',
                email: 'jordan.lee@cruisecorp.com',
                state: TS.Ready,
                stateText: 'Ready',
                canApprove: false,
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
        {
          is_active: false,
          is_rejected: false,
          approval_group_name: '',
          and_approvers: [
            approverRow({
              step: 'L5 CFO Delegate',
              userId: 206,
              name: 'Sam Okonkwo',
              email: 'sam.okonkwo@cruisecorp.com',
              type: 'and',
              taskInstance: null,
            }),
          ],
          or_approvers: [],
          optional_approvers: [
            approverRow({
              step: 'Optional — Procurement',
              userId: 207,
              name: 'Taylor Kim',
              email: 'taylor.kim@cruisecorp.com',
              type: 'optional',
              taskInstance: approverTask({
                uuid: 'appr-task-207-opt',
                userId: 207,
                name: 'Taylor Kim',
                email: 'taylor.kim@cruisecorp.com',
                state: TS.Ready,
                stateText: 'Ready',
                canApprove: false,
              }),
            }),
          ],
        },
      ],
    },
    {
      workflow_id: 5002,
      related_object: {
        id: 12,
        display_id: 'CHG-12',
        text: 'Rate amendment (138 USD)',
        type: 'JobChange',
      },
      comments: [
        {
          id: 903,
          comment_user: 'Elena Ruiz',
          comment_user_id: 205,
          action: 'reject',
          comment: 'Cap for this role is 138 USD; first submission at 142 USD was declined.',
          created_at: daysAgo(5),
          updated_at: daysAgo(5),
        },
      ],
      approvers: [
        {
          is_active: false,
          is_rejected: false,
          approval_group_name: '',
          and_approvers: [
            approverRow({
              step: 'Finance review',
              userId: 202,
              name: 'Priya Patel',
              email: 'priya.patel@cruisecorp.com',
              type: 'and',
              taskInstance: approverTask({
                uuid: 'amend-task-202',
                userId: 202,
                name: 'Priya Patel',
                email: 'priya.patel@cruisecorp.com',
                state: TS.Completed,
                stateText: 'Completed',
                approved: true,
                approvalTimestamp: daysAgo(6),
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
        {
          is_active: false,
          is_rejected: true,
          approval_group_name: '',
          and_approvers: [
            approverRow({
              step: 'VP Compensation',
              userId: 205,
              name: 'Elena Ruiz',
              email: 'elena.ruiz@cruisecorp.com',
              type: 'and',
              taskInstance: approverTask({
                uuid: 'amend-task-205-rej',
                userId: 205,
                name: 'Elena Ruiz',
                email: 'elena.ruiz@cruisecorp.com',
                state: TS.Completed,
                stateText: 'Completed',
                approved: false,
                reason: 'Rate exceeds approved band for grade L5 (max 138 USD bill).',
                approvalTimestamp: daysAgo(5),
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
        {
          is_active: false,
          is_rejected: false,
          approval_group_name: '',
          and_approvers: [
            approverRow({
              step: 'VP Compensation (re-review)',
              userId: 205,
              name: 'Elena Ruiz',
              email: 'elena.ruiz@cruisecorp.com',
              type: 'and',
              taskInstance: approverTask({
                uuid: 'amend-task-205-ok',
                userId: 205,
                name: 'Elena Ruiz',
                email: 'elena.ruiz@cruisecorp.com',
                state: TS.Completed,
                stateText: 'Completed',
                approved: true,
                approvalTimestamp: daysAgo(3),
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
      ],
    },
  ],
}

const GWF_WORKFLOW_LOG_RESULTS = [
  {
    uuid: 'gwf-wd-1',
    label: '**Requisition created** in Workday (Contingent Worker)',
    updated_at: daysAgo(11),
    definition_namespace: 'connectors::workday::contingent',
    root_obj_type: 'Job',
    root_obj_id: JOB_ID,
    data: {
      step_message: 'Payload accepted; awaiting position ID from Workday.',
      event_id: 'wd-req-77821-create',
    },
    directives: {},
  },
  {
    uuid: 'gwf-wd-2',
    label: '**Position sync** — REQ-77821 linked to VNDLY job',
    updated_at: daysAgo(10),
    definition_namespace: 'connectors::workday::contingent',
    root_obj_type: 'Job',
    root_obj_id: JOB_ID,
    data: {
      step_message: 'Supervisory organization and location mapped successfully.',
      event_id: 'wd-sync-99281',
    },
    directives: {},
  },
  {
    uuid: 'gwf-wd-3',
    label: '**Approval chain snapshot** exported to audit store',
    updated_at: daysAgo(8),
    definition_namespace: 'internal::audit',
    root_obj_type: 'Job',
    root_obj_id: JOB_ID,
    data: {
      step_message: 'Immutable copy retained for SOX retention (7 years).',
    },
    directives: {},
  },
  {
    uuid: 'gwf-wd-4',
    label: '**Amendment** — rate change event queued for Workday',
    updated_at: daysAgo(4),
    definition_namespace: 'connectors::workday::contingent',
    root_obj_type: 'Job',
    root_obj_id: JOB_ID,
    data: {
      step_message: 'Revision 2 submitted at 138 USD bill rate.',
      event_id: 'wd-amend-22004',
    },
    directives: {},
  },
]

// Compact list detail
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
 * Job Detail page (/jobs/job_details/123/)
 * Employer-only Django page with embedded React components (JobHeader, JobOverview, Approvals).
 *
 * The Django template is rendered by VR middleware (X-VR-Mock header) with mock context.
 * React components that mount inside the page still need their API calls mocked below.
 */
export const jobDetail: PageDefinition = {
  id: 'job-detail',
  name: 'Job Detail',
  path: `/jobs/job_details/${JOB_ID}/`,
  roles: ['employer'],
  fullPage: true,
  django: true,

  async waitForReady(page: Page) {
    // Wait for renderJobBody to fire and React to mount
    // overview-all is rendered by JobOverview once data loads
    try {
      await page.waitForSelector('[data-testid="overview-all"]', { timeout: 20000 })
    } catch {
      // Log what's in the DOM for debugging, then settle
      const hasJobHeader = await page.$('[data-react="JobHeader"]')
      const hasJobBody = await page.$('[data-react="JobBody"]')
      const hasReactRoot = await page.$('#react-root')
      console.log('DEBUG: JobHeader:', !!hasJobHeader, 'JobBody:', !!hasJobBody, 'react-root:', !!hasReactRoot)
      await page.waitForTimeout(3000)
    }
    await page.waitForTimeout(1000)
  },

  async setup(page: Page, role: Role) {
    // Django template is rendered by VR middleware with mock context.
    // We still need API route mocks for the React components that mount
    // inside the Django page (JobHeader, JobOverview, etc.)

    // Account me
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

    // Navigation menu
    await page.route('**/api/v2/nav/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NAV_CONFIG_EMPLOYER),
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

    // Full job detail (useJobQuery in JobHeader) — matches with or without query string, no sub-paths
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

    // Job record config (useJobRecordConfig)
    await page.route(new RegExp(`.*\\/api\\/v2\\/jobs\\/job\\/${JOB_ID}\\/config\\/(\\?.*)?$`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_RECORD_CONFIG),
      })
    })

    // Job activity log
    await page.route(`**/api/v2/jobs/job/${JOB_ID}/activity_log`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVITY_LOG),
      })
    })

    // Job config (useJobConfig)
    await page.route('**/api/v2/jobs/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_CONFIG),
      })
    })

    // Job compensation settings (useJobCompensationSettings)
    await page.route('**/api/v2/jobs/compensation/settings', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(COMPENSATION_SETTINGS),
      })
    })

    // Rate card config (useRateCardsConfigQuery)
    await page.route('**/api/v2/job-rate-cards/config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RATE_CARD_CONFIG),
      })
    })

    // Multi-PMO enabled (useHasMultiPmo -> useMultiPmoEnabled)
    await page.route('**/api/v2/program-team/multi_pmo_enabled/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      })
    })

    // Job compact list detail (useJobListCompactDetailsQuery)
    await page.route(`**/api/v2/jobs/list/${JOB_ID}/`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOB_LIST_COMPACT),
      })
    })

    // Job distribution config (useJobDistributionConfigQuery)
    await page.route(`**/api/v2/get-job-distribution-config/${JOB_ID}/`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_edit_job_distributions: true,
          can_vendor_dist_be_acknowledged: false,
          can_vendor_accept_or_decline: false,
          can_view_vendor_profile: true,
          can_vendor_apply_candidates: false,
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

    // Shift rules vendor list
    await page.route('**/api/v2/shifts/rules_vendors/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Criteria shifts / default shifts evaluation
    await page.route(/.*\/api\/v2\/shifts\/default/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ shifts: null, shift_differential_mapping: null }),
      })
    })

    // All approvers (ApproversListCard / approval drawer) — shape matches AllApproversResponse.workflows
    await page.route(/.*\/api\/v2\/.*\/all_approvers\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ALL_APPROVERS_BODY),
      })
    })

    // Interviews config
    await page.route('**/api/v2/interviews/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ can_create_interview: true, can_view_interviews: true, is_enabled: true }),
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

    // Vendor distributions (returns array directly, not paginated)
    await page.route(`**/api/v2/jobs/job/${JOB_ID}/vendor-distributions`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, distributed_at: daysAgo(8), created_at: daysAgo(8), is_vendor_onboarded: true, vendor_entity_id: 100, vendor_name: 'Acme Staffing Solutions', current_acknowledgement: null, initial_acknowledgement: null },
          { id: 2, distributed_at: daysAgo(7), created_at: daysAgo(7), is_vendor_onboarded: true, vendor_entity_id: 101, vendor_name: 'TechTalent Partners', current_acknowledgement: null, initial_acknowledgement: null },
          { id: 3, distributed_at: daysAgo(6), created_at: daysAgo(6), is_vendor_onboarded: false, vendor_entity_id: 102, vendor_name: 'GlobalHire Inc.', current_acknowledgement: null, initial_acknowledgement: null },
        ]),
      })
    })

    // Attachments (useJobAttachmentsQuery) — paginated with file_name + extension (no extension in name)
    await page.route(`**/api/v2/jobs/job/${JOB_ID}/attachments/**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 101, file_name: 'Job Description - Senior SWE', extension: 'pdf', can_vendor_view: true },
          { id: 102, file_name: 'Interview Guidelines', extension: 'docx', can_vendor_view: true },
          { id: 103, file_name: 'Compensation Framework', extension: 'xlsx', can_vendor_view: false },
        ])),
      })
    })

    // Application stats (useJobApplicationStatsQuery) — keys are numeric JobApplicationStatus/OfferStatus values
    await page.route(`**/api/v2/jobs/job/${JOB_ID}/application_stats`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 12,
          current_status_counts: {
            1: 5,   // VendorApplied
            2: 3,   // ClientInterviewing
            5: 2,   // ClientOfferReleased
            11: 1,  // ContractedOnboarded
            10: 1,  // ReadyToOnboard
          },
          offer_status_count: {
            1: 5,   // Applied
            2: 3,   // Selected
            6: 2,   // OfferAccepted
            8: 1,   // Onboarded
          },
        }),
      })
    })

    // Work site details (renderWorkSiteDetails)
    await page.route('**/api/v2/work_sites/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'San Francisco HQ',
          code: 'SF-HQ',
          address_line_one: '100 Market Street',
          address_line_two: 'Suite 400',
          address_line_three: '',
          additional_address_lines: null,
          city: 'San Francisco',
          county: 'San Francisco',
          neighborhood: '',
          state: 'California',
          subdivision_code: 'US-CA',
          subdivision_name: 'California',
          zip: '94105',
          country_code: 'US',
          country_code_alpha_3: 'USA',
          is_deleted: false,
          subdivision_id: 5,
          country_id: 236,
          extended_display_name: 'San Francisco HQ - 100 Market Street, San Francisco, CA 94105',
          display_name: 'San Francisco HQ',
          region: 'Americas',
          custom_fields: {},
          features: [{ id: 1, display_name: 'On-site Cafeteria' }, { id: 2, display_name: 'Secure Parking' }],
          accounting_location_code: 'SF-001',
          allowed_currencies: null,
          expense_approvers: null,
          assignment_type: null,
          groups: null,
          tags: null,
          default_currency: null,
          generic_fields: null,
        }),
      })
    })

    // Workflow log card (WorkflowLog.jsx → /api/v2/gwf/instance/?manual=true&root_obj_type=Job&root_obj_id=…)
    await page.route(/.*\/api\/v2\/gwf\/instance\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: GWF_WORKFLOW_LOG_RESULTS }),
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
