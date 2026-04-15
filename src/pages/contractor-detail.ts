import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow, dateOnly, TODAY } from '../mock-utils.js'
const START_DATE = dateOnly(daysAgo(400))
const END_DATE = dateOnly(daysFromNow(180))

const HC_ID = 301
const CANDIDATE_ID = 88001

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

const HC_ACTIVITY_LOG = [
  {
    log_id: 'vr-hc-1',
    log: '**Engagement ended** — work order closed after successful delivery of analytics roadmap.',
    user_id: 10,
    component: 'hired_candidate',
    component_id: String(HC_ID),
    created_at: daysAgo(5),
    date: daysAgo(5),
    impersonator_name: null,
    viewed_by_user_with_wo_end_perm_only: false,
    log_contains_vendor_info: false,
    user_full_name: 'James Employer',
    was_sow_skipped: false,
  },
  {
    log_id: 'vr-hc-2',
    log: '**Contractor profile** viewed by program office for **rehire** discussion.',
    user_id: 10,
    component: null,
    component_id: null,
    created_at: daysAgo(18),
    date: daysAgo(18),
    impersonator_name: null,
    viewed_by_user_with_wo_end_perm_only: false,
    log_contains_vendor_info: false,
    user_full_name: 'Jordan Lee',
    was_sow_skipped: false,
  },
  {
    log_id: 'vr-hc-3',
    log: '**Timesheet** batch approved — period ending with **160.5** billable hours.',
    user_id: 10,
    component: 'time_entry',
    component_id: '99102',
    created_at: daysAgo(40),
    date: daysAgo(40),
    impersonator_name: null,
    viewed_by_user_with_wo_end_perm_only: false,
    log_contains_vendor_info: false,
    user_full_name: 'James Employer',
    was_sow_skipped: false,
  },
]

const GWF_CANDIDATE_RESULTS = [
  {
    uuid: 'gwf-cd-1',
    label: '**Onboarding** — security training completed',
    updated_at: daysAgo(400),
    definition_namespace: 'internal::onboarding',
    root_obj_type: 'Candidate',
    root_obj_id: CANDIDATE_ID,
    data: { step_message: 'All required security modules marked complete in LMS.' },
    directives: {},
  },
  {
    uuid: 'gwf-cd-2',
    label: '**Work order** — assignment activated',
    updated_at: daysAgo(380),
    definition_namespace: 'internal::work_order',
    root_obj_type: 'Candidate',
    root_obj_id: CANDIDATE_ID,
    data: { step_message: 'Resource manager confirmed start date and building access.' },
    directives: {},
  },
]

const FEEDBACK_NOTES = [
  {
    id: 501,
    notes: 'Strong collaborator during platform migration; clear communication with stakeholders.',
    details: { rating: 4.5 },
    created_at: daysAgo(60),
    created_by: 10,
  },
]

/**
 * Post-engagement contractor profile (Django + embedded React).
 * URL must match `HC_ID` in `vr_django/contexts/contractor_detail.py`.
 */
export const contractorDetail: PageDefinition = {
  id: 'contractor-detail',
  name: 'Contractor Detail (Post-Engagement)',
  path: `/hired-candidate/post-engagement/${HC_ID}/`,
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(false) })
    })

    await page.route(new RegExp(`.*\\/api\\/v2\\/hired_candidate\\/${HC_ID}\\/activity_log`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(HC_ACTIVITY_LOG),
      })
    })

    await page.route(new RegExp(`.*\\/api\\/v2\\/hired_candidate\\/${HC_ID}\\/?$`), (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: HC_ID,
          candidate_id: CANDIDATE_ID,
          status: 3,
          full_name: 'Alex J. Morgan',
          client_email: 'alex.morgan@cruisecorp.example.com',
        }),
      })
    })

    await page.route(new RegExp(`.*\\/api\\/v2\\/hired_candidate\\/${HC_ID}\\/timekeeping-overrides`), (route) => {
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
        ]),
      })
    })

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

    await page.route('**/api/v2/timekeeping/timesheet-types', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Time In/Out', value: 'time in/out' },
          { id: 2, name: 'Summary', value: 'summary' },
        ]),
      })
    })

    await page.route(/.*\/api\/v2\/gwf\/instance\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: GWF_CANDIDATE_RESULTS }),
      })
    })

    await page.route(new RegExp(`.*\\/api\\/v2\\/candidate\\/${CANDIDATE_ID}\\/candidate_feedbacks\\/$`), (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FEEDBACK_NOTES),
      })
    })

    await page.route(
      new RegExp(`.*\\/api\\/v2\\/candidate\\/${CANDIDATE_ID}\\/candidate_feedbacks\\/config\\/`),
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            can_read_feedback_notes: true,
            can_read_feedback_rating: true,
            can_write_feedback_notes: true,
            can_write_feedback_rating: true,
          }),
        })
      },
    )

    await page.route(new RegExp(`.*\\/api\\/contractor_summary\\/${CANDIDATE_ID}`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: [
            {
              id: 8800101,
              work_order_id: 4201,
              work_order_title: 'Senior Data Engineer — Analytics Platform',
              hired_candidate_id: HC_ID,
              status: 'Approved',
              hours: 160.5,
              is_billable: true,
              start_date: dateOnly(daysAgo(14)),
              end_date: dateOnly(daysAgo(7)),
              days: 0,
              time_entry_display_id: 'TE-VR-001',
            },
          ],
          totalResults: 1,
          totalPages: 1,
        }),
      })
    })

    await page.route('**/api/v2/generic_form/schema/candidate/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'candidate',
          namespace: 'candidate',
          display_name: 'Candidate',
          rjsf: { data_schema: { type: 'object', required: [], properties: {} }, ui_schema: {}, ui_rules: [] },
        }),
      })
    })

    await page.route('**/api/currency/options/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          default_currency: 'USD',
          options: [{ value: 'USD', label: 'USD - US Dollar' }],
        }),
      })
    })

    await page.route('**/api/currency/options', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          default_currency: 'USD',
          options: [{ value: 'USD', label: 'USD - US Dollar' }],
        }),
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
              title: 'Review contractor profile — Alex Morgan',
              status: 1,
              due_date: daysFromNow(2),
              category: 'Contractor',
              priority: 'medium',
            },
          ]),
        ),
      })
    })

    await page.route('**/api/contact-us-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })
  },
}
