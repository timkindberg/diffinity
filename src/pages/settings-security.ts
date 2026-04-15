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

const SECURITY_SETTINGS_CONFIG = {
  min_bu_level_selectable: 1,
  vendor_rbac_enabled: false,
  multi_pmo_enabled: false,
  child_roles_enabled: true,
  policies: { enabled: true },
  candidate_policies: { enabled: true },
  role_permissions: { create: true, update: true, delete: true },
}

const ROLE_TAGS = [
  {
    id: 1,
    uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c51',
    name: 'Admin',
    description: '',
    is_system_tag: true,
    usage_tags: [] as unknown[],
  },
  {
    id: 2,
    uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d62',
    name: 'Hiring',
    description: '',
    is_system_tag: true,
    usage_tags: [] as unknown[],
  },
  {
    id: 3,
    uuid: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e73',
    name: 'Custom',
    description: '',
    is_system_tag: false,
    usage_tags: [] as unknown[],
  },
  {
    id: 4,
    uuid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f84',
    name: 'Sourcing',
    description: '',
    is_system_tag: false,
    usage_tags: [] as unknown[],
  },
]

const makeRole = (
  id: number,
  uuid: string,
  name: string,
  description: string,
  opts: {
    permissions?: number[]
    tags?: number[]
    is_system_role?: boolean
    is_profile_role?: boolean
    is_vendor_role?: boolean
  } = {},
) => ({
  id,
  uuid,
  name,
  description,
  permissions: opts.permissions ?? [1, 2, 3, 4, 5],
  tags: opts.tags ?? [1],
  policy: null,
  policy_name: null,
  is_system_role: opts.is_system_role ?? false,
  is_profile_role: opts.is_profile_role ?? false,
  is_vendor_role: opts.is_vendor_role ?? false,
  user_roles: ['employer'] as const,
  is_child_role: false,
  child_roles: [] as unknown[],
  child_role_names: [] as string[],
  role_usage: null,
})

const ROLES_LIST = [
  makeRole(1, 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a95', 'System Administrator', 'Full system access', {
    permissions: [1, 2, 3, 4, 5],
    tags: [1],
    is_system_role: true,
  }),
  makeRole(2, 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b06', 'Hiring Manager', 'Manage reqs and offers', {
    permissions: [1, 2, 3, 10, 11],
    tags: [2],
  }),
  makeRole(3, 'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c17', 'Program Manager', 'Program oversight', {
    permissions: [1, 2, 20],
    tags: [2, 4],
  }),
  makeRole(4, 'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d28', 'Recruiter', 'Candidate pipeline', {
    permissions: [1, 2, 3],
    tags: [2, 3],
  }),
  makeRole(5, 'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e39', 'Analyst', 'Reporting and insights', {
    permissions: [1, 30],
    tags: [3],
  }),
  makeRole(6, 'd0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f40', 'Viewer', 'Read-only access', {
    permissions: [1],
    tags: [3],
  }),
  makeRole(7, 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a51', 'Vendor Manager', 'Vendor relationships', {
    permissions: [1, 2, 40, 41],
    tags: [1, 4],
  }),
  makeRole(8, 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b62', 'Finance', 'Invoice and payment review', {
    permissions: [1, 2, 50],
    tags: [1],
  }),
]

/**
 * Settings Security — Roles tab (`/settings/security/roles`)
 *
 * Next.js: `pages/settings/security/roles/index.tsx` — role list, tabs (Roles / Policies / Permissions / Configuration).
 */
export const settingsSecurity: PageDefinition = {
  id: 'settings-security',
  name: 'Settings Security',
  path: '/settings/security/roles',
  roles: ['employer'],
  fullPage: true,

  async waitForReady(page: Page) {
    await page.getByText('System Administrator', { exact: true }).waitFor({ state: 'visible', timeout: 20000 })
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

    await page.route(/.*\/api\/v2\/security_settings_config\/?(\?|$)/, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SECURITY_SETTINGS_CONFIG),
      })
    })

    await page.route(/.*\/api\/v2\/role_tags\/?(\?|$)/, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ROLE_TAGS),
      })
    })

    await page.route(/.*\/api\/v2\/roles\/?(\?|$)/, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
      const url = new URL(route.request().url())
      if (!/\/roles\/?$/.test(url.pathname)) {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ROLES_LIST),
      })
    })

    await page.route('**/api/v2/permissions/for_filters**', (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([], { limit: 50, count: 0, offset: 0 })),
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
