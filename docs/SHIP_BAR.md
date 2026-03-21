# Ship bar — acceptable to ship vs not (reference)

**Purpose:** Single place to answer “are we done?” without relying on chat memory. Update this file when gates change. Agents and humans should treat this as the **default** definition of **acceptable to ship** unless a release plan explicitly narrows scope (e.g. internal pilot only).

**Related:** `docs/GO_EXECUTION_PLAN.md`, `docs/GO_PROGRESS.md`, **`docs/CD_CONTRACTS_AND_CORE_SLICE.md`** (C + D finish line + pivot rules), `docs/RUNBOOK.md`, **`docs/BLOCK_AB_PRODUCTION_TRACKER.md`** (A + B1 production-era scoring), `lib/readiness/status.ts`, `lib/FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md`, `lib/CORE_FLOW_GOVERNANCE_IMPLEMENTATION_MATRIX.md`.

**Vs `GO_PROGRESS.md`:** “GO phase ~100%” means **checklist execution in the plan**, not that every **ship-bar** row is green. Ship bar stays **stricter** (e.g. migrations **applied** to prod, Playwright with secrets, founder sign-offs). See also **`docs/NEXT_PASS_BACKLOG.md`** for agent-sweep priorities.

---

## How to use

1. Pick a **release tier** (below). Narrower tiers need fewer rows green.
2. For each row, **SHIP** = all must pass; **DEFER** = document risk + owner + date.
3. When a slice is **done**, record it in `docs/GO_PROGRESS.md` and **do not reopen** unless a new failure, spec change, or threat model update appears.

---

## Release tiers (pick one)

| Tier | Who uses it | Typical bar |
|------|-------------|-------------|
| **Internal / dev** | Builders only | Typecheck + env documented; migrations applied to dev DB; known gaps listed. |
| **Private pilot** | Invited real users, low scale | Security minimum + core happy paths + monitoring basics; founder exceptions explicit. |
| **Broader production** | Real users at scale | Full ship bar below + operational readiness + legal/compliance sign-off where applicable. |

---

## A. Security & trust (always review)

| # | Gate | Must pass for private pilot+ |
|---|------|-------------------------------|
| A1 | **Tenant isolation** — No `authenticated` path can mutate another user’s core identity/account data via arbitrary `p_user_id` on privileged RPCs without an explicit, audited exception (e.g. service role only). | Yes |
| A2 | **Applied migrations** — Security migrations (e.g. pass8, pass11, pass12) are **applied** to the target Supabase project, not only present in repo. | Yes |
| A3 | **Secrets** — No service role keys or private keys in client bundles, git, or public logs. | Yes |
| A4 | **Failure UX** — User-facing errors do not leak stack traces, raw DB errors, or tokens (spot-check API routes). | Yes |
| A5 | **Browser baseline** — Security headers + session validation on protected routes where configured (`docs/SECURITY_BROWSER_HARDENING.md`). | Recommended (private pilot+) |

**Not acceptable to ship (private pilot+):** Known open **cross-tenant** RPC exposure without mitigation + timeline.

---

## B. Data & database

| # | Gate | Must pass for private pilot+ |
|---|------|-------------------------------|
| B1 | **Schema matches repo** — Migrations for the release are applied; drift is documented if any. | Yes |
| B2 | **Backups / recovery** — For production: provider backups on; restore path known (even if manual). | Broader production |

---

## C. Tests & CI truth

| # | Gate | Must pass for private pilot+ |
|---|------|-------------------------------|
| C1 | **`npm run typecheck`** — Green on release branch. | Yes |
| C1b | **`npm run build`** — Green on release branch (CI may use placeholder `NEXT_PUBLIC_*`; see `ci.yml`). | Yes |
| C2 | **Core E2E smoke** — At least one suite runs in CI **without** “everything skipped” due to missing env (e.g. `NEXT_PUBLIC_*` + storage state strategy documented). **Or** CI job explicitly named “contracts optional / skip expected”. | Yes |
| C3 | **Contract tests** — For RPC-heavy paths: `e2e:contracts` or equivalent passes when env + storage state are provided (local or CI). | Recommended |

