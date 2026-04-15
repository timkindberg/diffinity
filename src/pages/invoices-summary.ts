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

/** InvoiceMasterListApiSerializer shape — statuses [] uses V1 stepper (no reduce on empty) */
const makeInvoice = (
  id: number,
  invoice_number: string,
  status: number,
  opts: {
    vendor_name?: string
    total_client_amt?: string
    billing_start?: string
    billing_end?: string
    invoice_date?: string
  } = {},
) => ({
  id,
  invoice_number,
  status,
  vendor_name: opts.vendor_name ?? 'Acme Staffing LLC',
  created_at: daysAgo(20 - id),
  creator_full_name: 'Alex Morgan',
  billing_cycle_start_date: opts.billing_start ?? '2026-01-01',
  billing_cycle_end_date: opts.billing_end ?? '2026-01-31',
  invoice_date: opts.invoice_date ?? '2026-01-28',
  currency_code: 'USD',
  base_currency_code: 'USD',
  total_client_amt: opts.total_client_amt ?? '12500.00',
  total_client_amt_base: opts.total_client_amt ?? '12500.00',
  total_vendor_amt: '11800.00',
  total_vendor_amt_base: '11800.00',
  total_tax_amt: '950.00',
  total_tax_amt_base: '950.00',
  total_client_amt_due: '13450.00',
  total_client_amt_due_base: '13450.00',
  total_fees: '400.00',
  total_fees_base: '400.00',
  vendor_discounts: '200.00',
  vendor_discounts_base: '200.00',
  vendor_receives: '12150.00',
  vendor_receives_base: '12150.00',
  total_vendor_tax_amt: '800.00',
  total_vendor_tax_amt_base: '800.00',
  rejection_reason: status === 4 ? 'Missing backup documentation for pass-through costs' : null,
  void_reason: null,
  short_description: null,
  statuses: [] as { id: number; status: number; start_datetime: string }[],
  external_system_status: null,
})

const INVOICE_ROWS = [
  makeInvoice(501, 'INV-2026-0142', 0 /* Draft */, {
    vendor_name: 'TechBridge Solutions',
    total_client_amt: '8420.50',
    billing_start: '2026-02-01',
    billing_end: '2026-02-28',
    invoice_date: '',
  }),
  makeInvoice(502, 'INV-2026-0138', 1 /* Pending */, {
    vendor_name: 'GlobalTech Recruiting',
    total_client_amt: '22340.00',
    billing_start: '2026-01-01',
    billing_end: '2026-01-31',
  }),
  makeInvoice(503, 'INV-2026-0111', 2 /* Approved */, {
    vendor_name: 'CyberTalent Inc',
    total_client_amt: '18765.25',
  }),
  makeInvoice(504, 'INV-2025-0998', 3 /* Complete */, {
    vendor_name: 'DataTalent Co',
    total_client_amt: '45200.00',
    billing_start: '2025-12-01',
    billing_end: '2025-12-31',
  }),
  makeInvoice(505, 'INV-2025-0882', 4 /* Rejected */, {
    vendor_name: 'AgileForce Solutions',
    total_client_amt: '3100.00',
  }),
  makeInvoice(506, 'INV-2025-0744', 5 /* Paid */, {
    vendor_name: 'Northwind Staffing',
    total_client_amt: '28990.75',
    billing_start: '2025-11-01',
    billing_end: '2025-11-30',
  }),
  makeInvoice(507, 'INV-2026-0099', 2 /* Approved */, {
    vendor_name: 'Acme Staffing LLC',
    total_client_amt: '5600.00',
  }),
  makeInvoice(508, 'INV-2026-0088', 1 /* Pending */, {
    vendor_name: 'TechBridge Solutions',
    total_client_amt: '12999.99',
  }),
]

const TOTALS = {
  base_currency_code: 'USD',
  currency_code: 'USD',
  client_amt: '164516.49',
  client_amt_base: '164516.49',
  vendor_amt: '152900.00',
  vendor_amt_base: '152900.00',
  tax_amt: '12840.00',
  tax_amt_base: '12840.00',
  client_amt_due: '177356.49',
  client_amt_due_base: '177356.49',
}

const BILLING_CYCLES = [
  {
    id: 101,
    start_date: '2026-01-01',
    end_date: '2026-01-31',
    name: 'January 2026',
    cycle_def: 1,
    formatted_date_range: 'Jan 1 – Jan 31, 2026',
  },
  {
    id: 102,
    start_date: '2026-02-01',
    end_date: '2026-02-28',
    name: 'February 2026',
    cycle_def: 1,
    formatted_date_range: 'Feb 1 – Feb 28, 2026',
  },
  {
    id: 99,
    start_date: '2025-12-01',
    end_date: '2025-12-31',
    name: 'December 2025',
    cycle_def: 1,
    formatted_date_range: 'Dec 1 – Dec 31, 2025',
  },
]

const BUSINESS_UNITS = {
  count: 5,
  results: [
    { id: 1, name: 'Engineering', level: 2, children: [], path_segments: [{ id: 1, name: 'Engineering' }] },
    { id: 2, name: 'Product', level: 2, children: [], path_segments: [{ id: 2, name: 'Product' }] },
    { id: 3, name: 'Sales', level: 2, children: [], path_segments: [{ id: 3, name: 'Sales' }] },
    { id: 4, name: 'Finance', level: 2, children: [], path_segments: [{ id: 4, name: 'Finance' }] },
    { id: 5, name: 'Operations', level: 2, children: [], path_segments: [{ id: 5, name: 'Operations' }] },
  ],
}

