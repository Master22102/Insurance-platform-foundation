# GO execution plan (balanced hardening + product)

**How to use:** Paste the block under [Agent prompt (copy-paste)](#agent-prompt-copy-paste) into Cursor, or say: **“Execute `docs/GO_EXECUTION_PLAN.md` in order.”**  
The agent should work **top to bottom**, **only pause** for [Stop conditions](#stop-conditions—do-not-guess), and keep **hardening parallel** (security + tests on every slice).

**Did earlier long passes / lists matter?** Yes: they moved **real needles** (E2E stability, policy upload CTAs, Playwright env loading, coverage UX, migrations, doctrine tests). They did **not** automatically finish **(a)** minimum tenant-security on every privileged RPC, **(b)** full founder-ops surfaces, **(c)** end-to-end “doctrine-complete” journeys—those remain below.

---

## Agent prompt (copy-paste)

```
You are executing the repository plan in Insurance-platform-foundation-main/docs/GO_EXECUTION_PLAN.md.

Rules:
- Follow phases IN ORDER. Within a phase, complete checklist items before moving on unless a stop condition applies.
- Balance: every product change gets proportional hardening (tests, auth, or explicit documented risk).
- After each logical chunk: run npm run typecheck; run relevant npm run e2e:* or lint as listed; fix failures before continuing.
- Do NOT ask the user for routine confirmation. ONLY stop for: missing secrets/credentials, destructive prod data actions, or items listed in lib/FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md requiring a business/legal decision.
- End with a short handoff: what was done, what was verified, what’s next.
```

---

## Phase 0 — Minimum environment & CI truth (unblock everything)

Goal: **Tests that should run actually run**; no “all skipped” as the default story.

- [x] **Document one path** in `tests/e2e/README.md` (or link): fresh clone → `npm i` → `.env.local` with `NEXT_PUBLIC_SUPABASE_*` → `npm run e2e:auth` → run `e2e:contracts` / `e2e:core:cross-browser`.
- [x] **CI recipe** (comment in README or sample workflow snippet): set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; create or inject `.playwright/storageState.json` for contract tests **or** document why contracts are optional in CI with a clear job name. → See **`docs/CI_E2E_SAMPLE.md`** + README “CI” line.
- [x] **Smoke:** `npm run typecheck` green; at least one full `e2e:contracts` or `e2e:core:cross-browser` run documented locally or in CI. → **`.github/workflows/ci.yml`** runs `typecheck` + `lint` + **`verify:csp-config`** + **`next build`** on push/PR (no secrets; build uses placeholder `NEXT_PUBLIC_*`). Full Playwright remains optional per `docs/CI_E2E_SAMPLE.md`.

**Verify:** `npm run typecheck` + `npm run verify:csp-config` + `npm run build` (placeholder public env); targeted e2e per README.

---

## Phase 1 — Minimum security bar (tenant trust)

Goal: **No `authenticated` caller can act as arbitrary `p_user_id`** on high-impact `SECURITY DEFINER` RPCs. Prefer **`auth.uid()` binding** or **revoke from `authenticated`** + server-only path.

Priority order (adjust names to match current migrations):

- [x] **Membership / credits / session:** `update_membership_tier`, `consume_scan_credit`, `create_session_token`, `record_mfa_enrollment`, `complete_step_up_verification`, `request_step_up_verification` — enforce caller == subject or equivalent. → **`consume_scan_credit`** already `REVOKE` authenticated (pass8). **Pass12 migration** `20260323150000_pass12_membership_self_rpc_auth_binding.sql` binds `auth.uid()` for the remaining self-service RPCs.
- [x] **Rollout / feature admin (if granted to `authenticated`):** `set_feature_activation_state`, `set_feature_rollout_percentage`, `set_feature_rollout_rules` — restrict to service role or founder role per product rules. → **Reviewed:** `20260320193000_pass4_focl_lifecycle_guardrails.sql` binds **`auth.uid()`** + blocks `p_actor_id` spoofing + **`precheck_mutation_guard`**. Founder-only tightening is **policy** (see `docs/SECURITY_FEATURE_GOVERNANCE_RPCS.md`, `docs/DEFERRED.md`).
- [x] **Action inbox mutators:** `snooze_action_inbox_item`, `assign_action_inbox_item`, (+ related) — scope by tenant/region and caller. → **Pass13** `20260323150001_pass13_action_inbox_actor_auth_binding.sql` binds `auth.uid()` for snooze/assign/note/status/link; governance guard unchanged.
- [x] **New migration(s)** with idempotent `CREATE OR REPLACE` + `GRANT` review; **no silent widening** of anon access. → Pass12/13 follow existing **REVOKE anon** pattern; no new `GRANT` to anon added.

**Verify:** `npm run typecheck`; if possible add/extend a small SQL or API test proving cross-user call fails; run existing e2e that touch auth paths.

---

## Phase 2 — Founder ops (FOCL) — after Phase 1 floor

Goal: **Operational surfaces match backend capabilities.**

- [x] **`app/focl/inbox/page.tsx`:** filters (`p_status`, …), pagination, and actions wired to existing RPCs (`snooze`, `assign`, `set_action_inbox_status`; optional projector refresh). **Status filter + load more + Snooze 24h / Assign to me / Resolve / Dismiss.**
- [x] **Error/empty states** and loading; no raw internal errors to browser.
- [x] **Readiness / notifications** as needed per `lib/readiness/status.ts` and founder ledger scope (defer items that need founder sign-off to a `DEFERRED.md` note with ledger pointer). → **`docs/DEFERRED.md`** + link to `lib/FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md`.

**Verify:** manual smoke of inbox; `npm run typecheck`; add or extend e2e if a stable flow exists.

---

## Phase 3 — Product slices (core flows), hardening in parallel

Follow **`lib/CORE_FLOW_GOVERNANCE_IMPLEMENTATION_MATRIX.md`** “Next Three Build Slices” in order:

### Slice 1 — Policy + governance deterministic path
- [ ] Ingestion invariants: upload → hash/queue → extraction status → policy version/events where applicable.
- [ ] E2E: **upload sample → extraction completes → assert version/event signals** (environment allowing).
- [ ] Copy/Calm Mode only **after** API contracts stable (see Section 7 docs).

### Slice 2 — Incident / CCO atomic path
- [ ] Atomic incident + evidence/routing hooks per matrix.
- [ ] E2E chain: create incident → attach evidence → verify gates (as implemented).

### Slice 3 — Claim / statutory (when Slice 1–2 stable)
- [ ] Claim packet lifecycle + statutory branches per matrix (incremental).

**Verify:** `npm run typecheck`; slice-specific e2e; fix flake using `expect.poll` / remove `force: true` where possible (`tests/e2e/utils/ensureOnboarded.ts`, heavy specs).

---

## Phase 4 — Continuous hardening (parallel thread, never “done”)

Run alongside Phases 2–3 whenever touching related code:

- [ ] **E2E stability:** reduce `waitForTimeout`, empty `.catch`, unnecessary `force: true` in hot specs (see prior audit: `ensureOnboarded.ts`, `draft-home-persistence.spec.ts`).
- [ ] **Doctrine contract tests:** keep quick-scan skips **explicit** (credit vs auth vs 500); prefer seeded credits or `E2E_QUICK_SCAN_SKIP_CREDIT` in dev docs.
- [ ] **Readiness dashboard** (`lib/readiness/status.ts`): update statuses/notes when a gate truly flips.

---

## Stop conditions — do not guess

Pause and surface to the user only for:

- Missing **secrets** (Supabase keys, CI tokens) or **cannot run migrations** on the target project.
- **Founder/legal** items in `lib/FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md`.
- **Destructive** actions on production data.
- **Ambiguous product** choice that changes schema or compliance posture.

---

## Reference map (do not duplicate full spec here)

| Topic | Where |
|--------|--------|
| **Ship vs not (release bar)** | **`docs/SHIP_BAR.md`** |
| Feature governance RPC security note | `docs/SECURITY_FEATURE_GOVERNANCE_RPCS.md` |
| Deferred founder/legal | `docs/DEFERRED.md` |
| Next prioritized backlog (agent sweeps) | `docs/NEXT_PASS_BACKLOG.md` |
| Governance / gaps | `lib/CORE_FLOW_GOVERNANCE_IMPLEMENTATION_MATRIX.md` |
| Section 5 steps / staged | `lib/SECTION_5_PARITY_AUDIT_MATRIX.md` |
| Founder decisions | `lib/FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md` |
| Readiness pillars | `lib/readiness/status.ts` |
| Playwright | `tests/e2e/README.md`, `playwright.config.ts` |

---

## Completion criteria for “GO” round

- Phase 0 + Phase 1 materially advanced (env doc + security migration or explicit written exception).
- Phase 2 started or inbox fully wired.
- Slice 1 has at least **one** strengthened E2E or test proof for policy chain.
- Handoff note in PR or commit message listing **verified commands**.

---

## Progress snapshot (percent-style — update each GO run)

| Metric | Formula | Latest snapshot *(align with `docs/GO_PROGRESS.md`)* |
|--------|---------|------------------------|
| **Readiness pillars “complete”** | `complete / 4` from `lib/readiness/status.ts` | **0%** (0/4 complete) |
| **Readiness weighted maturity** | `(complete×100 + hardening×50 + partial×25 + missing×0) / 4` | **~44%** (0/3/1/0) |
| **GO Phase 0** | 3 checklist lines | **~100%** (docs + CI typecheck + lint + `verify:csp-config` + build; Playwright optional) |
| **GO Phase 1** | 4 groups (membership, rollout, inbox, grants) | **~100%** (pass12/13 + pass4 doc review; founder role policy deferred) |
| **GO Phase 2** | Founder ops checklist | **~100%** (inbox + DEFERRED.md; notifications matrix out of scope) |
| **GO Phase 3–4** | Slices + hardening | **Low** — next focus |
| **GO overall (rough)** | Phases 0–4 weighted | **~40–50%** plan execution *(product slices + applied DB remain)* |

**Note:** Percentages are **planning aids**, not audited metrics. Flip `readinessItems` statuses only when gates truly change.
