# GO run log — last update: 2026-03-21 (AB-3 — `e2e:contracts` 9/9)

## Program: Block A + B1 → ~90% (production target)

**Tracker era ~75 / 90** — **`docs/BLOCK_AB_PRODUCTION_TRACKER.md`**. **A2+B1** green; **`schema_migrations`** tip **`20260323151000`**+ (ledger + follow-up SQL per user). **C + D closed on target:** **`npm run e2e:contracts:required`** → **9 passed** (2026-03-21) — **`docs/CD_CONTRACTS_AND_CORE_SLICE.md`**. **Next focus:** **A1** RPC / tenant isolation audit, **F** ops, **E** founder/legal — **not** more contract churn unless regressions.

**Migrations:** Agents cannot apply SQL to your Supabase; you or **your** CI (with secrets) runs `supabase db push` / dashboard apply—see tracker checklist.

## Executive snapshot (stakeholders)

| | |
|--|--|
| **Product / doctrine** | **0/4** readiness pillars `complete` (~**44%** weighted maturity). Strong **foundation** in repo; **not** “doctrine-complete.” |
| **Ship bar** | **Improved**; migrations + ledger through **pass14** + follow-up fixes on target. **C + D:** **`e2e:contracts:required`** **9/9** on **this** project (2026-03-21) — **`docs/CD_CONTRACTS_AND_CORE_SLICE.md`**. Broad production: **still** other gates (`docs/SHIP_BAR.md`). |
| **CI** | Every PR: **typecheck**, **lint**, **CSP branch check**, **`next build`**. Manual: **E2E contracts** (**`E2E_REQUIRE_CONTRACTS=1`** when workflow requires storage — no silent skip), **Verify optional (DB)** — **`docs/CI_E2E_SAMPLE.md`**, **`docs/CD_CONTRACTS_AND_CORE_SLICE.md`**. |
| **Security** | Headers + middleware; CSP default **Report-Only**; **`CSP_MODE=enforce`** opt-in. **F2 partial:** marketing subscribe + **quick-scan** + **itinerary normalize** per-IP limits (best effort). **`docs/SECURITY_BROWSER_HARDENING.md`**, **`docs/RUNBOOK.md`**. |

## Scores (see `docs/GO_EXECUTION_PLAN.md` table for definitions)

| Metric | Value |
|--------|--------|
| Readiness complete (4 pillars) | **0%** |
| Readiness weighted maturity | **~44%** |
| GO Phase 0 | **~100%** *(CI typecheck + lint + `verify:csp-config` + production build; Playwright optional per sample)* |
| GO Phase 1 | **~100%** *(reviewed + documented; founder-only role = deferred policy)* |
| GO Phase 2 | **~100%** *(DEFERRED.md for remaining matrix scope)* |

## This run

