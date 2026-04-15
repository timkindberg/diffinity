import { type Page } from 'playwright'
import { type PageDefinition, type Role } from '../types.js'
import { paginated } from '../mock-utils.js'
import { setupWorkOrderDetailRoutes } from './work-order-detail.js'

/** Managers / approvers referenced by work-order-detail fixtures (IDs 201, 301, 302, 401–403). */
const MOCK_EMPLOYER_ROWS = [
  { id: 201, profile_id: 201, username: 'alice.m', first_name: 'Alice', preferred_first_name: null, middle_name: null, last_name: 'Manager', preferred_last_name: null, email: 'alice@cruisecorp.com', full_name: 'Alice Manager', work_site: 50 },
  { id: 301, profile_id: 301, username: 'bob.a', first_name: 'Bob', preferred_first_name: null, middle_name: null, last_name: 'Approver', preferred_last_name: null, email: 'bob@cruisecorp.com', full_name: 'Bob Approver', work_site: 50 },
  { id: 302, profile_id: 302, username: 'carol.a', first_name: 'Carol', preferred_first_name: null, middle_name: null, last_name: 'Approver', preferred_last_name: null, email: 'carol@cruisecorp.com', full_name: 'Carol Approver', work_site: 50 },
  { id: 401, profile_id: 401, username: 'pat.t', first_name: 'Pat', preferred_first_name: null, middle_name: null, last_name: 'Timekeeper', preferred_last_name: null, email: 'pat@cruisecorp.com', full_name: 'Pat Timekeeper', work_site: 50 },
  { id: 402, profile_id: 402, username: 'dan.l', first_name: 'Dan', preferred_first_name: null, middle_name: null, last_name: 'Lead', preferred_last_name: null, email: 'dan@cruisecorp.com', full_name: 'Dan Lead', work_site: 50 },
  { id: 403, profile_id: 403, username: 'erin.pm', first_name: 'Erin', preferred_first_name: null, middle_name: null, last_name: 'PM', preferred_last_name: null, email: 'erin@cruisecorp.com', full_name: 'Erin PM', work_site: 50 },
]

const MOCK_PROGRAM_TEAM_MEMBER = {
  id: 1,
  profile_id: 1,
  username: 'alpha.lead',
  full_name: 'Alpha Team Lead',
  email: 'alpha.lead@cruisecorp.com',
  program_entity_roles: ['lead'],
}

/**
 * APIs that only fire once the WO is in edit mode (manager SmartSelects, budget calculator, job site row).
 * Registered after {@link setupWorkOrderDetailRoutes} so we do not shadow the detail page’s handlers.
 */
async function setupWorkOrderModifyEditModeRoutes(page: Page) {
  await page.route(/\/api\/v2\/employer_manager/, async (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue()
    }
    const url = route.request().url()
    const pathMatch = url.match(/\/employer_manager\/(\d+)/)
    if (pathMatch) {
      const id = parseInt(pathMatch[1], 10)
      const row = MOCK_EMPLOYER_ROWS.find((e) => e.id === id) ?? MOCK_EMPLOYER_ROWS[0]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(row),
      })
      return
    }
    const u = new URL(url)
    const idsParam = u.searchParams.get('ids')
    if (idsParam) {
      const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n))
      const results = MOCK_EMPLOYER_ROWS.filter((e) => ids.includes(e.id))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paginated([...MOCK_EMPLOYER_ROWS], { count: MOCK_EMPLOYER_ROWS.length, limit: 200, offset: 0 })),
    })
  })

  // Normal query URLs plus JSF valueLookup bug: `/api/v2/program-team-users` + id with no separator
  await page.route(/\/api\/v2\/program-team-users\d*/, async (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue()
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paginated([MOCK_PROGRAM_TEAM_MEMBER], { count: 1, limit: 200, offset: 0 })),
    })
  })

  await page.route(/\/budget\/compute_labor\/for_change_set\/?/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(22185),
      })
      return
    }
    await route.continue()
  })

  await page.route(/\/api\/v2\/customization\/datasources\/job_project_site\/rows\/\d+/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, display: 'Onsite', value: 'Onsite' }),
    })
  })
}

/**
 * Work order modify (edit) mode.
 *
 * Next.js has no `/work_orders/:id/modify/` index page — the modify form lives on
 * `/work_orders/:id/` after clicking "Update Work Order" (`data-testid="edit"`).
 * (`/work_orders/:id/modify/review` is the post-submit review step only.)
 */
export const workOrderModify: PageDefinition = {
  id: 'work-order-modify',
  name: 'Work Order Modify',
  path: '/work_orders/1/',
  roles: ['employer'],
  fullPage: true,

  async setup(page: Page, role: Role) {
    await setupWorkOrderDetailRoutes(page, role)
    await setupWorkOrderModifyEditModeRoutes(page)
  },

  async waitForReady(page: Page) {
    const edit = page.locator('[data-testid="edit"]')
    await edit.waitFor({ state: 'visible', timeout: 25000 })
    await edit.evaluate((el: HTMLElement) => el.click())

    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[data-testid="review-changes"]')].some(
          (el) => el instanceof HTMLElement && el.offsetParent !== null,
        ),
      { timeout: 25000 },
    )

    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    } catch {
      // Long-polling or open connections can prevent networkidle
    }
    await page.waitForTimeout(1000)
  },
}
