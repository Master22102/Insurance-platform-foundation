import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Visible browser window. On Windows, default to **Microsoft Edge** (channel) so a window
 * opens even when Playwright’s bundled Chromium fails to show from some terminals.
 * Override: PLAYWRIGHT_CHANNEL=chrome | msedge | chromium (omit channel = bundled Chromium)
 */
async function launchVisibleBrowser() {
  const headless = false;
  const slowMo = process.env.PLAYWRIGHT_SLOWMO ? Number(process.env.PLAYWRIGHT_SLOWMO) : 0;

  const tryLaunch = async (opts, label) => {
    const b = await chromium.launch(opts);
    console.log(`[e2e:auth] Launched: ${label}`);
    return b;
  };

  if (process.env.PLAYWRIGHT_CHANNEL) {
    return tryLaunch({ headless, channel: process.env.PLAYWRIGHT_CHANNEL, slowMo }, `channel=${process.env.PLAYWRIGHT_CHANNEL}`);
  }

  if (process.platform === 'win32') {
    try {
      return await tryLaunch({ headless, channel: 'msedge', slowMo }, 'Microsoft Edge (channel)');
    } catch (e) {
      console.warn('[e2e:auth] Edge launch failed, trying Chrome channel…', e?.message || e);
    }
    try {
      return await tryLaunch({ headless, channel: 'chrome', slowMo }, 'Google Chrome (channel)');
    } catch (e) {
      console.warn('[e2e:auth] Chrome channel failed, trying bundled Chromium…', e?.message || e);
    }
  }

  return tryLaunch({ headless, slowMo }, 'Playwright Chromium (bundled)');
}

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
/** Open this path first (default `/` = marketing / home). Override: E2E_AUTH_START_PATH=/signin */
const startPath = process.env.E2E_AUTH_START_PATH || '/';
const startURL = `${baseURL}${startPath.startsWith('/') ? startPath : `/${startPath}`}`;
const outPath = path.join(process.cwd(), '.playwright', 'storageState.json');

await fs.mkdir(path.dirname(outPath), { recursive: true });

console.log(
  `[e2e:auth] Tip: run \`npm run dev\` in another terminal so the app is up (same host/port as ${baseURL}).`,
);
console.log('[e2e:auth] If no window appears: run `npx playwright install chromium` or double-click scripts/e2e/open-e2e-auth.cmd (runs outside Cursor).');

const browser = await launchVisibleBrowser();
const context = await browser.newContext();
const page = await context.newPage();

page.setDefaultTimeout(0);
page.setDefaultNavigationTimeout(0);

console.log(`[e2e:auth] Opening ${startURL}`);
try {
  await page.goto(startURL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
} catch (e) {
  console.error('[e2e:auth] Could not load the page. Is the dev server running? Try: npm run dev');
  console.error(`[e2e:auth] ${e?.message || e}`);
  await browser.close();
  process.exit(1);
}

console.log('[e2e:auth] Sign in manually in the browser window when ready.');
console.log('[e2e:auth] Session is saved when you reach an app route OR when Supabase stores auth in this origin.');

/** True when user is in the app shell or Supabase session exists in localStorage (works from `/` after login). */
const isAuthenticated = () => {
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
  if (okPrefixes.some((prefix) => p.startsWith(prefix))) return true;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes('auth-token')) {
        const v = localStorage.getItem(k);
        if (!v) continue;
        const parsed = JSON.parse(v);
        if (parsed?.access_token && String(parsed.access_token).length > 0) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
};

let autoDetected = false;
try {
  await page.waitForFunction(isAuthenticated, { timeout: 120_000 });
  autoDetected = true;
  console.log(`[e2e:auth] Auth detected at ${page.url()}`);
} catch {
  console.log('[e2e:auth] Auto-detect timed out after 120s.');
  console.log('[e2e:auth] If you are signed in and the app works, press Enter here to save anyway.');
  const rl = readline.createInterface({ input, output });
  await rl.question('[e2e:auth] Press Enter to save storage state > ');
  rl.close();
}

await context.storageState({ path: outPath });
console.log(`[e2e:auth] Saved storage state to ${outPath}${autoDetected ? '' : ' (manual confirmation)'}`);

await browser.close();
