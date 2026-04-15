import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo } from '../mock-utils.js'


/** `TaskState` in assets/js/api/approvers.ts */
const TS = { Ready: 16, Completed: 32 } as const

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

const APPROVAL_SUBTYPES = [
  'Expense & Adjustment',
  'Job Publish',
  'Job Change',
  'Timesheets',
  'Work Order Modification',
  'Work Order End',
  'Invoice',
  'SOW Acceptance',
]

/** First task is selected by default; detail + all_approvers use these ids. */
const PRIMARY_TASK_ID = 9001
const PRIMARY_COMPONENT_ID = 77001

const taskInstance = (params: {
  uuid: string
  userId: number
  state: number
  stateText: string
  canApprove: boolean
  approved?: boolean
  approvalTimestamp?: string
  reason?: string | null
}) => ({
  uuid: params.uuid,
  parent_uuid: 'wf-parent',
  task_name: 'approval.task',
  state: params.state,
  state_text: params.stateText,
  user: params.userId,
  name: 'Approval',
  subname: '',
  component_type: 'Timesheets',
  component_id: PRIMARY_COMPONENT_ID,
  reason: params.reason ?? null,
  task_data: {
    email: 'approver@vndly.com',
    namespace: 'approval',
    approved: params.approved,
    approval_timestamp: params.approvalTimestamp,
  },
  can_approve: params.canApprove,
  can_override_approve: null,
  tags: [] as string[],
})

const approver = (params: {
  userId: number
  name: string
  email: string
  task: ReturnType<typeof taskInstance> | null
}) => ({
  step: 'step',
  user_id: params.userId,
  email: params.email,
  type: 'and' as const,
  task_instance: params.task,
  approver_name: params.name,
})

