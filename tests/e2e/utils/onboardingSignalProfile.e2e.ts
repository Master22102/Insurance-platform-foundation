import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { serviceRolePatch } from './serviceRoleRest';

export async function reopenOnboarding(
  request: APIRequestContext,
  userId: string,
): Promise<void> {
  const { status } = await serviceRolePatch(request, 'user_profiles', `user_id=eq.${userId}`, {
    onboarding_completed: false,
  });
  expect([200, 204]).toContain(status);
}

export async function markOnboardingComplete(
  request: APIRequestContext,
  userId: string,
): Promise<void> {
  const { status } = await serviceRolePatch(request, 'user_profiles', `user_id=eq.${userId}`, {
    onboarding_completed: true,
  });
  expect([200, 204]).toContain(status);
}

/** Terms → signal (type mode) → preview → confirm; waits for app shell. */
export async function completeSignalOnboardingWithTypedNarration(
  page: Page,
  narrative: string,
): Promise<void> {
  await expect(page.getByRole('heading', { name: /Terms and Conditions/i })).toBeVisible({
    timeout: 25_000,
  });
  await page.locator('label').filter({ hasText: /Terms and Conditions/i }).click();
  await page.locator('label').filter({ hasText: /Privacy Policy/i }).click();
  await page.getByRole('button', { name: /Accept and continue/i }).click();
  await page.getByRole('button', { name: /Type instead/i }).click();
  await page.getByPlaceholder(/e.g. I want help/i).fill(narrative);
  await page.getByRole('button', { name: /Preview summary/i }).click();
  await expect(page.getByRole('button', { name: /Places/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Activities/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Food/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Travel style/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Confirm$/i }).click();
  await page.waitForURL(/\/(trips|get-started)/, { timeout: 90_000 });
}
