import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const outPath = path.join(process.cwd(), '.playwright', 'storageState.json');

await fs.mkdir(path.dirname(outPath), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

// In case sign-in takes a while, don't fail due to Playwright default timeouts.
page.setDefaultTimeout(0);
page.setDefaultNavigationTimeout(0);

console.log(`[e2e:auth] Opening ${baseURL}/trips`);
await page.goto(`${baseURL}/trips`, { waitUntil: 'domcontentloaded' });

console.log('[e2e:auth] If you see a sign-in screen, log in manually in this window.');
console.log('[e2e:auth] Once the URL reaches an authenticated area (e.g. /trips), the session will be saved automatically.');

// Wait for an authenticated app route. Some accounts land on onboarding/get-started first.
const isAuthenticatedPath = () => {
  const p = location.pathname;
  const okPrefixes = [
    '/trips',
    '/account',
    '/scan',
    '/coverage',
    '/claims',
    '/incidents',
    '/policies',
    '/onboarding',
    '/get-started',
  ];
  return okPrefixes.some((prefix) => p.startsWith(prefix));
};

await page.waitForFunction(isAuthenticatedPath, { timeout: 0 });
console.log(`[e2e:auth] Auth route detected at ${page.url()}`);

await context.storageState({ path: outPath });
console.log(`[e2e:auth] Saved storage state to ${outPath}`);

await browser.close();

