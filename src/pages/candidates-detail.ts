import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo } from '../mock-utils.js'


/** Stable public PDF for resume viewer (PDFObject / iframe). */
const RESUME_VIEWER_PDF_URL =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

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

// Fully-populated candidate profile for ID 456
const CANDIDATE_PROFILE = {
  id: 456,
  first_name: 'Jane',
  last_name: 'Smith',
  middle_name: 'Marie',
  full_name: 'Jane Marie Smith',
  preferred_first_name: 'Jane',
  preferred_last_name: 'Smith',
  status: 3, // OnContract
  system_id: 'SYS-456',
  unique_id: 'CAND-456',
  email: 'jane.smith@techbridge.com',
  alternate_email: 'jsmith.personal@gmail.com',
  contact_number: '+1-415-555-0192',
  alternate_contact_number: '+1-415-555-0193',
  address_line_one: '123 Market Street',
  address_line_two: 'Suite 400',
  address_line_three: null,
  city: 'San Francisco',
  county: null,
  neighborhood: null,
  subdivision_name: 'CA',
  country_code: 'US',
  postal_code: '94105',
  country: {
    id: 1,
    name: 'United States',
    numeric: 840,
    alpha_2_code: 'US',
    alpha_3_code: 'USA',
    address_fields: {
      city: { required: true, label_override: '' },
      county: { required: false, label_override: '' },
      postal_code: { required: true, label_override: 'Zip Code' },
      subdivision: { required: true, label_override: 'State' },
      address_line_one: { required: true, label_override: '' },
      address_line_two: { required: false, label_override: '' },
    },
  },
  client_contractor_email: 'jane.smith@cruisecorp.com',
  client_email: 'jane.smith@cruisecorp.com',
  client_contractor_id: 'CCE-78901',
  external_reference_id: 'VND-EXT-456',
  msp_contractor_id: 78901,
  username: 'jsmith456',
  experience: 8,
  skills: ['Python', 'AWS', 'Kubernetes', 'Data Engineering', 'Spark', 'SQL', 'Docker'],
  residence_status: { id: 1, display_name: 'Citizen' },
  locale: { label: 'English (US)', value: 'en-US', country: 'US' },
  vendor_entity: { id: 6, name: 'TechBridge Solutions' },
  vendor: { id: 200, name: 'Alice Johnson' },
  worker_classification: { id: 1, display_name: 'W2 Employee' },
  created_by_client: false,
  rehire_eligibility: true,
  rehire_eligibility_reason: null,
  weekday_travel: true,
  direct_hire: false,
  contract_to_hire: true,
  previous_experience_at_client_display: 'Yes — 2 years (2020–2022)',
  emergency_contact_first_name: 'Robert',
  emergency_contact_last_name: 'Smith',
  emergency_contact_relation: 'Spouse',
  emergency_contact_number: '+1-415-555-0100',
  emergency_contact_country_code: 'US',
  rates: [
    {
      type: 1,
      type_display: 'Per Hour',
      bill_rate: '145.00',
      pay_rate: '110.00',
      margin: '24.14',
      currency_code: 'USD',
    },
  ],
  comments: '<p>Jane is a highly skilled data engineer with 8 years of experience. Previous work at Cruise Corp 2020-2022. Strong Python and cloud skills. Eligible for rehire.</p>',
  generic_fields: {},
  custom_fields: null,
}

