import { type BrowserContext, type Page } from 'playwright'
import { config } from './config.js'

/**
 * Login via VNDLY's two-step API flow (pillaged from regression suite).
 * Sets session cookies on the browser context so subsequent navigations are authenticated.
 */
export async function login(context: BrowserContext, username: string): Promise<void> {
  const page = await context.newPage()

  try {
    // Step 1: Submit username to identity endpoint
    const identityResponse = await page.request.post(`${config.baseUrl}/accounts/login/identity/`, {
      form: { username },
      headers: {
        'Referer': `${config.baseUrl}/sign_in`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (identityResponse.status() !== 200) {
      throw new Error(`Identity step failed: ${identityResponse.status()} ${await identityResponse.text()}`)
    }

    // Step 2: Submit password
    const pwdResponse = await page.request.post(`${config.baseUrl}/accounts/login/pwd/`, {
      form: { password: config.password },
      headers: {
        'Referer': `${config.baseUrl}/home/login_pwd/`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (pwdResponse.status() !== 200) {
      throw new Error(`Password step failed: ${pwdResponse.status()} ${await pwdResponse.text()}`)
    }

    // Set bypass header for terms & conditions modal
    await context.setExtraHTTPHeaders({
      'X-BYPASS-TERMS-AND-CONDITIONS': '1',
    })
  } finally {
    await page.close()
  }
}

/**
 * Block webpack-hmr requests that cause networkidle waits to hang.
 */
export async function blockHmr(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    if (route.request().url().includes('webpack-hmr')) {
      return route.abort()
    }
    return route.continue()
  })
}
