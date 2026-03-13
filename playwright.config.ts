import { defineConfig, devices } from '@playwright/test'
import { E2E_DB_PATH, E2E_AUTH } from './tests/e2e/e2e-config'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: require.resolve('./tests/setup/global-setup.ts'),
  timeout: 30 * 1000,
  fullyParallel: true,
  testMatch: /.*\.spec\.ts/,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 15 * 1000,
    actionTimeout: 10 * 1000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts$/,
      testDir: './tests/setup',
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      DATABASE_URL: E2E_DB_PATH,
      JWT_SECRET: E2E_AUTH.jwtSecret,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
      AUTH_USERNAME: E2E_AUTH.username,
      AUTH_PASSWORD_HASH: E2E_AUTH.passwordHash,
      NODE_ENV: 'test',
      PORT: '3000',
    },
  },
})
