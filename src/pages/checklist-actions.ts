import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated, daysAgo, daysFromNow } from '../mock-utils.js'


/** Matches `ACTION_STATUSES` in `assets/js/checklists/constants.ts` */
const ST = { MISSING: 1, PENDING: 2, FAILED: 3, REJECTED: 4, EXPIRED: 5, COMPLETED: 6, WAIVED: 9 } as const

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

const CHECKLISTS_VIEW_CONFIG = {
  allow_rm_to_waive_checklist_actions: true,
  enable_checklist_rejection_reason: true,
  allow_waive_verification_at_offer_release: true,
  display_checklist_items_during_job_creation: true,
  allow_contractors_to_manage_checklist_actions: true,
  allow_checklist_modification_during_job_creation: true,
  allow_viewing_checklist_requirements_before_onboarding: true,
  require_waived_checklist_actions_be_completed_after_onboarding: false,
  waived_checklist_actions_must_be_completed_x_days_after_onboarding: null as number | null,
}

const MANAGE_CONFIG = {
  is_wpm_v2_enabled: false,
  is_wpm_v2_checklist_enabled: true,
  is_worker_tracker_profile_enabled: false,
}

const CHECKLIST_LIST_ITEMS = [
  {
    action_id: 'CA-2026-0142',
    id: 501,
    title: 'Background check — county criminal (7-year)',
    status: ST.PENDING,
    renewal_date: daysFromNow(2),
    subject_name: 'Jordan Lee',
    checklist_id: 1101,
    is_expiring_soon: true,
    checklist_type: 1,
  },
  {
    action_id: 'CA-2026-0143',
    id: 502,
    title: 'I-9 Section 2 verification',
    status: ST.COMPLETED,
    renewal_date: daysAgo(4),
    subject_name: 'Priya Shah',
    checklist_id: 1102,
    is_expiring_soon: false,
    checklist_type: 1,
  },
  {
    action_id: 'CA-2026-0144',
    id: 503,
    title: 'Professional license — RN compact state',
    status: ST.EXPIRED,
    renewal_date: daysAgo(12),
    subject_name: 'Chris Okonkwo',
    checklist_id: 1103,
    is_expiring_soon: false,
    checklist_type: 2,
  },
  {
    action_id: 'CA-2026-0145',
    id: 504,
    title: 'Security badge pickup — Building C',
    status: ST.MISSING,
    renewal_date: daysFromNow(9),
    subject_name: 'Alex Morgan',
    checklist_id: 1104,
    is_expiring_soon: false,
    checklist_type: 2,
  },
  {
    action_id: 'CA-2026-0146',
    id: 505,
    title: 'Equipment return attestation',
    status: ST.COMPLETED,
    renewal_date: daysAgo(1),
    subject_name: 'Sam Rivera',
    checklist_id: 1105,
    is_expiring_soon: false,
    checklist_type: 1,
  },
  {
    action_id: 'CA-2026-0147',
    id: 506,
    title: 'Drug screen — eCCF scheduling',
    status: ST.PENDING,
    renewal_date: daysFromNow(5),
    subject_name: 'Taylor Nguyen',
    checklist_id: 1106,
    is_expiring_soon: false,
    checklist_type: 1,
  },
]

function checklistDetailFromListItem(row: (typeof CHECKLIST_LIST_ITEMS)[number]) {
  return {
    id: row.id,
    action_id: row.action_id,
    status: row.status,
    can_take_action: false,
    can_approve: false,
    is_expiring_soon: row.is_expiring_soon,
    last_completed: row.status === ST.COMPLETED ? daysAgo(2) : null,
    renewal_date: row.renewal_date,
    user_role: 3,
    checklist_revision: {
      checklist_revision_id: 8000 + row.id,
      checklist_type: row.checklist_type,
      timing: 1,
      is_required_to_proceed: true,
      is_attachment_expiration_date_required: false,
      expiration_days: null,
      expiration_month: null,
      expiration_duration_measure: 1,
      expiration_duration_unit: 4,
      comments:
        row.checklist_type === 1
          ? 'Complete within five business days of offer acceptance. Upload results to the action record.'
          : 'Credential must match the role on the work order. Renew before expiration to avoid pay hold.',
      can_update: true,
      must_complete: 1,
      title: row.title,
      is_pass_fail: false,
      is_attachment_required: true,
      is_attachment_section_hidden: false,
      expiration: 3,
      action_required_from: [3],
      is_approval_required: false,
      must_complete_period_for_post_onboarding: 0,
      hide_from_supplier: false,
      hide_from_client: false,
      notify_on_expiration: true,
      notify_days_before_expiration: 14,
      notify_msp_on_expiration: true,
      notify_vendor_on_expiration: true,
      notify_manager_on_expiration: true,
      notify_admin_on_expiration: true,
      notify_contractor_on_expiration: true,
      notify_program_team_on_expiration: true,
      escalation: false,
      notify_days_on_escalation: null,
      notify_msp_on_escalation: false,
      notify_admin_on_escalation: false,
      notify_program_team_on_escalation: false,
      criteria_data: {},
    },
    updated_at: daysAgo(0),
    updated_by: 10,
    candidate_link: `/candidates/${8800 + row.id}/`,
    created_by: 10,
    did_pass: row.status === ST.COMPLETED ? true : null,
    root_object_details: [
      {
        id: String(12000 + row.id),
        display_id: `WO-${12800 + row.id}`,
        title: 'Senior Data Engineer — Cruise Analytics',
        resource_link: `/work_orders/all/${12800 + row.id}/`,
        start_date: daysAgo(30),
        status: 2,
      },
    ],
    subject_name: row.subject_name,
    action_required_from_user: false,
    can_update: true,
    can_waive: true,
    created_at: daysAgo(60),
    documents: [] as unknown[],
    notes: [] as unknown[],
    generic_fields: {},
    generic_form_name: '',
  }
}

