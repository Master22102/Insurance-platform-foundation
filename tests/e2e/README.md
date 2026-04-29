# Playwright E2E

**C + D finish line (ship bar):** what “done” means for **`npm run e2e:contracts`** + core slice — **`docs/CD_CONTRACTS_AND_CORE_SLICE.md`**. Strict run (fail if auth storage / `NEXT_PUBLIC_*` missing): **`npm run e2e:contracts:required`**.

## Fresh clone → first green run (Phase 0)

From the **app root** (`Insurance-platform-foundation-main/`):

1. `npm install`
2. Create **`.env.local`** with at least:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (Recommended) `E2E_QUICK_SCAN_SKIP_CREDIT=1` for scan-related tests
   - (**Step 4 / S02–S41**) `SUPABASE_SERVICE_ROLE_KEY` — required for **`E2E_EXTRACTION_SYNC=1`** (Playwright’s bundled `npm run dev` sets this) so **`/api/extraction/upload-complete`** can finish extraction inline; without it, upload completes as **QUEUED** and **S02/S20/S32/S40** may **skip** or fail.
3. `npm run dev` in one terminal (or let Playwright start it — see `playwright.config.ts`).
4. **`npm run e2e:auth`** — with **`npm run dev`** already running, sign in when the browser opens; saves `.playwright/storageState.json`. Opens **`/`** by default (home). To start on another path: `set E2E_AUTH_START_PATH=/trips` (PowerShell: `$env:E2E_AUTH_START_PATH='/trips'`).
   - **Windows, no window from Cursor’s terminal:** double-click **`scripts/e2e/open-e2e-auth.cmd`** (runs in your desktop session) or run `npm run e2e:auth` from **PowerShell / Command Prompt** outside the IDE.
   - The script prefers **Microsoft Edge** on Windows, then Chrome, then Playwright’s Chromium. Install browsers: `npx playwright install chromium`. Force a channel: `set PLAYWRIGHT_CHANNEL=chrome` then `npm run e2e:auth`.
   - **WebKit / Firefox runs:** Session saved from **Edge** can fail to hydrate in **WebKit** (trip loads redirect to `/trips`). Prefer **`PLAYWRIGHT_CHANNEL=chromium`** (or **`chromium`** with no channel = bundled) when running **`npm run e2e:auth`** if you use **`npx playwright test`** across all projects.
5. Run a suite, e.g.:
   - **`npm run e2e:product-bible-journey`** — Persona-backed bible audit backbone (**`product-bible-journey.spec.ts`**, Chromium only): needs **`.env.local`**, fresh **`npm run e2e:auth`** (non-expired JWT). The **shell** test hits `/trips` and `/scan`; the **trip-backed** test needs a `trip_id` (REST, draft link on `/trips`, or **`E2E_BIBLE_TRIP_ID`**). **Lived flow truth:** **`docs/SYSTEM_TRUTH_HIERARCHY_AND_SECTION5_RECONCILIATION.md`**; manual checklist: **`docs/PRODUCT_BIBLE_JOURNEY_CHECKLIST.md`**. Archived narrative: **`docs/archive/PRODUCT_BIBLE_JOURNEY_NARRATIVE.md`**. Optional: **`E2E_BIBLE_CLAIM_JOURNEY=1`** appends **`fullJourney.e2e.ts`** (heavy DB).
   - **`npm run e2e:draft-readiness`** — Step 4D gate (**`draft-readiness-gate.spec.ts`**, Chromium only): needs **`.env.local`**, **`.playwright/storageState.json`**, migration **`20260331140000_step4d_draft_home_readiness_gate.sql`**, and **`SUPABASE_SERVICE_ROLE_KEY`** for upload/extraction (same as S32). If you see **4 skipped** with no obvious reason, run **`npx playwright show-report`** — the skip text now states whether **env**, **storage file path**, or **JWT expiry** is the problem.
   - `npm run e2e:contracts` — RPC contract tests (Chromium only; needs env + storage state), including **`a1-rpc-auth-contract.spec.ts`** (bad `p_actor_id` vs JWT — requires A1 migrations on Supabase), **`pipeline-coverage-golden-path.spec.ts`** (full **compute_coverage_graph → route_claim → packet** chain — requires migration **`20260326120000_e2e_seed_minimal_coverage_for_trip.sql`**), and **`pipeline-step4-coverage-upload.spec.ts`** (upload **TXT** fixtures, coverage tab UX, **`20260328120000_scan_connector_axis_results`** for axis row REST — apply that migration on the target DB)
   - **`npm run e2e:contracts:fresh`** — same tests as `e2e:contracts`, but frees port **3000** and sets **`PLAYWRIGHT_REUSE_EXISTING_SERVER=0`** so Playwright always spawns Next with merged **`webServer.env`** (`E2E_EXTRACTION_SYNC`, deep-scan autocomplete). The launcher sets **`cwd`** to the app root and merges **`.env.local`** into the child env (fixes **Windows** runs where **`npx` + `shell: true`** used the wrong cwd → **all tests skipped** because `hasSupabaseEnv` / `hasStorageState` could not see your files). Use when **`e2e:contracts` skips S40/S41 or the axis REST test** while S32 passed (often **reused dev server** without sync env, or **extraction timeout** under parallel workers — see `npx playwright show-report` for the exact skip string).
   - `npm run e2e:core:cross-browser` — core UI flows (multi-browser)

