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

// Work order general config — controls which filters/buttons are visible
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
    timesheet_approvers: { visible: true, required: false },
    timekeeper: { visible: false, required: false },
    expense_approvers: { visible: true, required: false },
  },
  comments: { create: true, external: false },
}

const makeWorkOrder = (
  id: number,
  title: string,
  status: number,
  opts: Record<string, any> = {}
) => ({
  id,
  title,
  status,
  display_id: `WO-${id}`,
  wo_link: `/work_orders/${id}`,
  candidate_name: opts.candidate_name ?? null,
  candidate_link: opts.candidate_link ?? null,
  vendor: opts.vendor ?? null,
  bill_rate: opts.bill_rate ?? 95,
  bill_rate_display: opts.bill_rate_display ?? `$${opts.bill_rate ?? 95}.00`,
  annual_salary: opts.annual_salary ?? null,
  can_view_contractor_bill_rate: opts.can_view_contractor_bill_rate ?? true,
  pay_type: opts.pay_type ?? 'Per Hour',
  currency_code: opts.currency_code ?? 'USD',
  hire_type: opts.hire_type ?? 2,  // 2 = contractor
  source_type: opts.source_type ?? 1,  // 1 = supplier_sourced
  source_type_display: opts.source_type_display ?? 'Supplier sourced',
  start_date: opts.start_date ?? daysAgo(30),
  end_date: opts.end_date ?? daysFromNow(150),
  business_unit: opts.business_unit ?? 'Engineering',
  resource_manager: opts.resource_manager ?? 'Alice Manager',
  work_site: opts.work_site ?? 'San Francisco, CA',
  program_team: opts.program_team ?? [],
  program_team_entity_name: opts.program_team_entity_name ?? null,
  client: opts.client ?? 'Cruise Corp',
  client_contractor_id: opts.client_contractor_id ?? null,
  contractor_system_id: opts.contractor_system_id ?? null,
  msp_contractor_id: opts.msp_contractor_id ?? null,
  modification_status: opts.modification_status ?? null,
  modification_status_message_key: opts.modification_status_message_key ?? null,
  first_vendor_payment: opts.first_vendor_payment ?? null,
  last_vendor_payment: opts.last_vendor_payment ?? null,
  has_milestone_payments: opts.has_milestone_payments ?? false,
  total_milestone_amount: opts.total_milestone_amount ?? 0,
  provisioning_eligible: opts.provisioning_eligible ?? false,
  is_bulk_eligible: opts.is_bulk_eligible ?? true,
  created_at: opts.created_at ?? daysAgo(30),
  updated_at: opts.updated_at ?? daysAgo(1),
})

