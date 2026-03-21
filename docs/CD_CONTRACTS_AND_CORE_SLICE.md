# C + D — contracts (CI truth) and core slice (product)

**Purpose:** Single finish line for **Ship bar §C** (tests / CI truth) and **§D1** (one vertical slice E2E-proven). Agents and humans use this doc to know **when to stop** this track and **pivot** (migrations, SQL, A1, ops, etc.).

**Related:** `docs/SHIP_BAR.md`, `docs/CI_E2E_SAMPLE.md`, `tests/e2e/README.md`, `docs/MIGRATIONS_APPLY_ORDER.md` (RPC chain through **pass14** must match target DB for claim contracts).

---

## Working agreement

1. **While C + D are in flight:** prefer fixes in **tests, env, app behavior, and docs** until the finish line below is met or a **hard blocker** is documented.
2. **When the finish line is met:** stop saying “go” on C/D alone; **pivot** to the next risk (e.g. **A1** RPC audit, **F** monitoring, **E** sign-offs, new migrations).
3. **Hard blockers** (examples): wrong `schema_migrations` / missing pass14 on target DB; RLS blocking `user_profiles` or RPCs; production-only policies. Those are **pivot to SQL / migrations / Supabase dashboard**, not more Playwright tweaks.

---

## D1 — “Core slice” definition (this repo)

The **promised traveler path** for C + D closure is:

| Step | What |
|------|------|
| **D1a** | Authenticated user (storage state + `NEXT_PUBLIC_SUPABASE_*`). |
| **D1b** | **Pass 9** RPC contracts: quick scan + unlock + deep scan idempotency (`pass9-idempotency-replay.spec.ts`). |
| **D1c** | **Claim packet** RPC contract: routing guard, forbidden, idempotency (`claim-packet-contract.spec.ts`) — requires **pass14** behavior on DB. |
| **D1d** | **Claim route** UI: routing page + form submit → success + `SUBMITTED` + `claim_packets` row (`claim-route-happy-path.spec.ts`). |

Together, **`npm run e2e:contracts`** (Chromium) is the **single command** that proves **D1** for automation. Record the date + environment when it passes in **`docs/GO_PROGRESS.md`** or your release notes.

---

## C — Finish line

| Gate | Done when |
|------|-----------|
| **C1 / C1b** | `npm run typecheck` + `npm run build` green on the branch (already in `ci.yml`). |
| **C2** | CI does not rely on “green but all skipped”: optional workflow uses **Require Playwright storage state** = **true** *or* local/CI run uses **`E2E_REQUIRE_CONTRACTS=1`** (see below) so missing auth/env **fails fast**. |
| **C3** | `npm run e2e:contracts` **passes** with **real** `.playwright/storageState.json` and Supabase env against the **same** project where migrations (through **pass14**) are applied. |

---

## Exact local commands (copy path)

From **`Insurance-platform-foundation-main/`**:

1. `.env.local` — **real** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the **same** Supabase project you sign into during `e2e:auth` (not `placeholder.supabase.co` / CI placeholders — strict mode **fails fast** on those). Recommended: `E2E_QUICK_SCAN_SKIP_CREDIT=1`.
2. `npm run e2e:auth` — creates `.playwright/storageState.json`.
3. `npm run e2e:contracts` — full contract pack (Chromium).

**Strict gate (`SHIP_BAR` C2 — no “green but all skipped”):**

```bash
npm run e2e:contracts:required
```

This sets `E2E_REQUIRE_CONTRACTS=1` and **fails before tests** if any of: missing `.playwright/storageState.json`, **no usable Supabase JWT inside that file** (re-run `npm run e2e:auth` if expired), or missing `NEXT_PUBLIC_SUPABASE_*`.  
(PowerShell override: `$env:E2E_REQUIRE_CONTRACTS='1'; npx playwright test ...` — prefer the npm script so args stay in sync.)

---

## When you hit the edge (stop C/D; pivot)

- **All of the above green** → C3 + D1 for this slice are **done**; next priorities typically **A1**, **F1/F3**, **E**, or broader E2E — **not** more contract churn without a new failure.
- **Failures in claim packet / route** after DB changes → **pivot to migrations / SQL** (`MIGRATIONS_APPLY_ORDER.md`, `REPO_VS_DATABASE.md`).
- **Failures in pass9 / quick scan / credits** → data or RPC policy issue; may pivot to **Supabase RLS**, seed data, or product rules — document in `GO_PROGRESS` pass log.

---

**Verified (example):** 2026-03-21 — **`npm run e2e:contracts:required`** **9 passed** on target Supabase (pass9 + claim packet + claim route); DB includes follow-up migrations **`20260324120000`**, **`20260324130000`** per **`MIGRATIONS_APPLY_ORDER.md`**. After adding **`a1-rpc-auth-contract.spec.ts`**, expect **11 passed** if **`20260325100000`** / **`20260325101000`** are applied.

*Last updated: C + D playbook + strict contracts gate + sample verification line.*
