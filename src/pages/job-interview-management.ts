import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo } from '../mock-utils.js'

/** Next.js page: `pages/jobs/interview_management/index.js` — not Django. */

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

const INTERVIEW_CONFIG = {
  id: 1,
  can_create_interview: true,
  can_view_vendor: true,
  can_edit_interview: true,
  can_cancel_interview: true,
  video_link_required: false,
  allowed_interview_urls: ['https://meet.google.com', 'https://zoom.us'],
}

// Aligns with `InterviewRequestStatus` in ~/api/interviews
const ST = {
  AWAITING_VENDOR: 1,
  ALT_TIMES: 2,
  DECLINED: 4,
  CANCELED: 5,
  CONFIRMED: 9,
} as const

const timeSlot = (
  id: number,
  selected: boolean,
  startIso: string,
  endIso: string,
  dateLabel = 'Thursday, Apr 10, 2026',
) => ({
  id,
  date: dateLabel,
  start: startIso,
  end: endIso,
  selected,
})

const baseRequest = (overrides: Record<string, unknown>) => ({
  job_application: 5001,
  business_unit_id: 1,
  interviewer: 101,
  interviewer_name: 'Alex Rivera',
  interview_timezone: 'America/New_York',
  phone_number_mode: null,
  phone_number: undefined,
  country_code: undefined,
  address: '',
  video_meeting_url: undefined as string | undefined,
  additional_attendees: '',
  additional_attendees_array: [] as string[],
  alt_times_message: '',
  interview_notes: '',
  preferred_mode: 2,
  applied_date: daysAgo(3),
  time_slots: [] as ReturnType<typeof timeSlot>[],
  vendor_id: 5,
  vendor_name: 'Acme Staffing',
  job_id: 1001,
  job_title: 'Senior Software Engineer',
  ...overrides,
})

const INTERVIEW_RESULTS = [
  baseRequest({
    id: 1,
    candidate_name: 'Jordan Lee',
    status: ST.CONFIRMED,
    job_id: 1001,
    job_title: 'Senior Software Engineer',
    interviewer_name: 'Morgan Chen',
    preferred_mode: 2,
    video_meeting_url: 'https://meet.example.com/jordan-morgan',
    time_slots: [
      timeSlot(11, false, '2026-04-08T14:00:00.000Z', '2026-04-08T15:00:00.000Z'),
      timeSlot(12, true, '2026-04-10T15:00:00.000Z', '2026-04-10T16:00:00.000Z'),
    ],
  }),
  baseRequest({
    id: 2,
    candidate_name: 'Sam Patel',
    status: ST.AWAITING_VENDOR,
    job_id: 1002,
    job_title: 'Data Engineer',
    interviewer_name: 'Riley Brooks',
    preferred_mode: 1,
    time_slots: [
      timeSlot(21, false, '2026-04-12T18:00:00.000Z', '2026-04-12T18:30:00.000Z'),
    ],
  }),
  baseRequest({
    id: 3,
    candidate_name: 'Taylor Nguyen',
    status: ST.ALT_TIMES,
    job_id: 1003,
    job_title: 'UX Designer',
    vendor_id: 6,
    vendor_name: 'TechBridge Solutions',
    alt_times_message: 'Candidate requested morning slots next week.',
    interviewer_name: 'Casey Morgan',
    preferred_mode: 3,
    address: '500 Market St, San Francisco, CA',
    time_slots: [
      timeSlot(31, false, '2026-04-09T17:00:00.000Z', '2026-04-09T18:00:00.000Z'),
    ],
  }),
  baseRequest({
    id: 4,
    candidate_name: 'Riley Washington',
    status: ST.CANCELED,
    job_id: 1004,
    job_title: 'Product Manager',
    interviewer_name: 'Jamie Ortiz',
    interview_notes: 'Role filled internally.',
    time_slots: [
      timeSlot(41, false, '2026-04-05T16:00:00.000Z', '2026-04-05T17:00:00.000Z'),
    ],
  }),
  baseRequest({
    id: 5,
    candidate_name: 'Quinn Foster',
    status: ST.DECLINED,
    job_id: 1005,
    job_title: 'DevOps Engineer',
    interviewer_name: 'Drew Kim',
    time_slots: [],
  }),
]

/**
 * Employer tenant-wide interview management (`Schedule` with `jobId={undefined}`).
 * URL includes `status` so canceled/declined rows appear alongside active pipelines.
 */
export const jobInterviewManagement: PageDefinition = {
  id: 'job-interview-management',
  name: 'Job Interview Management',
  path: '/jobs/interview_management/?status=9,1,2,4,5',
  roles: ['employer'],
  fullPage: true,

  async setup(page: Page, role: Role) {
    if (role !== 'employer') return

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

    await page.route('**/api/v2/interviews/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(INTERVIEW_CONFIG),
      })
    })

    await page.route(/\/api\/v2\/interviews\/requests\/conflicts\/\d+/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conflicts: [] }),
      })
    })

    await page.route(/\/api\/v2\/interviews\/requests\/\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(INTERVIEW_RESULTS, { limit: 30, offset: 0 })),
      })
    })

    await page.route('**/api/v2/user_preferences**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route('**/api/v2/vendor_entities**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 3,
          results: [
            { id: 5, company_name: 'Acme Staffing' },
            { id: 6, company_name: 'TechBridge Solutions' },
            { id: 7, company_name: 'GlobalTech Recruiting' },
          ],
        }),
      })
    })

    await page.route('**/api/v2/job_titles/titles/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 4,
          results: [
            { id: 1, title: 'Senior Software Engineer' },
            { id: 2, title: 'Data Engineer' },
            { id: 3, title: 'UX Designer' },
            { id: 4, title: 'Product Manager' },
          ],
        }),
      })
    })

    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    await page.route('**/api/contact-us-config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })

    await page.route('**/api/v2/settings/global/summary', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          show_candidate_experience: true,
          validate_postal_codes: false,
          validate_region_code_on_phone_numbers: false,
        }),
      })
    })
  },
}
