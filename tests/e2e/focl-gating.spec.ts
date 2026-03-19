import { test, expect } from '@playwright/test';

test.describe('FOCL (Founder-only Cockpit) gating', () => {
  test('Unauthenticated users cannot access FOCL routes', async ({ page }) => {

    await page.goto('/focl/features/intelligence', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    await page.goto('/focl/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

