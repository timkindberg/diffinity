import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow } from '../mock-utils.js'


const JOB_ID = 123
const CANDIDATE_ID = 456
const JOB_APP_ID = 789

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

/**
 * Jobs Applicants Detail page (/jobs/candidate_details/:job_id/?cid=:candidate_id)
 * Employer-only Django page: real template via VR middleware + Layer 2 JSON mocks below.
 */
export const jobsApplicantsDetail: PageDefinition = {
  id: 'jobs-applicants-detail',
  name: 'Jobs Applicants Detail',
  path: `/jobs/candidate_details/${JOB_ID}/?cid=${CANDIDATE_ID}`,
  roles: ['employer'],
  fullPage: true,
  django: true,

  async waitForReady(page: Page) {
    try {
      await page.waitForSelector('#activity_logs', { timeout: 15000 })
    } catch {
      // fall through
    }
    await page.waitForTimeout(3000)
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

    await page.route(`**/api/v2/work-orders/work-history/**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            title: 'Senior Software Engineer',
            job_id: JOB_ID,
            vendor_name: 'Acme Staffing',
            submitted_date: daysAgo(5),
            wo_id: 9001,
            wo_status: 2,
            wo_start_date: daysFromNow(14),
            wo_end_date: daysFromNow(180),
            can_view_wo: true,
            can_view_job: true,
          },
          {
            title: 'Full Stack Developer',
            job_id: 98,
            vendor_name: 'Acme Staffing',
            submitted_date: daysAgo(365),
            wo_id: 7200,
            wo_status: 9,
            wo_start_date: daysAgo(365),
            wo_end_date: daysAgo(60),
            can_view_wo: true,
            can_view_job: true,
          },
          {
            title: 'Backend Engineer',
            job_id: 77,
            vendor_name: 'Acme Staffing',
            submitted_date: daysAgo(730),
            wo_id: 5500,
            wo_status: 9,
            wo_start_date: daysAgo(730),
            wo_end_date: daysAgo(400),
            can_view_wo: false,
            can_view_job: false,
          },
        ]),
      })
    })

    await page.route(
      new RegExp(`.*\\/api\\/v2\\/job_applications\\/${JOB_APP_ID}\\/notes\\/`),
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              notes: 'Strong communication skills, excellent problem-solving ability. Recommended for second round.',
              details: { rating: 4.5 },
              created_at: daysAgo(3),
              created_by_name: 'James Employer',
            },
            {
              id: 2,
              notes: 'Good technical background in Python and React. Salary expectations align with budget.',
              details: { rating: 4.0 },
              created_at: daysAgo(2),
              created_by_name: 'Alice Manager',
            },
          ]),
        })
      }
    )

    await page.route(/.*\/api\/v2\/job_application\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          phone_number_required: false,
          video_link_required: false,
          can_message: true,
          can_read_feedback_rating: true,
          can_write_feedback_rating: true,
          can_read_feedback_notes: true,
          can_write_feedback_notes: true,
        }),
      })
    })

    await page.route(/.*\/api\/v2\/checklist_actions\/stats\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 5,
          completed: 3,
          pending: 2,
          overdue: 0,
        }),
      })
    })

    await page.route(/.*\/api\/v2\/job_application_actions\/stats\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 5,
          completed: 3,
          pending: 2,
          overdue: 0,
        }),
      })
    })

    await page.route(/.*\/api\/v2\/job_application_actions\/get_total_counts/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_count: 0 }),
      })
    })

    await page.route(/.*\/api\/v2\/job_application_actions\/\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    await page.route(/.*\/api\/v2\/checklist_actions\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, name: 'Background Check', status: 'completed', due_date: daysAgo(10) },
          { id: 2, name: 'I-9 Verification', status: 'completed', due_date: daysAgo(8) },
          { id: 3, name: 'Drug Screening', status: 'completed', due_date: daysAgo(5) },
          { id: 4, name: 'Equipment Setup', status: 'pending', due_date: daysFromNow(5) },
          { id: 5, name: 'System Access Request', status: 'pending', due_date: daysFromNow(7) },
        ])),
      })
    })

    await page.route('**/api/v2/interviews/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_create_interview: true,
          can_view_interviews: true,
          is_enabled: true,
        }),
      })
    })

    await page.route(/.*\/api\/v2\/.*\/all_approvers\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ workflows: [], approval_chain: [], workflow_definition: null }),
      })
    })

    await page.route(
      /.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(paginated([
            { id: 1, title: 'Review timesheet for Bob Johnson', status: 1, due_date: daysFromNow(-2), category: 'Timesheet', priority: 'high' },
            { id: 2, title: 'Approve work order modification', status: 1, due_date: daysFromNow(-1), category: 'Work Order', priority: 'medium' },
            { id: 3, title: 'Review invoice #INV-5678', status: 1, due_date: daysFromNow(0), category: 'Invoice', priority: 'low' },
          ])),
        })
      }
    )

    await page.route('**/api/contact-us-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })

    await page.route('**/api/v2/shifts/rules_vendors/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route(/.*\/api\/v2\/shifts\/default/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ shifts: null, shift_differential_mapping: null }),
      })
    })

    await page.route(/.*\/api\/v2\/job_application\/statuses\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { id: 1, value: 1, text: 'Applied' },
            { id: 2, value: 2, text: 'Interviewing' },
            { id: 3, value: 3, text: 'Rejected' },
            { id: 10, value: 10, text: 'Ready To Onboard' },
            { id: 11, value: 11, text: 'Onboarded' },
          ],
        }),
      })
    })

    await page.route(/.*\/api\/v2\/offer_release\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_max_duration: 120,
          can_override_max_duration_of_job: true,
          can_override_work_order_max_duration: true,
          is_budget_calculator_enabled: false,
          is_monthly_timesheet_enabled: false,
          rate_config: {},
          is_classify_clocks_enabled: false,
          allow_wo_dates_to_be_outside_job_dates: false,
          specify_wo_end_time: false,
          is_workday_position_selection_applicable: false,
        }),
      })
    })

    await page.route('**/api/v2/connectors/hiredscore/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      })
    })

    await page.route(/.*\/api\/v2\/job_publish_approvals\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      })
    })

    await page.route('**/api/v2/user_preferences**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route(/.*\/api\/v2\/work-orders\/\d+\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_view_vendor: true,
          pending_modification: false,
          ended: false,
          can_read_timesheet: false,
          contractor_has_monthly_timesheets: false,
          user_owns_and_manages_timesheet: false,
          display_calc_breakdown: false,
          workday_enabled: false,
          actions: {
            wpm_collaborate: false,
            edit: { enabled: true, visible: true, description: 'Edit' },
            end: { enabled: true, visible: true, description: 'End' },
          },
          comments: { view: true, create: true, external: true },
          contractor: { candidate_id: CANDIDATE_ID, contractor_profile: 'profile' },
          tabs: [],
        }),
      })
    })

    await page.route(/.*\/api\/v2\/work-orders\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ can_view_work_orders: true }),
      })
    })

    await page.route(/.*\/api\/v2\/custom_data_sources\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      })
    })

    await page.route(
      new RegExp(`.*\\/api\\/v2\\/candidate\\/${CANDIDATE_ID}(?:\\/)?(?:\\?.*)?$`),
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: CANDIDATE_ID,
            first_name: 'Jane',
            last_name: 'Smith',
            email: 'jane.smith@example.com',
            vendor_id: 5,
            is_active: true,
          }),
        })
      }
    )

    await page.route(/.*\/api\/v2\/settings\/visible_fields_defaults\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })

    await page.route(/.*\/api\/v2\/settings\/global\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })

    await page.route(/.*\/api\/v2\/hired_candidate\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    await page.route(/.*\/api\/v2\/timekeeping\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })
  },
}
