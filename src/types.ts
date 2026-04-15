import { type Page } from 'playwright'

export type Role = 'employer' | 'vendor'

export type PageDefinition = {
  /** Unique identifier for this page (used in filenames) */
  id: string
  /** Human-readable page name */
  name: string
  /** URL path (relative to base URL) */
  path: string
  /** Which roles to capture this page for */
  roles: Role[]
  /**
   * Set up route mocks and prepare the page for screenshot.
   * Called after navigation. Should wait for the page to be "ready".
   */
  setup: (page: Page, role: Role) => Promise<void>
  /**
   * Optional: custom wait condition after setup.
   * Defaults to waiting for networkidle + 1s settle.
   */
  waitForReady?: (page: Page) => Promise<void>
  /** Optional: pages that need scrolling to capture full content */
  fullPage?: boolean
  /** If true, this page is rendered by Django middleware with mock context.
   *  Requires VR_MODE=1 in the main app's .env file. See README § Django Template Pages. */
  django?: boolean
}
