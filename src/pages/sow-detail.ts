import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo as _daysAgo, daysFromNow as _daysFromNow, dateOnly } from '../mock-utils.js'

/** Keep in sync with `vr_django/contexts/sow_detail.py` SOW_DETAIL_PK */
const SOW_ID = 1
const VERSION_ID = 10

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
      can_update_eligible_for_provisioning: !isVendor,
    },
  },
})

const wf = (name: string, enabled = true) => ({
  name,
  enabled,
  limited_to_fields: [] as string[],
  unmet_prerequisites: [] as unknown[],
})

/** Active SOW with milestone + time & materials — drives dashboard overview tab, header actions, payment tabs. */
const makeSowDetailPayload = (isVendor: boolean) => ({
  id: SOW_ID,
  id_display: 'SOW-001',
  state: 35,
  state_display: 'Active',
  is_vendor_side: isVendor,
  is_editable_state: false,
  is_administration_editable_state: true,
  is_this_sow_fast_path: false,
  is_budget_allocation_enabled: false,
  has_approval_task: false,
  has_changes_to_review: false,
  accepts_payments: true,
  evisort_processing_status: null,
  default_schedule_payment_invoice_type: 1,
  default_schedule_payment_invoice_type_updated_at: daysAgo(20),
  program_team: [] as number[],
  program_team_names: [] as string[],
  version_ids: [VERSION_ID],
  approved_version_id: VERSION_ID,
  transition_data: {},
  version_has_changes: false,
  version_number: 1,
  min_planned_end_date: daysFromNow(30),
  effective_end_datetime: null,
  payment_end_datetime: null,
  update_dates_for_roles_and_work_orders: false,
  workflows: [
    wf('create_change_order'),
    wf('close_sow'),
    wf('duplicate_sow'),
    wf('cancel_sow'),
    wf('reopen_sow'),
    wf('create_sow_milestone'),
    wf('create_sow_fixed_price'),
  ],
  _active_version: {
    id: VERSION_ID,
    title: 'Cloud Infrastructure Modernization',
    description:
      'Modernize core platform services, migrate legacy workloads, and establish SRE runbooks for production support.',
    planned_start_date: daysAgo(60),
    planned_end_date: daysFromNow(120),
    actual_start_date: daysAgo(55),
    actual_end_date: null,
    business_unit: 1,
    business_unit_name: 'Engineering',
    is_business_unit_inactive: false,
    vendor: 5,
    vendor_name: 'Acme Staffing',
    client_name: 'Cruise Corp',
    client_project_manager: 10,
    vendor_project_manager: 501,
    client_project_manager_user_id: 10,
    currency_code: 'USD',
    multiple_payment_type: [2, 1],
    payment_type: 2,
    component_instance: 500,
    track_non_billable_workers: false,
    worksites: [1],
    billable_work_type_profile: 1,
    non_billable_work_type_profile: null,
    budget_details: {
      planned_sow_amount: '250000.00',
      committed_amount: '85000.00',
      remaining_sow_amount: '165000.00',
      planned_labor_amount: '180000.00',
      planned_expense_amount: '70000.00',
      actual_labor_amount: '42000.00',
      actual_expense_amount: '12000.00',
      remaining_labor_amount: '138000.00',
      remaining_expense_amount: '58000.00',
      externally_invoiced_amount: '0.00',
    },
    updated_by: 'James Employer',
    updated_at: daysAgo(2) + 'T15:30:00Z',
  },
})

const MOCK_PARTICIPANTS = [
  {
    id: 9001,
    employer: 10,
    participant_full_name: 'James Employer',
    participant_email: 'james@cruisecorp.com',
    participant_contact_number: '+1-555-0100',
    is_project_manager: true,
    profile_pic: null,
    roles: [{ role_uuid: 'sow-manager-uuid', type: 'sow_participant_role' }],
    custom_fields: {},
    secondary_display_label: null,
  },
  {
    id: 9002,
    employer: 11,
    participant_full_name: 'Pat Producer',
    participant_email: 'pat@cruisecorp.com',
    participant_contact_number: null,
    is_project_manager: false,
    profile_pic: null,
    roles: [{ role_uuid: 'sow-editor-uuid', type: 'sow_participant_role' }],
    custom_fields: {},
    secondary_display_label: null,
  },
]