Also run **`npm run typecheck`** before pushing.

**CI:** **`.github/workflows/ci.yml`** (app root) runs **`npm run typecheck`**, **`npm run lint`**, **`npm run verify:csp-config`**, **`npm run verify:migration-chain`**, **`npm run verify:a1-inventory`**, and **`npm run build`** on push/PR (no Supabase secrets; build uses placeholder `NEXT_PUBLIC_*`). For Playwright, set `NEXT_PUBLIC_*` and storage state per **`docs/CI_E2E_SAMPLE.md`** (optional workflow input **Require Playwright storage state** — fail if secret missing). Optional corpus verify: **`docs/VERIFY_OPTIONAL.md`** (local script or **Verify optional (DB)** Actions workflow).

## F-6.5.2 — Coverage matrix / intelligence

Apply migration **`supabase/migrations/20260402120000_coverage_matrix_intelligence_f652.sql`** (adds `coverage_summaries`, `coverage_gaps`, `generate_coverage_intelligence`, clause amount columns). Without it, **`tests/e2e/coverage-matrix.spec.ts`** skips when `/api/coverage-graph/compute` fails.

The same file includes a **Coverage tab UI** test (unlocked `PRE_TRIP_STRUCTURED` trip → **Build coverage map** → **Benefit comparison**) that automates the post-migration manual smoke checklist. If tests skip, **`coverage-matrix.spec.ts` prints the reason on stderr** (`[coverage-matrix E2E] SKIPPED — …`) because Playwright’s list reporter often hides it.

### F-6.5.2 Phase 2 — Itinerary conflict detection

Apply **`supabase/migrations/20260415120000_itinerary_conflict_detection_f652_phase2.sql`** after Phase 1. Adds `activity_risk_categories`, `geographic_exclusion_patterns`, `detect_activity_conflicts` / `detect_geographic_conflicts`, feature flags **`F-6.5.2-itinerary`** (default **off** in `feature_activation_state`), optional `route_segments.destination_country_code`, and `activity_candidates` risk columns.

