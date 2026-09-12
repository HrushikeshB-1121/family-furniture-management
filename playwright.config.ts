import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

dotenv.config({
  path: '.env.test',
});
export default defineConfig({
  testDir: './tests',

  fullyParallel: false,

  reporter: 'html',

  use: {
    baseURL:
      process.env.E2E_BASE_URL ?? 'http://localhost:5173',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url:
      process.env.E2E_BASE_URL ??
      'http://localhost:5173',
    reuseExistingServer: true,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: /admin\.spec\.ts/,
    },

    {
      name: 'staff',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/staff.json',
      },
      dependencies: ['setup'],
      testMatch: /staff\.spec\.ts/,
    },
  ],
});