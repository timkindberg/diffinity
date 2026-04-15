import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow } from '../mock-utils.js'


const CANDIDATE_ID = 456
const JOB_ID = 123

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

// Candidate data — returned by /api/v2/candidate/:id
const CANDIDATE = {
  id: CANDIDATE_ID,
  full_name: 'Jane Smith',
  get_first_name: 'Jane',
  first_name: 'Jane',
  get_preferred_first_name: 'Jane',
  preferred_first_name: 'Jane',
  get_preferred_last_name: '',
  preferred_last_name: '',
  get_last_name: 'Smith',
  last_name: 'Smith',
  get_middle_name: '',
  middle_name: '',
  initials: 'JS',
  email: 'jane.smith@email.com',
  alternate_email: '',
  formatted_contact_number: '+1 (415) 555-0100',
  formatted_alternate_contact_number: '',
  formatted_emergency_contact_number: '',
  alpha_two_contact_country_code: 'US',
  alpha_two_alternate_contact_country_code: 'US',
  alpha_two_emergency_contact_country_code: 'US',
  contact_country_code: 'US',
  alternate_contact_country_code: 'US',
  emergency_contact_country_code: 'US',
  address_line_one: '123 Main Street',
  address_line_two: 'Apt 4B',
  address_line_three: '',
  city: 'San Francisco',
  county: '',
  neighborhood: '',
  subdivision_name: 'California',
  get_state_code: 'CA',
  state: 'CA',
  zip: '94105',
  country_code: 'USA',
  country: { id: 1, name: 'United States', alpha_3_code: 'USA', alpha_2_code: 'US' },
  residence_status: 1,
  locale: 'en',
  experience: 5,
  skills: ['Python', 'React', 'Node.js', 'TypeScript', 'AWS'],
  external_reference_id: 'EMP-JS-4567',
  vendor: 5,
  vendor_entity: 5,
  vendor_display_name: 'Sarah Vendor',
  vendor_user_name: 'sarah@acmestaffing.com',
  unique_id: 'JS0115XXXXX',
  status: 1, // Available
  final_status_val: 'Available',
  profile_pic: null,
  comments: '<p>Strong candidate with excellent Python and React skills. Has worked on several enterprise-grade projects. Recommended for senior roles.</p>',
  type_cds: null,
  type_cds_id: null,
  generic_fields: {},
  previous_experience_at_client_cds: null,
  previous_experience_at_client_cds_display: null,
  is_erased: false,
  master_candidate: { do_not_rehire: false },
  username_display: null,
  client_contractor_id_display: null,
  msp_contractor_id_display: null,
  client_contractor_email_display: null,
  client_email_display: null,
  jobpreference: {
    contract_to_hire: true,
    direct_hire: false,
    weekday_travel: true,
  },
  rates: [
    {
      id: 1,
      type: 1,
      type_display: 'Hourly',
      bill_rate: '135.00',
      pay_rate: '108.00',
      currency_code: 'USD',
      enabled: true,
    },
  ],
  created_at: daysAgo(30),
  updated_at: daysAgo(3),
}

// Activity log for candidate/job (ActivityLog.jsx → renderLogMessage)
// Shape: log_id, log | template_log, details, date, user_full_name, optional header/link/impersonator_name
const ACTIVITY_LOG = [
  {
    log_id: 1,
    log: '',
    template_log: 'Submitted **{{candidate_name}}** to requisition **{{job_title}}** at proposed bill rate {{bill_rate}} USD/hr.',
    details: {
      candidate_name: 'Jane Smith',
      job_title: 'Senior Software Engineer',
      bill_rate: '135.00',
    },
    date: daysAgo(14),
    user_full_name: 'Sarah Vendor',
    impersonator_name: null,
    header: 'Application',
    link: null,
    link_text: null,
  },
  {
    log_id: 2,
    log: 'Resume and skills profile screened — candidate meets **must-have** technical requirements (Python, React, cloud).',
    template_log: null,
    details: {},
    date: daysAgo(12),
    user_full_name: 'James Employer',
    impersonator_name: null,
    header: null,
    link: null,
    link_text: null,
  },
  {
    log_id: 3,
    log: 'HM phone screen completed; hiring manager requested panel interview for backend architecture depth.',
    template_log: null,
    details: {},
    date: daysAgo(9),
    user_full_name: 'Alice Manager',
    impersonator_name: null,
    header: 'Screening',
    link: null,
    link_text: null,
  },
  {
    log_id: 4,
    log: 'Technical panel interview held — **strong** system design discussion; panel recommends advance to final round.',
    template_log: null,
    details: {},
    date: daysAgo(6),
    user_full_name: 'Elena Ruiz',
    impersonator_name: 'MSP Coordinator',
    header: null,
    link: null,
    link_text: null,
  },
  {
    log_id: 5,
    log: 'Client requested updated availability for onsite hybrid weeks; vendor confirmed **Mon–Thu** onsite acceptable.',
    template_log: null,
    details: {},
    date: daysAgo(4),
    user_full_name: 'Sarah Vendor',
    impersonator_name: null,
    header: null,
    link: '/vendor/off/jobs/',
    link_text: 'View open requisitions',
  },
  {
    log_id: 6,
    log: 'Compliance packet marked complete — I-9, background check, and right-to-work docs on file.',
    template_log: null,
    details: {},
    date: daysAgo(2),
    user_full_name: 'Compliance Bot',
    impersonator_name: null,
    header: 'Compliance',
    link: null,
    link_text: null,
  },
  {
    log_id: 7,
    log: 'Offer stage: client HR aligned on start date and rate card; awaiting final **written** approval in Workday.',
    template_log: null,
    details: {},
    date: daysAgo(1),
    user_full_name: 'James Employer',
    impersonator_name: null,
    header: null,
    link: null,
    link_text: null,
  },
]

