import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow } from '../mock-utils.js'


const JOB_ID = 123
const BU_ID = 1
const JOB_TEMPLATE_ID = 5

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

/**
 * Job Edit page (/jobs/job-form/?edit_job=123)
 * Employer-only Django+webpack page for editing an existing job.
 *
 * HTML is rendered by VR Django middleware (see visual-regression/vr_django/contexts/job_edit.py)
 * with mock context; Playwright only mocks JSON APIs.
 */
export const jobEdit: PageDefinition = {
  id: 'job-edit',
  name: 'Job Edit',
  path: `/jobs/job-form/?edit_job=${JOB_ID}`,
  roles: ['employer'],
  fullPage: true,
  django: true,

  async waitForReady(page: Page) {
    // Wait for the RJSF form to mount — JobCategory dropdown should render
    // Note: this is a complex Django+webpack page, react fields require
    // window.msg (from l10n) and businessUnitChanged() to fire first
    try {
      await page.waitForSelector('#job_form_react, [data-react="JobCategory"] [class*="placeholder"], [data-react="JobCategory"] [class*="singleValue"]', { timeout: 25000 })
    } catch {
      const hasJobForm = await page.$('[data-react="JobForm"]')
      const hasFormReact = await page.$('#job_form_react')
      console.log('DEBUG: JobForm div:', !!hasJobForm, 'RJSF form:', !!hasFormReact)
      await page.waitForTimeout(3000)
    }
    await page.evaluate(() => {
      const rjf = (window as any).ReactJobForm
      if (!rjf) return

      // The RJSF conditional rule `remove generic_fields` fires when
      // formContext.job.job_category doesn't exist. In the real app this is
      // set by onJobCategoryChange when the user interacts with the dropdown.
      const ctx = rjf.getFormContext()
      if (!ctx?.job?.job_category) {
        rjf.setFormContext({
          job: { job_category: { id: ctx?.job_category ?? 1, ancestors_including_self_ids: [1] } },
        })
      }

      // manually_set_program_team is a hidden boolean with no portal — hide the bare checkbox
      const el = document.querySelector('[data-testid="manually_set_program_team"]')
      if (el) {
        const wrapper = el.closest('.form-group')
        if (wrapper) (wrapper as HTMLElement).style.display = 'none'
      }
    })

    // Wait for GenericFields (custom fields) to render — they load async via React Query
    try {
      await page.waitForSelector('[data-react="GenericFields"] .chakra-stack, [data-react="GenericFields"] .form-group', { timeout: 5000 })
    } catch {
      // Custom fields may not render if schema is empty — that's OK
    }
    await page.waitForTimeout(2000)
  },

  async setup(page: Page, _role: Role) {
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

    // Job config (useJobConfig)
    await page.route('**/api/v2/jobs/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
        }),
      })
    })

    // Job form config for BU (useFormConfigForBu) — called when buId changes
    await page.route(`**/api/v2/jobs/job_form_config_for_bu/${BU_ID}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_edit_rate_calculator_job: true,
          can_override_description: false,
          can_override_max_duration: false,
          can_override_shifts: false,
          can_read_event_based_expenses: false,
          can_edit_event_based_expenses: false,
          can_edit_calculation_pack_job: false,
          can_read_calculation_pack: false,
          display_pre_id_checkbox: true,
          can_view_program_team: true,
        }),
      })
    })

    // Also handle any BU ID variant
    await page.route(/.*\/api\/v2\/jobs\/job_form_config_for_bu\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_edit_rate_calculator_job: true,
          can_override_description: false,
          can_override_max_duration: false,
          can_override_shifts: false,
          can_read_event_based_expenses: false,
          can_edit_event_based_expenses: false,
          can_edit_calculation_pack_job: false,
          can_read_calculation_pack: false,
          display_pre_id_checkbox: true,
          can_view_program_team: true,
        }),
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

    // Job categories dropdown (preloaded by job_category select)
    await page.route(/.*\/api\/v2\/jobs\/categories_dropdown\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, name: 'Information Technology', selectable: true },
          { id: 2, name: 'Engineering', selectable: true },
          { id: 3, name: 'Finance', selectable: true },
          { id: 4, name: 'Operations', selectable: true },
          { id: 5, name: 'Human Resources', selectable: true },
        ])),
      })
    })

    // Work sites (location field)
    await page.route(/.*\/api\/v2\/work_sites\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, name: 'San Francisco HQ', extended_display_name: 'San Francisco HQ (SF)', country: 'US' },
          { id: 2, name: 'New York Office', extended_display_name: 'New York Office (NY)', country: 'US' },
          { id: 3, name: 'Austin Remote', extended_display_name: 'Austin Remote (TX)', country: 'US' },
          { id: 4, name: 'Chicago Office', extended_display_name: 'Chicago Office (IL)', country: 'US' },
        ])),
      })
    })

    // Users API (hiring team, resource manager, timesheet/expense approvers)
    await page.route(/.*\/api\/v2\/users\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, full_name: 'Alice Manager', email: 'alice@cruisecorp.com', type: ['rm', 'time_approver', 'expense_approver', 'hm'] },
          { id: 2, full_name: 'Bob Johnson', email: 'bob@cruisecorp.com', type: ['hm'] },
          { id: 3, full_name: 'Carol Davis', email: 'carol@cruisecorp.com', type: ['hm'] },
          { id: 4, full_name: 'David Wilson', email: 'david@cruisecorp.com', type: ['rm', 'time_approver'] },
          { id: 5, full_name: 'Eve Martinez', email: 'eve@cruisecorp.com', type: ['expense_approver'] },
        ])),
      })
    })

    // Employer manager — individual lookups (by ID) and filtered lists (by type/BU)
    await page.route(/.*\/api\/v2\/employer_manager\/\d+$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          full_name: 'Alice Manager',
          email: 'alice@cruisecorp.com',
          is_active: true,
        }),
      })
    })

    await page.route(/.*\/api\/v2\/employer_manager\/?\?/, (route) => {
      const url = route.request().url()
      const ids = new URL(url).searchParams.get('ids')
      if (ids) {
        const idList = ids.split(',').map(Number)
        const allManagers: Record<number, { id: number; full_name: string; email: string; is_active: boolean }> = {
          1: { id: 1, full_name: 'Alice Manager', email: 'alice@cruisecorp.com', is_active: true },
          2: { id: 2, full_name: 'Bob Johnson', email: 'bob@cruisecorp.com', is_active: true },
          3: { id: 3, full_name: 'Carol Davis', email: 'carol@cruisecorp.com', is_active: true },
          4: { id: 4, full_name: 'David Wilson', email: 'david@cruisecorp.com', is_active: true },
          5: { id: 5, full_name: 'Eve Martinez', email: 'eve@cruisecorp.com', is_active: true },
        }
        const results = idList.map((id) => allManagers[id]).filter(Boolean)
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: results.length, results }),
        })
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 5,
          results: [
            { id: 1, full_name: 'Alice Manager', email: 'alice@cruisecorp.com', is_active: true },
            { id: 2, full_name: 'Bob Johnson', email: 'bob@cruisecorp.com', is_active: true },
            { id: 3, full_name: 'Carol Davis', email: 'carol@cruisecorp.com', is_active: true },
            { id: 4, full_name: 'David Wilson', email: 'david@cruisecorp.com', is_active: true },
            { id: 5, full_name: 'Eve Martinez', email: 'eve@cruisecorp.com', is_active: true },
          ],
        }),
      })
    })

    // Budget endpoint
    await page.route('**/budget/job/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ budget: null, allocations: [] }),
      })
    })

    // Program team users
    await page.route(/.*\/api\/v2\/program-team-users\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 4, full_name: 'Frank Lee', email: 'frank@cruisecorp.com' },
          { id: 6, full_name: 'Grace Kim', email: 'grace@cruisecorp.com' },
        ])),
      })
    })

    // Job template country restrictions (useJobTemplateCountryRestrictionsQuery)
    await page.route(`**/api/v2/job-templates/${JOB_TEMPLATE_ID}/get_country_restrictions`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Also handle any job template country restrictions
    await page.route(/.*\/api\/v2\/job-templates\/.*\/get_country_restrictions/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Criteria shifts / default shifts evaluation
    await page.route(/.*\/api\/v2\/shifts\/default.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ shifts: null, shift_differential_mapping: null }),
      })
    })

    // Shift strategies (preloaded by shift_strategy select)
    await page.route(/.*\/api\/v2\/shifts\/strategies.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Shift list (preloaded by shifts select)
    await page.route(/.*\/api\/v2\/shifts\/list.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
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

    // Multi-PMO enabled
    await page.route('**/api/v2/program-team/multi_pmo_enabled/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      })
    })

    // Program entity by rules
    await page.route(/.*\/api\/v2\/program-team\/get_by_rules.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    // Business unit API (org_unit_picker component)
    await page.route(/.*\/api\/v2\/business-units\/.*/, (route) => {
      const url = route.request().url()
      if (url.includes('/list/')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(paginated([
            { id: 1, name: 'Engineering', parent: null, permission: 'job.create' },
            { id: 2, name: 'Product', parent: null, permission: 'job.create' },
            { id: 3, name: 'Finance', parent: null, permission: 'job.create' },
          ])),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: BU_ID, name: 'Engineering', parent: null }),
        })
      }
    })

    // Business units for legacy VndlyBusinessUnitPicker
    await page.route(/.*\/api\/business_units\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Engineering', parent_id: null },
          { id: 2, name: 'Product', parent_id: null },
          { id: 3, name: 'Finance', parent_id: null },
        ]),
      })
    })

    // Generic form schema (for GenericFields — custom fields configured in Company Settings)
    await page.route(/.*\/api\/v2\/generic_form\/schema\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'job_edit',
          namespace: 'job_form',
          display_name: 'Custom Fields',
          rjsf: {
            data_schema: {
              type: 'object',
              required: ['cost_center'],
              properties: {
                cost_center: { type: 'string', title: 'Cost Center', default: 'CC-4200-ENG' },
                gl_code: { type: 'string', title: 'GL Code', default: 'GL-7100' },
                department_code: { type: 'string', title: 'Department Code', default: 'DEPT-ENG-042' },
                project_id: { type: 'string', title: 'Project ID', default: 'PRJ-2026-ALPHA' },
                hiring_urgency: {
                  type: 'string',
                  title: 'Hiring Urgency',
                  default: 'high',
                  enum: ['low', 'medium', 'high', 'critical'],
                  enumNames: ['Low', 'Medium', 'High', 'Critical'],
                },
                remote_eligible: { type: 'boolean', title: 'Remote Eligible', default: true },
              },
            },
            ui_schema: {
              'ui:order': ['cost_center', 'gl_code', 'department_code', 'project_id', 'hiring_urgency', 'remote_eligible'],
              cost_center: { 'ui:placeholder': 'Enter cost center' },
              gl_code: { 'ui:placeholder': 'Enter GL code' },
              department_code: { 'ui:placeholder': 'Enter department code' },
              project_id: { 'ui:placeholder': 'Enter project ID' },
            },
            ui_rules: [],
          },
        }),
      })
    })

    const JOB_ATTACHMENTS = [
      { id: 101, file_name: 'Job_Description_Senior_SWE', extension: 'PDF', can_vendor_view: true },
      { id: 102, file_name: 'Rate_Card_2026_Q1', extension: 'XLSX', can_vendor_view: true },
      { id: 103, file_name: 'NDA_Template_CruiseCorp', extension: 'DOCX', can_vendor_view: false },
      { id: 104, file_name: 'Interview_Guidelines', extension: 'PDF', can_vendor_view: true },
      { id: 105, file_name: 'Org_Chart_Engineering', extension: 'PNG', can_vendor_view: false },
    ]

    // Job attachments (renderAttachments calls this endpoint)
    await page.route(/.*\/api\/v2\/job-attachments\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(JOB_ATTACHMENTS)),
      })
    })

    // Job attachments (useJobAttachments uses /api/v2/jobs/job/:id/attachments/)
    await page.route(/.*\/api\/v2\/jobs\/job\/\d+\/attachments\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(JOB_ATTACHMENTS)),
      })
    })

    // Job template attachments
    await page.route(/.*\/api\/v2\/job-template-attachments\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(JOB_ATTACHMENTS.slice(0, 2))),
      })
    })

    // Approvals: job_publish_approvals and job_change_approvals
    await page.route(/.*\/api\/v2\/job_publish_approvals\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      })
    })

    await page.route(/.*\/api\/v2\/job_change_approvals\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      })
    })

    // All approvers (SelectApproversModal)
    await page.route(/.*\/api\/v2\/.*\/all_approvers\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ workflows: [], approval_chain: [], workflow_definition: null }),
      })
    })

    // Select approvers options
    await page.route(/.*\/api\/v2\/approvers\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, full_name: 'Alice Manager', email: 'alice@cruisecorp.com' },
          { id: 4, full_name: 'David Wilson', email: 'david@cruisecorp.com' },
        ])),
      })
    })

    // Calculation packs (useCalculationPackOptions — read from job form config)
    await page.route(/.*\/api\/v2\/calculation_engine\/calculation_pack_options.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Work type profiles (optionsFromApi)
    await page.route(/.*\/api\/v2\/work_type_profiles\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    // Calendar pay profiles (optionsFromApi)
    await page.route(/.*\/api\/v2\/calendar_pay_profiles\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Overtime profiles (optionsFromApi)
    await page.route(/.*\/api\/overtime_profiles\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    // Job checklists (worker provisioning)
    await page.route(/.*\/api\/v2\/checklists\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      })
    })

    // Reason for hire options
    await page.route(/.*\/api\/v2\/reason-for-hire\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, display_name: 'New Position', display_value: 'new_position' },
          { id: 2, display_name: 'Backfill', display_value: 'backfill' },
          { id: 3, display_name: 'Project-Based', display_value: 'project_based' },
          { id: 4, display_name: 'Seasonal', display_value: 'seasonal' },
        ])),
      })
    })

    // Workday positions
    await page.route(/.*\/api\/v2\/workday-positions\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    // Job change notification
    await page.route(/.*\/api\/v2\/job-change-notification\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Currency settings
    await page.route(/.*\/api\/v2\/currency\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ code: 'USD', symbol: '$', name: 'US Dollar' }]),
      })
    })

    // User tasks (nav task drawer)
    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, title: 'Review timesheet for Bob Johnson', status: 1, due_date: daysFromNow(-2), category: 'Timesheet', priority: 'high' },
          { id: 2, title: 'Approve work order modification', status: 1, due_date: daysFromNow(-1), category: 'Work Order', priority: 'medium' },
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

    // Pre-ID config (called by business_unit.js on BU change)
    await page.route(/.*\/api\/v2\/jobs\/pre_id_config\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enable_pre_id: true }),
      })
    })

    // Job permissions (called by business_unit.js on BU change for non-edit mode — edit mode skips this)
    await page.route(/.*\/api\/v2\/jobs\/permissions\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ can_submit_jobs: true }),
      })
    })

    // Vendor distribution config
    await page.route(/.*\/api\/v2\/get-job-distribution-config\/.*/, (route) => {
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

    // Program team config (useMultiPmoEnabled uses a multi_pmo_enabled endpoint)
    await page.route(/.*\/api\/v2\/program-team\/config\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_multiple_program_entities_enabled: false,
          display_program_team_entity: false,
        }),
      })
    })

    // Custom data sources (generic fields)
    await page.route(/.*\/api\/v2\/custom-data-sources\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    // Notifications (nav bell)
    await page.route(/.*\/api\/v2\/notifications\/notifications/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })
  },
}
