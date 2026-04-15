import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { daysAgo as _daysAgo, daysFromNow as _daysFromNow, dateOnly } from '../mock-utils.js'

const daysAgo = (n: number) => dateOnly(_daysAgo(n))
const daysFromNow = (n: number) => dateOnly(_daysFromNow(n))

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
      sow: true,
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
    more_menu: { approvals: true, documents: true, sow: true },
  },
}

// SOW user context — matches what Django passes via {{ user_context|json_script:"data" }}
const makeSowUserContext = (isVendor: boolean) => ({
  is_change_orders_enabled: true,
  is_sow_connector_enabled: false,
  is_fast_path_enabled: false,
  is_vendor: isVendor,
  secondary_display_label_for_users: '',
  employer_role: isVendor ? null : 'employer',
  is_candidate: false,
  user_id: isVendor ? 20 : 10,
  user_bu_id: isVendor ? null : 1,
  sow_roles: [
    { role_uuid: 'sow-manager-uuid', label: 'Manager', type: 'sow_participant_role' },
    { role_uuid: 'sow-editor-uuid', label: 'Editor', type: 'sow_participant_role' },
    { role_uuid: 'sow-viewer-uuid', label: 'Viewer', type: 'sow_participant_role' },
    { role_uuid: 'sow-contributor-uuid', label: 'Contributor', type: 'sow_participant_role' },
    { role_uuid: 'sow-financial-uuid', label: 'View Financial', type: 'view_financial' },
    { role_uuid: 'sow-confidential-uuid', label: 'View Confidential Sections', type: 'view_confidential_sections' },
  ],
  permissions: {
    can_create: !isVendor,
    can_edit: true,
    can_edit_participants: true,
    can_edit_financials: true,
    can_read_financials: true,
    can_manage: true,
    can_accept: true,
    can_approve: true,
    can_onboard: true,
    can_create_co: true,
    can_view_reports: true,
    can_admin_settings: !isVendor,
    can_manage_attachments: true,
    can_adjust_payments: true,
    can_view_organization_unit: true,
    can_view_vendors: !isVendor,
    can_update_organization_unit: !isVendor,
    can_read_calculation_pack: false,
  },
})

// SOW user context for the API call (slightly different shape from what's embedded in HTML)
const makeSowApiUserContext = (isVendor: boolean) => ({
  user_context: {
    generic_forms: [],
    is_scheduled_payment_approval_enabled: false,
    is_tax_override_enabled: false,
    is_sow_connector_enabled: false,
    is_vendor: isVendor,
    is_charge_codes_edit_allowed: false,
    is_cascade_charge_codes_enabled: false,
    is_payment_charge_code_allocation_enabled: false,
    is_workday_enabled: false,
    has_multi_currency_enabled: false,
    outbound_enabled: false,
    provisioning_eligible_default: false,
    provisioning_types: [],
    secondary_display_label_for_users: '',
    remove_sow_role_org_unit_restriction: false,
    automatically_close_sow: false,
    days_before_planned_end_date_to_notify: 30,
    permissions: {
      can_create: !isVendor,
      can_edit: true,
      can_edit_participants: true,
      can_edit_financials: true,
      can_read_financials: true,
      can_manage: true,
      can_accept: true,
      can_approve: true,
      can_onboard: true,
      can_create_co: true,
      can_view_reports: true,
      can_admin_settings: !isVendor,
      can_manage_attachments: true,
      can_adjust_payments: true,
      can_view_organization_unit: true,
      can_view_vendors: !isVendor,
      can_update_organization_unit: !isVendor,
      can_read_calculation_pack: false,
    },
  },
})

// Factory for a SOW list item
const makeSow = (
  id: number,
  title: string,
  stateDisplay: string,
  opts: Record<string, any> = {}
) => ({
  id,
  id_display: `SOW-${id}`,
  state: opts.state ?? 35,
  state_display: stateDisplay,
  default_schedule_payment_invoice_type: 1,
  default_schedule_payment_invoice_type_updated_at: daysAgo(30),
  workflows: [],
  _active_version: {
    id: id * 10,
    title,
    planned_start_date: opts.start_date ?? daysAgo(60),
    planned_end_date: opts.end_date ?? daysFromNow(120),
    business_unit: opts.business_unit_id ?? 1,
    business_unit_name: opts.business_unit_name ?? 'Engineering',
    vendor: opts.vendor_id ?? null,
    vendor_name: opts.vendor_name ?? null,
    currency_code: 'USD',
    multiple_payment_type: opts.payment_types ?? [{ id: 1, payment_type: 'Milestone' }],
    multiple_payment_type_names: opts.payment_type_names ?? 'Milestone',
    client_project_manager_name: opts.manager ?? 'James Employer',
    worksites: [],
  },
})

