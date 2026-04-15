/**
 * Creates synthetic "after" captures by loading before HTML in Playwright,
 * applying visible DOM mutations, saving the modified HTML, and capturing
 * a fresh DOM manifest. This keeps HTML and manifest perfectly in sync.
 *
 * Mutations cover every category the diff engine reports on:
 * - Text content changes
 * - Color/typography changes
 * - Box model changes (padding, margin, border)
 * - Layout changes (display, flex)
 * - Size changes (width, height)
 * - Element additions
 * - Element removals
 * - Element moves
 * - Attribute changes
 * - Border radius changes
 * - Background changes
 *
 * Pages WITHOUT mutations in PAGE_MUTATIONS produce an identical "after"
 * (no changes detected in the report). Pages listed in IDENTICAL_PAGES
 * are explicitly left unchanged to validate the "no diff" path.
 */
import { chromium } from 'playwright'
import { readdirSync, existsSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { captureDomManifest } from './dom-manifest.js'
import { config } from './config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const screenshotDir = resolve(__dirname, '../screenshots')
const beforeDir = join(screenshotDir, 'before')
const afterDir = join(screenshotDir, 'after')
const VIEWPORTS = config.viewports

type Mutation = {
  name: string
  selector: string
  apply: string // JS to run on the selected element (receives `el`)
  max?: number  // max elements to mutate (default 3)
}

/**
 * Find the best available HTML file for a page directory.
 * Prefers html-1440/ (from multi-viewport capture) then falls back to html/.
 */
function findBeforeHtml(dirName: string): string | null {
  const candidates = [
    join(beforeDir, dirName, 'html-1440', 'index.html'),
    join(beforeDir, dirName, 'html', 'index.html'),
  ]
  return candidates.find(p => existsSync(p)) ?? null
}


// ---------------------------------------------------------------------------
// Reusable mutation fragments — combined per-page below
// ---------------------------------------------------------------------------

const NAV_BG_DARK: Mutation = {
  name: 'nav-bg-darken',
  selector: 'nav, [role="navigation"], [data-testid="global-navigation-menu"]',
  apply: `el.style.backgroundColor = '#1a2744';`,
  max: 1,
}

const HEADING_RENAME = (find: RegExp | string, replace: string): Mutation => ({
  name: 'heading-text-change',
  selector: 'h1, h2, [role="heading"]',
  apply: `
    const re = ${find instanceof RegExp ? find.toString() : `/${find}/`};
    if (re.test(el.textContent)) el.textContent = el.textContent.replace(re, '${replace}');
  `,
})

const BUTTON_RESTYLE: Mutation = {
  name: 'button-restyle',
  selector: 'button:not([aria-label]):not([data-testid*="nav"])',
  apply: `el.style.padding = '10px 20px'; el.style.borderRadius = '8px';`,
}

const ADD_BANNER: Mutation = {
  name: 'add-banner',
  selector: '[data-testid="global-navigation-menu"], nav, header',
  apply: `
    const banner = document.createElement('div');
    banner.setAttribute('data-testid', 'test-banner');
    banner.textContent = '⚠ System maintenance scheduled for Sunday 10pm-2am EST';
    banner.style.cssText = 'background:#fef3c7;color:#92400e;padding:12px 24px;font-size:14px;font-weight:500;border-bottom:2px solid #f59e0b;display:flex;align-items:center;gap:8px;';
    el.parentNode.insertBefore(banner, el.nextSibling);
  `,
  max: 1,
}

const REMOVE_HELP_BTN: Mutation = {
  name: 'remove-help-button',
  selector: '[data-testid="global-nav-help-button"], button[aria-label*="help" i], button[aria-label*="Help" i]',
  apply: `el.remove();`,
  max: 1,
}

const FONT_SIZE_BUMP: Mutation = {
  name: 'font-size-bump',
  selector: 'p, [class*="description"], [class*="subtitle"], [class*="caption"]',
  apply: `$0.style.fontSize = parseInt($0.style.fontSize, 10) + 2 + 'px'; el.style.lineHeight = '1.6';`,
}

const BORDER_ACCENT: Mutation = {
  name: 'border-accent',
  selector: '[class*="card"], [class*="Card"], [class*="panel"], [class*="Panel"], section',
  apply: `el.style.border = '2px solid #3b82f6'; el.style.borderRadius = '12px';`,
}

const BG_SUBTLE_CHANGE: Mutation = {
  name: 'bg-subtle',
  selector: '[id="__next"] > div > div, [class*="content"], [class*="Content"]',
  apply: `el.style.backgroundColor = '#f8fafc';`,
  max: 1,
}

const LINK_COLOR_CHANGE: Mutation = {
  name: 'link-color-purple',
  selector: 'a:not([role="menuitem"]):not([data-testid*="nav"])',
  apply: `el.style.color = '#7c3aed';`,
  max: 5,
}

const STATUS_BADGE_GREEN: Mutation = {
  name: 'status-badge-green',
  selector: '[class*="badge"], [class*="Badge"], [class*="status"], [class*="Status"], [class*="chip"], [class*="Chip"], [class*="tag"], [class*="Tag"]',
  apply: `el.style.backgroundColor = '#059669'; el.style.color = 'white'; el.style.borderColor = '#059669';`,
}

const TABLE_HEADER_DARK: Mutation = {
  name: 'table-header-dark',
  selector: 'thead, th, [role="columnheader"]',
  apply: `el.style.backgroundColor = '#1e293b'; el.style.color = 'white';`,
}

const TABLE_CELL_PAD: Mutation = {
  name: 'table-cell-padding',
  selector: 'td, [role="cell"], [role="gridcell"]',
  apply: `el.style.padding = '14px 16px';`,
}

const ADD_FILTER_CHIP: Mutation = {
  name: 'add-filter-chip',
  selector: '[class*="filter"], [class*="Filter"], [class*="toolbar"], [class*="Toolbar"], [role="toolbar"]',
  apply: `
    const chip = document.createElement('span');
    chip.setAttribute('data-testid', 'active-filter');
    chip.textContent = '✕ Last 30 days';
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:#dbeafe;color:#1d4ed8;padding:4px 10px;border-radius:16px;font-size:12px;font-weight:500;margin-left:8px;';
    el.insertBefore(chip, el.children[0] || null);
  `,
  max: 1,
}

const SPACING_INCREASE: Mutation = {
  name: 'spacing-increase',
  selector: '[class*="card"], [class*="Card"], [class*="detail"], [class*="Detail"]',
  apply: `el.style.padding = '24px'; el.style.marginBottom = '16px';`,
}

const HIDE_LAST_COLUMN: Mutation = {
  name: 'hide-last-column',
  selector: 'th:last-child, td:last-child, [role="columnheader"]:last-child, [role="cell"]:last-child',
  apply: `el.style.display = 'none';`,
}

const INPUT_BORDER_RED: Mutation = {
  name: 'input-border-red',
  selector: 'input[type="text"], input:not([type]), textarea',
  apply: `el.style.borderColor = '#ef4444'; el.style.boxShadow = '0 0 0 1px #ef4444';`,
  max: 2,
}

const ADD_INFO_ROW: Mutation = {
  name: 'add-info-row',
  selector: 'h3 + div, h3 + ul, [class*="card-body"], [class*="CardBody"], section > div > div, [class*="detail-section"], [class*="info-section"]',
  apply: `
    if (el.offsetHeight > 800 || el.offsetHeight < 20) return;
    const row = document.createElement('div');
    row.setAttribute('data-testid', 'new-info-row');
    row.innerHTML = '<strong style="color:#6b7280;">Priority:</strong> <span style="color:#dc2626;font-weight:600;">High</span>';
    row.style.cssText = 'padding:8px 12px;border-top:1px solid #e5e7eb;margin-top:8px;font-size:14px;overflow:hidden;height:auto;';
    el.appendChild(row);
  `,
  max: 1,
}

const FOOTER_BG: Mutation = {
  name: 'footer-bg',
  selector: 'footer',
  apply: `el.style.backgroundColor = '#111827'; el.style.color = '#9ca3af';`,
  max: 1,
}

const AVATAR_BORDER: Mutation = {
  name: 'avatar-border',
  selector: '[class*="avatar"], [class*="Avatar"], img[alt*="avatar" i], img[alt*="profile" i]',
  apply: `el.style.border = '3px solid #8b5cf6'; el.style.borderRadius = '50%';`,
}

const SIDEBAR_WIDTH: Mutation = {
  name: 'sidebar-width',
  selector: 'aside, [class*="sidebar"], [class*="Sidebar"]',
  apply: `el.style.width = '280px'; el.style.minWidth = '280px';`,
  max: 1,
}

const TAB_ACTIVE_COLOR: Mutation = {
  name: 'tab-active-color',
  selector: '[role="tab"][aria-selected="true"], [class*="activeTab"], [class*="active-tab"]',
  apply: `el.style.borderBottomColor = '#8b5cf6'; el.style.color = '#8b5cf6';`,
}

const H3_COLOR: Mutation = {
  name: 'h3-section-color',
  selector: 'h3',
  apply: `el.style.color = '#1e40af';`,
}

const ADD_TOOLTIP_BADGE: Mutation = {
  name: 'add-tooltip-badge',
  selector: 'h1, [data-testid="page-header-title"]',
  apply: `
    const badge = document.createElement('span');
    badge.textContent = 'BETA';
    badge.style.cssText = 'background:#818cf8;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:8px;vertical-align:middle;font-weight:700;letter-spacing:0.5px;';
    el.appendChild(badge);
  `,
  max: 1,
}

const REMOVE_BREADCRUMB: Mutation = {
  name: 'remove-breadcrumb',
  selector: '[aria-label="breadcrumb"], [class*="breadcrumb"], [class*="Breadcrumb"], nav[aria-label*="breadcrumb" i]',
  apply: `el.remove();`,
  max: 1,
}

const PROGRESS_BAR_COLOR: Mutation = {
  name: 'progress-bar-color',
  selector: '[role="progressbar"], [class*="progress"], [class*="Progress"]',
  apply: `el.style.backgroundColor = '#f59e0b';`,
}

// ---------------------------------------------------------------------------
// Per-page mutation assignments
// ---------------------------------------------------------------------------

const PAGE_MUTATIONS: Record<string, Mutation[]> = {
  // --- Employer pages ---
  'settings-security--employer': [
    HEADING_RENAME('System Admin', 'Security & Access Control'),
    NAV_BG_DARK,
    BUTTON_RESTYLE,
    ADD_BANNER,
    REMOVE_HELP_BTN,
    FONT_SIZE_BUMP,
    BORDER_ACCENT,
  ],
  'settings-users--employer': [
    HEADING_RENAME('Users', 'Team Members'),
    BUTTON_RESTYLE,
    ADD_FILTER_CHIP,
    LINK_COLOR_CHANGE,
  ],
  'settings-directory--employer': [
    HEADING_RENAME('Directory', 'Organization Directory'),
    FONT_SIZE_BUMP,
    BORDER_ACCENT,
  ],
  'settings-generic-fields--employer': [
    HEADING_RENAME('Fields', 'Custom Fields'),
    INPUT_BORDER_RED,
    SPACING_INCREASE,
  ],
  'job-detail--employer': [
    HEADING_RENAME('Job', 'Position'),
    STATUS_BADGE_GREEN,
    SPACING_INCREASE,
    ADD_INFO_ROW,
    BG_SUBTLE_CHANGE,
  ],
  'job-edit--employer': [
    HEADING_RENAME('Edit', 'Modify'),
    INPUT_BORDER_RED,
    BUTTON_RESTYLE,
    FONT_SIZE_BUMP,
  ],
  'jobs-list--employer': [
    ADD_BANNER,
    LINK_COLOR_CHANGE,
    STATUS_BADGE_GREEN,
    FONT_SIZE_BUMP,
    ADD_FILTER_CHIP,
  ],
  'job-interview-management--employer': [
    HEADING_RENAME('Interview', 'Evaluation'),
    BUTTON_RESTYLE,
    BORDER_ACCENT,
  ],
  'jobs-applicants--employer': [
    HEADING_RENAME('Applicants', 'Candidates'),
    ADD_FILTER_CHIP,
    LINK_COLOR_CHANGE,
    STATUS_BADGE_GREEN,
  ],
  'jobs-applicants-detail--employer': [
    AVATAR_BORDER,
    H3_COLOR,
    SPACING_INCREASE,
    ADD_INFO_ROW,
  ],
  'jobs-applicants-offer--employer': [
    HEADING_RENAME('Offer', 'Compensation Package'),
    BORDER_ACCENT,
    BUTTON_RESTYLE,
  ],
  'jobs-applicants-onboard--employer': [
    HEADING_RENAME('Onboard', 'Welcome Aboard'),
    PROGRESS_BAR_COLOR,
    BUTTON_RESTYLE,
  ],
  'candidates-list--employer': [
    ADD_BANNER,
    FONT_SIZE_BUMP,
    LINK_COLOR_CHANGE,
  ],
  'candidates-detail--employer': [
    AVATAR_BORDER,
    H3_COLOR,
    ADD_INFO_ROW,
    SIDEBAR_WIDTH,
    BORDER_ACCENT,
  ],
  'contractor-detail--employer': [
    AVATAR_BORDER,
    HEADING_RENAME('Contractor', 'Supplier Worker'),
    H3_COLOR,
    ADD_TOOLTIP_BADGE,
  ],
  'contractors--employer': [
    ADD_FILTER_CHIP,
    STATUS_BADGE_GREEN,
    LINK_COLOR_CHANGE,
  ],
  'work-order-detail--employer': [
    TABLE_HEADER_DARK,
    TABLE_CELL_PAD,
    H3_COLOR,
    SPACING_INCREASE,
    ADD_INFO_ROW,
    BORDER_ACCENT,
  ],
  'work-order-modify--employer': [
    HEADING_RENAME('Modify', 'Amend'),
    INPUT_BORDER_RED,
    BUTTON_RESTYLE,
    FONT_SIZE_BUMP,
  ],
  'work-orders--employer': [
    NAV_BG_DARK,
    ADD_FILTER_CHIP,
    STATUS_BADGE_GREEN,
    LINK_COLOR_CHANGE,
  ],
  'sow-detail--employer': [
    HEADING_RENAME('Cloud', 'Enterprise Cloud'),
    H3_COLOR,
    BORDER_ACCENT,
    FOOTER_BG,
  ],
  'sow--employer': [
    ADD_BANNER,
    LINK_COLOR_CHANGE,
    FONT_SIZE_BUMP,
  ],
  'invoices-summary--employer': [
    HEADING_RENAME('Invoices', 'Billing'),
    NAV_BG_DARK,
    FONT_SIZE_BUMP,
    ADD_FILTER_CHIP,
    BORDER_ACCENT,
  ],
  'approvals--employer': [
    HEADING_RENAME('Approvals', 'Pending Reviews'),
    STATUS_BADGE_GREEN,
    ADD_BANNER,
    BUTTON_RESTYLE,
  ],
  'expenses-detail--employer': [
    TABLE_HEADER_DARK,
    TABLE_CELL_PAD,
    H3_COLOR,
    HIDE_LAST_COLUMN,
    ADD_INFO_ROW,
  ],
  'time-entries--employer': [
    ADD_FILTER_CHIP,
    STATUS_BADGE_GREEN,
    LINK_COLOR_CHANGE,
    FONT_SIZE_BUMP,
  ],
  'reporting--employer': [
    HEADING_RENAME('Reports', 'Analytics'),
    NAV_BG_DARK,
    BORDER_ACCENT,
    ADD_TOOLTIP_BADGE,
  ],
  'checklist-actions--employer': [
    HEADING_RENAME('Checklist', 'Action Items'),
    BUTTON_RESTYLE,
    STATUS_BADGE_GREEN,
  ],
  'home--employer': [
    NAV_BG_DARK,
    HEADING_RENAME('Create a Job', 'Post a Position'),
    FONT_SIZE_BUMP,
    FOOTER_BG,
    SIDEBAR_WIDTH,
  ],

  // --- Vendor pages ---
  'candidate-timesheets--vendor': [
    TABLE_HEADER_DARK,
    TABLE_CELL_PAD,
    LINK_COLOR_CHANGE,
    HEADING_RENAME('Timesheet', 'Time Entry'),
    ADD_FILTER_CHIP,
    HIDE_LAST_COLUMN,
  ],
  'timesheets-week--vendor': [
    TAB_ACTIVE_COLOR,
    ADD_TOOLTIP_BADGE,
    BUTTON_RESTYLE,
    FONT_SIZE_BUMP,
  ],
  'timesheets-month--vendor': [
    TAB_ACTIVE_COLOR,
    HEADING_RENAME('Month', 'Monthly View'),
    BORDER_ACCENT,
  ],
  'time-entries--vendor': [
    ADD_FILTER_CHIP,
    LINK_COLOR_CHANGE,
    STATUS_BADGE_GREEN,
  ],
  'work-order-detail--vendor': [
    H3_COLOR,
    SPACING_INCREASE,
    ADD_INFO_ROW,
  ],
  'vendor-candidate-detail--vendor': [
    AVATAR_BORDER,
    H3_COLOR,
    BORDER_ACCENT,
    ADD_TOOLTIP_BADGE,
  ],
  'vendor-applied-candidates--vendor': [
    LINK_COLOR_CHANGE,
    STATUS_BADGE_GREEN,
    FONT_SIZE_BUMP,
  ],
  'jobs-list--vendor': [
    LINK_COLOR_CHANGE,
    STATUS_BADGE_GREEN,
    ADD_FILTER_CHIP,
  ],
  'jobs-applicants--vendor': [
    HEADING_RENAME('Applicants', 'Submissions'),
    LINK_COLOR_CHANGE,
    BUTTON_RESTYLE,
  ],

  // These pages are intentionally OMITTED → they will be identical in the report:
  // - home--vendor
  // - sow--vendor
  // - sow-detail--vendor
  // - expenses--employer
  // - notification-preferences--employer
  // - work-orders--vendor
  // - candidate-timesheets-mobile-allocation--vendor
  // - candidate-timesheets-mobile-day--vendor
}

async function captureAtViewports(
  page: import('playwright').Page,
  phaseDir: string,
  dirName: string,
  quiet: boolean,
) {
  for (let i = 0; i < VIEWPORTS.length; i++) {
    const vp = VIEWPORTS[i]
    if (i > 0) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.waitForTimeout(200)
    }
    const manifest = await captureDomManifest(page, (msg) => { if (!quiet) console.log(`    ${msg}`) })
    writeFileSync(join(phaseDir, dirName, `dom-manifest-${vp.width}.json`), JSON.stringify(manifest, null, 2))
    const htmlDir = join(phaseDir, dirName, `html-${vp.width}`)
    mkdirSync(htmlDir, { recursive: true })
    writeFileSync(join(htmlDir, 'index.html'), await page.content())
  }
  // Restore primary viewport
  if (VIEWPORTS.length > 1) {
    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height })
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  const idx = args.indexOf('--page')
  return { pageFilter: idx !== -1 ? args[idx + 1] : null }
}