// 14 work orders with varied statuses, types, vendors
const WORK_ORDERS_EMPLOYER = [
  makeWorkOrder(2001, 'Senior Software Engineer', 7 /* ACTIVE */, {
    candidate_name: 'Jane Smith', candidate_link: '/candidates/101',
    vendor: 'Acme Staffing', bill_rate: 145, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'San Francisco, CA', resource_manager: 'Alice Manager',
    program_team: [{ full_name: 'Alpha Team' }], start_date: daysAgo(90), end_date: daysFromNow(90),
    created_at: daysAgo(95),
  }),
  makeWorkOrder(2002, 'Data Engineer', 7 /* ACTIVE */, {
    candidate_name: 'Bob Johnson', candidate_link: '/candidates/102',
    vendor: 'TechBridge Solutions', bill_rate: 125, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Austin, TX', resource_manager: 'Bob Director',
    start_date: daysAgo(60), end_date: daysFromNow(120),
    created_at: daysAgo(65),
  }),
  makeWorkOrder(2003, 'UX Designer', 7 /* ACTIVE */, {
    candidate_name: 'Maria Garcia', candidate_link: '/candidates/103',
    vendor: 'Acme Staffing', bill_rate: 95, source_type: 3, source_type_display: 'Directed',
    work_site: 'Remote', resource_manager: 'Carol Lead',
    modification_status: 'vendor_approval_pending',
    modification_status_message_key: 'work_order.status_display_name.vendor_approval_pending',
    start_date: daysAgo(45), end_date: daysFromNow(135),
    created_at: daysAgo(50),
  }),
  makeWorkOrder(2004, 'DevOps Engineer', 7 /* ACTIVE */, {
    candidate_name: 'Tom Williams', candidate_link: '/candidates/104',
    vendor: 'GlobalTech Recruiting', bill_rate: 135, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Chicago, IL', resource_manager: 'Alice Manager',
    start_date: daysAgo(15), end_date: daysFromNow(165),
    created_at: daysAgo(20),
  }),
  makeWorkOrder(2005, 'Product Manager', 2 /* APPROVAL_PENDING */, {
    vendor: 'TechBridge Solutions', bill_rate: 130, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'New York, NY', resource_manager: 'Dave VP',
    start_date: daysFromNow(14), end_date: daysFromNow(194),
    created_at: daysAgo(2),
  }),
  makeWorkOrder(2006, 'Security Engineer', 7 /* ACTIVE */, {
    candidate_name: 'Lisa Chen', candidate_link: '/candidates/106',
    vendor: 'CyberTalent Inc', bill_rate: 155, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Washington, DC', resource_manager: 'Dave VP',
    start_date: daysAgo(120), end_date: daysFromNow(60),
    created_at: daysAgo(125),
  }),
  makeWorkOrder(2007, 'QA Engineer', 6 /* READY_TO_ONBOARD */, {
    vendor: 'Acme Staffing', bill_rate: 100, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Seattle, WA', resource_manager: 'Carol Lead',
    start_date: daysFromNow(7), end_date: daysFromNow(187),
    created_at: daysAgo(10),
  }),
  makeWorkOrder(2008, 'Financial Analyst', 8 /* ENDED */, {
    candidate_name: 'Kevin Brown', candidate_link: '/candidates/108',
    vendor: 'FinTalent Group', bill_rate: 90, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Denver, CO', resource_manager: 'Emma Finance',
    start_date: daysAgo(365), end_date: daysAgo(10),
    created_at: daysAgo(370),
  }),
  makeWorkOrder(2009, 'Cloud Architect', 7 /* ACTIVE */, {
    candidate_name: 'Sarah Kim', candidate_link: '/candidates/109',
    vendor: 'TechBridge Solutions', bill_rate: 175, source_type: 2, source_type_display: 'Payrolled',
    work_site: 'San Francisco, CA', resource_manager: 'Bob Director',
    start_date: daysAgo(180), end_date: daysFromNow(30),
    created_at: daysAgo(185),
  }),
  makeWorkOrder(2010, 'HR Coordinator', 9 /* CANCELLED */, {
    vendor: 'HR Experts LLC', bill_rate: 75, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Miami, FL', resource_manager: 'Alice Manager',
    start_date: daysAgo(90), end_date: daysAgo(30),
    created_at: daysAgo(95),
  }),
  makeWorkOrder(2011, 'Marketing Manager', 4 /* ACCEPTED */, {
    vendor: 'MarketPro Staffing', bill_rate: 110, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Boston, MA', resource_manager: 'Emma Finance',
    start_date: daysFromNow(21), end_date: daysFromNow(201),
    created_at: daysAgo(5),
  }),
  makeWorkOrder(2012, 'Data Scientist', 7 /* ACTIVE */, {
    candidate_name: 'Alex Rivera', candidate_link: '/candidates/112',
    vendor: 'DataTalent Co', bill_rate: 160, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Remote', resource_manager: 'Carol Lead',
    start_date: daysAgo(60), end_date: daysFromNow(120),
    created_at: daysAgo(65),
    modification_status: 'internal_approval_pending',
    modification_status_message_key: 'work_order.status_display_name.internal_approval_pending',
  }),
  makeWorkOrder(2013, 'Business Analyst', 3 /* SUBMITTED */, {
    vendor: 'Acme Staffing', bill_rate: 85, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Atlanta, GA', resource_manager: 'Dave VP',
    start_date: daysFromNow(30), end_date: daysFromNow(210),
    created_at: daysAgo(3),
  }),
  makeWorkOrder(2014, 'Scrum Master', 7 /* ACTIVE */, {
    candidate_name: 'Diana Patel', candidate_link: '/candidates/114',
    vendor: 'AgileForce Solutions', bill_rate: 115, source_type: 3, source_type_display: 'Directed',
    work_site: 'Chicago, IL', resource_manager: 'Alice Manager',
    start_date: daysAgo(200), end_date: daysFromNow(10),
    created_at: daysAgo(205),
  }),
]

