import { resolve } from 'path'
import { compareDirs } from './compare-v2.js'

const args = process.argv.slice(2)

function printUsage() {
  console.log(`diffinity — Semantic DOM diffing engine

Usage:
  diffinity compare <before-dir> <after-dir> [options]

Options:
  --report-dir <dir>   Directory to write the report (default: parent of before-dir)
  --widths <widths>    Comma-separated viewport widths (default: auto-detected)
  --help               Show this help message

Exit codes:
  0  No changes detected
  1  Changes detected`)
}

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printUsage()
  process.exit(0)
}

const command = args[0]

if (command !== 'compare') {
  console.error(`Unknown command: ${command}`)
  console.error(`Run 'diffinity --help' for usage.`)
  process.exit(2)
}

// Parse compare arguments
const positional: string[] = []
let reportDir: string | undefined
let widths: number[] | undefined

for (let i = 1; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--report-dir') {
    const val = args[++i]
    if (!val) {
      console.error('Error: --report-dir requires a value')
      process.exit(2)
    }
    reportDir = resolve(val)
  } else if (arg === '--widths') {
    const val = args[++i]
    if (!val) {
      console.error('Error: --widths requires a value')
      process.exit(2)
    }
    widths = val.split(',').map(s => {
      const n = parseInt(s.trim(), 10)
      if (isNaN(n) || n <= 0) {
        console.error(`Error: invalid width '${s}' — must be a positive integer`)
        process.exit(2)
      }
      return n
    })
  } else if (arg.startsWith('-')) {
    console.error(`Unknown option: ${arg}`)
    console.error(`Run 'diffinity compare --help' for usage.`)
    process.exit(2)
  } else {
    positional.push(arg)
  }
}

if (positional.length !== 2) {
  console.error('Error: compare requires exactly 2 arguments: <before-dir> <after-dir>')
  printUsage()
  process.exit(2)
}

const [beforeDir, afterDir] = positional.map(p => resolve(p))

try {
  const result = compareDirs({
    beforeDir,
    afterDir,
    reportDir,
    widths,
  })

  const hasChanges = result.pages.some(page =>
    Object.values(page.viewportDiffs).some(vp => vp.summary.totalChanges > 0)
  )

  process.exit(hasChanges ? 1 : 0)
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : err}`)
  process.exit(2)
}
