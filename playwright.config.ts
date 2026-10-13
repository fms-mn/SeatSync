import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', timeout: 30_000, fullyParallel: false,
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: [
    { command: 'npm run dev -w @seatsync/api', port: 4000, reuseExistingServer: !process.env.CI },
    { command: 'npm run dev -w @seatsync/web -- --host 127.0.0.1', port: 5173, reuseExistingServer: !process.env.CI },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
