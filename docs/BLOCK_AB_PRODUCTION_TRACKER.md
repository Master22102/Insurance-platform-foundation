# Block A + B1 — production closure tracker

**Goal (your ask):** Push **Ship bar §A (security & trust)** and **§B1 (schema matches repo)** toward **~90% “production-era” closure** in focused passes—without pretending pilot-tier shortcuts count as production.

**Reality check — migrations:** Nothing in this repo can “auto-apply” to **your** Supabase project **without**:

- `supabase link` + `supabase db push` (on a trusted machine), **or**
- Pasting ordered SQL in the Supabase SQL editor, **or**
- A **CI/CD job you own** with `SUPABASE_ACCESS_TOKEN` / DB credentials (human-gated `workflow_dispatch` recommended for production).

Cursor/agents **cannot** reach your database. We **can**: keep migrations correct, ordered, verified in repo, and document the exact apply + verify steps.

**After each “go” pass:** this file’s **§ Pass log** and **§ Era score** are updated; you get a short summary in chat.

---

## What “~90% era” means (Block A + B1 only)

| Code | Meaning |
|------|--------|
| **0** | No intentional work; repo-only artifacts. |
| **90** | **Human-verified** on **target production project**: security migrations applied (**A2/B1**), no known open **A1** issues for scoped RPCs, **A3–A5** consistent with production bar, drift documented or zero. |
| **100** | External auditor / second reviewer sign-off (optional; not required for internal “era” target). |

**Production vs pilot:** For **broader production**, treat **A5** as **required**, not optional.

---

## Scorecard (update each pass)

Weights sum to **100**; **era 0–90** = `round(sum(weights × row%)) × 0.9` so “90 era” ≈ “all rows at ~100% row score.”

| Row | Weight | Row % (0–100) | Notes / evidence |
|-----|--------|----------------|------------------|
| **A1** Tenant isolation | 22 | **55** | Pass12/13 auth binding **in repo**; full matrix = ongoing (`DEFERRED.md`, RPC audit). |
| **A2+B1** Applied = schema matches repo | 28 | **100** | **2026-03-20:** Batch through pass14; **2026-03-21:** **`npm run e2e:contracts:required`** **9/9** on target + follow-up migrations **`20260324120000`**, **`20260324130000`** (see **`MIGRATIONS_APPLY_ORDER.md`**). |
| **A3** Secrets hygiene | 15 | **95** | No service keys in client bundle policy; spot-check new routes. |
| **A4** Failure UX | 15 | **78** | Generic JSON errors in many routes; production = widen spot-check list. |
| **A5** Browser baseline | 20 | **88** | Headers, middleware, CSP path; enforcing CSP optional post-triage. |

**Computed (this revision):** weighted avg **≈ 83.7%** row completion → **era ≈ 75 / 90** (83.7 × 0.9).

**A2+B1** at **100%** on user confirmation; **~90 era** on this tracker still needs **A1/A4** tightening or external sign-off per your production bar.

---

## Pass log

| Pass ID | Date | What changed | Era (est.) |
|---------|------|----------------|------------|
| **AB-0** | 2026-03-18 | Tracker created; `verify:migration-chain` in CI; GO_PROGRESS program link; migration reality documented. | **~51 / 90** |
| **AB-1** | 2026-03-20 | User supplied `schema_migrations`; last version **20260321143000**; **15** pending files documented in **`REPO_VS_DATABASE.md`**. | **~61 / 90** |
| **AB-1b** | 2026-03-20 | User applied **`20260321170000_section41_...`** manually; bundle + doc list reduced to **14** files. | **~62 / 90** |
| **AB-2** | 2026-03-20 | User confirmed **batch run success** (fixed `f663` FK + bundle; ~3.6k UI “rows”); **A2+B1** row → **100%**. | **~75 / 90** |
| **AB-3** | 2026-03-21 | PostgREST / `job_queue` / `change_incident_status` fix migrations applied; **`e2e:contracts:required`** **9 passed** (no skips) on target Supabase. | **~75 / 90** *(era unchanged until A1/A4)* |

---

## Your checklist — production apply (A2 + B1)

1. Backup / snapshot policy for prod DB (provider).
2. Apply full migration history in order on **production** (not only pass12–14 if DB is fresh—use `supabase db push` from repo tip or follow provider docs).
3. Confirm highlighted chain present remotely (RPCs match):  
   `docs/MIGRATIONS_APPLY_ORDER.md`
4. Verify: `npm run e2e:contracts` + storage state against **that** project; claim-route / packet specs green.
5. Update **Row %** table above: set **A2+B1** to **100** and add evidence (ticket link, date, operator).

---

## Related

- `docs/SHIP_BAR.md` — **A2**, **B1**
- `docs/MIGRATIONS_APPLY_ORDER.md` — pass12–14 chain
- `docs/RUNBOOK.md` — operations context
