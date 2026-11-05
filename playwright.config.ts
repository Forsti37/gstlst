import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)

export const MOCK_SUPABASE_URL = 'http://127.0.0.1:54399'

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/gstlst/',
    trace: 'on-first-retry',
    serviceWorkers: 'block',
    locale: 'en-US',
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  // A build of its own that talks to a mocked backend (see e2e/mock-backend.ts). It must never
  // be the build that gets deployed, so it stays out of dist/.
  webServer: {
    command: 'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173/gstlst/login',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: MOCK_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-mock-key',
    },
  },
})
