# Next pass backlog — 12-agent sweep (consolidated)

Generated from a parallel **read-only** sweep: Slice 1/2 E2E, lint debt, hardening, FOCL, claims, pass8, Section 5 matrix, API leaks, doc drift. Use this to prioritize the **next implementation pass**.

**Session 4 (2026-03-18):** FOCL inbox filters (#7); `ensureOnboarded` (#8); doctrine quick-scan (#9); policy REST partial (#3); CI lint informational (#10).

**Session 5 (2026-03-18):** **Pass14** — `create_claim_packet_from_incident` requires `CLAIM_ROUTING_READY` (`routing_not_ready`); route page creates packet **before** `SUBMITTED`; negative contract E2E; policy-governance REST chain (`policies.active_version_id`, `policy_documents`, `event_ledger`); ESLint **errors** cleared; CI **lint** required.

**Session 6 (2026-03-18):** **`npm run lint` fully clean** (no warnings): hook deps, NarrateSheet ref cleanup, documented `<img>` overrides.

**Session 7 (2026-03-18):** Security headers + **Supabase `getUser()` middleware**; debug route hardened; **blog XSS** escape; **`E2E_STRICT_POLICY_GOVERNANCE_REST`**; **`claim-route-gate`** Playwright + **`npm run e2e:claim-route-gate`**; **`docs/SECURITY_BROWSER_HARDENING.md`**.

**Session 8 (2026-03-18):** **CSP Report-Only** (`next.config.js`); policy governance **`content_hash`** + **idempotent REST read** of active version.

**Session 9 (2026-03-18):** **Claim route browser happy path** (`claim-route-happy-path.spec.ts`); **`routingReadyIncident`** util; **`e2e:claim-route`** / **`e2e:contracts`** updated.

**Session 10 (2026-03-18):** Claim route **form submit** E2E (success UI + packet line; requires DB pass14 behavior).

**Session 11 (2026-03-18):** Post-submit **REST** checks: **`incidents`** → `SUBMITTED`, **`claim_packets`** row exists.

**Session 12 (2026-03-18):** **`MIGRATIONS_APPLY_ORDER.md`**; optional **GitHub Actions** workflow for **`e2e:contracts`**.

**Session 13 (2026-03-18):** **`e2e:policy-governance`** script; optional workflow inputs for governance + **strict REST**.

**Session 14 (2026-03-18):** **`ci.yml`** — required **`npm run build`** with placeholder **`NEXT_PUBLIC_*`**.

**Session 15 (2026-03-18):** **`CSP_MODE=enforce`** — opt-in blocking **`Content-Security-Policy`** (same directives as Report-Only); **`SECURITY_BROWSER_HARDENING.md`**.

**Session 16 (2026-03-18):** **`npm run verify:csp-config`** in **`ci.yml`** (fast CSP branch check). **`npm run verify:ingest-corpus-idempotency`** — optional service-role **`ingest_corpus_rules`** replay (**`docs/VERIFY_OPTIONAL.md`**). **`GO_PROGRESS`** executive snapshot table.

**Session 17 (2026-03-18):** **`verify-optional-db.yml`** — manual Actions run for corpus idempotency; **fails** if required secrets unset.

**Session 18 (2026-03-18):** **`GET /api/health`** liveness probe. **`e2e-contracts-optional.yml`** — **`require_playwright_storage_state`** input (fail if no storage secret).

**Session 19 (2026-03-18):** **`POST /api/marketing/subscribe`** in-process rate limit; **`docs/RUNBOOK.md`**; **`SHIP_BAR`** F2/F3 columns.

**Session 20 (2026-03-18):** Per-IP limits for **`POST /api/quick-scan`** and **`POST /api/itinerary/normalize`**; **`rateLimitedJsonResponse`**.

**Pass AB-0 (2026-03-18):** **`docs/BLOCK_AB_PRODUCTION_TRACKER.md`** — Block **A + B1** production-era program; **`verify:migration-chain`** in CI.

**Human/ops:** apply migrations through **`20260323151000_pass14_*.sql`** after pass12/13 (see apply-order doc).

---

## P0 — Security / DB truth

| # | Finding | Action |
|---|---------|--------|
| 1 | Pass12–14 migrations exist in repo | **Apply** `20260323150000_pass12_*.sql` → `20260323150001_pass13_*.sql` → **`20260323151000_pass14_*.sql`** (order matters). See **`docs/MIGRATIONS_APPLY_ORDER.md`**. |
| 2 | Ship bar still says “apply to DB” until remote matches repo | Track in release checklist; don’t mark A2 green in `SHIP_BAR` until verified. |

---

## P1 — Slice 1 (policy + governance E2E)

| # | Finding | Action |
|---|---------|--------|
| 3 | `policy-governance-e2e.spec.ts` covers upload → status → confidence; **missing** `policy_versions` / acceptance tier / ledger **events** / ingestion **hash replay** | **Partial:** REST chain includes **`content_hash`** + second identical `policy_versions` read; `policy_version_created`, docs, `active_version_id`. **Optional:** **`npm run verify:ingest-corpus-idempotency`** (service_role + `VERIFY_CORPUS_ACTOR_UUID`) — **`docs/VERIFY_OPTIONAL.md`**. **Remainder:** acceptance tier UI, broader corpus matrix §E/F. |
| 4 | Environment-gated tests | **Partial:** E2E workflow input **`require_playwright_storage_state`** — fail if auth storage secret missing (**session 18**). Policy governance still needs extraction + secrets aligned. |

---

## P1 — Slice 2 (incident / evidence / routing)

| # | Finding | Action |
|---|---------|--------|
| 5 | Only `claim-packet-contract.spec.ts` does incident→evidence→routing-ready→packet; **RPC-only**, not UI | **Done:** RPC + **`claim-route-gate`** + **`claim-route-happy-path`** (load + **submit** → success + packet line when pass14 applied). |
| 6 | **No CCO** string in e2e; matrix “atomic incident” not mirrored in tests | **Deferred** — recorded in `DEFERRED.md` (CCO / atomic incident E2E). |

---

## P2 — FOCL inbox UX

| # | Finding | Action |
|---|---------|--------|
| 7 | `list_action_inbox_items` — **`p_feature_id`, `p_incident_id`, `p_assigned_to` always null** | **Done:** feature text + incident UUID validation + “Assigned to me” → `p_assigned_to = user.id`. |

---

## P2 — Test hygiene

| # | Finding | Action |
|---|---------|--------|
| 8 | `ensureOnboarded.ts` still has **4× `waitForTimeout`** (~123–146) | **Done:** replaced with `waitForURL` / `waitForLoadState('domcontentloaded')`. |
| 9 | `doctrine-contracts.spec.ts` quick-scan: single skip on `!ok` | **Done:** branch skip reasons **401 / 403 / 500** + generic non-2xx. |

---

## P3 — Lint / CI

| # | Finding | Action |
|---|---------|--------|
| 10 | `npm run lint` fails (many `react/no-unescaped-entities`, etc.) | **Clean** — `npm run lint` reports **no warnings or errors** (session 6). Optional later: replace `<img>` override sites with `next/image`. |

---

## P3 — Product / matrix follow-ups

| # | Finding | Action |
|---|---------|--------|
| 11 | Pass8 has **no TODO** in file; payment/refund idempotency still **partial** per governance matrix `10.3` | Track as epic; not a quick fix. |
| 12 | Section 5 matrix said “manual smoke” — **now outdated** (`section5-staged-smoke.spec.ts` exists) | **Updated** in `lib/SECTION_5_PARITY_AUDIT_MATRIX.md`. |
| 13 | `app/api` grep: **no** `String(err)` / `JSON.stringify(err)` in responses | Good; keep policy on new routes. |

---

## Doc hygiene (done this pass)

- **`SHIP_BAR.md`**: Clarified relationship to **`GO_PROGRESS.md`** (phase % ≠ ship bar).
- **`SECTION_5_PARITY_AUDIT_MATRIX.md`**: Staged routes row points at real smoke spec.

---

## Suggested order for the *next* coding pass

1. Apply pass12–14 on Supabase (human/ops) — **required** before claim packet contract passes against a live DB.  
2. Slice 1: acceptance tier / hash-replay / stronger asserts when `try/catch` is narrowed.  
3. Slice 2: ~~post-submit REST~~ **done** (session 11); CCO E2E or defer.  
4. CCO / atomic incident E2E — or keep deferred in `DEFERRED.md`.  
5. ~~ESLint warnings~~ **done** (session 6); optional `next/image` follow-ups.

Update **`docs/GO_PROGRESS.md`** and **`docs/SHIP_BAR.md`** when any item above ships.