const MOCK_MILESTONE_ROWS = [
  {
    id: 8801,
    id_display: 'MS-08801',
    title: 'Discovery & architecture',
    state: 40,
    state_display: 'Approved',
    planned_amount: '45000.00',
    workflows: [],
  },
  {
    id: 8802,
    id_display: 'MS-08802',
    title: 'Implementation phase 1',
    state: 20,
    state_display: 'In progress',
    planned_amount: '120000.00',
    workflows: [],
  },
  {
    id: 8803,
    id_display: 'MS-08803',
    title: 'Go-live & handoff',
    state: 5,
    state_display: 'Not started',
    planned_amount: '85000.00',
    workflows: [],
  },
]

/**
 * SOW detail (/sow/1/) — Django `sow-app.html` + webpack SOWApp (Reach router), not Next.js.
 * Default tab for Active SOW is dashboard (`SOWDashboard`).
 */
export const sowDetail: PageDefinition = {
  id: 'sow-detail',
  name: 'SOW Detail',
  path: `/sow/${SOW_ID}/`,
  roles: ['employer', 'vendor'],
  fullPage: true,
  django: true,

  async setup(page: Page, role: Role) {
    const isVendor = role === 'vendor'
    const sowBody = JSON.stringify(makeSowDetailPayload(isVendor))

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

    await page.route('**/api/v2/nav/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isVendor ? NAV_CONFIG_VENDOR : NAV_CONFIG_EMPLOYER),
      })
    })

    await page.route('**/api/v2/client/feature-flags/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exclude_fees_in_sow_payments_taxes: false,
          is_new_milestone_and_fixed_price_ui_enabled: true,
          is_split_cc_for_milestone_and_fixed_price_enabled: false,
        }),
      })
    })

    await page.route('**/api/v2/sow-module/sow/is-sow-profile-active/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ is_sow_profile_active: true }),
      })
    })

    await page.route(/.*\/api\/v2\/sow-module\/sow\/get-user-context\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeSowApiUserContext(isVendor)),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/?$`), (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      route.fulfill({ status: 200, contentType: 'application/json', body: sowBody })
    })

    await page.route(`**/api/v2/sow-module/sow/${SOW_ID}/vendor-users/**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 501,
              vendor_profile_name: 'Alex Vendor PM',
              email: 'alex@acmestaffing.com',
              contact_number: '+1-555-0200',
              vendor_role: 'Admin',
              user: 501,
              secondary_display_label: null,
            },
          ],
        }),
      })
    })

    await page.route('**/api/v2/sow-module/work-types-profiles/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, title: 'Professional — IT' },
          { id: 2, title: 'Professional — Finance' },
        ]),
      })
    })

    await page.route(`**/api/v2/sow-module/sow/${SOW_ID}/charge-codes/**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          charge_codes: [
            {
              id: 1,
              display_name: 'ENG-1000 — Engineering CapEx',
              fields: { cost_center: 'ENG-1000', gl_account: '6400-100' },
            },
          ],
        }),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/activity-log/`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            log_id: 'sow-act-1',
            log: 'SOW sent to vendor for review',
            user_id: 10,
            component: 'sow',
            component_id: String(SOW_ID),
            created_at: daysAgo(40) + 'T10:00:00Z',
            date: daysAgo(40) + 'T10:00:00Z',
            impersonator_name: null,
            viewed_by_user_with_wo_end_perm_only: null,
            log_contains_vendor_info: false,
            user_full_name: 'James Employer',
            was_sow_skipped: null,
            bulk_update_id: null,
          },
          {
            log_id: 'sow-act-2',
            log: 'SOW accepted and activated',
            user_id: 10,
            component: 'sow',
            component_id: String(SOW_ID),
            created_at: daysAgo(35) + 'T14:20:00Z',
            date: daysAgo(35) + 'T14:20:00Z',
            impersonator_name: null,
            viewed_by_user_with_wo_end_perm_only: null,
            log_contains_vendor_info: false,
            user_full_name: 'James Employer',
            was_sow_skipped: null,
            bulk_update_id: null,
          },
        ]),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/participants/project-managers/`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          MOCK_PARTICIPANTS.filter((p) => p.is_project_manager).map((p) => ({
            employer: p.employer,
            participant_full_name: p.participant_full_name,
            participant_email: p.participant_email,
            participant_contact_number: p.participant_contact_number,
            is_project_manager: true,
            custom_fields: p.custom_fields,
            secondary_display_label: p.secondary_display_label,
          })),
        ),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/participants/?$`), (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PARTICIPANTS) })
    })

    await page.route(`**/api/v2/business_units/${1}/**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'Engineering',
          code: 'ENG',
          created_by: 0,
          updated_by: 0,
          has_access: true,
          has_descendant_access: true,
          time_keeping: true,
          is_deleted: false,
          level: 2,
          parent: 2,
          parent_name: '_CLIENT',
          children: [],
          ancestors: [
            { id: 2, name: '_CLIENT', level: 1, sub_label: null },
            { id: 1, name: '_ROOT', level: 0, sub_label: null },
          ],
          connector_settings: { workday: { is_position_management_model: false } },
        }),
      })
    })

    await page.route(`**/api/v2/sow-module/sow/${SOW_ID}/settings/**`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    })

    await page.route(/.*\/api\/v2\/program_fees\/options\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          isVendor
            ? []
            : [
                { id: 10, name: 'SOW Default Fee' },
                { id: 11, name: 'SOW Reduced Fee' },
              ],
        ),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/version/${VERSION_ID}/get-sow-budget/`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          planned_sow_amount: '250000.00',
          committed_sow_amount: '85000.00',
          actual_sow_amount: '54000.00',
          remaining_sow_amount: '165000.00',
          externally_invoiced_amount: '0.00',
          negotiation_payments_amount: '62000.00',
          negotiation_available_amount: '188000.00',
          include_taxes_in_budget_calculations: false,
        }),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/version/${VERSION_ID}/worksites/`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            value: 1,
            label: '1740 Broadway — New York, NY',
            is_deleted: false,
          },
        ]),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/version/${VERSION_ID}/job/\\?`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([], { count: 0, limit: 10, offset: 0 })),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/version/${VERSION_ID}/job/summary`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_positions: 12,
          available_positions: 4,
          pending: 2,
          onboarded: 5,
          closed: 1,
          total_wd_unfilled: 0,
          has_wd_pm_provisioning_eligible: false,
        }),
      })
    })

    await page.route(
      new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/version/${VERSION_ID}/milestonesv2`),
      (route) => {
        if (route.request().method() !== 'GET') return route.continue()
        const path = new URL(route.request().url()).pathname
        if (path.endsWith('/summary')) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              total_milestones: 3,
              completed_milestones_count: 1,
              inprogress_milestones_count: 1,
              notstarted_milestones_count: 1,
            }),
          })
          return
        }
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            paginated(MOCK_MILESTONE_ROWS, {
              count: MOCK_MILESTONE_ROWS.length,
              limit: 10,
              offset: 0,
            }),
          ),
        })
      },
    )

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/version/${VERSION_ID}/payment-schedule/summary/`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          payments_total: 2,
          currency_code: 'USD',
          worksites: [1],
        }),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/version/${VERSION_ID}/payment-schedule/\\?`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated(
            [
              {
                id: 7701,
                id_display: 'SP-07701',
                title: 'Phase 1 fixed payment',
                state: 15,
                planned_amount: '25000.00',
                planned_total: '27500.00',
                workflows: [],
              },
            ],
            { count: 1, limit: 10, offset: 0 },
          ),
        ),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/version/${VERSION_ID}/budget-allocation/`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/version/${VERSION_ID}/config/`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_checklists_enabled: false,
          is_change_order_version: false,
          is_approved_version: true,
          is_sow_reopen_enabled: true,
        }),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/attachments`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      })
    })

    await page.route('**/api/v2/workflow_approval_config/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    })

    await page.route('**/api/dashboard_permissions/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    })

    await page.route('**/api/custom_reports/dashboard_query/**', (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { period: '2025-07-01', amount: '12500.00' },
            { period: '2025-08-01', amount: '18750.00' },
            { period: '2025-09-01', amount: '15200.00' },
            { period: '2025-10-01', amount: '22300.00' },
            { period: '2025-11-01', amount: '19800.00' },
            { period: '2025-12-01', amount: '25400.00' },
            { period: '2026-01-01', amount: '21000.00' },
          ],
          columns: [
            { id: 'period', name: 'period' },
            { id: 'amount', name: 'amount' },
          ],
        }),
      })
    })

    await page.route(new RegExp(`/api/v2/sow-module/sow/${SOW_ID}/change-orders/summary`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 2,
          state_counts: {
            10: { client: 1, vendor: 0 },
            5: { client: 0, vendor: 1 },
          },
        }),
      })
    })

    await page.route('**/api/v2/sow-module/sow/role-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          should_close_position_for_workflows: false,
          should_close_unfilled_positions_on_sow: false,
        }),
      })
    })

    await page.route(/.*\/api\/v2\/settings\/sow\/sow_configuration\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          program_team: { display: true, label: 'Program Team' },
        }),
      })
    })

    await page.route(/.*\/api\/v2\/settings\/sow\/sow_configuration\/?$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          program_team: { display: true, label: 'Program Team' },
        }),
      })
    })

    await page.route(/.*\/api\/v2\/employer_manager\/?\?.*type=program_team/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 2,
          results: [
            { id: 10, full_name: 'Alpha PMO' },
            { id: 11, full_name: 'Beta PMO' },
          ],
        }),
      })
    })

    await page.route(/.*\/api\/v2\/sow-module\/project-managers\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { user: 10, participant_full_name: 'James Employer', participant_email: 'james@cruisecorp.com' },
          { user: 11, participant_full_name: 'Pat Producer', participant_email: 'pat@cruisecorp.com' },
        ]),
      })
    })

    await page.route(/.*\/api\/v1\/vendors\/summaries\/?\?.*settings=statement_of_work/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 2,
          results: [
            { entity_id: 5, name: 'Acme Staffing' },
            { entity_id: 6, name: 'TechBridge Solutions' },
          ],
        }),
      })
    })

    await page.route('**/api/v2/sow-module/sow/payment_types/**', (route) => {
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

    await page.route(/.*\/api\/v2\/customization\/datasources\/sow_closure_reason\/rows\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 2,
          results: [
            { id: 1, is_active: true, display_name: 'Project complete', display_name_with_inactive: 'Project complete' },
            { id: 2, is_active: true, display_name: 'Budget exhausted', display_name_with_inactive: 'Budget exhausted' },
          ],
          offset: 0,
          next_params: null,
          previous_params: null,
        }),
      })
    })

    await page.route('**/api/v2/sow-module/change-orders/cos-summary', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { state: 5, count: 1, state_display: 'Awaiting Client Review' },
          { state: 10, count: 2, state_display: 'Approved' },
        ]),
      })
    })

    await page.route('**/api/v2/user_preferences**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
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
        body: JSON.stringify({ count: 0, results: [] }),
      })
    })
  },
}
