import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const layoutTsxPath = path.resolve(__dirname, '../../app/layout.tsx');

/**
 * Deterministic checks that do not require a live Supabase session.
 * (Auth-gated E2E may fail when `.playwright/storageState.json` cookies are expired.)
 */
test.describe('Responsive / shell smoke', () => {
  test('marketing home loads at mobile viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/$/);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollW, 'document should not scroll horizontally at 375px').toBeLessThanOrEqual(clientW + 1);
  });

  test('features page loads at mobile viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/features', { waitUntil: 'domcontentloaded' });
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollW, 'document should not scroll horizontally at 375px').toBeLessThanOrEqual(clientW + 1);
  });

  for (const path of ['/pricing', '/terms', '/signup'] as const) {
    test(`${path} loads at mobile viewport without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollW, `document should not scroll horizontally at 375px on ${path}`).toBeLessThanOrEqual(clientW + 1);
    });
  }

  test('root layout defines viewport for mobile scaling (source)', () => {
    // Avoid relying on `page.goto` response status: `reuseExistingServer` may attach to a broken :3000 process.
    const src = fs.readFileSync(layoutTsxPath, 'utf8');
    expect(src).toMatch(/viewport:\s*\{/);
    expect(src).toMatch(/width:\s*['"]device-width['"]/);
    expect(src).toMatch(/initialScale:\s*1/);
  });

  test('root layout references web manifest (source)', () => {
    const src = fs.readFileSync(layoutTsxPath, 'utf8');
    expect(src).toMatch(/manifest:\s*['"]\/manifest\.json['"]/);
  });
});
