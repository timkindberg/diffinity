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

const CATEGORIES_AND_TEMPLATES = {
  categories: [
    { resource: 'Jobs' },
    { resource: 'Work Orders' },
    { resource: 'Timesheets' },
    { resource: 'Invoices' },
    { resource: 'Candidates' },
    { resource: 'Approvals' },
    { resource: 'SOW' },
  ],
  templates: [
    { key: 'job_published', title: 'Job published', action: 'notify', resource: 'Jobs', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'job_application_received', title: 'New application received', action: 'notify', resource: 'Jobs', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'job_closed', title: 'Job closed', action: 'notify', resource: 'Jobs', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'wo_created', title: 'Work order created', action: 'notify', resource: 'Work Orders', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'wo_modified', title: 'Work order modified', action: 'notify', resource: 'Work Orders', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'wo_ended', title: 'Work order ended', action: 'notify', resource: 'Work Orders', is_notification_enabled: true, is_in_app: true, is_email: false },
    { key: 'ts_submitted', title: 'Timesheet submitted', action: 'notify', resource: 'Timesheets', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'ts_approved', title: 'Timesheet approved', action: 'notify', resource: 'Timesheets', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'ts_rejected', title: 'Timesheet rejected', action: 'notify', resource: 'Timesheets', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'inv_created', title: 'Invoice created', action: 'notify', resource: 'Invoices', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'inv_approved', title: 'Invoice approved', action: 'notify', resource: 'Invoices', is_notification_enabled: true, is_in_app: false, is_email: true },
    { key: 'cand_status_change', title: 'Candidate status changed', action: 'notify', resource: 'Candidates', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'approval_pending', title: 'Approval pending', action: 'notify', resource: 'Approvals', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'approval_completed', title: 'Approval completed', action: 'notify', resource: 'Approvals', is_notification_enabled: true, is_in_app: true, is_email: true },
    { key: 'sow_status_change', title: 'SOW status changed', action: 'notify', resource: 'SOW', is_notification_enabled: true, is_in_app: true, is_email: true },
  ],
}

const PREFERENCES = {
  job_published: { in_app: true, email: true },
  job_application_received: { in_app: true, email: false },
  job_closed: { in_app: true, email: true },
  wo_created: { in_app: true, email: true },
  wo_modified: { in_app: false, email: true },
  wo_ended: { in_app: true, email: false },
  ts_submitted: { in_app: true, email: true },
  ts_approved: { in_app: true, email: false },
  ts_rejected: { in_app: true, email: true },
  inv_created: { in_app: true, email: true },
  inv_approved: { in_app: false, email: true },
  cand_status_change: { in_app: true, email: true },
  approval_pending: { in_app: true, email: true },
  approval_completed: { in_app: true, email: false },
  sow_status_change: { in_app: true, email: true },
}

/**
 * Notification preferences (/notifications/user_preferences)
 *
 * Next.js page: `pages/notifications/user_preferences.tsx` — categories on the left, In-app / Email toggles on the right.
 */
export const notificationPreferences: PageDefinition = {
  id: 'notification-preferences',
  name: 'Notification Preferences',
  path: '/notifications/user_preferences',
  roles: ['employer'],
  fullPage: true,

  async waitForReady(page: Page) {
    await page.getByText('Job published', { exact: true }).waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(1000)
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

    await page.route(/.*\/api\/v2\/notifications\/categories_and_templates\/?(\?.*)?$/, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CATEGORIES_AND_TEMPLATES),
      })
    })

    await page.route(/.*\/api\/v2\/notifications\/preferences\/?$/, (route) => {
      if (route.request().method() !== 'GET') {
        route.fallback()
        return
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PREFERENCES),
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
