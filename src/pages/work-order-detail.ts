import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow, dateOnly, TODAY } from '../mock-utils.js'
const START_DATE = dateOnly(daysAgo(90))
const END_DATE = dateOnly(daysFromNow(90))

/** Charge codes on the WO (WorkOrderNestedDataArray + ChargeCodeRawValues for forms). */
const MOCK_CHARGE_CODE_ROWS = [
  {
    id: 1001,
    tableId: 1,
    display_name: 'ENG-1000 — Engineering CapEx',
    fields: { cost_center: 'ENG-1000', gl_account: '6400-100' },
  },
  {
    id: 1002,
    tableId: 1,
    display_name: 'PROJ-4421 — Platform modernization',
    fields: { cost_center: 'PROJ-4421', gl_account: '6400-210' },
  },
]

const MOCK_CHECKLIST_ACTIONS = [
  {
    action_id: 'wo-1-jaa-501',
    id: 501,
    title: 'Background check — criminal',
    status: 6,
    renewal_date: null,
    subject_name: 'Jane Smith',
    checklist_id: 40,
    is_expiring_soon: false,
    checklist_type: 1,
  },
  {
    action_id: 'wo-1-jaa-502',
    id: 502,
    title: 'I-9 verification',
    status: 2,
    renewal_date: dateOnly(daysFromNow(14)),
    subject_name: 'Jane Smith',
    checklist_id: 41,
    is_expiring_soon: false,
    checklist_type: 1,
  },
  {
    action_id: 'wo-1-jaa-503',
    id: 503,
    title: 'Security awareness training',
    status: 6,
    renewal_date: null,
    subject_name: 'Jane Smith',
    checklist_id: 42,
    is_expiring_soon: true,
    checklist_type: 2,
  },
  {
    action_id: 'wo-1-jaa-504',
    id: 504,
    title: 'Hardware return acknowledgment',
    status: 2,
    renewal_date: dateOnly(daysFromNow(7)),
    subject_name: 'Jane Smith',
    checklist_id: 43,
    is_expiring_soon: false,
    checklist_type: 2,
  },
  {
    action_id: 'wo-1-jaa-505',
    id: 505,
    title: 'Client badge photo upload',
    status: 6,
    renewal_date: null,
    subject_name: 'Jane Smith',
    checklist_id: 44,
    is_expiring_soon: false,
    checklist_type: 1,
  },
]

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
      approvals: true, documents: true, vendors: true, users: true, expenses: true,
      bulk_updates: true, checklists: true, company_settings: true,
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

