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

// status: 1=Draft, 2=Submitted, 3=Approved, 4=Rejected
const makeExpense = (
  id: number,
  title: string,
  status: number,
  opts: Record<string, any> = {}
) => ({
  id,
  title,
  status,
  expense_number: `EXP-${1000 + id}`,
  created_at: opts.created_at ?? daysAgo(30),
  updated_at: opts.updated_at ?? daysAgo(5),
  last_submitted_time: opts.last_submitted_time ?? (status >= 2 ? daysAgo(10) : null),
  approval_time: opts.approval_time ?? (status === 3 ? daysAgo(2) : null),
  total_amount: opts.total_amount ?? 500.0,
  total_approved_amount: opts.total_approved_amount ?? (status === 3 ? opts.total_amount ?? 500.0 : 0),
  currency_code: opts.currency_code ?? 'USD',
  candidate_name: opts.candidate_name ?? 'Jane Smith',
  candidate_id: opts.candidate_id ?? 101,
  vendor_name: opts.vendor_name ?? 'Acme Staffing',
  vendor_entity_id: opts.vendor_entity_id ?? 5,
  business_unit_name: opts.business_unit_name ?? 'Engineering',
  work_order_id: opts.work_order_id ?? null,
  work_order_display_id: opts.work_order_display_id ?? null,
  approvers: opts.approvers ?? ['Sarah Manager'],
  report_type: opts.report_type ?? { id: 1, purpose: 0, name: 'Standard Expense' },
  is_bulk_eligible: opts.is_bulk_eligible ?? (status === 2),
})