// Workflow log — WorkflowLog.jsx expects fetch body `{ results: [...] }` with `label`, `data.step_message`, `updated_at`
const GWF_CANDIDATE_WORKFLOW_RESULTS = [
  {
    uuid: 'gwf-vc-1',
    label: '**Application intake** — candidate record linked to requisition',
    updated_at: daysAgo(14),
    definition_namespace: 'internal::candidate_application',
    root_obj_type: 'Candidate',
    root_obj_id: CANDIDATE_ID,
    data: {
      step_message: 'Vendor submission received; duplicate check passed against active pipeline.',
      event_id: 'app-intake-88421',
    },
    directives: {},
  },
  {
    uuid: 'gwf-vc-2',
    label: '**Resume parse & enrichment** completed',
    updated_at: daysAgo(13),
    definition_namespace: 'internal::candidate_application',
    root_obj_type: 'Candidate',
    root_obj_id: CANDIDATE_ID,
    data: {
      step_message: 'Skills normalized to taxonomy v3; years of experience set to 5.',
    },
    directives: {},
  },
  {
    uuid: 'gwf-vc-3',
    label: '**Compliance screening** — background check initiated',
    updated_at: daysAgo(10),
    definition_namespace: 'integrations::checkr',
    root_obj_type: 'Candidate',
    root_obj_id: CANDIDATE_ID,
    data: {
      step_message: 'Standard package ordered; estimated turnaround 3–5 business days.',
      event_id: 'bgc-pkg-99210',
    },
    directives: {},
  },
  {
    uuid: 'gwf-vc-4',
    label: '**Interview workflow** — panel scheduled',
    updated_at: daysAgo(6),
    definition_namespace: 'internal::scheduling',
    root_obj_type: 'Candidate',
    root_obj_id: CANDIDATE_ID,
    data: {
      step_message: 'Calendar holds sent to HM and candidate; Teams link generated.',
    },
    directives: {},
  },
  {
    uuid: 'gwf-vc-5',
    label: '**Client feedback** logged — proceed to offer alignment',
    updated_at: daysAgo(3),
    definition_namespace: 'internal::candidate_application',
    root_obj_type: 'Candidate',
    root_obj_id: CANDIDATE_ID,
    data: {
      step_message: 'Hiring manager notes: strong backend and communication; no blockers.',
      event_id: 'fb-panel-44102',
    },
    directives: {},
  },
]

// Work history — returned by /api/v2/work-orders/work-history/?candidate_id=456
const WORK_HISTORY = [
  {
    title: 'Data Engineer',
    job_id: 98,
    vendor_name: 'Acme Staffing',
    submitted_date: daysAgo(120),
    wo_id: 2001,
    wo_status: 3, // Active
    wo_start_date: daysAgo(110),
    wo_end_date: daysFromNow(70),
    can_view_wo: true,
    can_view_job: true,
  },
  {
    title: 'Backend Developer',
    job_id: 77,
    vendor_name: 'Acme Staffing',
    submitted_date: daysAgo(365),
    wo_id: 1450,
    wo_status: 6, // Ended
    wo_start_date: daysAgo(360),
    wo_end_date: daysAgo(90),
    can_view_wo: true,
    can_view_job: true,
  },
]