- **Pass AB-0 (Block A+B1 program)** — **`docs/BLOCK_AB_PRODUCTION_TRACKER.md`**: production-era rubric (0→90), weighted scorecard, pass log, honest **migration apply** boundary. **`npm run verify:migration-chain`** (pass12–14 files on disk) + **`ci.yml`** step. **`GO_PROGRESS`** program section (this file). **Era ~51 / 90** until **A2+B1** verified on target DB.
- **Session 20** — **`POST /api/quick-scan`** and **`POST /api/itinerary/normalize`**: per-IP **in-memory** rate limits **before** Supabase/file work (defaults **40** req / **15m**). Env: **`QUICK_SCAN_POST_RATE_LIMIT_*`**, **`ITINERARY_NORMALIZE_POST_RATE_LIMIT_*`**. **`rateLimitedJsonResponse`** helper; marketing subscribe refactored to use it. **`RUNBOOK`** / **`SECURITY_BROWSER_HARDENING`** / **`SHIP_BAR`** F2 updated.
- **Session 19** — **`POST /api/marketing/subscribe`**: best-effort **in-memory** per-IP window limit (**429** + **`Retry-After`**); env **`MARKETING_SUBSCRIBE_RATE_LIMIT_MAX`** (default 20), **`MARKETING_SUBSCRIBE_RATE_LIMIT_WINDOW_MS`** (default 15m). **`lib/rate-limit/simple-memory.ts`**. Stricter **email** validation (max length). **`docs/RUNBOOK.md`** — ops starter (deploy, rollback pointers, abuse table). **`SHIP_BAR`** **F2/F3** notes updated.
- **Session 18** — **`GET /api/health`** — public liveness JSON (`ok`, `service`, optional **7-char** `commit` from `VERCEL_GIT_COMMIT_SHA` / `GITHUB_SHA` / `HEALTH_GIT_SHA`). **`e2e-contracts-optional.yml`**: input **`require_playwright_storage_state`** — fails workflow if **`PLAYWRIGHT_STORAGE_STATE_B64`** missing (addresses silent auth skips / ship bar **C2** intent).
- **Session 17** — **`.github/workflows/verify-optional-db.yml`**: manual **`workflow_dispatch`** for **`npm run verify:ingest-corpus-idempotency`** with **fail-fast** if **`NEXT_PUBLIC_SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`**, or **`VERIFY_CORPUS_ACTOR_UUID`** secrets missing. Documented in **`docs/VERIFY_OPTIONAL.md`**.
- **Session 16** — **`npm run verify:csp-config`** (`scripts/verify-csp-next-config.cjs`) asserts **`next.config.js`** emits **Report-Only** vs **`Content-Security-Policy`** when **`CSP_MODE=enforce`** — runs in **`ci.yml`** (no second full build). **`npm run verify:ingest-corpus-idempotency`** — optional **service_role** check for **`ingest_corpus_rules`** document replay (**`docs/VERIFY_OPTIONAL.md`**); skips if env unset locally. **Executive snapshot** (table above).
- **Session 15** — **`next.config.js`**: **`CSP_MODE=enforce`** (build-time) sends blocking **`Content-Security-Policy`** with the same directive string as default **Report-Only**; default unchanged. Documented in **`docs/SECURITY_BROWSER_HARDENING.md`**. Use only after triaging violations in real traffic.
- **Session 14** — **`.github/workflows/ci.yml`**: **`npm run build`** after lint, with **placeholder** `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (no secrets). Catches broken imports / static generation / type errors surfaced only at compile time.
- **Session 13** — **`npm run e2e:policy-governance`**. **`e2e-contracts-optional.yml`**: inputs **`run_policy_governance`** + **`strict_policy_governance_rest`** (sets **`E2E_STRICT_POLICY_GOVERNANCE_REST`**). **`CI_E2E_SAMPLE.md`** table for dialog options.
- **Session 12 (recap)** — **`MIGRATIONS_APPLY_ORDER.md`**; optional E2E contracts workflow.
- **Session 11 (recap)** — Claim-route submit + PostgREST **`SUBMITTED`** + **`claim_packets`**.
- **Session 10 (recap)** — Claim-route form submit + success UI + packet copy.
- **Session 9 (recap)** — Claim route **load** smoke + **`routingReadyIncident`**; **`e2e:claim-route`** / **`e2e:contracts`** include these specs.
- **Session 8 (recap)** — CSP Report-Only; policy `content_hash` REST asserts.
- **Session 7 (recap)** — Security headers; `getUser()` middleware; debug route; blog escape; claim-route gate E2E; strict REST env flag.
- **Session 6 (recap)** — ESLint fully clean (hooks + img overrides).
- **`.github/workflows/ci.yml`** — `npm ci` + **`npm run typecheck`** + **`npm run lint`** + **`npm run verify:csp-config`** + **`npm run build`** (required).
- **Session 5 (recap)** — Pass14 + claim route RPC order + contract/policy E2E depth.
- **Verify:** `npm run typecheck` + `npm run lint` + `npm run verify:csp-config` + `npm run verify:migration-chain` + `npm run build` (with placeholder `NEXT_PUBLIC_*`) green.

## Apply to database

- **2026-03-20 (applied):** Section41 + **`gap-through-pass14-ONE-BATCH.sql`** (post-FK fix).  
- **Follow-up (E2E + PostgREST):** **`20260324120000_fix_pgrst203_and_job_queue_job_name.sql`**, **`20260324130000_fix_change_incident_status_text_canonical.sql`** — apply on target if not already; see **`docs/MIGRATIONS_APPLY_ORDER.md`**.  
- **Ledger:** **`schema_migrations`** max may be **`20260324130000`** after above; **pass14** + contracts verified with **`e2e:contracts:required`** **9/9** (2026-03-21) — **`docs/REPO_VS_DATABASE.md`**.

## Next (Phase 3+)

- **A1:** Tenant isolation / **`SECURITY_DEFINER`** RPC review — inventory + baseline (`npm run generate:a1-inventory` / `verify:a1-inventory`), **`docs/A1_EXCEPTIONS.md`**, **`docs/A1_RLS_AND_RPC.md`**, migrations **`20260325100000`** / **`20260325101000`**, E2E **`a1-rpc-auth-contract.spec.ts`** — still see **`DEFERRED.md`**, **`docs/SHIP_BAR.md` §A** for full matrix.  
- **CI:** GitHub **E2E contracts (optional)** with **Require Playwright storage state** = true when you want a hard gate (secrets + `PLAYWRIGHT_STORAGE_STATE_B64`).  
- **F / E:** Monitoring + runbook owners (**`RUNBOOK.md`**); founder/legal items **`FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md`**.  
- Later: strict **policy-governance** E2E when extraction + RLS are stable; CCO / atomic incident per **`DEFERRED.md`**; **`CSP_MODE=enforce`** after Report-Only triage.