const EXPENSES = [
  makeExpense(1, 'Q1 Travel - New York Client Visit', 2 /* Submitted */, {
    total_amount: 1842.50,
    candidate_name: 'Jane Smith',
    vendor_name: 'Acme Staffing',
    business_unit_name: 'Engineering',
    work_order_id: 2001,
    work_order_display_id: 'WO-2001',
    approvers: ['Sarah Manager', 'Mike Director'],
    created_at: daysAgo(14),
    last_submitted_time: daysAgo(12),
    report_type: { id: 1, purpose: 0, name: 'Travel' },
  }),
  makeExpense(2, 'Software Subscriptions - March', 3 /* Approved */, {
    total_amount: 349.00,
    total_approved_amount: 349.00,
    candidate_name: 'Bob Johnson',
    vendor_name: 'TechBridge Solutions',
    business_unit_name: 'Engineering',
    approvers: ['Sarah Manager'],
    created_at: daysAgo(20),
    last_submitted_time: daysAgo(18),
    approval_time: daysAgo(15),
    report_type: { id: 2, purpose: 0, name: 'Software' },
    is_bulk_eligible: false,
  }),
  makeExpense(3, 'Conference Registration - TechConf 2026', 2 /* Submitted */, {
    total_amount: 2200.00,
    candidate_name: 'Maria Garcia',
    vendor_name: 'GlobalTech Recruiting',
    business_unit_name: 'Product',
    work_order_id: 2003,
    work_order_display_id: 'WO-2003',
    approvers: ['Mike Director'],
    created_at: daysAgo(8),
    last_submitted_time: daysAgo(6),
    report_type: { id: 1, purpose: 0, name: 'Travel' },
  }),
  makeExpense(4, 'Office Supplies Q1', 3 /* Approved */, {
    total_amount: 183.75,
    total_approved_amount: 183.75,
    candidate_name: 'Tom Williams',
    vendor_name: 'DataTalent Co',
    business_unit_name: 'Operations',
    approvers: ['Lisa Director'],
    created_at: daysAgo(35),
    last_submitted_time: daysAgo(30),
    approval_time: daysAgo(25),
    report_type: { id: 3, purpose: 0, name: 'Office Supplies' },
    is_bulk_eligible: false,
  }),
  makeExpense(5, 'Client Entertainment - Dinner', 4 /* Rejected */, {
    total_amount: 620.00,
    candidate_name: 'Lisa Chen',
    vendor_name: 'CyberTalent Inc',
    business_unit_name: 'Sales',
    approvers: ['Chris VP'],
    created_at: daysAgo(25),
    last_submitted_time: daysAgo(22),
    report_type: { id: 4, purpose: 0, name: 'Entertainment' },
    is_bulk_eligible: false,
  }),
  makeExpense(6, 'Training Materials - AWS Certification', 1 /* Draft */, {
    total_amount: 450.00,
    candidate_name: 'Kevin Brown',
    vendor_name: 'TechBridge Solutions',
    business_unit_name: 'Engineering',
    approvers: [],
    created_at: daysAgo(3),
    last_submitted_time: null,
    report_type: { id: 5, purpose: 0, name: 'Training' },
    is_bulk_eligible: false,
  }),
  makeExpense(7, 'Remote Work Equipment', 3 /* Approved */, {
    total_amount: 1250.00,
    total_approved_amount: 1100.00,
    candidate_name: 'Sarah Kim',
    vendor_name: 'AgileForce Solutions',
    business_unit_name: 'Engineering',
    approvers: ['Sarah Manager'],
    created_at: daysAgo(45),
    last_submitted_time: daysAgo(40),
    approval_time: daysAgo(35),
    report_type: { id: 6, purpose: 0, name: 'Equipment' },
    is_bulk_eligible: false,
  }),
  makeExpense(8, 'Q1 Mileage Reimbursement', 2 /* Submitted */, {
    total_amount: 287.40,
    candidate_name: 'Alex Rivera',
    vendor_name: 'Acme Staffing',
    business_unit_name: 'Sales',
    work_order_id: 2012,
    work_order_display_id: 'WO-2012',
    approvers: ['Chris VP'],
    created_at: daysAgo(7),
    last_submitted_time: daysAgo(5),
    report_type: { id: 7, purpose: 0, name: 'Mileage' },
  }),
  makeExpense(9, 'Misc Adjustment - Dec Invoice', 3 /* Approved */, {
    total_amount: 750.00,
    total_approved_amount: 750.00,
    candidate_name: 'Diana Patel',
    vendor_name: 'DataTalent Co',
    business_unit_name: 'Finance',
    approvers: ['Sarah Manager'],
    created_at: daysAgo(50),
    last_submitted_time: daysAgo(48),
    approval_time: daysAgo(44),
    report_type: { id: 8, purpose: 1, name: 'Misc Adjustment' },
    is_bulk_eligible: false,
  }),
  makeExpense(10, 'Recruiting Event Fees', 1 /* Draft */, {
    total_amount: 950.00,
    candidate_name: 'James Carter',
    vendor_name: 'GlobalTech Recruiting',
    business_unit_name: 'HR',
    approvers: [],
    created_at: daysAgo(1),
    last_submitted_time: null,
    report_type: { id: 1, purpose: 0, name: 'Travel' },
    is_bulk_eligible: false,
  }),
  makeExpense(11, 'Vendor Onsite Visit - Chicago', 2 /* Submitted */, {
    total_amount: 1680.00,
    candidate_name: 'Emily Zhao',
    vendor_name: 'CyberTalent Inc',
    business_unit_name: 'Product',
    work_order_id: 2020,
    work_order_display_id: 'WO-2020',
    approvers: ['Mike Director'],
    created_at: daysAgo(11),
    last_submitted_time: daysAgo(9),
    report_type: { id: 1, purpose: 0, name: 'Travel' },
  }),
  makeExpense(12, 'Cloud Infrastructure Fees', 4 /* Rejected */, {
    total_amount: 3200.00,
    candidate_name: 'Marcus Lee',
    vendor_name: 'AgileForce Solutions',
    business_unit_name: 'Engineering',
    approvers: ['Lisa Director'],
    created_at: daysAgo(18),
    last_submitted_time: daysAgo(16),
    report_type: { id: 2, purpose: 0, name: 'Software' },
    is_bulk_eligible: false,
  }),
]

const EXPENSE_REPORT_TYPES = {
  count: 8,
  results: [
    { id: 1, name: 'Travel', purpose: 0, is_active: true },
    { id: 2, name: 'Software', purpose: 0, is_active: true },
    { id: 3, name: 'Office Supplies', purpose: 0, is_active: true },
    { id: 4, name: 'Entertainment', purpose: 0, is_active: true },
    { id: 5, name: 'Training', purpose: 0, is_active: true },
    { id: 6, name: 'Equipment', purpose: 0, is_active: true },
    { id: 7, name: 'Mileage', purpose: 0, is_active: true },
    { id: 8, name: 'Misc Adjustment', purpose: 1, is_active: true },
  ],
}

const EXPENSE_CATEGORIES = [
  { id: 1, name: 'Airfare' },
  { id: 2, name: 'Hotel' },
  { id: 3, name: 'Meals' },
  { id: 4, name: 'Ground Transportation' },
  { id: 5, name: 'Software / Subscriptions' },
  { id: 6, name: 'Office Supplies' },
  { id: 7, name: 'Entertainment' },
  { id: 8, name: 'Training & Education' },
]

const EXPENSE_RULES = {
  count: 4,
  results: [
    { id: 1, expense_type: 'Per Diem' },
    { id: 2, expense_type: 'Fixed Rate' },
    { id: 3, expense_type: 'Actual' },
    { id: 4, expense_type: 'Mileage Rate' },
  ],
}