/**
 * Vendor Candidate Detail page (/vendor/off/candidate/:id/view/?job_id=:job_id)
 * Django template rendered by VR middleware with mock context.
 * Multiple React bundles mount: candidate_profile, candidate_activity_log,
 * workflow_log, job_applicants.
 */
export const vendorCandidateDetail: PageDefinition = {
  id: 'vendor-candidate-detail',
  name: 'Vendor Candidate Detail',
  path: `/vendor/off/candidate/${CANDIDATE_ID}/view/`,
  roles: ['vendor'],
  fullPage: true,
  django: true,

  async waitForReady(page: Page) {
    // Wait for the candidate name to appear (rendered by CandidateBaseProfileReadOnly)
    try {
      await page.waitForSelector('[data-testid="candidate_full_name"]', { timeout: 20000 })
    } catch {
      await page.waitForTimeout(3000)
    }
    // Extra settle time for activity log and work history to load
    await page.waitForTimeout(1500)
  },

  async setup(page: Page, _role: Role) {
    // Account me — vendor role
    await page.route('**/api/v2/accounts/me/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 20,
          full_name: 'Sarah Vendor',
          email: 'sarah@acmestaffing.com',
          role: 'vendor',
          rbac_role: 'vendor_admin',
          tenant: 'cruise',
          environment: 'local',
          timezone: 'America/New_York',
          locale: 'en',
          vendor_id: 5,
          vendor_entity_id: 5,
          employer_id: null,
          isVendorRole: true,
          isCandidateRole: false,
          isEmployerRole: false,
        }),
      })
    })

    // Navigation menu
    await page.route('**/api/v2/nav/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NAV_CONFIG_VENDOR),
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

    // Candidate detail — the main data call by CandidateBaseProfile
    await page.route(new RegExp(`.*\\/api\\/v2\\/candidate\\/${CANDIDATE_ID}\\/?$`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CANDIDATE),
      })
    })

    // Candidate activity log for this job
    await page.route(
      new RegExp(`.*\\/api\\/v2\\/candidate\\/${CANDIDATE_ID}\\/activity_log\\/${JOB_ID}`),
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ACTIVITY_LOG),
        })
      }
    )

    // Candidate activity log (without job ID — fallback)
    await page.route(
      new RegExp(`.*\\/api\\/v2\\/candidate\\/${CANDIDATE_ID}\\/activity_log\\/?$`),
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ACTIVITY_LOG),
        })
      }
    )

    // Applicant work history
    await page.route(/.*\/api\/v2\/work-orders\/work-history\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(WORK_HISTORY),
      })
    })

    // Workflow log — GET returns paginated `{ results }` (not a bare array); root_obj_type=Candidate from vendor_candidate_view.html
    await page.route(/.*\/api\/v2\/gwf\/instance\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: GWF_CANDIDATE_WORKFLOW_RESULTS }),
      })
    })

    // Currency options (used by candidate_profile/CandidateBaseProfile)
    await page.route('**/api/currency/options/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          default_currency: 'USD',
          options: [
            { value: 'USD', label: 'USD - US Dollar' },
            { value: 'EUR', label: 'EUR - Euro' },
            { value: 'GBP', label: 'GBP - British Pound' },
          ],
        }),
      })
    })

    await page.route('**/api/currency/options', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          default_currency: 'USD',
          options: [
            { value: 'USD', label: 'USD - US Dollar' },
            { value: 'EUR', label: 'EUR - Euro' },
          ],
        }),
      })
    })

    // Custom data sources (useCustomDataSourceRow for contractor_classifications)
    await page.route(/.*\/api\/v2\/customization\/datasources\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      })
    })

    // Work order config (referenced by shared components)
    await page.route('**/api/v2/work-orders/config/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_bill_rate_enabled: true,
          is_pay_rate_enabled: true,
          is_markup_enabled: false,
        }),
      })
    })

    // User tasks list (nav task drawer)
    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, title: 'Apply candidate to Senior Software Engineer', status: 1, due_date: daysFromNow(3), category: 'Job Applicant', priority: 'high' },
          { id: 2, title: 'Review work order for Jane Smith', status: 1, due_date: daysFromNow(5), category: 'Work Order', priority: 'medium' },
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

    // Generic form schema for candidate (used by VndlyFormWithConditionals / CandidateCustomFieldsJsonSchema)
    await page.route('**/api/v2/generic_form/schema/candidate/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schema: { type: 'object', properties: {} },
          uiSchema: {},
          rules: [],
        }),
      })
    })

    // Global settings (used by various components)
    await page.route('**/api/v2/settings/global/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })
  },
}