**E2E:** **`tests/e2e/itinerary-conflicts.spec.ts`** needs **`SUPABASE_SERVICE_ROLE_KEY`** (toggles feature + inserts test clauses / segments). Also apply **`20260415123000_e2e_insert_activity_candidate_rpc.sql`** so activities can be seeded via **`e2e_insert_activity_candidate`** (PostgREST insert on `activity_candidates` may return 400 under RLS). If you applied an **older** version of that migration that required **`lifecycle_flags @> '{"e2e": true}'`**, re-run the **current** `CREATE OR REPLACE` from the file so the trip owner guard matches normal E2E trips. For the geographic test, apply **`20260416120000_route_segments_table_and_rls.sql`** if **`route_segments`** is missing or REST returns 404/400. If inserts fail on **`account_id` NOT NULL**, apply **`20260418120000_f652_e2e_activity_draft_route_account_compat.sql`** (adds/backfills **`route_segments.account_id`**) and ensure the spec passes **`account_id`** from **`trips`**. For **`draft_version_id`** on **`activity_candidates`**, apply **`20260418120000`** (replaces **`e2e_insert_activity_candidate`**) and/or ensure **`ensure_trip_draft_version`** exists so a draft row exists before the activity insert. Skips print **`[itinerary-conflicts E2E] SKIPPED — …`** on **stderr** with HTTP/RPC detail (same idea as coverage-matrix).

## F-6.6.14 — Contextual intelligence (“Right now”)

Apply **`supabase/migrations/20260419120000_contextual_intelligence_f6614.sql`** (registers **`F-6.6.14`** in **`feature_registry`** + **`feature_activation_state`**, default **on**). Trip Overview shows the rule-based **Right now** card; preferences live under **`user_profiles.preferences.contextual_intelligence`** and **Account → Contextual intelligence**.

**E2E:** **`tests/e2e/contextual-intelligence.spec.ts`** — storage state + **`SUPABASE_SERVICE_ROLE_KEY`** (FOCL patch + profile prefs). Trips use **`PRE_TRIP_STRUCTURED`** so the main trip page Overview is reachable (**`DRAFT`** redirects to draft home). Setup uses **service-role REST** for trips/incidents so tests still run when the saved access token is **expired** (user id is read from the JWT `sub` without requiring a fresh `e2e:auth`, as long as the **browser session** in `storageState.json` can still load the app).

## Destructive erasure E2E (`erasure-contract.spec.ts`)

Set **`E2E_ERASURE_DISPOSABLE_USER_ID`** to a dedicated **`auth.users.id`** (UUID) that exists in your Supabase project but is **not** your primary Wayfarer account. Tests call **`process_erasure_request`** against that user and insert trips/incidents via the service role. **`SUPABASE_SERVICE_ROLE_KEY`** is required.

## Supabase env (`NEXT_PUBLIC_*`)

`playwright.config.ts` resolves the app root via **`E2E_PROJECT_ROOT`** (from `run-*-fresh-server.mjs`) or by walking up from `process.cwd()` until it finds **`playwright-repo-root.cjs`** (at the repo root), then loads `.env.local` / `.env`. That avoids wrong roots when **Windows** workers or **`npx`** use an unexpected cwd. Helpers use **`getStorageStatePath()`** (resolves at call time) for `.playwright/storageState.json`. CI should still set `NEXT_PUBLIC_*` in the job environment.

## Auth state

Most authenticated tests expect `.playwright/storageState.json`. Generate it first:

```bash
npm run e2e:auth
```

### Shared user + parallel workers

`onboarding-signal-profile.spec.ts` uses **`reopenOnboarding`** (sets `onboarding_completed: false`) on the **same** account as `storageState.json`. With many workers, that **races** specs that expect an onboarded user (e.g. full journey, `/account/security`). **`playwright.config.ts`** defaults to **`workers: 2`** unless **`E2E_WORKERS`** is set — use **`E2E_WORKERS=1`** for maximum stability when running the full E2E mix, or **`E2E_WORKERS=4`** when you are not running onboarding-reopen tests in the same run.

### JWT expiry (401 on every REST/RPC call)