const BUSINESS_UNITS = {
  count: 6,
  results: [
    { id: 1, name: 'Engineering', level: 2, children: [], path_segments: [{ id: 1, name: 'Engineering' }] },
    { id: 2, name: 'Product', level: 2, children: [], path_segments: [{ id: 2, name: 'Product' }] },
    { id: 3, name: 'Sales', level: 2, children: [], path_segments: [{ id: 3, name: 'Sales' }] },
    { id: 4, name: 'Operations', level: 2, children: [], path_segments: [{ id: 4, name: 'Operations' }] },
    { id: 5, name: 'Finance', level: 2, children: [], path_segments: [{ id: 5, name: 'Finance' }] },
    { id: 6, name: 'HR', level: 2, children: [], path_segments: [{ id: 6, name: 'HR' }] },
  ],
}

const BUSINESS_UNIT_LEVELS = [
  { id: 1, name: 'Company', level: 1 },
  { id: 2, name: 'Department', level: 2 },
]

const BUSINESS_UNIT_CONFIG = {
  display_name: 'Business Unit',
  level_label: 'Level',
  max_level: 2,
}

/**
 * Expenses list page (/expenses)
 * Tier 2 — employer only.
 *
 * Shows a paginated, filterable list of expense reports with status badges
 * (Draft, Submitted, Approved, Rejected), candidate names, vendor, amounts, report types.
 */
export const expenses: PageDefinition = {
  id: 'expenses',
  name: 'Expenses',
  path: '/expenses',
  roles: ['employer'],
  fullPage: true,

  async setup(page: Page, _role: Role) {
    // Account me — employer only
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

    // Expense list config — controls "Add New" and "Bulk Upload" buttons
    await page.route('**/api/v2/expenses/list-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_create_expense_report: true,
          can_bulk_upload_expense: true,
          user_role: 'employer',
          expense_report_types: EXPENSE_REPORT_TYPES.results,
          is_multiple_program_entities_enabled: false,
        }),
      })
    })

    // Expense permissions — controls bulk approve button
    await page.route('**/api/v2/expense-reports-approvals/expense_permissions**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ allow_bulk_approvals: true }),
      })
    })

    // Expense reports list — main data
    await page.route(/.*\/api\/v2\/expense-reports\/\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(EXPENSES)),
      })
    })

    // Approvable expense IDs (for bulk select checkboxes)
    await page.route(/.*\/api\/v2\/expense-reports\/approvable_ids/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([1, 3, 8, 11]),
      })
    })

    // Filter: Report Type options
    await page.route('**/api/v2/expense-settings/expense-report-types**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EXPENSE_REPORT_TYPES),
      })
    })

    // Filter: Category options (old endpoint)
    await page.route('**/expenses-settings/expenses/categories**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EXPENSE_CATEGORIES),
      })
    })

    // Filter: Expense rules / item types
    await page.route('**/api/v2/expense-rules**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EXPENSE_RULES),
      })
    })

    // Filter: Vendor entities
    await page.route('**/api/v2/vendor_entities**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 6,
          results: [
            { id: 5, company_name: 'Acme Staffing' },
            { id: 6, company_name: 'TechBridge Solutions' },
            { id: 7, company_name: 'GlobalTech Recruiting' },
            { id: 8, company_name: 'CyberTalent Inc' },
            { id: 9, company_name: 'DataTalent Co' },
            { id: 10, company_name: 'AgileForce Solutions' },
          ],
        }),
      })
    })

    // Business units list (used by BU picker filter)
    await page.route(/.*\/api\/v2\/business_units\/\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BUSINESS_UNITS),
      })
    })

    // Business unit levels
    await page.route('**/api/v2/business_unit_levels/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BUSINESS_UNIT_LEVELS),
      })
    })

    // Business unit config
    await page.route('**/api/v2/business_units/config**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BUSINESS_UNIT_CONFIG),
      })
    })

    // User preferences — saved filters for expense namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=saved_filters.*namespace=expense/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // User preferences — visible fields for expense namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=visible_fields.*namespace=expense/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
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

    // Visible fields settings for expense namespace
    await page.route(/.*\/api\/v2\/settings\/visible_fields_defaults\/?\?.*namespace=expense/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    // Work orders config (shared ResultsLayout component reference)
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

    // Contact us config
    await page.route('**/api/contact-us-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
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
          { id: 3, title: 'Review expense #EXP-1001', status: 1, due_date: daysAgo(0), category: 'Expenses', priority: 'high' },
        ])),
      })
    })
  },
}