const SOW_LIST_EMPLOYER = [
  makeSow(101, 'Cloud Infrastructure Modernization', 'Active', {
    state: 35,
    vendor_id: 5, vendor_name: 'Acme Staffing',
    business_unit_id: 1, business_unit_name: 'Engineering',
    payment_type_names: 'Milestone',
    manager: 'Alice Manager',
    start_date: daysAgo(90), end_date: daysFromNow(90),
  }),
  makeSow(102, 'Data Platform Build-Out', 'Active', {
    state: 35,
    vendor_id: 6, vendor_name: 'TechBridge Solutions',
    business_unit_id: 2, business_unit_name: 'Data & Analytics',
    payment_type_names: 'Time & Materials',
    manager: 'Bob Director',
    start_date: daysAgo(45), end_date: daysFromNow(135),
  }),
  makeSow(103, 'Security Audit & Remediation', 'Awaiting Client Review', {
    state: 10,
    vendor_id: 7, vendor_name: 'CyberTalent Inc',
    business_unit_id: 1, business_unit_name: 'Engineering',
    payment_type_names: 'Fixed Price',
    manager: 'Alice Manager',
    start_date: daysFromNow(14), end_date: daysFromNow(104),
  }),
  makeSow(104, 'HR Systems Integration', 'Draft', {
    state: 1,
    vendor_id: 8, vendor_name: 'GlobalTech Recruiting',
    business_unit_id: 3, business_unit_name: 'Human Resources',
    payment_type_names: 'Milestone',
    manager: 'Carol Lead',
    start_date: daysFromNow(30), end_date: daysFromNow(210),
  }),
  makeSow(105, 'Marketing Analytics Dashboard', 'Active', {
    state: 35,
    vendor_id: 9, vendor_name: 'DataTalent Co',
    business_unit_id: 4, business_unit_name: 'Marketing',
    payment_type_names: 'Time & Materials',
    manager: 'Dave VP',
    start_date: daysAgo(120), end_date: daysFromNow(60),
  }),
  makeSow(106, 'Mobile App Redesign', 'Pending Approvals', {
    state: 30,
    vendor_id: 5, vendor_name: 'Acme Staffing',
    business_unit_id: 5, business_unit_name: 'Product',
    payment_type_names: 'Fixed Price',
    manager: 'Alice Manager',
    start_date: daysFromNow(7), end_date: daysFromNow(97),
  }),
  makeSow(107, 'ERP Migration Phase 2', 'Active', {
    state: 35,
    vendor_id: 6, vendor_name: 'TechBridge Solutions',
    business_unit_id: 1, business_unit_name: 'Engineering',
    payment_type_names: 'Milestone, Time & Materials',
    manager: 'Bob Director',
    start_date: daysAgo(200), end_date: daysFromNow(30),
  }),
  makeSow(108, 'Compliance Training Program', 'Closed', {
    state: 65,
    vendor_id: 10, vendor_name: 'HR Experts LLC',
    business_unit_id: 3, business_unit_name: 'Human Resources',
    payment_type_names: 'Milestone',
    manager: 'Emma Finance',
    start_date: daysAgo(365), end_date: daysAgo(10),
  }),
  makeSow(109, 'BI Reporting Suite', 'Awaiting Vendor Review', {
    state: 5,
    vendor_id: 9, vendor_name: 'DataTalent Co',
    business_unit_id: 2, business_unit_name: 'Data & Analytics',
    payment_type_names: 'Fixed Price',
    manager: 'Dave VP',
    start_date: daysFromNow(21), end_date: daysFromNow(111),
  }),
  makeSow(110, 'Legacy System Decommission', 'Closure Initiated', {
    state: 64,
    vendor_id: 6, vendor_name: 'TechBridge Solutions',
    business_unit_id: 1, business_unit_name: 'Engineering',
    payment_type_names: 'Time & Materials',
    manager: 'Carol Lead',
    start_date: daysAgo(300), end_date: daysAgo(5),
  }),
  makeSow(111, 'Customer Portal v2', 'Active', {
    state: 35,
    vendor_id: 11, vendor_name: 'AgileForce Solutions',
    business_unit_id: 5, business_unit_name: 'Product',
    payment_type_names: 'Milestone',
    manager: 'Alice Manager',
    start_date: daysAgo(30), end_date: daysFromNow(150),
  }),
  makeSow(112, 'Finance Reporting Automation', 'Cancelled', {
    state: 50,
    vendor_id: 12, vendor_name: 'FinTalent Group',
    business_unit_id: 6, business_unit_name: 'Finance',
    payment_type_names: 'Fixed Price',
    manager: 'Emma Finance',
    start_date: daysAgo(90), end_date: daysAgo(30),
  }),
]

const SOW_LIST_VENDOR = SOW_LIST_EMPLOYER.filter(sow =>
  [101, 102, 106, 107, 111].includes(sow.id)
)

const sowListResponse = (sows: any[]) => ({
  results: sows,
  count: sows.length,
  offset: 0,
  next_params: null,
  previous_params: null,
})

