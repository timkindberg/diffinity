import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo } from '../mock-utils.js'


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

// CandidateStatus: 1 = Available, 2 = Unavailable, 3 = OnContract
const makeCandidate = (
  id: number,
  full_name: string,
  status: number,
  opts: Record<string, any> = {}
) => ({
  id,
  full_name,
  status,
  avg_rating: opts.avg_rating ?? 0,
  created_at: opts.created_at ?? daysAgo(30),
  experience: opts.experience ?? null,
  country: opts.country ?? {
    id: 1,
    name: 'United States',
    numeric: 840,
    alpha_2_code: 'US',
    alpha_3_code: 'USA',
    address_fields: {},
  },
  latest_work_order: opts.latest_work_order ?? null,
  rate: opts.rate ?? {
    bill_rate: '85.00',
    pay_rate: '65.00',
    type: 1,
    margin: '23.53',
    type_display: 'Per Hour',
    enabled: true,
    currency_code: 'USD',
  },
  rehire_eligibility: opts.rehire_eligibility ?? true,
  residence_status: opts.residence_status ?? { display_name: 'Citizen' },
  unique_id: opts.unique_id ?? `CAND-${id}`,
  system_id: opts.system_id ?? `SYS-${id}`,
  vendor_entity: opts.vendor_entity ?? null,
})