// WorkOrderConfigResponse — controls page header buttons, tab visibility, field permissions
const makeWoConfig = (isVendor: boolean) => ({
  can_view_vendor: true,
  has_active_approvals: false,
  pending_modification: false,
  ended: false,
  pull_request_id: undefined,
  contractor_has_monthly_timesheets: false,
  can_read_timesheet: true,
  can_read_scheduled_billing_transactions: false,
  contractor_timekeeping_settings: { show: true, edit: true },
  user_owns_and_manages_timesheet: false,
  can_change_primary: false,
  workday_enabled: false,
  display_calc_breakdown: false,
  provisioning_eligible: false,
  provisioned_in_workday: false,
  vendor_approval_enabled: false,
  actions: {
    wpm_collaborate: false,
    edit: { enabled: !isVendor, visible: !isVendor, description: 'Update Work Order' },
    end: { enabled: !isVendor, visible: !isVendor, description: 'End Work Order' },
  },
  budgets_enabled: true,
  comments: { view: true, create: !isVendor, external: false },
  revise: {
    dates: {
      start_date_perms: { show: true, edit: true },
      end_date_perms: { show: true, edit: true },
      end_date: END_DATE,
      end_time: '23:59',
      end_timezone: 'America/Los_Angeles',
      max_end_date: null,
      max_end_date_explanation: null,
      max_start_date: TODAY,
      max_start_date_explanation: null,
      min_end_date: START_DATE,
      min_start_date: START_DATE,
      wo_end_time_enabled: false,
      wo_max_duration_in_days: 730,
    },
    rates: {
      pay_rate: { show: true, edit: true },
      bill_rate: { show: true, edit: true },
      markup: { show: true, edit: true },
      overtime_markup: { show: false, edit: false },
      double_time_markup: { show: false, edit: false },
      calculation_pack: { show: false, edit: false },
      pay_parity_rate: { show: false, edit: false },
      min_hours: { show: false, edit: false },
      not_qualified_rate: { show: false, edit: false },
      currency_code: 'USD',
      max_start_date: TODAY,
      min_backdated_start_date: null,
      rate_suffix: '/hr',
      work_week_start_dow_iso: 7,
    },
    billing_cycle_def: { show: false, edit: false },
    fee_profile: { show: true, edit: true, min_backdated_start_date: null },
    calendar_pay_profile: { show: false, edit: false },
    charge_codes: {
      show: true,
      edit: true,
      config: {
        display: true,
        location: 'work_order',
        allow_multiple: true,
        display_mode: 'stacked',
        required: false,
        tokens: {},
      },
      timesheet_used_cc_ids: [1001],
      help_text: null,
    },
    custom_fields: { show: true, edit: true },
    shifts: { show: false, edit: false, backdate_shifts_edit: false, min_backdated_start_date: null },
    edit_resource_manager_with_org: false,
    business_unit: {
      business_unit: { show: true, edit: true },
      business_unit_transfer: { show: false, edit: false },
    },
    work_type_profiles: {
      work_type_profile_basic: { show: false, edit: false },
      work_type_profile: { show: true, edit: true },
      work_type_override: { show: true, edit: true },
    },
    work_week: { show: false, edit: false },
    work_hours_per_day: { show: false, edit: false },
    location: {
      location: { show: true, edit: true },
      location_overrides: { show: false, edit: false },
    },
    additional_managers: { show: true, edit: true },
    allow_negative_budget: false,
    attachments: { show: true, edit: true },
    budget: { show: true, edit: true, edit_labor_amount: true, config: { is_labor_amount_on_budget_overridden: false } },
    budget_allocation: { show: false, edit: false },
    purchase_order: { show: true, edit: true },
    event_based_expenses: { show: false, edit: false, required: false },
    exempt_status: { show: true, edit: false },
    expense_approvers: { show: true, edit: true },
    expense_type: { show: true, edit: false },
    external_id: { show: false, edit: false },
    hire_type: { show: true, edit: false },
    is_effective_dating_and_overriding_wtp_wt_allowed: false,
    job_template_job_type: { show: true, edit: true },
    job_code: { show: false, edit: false },
    job_site: { show: true, edit: true },
    latest_effective_date_for_non_backdating: TODAY,
    min_org_unit_level: 2,
    orientation_hours: { show: false, edit: false },
    low_census_limit_in_hours: { show: false, edit: false },
    overtime_profile: { show: true, edit: true },
    payments: { show: false, edit: false },
    premium_rate: { show: false, edit: false },
    program_team: { show: true, edit: true },
    program_team_entity: { show: false, edit: false },
    provisioning_eligible: { show: false, edit: false },
    reason_for_hire: { show: true, edit: false },
    resource_manager: { show: true, edit: true },
    scheduled_billing: { show: false, edit: false },
    source: { show: true, edit: false },
    tax_override: { show: false, edit: false },
    timekeeper: { show: false, edit: false },
    timesheet_approvers: { show: true, edit: true },
    timesheet_approver_2: { show: false, edit: false },
    title: { show: true, edit: true },
    vendor_wo_mod_rejection_reason: 'free_form',
    worker_classification: { show: true, edit: false },
    modification_reason: { show: true, edit: true },
    special_fields: {},
  },
  end: {
    can_cancel: true,
    can_delete_request: false,
    end_comments: { show: true, edit: true },
    is_end_assessment_applicable: false,
    end_reason_connector_json_form: {},
    earliest_end_date: TODAY,
    latest_end_date: END_DATE,
    cancel_alerts: [],
    end_alerts: [],
    show_do_not_rehire: true,
    end_work_order_details: {
      current: {
        end_date: END_DATE,
        end_time: null,
        end_datetime: null,
        end_timezone: null,
        end_reason_text: null,
        end_comments: null,
        has_end_instruction: false,
        do_not_rehire: false,
        do_not_rehire_until: null,
        do_not_rehire_comments: null,
        end_assessment: null,
        created_at: daysAgo(0),
        status: 'active',
      },
    },
    workday: null,
    end_banner: null,
    should_show_request_approvals_modal: false,
    approval_type: 'work_order_end',
  },
  reopen: { can_reopen: false, allow_negative_budget: false },
  contractor: { candidate_id: 101, contractor_profile: '/contractors/profile/101/' },
  show_rate_info_card: true,
  can_view_organization_unit: true,
  can_view_resource_manager: true,
  shifts_enabled: false,
  tabs: [
    { key: 'overview', href: '/work_orders/1/', title: 'Overview' },
    { key: 'activity', href: '/work_orders/1/?tab=activity', title: 'Activity' },
    { key: 'checklists', href: '/work_orders/1/?tab=checklists', title: 'Checklists' },
    { key: 'expenses', href: '/work_orders/1/expenses/', title: 'Expenses' },
  ],
  is_workorder_timekeeping_eligible: true,
  can_add_checklist_actions: false,
  is_monthly_timesheet_enabled: false,
  statement_of_work: null,
  banner_alert: undefined,
})

