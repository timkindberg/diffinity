import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync, writeFileSync, unlinkSync, readdirSync, rmdirSync } from 'fs'
import { resolve, join } from 'path'

/**
 * Inline all JS and CSS assets into the HTML file, producing a single
 * self-contained HTML file. This is critical for the report to work
 * when opened from file:// (no server needed).
 *
 * Also strips `type="module"` from script tags since ES modules are
 * blocked by CORS on file:// in Chrome.
 */
function singleFilePlugin(): Plugin {
  return {
    name: 'single-file-inline',
    enforce: 'post',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist/report')
      const htmlPath = join(outDir, 'index.html')
      let html: string
      try {
        html = readFileSync(htmlPath, 'utf-8')
      } catch {
        return // no output to process
      }

      // Inline CSS <link> tags
      html = html.replace(
        /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g,
        (_, href) => {
          const cssPath = join(outDir, href)
          const css = readFileSync(cssPath, 'utf-8')
          try { unlinkSync(cssPath) } catch { /* ignore */ }
          return `<style>${css}</style>`
        },
      )

      // Inline JS <script> tags and strip type="module"
      html = html.replace(
        /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g,
        (_, src) => {
          const jsPath = join(outDir, src)
          const js = readFileSync(jsPath, 'utf-8')
          try { unlinkSync(jsPath) } catch { /* ignore */ }
          return `<script>${js}</script>`
        },
      )

      writeFileSync(htmlPath, html)

      // Clean up empty assets directory
      try {
        const assetsDir = join(outDir, 'assets')
        const remaining = readdirSync(assetsDir)
        if (remaining.length === 0) rmdirSync(assetsDir)
      } catch { /* ignore */ }
    },
  }
}

export default defineConfig({
  plugins: [preact(), singleFilePlugin()],
  root: 'src/report',
  build: {
    outDir: '../../dist/report',
    emptyOutDir: true,
    assetsInlineLimit: 100000, // Inline small assets as base64
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/report/index.html',
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
