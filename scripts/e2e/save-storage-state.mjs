import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

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

let autoDetected = false;
try {
  await page.waitForFunction(isAuthenticatedPath, { timeout: 60_000 });
  autoDetected = true;
  console.log(`[e2e:auth] Auth route detected at ${page.url()}`);
} catch {
  console.log('[e2e:auth] Auto-detect timed out after 60s.');
  console.log('[e2e:auth] If you are already signed in and can see the app, press Enter here to save anyway.');
  const rl = readline.createInterface({ input, output });
  await rl.question('[e2e:auth] Press Enter to save storage state > ');
  rl.close();
}

await context.storageState({ path: outPath });
console.log(`[e2e:auth] Saved storage state to ${outPath}${autoDetected ? '' : ' (manual confirmation)'}`);

await browser.close();

