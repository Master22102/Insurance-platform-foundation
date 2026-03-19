import { expect, test } from '@playwright/test';

test.describe('Public + gating smoke', () => {
  test('marketing home loads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/$/);
  });

  test('FOCL routes require sign-in', async ({ page }) => {
    await page.goto('/focl/features/intelligence', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(signin|auth\/sign-in)/);

    await page.goto('/focl/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(signin|auth\/sign-in)/);
  });
});