**Not acceptable:** “Green” CI that only means “no tests ran.”

---

## D. Product completeness (scope-dependent)

For **private pilot**, define **one vertical slice** that is **done** and **tested** (e.g. sign-up → policy upload → extraction status → coverage view). Other slices can be **stubbed / staged** if documented.

| # | Gate | Notes |
|---|------|--------|
| D1 | **Core slice** — The slice you promise users is **E2E-proven** or has a written manual test with owner. | Required for pilot |
| D2 | **Doctrine “complete”** — Full matrix alignment across all sections. | **Not** required for first pilot; track in matrix |
| D3 | **FOCL founder ops** — Full inbox filters/actions + adversarial cadence. | **Not** required for traveler pilot; required for founder-ops launch |

---

## E. Founder / legal / compliance

| # | Gate | Must pass when |
|---|------|----------------|
| E1 | Items in `lib/FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md` relevant to this release are **resolved or explicitly deferred** with owner. | Private pilot+ |
| E2 | Claim packet / legal copy / external data posture **signed off** if those features are **on** in the release. | When those features ship |

---

## F. Operational (broader production)

| # | Gate | Notes |
|---|------|--------|
| F1 | Error monitoring (e.g. Sentry or equivalent) for API + client | |
| F2 | Rate limiting / abuse posture for public auth and upload endpoints | **Partial (session 19–20):** **`POST /api/marketing/subscribe`**, **`POST /api/quick-scan`**, **`POST /api/itinerary/normalize`** — in-process per-IP windows + env tuning (`docs/RUNBOOK.md`, `docs/SECURITY_BROWSER_HARDENING.md`). **CDN/WAF** still recommended; auth brute-force / signed uploads need explicit product decisions. |
| F3 | Runbook: who owns incidents, how to roll back migrations | **Starter:** **`docs/RUNBOOK.md`** — expand with owners + provider-specific rollback. |

---

## “Done with a slice” (anti-rework)

A slice (e.g. “membership RPC auth”) is **closed** when:

1. Code + migration merged,
2. Applied to target DB (or ticketed with owner),
3. `docs/GO_PROGRESS.md` updated,
4. Tests or **explicit** waiver recorded.

**Do not** keep editing the same slice without a **new** failing test, requirement, or security finding.

---

## Where we stand — snapshot (update when releasing)

*Last updated: 2026-03-20 — C + D playbook added (`docs/CD_CONTRACTS_AND_CORE_SLICE.md`).*

| Area | Rough status | Notes |
|------|----------------|--------|
| **Security floor** | **Improved, not finished** | **2026-03-20:** **gap migrations + ledger** through pass14 on target (`docs/REPO_VS_DATABASE.md`). CSP **Report-Only**; **`CSP_MODE=enforce`** opt-in. **F2 partial:** rate limits on key POST routes. Founder-only `feature_gate` = **policy** (`docs/DEFERRED.md`). |
| **Readiness pillars** (`lib/readiness/status.ts`) | **0/4 `complete`** | 3 hardening, 1 partial — honest “not doctrine-complete” |
| **CI / E2E truth** | **Improved** | **`ci.yml`**: typecheck + lint + CSP verify + build. **Contracts:** `e2e-contracts-optional.yml`; **`E2E_REQUIRE_CONTRACTS=1`** when workflow input **Require Playwright storage state** is true (fail fast — **`docs/CD_CONTRACTS_AND_CORE_SLICE.md`**). Local: **`npm run e2e:contracts:required`** — **9/9** reported on target (2026-03-21). Also **`verify-optional-db.yml`**, **`docs/CI_E2E_SAMPLE.md`**, **`docs/VERIFY_OPTIONAL.md`**. |
| **Core slice (D1)** | **E2E-proven (target)** | **`e2e:contracts`** chain green **9/9** on project Supabase — **`docs/CD_CONTRACTS_AND_CORE_SLICE.md`**, **`GO_PROGRESS.md`**. |
| **FOCL** | **Partial** | Inbox actions + **feature/incident/assigned-to-me filters**; full matrix + notifications deferred per `DEFERRED.md`. |
| **Ship-ready for broad production** | **No** — per matrix + pillars | Reasonable for **scoped** internal pilot **if** you define slice + accept risk register. |