async function main() {
  const { pageFilter } = parseArgs()
  console.log('Creating synthetic "after" captures...\n')
  if (pageFilter) console.log(`Filtering to pages matching: ${pageFilter}\n`)

  const browser = await chromium.launch()
  const primary = VIEWPORTS[0]
  const context = await browser.newContext({ viewport: { width: primary.width, height: primary.height } })

  mkdirSync(afterDir, { recursive: true })
  const afterAssetsPath = join(afterDir, '_assets')
  const beforeAssetsPath = join(beforeDir, '_assets')
  if (!existsSync(afterAssetsPath) && existsSync(beforeAssetsPath)) {
    symlinkSync('../before/_assets', afterAssetsPath)
  }

  const pageDirs = readdirSync(beforeDir).filter(d => {
    if (d.startsWith('_') || d.startsWith('.')) return false
    if (pageFilter && !d.startsWith(pageFilter)) return false
    return findBeforeHtml(d) !== null
  })

  let identicalCount = 0
  let mutatedCount = 0

  for (const dirName of pageDirs) {
    const beforeHtmlPath = findBeforeHtml(dirName)!
    const mutations = PAGE_MUTATIONS[dirName] || []
    const isIdentical = mutations.length === 0

    if (isIdentical) {
      console.log(`  ${dirName}: IDENTICAL (no mutations)`)
    } else {
      console.log(`  ${dirName}: applying ${mutations.length} mutations...`)
    }

    const page = await context.newPage()

    let beforeHtml = readFileSync(beforeHtmlPath, 'utf-8')
    beforeHtml = beforeHtml
      .replace(/<script data-vr-injected[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/ data-vr-idx="\d+"/g, '')

    // Write cleaned source HTML for loading
    const tmpHtmlDir = join(beforeDir, dirName, `html-${primary.width}`)
    mkdirSync(tmpHtmlDir, { recursive: true })
    const tmpHtmlPath = join(tmpHtmlDir, 'index.html')
    writeFileSync(tmpHtmlPath, beforeHtml)

    await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle' })

    await page.evaluate(() => {
      document.querySelectorAll('style').forEach(s => {
        if (s.textContent && s.textContent.includes('data-vr-hl')) s.remove()
      })
    })

    // Capture clean "before" manifests + HTML at all viewports
    await captureAtViewports(page, beforeDir, dirName, true)

    // Apply mutations (at primary viewport)
    let applied = 0
    for (const mutation of mutations) {
      const maxEl = mutation.max ?? 3
      try {
        const count = await page.evaluate(({ selector, code, maxEl }) => {
          const els = document.querySelectorAll(selector)
          let n = 0
          els.forEach((el, i) => {
            if (i >= maxEl) return
            try {
              new Function('el', code)(el)
              n++
            } catch {}
          })
          return n
        }, { selector: mutation.selector, code: mutation.apply, maxEl })

        if (count > 0) {
          console.log(`    ✓ ${mutation.name} (${count} element${count > 1 ? 's' : ''})`)
          applied++
        } else {
          console.log(`    ○ ${mutation.name} (no match)`)
        }
      } catch (err) {
        console.log(`    ✗ ${mutation.name}: ${err instanceof Error ? err.message : err}`)
      }
    }

    // Capture "after" manifests + HTML at all viewports
    mkdirSync(join(afterDir, dirName), { recursive: true })
    await captureAtViewports(page, afterDir, dirName, isIdentical)

    if (isIdentical) {
      console.log(`    → identical copy (${VIEWPORTS.length} viewports)\n`)
      identicalCount++
    } else {
      console.log(`    → ${applied}/${mutations.length} mutations × ${VIEWPORTS.length} viewports\n`)
      mutatedCount++
    }

    await page.close()
  }

  await browser.close()

  console.log(`\nSummary: ${mutatedCount} pages mutated, ${identicalCount} pages identical`)
  console.log('Run "npm run compare" to generate the report.')
}

main().catch(console.error)