const CANDIDATE_DETAILS = {
  profile: CANDIDATE_PROFILE,
  resume: {
    url: RESUME_VIEWER_PDF_URL,
    download_url: RESUME_VIEWER_PDF_URL,
  },
  config: {
    can_upload_resume: true,
    is_google_viewer_disabled: false,
    is_pdf_viewer_enabled: true,
    show_checklists: true,
    can_edit: true,
    can_create_worker_profile: true,
    can_resend_credential_email: true,
    field_visibility: {
      additional_address_lines: true,
      address_line_one: true,
      address_line_three: false,
      address_line_two: true,
      alternate_contact_number: true,
      alternate_email: true,
      city: true,
      client_contractor_email: true,
      client_contractor_id: true,
      client_email: true,
      comments: true,
      contact_number: true,
      contract_to_hire: true,
      country_code: true,
      county: false,
      direct_hire: true,
      email: true,
      emergency_contact: true,
      experience: true,
      external_reference_id: true,
      generic_fields: false,
      locale: true,
      msp_contractor_id: true,
      neighborhood: false,
      postal_code: true,
      previous_experience_at_client_cds: true,
      rates: true,
      rehire_eligibility: true,
      residence_status: true,
      skills: true,
      subdivision_name: true,
      unique_id: true,
      username: true,
      vendor: true,
      vendor_entity: true,
      vendor_manager: true,
      weekday_travel: true,
      worker_classification: true,
    },
    tab_config: {
      resume: { show: true, edit: true },
      experience_summary: { show: true, edit: true },
      document_upload: { show: true, edit: true },
      checklists: { show: true, edit: false },
      applied_jobs: { show: true, edit: false },
      work_history: { show: true, edit: false },
    },
    legacy_custom_fields_config: null,
  },
  experience_summary: {
    experience: [
      {
        id: 1,
        title: 'Senior Data Engineer',
        company_name: 'TechBridge Solutions',
        description: 'Led data pipeline development and migration to AWS.',
        exp_loc: 'San Francisco, CA',
        start_date: '2022-03-01',
        end_date: '2025-12-31',
      },
      {
        id: 2,
        title: 'Data Engineer',
        company_name: 'Cruise Corporation',
        description: 'Built ETL pipelines for analytics platform.',
        exp_loc: 'San Francisco, CA',
        start_date: '2020-01-01',
        end_date: '2022-02-28',
      },
      {
        id: 3,
        title: 'Junior Data Analyst',
        company_name: 'DataCo Inc',
        description: 'SQL reporting and dashboard development.',
        exp_loc: 'Austin, TX',
        start_date: '2017-06-01',
        end_date: '2019-12-31',
      },
    ],
    education: [
      {
        id: 1,
        degree: 'B.S. Computer Science',
        institute: 'University of Texas at Austin',
        edu_loc: 'Austin, TX',
        start_date: '2013-09-01',
        end_date: '2017-05-31',
        marks: null,
      },
    ],
    certifications: [
      {
        id: 1,
        course: 'AWS Certified Data Analytics – Specialty',
        institute: 'Amazon Web Services',
        cert_loc: 'Online',
        start_date: '2022-06-01',
        end_date: '2025-06-01',
      },
      {
        id: 2,
        course: 'Databricks Certified Associate Developer for Apache Spark',
        institute: 'Databricks',
        cert_loc: 'Online',
        start_date: '2023-01-01',
        end_date: '2026-01-01',
      },
    ],
  },
  documents: [
    {
      id: 101,
      file_name: 'Jane_Smith_Resume_2025',
      extension: 'pdf',
      created_at: daysAgo(30),
      document_type: 'Resume',
      created_by_fullname: 'Alice Johnson',
      can_vendor_view: true,
      can_edit_can_vendor_view: true,
      url: '#',
      actions: { update: '/api/v2/candidate/documents/101/', delete: '/api/v2/candidate/documents/101/' },
    },
    {
      id: 102,
      file_name: 'Background_Check_Consent',
      extension: 'pdf',
      created_at: daysAgo(60),
      document_type: 'Compliance',
      created_by_fullname: 'James Employer',
      can_vendor_view: false,
      can_edit_can_vendor_view: true,
      url: '#',
      actions: { update: '/api/v2/candidate/documents/102/', delete: '/api/v2/candidate/documents/102/' },
    },
  ],
}

// Work history rows
const WORK_HISTORY = [
  {
    title: 'Senior Data Engineer',
    job_id: 101,
    vendor_name: 'TechBridge Solutions',
    submitted_date: daysAgo(30),
    wo_id: 2001,
    wo_status: 1, // Active
    wo_start_date: daysAgo(180),
    wo_end_date: daysAgo(-90),
    can_view_wo: true,
    can_view_job: true,
  },
  {
    title: 'Data Engineer',
    job_id: 87,
    vendor_name: 'TechBridge Solutions',
    submitted_date: daysAgo(400),
    wo_id: 1856,
    wo_status: 3, // Ended
    wo_start_date: daysAgo(730),
    wo_end_date: daysAgo(400),
    can_view_wo: true,
    can_view_job: true,
  },
]