// WorkOrderCurrentData — the detailed view for editing/displaying
const WORK_ORDER_CURRENT = {
  id: 1,
  display_id: 'WO-2001',
  work_order_name: { title: 'Work Order Name', display: 'Senior Software Engineer' },
  title: { title: 'Title', display: 'Senior Software Engineer' },
  status: { title: 'Status', display: 'Active', raw_form_value: 7 },
  hire_type: { title: 'Hire Type', display: 'Contractor', raw_form_value: 2 },
  source: { title: 'Source Type', display: 'Supplier Sourced' },
  candidate: { title: 'Contractor', display: 'Jane Smith', raw_form_value: 101 },
  vendor: { title: 'Vendor', display: 'Acme Staffing', raw_form_value: 5 },
  start_date: { title: 'Start Date', display: 'Jan 4, 2025', raw_form_value: START_DATE },
  end_date: { title: 'End Date', display: 'Jul 2, 2025', raw_form_value: END_DATE },
  end_time: { title: 'End Time', display: null, raw_form_value: null },
  end_timezone: { title: 'End Timezone', display: null, raw_form_value: null },
  currency_code: { title: 'Currency', display: 'USD', raw_form_value: 'USD' },
  contract_pay_type: { title: 'Pay Type', display: 'Per Hour', raw_form_value: 1 },
  closest_range_key: START_DATE,
  program_rate_type: 'bill_rate',
  module: { title: 'Module', display: 'Contingent', raw_form_value: 0 },
  reason_for_hire: { title: 'Reason For Hire', display: 'New Headcount', raw_form_value: 1 },
  reason_for_hire_text: { title: 'Other Reason', display: null, raw_form_value: null },
  person_being_back_filled: { title: 'Person Being Back Filled', display: null, raw_form_value: null },
  expense_type: { title: 'Expense Type', display: 'Operational', raw_form_value: 1 },
  exempt_status: { title: 'Exempt Status', display: null, raw_form_value: null },
  provisioning_eligible: { title: 'Provisioning Eligible', display: 'No', raw_form_value: false },
  provisioning_types: { title: 'Provisioning Types', display: [], raw_form_value: [] },
  is_primary: { title: 'Is Primary', display: 'Yes' },
  client_contractor_id: { title: 'Client Contractor ID', display: null },
  contractor_system_id: { title: 'Contractor System ID', display: null, url: undefined },
  msp_contractor_id: { title: 'MSP Contractor ID', display: null },
  job_id: { title: 'Job', display: 'Engineering Job #123' },
  job_position_id: { title: 'Job Position ID', display: null },
  job_title: { title: 'Job Title', display: 'Senior Software Engineer', raw_form_value: 1 },
  hired_candidate_id: 101,
  first_offer_at: daysAgo(92),
  program_team_entity: { title: 'Program Team Entity', display: null, raw_form_value: null },
  rehire_eligible: { title: 'Rehire Eligible', display: 'Yes', raw_form_value: true },
  direct_hire_salary: { title: 'Direct Hire Salary', display: null, raw_form_value: null },
  low_census_limit_in_hours: { title: 'Low Census Limit', display: '0', raw_form_value: '0.0000000' },
  low_census_limit_in_hours_actuals: '0.0000000',
  orientation_hours: { title: 'Orientation Hours', display: '0', raw_form_value: '0.0000000' },
  orientation_hours_actuals: '0.0000000',
  created_by: { title: 'Created By', display: 'James Employer' },
  payments: [],
  payments_metadata: { payment_terms: 'weekly', payment_type_display: 'Standard' },
  procurement_data: null,
  budget: {
    current_budget_amount: { title: 'Current Budget', display: '$26,100.00' },
    remaining_budget_amount: { title: 'Remaining Budget', display: '$13,050.00' },
    labor_amount: { title: 'Labor Amount', display: '$22,185.00' },
    expense_amount: { title: 'Expense Amount', display: '$0.00' },
    tax_amount: { title: 'Tax Amount', display: '$0.00' },
    program_amount: { title: 'Program Amount', display: '$2,610.00' },
    other_fee: { title: 'Other Fee', display: '$1,305.00' },
    invoiced_amount: { title: 'Invoiced Amount', display: '$13,050.00' },
    committed_amount: { title: 'Committed Amount', display: '$26,100.00' },
  },
  budget_allocations: [],
  billing_cycle_def: { title: 'Billing Cycle', display: null },
  current_ot_dt_rates: { ot: [], dt: [] },
  revision_indicator: 'abc123',
  modification_status_message_key: null,
  workday: null,
  effective_dated_fields: [
    {
      start_date: START_DATE,
      end_date: END_DATE,
      organization_unit: { title: 'Business Unit', display: 'Engineering', raw_form_value: 10 },
      resource_manager: { title: 'Resource Manager', display: 'Alice Manager', raw_form_value: 201 },
      program_team: { title: 'Program Team', display: ['Alpha Team'], raw_form_value: [1] },
      timesheet_approvers: {
        title: 'Timesheet Approvers',
        display: ['Bob Approver'],
        raw_form_value: [301],
      },
      expense_approvers: {
        title: 'Expense Approvers',
        display: ['Carol Approver'],
        raw_form_value: [302],
      },
      timekeeper: { title: 'Timekeeper', display: ['Pat Timekeeper'], raw_form_value: [401] },
      additional_managers: { title: 'Additional Managers', display: ['Dan Lead', 'Erin PM'], raw_form_value: [402, 403] },
      location: {
        title: 'Location',
        display: 'San Francisco, CA, 94105, United States',
        raw_form_value: 50,
      },
      location_override: { title: 'Location Override', display: null, raw_form_value: null },
      job_site: { title: 'Job Site', display: 'Onsite', raw_form_value: 1 },
      bill_rate: {
        title: 'Bill Rate',
        display: 'USD 145.00/hr',
        raw_form_value: '145.0000000',
      },
      pay_rate: {
        title: 'Pay Rate',
        display: 'USD 108.00/hr',
        raw_form_value: '108.0000000',
      },
      vendor_rate: {
        title: 'Vendor Rate',
        display: 'USD 130.50/hr',
        raw_form_value: '130.5000000',
      },
      client_rate: {
        title: 'Client Rate',
        display: 'USD 145.00/hr',
        raw_form_value: '145.0000000',
      },
      markup: { title: 'Markup', display: '10%' },
      overtime_markup: { title: 'OT Markup', display: null },
      double_time_markup: { title: 'DT Markup', display: null },
      min_hours: { title: 'Min Hours', display: null },
      not_qualified_rate: { title: 'Not Qualified Rate', display: null },
      pay_parity_rate: { title: 'Pay Parity Rate', display: null, raw_form_value: null },
      premium_rate: { title: 'Premium Rate', display: null, raw_form_value: null },
      fee_structure_profile: {
        title: 'Fee Profile',
        display: 'Standard VMS Fee',
        raw_form_value: 1,
        url: '/fee_profile/program_fees/',
      },
      job_template: {
        title: 'Job Template',
        display: 'Senior Software Engineer',
        raw_form_value: 1,
      },
      job_template_job_type: {
        title: 'Job Type',
        display: 'Contract',
        raw_form_value: 1,
      },
      job_category: {
        title: 'Job Category',
        display: 'Software Engineering',
        raw_form_value: 1,
      },
      work_type_profile: {
        title: 'Work Type Profile',
        display: 'Standard',
        raw_form_value: 1,
      },
      work_type_overrides: {
        title: 'Work Type Overrides',
        display: ['Overtime ×1.5 (profile default)'],
        raw_form_value: [],
      },
      work_types: {
        title: 'Work Types',
        display: ['Regular — multiplier 1.0', 'Overtime — multiplier 1.5'],
        raw_form_value: [],
      },
      worker_classification: {
        title: 'Worker Classification',
        display: 'W-2 Employee',
        raw_form_value: 1,
      },
      charge_codes: {
        title: 'Charge Codes',
        display: MOCK_CHARGE_CODE_ROWS.map((r) => r.display_name),
        raw_form_value: MOCK_CHARGE_CODE_ROWS,
      },
      calculation_pack: { title: 'Calculation Pack', display: null },
      calculation_pack_timestamp: '',
      calendar_pay_profile: { title: 'Calendar Pay Profile', display: null, raw_form_value: null },
      overtime_profile: { title: 'OT Profile', display: 'Standard OT' },
      rate_calculator: { rate_calculator: '' },
      generic_fields: {},
      tax_override: { title: 'Tax Override', display: null, raw_form_value: null },
      work_week: { title: 'Work Week', display: null, raw_form_value: null },
      work_week_start_time: { title: 'Work Week Start Time', display: null, raw_form_value: null },
      work_days_per_week: { title: 'Work Days/Week', display: '5' },
      work_hours_per_day: { title: 'Work Hours/Day', display: '8' },
      work_hours_per_week: { title: 'Work Hours/Week', display: '40' },
      external_id: { title: 'External ID', display: null },
      hourly_rate_above_max: { title: 'Rate Above Max', display: null },
      job_site_display: 'Onsite',
      shift_strategy: { title: 'Shift Strategy', display: null },
      shifts: [],
      shift_differential_mapping: [],
      event_based_expenses: { title: 'Event Based Expenses', display: [], raw_form_value: [] },
      default_event_based_expense_cc: { title: 'Default CC', display: null, raw_form_value: null },
      billing_mode: { title: 'Billing Mode', display: null, raw_form_value: null },
      billing_schedule: { title: 'Billing Schedule', display: null, raw_form_value: null },
      special_fields: {},
    },
  ],
}

