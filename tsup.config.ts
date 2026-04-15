import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    clean: true,
    outDir: 'dist',
    external: ['playwright'],
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    splitting: false,
    outDir: 'dist',
    external: ['playwright'],
    banner: { js: '#!/usr/bin/env node' },
  },
])
