import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  root: 'src/report',
  build: {
    outDir: '../../dist/report',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/report/index.html',
    },
  },
})
