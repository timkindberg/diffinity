import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// Independent Vite config for the kitchen-sink demo site.
// Builds to ../site/app/ so it can be served alongside the static project site.
export default defineConfig({
  plugins: [preact()],
  root: 'demo-app',
  base: './',
  server: {
    port: 5174,
    open: true,
  },
  build: {
    outDir: '../site/app',
    emptyOutDir: true,
  },
})
