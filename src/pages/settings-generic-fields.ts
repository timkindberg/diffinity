import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated } from '../mock-utils.js'

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

const GENERIC_FORMS_LIST = [
  {
    id: 1,
    name: 'Job',
    namespace: 'job_form',
    required: false,
    condition_business_units_cascade: [],
    has_advanced_settings: false,
  },
  {
    id: 2,
    name: 'Work Order',
    namespace: 'work_order_form',
    required: false,
    condition_business_units_cascade: [],
    has_advanced_settings: false,
  },
  {
    id: 3,
    name: 'Candidate',
    namespace: 'candidate_form',
    required: false,
    condition_business_units_cascade: [],
    has_advanced_settings: true,
  },
  {
    id: 4,
    name: 'SOW',
    namespace: 'sow_form',
    required: false,
    condition_business_units_cascade: [],
    has_advanced_settings: false,
  },
  {
    id: 5,
    name: 'Invoice',
    namespace: 'invoice_form',
    required: false,
    condition_business_units_cascade: [],
    has_advanced_settings: false,
  },
]

/**
 * Settings — create custom field (`/settings/generic_fields/new`).
 *
 * Next.js page: `pages/settings/generic_fields/[editMode]/[[...id]].tsx` → `IndividualGenericFieldSettingsPage`
 * (form + sticky preview).
 */
export const settingsGenericFields: PageDefinition = {
  id: 'settings-generic-fields',
  name: 'Settings Generic Fields',
  path: '/settings/generic_fields/new',
  roles: ['employer'],
  fullPage: true,

  async waitForReady(page: Page) {
    await page.waitForSelector('[data-testid="generic-field-header"], [data-testid="edit_generic_field_form"]', {
      timeout: 25000,
    })
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

    await page.route(/.*\/api\/v2\/user_tasks\//, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paginated([])) }),
    )

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

    await page.route(/.*\/api\/v2\/generic_form\/?$/, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(GENERIC_FORMS_LIST),
      })
    })

    await page.route('**/api/v2/generic_field/activity_log/**', (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
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
        body: JSON.stringify({ enabled: false }),
      })
    })
  },
}