const ALL_APPROVERS_BODY = {
  workflows: [
    {
      workflow_id: 101,
      related_object: {
        id: PRIMARY_COMPONENT_ID,
        display_id: 'TS-9001',
        text: 'Timesheet — week ending Apr 4, 2026',
        type: 'Timesheet',
      },
      approvers: [
        {
          is_active: false,
          is_rejected: false,
          and_approvers: [
            approver({
              userId: 201,
              name: 'Alex Morgan',
              email: 'alex.morgan@cruisecorp.com',
              task: taskInstance({
                uuid: 'wf-ts-done-1',
                userId: 201,
                state: TS.Completed,
                stateText: 'Completed',
                canApprove: false,
                approved: true,
                approvalTimestamp: daysAgo(3),
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
        {
          is_active: true,
          is_rejected: false,
          and_approvers: [
            approver({
              userId: 10,
              name: 'James Employer',
              email: 'james@cruisecorp.com',
              task: taskInstance({
                uuid: 'wf-ts-active-1',
                userId: 10,
                state: TS.Ready,
                stateText: 'Ready',
                canApprove: true,
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
      ],
      comments: [
        {
          id: 501,
          comment_user: 'Alex Morgan',
          comment_user_id: 201,
          action: 'approved',
          comment: 'Billable hours align with the SOW; approving first line.',
          created_at: daysAgo(3),
          updated_at: daysAgo(3),
        },
      ],
    },
    {
      workflow_id: 102,
      related_object: {
        id: 2,
        display_id: 'BUD-OV',
        text: 'Budget delegation — Engineering',
        type: 'Policy',
      },
      approvers: [
        {
          is_active: false,
          is_rejected: false,
          and_approvers: [
            approver({
              userId: 202,
              name: 'Priya Shah',
              email: 'priya.shah@cruisecorp.com',
              task: taskInstance({
                uuid: 'wf-bud-done',
                userId: 202,
                state: TS.Completed,
                stateText: 'Completed',
                canApprove: false,
                approved: true,
                approvalTimestamp: daysAgo(5),
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
        {
          is_active: false,
          is_rejected: true,
          and_approvers: [
            approver({
              userId: 203,
              name: 'Chris Okonkwo',
              email: 'chris.okonkwo@cruisecorp.com',
              task: taskInstance({
                uuid: 'wf-bud-rej',
                userId: 203,
                state: TS.Completed,
                stateText: 'Completed',
                canApprove: false,
                approved: false,
                reason: 'Cap exceeded for this cost center — please realign to PROJ-4421.',
                approvalTimestamp: daysAgo(1),
              }),
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
      ],
      comments: [
        {
          id: 502,
          comment_user: 'Chris Okonkwo',
          comment_user_id: 203,
          action: 'rejected',
          comment: 'Cap exceeded for this cost center — please realign to PROJ-4421.',
          created_at: daysAgo(1),
          updated_at: daysAgo(1),
        },
      ],
    },
  ],
  allApprovalsAreComplete: false,
  workflowsHaveRejections: true,
}

const TIME_ENTRY_DETAIL = {
  id: PRIMARY_TASK_ID,
  hiredCandidate: { name: 'Jordan Lee' },
  startDate: daysAgo(14),
  endDate: daysAgo(7),
  dayUnits: false,
  totals: {
    billable: 38,
    nonBillable: 2,
    regular: 36,
    overtime: 2,
    double: 0,
    hours: 40,
  },
}

const baseTask = (params: {
  task_id: number
  component_id: number
  component_type: string
  component_subtype: string
  api_module: string
  description: string
  timestamp: string
  resource_path: string
}) => ({
  task_id: params.task_id,
  component_id: params.component_id,
  component_type: params.component_type,
  component_subtype: params.component_subtype,
  namespace: 'approval' as const,
  task_data: {} as Record<string, unknown>,
  user: 10,
  user_name: 'James Employer',
  description: params.description,
  can_approve: true,
  can_override_approval: false,
  resource_path: params.resource_path,
  timestamp: params.timestamp,
  api_module: params.api_module,
})

const APPROVAL_TASKS = paginated(
  [
    baseTask({
      task_id: PRIMARY_TASK_ID,
      component_id: PRIMARY_COMPONENT_ID,
      component_type: 'Timesheets',
      component_subtype: 'Timesheets',
      api_module: 'time/time_entries_approvals',
      description: 'Weekly timesheet — Jordan Lee — 40.0 hrs (38.0 billable) — pending your approval',
      timestamp: daysAgo(0),
      resource_path: '/time-entries/tsview/',
    }),
    baseTask({
      task_id: 9002,
      component_id: 8801,
      component_type: 'Jobs',
      component_subtype: 'Job Publish',
      api_module: 'job_publish_approvals',
      description: 'Publish request — Senior Data Engineer (REQ-2026-0142) — rate band updated',
      timestamp: daysAgo(1),
      resource_path: '/jobs/8801/',
    }),
    baseTask({
      task_id: 9003,
      component_id: 4402,
      component_type: 'Expenses',
      component_subtype: 'Expense & Adjustment',
      api_module: 'expense-reports-approvals',
      description: 'Expense report EXP-2026-089 — $3,847.63 — resubmitted after prior rejection',
      timestamp: daysAgo(1),
      resource_path: '/expenses/4402/',
    }),
    baseTask({
      task_id: 9004,
      component_id: 3304,
      component_type: 'WorkOrder',
      component_subtype: 'Work Order Modification',
      api_module: 'work_order_approvals',
      description: 'WO #12884 — bill rate revision +4% — vendor: Acme Staffing',
      timestamp: daysAgo(2),
      resource_path: '/work_orders/all/3304/',
    }),
    baseTask({
      task_id: 9005,
      component_id: 3305,
      component_type: 'WorkOrder',
      component_subtype: 'Work Order End',
      api_module: 'work_order_approvals',
      description: 'WO #12901 — early end — effective Mar 28 — approved by hiring manager',
      timestamp: daysAgo(2),
      resource_path: '/work_orders/all/3305/',
    }),
    baseTask({
      task_id: 9006,
      component_id: 8802,
      component_type: 'Jobs',
      component_subtype: 'Job Change',
      api_module: 'job_publish_approvals',
      description: 'Job change — extend end date to Jun 30 — Program Ops queue',
      timestamp: daysAgo(3),
      resource_path: '/jobs/8802/',
    }),
    baseTask({
      task_id: 9007,
      component_id: 2207,
      component_type: 'Invoices',
      component_subtype: 'Invoice',
      api_module: 'invoices/approvals',
      description: 'Invoice INV-55612 — $52,400.00 — TechBridge Solutions — pending AP',
      timestamp: daysAgo(4),
      resource_path: '/invoices/',
    }),
  ],
  { count: 28, limit: 20, offset: 0 },
)

/**
 * Employer approvals inbox (/approvals/) — Next.js ApprovalsApp.
 * Split list, filters sidebar (component subtypes), detail + approval chain.
 */
export const approvals: PageDefinition = {
  id: 'approvals',
  name: 'Approvals',
  path: '/approvals/',
  roles: ['employer'],
  fullPage: true,

  async setup(page: Page, role: Role) {
    if (role !== 'employer') return

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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) })
    })

    await page.route('**/api/v2/approval-tasks/**', (route) => {
      if (route.request().method() !== 'GET') {
        route.continue()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(APPROVAL_TASKS),
      })
    })

    await page.route('**/api/v2/workflow_approval_permissions/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          has_approval_rules_write: true,
          has_approval_rules_read: true,
          has_approval_criteria_resolvers_permission: false,
          has_bulk_approve_permission: true,
        }),
      })
    })

    await page.route('**/api/v2/approval_component_subtypes**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(APPROVAL_SUBTYPES),
      })
    })

    await page.route(
      (url) => {
        try {
          return new URL(url).pathname.includes('/all_approvers/')
        } catch {
          return false
        }
      },
      (route) => {
        if (route.request().method() !== 'GET') {
          route.continue()
          return
        }
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ALL_APPROVERS_BODY),
        })
      },
    )

    await page.route(`**/api/v2/time/${PRIMARY_TASK_ID}/`, (route) => {
      if (route.request().method() !== 'GET') {
        route.continue()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TIME_ENTRY_DETAIL),
      })
    })

    await page.route('**/api/contact-us-config/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })

    // Nav task drawer (same endpoint as home — not summary)
    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated([
            { id: 1, title: 'Follow up on rejected budget override', status: 1, due_date: daysAgo(-1), category: 'Approval', priority: 'high' },
            { id: 2, title: 'Review timesheet — Jordan Lee', status: 1, due_date: daysAgo(0), category: 'Timesheet', priority: 'medium' },
            { id: 3, title: 'Second-level job publish approval', status: 2, due_date: daysAgo(-2), category: 'Job', priority: 'medium' },
          ]),
        ),
      })
    })
  },
}