Supabase **`access_token`** in `storageState.json` is **short-lived** (often ~1 hour). If **`npm run e2e:contracts`** fails with **`REST select failed: user_profiles 401`** (or RPC status **401**), the saved session is almost always **expired** or your **`.env.local` points at a different Supabase project** than the one you signed into during `e2e:auth`.

**Chunked SSR cookies:** With **`@supabase/ssr`**, the browser may store the session as several cookies named like `sb-…-auth-token.0`, `.1`, … (not a single cookie). The E2E helper **`readAccessTokenFromStorageStateFile`** reassembles those chunks before reading `access_token`. If Playwright still skips with “Missing or **expired** JWT”, either run **`npm run e2e:auth`** again or set **`E2E_IGNORE_JWT_EXPIRY=1`** only to debug (PostgREST may still return **401** if the token is actually expired).

**Fix:** Run `npm run e2e:auth` again (with `npm run dev` running) and keep **`NEXT_PUBLIC_SUPABASE_URL`** + **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** aligned with that project.

Contract helpers treat **expired** JWTs like **missing** auth (`readAccessTokenFromStorageState()` returns `null`) so tests **skip** with **`E2E_AUTH_SKIP_REASON`** instead of failing every assertion. **`npm run e2e:contracts:required`** fails in **global setup** if the file exists but the JWT is expired. Debug-only: **`E2E_IGNORE_JWT_EXPIRY=1`** bypasses the expiry check (PostgREST will still return 401 if the token is actually expired).

### Policy upload → extraction (`pipeline-step4-coverage-upload.spec.ts`)

**Playwright `webServer`** sets **`E2E_EXTRACTION_SYNC=1`**, **`NEXT_PUBLIC_E2E_DEEP_SCAN_AUTOCOMPLETE=1`**, and **`E2E_DEEP_SCAN_AUTOCOMPLETE=1`** (see `playwright.config.ts`). With **`SUPABASE_SERVICE_ROLE_KEY`** in **`.env.local`**, **`POST /api/extraction/upload-complete`** runs **`processUploadedDocument`** inline so **S02 / S20 / S32 / S40** can see **“Your policy has been processed.”** without a separate worker.

**Deep Scan (S32 / S40):** the panel calls **`POST /api/e2e/complete-deep-scan-job`** (server flag **`E2E_DEEP_SCAN_AUTOCOMPLETE`**) to mark the `job_queue` deep_scan row **completed** with a stub **`metadata.deep_scan_result`** when no background scan worker exists.

If **`SUPABASE_SERVICE_ROLE_KEY`** is missing (or extraction throws), the default is still **`test.skip`** after **`E2E_EXTRACTION_TIMEOUT_MS`** (**180s**) for tests that wait on processed UI — **`npm run e2e:contracts`** can stay **green** without a full ingest stack.

- **`E2E_REQUIRE_EXTRACTION_COMPLETE=1`** — **fail** on timeout instead of skip (use when CI runs a real extraction pipeline).
- **`E2E_EXTRACTION_TIMEOUT_MS`** — milliseconds to wait for “processed” before **skip** (default **180000**). Example: **`45000`** for faster local runs when you know extraction is not running (saves ~5+ minutes on **`e2e:contracts`**).

**Reuse your own dev server:** set **`PLAYWRIGHT_NO_WEB_SERVER=1`** and export the same flags as `playwright.config.ts` **`webServer.env`** (or add them to **`.env.local`**) so behavior matches CI.

**Never enable `E2E_*` / `NEXT_PUBLIC_E2E_*` autocomplete flags in production deployments.**

**S30:** Trips in **`DRAFT`** redirect to **`/trips/{id}/draft`**, so the spec uses **`PRE_TRIP_STRUCTURED` + locked** to assert the Coverage paywall on the main trip page (matches product: unlock gate is on structured trips, not Draft Home).

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

## Upload / extraction tests keep skipping (~3 min each)

