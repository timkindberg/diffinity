import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo } from '../mock-utils.js'

const dateOnly = (n: number) => daysAgo(n).slice(0, 10)

/** ContractorStatus: 1 Pending, 2 OnContract, 3 Ended */
const makeContractor = (
  id: number,
  full_name: string,
  status: number,
  opts: Record<string, unknown> = {},
) => ({
  id,
  full_name,
  status,
  system_id: (opts.system_id as string) ?? `HC-${String(id).padStart(5, '0')}`,
  unique_worker_id: (opts.unique_worker_id as string) ?? `WKR-${id}`,
  work_order_count: (opts.work_order_count as number) ?? 0,
  classification: (opts.classification as string) ?? 'Contingent',
  start_date: (opts.start_date as string) ?? dateOnly(90),
  end_date: (opts.end_date as string | null) ?? null,
  has_sow_wo: (opts.has_sow_wo as boolean) ?? false,
  rehire_eligible: (opts.rehire_eligible as boolean) ?? true,
  vendor_company: (opts.vendor_company as string) ?? 'Acme Staffing',
  vendor_email: (opts.vendor_email as string) ?? 'contact@acme.example.com',
  rating: opts.rating as number | undefined,
  tenure_start: (opts.tenure_start as string | null | undefined) ?? null,
  tenure_is_in_violation: (opts.tenure_is_in_violation as boolean | null | undefined) ?? null,
})

const ALL_CONTRACTORS = [
  makeContractor(5001, 'Elena Vasquez', 2, {
    work_order_count: 2,
    vendor_company: 'Acme Staffing',
    vendor_email: 'acct@acmestaffing.example.com',
    classification: 'IT — Software',
    rating: 4.6,
    tenure_start: dateOnly(400),
    tenure_is_in_violation: false,
    has_sow_wo: true,
    system_id: 'WO-REF-88421',
  }),
  makeContractor(5002, 'Marcus Chen', 2, {
    work_order_count: 1,
    vendor_company: 'TechBridge Solutions',
    vendor_email: 'ops@techbridge.example.com',
    classification: 'Finance',
    rating: 4.2,
    tenure_start: dateOnly(120),
    has_sow_wo: false,
    system_id: 'WO-REF-77210',
  }),
  makeContractor(5003, 'Priya Nair', 1, {
    work_order_count: 0,
    vendor_company: 'GlobalTech Recruiting',
    vendor_email: 'desk@globaltech.example.com',
    classification: 'Data & Analytics',
    rating: undefined,
    tenure_start: null,
  }),
  makeContractor(5004, 'Jordan Williams', 2, {
    work_order_count: 4,
    vendor_company: 'CyberTalent Inc',
    vendor_email: 'support@cybertalent.example.com',
    classification: 'Engineering',
    rating: 5.0,
    tenure_start: dateOnly(200),
    tenure_is_in_violation: false,
    system_id: 'WO-REF-91002',
  }),
  makeContractor(5005, 'Sam Okonkwo', 1, {
    work_order_count: 0,
    vendor_company: 'DataTalent Co',
    vendor_email: 'hello@datatalent.example.com',
    classification: 'Product',
    tenure_start: null,
  }),
  makeContractor(5006, 'Riley Thompson', 2, {
    work_order_count: 1,
    vendor_company: 'AgileForce Solutions',
    vendor_email: 'team@agileforce.example.com',
    classification: 'UX Design',
    rating: 3.9,
    tenure_start: dateOnly(60),
    system_id: 'WO-REF-55188',
  }),
  makeContractor(5007, 'Avery Brooks', 2, {
    work_order_count: 3,
    vendor_company: 'Acme Staffing',
    vendor_email: 'acct@acmestaffing.example.com',
    classification: 'Operations',
    rating: 4.8,
    tenure_start: dateOnly(300),
    tenure_is_in_violation: true,
    has_sow_wo: true,
    system_id: 'WO-REF-44007',
  }),
  makeContractor(5008, 'Morgan Lee', 1, {
    work_order_count: 0,
    vendor_company: 'TechBridge Solutions',
    vendor_email: 'ops@techbridge.example.com',
    classification: 'HR',
    tenure_start: null,
  }),
  makeContractor(5009, 'Casey Rivera', 3, {
    work_order_count: 0,
    end_date: dateOnly(14),
    vendor_company: 'GlobalTech Recruiting',
    vendor_email: 'desk@globaltech.example.com',
    classification: 'Marketing',
    rehire_eligible: false,
    rating: 4.0,
    tenure_start: dateOnly(500),
    tenure_is_in_violation: false,
  }),
  makeContractor(5010, 'Taylor Kim', 3, {
    work_order_count: 0,
    end_date: dateOnly(45),
    vendor_company: 'CyberTalent Inc',
    vendor_email: 'support@cybertalent.example.com',
    classification: 'Legal',
    rehire_eligible: true,
    tenure_start: dateOnly(700),
  }),
  makeContractor(5011, 'Jamie Patel', 2, {
    work_order_count: 2,
    vendor_company: 'DataTalent Co',
    vendor_email: 'hello@datatalent.example.com',
    classification: 'Compliance',
    rating: 4.4,
    tenure_start: dateOnly(150),
    system_id: 'WO-REF-33091',
  }),
  makeContractor(5012, 'Quinn Foster', 1, {
    work_order_count: 0,
    vendor_company: 'AgileForce Solutions',
    vendor_email: 'team@agileforce.example.com',
    classification: 'Support',
    tenure_start: null,
  }),
]

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

