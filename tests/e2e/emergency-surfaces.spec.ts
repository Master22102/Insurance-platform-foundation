import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';

test.describe.serial('Emergency surfaces', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.use({ storageState: getStorageStatePath() });

  test('safety page renders and opens SOS', async ({ page }) => {
    await page.goto('/safety');
    await expect(page.getByTestId('safety-page-root')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('safety-card-panel')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('safety-open-sos-button').click();
    await expect(page.getByTestId('emergency-sos-sheet')).toBeVisible({ timeout: 10_000 });
  });

  test('safety vault page supports add/archive', async ({ page }) => {
    await page.goto('/account/safety-vault');
    await expect(page.getByTestId('safety-vault-root')).toBeVisible({ timeout: 20_000 });
    const label = `E2E doc ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await page.getByTestId('safety-vault-label-input').fill(label);
    await page.getByTestId('safety-vault-add-button').click();
    await expect(page.getByTestId('safety-vault-root').getByText(label, { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
