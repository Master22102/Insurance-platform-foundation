import { test, expect } from '@playwright/test';

test.describe('Sign in error handling', () => {
  test('Wrong password shows a clear error and recovers submit state', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });

    await page.getByPlaceholder('you@example.com').fill('not-a-real-user@example.com');
    await page.getByPlaceholder('••••••••').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.getByText(/incorrect email or password|invalid login credentials/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
  });
});