/**
 * SOW list page (/sow/)
 * Tier 3 — paginated, filterable list of Statements of Work.
 *
 * Django page (sow/sow-app.html) — loads the sow webpack bundle, embeds user_context JSON,
 * calls renderSOWApp('sow-app'). We intercept the document and serve mock HTML.
 *
 * Employer: full list with Create SOW button, vendor/org-unit filters, varied statuses.
 * Vendor: filtered to their own SOWs only, no create button.
 */
export const sow: PageDefinition = {
  id: 'sow',
  name: 'SOW List',
  path: '/sow/',
  roles: ['employer', 'vendor'],
  fullPage: true,
  django: true,

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

    // SOW product profile check — must return true or page shows 404
    await page.route('**/api/v2/sow-module/sow/is-sow-profile-active/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ is_sow_profile_active: true }),
      })
    })

    // SOW user context — called by useUserContextQuery(undefined, forceEnable=true)
    await page.route(/.*\/api\/v2\/sow-module\/sow\/get-user-context\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeSowApiUserContext(isVendor)),
      })
    })

    // SOW list — main data (called by sowApi.get via useSOWFilterStore)
    await page.route(/.*\/api\/v2\/sow-module\/sow\/\?/, (route) => {
      const sows = isVendor ? SOW_LIST_VENDOR : SOW_LIST_EMPLOYER
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sowListResponse(sows)),
      })
    })

    // SOW payment types — filter sidebar Payment Type options
    await page.route('**/api/v2/sow-module/sow/payment_types/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { payment: { id: 0, payment_type: 'Fixed Price' } },
            { payment: { id: 1, payment_type: 'Time & Materials' } },
            { payment: { id: 2, payment_type: 'Milestone' } },
            { payment: { id: 5, payment_type: 'Unit Price' } },
          ],
        }),
      })
    })

    // Change orders summary — tab indicator badge count
    await page.route('**/api/v2/sow-module/change-orders/cos-summary', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { state: 5, count: 3, state_display: 'Awaiting Client Review' },
          { state: 3, count: 1, state_display: 'Awaiting Vendor Review' },
          { state: 9, count: 2, state_display: 'Pending Approvals' },
          { state: 10, count: 8, state_display: 'Approved' },
        ]),
      })
    })

    // SOW project managers — filter sidebar SOW Manager options
    await page.route(/.*\/api\/v2\/sow-module\/project-managers\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { user: 1, participant_full_name: 'Alice Manager', participant_email: 'alice@cruisecorp.com' },
          { user: 2, participant_full_name: 'Bob Director', participant_email: 'bob@cruisecorp.com' },
          { user: 3, participant_full_name: 'Carol Lead', participant_email: 'carol@cruisecorp.com' },
          { user: 4, participant_full_name: 'Dave VP', participant_email: 'dave@cruisecorp.com' },
          { user: 5, participant_full_name: 'Emma Finance', participant_email: 'emma@cruisecorp.com' },
        ]),
      })
    })

    // Vendors summaries — filter sidebar Vendor options (employer only)
    await page.route(/.*\/api\/v1\/vendors\/summaries\/?\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 7,
          results: [
            { entity_id: 5, name: 'Acme Staffing' },
            { entity_id: 6, name: 'TechBridge Solutions' },
            { entity_id: 7, name: 'CyberTalent Inc' },
            { entity_id: 8, name: 'GlobalTech Recruiting' },
            { entity_id: 9, name: 'DataTalent Co' },
            { entity_id: 10, name: 'HR Experts LLC' },
            { entity_id: 11, name: 'AgileForce Solutions' },
          ],
        }),
      })
    })

    // SOW sow_configuration settings — program_team label and visibility
    await page.route(/.*\/api\/v2\/settings\/sow\/sow_configuration\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          program_team: { display: true, label: 'Program Team' },
        }),
      })
    })

    // Program team filter options
    await page.route(/.*\/api\/v2\/employer_manager\/?\?.*type=program_team/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 3,
          results: [
            { id: 10, full_name: 'Alpha PMO' },
            { id: 11, full_name: 'Beta PMO' },
            { id: 12, full_name: 'Gamma PMO' },
          ],
        }),
      })
    })

    // Business units / org unit filter
    await page.route('**/api/v2/business_units/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 6,
          results: [
            { id: 1, name: 'Engineering' },
            { id: 2, name: 'Data & Analytics' },
            { id: 3, name: 'Human Resources' },
            { id: 4, name: 'Marketing' },
            { id: 5, name: 'Product' },
            { id: 6, name: 'Finance' },
          ],
        }),
      })
    })

    // User preferences — saved filters for SOW namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=saved_filters.*namespace=sow/, (route) => {
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
        body: JSON.stringify({
          count: 2,
          results: [
            { id: 1, title: 'Review SOW milestone payment', status: 1, due_date: '2026-04-07', category: 'SOW', priority: 'high' },
            { id: 2, title: 'Approve change order #CO-45', status: 1, due_date: '2026-04-05', category: 'SOW', priority: 'medium' },
          ],
        }),
      })
    })
  },
}
