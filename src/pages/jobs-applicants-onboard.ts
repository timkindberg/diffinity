import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo as _daysAgo, daysFromNow as _daysFromNow, dateOnly } from '../mock-utils.js'

const daysAgo = (n: number) => dateOnly(_daysAgo(n))
const daysFromNow = (n: number) => dateOnly(_daysFromNow(n))
const daysAgoIso = _daysAgo

const JOB_APP_ID = 789
const JOB_ID = 123
const CANDIDATE_ID = 456
const WORK_ORDER_ID = 9001
const BU_ID = 1

/** Offer-release workflow: keep optional sections off (not used on onboard page UI). */
const WORKFLOW_OFFER_FIELDS = {
  calendar_pay_profile: false,
  job_type: false,
  overtime_profile: false,
  work_type_profile: false,
  work_week_start_time_override: false,
  client_contractor_id: false,
  external_id: false,
  timesheet_approvers: false,
  expense_approvers: false,
  expense_type: false,
  source_type: false,
  tax_override: false,
  additional_markups_for_pay_rate_jobs: false,
}

/** Onboard workflow: show contractor IDs + timesheet / expense approvers. */
const WORKFLOW_ONBOARD_FIELDS = {
  ...WORKFLOW_OFFER_FIELDS,
  client_contractor_id: true,
  external_id: true,
  timesheet_approvers: true,
  expense_approvers: true,
}

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

const MOCK_EMPLOYER_ROWS = [
  {
    id: 201,
    profile_id: 201,
    username: 'alice.m',
    first_name: 'Alice',
    preferred_first_name: null,
    middle_name: null,
    last_name: 'Manager',
    preferred_last_name: null,
    email: 'alice@cruisecorp.com',
    full_name: 'Alice Manager',
    work_site: 50,
  },
  {
    id: 202,
    profile_id: 202,
    username: 'bob.j',
    first_name: 'Bob',
    preferred_first_name: null,
    middle_name: null,
    last_name: 'Johnson',
    preferred_last_name: null,
    email: 'bob@cruisecorp.com',
    full_name: 'Bob Johnson',
    work_site: 50,
  },
  {
    id: 301,
    profile_id: 301,
    username: 'pat.t',
    first_name: 'Pat',
    preferred_first_name: null,
    middle_name: null,
    last_name: 'Timekeeper',
    preferred_last_name: null,
    email: 'pat@cruisecorp.com',
    full_name: 'Pat Timekeeper',
    work_site: 50,
  },
  {
    id: 302,
    profile_id: 302,
    username: 'erin.f',
    first_name: 'Erin',
    preferred_first_name: null,
    middle_name: null,
    last_name: 'Finance',
    preferred_last_name: null,
    email: 'erin.finance@cruisecorp.com',
    full_name: 'Erin Finance',
    work_site: 50,
  },
]

const EMPTY_GENERIC_RJSF = {
  rjsf: {
    data_schema: { type: 'object', properties: {} },
    ui_schema: {},
  },
}

/**
 * Onboard candidate (Next.js) — `/jobs/onboard/:job_application_id`
 * Employer work-order creation form after offer acceptance: duration, readonly rates, contractor details, managers.
 */