// Activity log — must match `Log` in assets/js/settings/settingsApi.ts (ActivityLogRow / drawer)
const CANDIDATE_ACTIVITY_LOG: Array<{
  log_id: string
  log: string | null
  user_id: number | null
  component: string | null
  component_id: string | null
  created_at: string
  date: string
  impersonator_name: string | null
  viewed_by_user_with_wo_end_perm_only: boolean | null
  log_contains_vendor_info: boolean
  user_full_name: string | null
  was_sow_skipped: boolean | null
  bulk_update_id?: number | null
}> = [
  {
    log_id: 'vr-cl-1',
    log: '**Profile** updated — rates, skills, and contact information revised.',
    user_id: 10,
    component: 'candidate',
    component_id: '456',
    created_at: daysAgo(2),
    date: daysAgo(2),
    impersonator_name: null,
    viewed_by_user_with_wo_end_perm_only: false,
    log_contains_vendor_info: false,
    user_full_name: 'James Employer',
    was_sow_skipped: false,
  },
  {
    log_id: 'vr-cl-2',
    log: '**Document uploaded:** Jane_Smith_Resume_2025.pdf (Resume).',
    user_id: 200,
    component: null,
    component_id: null,
    created_at: daysAgo(18),
    date: daysAgo(18),
    impersonator_name: null,
    viewed_by_user_with_wo_end_perm_only: false,
    log_contains_vendor_info: true,
    user_full_name: 'Alice Johnson',
    was_sow_skipped: false,
  },
  {
    log_id: 'vr-cl-3',
    log: '**Work history** linked — work order #2001 associated with candidate.',
    user_id: 10,
    component: null,
    component_id: null,
    created_at: daysAgo(45),
    date: daysAgo(45),
    impersonator_name: null,
    viewed_by_user_with_wo_end_perm_only: false,
    log_contains_vendor_info: false,
    user_full_name: 'James Employer',
    was_sow_skipped: false,
  },
  {
    log_id: 'vr-cl-4',
    log: '**Rehire eligibility** set to eligible.',
    user_id: 10,
    component: null,
    component_id: null,
    created_at: daysAgo(90),
    date: daysAgo(90),
    impersonator_name: null,
    viewed_by_user_with_wo_end_perm_only: false,
    log_contains_vendor_info: false,
    user_full_name: 'James Employer',
    was_sow_skipped: false,
  },
  {
    log_id: 'vr-cl-5',
    log: '**Candidate** created in VNDLY.',
    user_id: 200,
    component: null,
    component_id: null,
    created_at: daysAgo(120),
    date: daysAgo(120),
    impersonator_name: null,
    viewed_by_user_with_wo_end_perm_only: false,
    log_contains_vendor_info: true,
    user_full_name: 'Alice Johnson',
    was_sow_skipped: false,
  },
]

// Job application checklist rows (Checklists tab — sowJobApi.getWorkerChecklists)
const CHECKLIST_ACTION_ROWS = [
  {
    action_id: 'VR-JAA-1',
    id: 9001,
    title: 'I-9 employment eligibility verification',
    status: 2,
    renewal_date: daysAgo(-14),
    subject_name: 'Jane Marie Smith',
    checklist_id: 501,
    is_expiring_soon: false,
    checklist_type: 1,
    comments: '',
  },
  {
    action_id: 'VR-JAA-2',
    id: 9002,
    title: 'Background screening consent',
    status: 6,
    renewal_date: null,
    subject_name: 'Jane Marie Smith',
    checklist_id: 502,
    is_expiring_soon: false,
    checklist_type: 1,
    comments: '',
  },
  {
    action_id: 'VR-JAA-3',
    id: 9003,
    title: 'Professional license — CPA (credentials)',
    status: 2,
    renewal_date: daysAgo(-60),
    subject_name: 'Jane Marie Smith',
    checklist_id: 503,
    is_expiring_soon: true,
    checklist_type: 2,
    comments: '',
  },
]

