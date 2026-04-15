import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo } from '../mock-utils.js'

const EXPENSE_ID = 1001

/** TaskState.Ready — header approve/reject buttons */
const TASK_READY = 16

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

const expenseLine = (params: {
  id: number
  title: string
  category: number
  expense_type: number
  expense_type_display: string
  from_date: string
  to_date: string
  amount: number
  field_status: number
  field_status_display: string
  comments?: string
}) => ({
  id: params.id,
  title: params.title,
  expense_type: params.expense_type,
  expense_type_display: params.expense_type_display,
  from_date: params.from_date,
  to_date: params.to_date,
  amount: params.amount,
  amount_display: `$${params.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  field_status: params.field_status,
  field_status_display: params.field_status_display,
  reason: null,
  attachment: [] as unknown[],
  category: params.category,
  receipt_unavailable: false,
  comments: params.comments ?? '',
  updated_by_name: params.field_status === 2 ? 'Sarah Manager' : 'Jane Smith',
  charge_codes: [
    {
      id: 501,
      fields: { code: 'ENG-001' },
      tableId: 1,
      displayName: 'Engineering — Primary',
      proportion: 1,
    },
  ],
  total_amount: params.amount,
  fixed_tax_amount: null,
  generic_fields: {},
  generic_fields_display_values: [] as unknown[],
  tax_location: null,
  tax_location_display: '',
  linked_time_entry: null,
  linked_invoice_master: null,
  linked_expense_report: null,
  created_by: 201,
  has_tax_rate_override: false,
  tax_rate_override: null,
  tax_display: '',
  tax_amount: null,
})

const MILEAGE_ROWS = [
  {
    id: 901,
    title: 'Local client sites — week of Feb 10',
    from_date: '2026-02-10',
    to_date: '2026-02-14',
    from_location: 'Boston, MA',
    to_location: 'Cambridge, MA',
    miles: 42,
    field_status: 1,
    field_status_display: 'Unapproved',
    amount: '24.36',
    rate: '0.58',
    reason: null,
    comments: 'Round trips to client campus',
    updated_by_name: 'Jane Smith',
    charge_codes: [] as unknown[],
    generic_fields: {},
    generic_fields_display_values: [] as unknown[],
  },
]

const EXPENSE_REPORT = {
  id: EXPENSE_ID,
  title: 'Q1 Client Travel — Northeast',
  status: 2,
  status_display: 'Submitted',
  created_at: daysAgo(18),
  total_amount: '3847.63',
  total_amount_display: '$3,847.63',
  total_approved_amount_display: '$1,245.00',
  visible_approvers: [
    { id: 302, name: 'Sarah Manager' },
    { id: 303, name: 'Mike Director' },
  ],
  strategy_approvers: [
    { id: 302, name: 'Sarah Manager' },
    { id: 303, name: 'Mike Director' },
  ],
  updated_at: daysAgo(1),
  business_unit_id: 1,
  business_unit_name: 'Engineering',
  updated_by_name: 'Jane Smith',
  expense_fields: [
    expenseLine({
      id: 5001,
      title: 'Airfare — BOS ↔ LGA (Delta)',
      category: 1,
      expense_type: 101,
      expense_type_display: 'Airfare',
      from_date: '2026-02-10',
      to_date: '2026-02-10',
      amount: 428.5,
      field_status: 2,
      field_status_display: 'Approved',
    }),
    expenseLine({
      id: 5002,
      title: 'Hotel — Midtown, 3 nights',
      category: 2,
      expense_type: 102,
      expense_type_display: 'Lodging',
      from_date: '2026-02-10',
      to_date: '2026-02-12',
      amount: 892.0,
      field_status: 2,
      field_status_display: 'Approved',
    }),
    expenseLine({
      id: 5003,
      title: 'Meals — client working dinner',
      category: 3,
      expense_type: 103,
      expense_type_display: 'Meals',
      from_date: '2026-02-11',
      to_date: '2026-02-11',
      amount: 186.42,
      field_status: 1,
      field_status_display: 'Unapproved',
      comments: '4 attendees; itemized receipt attached in vendor portal',
    }),
    expenseLine({
      id: 5004,
      title: 'Ground transport — rides to airport',
      category: 4,
      expense_type: 104,
      expense_type_display: 'Ground Transportation',
      from_date: '2026-02-10',
      to_date: '2026-02-13',
      amount: 96.8,
      field_status: 1,
      field_status_display: 'Unapproved',
    }),
    expenseLine({
      id: 5005,
      title: 'Equipment — USB-C dock & headset',
      category: 6,
      expense_type: 105,
      expense_type_display: 'Equipment',
      from_date: '2026-02-12',
      to_date: '2026-02-12',
      amount: 219.99,
      field_status: 1,
      field_status_display: 'Unapproved',
    }),
  ],
  mileage_expenses: MILEAGE_ROWS,
  expense_number: 'EXP-1001',
  reason: null,
  work_site_id: 10,
  work_site_display: 'Boston Seaport',
  currency_code: 'USD',
  approved_by_name: '',
  approval_time: null,
  last_rejected_by_name: '',
  last_rejected_time: null,
  last_submitted_time: daysAgo(5),
  external_id: 'WD-EXP-778821',
  event_based_expense_criteria_snapshot: null,
  report_type: 1,
  report_type_display_name: 'Travel & Entertainment',
  report_type_purpose: 0,
  report_type_generic_form_id: null,
  report_type_must_link_to_charge_code: false,
  work_order_id: 2001,
  work_order_display: 'WO-2001 — Implementation Lead',
  work_order_charge_code: {
    id: 501,
    fields: { code: 'ENG-001' },
    tableId: 1,
  },
  candidate_name: 'Jane Smith',
  candidate_id: 101,
  hired_candidate_id: 5501,
  vendor_entity_id: 5,
  vendor_entity_company_name: 'Acme Staffing',
  program_team_entity_id: null,
  program_team_entity_name: null,
  creation_type: 1,
  billing_cycle_def_display: 'Monthly (Net 45)',
}

const EXPENSE_REPORT_CONFIG = {
  can_add_expenses: false,
  can_approve: true,
  can_delete_expenses: false,
  can_edit_approvers: false,
  can_edit_expenses: false,
  can_edit_expense_summary: false,
  can_adjust_report: false,
  can_submit_report: false,
  can_read_invoice: true,
  charge_code_splitting: false,
  duplicate_fields_dict: null,
  enable_links: true,
  expense_report_type: {
    id: 1,
    purpose: 0,
    name: 'Travel & Entertainment',
    categories: [1, 2, 3, 4, 5, 6, 7, 8],
    is_active: true,
    is_default: true,
    includes_mileage: true,
    contractor_available: true,
    vendor_available: true,
    must_link_to_work_order: false,
    must_link_to_charge_code: false,
    approval_strategy_override: null,
    generic_form: null,
    valid_categories: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  expense_categories: [
    { id: 1, name: 'Airfare', slugged_name: 'airfare', isTaxable: false, transaction_type: 0, is_fixed_taxes: false },
    { id: 2, name: 'Hotel', slugged_name: 'hotel', isTaxable: true, transaction_type: 0, is_fixed_taxes: false },
    { id: 3, name: 'Meals', slugged_name: 'meals', isTaxable: true, transaction_type: 0, is_fixed_taxes: false },
    { id: 4, name: 'Ground Transportation', slugged_name: 'ground', isTaxable: false, transaction_type: 0, is_fixed_taxes: false },
    { id: 5, name: 'Software', slugged_name: 'software', isTaxable: false, transaction_type: 0, is_fixed_taxes: false },
    { id: 6, name: 'Equipment', slugged_name: 'equipment', isTaxable: true, transaction_type: 0, is_fixed_taxes: false },
    { id: 7, name: 'Mileage', slugged_name: 'mileage', isTaxable: false, transaction_type: 0, is_fixed_taxes: false },
    { id: 8, name: 'Other', slugged_name: 'other', isTaxable: false, transaction_type: 0, is_fixed_taxes: false },
  ],
  expense_min_date_hard: '2025-01-01',
  expense_min_date_soft: '2025-01-01',
  expense_max_date: '2026-12-31',
  expense_types: [
    { id: 101, expense_type: 'Airfare', category: 1, receipt_min: 0, max_amount: '10000', allow_amount_above_max: false, assigned_rate: false, is_credit: false, linked_models: [], default_assigned_rate: '0', tax_type: null },
    { id: 102, expense_type: 'Lodging', category: 2, receipt_min: 0, max_amount: '5000', allow_amount_above_max: false, assigned_rate: false, is_credit: false, linked_models: [], default_assigned_rate: '0', tax_type: null },
    { id: 103, expense_type: 'Meals', category: 3, receipt_min: 0, max_amount: '500', allow_amount_above_max: true, assigned_rate: false, is_credit: false, linked_models: [], default_assigned_rate: '0', tax_type: null },
    { id: 104, expense_type: 'Ground Transportation', category: 4, receipt_min: 0, max_amount: '800', allow_amount_above_max: false, assigned_rate: false, is_credit: false, linked_models: [], default_assigned_rate: '0', tax_type: null },
    { id: 105, expense_type: 'Equipment', category: 6, receipt_min: 0, max_amount: '2500', allow_amount_above_max: false, assigned_rate: false, is_credit: false, linked_models: [], default_assigned_rate: '0', tax_type: null },
    { id: 106, expense_type: 'Mileage', category: 7, receipt_min: 0, max_amount: '999999', allow_amount_above_max: false, assigned_rate: true, is_credit: false, linked_models: [], default_assigned_rate: '0.58', tax_type: null },
  ],
  hide_receipt_unavailable: false,
  item_level_approval: true,
  is_approvable_status: true,
  display_approver_list: true,
  mileage_rules: { 2026: 10000, 2025: 10000 },
  rate_assignments: [] as unknown[],
  rate_assignment_dimensions: [] as string[],
  show_approver_override_warning: false,
  show_hired_candidate_link: true,
  show_candidate_link: false,
  show_vendor: true,
  show_vendor_link: true,
  show_program_team_entity: false,
  show_program_team_entity_link: false,
  show_status_field: false,
  can_read_billing_cycle: true,
}

const APPROVAL_TASK = {
  uuid: 'expense-task-ready-001',
  parent_uuid: 'wf-parent-expense',
  task_name: 'approval.expense.l1',
  state: TASK_READY,
  state_text: 'Ready',
  user: 10,
  name: 'James Employer',
  subname: 'james@cruisecorp.com',
  component_type: 'Expenses',
  component_id: EXPENSE_ID,
  reason: null,
  task_data: {
    email: 'james@cruisecorp.com',
    namespace: 'approval',
    approved: false,
    approver_email: 'james@cruisecorp.com',
  },
  can_approve: true,
  can_override_approve: false,
  tags: [] as string[],
  hide_approve_deny: false,
}

const approverRow = (params: {
  step: string
  userId: number
  name: string
  email: string
  type: 'and' | 'or'
  taskInstance: Record<string, unknown> | null
}) => ({
  step: params.step,
  user_id: params.userId,
  email: params.email,
  type: params.type,
  task_instance: params.taskInstance,
  approver_name: params.name,
})

const ALL_APPROVERS_BODY = {
  workflows: [
    {
      workflow_id: 88001,
      related_object: {
        id: EXPENSE_ID,
        display_id: 'EXP-1001',
        text: 'Travel & Entertainment',
        type: 'Expenses',
      },
      comments: [
        {
          id: 4401,
          comment_user: 'Sarah Manager',
          comment_user_id: 302,
          action: 'comment',
          comment: 'Airfare and hotel within policy; holding meals until itemization verified.',
          created_at: daysAgo(4),
          updated_at: daysAgo(4),
        },
      ],
      approvers: [
        {
          is_active: false,
          is_rejected: false,
          approval_group_name: '',
          and_approvers: [
            approverRow({
              step: 'Manager',
              userId: 302,
              name: 'Sarah Manager',
              email: 'sarah.manager@cruisecorp.com',
              type: 'and',
              taskInstance: {
                uuid: 'expense-task-done-302',
                parent_uuid: 'wf-parent-expense',
                task_name: 'approval.l1',
                state: 32,
                state_text: 'Completed',
                user: 302,
                name: 'Sarah Manager',
                subname: 'sarah.manager@cruisecorp.com',
                component_type: 'Expenses',
                component_id: EXPENSE_ID,
                reason: null,
                task_data: { approved: true, approval_timestamp: daysAgo(4) },
                can_approve: false,
                can_override_approve: false,
                tags: [],
                hide_approve_deny: false,
              },
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
              step: 'Finance BP',
              userId: 10,
              name: 'James Employer',
              email: 'james@cruisecorp.com',
              type: 'and',
              taskInstance: APPROVAL_TASK,
            }),
          ],
          or_approvers: [],
          optional_approvers: [],
        },
      ],
    },
  ],
}

const RELATED_INVOICE_LINES = [
  {
    charge_code_display_name: 'Engineering — Primary',
    time_type: 'Expense accrual',
    client_amount: '1245.00',
    vendor_amt_with_fees: null,
    tax_1_amt: '82.15',
    vendor_tax_amount: null,
    currency_code: 'USD',
    billing_cycle_start_date: '2026-02-01',
    billing_cycle_end_date: '2026-02-28',
    client_inv_number: 'INV-240891',
    is_deleted: false,
  },
  {
    charge_code_display_name: 'Engineering — Primary',
    time_type: 'Expense accrual',
    client_amount: '310.00',
    vendor_amt_with_fees: null,
    tax_1_amt: '20.44',
    vendor_tax_amount: null,
    currency_code: 'USD',
    billing_cycle_start_date: '2026-02-01',
    billing_cycle_end_date: '2026-02-28',
    client_inv_number: null,
    is_deleted: false,
  },
]

/**
 * Employer expense report detail (/expenses/view/:id).
 * Django template + ExpenseApp (webpack); requires VR_MODE=1 for HTML interception.
 */
export const expensesDetail: PageDefinition = {
  id: 'expenses-detail',
  name: 'Expense report detail',
  path: `/expenses/view/${EXPENSE_ID}/`,
  roles: ['employer'],
  fullPage: true,
  django: true,

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

    await page.route(`**/api/v2/expense-reports/${EXPENSE_ID}/`, (route) => {
      if (route.request().method() !== 'GET') {
        return route.continue()
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EXPENSE_REPORT),
      })
    })

    await page.route(`**/api/v2/expenses/report-config/${EXPENSE_ID}/`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EXPENSE_REPORT_CONFIG),
      })
    })

    await page.route((url) => {
      const u = url.toString()
      return (
        u.includes('/api/v2/expense-reports-approvals/') &&
        u.includes(`component_id=${EXPENSE_ID}`) &&
        !u.includes('all_approvers')
      )
    }, (route) => {
      if (route.request().method() !== 'GET') {
        return route.continue()
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([APPROVAL_TASK], { count: 1, limit: 50 })),
      })
    })

    await page.route((url) => {
      const u = url.toString()
      return u.includes('/api/v2/expense-reports-approvals/') && u.includes('all_approvers') && u.includes(`component_id=${EXPENSE_ID}`)
    }, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ALL_APPROVERS_BODY),
      })
    })

    await page.route((url) => {
      const u = url.toString()
      return u.includes('/api/v2/invoices/related-details/') && u.includes(`line_type_id=${EXPENSE_ID}`)
    }, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(RELATED_INVOICE_LINES, { count: 2, limit: 50 })),
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
        body: JSON.stringify(
          paginated([
            {
              id: 1,
              title: 'Approve expense EXP-1001',
              status: 1,
              due_date: daysAgo(-1),
              category: 'Expenses',
              priority: 'high',
            },
            {
              id: 2,
              title: 'Review timesheet for Bob Johnson',
              status: 1,
              due_date: daysAgo(-2),
              category: 'Timesheet',
              priority: 'medium',
            },
          ]),
        ),
      })
    })
  },
}