/**
 * Employer Manage Checklist Actions (`/checklist_actions`) — Next.js split list, filters, detail pane.
 */
export const checklistActions: PageDefinition = {
  id: 'checklist-actions',
  name: 'Checklist Actions',
  path: '/checklist_actions',
  roles: ['employer'],
  fullPage: true,

  async waitForReady(page: Page) {
    // Mobile split layout keeps detail pane in DOM but hidden until an item is focused; list items are always shown.
    await page.waitForSelector('[data-testid^="checklist-action-item-"]', { timeout: 20000 })
    await page.waitForTimeout(800)
  },

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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NAV_CONFIG_EMPLOYER) })
    })

    await page.route('**/api/v2/client/feature-flags/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) })
    })

    await page.route('**/api/v2/checklists/manage-config-actions/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANAGE_CONFIG) })
    })

    await page.route('**/api/v2/checklists/view_config/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CHECKLISTS_VIEW_CONFIG) })
    })

    await page.route('**/api/v2/job_application_actions/get_total_counts/**', (route) => {
      if (route.request().method() !== 'GET') {
        void route.continue()
        return
      }
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_count: CHECKLIST_LIST_ITEMS.length }),
      })
    })

    await page.route((url) => {
      try {
        return /^\/api\/v2\/job_application_actions\/\d+\/?$/.test(new URL(url).pathname)
      } catch {
        return false
      }
    }, (route) => {
      if (route.request().method() !== 'GET') {
        void route.continue()
        return
      }
      const m = new URL(route.request().url()).pathname.match(/\/(\d+)\/?$/)
      const id = m ? Number(m[1]) : 0
      const row = CHECKLIST_LIST_ITEMS.find((r) => r.id === id)
      if (!row) {
        void route.fulfill({ status: 404, body: '{}' })
        return
      }
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(checklistDetailFromListItem(row)),
      })
    })

    await page.route((url) => {
      try {
        const p = new URL(url).pathname
        return p === '/api/v2/job_application_actions' || p === '/api/v2/job_application_actions/'
      } catch {
        return false
      }
    }, (route) => {
      if (route.request().method() !== 'GET') {
        void route.continue()
        return
      }
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated(CHECKLIST_LIST_ITEMS, { count: CHECKLIST_LIST_ITEMS.length, limit: 100, offset: 0 }),
        ),
      })
    })

    await page.route(
      /.*\/api\/v2\/user_preferences.*preference_type=saved_filters.*namespace=manage_checklist_actions/,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 7001,
              namespace: 'manage_checklist_actions',
              preference_type: 'saved_filters',
              data: {
                name: 'Overdue & pending (Eng)',
                filterValues: { status: [String(ST.PENDING), String(ST.EXPIRED)] },
                search: '',
              },
            },
            {
              id: 7002,
              namespace: 'manage_checklist_actions',
              preference_type: 'saved_filters',
              data: {
                name: 'Compliance only',
                filterValues: { checklist_type: ['1'] },
                search: 'background',
              },
            },
          ]),
        })
      },
    )

    await page.route('**/api/v2/user_preferences**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    })

    await page.route('**/api/contact-us-config/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, custom_message: null, hide_form: true, request_user_info: false }),
      })
    })

    await page.route(/.*\/api\/v2\/user_tasks\/(?!summary)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          paginated([
            {
              id: 1,
              title: 'Follow up on checklist — Jordan Lee',
              status: 1,
              due_date: daysFromNow(1),
              category: 'Checklist',
              priority: 'high',
            },
          ]),
        ),
      })
    })
  },
}
