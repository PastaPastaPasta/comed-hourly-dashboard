import { expect, test } from '@playwright/test';

test('dashboard renders on desktop and mobile', async ({ page }) => {
  await page.route('https://hourlypricing.comed.com/api**', async (route) => {
    const url = new URL(route.request().url());
    const type = url.searchParams.get('type');

    if (type === 'currenthouraverage') {
      await route.fulfill({ json: [{ price: '2.5' }] });
      return;
    }

    if (type === '5minutefeed') {
      await route.fulfill({
        json: [{ millisUTC: String(Date.now()), price: '2.5' }],
      });
      return;
    }

    if (type === 'day') {
      await route.fulfill({
        contentType: 'text/html',
        body: '[[Date.UTC(2026,4,9,0,0,0), 2.1], [Date.UTC(2026,4,9,1,0,0), -0.4], [Date.UTC(2026,4,9,2,0,0), 3.4]]',
      });
      return;
    }

    await route.fulfill({
      contentType: 'text/html',
      body: '[[Date.UTC(2026,4,9,0,0,0), 2.8], [Date.UTC(2026,4,9,1,0,0), 1.3], [Date.UTC(2026,4,9,2,0,0), 1.0]]',
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Full variable electricity price' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hour-ending price curve' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hour-ending table' })).toBeVisible();
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
});