const JOBS_CONFIG = {
  is_shortlisting_enabled: true,
  is_card_view_enabled: true,
  is_job_resource_manager_visible: false,
  is_business_unit_visible: true,
  is_program_team_visible: false,
  is_provisioning_enabled: true,
  program_team_label: 'Program Team',
  show_experience: true,
  show_weekly_paid_travel: false,
  close_position_for_all_workflows: false,
  can_view_calculation_pack: false,
  is_vendor_visible: true,
  time_entry_unit: 'hours',
  show_job_code: true,
  show_expense_type: true,
  show_program_team: false,
  show_hiring_team: true,
  show_timesheet_approver: true,
  show_expense_approver: true,
  show_hire_type: true,
  show_contractor_std_hrs_week: true,
  show_monthly_std_hrs_per_day: false,
  show_contract_type: true,
  show_not_qualified_rate: false,
  show_preferred_bill_rate: false,
  show_premium_rate: false,
  show_must_have_skills: true,
  show_nice_to_have_skills: true,
  exemption_status_default: 1,
}

const VISIBLE_FIELDS_CONTRACTORS = {
  client_data: {
    title: 'Contractor List Data (Client View)',
    default_fields: [
      { blocked: false, display_order: 1, value: true, position: 'attributes_column', icon: 'Company', key: 'vendor', label: 'Vendor' },
      { blocked: false, display_order: 2, value: true, position: 'attributes_column', icon: 'Categories', key: 'classification', label: 'Classification' },
      { blocked: false, display_order: 3, value: true, position: 'attributes_column', icon: 'Check', key: 'rehire_eligible', label: 'Rehire Eligible' },
      { blocked: false, display_order: 4, value: true, position: 'attributes_column', icon: 'DateRange', key: 'start_date', label: 'Start date' },
      { blocked: false, display_order: 5, value: true, position: 'attributes_column', icon: 'DateRange', key: 'end_date', label: 'End date' },
      { blocked: false, display_order: 6, value: true, position: 'attributes_column', icon: 'DateRange', key: 'tenure_start', label: 'Tenure Start' },
      { blocked: false, display_order: 7, value: true, position: 'attributes_column', icon: 'Warning', key: 'tenure_status', label: 'Tenure Status' },
      { blocked: false, display_order: 1, value: true, position: 'title_additional_info', icon: 'Star', key: 'rating', label: 'Rating' },
      {
        blocked: false,
        display_order: 8,
        value: 'unique_worker_id',
        position: 'meta',
        icon: 'Person',
        key: 'id_type',
        label: 'ID Type',
        options: [
          { label: 'System ID', value: 'system_id' },
          { label: 'Worker ID', value: 'unique_worker_id' },
        ],
      },
    ],
    fields: [],
  },
  vendor_data: {
    title: 'Contractor List Data (Vendor View)',
    default_fields: [],
    fields: [],
  },
}