**Cause:** Playwright’s **`reuseExistingServer`** (local default) reuses **your** `npm run dev` on port 3000. That process **never** receives Playwright’s `webServer.env` merge — **`E2E_EXTRACTION_SYNC=1`** in `playwright.config.ts` only applies when Playwright **starts** Next.

**Fix (pick one):**

1. **`SUPABASE_SERVICE_ROLE_KEY` + `E2E_EXTRACTION_SYNC=1` in `.env.local`**, then **restart** the dev server you reuse (same cwd as `package.json`).
2. **Or** one command from the repo root (kills listeners on **3000**, then runs Playwright with **`PLAYWRIGHT_REUSE_EXISTING_SERVER=0`**):

   ```bash
   npm run e2e:step4:fresh
   ```

   (Same as manually: `set PLAYWRIGHT_REUSE_EXISTING_SERVER=0` then `npx playwright test tests/e2e/pipeline-step4-coverage-upload.spec.ts --project=chromium-desktop` after freeing **3000**.)

3. Check the **Next terminal** for **`[upload-complete] E2E_EXTRACTION_SYNC inline extraction failed`** — if sync **throws**, the API falls back to **QUEUED** and the UI never reaches “processed”.

4. **Fixed in repo:** extraction used the policy **label** as the filename (no `.txt`), so `readDocument` treated the file as unsupported → `needs_review` while `/api/extraction/status` still reports **processing** until timeout. The worker now prefers **`basename(storage_path)`** (real uploaded name). Pull latest `scripts/extraction-worker.ts` if you still see endless “processing”.

## Skip running the bundled dev server

If you already have Next running on the base URL:

```bash
set PLAYWRIGHT_NO_WEB_SERVER=1
npm run e2e
```

(PowerShell: `$env:PLAYWRIGHT_NO_WEB_SERVER='1'`.)

Ensure your server still has `E2E_QUICK_SCAN_SKIP_CREDIT=1` in env if you need the determinism test to **pass** instead of skipping on 403.

## `e2e:contracts`: 11 passed, 1 skipped — quick scan idempotency

**What the skipped test is:** `pass9-idempotency-replay.spec.ts` → **“quick scan retry is idempotent for identical itinerary snapshot”**. It calls `initiate_quick_scan` twice with the **same** itinerary and asserts the second response is a **`cache_hit`** with the same **`job_id`** (Pass 9 idempotency contract).

**Why it sometimes skips (not a flake):** On **`FREE`** tier, `user_profiles.lifetime_quick_scans_used` is capped at **2** for lifetime quick scans (`lifetime_quick_scan_cap_reached`). If your **saved E2E user** has already used both, the **first** RPC in that test returns that error — there is nothing to retry, so the spec **skips** with a clear message instead of failing.

**Is “all green” better?** For **signal clarity** in CI, yes — you want **0 skipped** when possible. For **understanding the product**, the skip is **honest**: it documents that entitlement is enforced and that this contract only applies when the user can still start a quick scan.

**How to get 12/12 passed (dev only):**

- Point E2E at a **fresh Supabase user** (new `npm run e2e:auth` account with `lifetime_quick_scans_used < 2`), **or**
- In **SQL Editor** (dev/staging only), reset usage for your E2E user’s `user_id`:

  ```sql
  update user_profiles
  set lifetime_quick_scans_used = 0
  where user_id = '<paste user_id from user_profiles>';
  ```

  Then re-run `npm run e2e:contracts`.

Do **not** reset production users for tests.

---

## All contract tests show “skipped” (e.g. 12 skipped)

The **`e2e:contracts`** specs start each file with:

- `test.skip(!hasStorageState(), …)` — need **`.playwright/storageState.json`** (run **`npm run e2e:auth`** from the **app root**).
- `test.skip(!hasSupabaseEnv(), …)` — need **`NEXT_PUBLIC_SUPABASE_URL`** and **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** in **`.env.local`** (or the environment). Playwright loads `.env.local` from **`playwright.config.ts`** only when your **current working directory** is **`Insurance-platform-foundation-main`**.