// Vendor sees only their own company's work orders
const WORK_ORDERS_VENDOR = [
  makeWorkOrder(2001, 'Senior Software Engineer', 7 /* ACTIVE */, {
    candidate_name: 'Jane Smith', candidate_link: '/candidates/101',
    vendor: 'Acme Staffing', bill_rate: 145, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'San Francisco, CA', resource_manager: 'Alice Manager',
    start_date: daysAgo(90), end_date: daysFromNow(90),
    created_at: daysAgo(95),
  }),
  makeWorkOrder(2003, 'UX Designer', 7 /* ACTIVE */, {
    candidate_name: 'Maria Garcia', candidate_link: '/candidates/103',
    vendor: 'Acme Staffing', bill_rate: 95, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Remote', resource_manager: 'Carol Lead',
    modification_status: 'vendor_approval_pending',
    modification_status_message_key: 'work_order.status_display_name.vendor_approval_pending',
    start_date: daysAgo(45), end_date: daysFromNow(135),
    created_at: daysAgo(50),
  }),
  makeWorkOrder(2007, 'QA Engineer', 6 /* READY_TO_ONBOARD */, {
    vendor: 'Acme Staffing', bill_rate: 100, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Seattle, WA', resource_manager: 'Carol Lead',
    start_date: daysFromNow(7), end_date: daysFromNow(187),
    created_at: daysAgo(10),
  }),
  makeWorkOrder(2013, 'Business Analyst', 3 /* SUBMITTED */, {
    vendor: 'Acme Staffing', bill_rate: 85, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Atlanta, GA', resource_manager: 'Dave VP',
    start_date: daysFromNow(30), end_date: daysFromNow(210),
    created_at: daysAgo(3),
  }),
  makeWorkOrder(2010, 'HR Coordinator', 9 /* CANCELLED */, {
    vendor: 'Acme Staffing', bill_rate: 75, source_type: 1, source_type_display: 'Supplier sourced',
    work_site: 'Miami, FL', resource_manager: 'Alice Manager',
    start_date: daysAgo(90), end_date: daysAgo(30),
    created_at: daysAgo(95),
  }),
]

// Visible fields config for work_order namespace — defines which columns show in list items
const VISIBLE_FIELDS_WO = {
  client_data: {
    title: 'Work Order List Data (Client View)',
    default_fields: [
      { blocked: false, display_order: 1, value: true, position: 'attributes_column', icon: 'Person', key: 'candidate_name', label: 'Contractor Name' },
      { blocked: false, display_order: 2, value: true, position: 'attributes_column', icon: 'Dollars', key: 'bill_rate', label: 'Bill Rate' },
      { blocked: false, display_order: 3, value: true, position: 'attributes_column', icon: 'Location', key: 'work_site', label: 'Location' },
      { blocked: false, display_order: 4, value: true, position: 'attributes_column', icon: 'DateRange', key: 'end_date', label: 'End Date' },
      { blocked: false, display_order: 5, value: true, position: 'attributes_column', icon: 'Person', key: 'resource_manager', label: 'Resource Manager' },
      { blocked: false, display_order: 6, value: true, position: 'attributes_column', icon: 'Company', key: 'vendor', label: 'Vendor' },
    ],
    fields: [],
  },
  vendor_data: {
    title: 'Work Order List Data (Vendor View)',
    default_fields: [
      { blocked: false, display_order: 1, value: true, position: 'attributes_column', icon: 'Person', key: 'candidate_name', label: 'Contractor Name' },
      { blocked: false, display_order: 2, value: true, position: 'attributes_column', icon: 'Dollars', key: 'bill_rate', label: 'Bill Rate' },
      { blocked: false, display_order: 3, value: true, position: 'attributes_column', icon: 'Location', key: 'work_site', label: 'Location' },
      { blocked: false, display_order: 4, value: true, position: 'attributes_column', icon: 'DateRange', key: 'end_date', label: 'End Date' },
    ],
    fields: [],
  },
}