const CANDIDATES = [
  makeCandidate(101, 'Jane Smith', 3 /* OnContract */, {
    experience: 8,
    avg_rating: 4.5,
    vendor_entity: { id: 5, name: 'Acme Staffing' },
    rate: { bill_rate: '145.00', pay_rate: '110.00', type: 1, margin: '24.14', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: { id: 2001, display_id: 'WO-2001', link: '/work_orders/2001' },
    rehire_eligibility: true,
    created_at: daysAgo(120),
  }),
  makeCandidate(102, 'Bob Johnson', 3 /* OnContract */, {
    experience: 5,
    avg_rating: 4.0,
    vendor_entity: { id: 6, name: 'TechBridge Solutions' },
    rate: { bill_rate: '125.00', pay_rate: '95.00', type: 1, margin: '24.00', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: { id: 2002, display_id: 'WO-2002', link: '/work_orders/2002' },
    rehire_eligibility: true,
    created_at: daysAgo(90),
  }),
  makeCandidate(103, 'Maria Garcia', 3 /* OnContract */, {
    experience: 6,
    avg_rating: 4.8,
    vendor_entity: { id: 5, name: 'Acme Staffing' },
    rate: { bill_rate: '95.00', pay_rate: '72.00', type: 1, margin: '24.21', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: { id: 2003, display_id: 'WO-2003', link: '/work_orders/2003' },
    rehire_eligibility: true,
    created_at: daysAgo(75),
  }),
  makeCandidate(104, 'Tom Williams', 1 /* Available */, {
    experience: 4,
    avg_rating: 3.5,
    vendor_entity: { id: 7, name: 'GlobalTech Recruiting' },
    rate: { bill_rate: '110.00', pay_rate: '84.00', type: 1, margin: '23.64', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: null,
    rehire_eligibility: true,
    created_at: daysAgo(60),
  }),
  makeCandidate(105, 'Lisa Chen', 1 /* Available */, {
    experience: 10,
    avg_rating: 5.0,
    vendor_entity: { id: 8, name: 'CyberTalent Inc' },
    rate: { bill_rate: '175.00', pay_rate: '135.00', type: 1, margin: '22.86', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: null,
    rehire_eligibility: true,
    created_at: daysAgo(45),
  }),
  makeCandidate(106, 'Kevin Brown', 2 /* Unavailable */, {
    experience: 3,
    avg_rating: 3.0,
    vendor_entity: { id: 6, name: 'TechBridge Solutions' },
    rate: { bill_rate: '90.00', pay_rate: '68.00', type: 1, margin: '24.44', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: { id: 2008, display_id: 'WO-2008', link: '/work_orders/2008' },
    rehire_eligibility: false,
    created_at: daysAgo(180),
  }),
  makeCandidate(107, 'Sarah Kim', 3 /* OnContract */, {
    experience: 7,
    avg_rating: 4.2,
    vendor_entity: { id: 6, name: 'TechBridge Solutions' },
    rate: { bill_rate: '160.00', pay_rate: '122.00', type: 1, margin: '23.75', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: { id: 2009, display_id: 'WO-2009', link: '/work_orders/2009' },
    rehire_eligibility: true,
    created_at: daysAgo(200),
  }),
  makeCandidate(108, 'Alex Rivera', 3 /* OnContract */, {
    experience: 6,
    avg_rating: 4.7,
    vendor_entity: { id: 9, name: 'DataTalent Co' },
    rate: { bill_rate: '155.00', pay_rate: '118.00', type: 1, margin: '23.87', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: { id: 2012, display_id: 'WO-2012', link: '/work_orders/2012' },
    rehire_eligibility: true,
    created_at: daysAgo(85),
  }),
  makeCandidate(109, 'Diana Patel', 3 /* OnContract */, {
    experience: 9,
    avg_rating: 4.9,
    vendor_entity: { id: 10, name: 'AgileForce Solutions' },
    rate: { bill_rate: '130.00', pay_rate: '99.00', type: 1, margin: '23.85', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: { id: 2014, display_id: 'WO-2014', link: '/work_orders/2014' },
    rehire_eligibility: true,
    created_at: daysAgo(220),
  }),
  makeCandidate(110, 'James Carter', 1 /* Available */, {
    experience: 2,
    avg_rating: 3.8,
    vendor_entity: { id: 5, name: 'Acme Staffing' },
    rate: { bill_rate: '80.00', pay_rate: '60.00', type: 1, margin: '25.00', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: null,
    rehire_eligibility: true,
    created_at: daysAgo(15),
  }),
  makeCandidate(111, 'Emily Zhao', 2 /* Unavailable */, {
    experience: 5,
    avg_rating: 0,
    vendor_entity: { id: 7, name: 'GlobalTech Recruiting' },
    rate: { bill_rate: '100.00', pay_rate: '76.00', type: 1, margin: '24.00', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: null,
    rehire_eligibility: false,
    created_at: daysAgo(300),
  }),
  makeCandidate(112, 'Marcus Lee', 1 /* Available */, {
    experience: 12,
    avg_rating: 4.6,
    vendor_entity: { id: 8, name: 'CyberTalent Inc' },
    rate: { bill_rate: '200.00', pay_rate: '155.00', type: 1, margin: '22.50', type_display: 'Per Hour', enabled: true, currency_code: 'USD' },
    latest_work_order: null,
    rehire_eligibility: true,
    created_at: daysAgo(10),
  }),
]

// Visible fields settings for candidate namespace
const VISIBLE_FIELDS_CANDIDATE = {
  client_data: {
    title: 'Candidate List Data (Client View)',
    default_fields: [
      { blocked: false, display_order: 1, value: true, position: 'attributes_column', icon: 'Company', key: 'vendor_entity', label: 'Vendor' },
      { blocked: false, display_order: 2, value: true, position: 'attributes_column', icon: 'Dollars', key: 'bill_rate', label: 'Bill Rate' },
      { blocked: false, display_order: 3, value: true, position: 'attributes_column', icon: 'Person', key: 'experience', label: 'Experience' },
      { blocked: false, display_order: 4, value: true, position: 'attributes_column', icon: 'Work', key: 'latest_work_order', label: 'Work Order' },
      { blocked: false, display_order: 5, value: true, position: 'attributes_column', icon: 'DateRange', key: 'created_at', label: 'Created' },
      { blocked: false, display_order: 6, value: false, position: 'attributes_column', icon: 'Check', key: 'rehire_eligibility', label: 'Rehire Eligible' },
    ],
    fields: [],
  },
  vendor_data: {
    title: 'Candidate List Data (Vendor View)',
    default_fields: [
      { blocked: false, display_order: 1, value: true, position: 'attributes_column', icon: 'Dollars', key: 'bill_rate', label: 'Bill Rate' },
      { blocked: false, display_order: 2, value: true, position: 'attributes_column', icon: 'Person', key: 'experience', label: 'Experience' },
      { blocked: false, display_order: 3, value: true, position: 'attributes_column', icon: 'DateRange', key: 'created_at', label: 'Created' },
    ],
    fields: [],
  },
}

/**
 * Candidates list page (/candidates/)
 * Tier 1 — employer only.
 *
 * Shows a paginated, filterable list of candidates with status badges
 * (Available, On Contract, Unavailable), vendor, bill rate, experience, work order.
 */
export const candidatesList: PageDefinition = {
  id: 'candidates-list',
  name: 'Candidates List',
  path: '/candidates/',
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

    // Candidate general config — controls create/bulk upload buttons
    await page.route('**/api/v2/candidate/general_config**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_create_candidate: true,
          can_bulk_upload_candidates: true,
        }),
      })
    })

    // Candidate summaries list — main data
    await page.route(/.*\/api\/v2\/candidate\/summaries/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(CANDIDATES)),
      })
    })

    // Vendor entities filter options
    await page.route('**/api/v2/vendor_entities**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 6,
          results: [
            { id: 5, company_name: 'Acme Staffing' },
            { id: 6, company_name: 'TechBridge Solutions' },
            { id: 7, company_name: 'GlobalTech Recruiting' },
            { id: 8, company_name: 'CyberTalent Inc' },
            { id: 9, company_name: 'DataTalent Co' },
            { id: 10, company_name: 'AgileForce Solutions' },
          ],
        }),
      })
    })

    // User preferences — saved filters for candidate namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=saved_filters.*namespace=candidate/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // User preferences — visible fields for candidate namespace
    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=visible_fields.*namespace=candidate/, (route) => {
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

    // Visible fields settings for candidate namespace
    await page.route(/.*\/api\/v2\/settings\/visible_fields_defaults\/?\?.*namespace=candidate/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(VISIBLE_FIELDS_CANDIDATE),
      })
    })

    // Work orders config — referenced by shared ResultsLayout components
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
          { id: 1, title: 'Review timesheet for Bob Johnson', status: 1, due_date: daysAgo(-2), category: 'Timesheet', priority: 'high' },
          { id: 2, title: 'Approve work order modification', status: 1, due_date: daysAgo(-1), category: 'Work Order', priority: 'medium' },
          { id: 3, title: 'Review invoice #INV-5678', status: 1, due_date: daysAgo(0), category: 'Invoice', priority: 'low' },
        ])),
      })
    })
  },
}
