import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'

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

/** `/api/v2/settings/directory/` — items grouped by `hierarchy[0]` (SectionKey) */
const SETTINGS_DIRECTORY_RESPONSE = {
  hash: 'abc123',
  directory: [
    {
      id: 0,
      name: 'Business unit levels',
      path: '/settings/organization/business-units',
      description: 'Configure how many levels exist in your business unit hierarchy and default labels.',
      hierarchy: ['organization'],
      extra_search_terms: [],
    },
    {
      id: 1,
      name: 'Work sites',
      path: '/settings/work_order',
      description: 'Manage site codes, addresses, and which sites appear on work orders.',
      hierarchy: ['organization'],
      extra_search_terms: [],
    },
    {
      id: 2,
      name: 'Entities',
      path: '/settings/program-team-entity-settings',
      description: 'Program team entities, mappings, and visibility for reporting.',
      hierarchy: ['organization'],
      extra_search_terms: [],
    },
    {
      id: 3,
      name: 'Roles & permissions',
      path: '/settings/security/roles',
      description: 'Create and edit employer roles, capability bundles, and inheritance.',
      hierarchy: ['security'],
      extra_search_terms: [],
    },
    {
      id: 4,
      name: 'SSO / SAML',
      path: '/settings/sso_saml/server',
      description: 'Identity provider metadata, attribute mapping, and JIT provisioning.',
      hierarchy: ['security'],
      extra_search_terms: [],
    },
    {
      id: 5,
      name: 'Security configuration',
      path: '/settings/security/config',
      description: 'Session policies, password rules, and IP allow lists.',
      hierarchy: ['security'],
      extra_search_terms: [],
    },
    {
      id: 6,
      name: 'Job settings',
      path: '/settings/work_order',
      description: 'Defaults for new jobs, numbering, and required fields at creation.',
      hierarchy: ['jobs'],
      extra_search_terms: [],
    },
    {
      id: 7,
      name: 'Job categories',
      path: '/settings/list_view_defaults',
      description: 'Category taxonomy used in filters, reporting, and approvals.',
      hierarchy: ['jobs'],
      extra_search_terms: [],
    },
    {
      id: 8,
      name: 'Compensation',
      path: '/settings/job/compensation',
      description: 'Rate types, pay rules, and visibility of compensation on postings.',
      hierarchy: ['jobs'],
      extra_search_terms: [],
    },
    {
      id: 9,
      name: 'Timekeeping settings',
      path: '/settings/timekeeping/defaults',
      description: 'Rounding, breaks, and contractor time entry requirements.',
      hierarchy: ['timekeeping'],
      extra_search_terms: [],
    },
    {
      id: 10,
      name: 'Billing cycles',
      path: '/settings/billing_cycles/definitions',
      description: 'Invoice windows, cutoffs, and alignment with your finance calendar.',
      hierarchy: ['timekeeping'],
      extra_search_terms: [],
    },
    {
      id: 11,
      name: 'Candidate profile',
      path: '/settings/generic_fields',
      description: 'Custom fields and sections shown on candidate and worker profiles.',
      hierarchy: ['workers'],
      extra_search_terms: [],
    },
    {
      id: 12,
      name: 'Manage users',
      path: '/settings/users',
      description: 'Invite users, assign roles, and control employer portal access.',
      hierarchy: ['workers'],
      extra_search_terms: [],
    },
    {
      id: 13,
      name: 'Vendor settings',
      path: '/settings/vendor',
      description: 'Terms, tiers, and default behaviors for vendor companies.',
      hierarchy: ['vendors'],
      extra_search_terms: [],
    },
    {
      id: 14,
      name: 'Connectors',
      path: '/settings/continuous_assignment',
      description: 'Third-party HRIS and ATS connectors and sync schedules.',
      hierarchy: ['integrations'],
      extra_search_terms: [],
    },
    {
      id: 15,
      name: 'Webhooks',
      path: '/settings/webhook/endpoint',
      description: 'Outbound event subscriptions, signing secrets, and retry policy.',
      hierarchy: ['integrations'],
      extra_search_terms: [],
    },
    {
      id: 16,
      name: 'Invoice templates',
      path: '/settings/invoice_template_rules',
      description: 'PDF layouts, line grouping, and branding for customer-facing invoices.',
      hierarchy: ['accounting'],
      extra_search_terms: [],
    },
    {
      id: 17,
      name: 'Fee & charge codes',
      path: '/settings/fee_charge_codes',
      description: 'Markup, pass-through fees, and GL mapping for billing.',
      hierarchy: ['accounting'],
      extra_search_terms: [],
    },
  ],
}

/**
 * Settings hub (`/settings`) — Next.js directory with search, jump-to sidebar, and section cards.
 */
export const settingsDirectory: PageDefinition = {
  id: 'settings-directory',
  name: 'Settings Directory',
  path: '/settings',
  roles: ['employer'],
  fullPage: true,

  async waitForReady(page: Page) {
    await page
      .getByRole('heading', { name: 'Company Settings' })
      .waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(800)
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }),
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

    await page.route(/.*\/api\/v2\/settings\/directory\/?(\?.*)?$/, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SETTINGS_DIRECTORY_RESPONSE),
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
