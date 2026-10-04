import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/hosted',
  outputDir: 'test-results-hosted',
  fullyParallel: false,
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-hosted', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'pnpm hosted:dev',
      url: 'http://127.0.0.1:8787/api/config',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
    {
      command: 'node scripts/serve-hosted-local.mjs',
      url: 'http://127.0.0.1:4174/',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
