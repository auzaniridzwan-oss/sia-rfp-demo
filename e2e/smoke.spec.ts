import { expect, test } from '@playwright/test';

const SITES = [
  { entity: 'SQ', name: 'Singapore Airlines', url: process.env.SQ_URL ?? 'https://sq-demo-seven.vercel.app' },
  { entity: 'TR', name: 'Scoot', url: process.env.TR_URL ?? 'https://scoot-demo-pied.vercel.app' },
];

for (const site of SITES) {
  test.describe(`${site.name}`, () => {
    test('API health: right entity, SerpAPI and Braze REST configured', async ({ request }) => {
      const res = await request.get(`${site.url}/api/health`);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body).toMatchObject({ ok: true, entity: site.entity, serpapi: true, brazeRest: true });
      if (!body.presenter) console.warn(`${site.name}: DEMO_ADMIN_TOKEN not set — presenter actions disabled`);
    });

    test('home renders hero, search widget and promo row', async ({ page }) => {
      await page.goto(`${site.url}/?debug=false`);
      await expect(page).toHaveTitle(new RegExp(site.name));
      await expect(page.getByRole('form', { name: 'Search flights' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
      await expect(page.locator('main h2').first()).toBeVisible();
    });

    test('search returns real flights with fares', async ({ page }) => {
      await page.goto(`${site.url}/?debug=false`);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page).toHaveURL(/\/booking\/flights/);
      await expect(page.getByRole('heading', { name: /to (Perth|Tokyo|Bangkok)/ })).toBeVisible();
      await expect(page.locator('main li button', { hasText: 'SGD' }).first()).toBeVisible({ timeout: 30_000 });
    });

    test('preferences require login', async ({ page }) => {
      await page.goto(`${site.url}/preferences`);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    });

    test('@mobile home has no horizontal scroll', async ({ page }) => {
      await page.goto(`${site.url}/?debug=false`);
      await expect(page.getByRole('form', { name: 'Search flights' })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
