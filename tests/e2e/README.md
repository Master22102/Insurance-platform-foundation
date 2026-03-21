# Playwright E2E

**C + D finish line (ship bar):** what “done” means for **`npm run e2e:contracts`** + core slice — **`docs/CD_CONTRACTS_AND_CORE_SLICE.md`**. Strict run (fail if auth storage / `NEXT_PUBLIC_*` missing): **`npm run e2e:contracts:required`**.

## Fresh clone → first green run (Phase 0)

From the **app root** (`Insurance-platform-foundation-main/`):

1. `npm install`
2. Create **`.env.local`** with at least:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (Recommended) `E2E_QUICK_SCAN_SKIP_CREDIT=1` for scan-related tests
3. `npm run dev` in one terminal (or let Playwright start it — see `playwright.config.ts`).
4. `npm run e2e:auth` — sign in when the browser opens; saves `.playwright/storageState.json`.
5. Run a suite, e.g.:
   - `npm run e2e:contracts` — RPC contract tests (Chromium only; needs env + storage state), including **`a1-rpc-auth-contract.spec.ts`** (bad `p_actor_id` vs JWT — requires A1 migrations on Supabase)
   - `npm run e2e:core:cross-browser` — core UI flows (multi-browser)

Also run **`npm run typecheck`** before pushing.

**CI:** **`.github/workflows/ci.yml`** (app root) runs **`npm run typecheck`**, **`npm run lint`**, **`npm run verify:csp-config`**, **`npm run verify:migration-chain`**, **`npm run verify:a1-inventory`**, and **`npm run build`** on push/PR (no Supabase secrets; build uses placeholder `NEXT_PUBLIC_*`). For Playwright, set `NEXT_PUBLIC_*` and storage state per **`docs/CI_E2E_SAMPLE.md`** (optional workflow input **Require Playwright storage state** — fail if secret missing). Optional corpus verify: **`docs/VERIFY_OPTIONAL.md`** (local script or **Verify optional (DB)** Actions workflow).

## Supabase env (`NEXT_PUBLIC_*`)

`playwright.config.ts` loads `.env.local` and `.env` from the **project root** (same keys as Next) so RPC contract tests see `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` when you run `npm run e2e` from that directory. CI should still set those vars in the job environment.

## Auth state

Most authenticated tests expect `.playwright/storageState.json`. Generate it first:

```bash
npm run e2e:auth
```

## Quick Scan determinism (`quick-scan-determinism.spec.ts`)

The `/api/quick-scan` route normally deducts `user_profiles.scan_credits_remaining`. For CI and local automation, the server can skip credit checks when:

```bash
E2E_QUICK_SCAN_SKIP_CREDIT=1
```

**Recommended (local):** add to `.env.local` (not committed):

```env
E2E_QUICK_SCAN_SKIP_CREDIT=1
```

Then run `npm run dev` and `npm run e2e:quick-scan-determinism`.

**CI:** `playwright.config.ts` starts `npm run dev` with `E2E_QUICK_SCAN_SKIP_CREDIT=1` unless `PLAYWRIGHT_NO_WEB_SERVER` is set.

This bypass is **disabled** when `NODE_ENV=production` or `VERCEL_ENV=production`.

## Skip running the bundled dev server

If you already have Next running on the base URL:

```bash
set PLAYWRIGHT_NO_WEB_SERVER=1
npm run e2e
```

(PowerShell: `$env:PLAYWRIGHT_NO_WEB_SERVER='1'`.)

Ensure your server still has `E2E_QUICK_SCAN_SKIP_CREDIT=1` in env if you need the determinism test to **pass** instead of skipping on 403.

## Section 5 staged smoke (`section5-staged-smoke.spec.ts`)

Runs against `/trips/{id}/section-5-staged/*` for **two** trips on the same account:

- **Solo** — name prefix `E2E Smoke Solo …` (created via UI if missing)
- **Group** — name prefix `E2E Smoke Group …` (group trip with “skip travelers”; created via UI if missing)

If a matching trip already exists from a prior run, the test reuses it. Completing the **Let’s get started** anchor (Add a trip itinerary → `/trips`) is handled before **Plan a trip** so trip creation is stable.