If the JWT in storage is expired, you may also see skips or RPC **`401`** — run **`npm run e2e:auth`** again.

## `EADDRINUSE` on port 3000 / “Process from config.webServer exited early”

You already have **something** listening on **3000** (often another **`npm run dev`**). Playwright should **reuse** it when **`reuseExistingServer`** is on (non-CI), but on Windows a **`localhost`** probe can miss a server that is only hit reliably via **`127.0.0.1`**.

**Config default:** **`http://127.0.0.1:3000`** + **`npm run dev -- --hostname 127.0.0.1 -p 3000`** so reuse and spawned servers agree.

**If it still tries to spawn and crashes:** stop the extra dev server **or** run only one stack:

```powershell
$env:PLAYWRIGHT_NO_WEB_SERVER='1'
npm run e2e:contracts
```

(with **`npm run dev`** already running on **3000**).

## “`http://localhost:3000` is already used” (reuse disabled)

Playwright throws this when **something is listening on the dev port** but **`reuseExistingServer`** is **off**. That usually means:

- **`CI=true` / `CI=1`** (or **`GITHUB_ACTIONS`**) in your environment — intended for real CI so Playwright always spawns its own server. **Locally:** unset `CI` or use a clean shell.
- You set **`PLAYWRIGHT_REUSE_EXISTING_SERVER=0`** on purpose — then stop the other process on **3000** so Playwright can bind, **or** run with **`PLAYWRIGHT_NO_WEB_SERVER=1`** and keep a single **`npm run dev`**.

**Config note:** `playwright.config.ts` only treats **`CI`/`GITHUB_ACTIONS`** as CI when they look like boolean truth (`true` / `1` / `yes`), so a stray unrelated `CI` value should not block reuse.

## Wrong port (Next on 3001, tests on 3000)

If you see **`Port 3000 is in use, trying 3001`**, the Playwright-spawned server was **not** on the URL tests use. **`playwright.config.ts`** pins **3000** and **127.0.0.1**. Locally, either:

- **Stop** the other process on **3000**, or  
- Run your own dev on **3000** and set **`PLAYWRIGHT_NO_WEB_SERVER=1`** so Playwright does not spawn a second server.

Override URL if needed: **`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001`** (must match where Next listens). **`webServer.port`** is parsed from that URL (default **3000** if the URL has no port); **`npm run dev`** is started with **`-p`** set to the same value.

## “Nothing happens” when I run Playwright (fixed in config)

Playwright starts **`npm run dev`** in the background and waits until **TCP port 3000** accepts connections (derived from **`PLAYWRIGHT_BASE_URL`**, up to **180s**) — an **HTTP** probe can hang when **`HTTP_PROXY`** is set and loopback is not in **`NO_PROXY`** (common on Windows). Config merges **`127.0.0.1`**, **`localhost`**, **`::1`** into **`NO_PROXY`** and uses **port-only** readiness so the runner does not depend on HTTP for startup. Optional: curl **`/api/playwright-ready`** to sanity-check the app after dev is up.

**Now:** `playwright.config.ts` sets **`webServer.stdout` / `stderr` to `'pipe'`** and uses the **`list`** reporter so you see Next compile lines and test names.

**Optional:** `DEBUG=pw:webserver` (see [Playwright webServer](https://playwright.dev/docs/test-webserver)) for extra spawn diagnostics.

## Section 5 staged smoke (`section5-staged-smoke.spec.ts`)

Runs against `/trips/{id}/section-5-staged/*` for **two** trips on the same account:

- **Solo** — name prefix `E2E Smoke Solo …` (created via UI if missing)
- **Group** — name prefix `E2E Smoke Group …` (group trip with “skip travelers”; created via UI if missing)

If a matching trip already exists from a prior run, the test reuses it. Completing the **Let’s get started** anchor (Add a trip itinerary → `/trips`) is handled before **Plan a trip** so trip creation is stable.