/**
 * Candidates detail page (/candidates/456/)
 * Tier 2 — employer only.
 *
 * Full candidate profile with tabs: Profile, Resume, Experience Summary,
 * Documents, Applied Jobs, Work History, Checklists.
 * Default tab shows Profile + Work History sections.
 */
export const candidatesDetail: PageDefinition = {
  id: 'candidates-detail',
  name: 'Candidates Detail',
  path: '/candidates/456/',
  roles: ['employer'],
  fullPage: true,

  async setup(page: Page, _role: Role) {
    // Account me — employer only
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

    // Main candidate details endpoint — profile, resume, config, experience_summary, documents
    await page.route(/.*\/api\/v2\/candidate\/456\/details/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CANDIDATE_DETAILS),
      })
    })

    // Candidate activity log (drawer in header) — URL may or may not have trailing slash
    await page.route('**/api/v2/candidate/456/activity_log*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CANDIDATE_ACTIVITY_LOG),
      })
    })

    // Checklists tab: list (`.../job_application_actions/?...`), totals, workflow settings
    await page.route(/.*\/api\/v2\/job_application_actions.*/, (route) => {
      if (route.request().method() !== 'GET') {
        return route.continue()
      }
      const path = new URL(route.request().url()).pathname
      if (/^\/api\/v2\/job_application_actions\/\d+\/?$/.test(path)) {
        return route.continue()
      }
      const url = route.request().url()
      if (url.includes('get_total_counts')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ total_count: CHECKLIST_ACTION_ROWS.length }),
        })
      }
      if (url.includes('get-job-application-workflow-settings')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            offer_release: {
              additional_fields: {},
              allow_verification_override: false,
              block_offer_release_on_pending_approval: false,
            },
            onboarding: { additional_fields: {} },
          }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated(CHECKLIST_ACTION_ROWS, {
            count: CHECKLIST_ACTION_ROWS.length,
            limit: 100,
            offset: 0,
          }),
        ),
      })
    })

    // Work history table (shown on default Profile tab)
    await page.route(/.*\/api\/v2\/work-orders\/work-history\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(WORK_HISTORY),
      })
    })

    // Generic fields form context (for custom fields section in Profile)
    await page.route(/.*\/api\/v2\/generic_form_context\/candidate\/.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    // Candidate form config (used by legacy custom fields display)
    await page.route('**/api/v2/candidate/form_config**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          residence_statuses: [
            { label: 'Citizen', value: 1 },
            { label: 'Permanent Resident', value: 2 },
            { label: 'Visa Holder', value: 3 },
          ],
          additional_required_fields: [],
          default_values: {},
          base_currency_code: 'USD',
          is_multi_currency_enabled: false,
          unique_id_uses_security_id: false,
          unique_id_uses_dob: false,
          security_id_validator: '',
          emergency_contact_enabled: true,
          use_markup_based_strategy: true,
          field_visibility: {},
          field_editability: {},
          is_resume_parsing_enabled: false,
          can_upload_resume: true,
          legacy_custom_fields_config: null,
        }),
      })
    })

    // General candidate config
    await page.route('**/api/v2/candidate/config/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          show_candidate_experience: true,
          require_candidate_resume: false,
        }),
      })
    })

    // Work orders config
    await page.route(/.*\/api\/v2\/work-orders\/config\//, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_view_contractor_bill_rate: true,
          can_view_organization_unit: true,
          can_view_resource_manager: true,
          can_view_attachments: true,
          can_view_vendors: true,
          can_bulk_update: true,
          outbound_provisioning_enabled: false,
        }),
      })
    })

    // User tasks list (nav task drawer)
    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary|categories|config|task_types|bulk)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          { id: 1, title: 'Review timesheet for Bob Johnson', status: 1, due_date: daysAgo(-2), category: 'Timesheet', priority: 'high' },
          { id: 2, title: 'Approve work order modification', status: 1, due_date: daysAgo(-1), category: 'Work Order', priority: 'medium' },
        ])),
      })
    })

    // Checklist filters sidebar (UserPreferenceNamespace.VENDOR_CANDIDATE_CHECKLIST_ACTIONS)
    await page.route(
      /.*\/api\/v2\/user_preferences.*preference_type=saved_filters.*namespace=vendor_candidate_checklist_actions/,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      },
    )

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
  },
}