/**
 * Contractors list (/contractors/) — employer Next.js page.
 * Paginated cards with filters (status, vendor, source type, location, region, job title, category).
 */
export const contractors: PageDefinition = {
  id: 'contractors',
  name: 'Contractors',
  path: '/contractors/',
  roles: ['employer'],
  fullPage: true,

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

    await page.route('**/api/v2/jobs/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JOBS_CONFIG),
      })
    })

    await page.route(/.*\/api\/v2\/hired_candidate\/\?/, async (route) => {
      const url = new URL(route.request().url())
      const statusParam = url.searchParams.get('status') ?? '1,2'
      const allowed = new Set(statusParam.split(',').map((s) => parseInt(s.trim(), 10)))
      const filtered = ALL_CONTRACTORS.filter((c) => allowed.has(c.status))
      const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
      const limit = parseInt(url.searchParams.get('limit') ?? '30', 10)
      const slice = filtered.slice(offset, offset + limit)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated(slice, {
            count: filtered.length,
            limit,
            offset,
          }),
        ),
      })
    })

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

    await page.route('**/api/v2/work_sites**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 5,
          results: [
            { id: 1, name: 'San Francisco, CA' },
            { id: 2, name: 'Austin, TX' },
            { id: 3, name: 'New York, NY' },
            { id: 4, name: 'Chicago, IL' },
            { id: 5, name: 'Remote' },
          ],
        }),
      })
    })

    await page.route('**/api/v2/regions**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 3,
          results: [
            { id: 1, name: 'West Coast' },
            { id: 2, name: 'East Coast' },
            { id: 3, name: 'Central' },
          ],
        }),
      })
    })

    await page.route('**/api/v2/job_titles/titles/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 6,
          results: [
            { id: 1, title: 'Senior Software Engineer' },
            { id: 2, title: 'Data Engineer' },
            { id: 3, title: 'UX Designer' },
            { id: 4, title: 'Product Manager' },
            { id: 5, title: 'Business Analyst' },
            { id: 6, title: 'DevOps Engineer' },
          ],
        }),
      })
    })

    await page.route('**/api/v2/jobs/categories**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 5,
          results: [
            { id: 1, name: 'Software Engineering' },
            { id: 2, name: 'Data & Analytics' },
            { id: 3, name: 'Design' },
            { id: 4, name: 'Finance' },
            { id: 5, name: 'Information Technology' },
          ],
        }),
      })
    })

    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=saved_filters.*namespace=contractors/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route(/.*\/api\/v2\/user_preferences.*preference_type=visible_fields.*namespace=contractors/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    await page.route('**/api/v2/user_preferences**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route(/.*\/api\/v2\/settings\/visible_fields_defaults\/?\?.*namespace=contractors/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(VISIBLE_FIELDS_CONTRACTORS),
      })
    })

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
        body: JSON.stringify(
          paginated([
            { id: 1, title: 'Review timesheet for Elena Vasquez', status: 1, due_date: daysAgo(-2), category: 'Timesheet', priority: 'high' },
            { id: 2, title: 'Approve work order modification', status: 1, due_date: daysAgo(-1), category: 'Work Order', priority: 'medium' },
            { id: 3, title: 'Review invoice #INV-5678', status: 1, due_date: daysAgo(0), category: 'Invoice', priority: 'low' },
          ]),
        ),
      })
    })
  },
}