const BUSINESS_UNIT_LEVELS = [
  { id: 1, name: 'Company', level: 1 },
  { id: 2, name: 'Department', level: 2 },
]

const BUSINESS_UNIT_CONFIG = {
  display_name: 'Business Unit',
  level_label: 'Level',
  max_level: 2,
}

const VENDOR_ENTITIES = [
  { id: 5, company_name: 'Acme Staffing LLC' },
  { id: 6, company_name: 'TechBridge Solutions' },
  { id: 7, company_name: 'GlobalTech Recruiting' },
  { id: 8, company_name: 'CyberTalent Inc' },
  { id: 9, company_name: 'DataTalent Co' },
  { id: 10, company_name: 'AgileForce Solutions' },
  { id: 11, company_name: 'Northwind Staffing' },
]

const RESOURCE_MANAGERS = {
  count: 4,
  results: [
    { id: 201, full_name: 'Sarah Chen' },
    { id: 202, full_name: 'Marcus Johnson' },
    { id: 203, full_name: 'Priya Patel' },
    { id: 204, full_name: 'Jordan Williams' },
  ],
}

const INVOICE_PERMISSIONS = {
  can_read: true,
  can_create: true,
  can_invoice: true,
  can_export: true,
  can_void: true,
  can_delete: true,
  can_read_invoice_files: true,
  can_view_invoice_status: false,
  can_read_workorder: true,
}

const INVOICING_CONFIG = {
  is_invoice_pdf_builder_enabled: false,
  enable_pdf_builder_enhancements: false,
  show_invoiceable_currency_not_set_alert: false,
  can_view_calculation_breakdown: false,
}

/**
 * Employer invoice summary (/invoices/summary/) — Django + Webpack invoice bundle.
 * List, totals accordion, filters sidebar (status, billing cycle, BU, vendor, RM).
 */
export const invoicesSummary: PageDefinition = {
  id: 'invoices-summary',
  name: 'Invoices summary',
  path: '/invoices/summary/',
  roles: ['employer'],
  fullPage: true,
  django: true,

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

    await page.route('**/api/v2/invoices/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(INVOICING_CONFIG),
      })
    })

    await page.route('**/api/v2/invoices/invoice_permissions**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(INVOICE_PERMISSIONS),
      })
    })

    await page.route('**/api/v2/invoices/summaries/get_totals/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TOTALS),
      })
    })

    await page.route(/.*\/api\/v2\/invoices\/summaries\/actionable_ids/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_approve: [502, 508],
          can_invoice: [503, 507],
          can_void: [501],
        }),
      })
    })

    await page.route(/.*\/api\/v2\/invoices\/summaries\/\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated(INVOICE_ROWS, { limit: 20, count: INVOICE_ROWS.length })),
      })
    })

    await page.route(/.*\/api\/report-preferences\/\d+/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          report_id: 1,
          report_view: 'default',
          preferences_id: 1,
          preferences_owner: 10,
          current_user_id: 10,
          created_by: 10,
          columns: [
            'invoice_number',
            'vendor_name',
            'billing_cycle_end_date',
            'invoice_date',
            'total_client_amt',
            'status',
          ],
          sort_by: [['billing_cycle_end_date', 'desc']],
        }),
      })
    })

    await page.route('**/api/v2/invoices/billing-cycles/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BILLING_CYCLES),
      })
    })

    await page.route(/.*\/api\/v2\/vendor_entities\/applicable/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: VENDOR_ENTITIES.length,
          results: VENDOR_ENTITIES,
        }),
      })
    })

    await page.route(/.*\/api\/v2\/employer_manager\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RESOURCE_MANAGERS),
      })
    })

    await page.route(/.*\/api\/v2\/business_units\/\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BUSINESS_UNITS),
      })
    })

    await page.route('**/api/v2/business_unit_levels/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BUSINESS_UNIT_LEVELS),
      })
    })

    await page.route('**/api/v2/business_units/config**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BUSINESS_UNIT_CONFIG),
      })
    })

    await page.route('**/api/currency/currency_settings/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ base_currency_code: 'USD', multi_currency_enabled: false }),
      })
    })

    // useCurrenciesQuery — must be a JSON array (CurrencyDisplay calls .find on data)
    await page.route(
      (url) => {
        const p = url.pathname.replace(/\/$/, '')
        return p === '/api/currency'
      },
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              code: 'USD',
              name: 'US Dollar',
              multiplier_to_base_currency: 1.0,
              decimal_places: 2,
              is_active: true,
            },
            {
              id: 2,
              code: 'EUR',
              name: 'Euro',
              multiplier_to_base_currency: 1.08,
              decimal_places: 2,
              is_active: true,
            },
            {
              id: 3,
              code: 'GBP',
              name: 'British Pound',
              multiplier_to_base_currency: 1.27,
              decimal_places: 2,
              is_active: true,
            },
          ]),
        })
      },
    )

    await page.route('**/api/v2/program-team/multi_pmo_enabled/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
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
            {
              id: 1,
              title: 'Approve invoice INV-2026-0138',
              status: 1,
              due_date: daysAgo(-1),
              category: 'Invoice',
              priority: 'high',
            },
          ]),
        ),
      })
    })
  },
}