// WorkOrderDetail — the brief detail shape (used by useWorkOrderQuery)
const WORK_ORDER_DETAIL = {
  id: 1,
  display_id: 'WO-2001',
  title: 'Senior Software Engineer',
  currency_code: 'USD',
  hire_type: 2,
  hire_type_display: 'Contractor',
  end_date: END_DATE,
  start_date: START_DATE,
  client_contractor_id: null,
  status: 7,
  contractor_system_id: null,
  candidate_name: 'Jane Smith',
  client: 'Cruise Corp',
  vendor: 'Acme Staffing',
  bill_rate: '145.00',
  bill_rate_display: 'USD 145.00/hr',
  pay_type: 'Per Hour',
  business_unit: 'Engineering',
  work_site: 'San Francisco, CA',
  resource_manager: 'Alice Manager',
  first_vendor_payment: null,
  candidate_link: '/candidates/101/',
  last_vendor_payment: null,
  total_milestone_amount: 0,
  has_milestone_payments: false,
  annual_salary: null,
  msp_contractor_id: null,
  modification_status_message_key: null,
  source_type: 1,
  source_type_display: 'Supplier Sourced',
  wo_link: '/work_orders/1/',
  program_team: [{ full_name: 'Alpha Team' }],
  can_view_contractor_bill_rate: true,
  created_at: daysAgo(95),
  created_by: 'James Employer',
  event_based_expenses: [],
  default_event_based_expense_cc_data: {},
  display_shifts: false,
  shift_strategy: null,
  shift_strategy_display: null,
  shifts: null,
  generic_fields: {},
  reason_for_ending: null,
  ending_comments: null,
  effective_date_for_ending: null,
  billing_mode: null,
  billing_schedule: null,
}