**Why it can feel “far along” but not “shippable”:** A lot of work went into **foundation** (migrations, tests, doctrine alignment, copy, gating). **Ship** also requires **narrow scope**, **applied DB**, **CI truth**, and **explicit** founder/legal closure — that’s a different finish line than “lots of code written.”

---

## Revision history

| Date | Change |
|------|--------|
| 2026-03-18 | Initial draft |
| 2026-03-18 | Snapshot refresh: pass13 inbox auth + FOCL inbox actions (keep this file in sync with migrations applied + releases). |
| 2026-03-18 | CI workflow (`ci.yml` typecheck); rollout RPC doc (`SECURITY_FEATURE_GOVERNANCE_RPCS.md`); `DEFERRED.md`. |
| 2026-03-18 | Clarified GO_PROGRESS vs ship bar; added `NEXT_PASS_BACKLOG.md` (12-agent sweep). |
| 2026-03-18 | Session 4: FOCL inbox filters; E2E hygiene; CI informational lint; backlog/DEFERRED updates. |
| 2026-03-18 | Session 5: pass14 claim-packet guard; route page RPC order; contract + policy E2E depth; ESLint errors cleared; CI lint required. |
| 2026-03-18 | Session 6: exhaustive-deps + img lint; `npm run lint` fully clean. |
| 2026-03-18 | Session 7: security headers; Supabase middleware `getUser()`; blog XSS; claim-route gate E2E; strict policy REST env. |
| 2026-03-18 | Session 8: CSP Report-Only; policy `content_hash` / stable version REST asserts. |
| 2026-03-18 | Session 9: claim route browser happy path + `routingReadyIncident` util. |
| 2026-03-20 | **`CD_CONTRACTS_AND_CORE_SLICE.md`**: C + D finish line; **`E2E_REQUIRE_CONTRACTS`** + **`npm run e2e:contracts:required`**; workflow wires strict gate when **Require Playwright storage state** is true. |
| 2026-03-21 | Snapshot: **`e2e:contracts:required`** **9/9** on target; **`GO_PROGRESS`** / **`BLOCK_AB`** pass **AB-3**; follow-up migrations **`20260324120000`**, **`20260324130000`** documented. |
| 2026-03-18 | Session 10: claim route form submit E2E (success + packet line). |
| 2026-03-18 | Session 11: post-submit REST — incident SUBMITTED + claim_packets. |
| 2026-03-18 | Session 12: `MIGRATIONS_APPLY_ORDER.md`; optional `e2e-contracts-optional` workflow. |
| 2026-03-18 | Session 13: `e2e:policy-governance`; workflow inputs (governance + strict REST). |
| 2026-03-18 | Session 14: `ci.yml` adds **`npm run build`** with placeholder `NEXT_PUBLIC_*`; ship bar **C1b**. |
| 2026-03-18 | Session 15: **`CSP_MODE=enforce`** in `next.config.js` for blocking CSP (opt-in); hardening doc table. |
| 2026-03-18 | Session 16: **`verify:csp-config`** in CI; optional **`verify:ingest-corpus-idempotency`**; **`VERIFY_OPTIONAL.md`**; GO_PROGRESS executive snapshot. |
| 2026-03-18 | Session 17: **`verify-optional-db.yml`** (`workflow_dispatch` corpus verify; fail-fast secrets). |
| 2026-03-18 | Session 18: **`GET /api/health`**; E2E **`require_playwright_storage_state`** input. |
| 2026-03-18 | Session 19: marketing subscribe rate limit + **`RUNBOOK.md`**; ship bar **F2/F3** notes. |
| 2026-03-18 | Session 20: rate limits **`/api/quick-scan`**, **`/api/itinerary/normalize`**; **`rateLimitedJsonResponse`**. |