/**
 * Work Orders list page (/work_orders/all)
 * Tier 1 — shows a paginated, filterable list of work orders.
 *
 * Employer: full list with bulk update, vendor column, org unit filter, modification badges.
 * Vendor: filtered to their own company's work orders.
 */
export const workOrders: PageDefinition = {
  id: 'work-orders',
  name: 'Work Orders',
  path: '/work_orders/all',
  roles: ['employer', 'vendor'],
  fullPage: true,

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

    // Work orders general config — used on page load to determine visible filters/buttons
    // Also called as /api/v2/work-orders/config/ from the spec file
    await page.route(/.*\/api\/v2\/work-orders\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(WO_GENERAL_CONFIG),
      })
    })

    // Work orders list — main data
    await page.route(/.*\/api\/v2\/work-orders\/\?/, (route) => {
      const workOrders = isVendor ? WORK_ORDERS_VENDOR : WORK_ORDERS_EMPLOYER
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(workOrders)),
      })
    })

    // Work orders bulk eligible IDs (for bulk update bar)
    await page.route(/.*\/api\/v2\/work-orders\/bulk_eligible_ids/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([2001, 2002, 2003, 2004, 2005, 2006, 2007, 2009, 2011, 2012, 2013, 2014]),
      })
    })

    // Jobs config — controls program_team visibility in filters
    await page.route('**/api/v2/jobs/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_program_team_visible: true,
          can_view_calculation_pack: false,
          is_business_unit_visible: true,
        }),
      })
    })

    // Workday contingent enabled — controls Integrations filter visibility
    await page.route('**/api/v2/connectors/workday/contingent-enabled', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      })
    })

    // Multi PMO enabled — controls program_team_entity filter
    await page.route('**/api/v2/program-team/multi_pmo_enabled/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
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

    // Resource managers filter
    await page.route('**/api/v2/employer_manager**', (route) => {
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

    // Vendor entities filter (employer only)
    await page.route('**/api/v2/vendor_entities**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 5,
          results: [
            { id: 5, company_name: 'Acme Staffing' },
            { id: 6, company_name: 'TechBridge Solutions' },
            { id: 7, company_name: 'GlobalTech Recruiting' },
            { id: 8, company_name: 'CyberTalent Inc' },
            { id: 9, company_name: 'DataTalent Co' },
          ],
        }),
      })
    })

    // Pay types filter
    await page.route('**/api/v2/jobs/pay_types**', (route) => {
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

    // Job titles / template search filter
    await page.route('**/api/v2/job_titles/title_search**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 4,
          results: [
            { id: 1, title: 'Senior Software Engineer' },
            { id: 2, title: 'Data Engineer' },
            { id: 3, title: 'UX Designer' },
            { id: 4, title: 'DevOps Engineer' },
          ],
        }),
      })
    })

    // Connectors / integrations filter
    await page.route('**/api/v2/connectors/work-order-filters**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      })
    })

    // Calculation pack options filter
    await page.route('**/api/calculation_engine/calculation_pack_options/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      })
    })

    // Program team select (for program_team_entity filter when multi-PMO enabled)
    await page.route('**/api/v2/program-team/select/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      })
    })

    // User preferences — saved filters for work_order namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=saved_filters.*namespace=work_order/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // User preferences — visible fields for work_order namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=visible_fields.*namespace=work_order/, (route) => {
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

    // Visible fields settings for work_order namespace
    await page.route(/.*\/api\/v2\/settings\/visible_fields_defaults\/?\?.*namespace=work_order/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(VISIBLE_FIELDS_WO),
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
          { id: 1, title: 'Review timesheet for Bob Johnson', status: 1, due_date: daysFromNow(2), category: 'Timesheet', priority: 'high' },
          { id: 2, title: 'Approve work order modification', status: 1, due_date: daysFromNow(1), category: 'Work Order', priority: 'medium' },
          { id: 3, title: 'Review invoice #INV-5678', status: 1, due_date: daysFromNow(3), category: 'Invoice', priority: 'low' },
        ])),
      })
    })
  },
}