// Work order general config (same as list page)
const WO_GENERAL_CONFIG = {
  can_view_contractor_bill_rate: true,
  can_view_organization_unit: true,
  can_view_resource_manager: true,
  can_view_attachments: true,
  can_view_vendors: true,
  can_bulk_update: true,
  outbound_provisioning_enabled: false,
  vendor_wo_mod_rejection_reason: 'free_form',
  is_effective_dating_and_overriding_wtp_wt_allowed: false,
  can_override_wo_max_duration: false,
  is_resource_manager_restricted_to_organization: false,
  is_auto_end_enabled: false,
  can_create_wpm_work_order: false,
  include_wpm: false,
  field_config: {
    additional_managers: { visible: true, required: false },
    resource_manager: { visible: true, required: true },
    program_team: { visible: true, required: false },
    timesheet_approvers: { visible: true, required: false, multiselect: true, display: true, optionSubLabel: 'email' },
    timekeeper: { visible: false, required: false },
    expense_approvers: { visible: true, required: false, multiselect: false, display: true, optionSubLabel: 'email' },
  },
  comments: { create: true, external: false },
}

/**
 * Shared Playwright route mocks for the work order detail + modify flows (same Next.js page).
 */
export async function setupWorkOrderDetailRoutes(page: Page, role: Role) {
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

    // Work order config — the big one that gates the whole page
    // Called as /api/v2/work-orders/1/config/
    await page.route(/.*\/api\/v2\/work-orders\/1\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeWoConfig(isVendor)),
      })
    })

    // Work order current — detailed view used for form/display
    await page.route(/.*\/api\/v2\/work-orders\/1\/current\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(WORK_ORDER_CURRENT),
      })
    })

    // Work order detail — brief shape used by useWorkOrderQuery
    await page.route(/.*\/api\/v2\/work-orders\/1\/?$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(WORK_ORDER_DETAIL),
      })
    })

    // Work orders general config (no ID — called for field visibility)
    await page.route(/.*\/api\/v2\/work-orders\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(WO_GENERAL_CONFIG),
      })
    })

    // Comments on the work order
    await page.route(/.*\/api\/v2\/work-orders\/1\/comments\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 1,
            created_by: 'James Employer',
            created_by_role: 'employer',
            comment: 'Extension approved — contractor performed exceptionally well on the ML pipeline.',
            created_at: daysAgo(5),
            updated_at: daysAgo(5),
            can_edit: true,
            can_delete: true,
            external: false,
            is_deleted: false,
            details: {},
          },
          {
            id: 2,
            created_by: 'Sarah Vendor',
            created_by_role: 'vendor',
            comment: 'Thank you! Jane is available for the extension through Q3.',
            created_at: daysAgo(4),
            updated_at: daysAgo(4),
            can_edit: false,
            can_delete: false,
            external: true,
            is_deleted: false,
            details: {},
          },
          {
            id: 3,
            created_by: 'Alice Manager',
            created_by_role: 'employer',
            comment: 'Please ensure the security clearance form is submitted before the extension start date.',
            created_at: daysAgo(2),
            updated_at: daysAgo(2),
            can_edit: true,
            can_delete: true,
            external: false,
            is_deleted: false,
            details: {},
          },
        ])),
      })
    })

    // Attachments — must include file_name and extension (DocumentAccordion calls doc.extension.toUpperCase())
    await page.route(/.*\/api\/v2\/work-orders\/1\/attachments\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 1,
            file_name: 'Contract_Amendment_Q3.pdf',
            extension: 'pdf',
            url: '#',
            created_at: daysAgo(10),
            created_by: 'James Employer',
            file_size: 145000,
          },
        ])),
      })
    })

    // Activity log (infinite query)
    await page.route(/.*\/api\/v2\/work-orders\/1\/activity\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, user: 'James Employer', action: 'Work order created', timestamp: daysAgo(90), details: '' },
          { id: 2, user: 'Sarah Vendor', action: 'Jane Smith assigned as contractor', timestamp: daysAgo(89), details: '' },
          { id: 3, user: 'James Employer', action: 'Work order activated', timestamp: daysAgo(88), details: '' },
          { id: 4, user: 'Alice Manager', action: 'Bill rate updated to USD 145.00/hr', timestamp: daysAgo(30), details: '' },
        ])),
      })
    })

    // Scheduled bills — checked by useScheduledBillingData; revise.scheduled_billing.show=false so this won't run
    // but mock it anyway for safety
    await page.route(/.*\/api\/v2\/scheduled_bills\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    // Approvers list — only shown when has_active_approvals=true (we set it false)
    // But mock anyway in case of race conditions
    await page.route(/.*\/api\/v2\/work_order_approvals\/all_approvers\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ workflows: [], allApprovalsAreComplete: true, workflowsHaveRejections: false }),
      })
    })

    // Workflow log — shown when pull_request_id is set (it's not, but mock anyway)
    await page.route(/.*\/api\/v2\/workflow_log\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    // Worker provisioning actions card (in right sidebar if checklists tab config is set)
    await page.route(/.*\/api\/v2\/worker_provisioning\/actions\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    // Checklist actions — for the right sidebar card
    await page.route(/.*\/api\/v2\/checklist.actions\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
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

    // User tasks (nav drawer)
    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, title: 'Review timesheet for Jane Smith', status: 1, due_date: daysFromNow(2), category: 'Timesheet', priority: 'high' },
          { id: 2, title: 'Approve work order modification', status: 1, due_date: daysFromNow(1), category: 'Work Order', priority: 'medium' },
        ])),
      })
    })

    // Approval manager — called by timesheetApprover2 if show is true (it's not)
    await page.route('**/approval-manager/get-wf-approvals', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ approvers: [] }) })
    })

    // Generic fields context — called if business_unit + location are set
    await page.route(/.*\/api\/v2\/generic_fields\/form_context\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fields: [], meta: {} }),
      })
    })

    // Workday contingent enabled
    await page.route('**/api/v2/connectors/workday/contingent-enabled', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      })
    })

    // Dated details — used by the form sections (per-date rate history)
    await page.route(/.*\/api\/v2\/work-orders\/1\/dated-details\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            calculation_pack: null,
            calculation_pack_id: null,
            currency_code: 'USD',
            fee_profile: 'Standard VMS Fee',
            budget: '26100.00',
            start_date: START_DATE,
            end_date: END_DATE,
            original_end_date: END_DATE,
            pay_rate: { currency: 'USD', value: '108.00', type: 'money' },
            bill_rate: { currency: 'USD', value: '145.00', type: 'money' },
            min_hours: null,
            not_qualified_rate: null,
            max_hours: null,
            hourly_rate_above_max: null,
            client_rate: { currency: 'USD', value: '145.00', type: 'money' },
            vendor_rate: { currency: 'USD', value: '130.50', type: 'money' },
            markup_percentage: 10,
            rate_calculator: { rate_calculator: '' },
            rate_calculations: {},
            rate_suffix: '/hr',
            contract_pay_type: null,
            fees: null,
            shift_strategy: null,
            shifts: [],
          },
        ]),
      })
    })

    // Revision details — modification history (WorkOrderRevisionsData)
    await page.route(/.*\/api\/v2\/work-orders\/1\/revision-details\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 3003,
            submitted_by: 'Alice Manager',
            submitted_on: daysAgo(12),
            status: 6,
            status_display: 'Completed',
            revision: 3,
            revision_reason_display: 'Rate correction',
            notes: 'Align bill rate with approved SOW tier after Q1 rate card update.',
            end_date: END_DATE,
            previous_end_date: END_DATE,
            bill_rate: '145.0000000',
            previous_bill_rate: '140.0000000',
            pay_rate: '108.0000000',
            previous_pay_rate: '105.0000000',
            approved_on: daysAgo(11),
          },
          {
            id: 3002,
            submitted_by: 'James Employer',
            submitted_on: daysAgo(45),
            status: 6,
            status_display: 'Completed',
            revision: 2,
            revision_reason_display: 'Extend assignment',
            notes: 'Extend through Q3 for platform migration; budget re-approved.',
            end_date: END_DATE,
            previous_end_date: dateOnly(daysAgo(30)),
            bill_rate: '140.0000000',
            previous_bill_rate: '140.0000000',
            pay_rate: '105.0000000',
            previous_pay_rate: '105.0000000',
            approved_on: daysAgo(44),
          },
          {
            id: 3001,
            submitted_by: 'Sarah Vendor',
            submitted_on: daysAgo(88),
            status: 6,
            status_display: 'Completed',
            revision: 1,
            revision_reason_display: 'Initial onboarding',
            notes: 'Original WO terms at start of engagement.',
            end_date: dateOnly(daysAgo(30)),
            previous_end_date: dateOnly(daysAgo(30)),
            bill_rate: '140.0000000',
            previous_bill_rate: null,
            pay_rate: '105.0000000',
            previous_pay_rate: null,
            approved_on: daysAgo(87),
          },
        ]),
      })
    })

    // Budget
    await page.route(/.*\/budget\/work_order\/1/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          current_budget_amount: '26100.00',
          remaining_budget_amount: '13050.00',
          labor_amount: '22185.00',
          expense_amount: '0.00',
          tax_amount: '0.00',
          program_amount: '2610.00',
          other_fee: '1305.00',
          invoiced_amount: '13050.00',
          committed_amount: '26100.00',
          currency_code: 'USD',
        }),
      })
    })

    // Work types for work type profile
    await page.route(/.*\/api\/v2\/work-orders\/1\/work-types\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Regular', rate_type: 1, rate_type_display: 'Multiplier', multiplier: '1.0000000', classification: 'regular', estimated_rate: '145.00', is_multiplier_override: false },
          { id: 2, name: 'Overtime', rate_type: 1, rate_type_display: 'Multiplier', multiplier: '1.5000000', classification: 'overtime', estimated_rate: '217.50', is_multiplier_override: false },
        ]),
      })
    })

    // Job titles — individual title lookup
    await page.route(/.*\/api\/v2\/job_titles\/titles\/\d+/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, title: 'Senior Software Engineer', description: '' }),
      })
    })

    // Reason for hire datasource
    await page.route(/.*\/api\/v2\/customization\/datasources\/job_reason_for_hire\/rows\/\d+/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, display: 'New Headcount', value: 'New Headcount' }),
      })
    })

    // Business units — config endpoint
    await page.route('**/api/v2/business_units/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ min_level: 2, max_level: 4 }),
      })
    })

    // Business units — individual BU lookup
    await page.route(/.*\/api\/v2\/business_units\/\d+\/?$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 10,
          name: 'Engineering',
          code: 'ENG',
          level: 2,
          parent: 1,
          ancestors: [{ id: 1, name: '_ROOT', level: 0 }],
          children: [],
          has_access: true,
          has_descendant_access: true,
          time_keeping: true,
          is_deleted: false,
          generic_fields: {},
          connector_settings: { workday: { is_position_management_model: false } },
        }),
      })
    })

    // Business units — list
    await page.route(/.*\/api\/v2\/business_units\/\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 10, name: 'Engineering', code: 'ENG', level: 2, parent: 1 },
          { id: 11, name: 'Product', code: 'PROD', level: 2, parent: 1 },
          { id: 12, name: 'Finance', code: 'FIN', level: 2, parent: 1 },
        ])),
      })
    })

    // Generic form schema for work_order namespace (GenericFormRJSF shape)
    await page.route(/.*\/api\/v2\/generic_form\/schema\/work_order\/work_order\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'work_order',
          namespace: 'work_order',
          display_name: 'Work Order',
          rjsf: {
            data_schema: { type: 'object', required: [], properties: {} },
            ui_schema: {},
            ui_rules: [],
          },
        }),
      })
    })

    // Generic form schema for budget_calculator (GenericFormRJSF shape)
    await page.route(/.*\/api\/v2\/generic_form\/schema\/budget_calculator\/budget_calculator\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 2,
          name: 'budget_calculator',
          namespace: 'budget_calculator',
          display_name: 'Budget Calculator',
          rjsf: {
            data_schema: { type: 'object', required: [], properties: {} },
            ui_schema: {},
            ui_rules: [],
          },
        }),
      })
    })

    // Generic form context for work_order
    await page.route(/.*\/api\/v2\/generic_form_context\/work_order\/work_order\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fields: [], meta: { charge_codes: {} } }),
      })
    })

    // Hired candidate timekeeping overrides (must include an effective_range that spans "today" for display)
    await page.route(/.*\/api\/v2\/hired_candidate\/\d+\/timekeeping-overrides/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            timesheet_type: 'time in/out',
            timesheet_classification: 'manual',
            work_week_start_day: 0,
            work_week_start_time: '00:00',
            force_current_time_for_vendor: false,
            force_current_time_for_contractor: false,
            use_dst: true,
            view_shifts: false,
            block_insufficient_overtime: false,
            disable_time_import_validations: false,
            unit_of_time: 'hours',
            timesheet_period: 'week',
            non_working_days: [5, 6],
            effective_range: { start_date: START_DATE, end_date: END_DATE },
            ts_affected_by_wwst_adjustment: [],
          },
          {
            id: 2,
            timesheet_type: 'summary',
            timesheet_classification: 'auto',
            work_week_start_day: 6,
            work_week_start_time: '08:00',
            force_current_time_for_vendor: false,
            force_current_time_for_contractor: false,
            use_dst: false,
            view_shifts: false,
            block_insufficient_overtime: false,
            disable_time_import_validations: false,
            unit_of_time: 'hours',
            timesheet_period: 'week',
            non_working_days: null,
            effective_range: { start_date: dateOnly(daysFromNow(30)), end_date: dateOnly(daysFromNow(365)) },
            ts_affected_by_wwst_adjustment: [],
          },
        ]),
      })
    })

    // Timekeeping settings context — required for ContractorTimeKeepingSettings display (not empty state)
    await page.route('**/api/v2/timekeeping/settings-context', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          show_dst: true,
          show_force_current_time: true,
          show_general_section: true,
          can_edit_tk_settings: true,
          hide_manager_is_not_time_approver: false,
          configured_rules: [],
          classify_clocks: true,
        }),
      })
    })

    // Timekeeping timesheet types (values must match TimesheetType enum strings for labels)
    await page.route('**/api/v2/timekeeping/timesheet-types', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Time In/Out', value: 'time in/out' },
          { id: 2, name: 'Summary', value: 'summary' },
          { id: 3, name: 'Clock + Assign', value: 'clock+assign' },
        ]),
      })
    })

    // Job application actions — overview sidebar card + Checklists tab
    await page.route(/.*\/api\/v2\/job_application_actions\/\?/, (route) => {
      const url = new URL(route.request().url())
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const limit = Number(url.searchParams.get('limit') ?? '10') || 10
      const woId = url.searchParams.get('work_order_id')
      const items = woId === '1' ? MOCK_CHECKLIST_ACTIONS : []
      const slice = items.slice(offset, offset + limit)
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated(slice, { count: items.length, limit, offset }),
        ),
      })
    })

    // Workflow approval config
    await page.route(/.*\/api\/v2\/workflow_approval_config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ show_overridable: false }),
      })
    })
}

/**
 * Work Order Detail page (/work_orders/1/)
 *
 * Shows the detail view for a single active work order:
 * - Header: breadcrumbs, WO title + status badge + display ID, contractor/vendor subtext
 * - Tab bar: Overview, Activity, Checklists, Expenses
 * - Key Info Cards: Managers, Dates (with progress bar), Rates, Location
 * - Overview form: General, Duration, Rates, Managers, Business Unit, Budget, etc.
 * - Right sidebar: Comments
 */
export const workOrderDetail: PageDefinition = {
  id: 'work-order-detail',
  name: 'Work Order Detail',
  path: '/work_orders/1/',
  roles: ['employer', 'vendor'],
  fullPage: true,
  setup: setupWorkOrderDetailRoutes,
}
