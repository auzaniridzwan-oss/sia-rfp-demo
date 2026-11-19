import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests against the deployed demo sites (or local ones via SQ_URL / TR_URL).
 * Uses the installed Google Chrome (no browser download). Run: pnpm smoke
 * Note: each run creates a few anonymous Braze profiles and may make cached SerpAPI calls.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 1,
  reporter: [['list']],
  use: { channel: 'chrome', headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' }, grep: /@mobile/ },
  ],
});
