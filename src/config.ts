import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const envPath = resolve(__dirname, '../.env')
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const value = trimmed.slice(eqIdx + 1)
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

export const config = {
  baseUrl: process.env.VR_BASE_URL || 'https://cruise.localqa.vndly.com',
  password: process.env.VR_PASSWORD || 'visualregression123',
  viewports: [
    { width: 1440, height: 900, label: 'desktop' },
    // Multi-viewport capture is implemented but disabled — re-enable when highlight
    // and diff-panel bugs at smaller viewports are resolved.
    // { width: 768, height: 1024, label: 'tablet' },
    // { width: 375, height: 812, label: 'mobile' },
  ],
  users: {
    employer: 'vr-employer@visual-regression.local',
    vendor: 'vr-vendor@visual-regression.local',
  },
  phase: (process.env.CAPTURE_PHASE || 'before') as 'before' | 'after',
  screenshotDir: resolve(__dirname, '../screenshots'),
}