export const jobsApplicantsOnboard: PageDefinition = {
  id: 'jobs-applicants-onboard',
  name: 'Jobs Applicants Onboard',
  path: `/jobs/onboard/${JOB_APP_ID}`,
  roles: ['employer'],
  fullPage: true,

  async waitForReady(page: Page) {
    await page.waitForSelector('[data-testid="submit-button"]', { timeout: 25000 })
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // ignore
    }
    await page.waitForTimeout(1500)
  },

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

    await page.route('**/api/contact-us-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })

    await page.route('**/api/v2/user_preferences**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
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
              title: 'Review onboarding — Jane Smith',
              status: 1,
              due_date: daysFromNow(2),
              category: 'Jobs',
              priority: 'medium',
            },
          ]),
        ),
      })
    })

    await page.route('**/api/v2/workflow_approval_config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_add_additional_approver: false,
          workflow_approvers: {
            add_extra_optional_approvers: false,
            allow_additional_approvers_on_same_levels: false,
          },
        }),
      })
    })

    await page.route(`**/api/v2/job_titles/titles/${5}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 5,
          title: 'Contingent Engineering',
          job_types: [],
          apply_shifts: false,
          is_popular_job: false,
          created_by: 1,
          updated_by: 1,
          must_have_skills: [],
          nice_to_have_skills: [],
          approvals_required: 0,
        }),
      })
    })

    await page.route(`**/api/v2/job_applications/${JOB_APP_ID}/offer-form`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: JOB_APP_ID,
          applicant: String(CANDIDATE_ID),
          business_unit: BU_ID,
          calculation_pack: null,
          job_calculation_pack: null,
          candidate_pay_rate: 92.5,
          candidate_markup: 0.18,
          overtime_markup: null,
          double_time_markup: null,
          contract_pay_type: 1,
          currency_code: 'USD',
          end_date: daysFromNow(168),
          hire_type: 2,
          is_pay_rate_driven: false,
          job_id: JOB_ID,
          job_title: 'Senior Software Engineer',
          job_end_date: daysFromNow(365),
          job_start_date: daysFromNow(-14),
          job_markup: 0.2,
          job_template: 5,
          job_template_job_type: 1,
          job_category: 1,
          optimized_rate: 125,
          payment_details: { fee_amount: 0, number_of_payments: 0 },
          program_rate_type: 'bill_rate',
          resource_manager: 201,
          additional_managers: [202],
          timesheet_approvers: [301],
          expense_approvers: [302],
          start_date_no_tz: daysFromNow(14),
          work_order_id: WORK_ORDER_ID,
          work_order_first_offer_at: daysAgoIso(5),
          work_site: 1,
          work_week: 40,
          vendor_id: 5,
          vendor_valid_email_domains: ['acmestaffing.com'],
          denied_email_domains: [],
          billing_mode: 1,
          billing_schedule: 1,
          can_edit_billing_mode: true,
          rate_calculator: null,
          expense_type: 1,
          source_type: 1,
          contractor_email: 'jane.smith.contractor@acmestaffing.com',
          contractor_username: 'jsmith01',
          msp_contractor_id: 'MSP-7788',
          client_contractor_id: 'CC-88421',
          external_id: 'EXT-CAND-00912',
          candidate_generic_fields: null,
          work_order_generic_fields: null,
        }),
      })
    })

    await page.route(`**/api/v2/offer_release/config/**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_max_duration: 365,
          can_override_max_duration_of_job: true,
          can_override_work_order_max_duration: true,
          is_budget_calculator_enabled: false,
          is_monthly_timesheet_enabled: false,
          is_labor_amount_on_budget_overridden: false,
          has_permission_to_edit_labor_amount_override_on_budget: false,
          rate_config: {
            1: { min_rate: 50, max_rate: 250 },
            2: { min_rate: 0 },
            3: { min_rate: 0 },
            5: { min_rate: 0 },
            6: { min_rate: 0 },
            7: { min_rate: 0 },
          },
          is_classify_clocks_enabled: false,
          allow_wo_dates_to_be_outside_job_dates: false,
          specify_wo_end_time: false,
          is_workday_position_selection_applicable: false,
          is_independent_contractor: false,
          should_recalculate_labor_amount: true,
          apply_shifts: false,
          can_override_shifts: false,
          are_shifts_required: false,
          job_module: 0,
          job_form_config: {
            timesheet_approvers: { required: true, multiselect: true, optionSubLabel: 'email' },
            expense_approvers: { required: true, multiselect: true, optionSubLabel: 'email' },
            resource_manager: { optionSubLabel: null },
            hiring_team: { optionSubLabel: null },
          },
          event_based_expenses: { can_view: false, can_edit: false, required: false },
          work_type_information: { can_update_work_type_profile: false, can_add_work_type_overrides: false },
          work_order_max_duration: null,
          can_view_candidate_pay_rate: true,
          can_update_candidate_pay_rate: true,
          can_update_tax_override: false,
          should_show_additional_markups_for_offer: true,
          should_show_additional_markups_for_offer_for_onboarding: false,
          is_fast_path: false,
          is_preidentified: false,
        }),
      })
    })

    await page.route(`**/api/v2/work-orders/${WORK_ORDER_ID}/config/`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_view_vendor: true,
          pending_modification: false,
          has_active_approvals: false,
          contractor_has_monthly_timesheets: false,
          can_read_timesheet: false,
          can_read_scheduled_billing_transactions: false,
          contractor_timekeeping_settings: { show: true, edit: true },
          user_owns_and_manages_timesheet: false,
          ended: false,
          display_calc_breakdown: false,
          workday_enabled: false,
          provisioning_eligible: false,
          actions: {
            wpm_collaborate: false,
            edit: { enabled: true, visible: true, description: 'Edit' },
            end: { enabled: true, visible: true, description: 'End' },
          },
          budgets_enabled: true,
          comments: { view: true, create: true, external: true },
          contractor: { candidate_id: CANDIDATE_ID, contractor_profile: 'profile' },
          show_rate_info_card: false,
          can_view_organization_unit: false,
          can_view_resource_manager: false,
          shifts_enabled: false,
          tabs: [],
          is_workorder_timekeeping_eligible: true,
          can_add_checklist_actions: false,
          is_monthly_timesheet_enabled: false,
          revise: {
            dates: {
              wo_max_duration_in_days: 730,
              min_start_date: daysAgo(90),
              min_end_date: daysAgo(90),
              max_end_date: null,
            },
            is_effective_dating_and_overriding_wtp_wt_allowed: false,
          },
        }),
      })
    })

    await page.route('**/api/v2/job_application_actions/get-job-application-workflow-settings', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          offer_release: {
            additional_fields: WORKFLOW_OFFER_FIELDS,
            allow_verification_override: true,
            block_offer_release_on_pending_approval: false,
          },
          onboarding: { additional_fields: WORKFLOW_ONBOARD_FIELDS },
        }),
      })
    })

    await page.route(`**/api/v2/jobs/job_form_config_for_bu/${BU_ID}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_edit_rate_calculator_job: false,
          can_override_description: false,
          can_override_max_duration: false,
          can_override_shifts: false,
          can_read_event_based_expenses: false,
          can_edit_event_based_expenses: false,
          can_edit_calculation_pack_job: false,
          can_read_calculation_pack: false,
          display_pre_id_checkbox: false,
          can_view_program_team: true,
        }),
      })
    })

    await page.route(/.*\/api\/v2\/jobs\/job_form_config_for_bu\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_edit_rate_calculator_job: false,
          can_override_description: false,
          can_override_max_duration: false,
          can_override_shifts: false,
          can_read_event_based_expenses: false,
          can_edit_event_based_expenses: false,
          can_edit_calculation_pack_job: false,
          can_read_calculation_pack: false,
          display_pre_id_checkbox: false,
          can_view_program_team: true,
        }),
      })
    })

    await page.route(`**/api/v2/candidate-explicit-fields/${CANDIDATE_ID}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: CANDIDATE_ID,
          full_name: 'Jane Smith',
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@example.com',
          vendor_entity: 12,
          vendor_entity_name: 'Acme Staffing LLC',
        }),
      })
    })

    await page.route(`**/fee_profile/job_application_fee_profile_options/${JOB_APP_ID}**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { group: 'Work Order', value: 2, label: 'Standard MSP (18%)', selected: true },
          { group: 'Vendor', value: 3, label: 'Preferred Vendor Rate' },
        ]),
      })
    })

    await page.route(/\/api\/v2\/employer_manager/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      const url = route.request().url()
      const pathMatch = url.match(/\/employer_manager\/(\d+)/)
      if (pathMatch) {
        const id = parseInt(pathMatch[1], 10)
        const row = MOCK_EMPLOYER_ROWS.find((e) => e.id === id) ?? MOCK_EMPLOYER_ROWS[0]
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(row),
        })
        return
      }
      const u = new URL(url)
      const idsParam = u.searchParams.get('ids')
      if (idsParam) {
        const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n))
        const results = MOCK_EMPLOYER_ROWS.filter((e) => ids.includes(e.id))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated([...MOCK_EMPLOYER_ROWS], { count: MOCK_EMPLOYER_ROWS.length, limit: 200, offset: 0 }),
        ),
      })
    })

    await page.route(/.*\/api\/v2\/work_sites\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated(
            [
              {
                id: 1,
                display_name: 'San Francisco HQ — Engineering',
                name: 'San Francisco HQ',
                extended_display_name: 'San Francisco HQ (CA)',
                country: 'US',
              },
              {
                id: 2,
                display_name: 'Austin Delivery Center',
                name: 'Austin',
                extended_display_name: 'Austin (TX)',
                country: 'US',
              },
            ],
            { count: 2, limit: 200, offset: 0 },
          ),
        ),
      })
    })

    await page.route('**/api/v2/jobs/job/*/config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          has_pre_onboarding_checklists: true,
          can_waive_verifications: false,
          show_waive_verifications: false,
        }),
      })
    })

    await page.route('**/api/v2/checklists/view_config/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          allow_rm_to_waive_checklist_actions: false,
          enable_checklist_rejection_reason: false,
          allow_waive_verification_at_offer_release: false,
          display_checklist_items_during_job_creation: false,
          allow_contractors_to_manage_checklist_actions: false,
          allow_checklist_modification_during_job_creation: false,
          allow_viewing_checklist_requirements_before_onboarding: false,
          require_waived_checklist_actions_be_completed_after_onboarding: false,
          waived_checklist_actions_must_be_completed_x_days_after_onboarding: null,
        }),
      })
    })

    await page.route('**/api/v2/generic_form/schema/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMPTY_GENERIC_RJSF),
      })
    })

    await page.route('**/api/v2/generic_form_context/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })

    await page.route('**/api/v2/connectors/hiredscore/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      })
    })
  },
}
