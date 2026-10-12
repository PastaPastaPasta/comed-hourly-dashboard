import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Publish the tariff defaults beside the app so other tools (the solar compute gate) read
// the same numbers the dashboard uses: https://<pages>/comed-hourly-dashboard/tariffs.json
const publishTariffs = (): Plugin => ({
  name: 'publish-tariffs',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'tariffs.json',
      source: readFileSync(new URL('./src/data/tariffs.json', import.meta.url), 'utf8'),
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/comed-hourly-dashboard/' : '/',
  plugins: [react(), publishTariffs()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
  },
})
