import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig, devices } from '@playwright/test';

/**
 * Repo root for dotenv + `E2E_PROJECT_ROOT`. Does not rely on `process.cwd()` alone: Windows workers
 * and `npx` spawns often start with the wrong cwd. Order: env (launch scripts) → walk up to
 * `playwright-repo-root.cjs` → cwd fallback.
 */
function resolveProjectRootDir(): string {
  const env = process.env.E2E_PROJECT_ROOT?.trim();
  if (env) return path.resolve(env);

  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    const marker = path.resolve(dir, 'playwright-repo-root.cjs');
    if (fs.existsSync(marker)) {
      const req = createRequire(marker);
      return req(marker) as string;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.resolve(process.cwd());
}

const projectDir = resolveProjectRootDir();
process.env.E2E_PROJECT_ROOT = projectDir;

// Load .env.local / .env like Next (no extra deps). Playwright does not load these by default.
for (const name of ['.env.local', '.env']) {
  const p = path.join(projectDir, name);
  if (!fs.existsSync(p)) continue;
  const raw = fs.readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

/*
  Playwright's HTTP `webServer.url` probe uses Node `http` + optional `HTTP_PROXY`. Proxied
  requests to loopback often never reach Next → status 0 until timeout. Ensure loopback bypasses
  proxies for the test runner (browser + any Node fetches).
*/
function mergeNoProxyForLoopback() {
  const add = ['127.0.0.1', 'localhost', '::1'];
  const cur = (process.env.NO_PROXY ?? process.env.no_proxy ?? '').trim();
  const parts = new Set(cur.split(/[\s,]+/).filter(Boolean));
  for (const h of add) parts.add(h);
  const merged = Array.from(parts).join(',');
  process.env.NO_PROXY = merged;
  process.env.no_proxy = merged;
}
mergeNoProxyForLoopback();

/*
  Use 127.0.0.1 (not "localhost") so the webServer reuse probe matches a dev server on Windows:
  "localhost" can resolve to ::1 while Next reports EADDRINUSE on IPv6 :::3000 — Playwright then
  thinks nothing is ready, spawns a second next dev, and the second process dies on port clash.
*/
const playwrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

/** Port Next binds to (`-p`); must match `PLAYWRIGHT_BASE_URL` when overridden. */
function devServerPortFromBaseUrl(base: string): number {
  try {
    const u = new URL(base);
    if (u.port !== '') return Number(u.port);
    /* Bare http://host with no port → assume Next dev default, not :80 */
    return 3000;
  } catch {
    return 3000;
  }
}
const playwrightDevPort = devServerPortFromBaseUrl(playwrightBaseUrl);

export default defineConfig({
  ...(process.env.E2E_REQUIRE_CONTRACTS === '1'
    ? { globalSetup: './tests/e2e/global-require-contracts-setup.ts' }
    : {}),
  testDir: './tests/e2e',
  /* list = steady progress (non-TTY defaults to "dot", which looks idle). html = post-run report. */
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  /*
    Default 2 workers: specs share one storageState user; `reopenOnboarding` mutates server state and
    races with full-journey / account tests when workers >= 4. Override with E2E_WORKERS=4 for speed
    when not running onboarding-reopen suites together.
  */
  workers:
    process.env.E2E_WORKERS !== undefined
      ? Math.max(1, parseInt(process.env.E2E_WORKERS, 10) || 1)
      : 2,
  // Starts Next with E2E_QUICK_SCAN_SKIP_CREDIT so quick-scan determinism can pass in CI
  // without seeding scan_credits_remaining. Locally, reuse an existing dev server or add
  // E2E_QUICK_SCAN_SKIP_CREDIT=1 to `.env.local` (see tests/e2e/README.md).
  // Default webServer stdout is "ignore" in Playwright — Next compile then looks "frozen". Pipe logs so you see progress.
  webServer: process.env.PLAYWRIGHT_NO_WEB_SERVER
    ? undefined
    : {
        /*
          Pin port 3000 so baseURL matches. Without `-p 3000`, Next may bind to 3001 when 3000 is busy —
          Playwright would still probe localhost:3000 and tests would hit a different app or stall.
          With `-p 3000`, reuseExistingServer (!CI) reuses whatever already answers on 3000; otherwise
          Next fails fast if the port is truly unavailable (free the port or use PLAYWRIGHT_NO_WEB_SERVER=1).
        */
        command: `npm run dev -- --hostname 127.0.0.1 -p ${playwrightDevPort}`,
        /*
          Port-only readiness: TCP connect to 127.0.0.1 / ::1 — avoids HTTP-over-proxy hangs that
          break `webServer.url` probes on some Windows / corporate setups (see mergeNoProxyForLoopback).
        */
        port: playwrightDevPort,
        /*
          Local default: reuse whatever listens on this port (often your manual `npm run dev`).
          That process does **not** get `webServer.env` — so `E2E_EXTRACTION_SYNC` injected here is ignored
          unless the same vars exist in `.env.local` **and** you restarted Next after editing.
          To force Playwright to spawn `npm run dev` with merged env (kill anything on :3000 first):
            set PLAYWRIGHT_REUSE_EXISTING_SERVER=0
        */
        reuseExistingServer:
          !process.env.CI && process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== '0',
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
        name: 'Next dev',
        env: {
          ...process.env,
          E2E_QUICK_SCAN_SKIP_CREDIT: '1',
          /** Inline policy extraction after upload (needs SUPABASE_SERVICE_ROLE_KEY in `.env.local`). */
          E2E_EXTRACTION_SYNC: '1',
          /** Client bundle flag: Deep Scan panel calls server to complete `job_queue` deep_scan rows in CI. */
          NEXT_PUBLIC_E2E_DEEP_SCAN_AUTOCOMPLETE: '1',
          /** Server-only: `/api/e2e/complete-deep-scan-job` enabled. */
          E2E_DEEP_SCAN_AUTOCOMPLETE: '1',
        },
      },
  use: {
    baseURL: playwrightBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 12'] },
    },
  ],
});

