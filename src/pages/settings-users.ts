import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated } from '../mock-utils.js'

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

const MANAGE_USERS_CONFIG = {
  auth_providers: [{ value: 1, label: 'VNDLY Login' }],
  can_edit_spend_authority: true,
  can_assign_organization_roles: true,
  can_assign_program_entity_roles: false,
  can_read_organization_roles: true,
  can_view_upload_options: true,
  can_reassign: true,
  contractors_as_managers: false,
  min_bu_level_selectable: 0,
}

const USERS = [
  {
    id: 101, profile_id: 1001, username: 'james.employer', full_name: 'James Employer',
    email: 'james@cruiseautomation.com', is_deleted: false, business_unit: 'North America',
    business_unit_id: 1, external_id: 'EMP-001', report_to_user: '', roles: 'Admin',
    contact_country_code: 'US', contact_number: '+1 (415) 555-0101', cost_center_project: '',
    custom_Fields: {}, work_site: 1, allowed_work_sites: [1],
  },
  {
    id: 102, profile_id: 1002, username: 'alice.manager', full_name: 'Alice Manager',
    email: 'alice.manager@cruiseautomation.com', is_deleted: false, business_unit: 'North America',
    business_unit_id: 1, external_id: 'EMP-002', report_to_user: 'james.employer',
    roles: 'Hiring Manager', contact_country_code: 'US', contact_number: '+1 (415) 555-0102',
    cost_center_project: 'ENG-1000', custom_Fields: {}, work_site: 1, allowed_work_sites: [1],
  },
  {
    id: 103, profile_id: 1003, username: 'elena.ruiz', full_name: 'Elena Ruiz',
    email: 'elena.ruiz@cruiseautomation.com', is_deleted: false, business_unit: 'EMEA',
    business_unit_id: 2, external_id: 'EMP-003', report_to_user: 'james.employer',
    roles: 'Program Manager', contact_country_code: 'GB', contact_number: '+44 20 7946 0958',
    cost_center_project: '', custom_Fields: {}, work_site: 2, allowed_work_sites: [2],
  },
  {
    id: 104, profile_id: 1004, username: 'raj.patel', full_name: 'Raj Patel',
    email: 'raj.patel@cruiseautomation.com', is_deleted: false, business_unit: 'APAC',
    business_unit_id: 3, external_id: 'EMP-004', report_to_user: 'elena.ruiz',
    roles: 'Hiring Manager', contact_country_code: 'IN', contact_number: '+91 22 2771 0000',
    cost_center_project: 'PROJ-4421', custom_Fields: {}, work_site: 3, allowed_work_sites: [3],
  },
  {
    id: 105, profile_id: 1005, username: 'maria.chen', full_name: 'Maria Chen',
    email: 'maria.chen@cruiseautomation.com', is_deleted: false, business_unit: 'North America',
    business_unit_id: 1, external_id: 'EMP-005', report_to_user: 'alice.manager',
    roles: 'Analyst', contact_country_code: 'US', contact_number: '+1 (212) 555-0105',
    cost_center_project: '', custom_Fields: {}, work_site: 1, allowed_work_sites: [1],
  },
  {
    id: 106, profile_id: 1006, username: 'tom.wilson', full_name: 'Tom Wilson',
    email: 'tom.wilson@cruiseautomation.com', is_deleted: false, business_unit: 'North America',
    business_unit_id: 1, external_id: 'EMP-006', report_to_user: 'james.employer',
    roles: 'Viewer', contact_country_code: 'US', contact_number: '',
    cost_center_project: '', custom_Fields: {}, work_site: 1, allowed_work_sites: [1],
  },
  {
    id: 107, profile_id: 1007, username: 'sophie.laurent', full_name: 'Sophie Laurent',
    email: 'sophie.laurent@cruiseautomation.com', is_deleted: false, business_unit: 'EMEA',
    business_unit_id: 2, external_id: 'EMP-007', report_to_user: 'elena.ruiz',
    roles: 'Vendor Manager', contact_country_code: 'FR', contact_number: '+33 1 42 68 53 00',
    cost_center_project: '', custom_Fields: {}, work_site: 2, allowed_work_sites: [2],
  },
  {
    id: 108, profile_id: 1008, username: 'david.kim', full_name: 'David Kim',
    email: 'david.kim@cruiseautomation.com', is_deleted: false, business_unit: 'APAC',
    business_unit_id: 3, external_id: 'EMP-008', report_to_user: 'raj.patel',
    roles: 'Recruiter, Hiring Manager', contact_country_code: 'KR', contact_number: '+82 2 1234 5678',
    cost_center_project: 'ENG-2000', custom_Fields: {}, work_site: 3, allowed_work_sites: [3],
  },
  {
    id: 109, profile_id: 1009, username: 'lisa.thompson', full_name: 'Lisa Thompson',
    email: 'lisa.thompson@cruiseautomation.com', is_deleted: false, business_unit: 'North America',
    business_unit_id: 1, external_id: 'EMP-009', report_to_user: 'james.employer',
    roles: 'Finance', contact_country_code: 'US', contact_number: '+1 (312) 555-0109',
    cost_center_project: '', custom_Fields: {}, work_site: 1, allowed_work_sites: [1],
  },
  {
    id: 110, profile_id: 1010, username: 'carlos.garcia', full_name: 'Carlos Garcia',
    email: 'carlos.garcia@cruiseautomation.com', is_deleted: false, business_unit: 'North America',
    business_unit_id: 1, external_id: 'EMP-010', report_to_user: 'alice.manager',
    roles: 'Admin', contact_country_code: 'US', contact_number: '+1 (305) 555-0110',
    cost_center_project: '', custom_Fields: {}, work_site: 1, allowed_work_sites: [1],
  },
]

export const settingsUsers: PageDefinition = {
  id: 'settings-users',
  name: 'Settings Users',
  path: '/settings/users/',
  roles: ['employer'],
  fullPage: true,

  async waitForReady(page: Page) {
    await page.waitForSelector('text=Manage Users', { timeout: 20000 })
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }) } catch { /* ignore */ }
    await page.waitForTimeout(1500)
  },

  async setup(page: Page, _role: Role) {
    await page.route('**/api/v2/accounts/me/', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 42, full_name: 'James Employer', email: 'james@cruiseautomation.com',
          role: 'employer', rbac_role: 'admin', tenant: 'cruise', environment: 'local',
          timezone: 'America/New_York', locale: 'en', employer_id: 1,
          vendor_id: null, vendor_entity_id: null,
          isVendorRole: false, isCandidateRole: false, isEmployerRole: true,
        }),
      }),
    )

    await page.route('**/api/v2/nav/config', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NAV_CONFIG_EMPLOYER) }),
    )

    await page.route('**/api/v2/client/feature-flags/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) }),
    )

    await page.route(/.*\/api\/v2\/user_tasks\//, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paginated([])) }),
    )

    await page.route(/.*\/api\/v2\/employers\/manage-users-config\/?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANAGE_USERS_CONFIG) }),
    )

    await page.route(/.*\/api\/v2\/employer\/?(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paginated(USERS, { count: USERS.length })) }),
    )

    await page.route('**/api/contact-us-config/**', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      }),
    )
  },
}
