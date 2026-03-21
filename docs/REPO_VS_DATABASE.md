# Repo vs database — where you stand

**Plain language**

| | What it is |
|--|------------|
| **Repo** (`supabase/migrations/*.sql`) | The **intended** database shape: **~115** migration files, in **timestamp order** (filename sort = apply order). This is what developers and CI assume. |
| **Your Supabase project** | The **actual** database. **Cursor/agents cannot see it** — only **you** (SQL Editor, dashboard, CLI) can. |

So: **we never automatically “know” if they match** until **you run a check** (below) or **you** confirm what you’ve applied.

---

## 1) Did the Supabase CLI ever record migrations?

In **SQL Editor**, run:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

- **If this works** — you get a list of applied **version** strings (usually matching the **numeric prefix** of filenames, e.g. `20260323150000`).  
  - Compare to filenames in **`supabase/migrations/`** (same prefixes).  
  - Anything **in the repo but not in this table** was likely **not** applied via CLI (or not applied at all).

- **If you get “relation does not exist”** — migrations were probably applied **only by hand** in the SQL Editor, or from another tool. There is **no automatic ledger** in that case; use **§2 spot-checks** instead.

---

## 2) Spot-check: recent security chain (pass12–14)

These three files are the ones we call out for **claim routing + RPC auth** alignment (`docs/MIGRATIONS_APPLY_ORDER.md`):

| Prefix | File (in repo) |
|--------|----------------|
| `20260323150000` | `pass12_membership_self_rpc_auth_binding.sql` |
| `20260323150001` | `pass13_action_inbox_actor_auth_binding.sql` |
| `20260323151000` | `pass14_claim_packet_routing_ready_guard.sql` |

**If `schema_migrations` exists:** see whether those **versions** appear in the query from §1.

**If not, rough RPC check** (pass14): in SQL Editor, open the pass14 file in the repo and see if its behavior matches what you expect, or ask a developer to run a **claim-packet / claim-route** E2E against this project — failures often mean pass14 (or earlier) isn’t applied.

---

## 3) What we know from Git only (no database access)

- **CI** runs `npm run verify:migration-chain` → pass12–14 **files exist in the repo** (not that they’re on your DB).
- **Era score** in `docs/BLOCK_AB_PRODUCTION_TRACKER.md` updates as **you** confirm apply on the **target** project.

---

## 4) After you know

1. Note in `docs/BLOCK_AB_PRODUCTION_TRACKER.md`: update **A2+B1** row % and add **date + how you verified** (e.g. “schema_migrations contains through 20260323151000”).  
2. Optional: paste the **last** `version` from `schema_migrations` into `docs/GO_PROGRESS.md` under “Apply to database” so the team shares one truth.

---

## Verified snapshot (your project — 2026-03-20)

**Baseline** (`schema_migrations` query you shared): last recorded **`20260321143000`** — `section5_staged_feature_registry`.

**Applied (your record):**

1. `20260321170000_section41_policy_governance_determinism.sql` — manual.  
2. **Batch:** remaining gap through **`20260323151000_pass14_claim_packet_routing_ready_guard.sql`** via bundle (after **`f663`** `REFERENCES incidents(id)` fix). **User confirmed success** (UI ~3.6k lines processed; **no rows returned** is normal for DDL).

**Optional check:** `select max(version) from supabase_migrations.schema_migrations` — may still end before **`20260323151000`** if the Editor run did not insert ledger rows; **objects** can still be correct — validate with **`npm run e2e:contracts`** / app behavior.

### One batch (historical)

Bundle **`supabase/bundles/gap-through-pass14-ONE-BATCH.sql`** matched the **14-file** list (excl. section41). Regenerate with `npm run bundle:gap-migrations` if migrations change.

### After pass14 (E2E / PostgREST fixes — repo)

If **`e2e:contracts`** failed with **PGRST203** on `change_incident_status`, **`job_name` null** on `job_queue`, or **`incident_canonical_status` does not exist**, apply in order:

| Version | File |
|--------|------|
| `20260324120000` | `fix_pgrst203_and_job_queue_job_name.sql` |
| `20260324130000` | `fix_change_incident_status_text_canonical.sql` |
| `20260325100000` | `a1_advance_trip_maturity_auth_bind.sql` |
| `20260325101000` | `a1_route_claim_auth_bind.sql` |

See **`docs/MIGRATIONS_APPLY_ORDER.md`**. **`max(version)`** may read **`20260325101000`** after the A1 pair (and **`20260324130000`** after PostgREST fixes only).

---

## Troubleshooting (batch apply)

- **`column "incident_id" referenced in foreign key does not exist`** — was a bug in `20260322113000_f663_f664_f666_foundations.sql` (`REFERENCES incidents(incident_id)` must be `incidents(**id**)`). **Fixed in repo**; regenerate bundle with `npm run bundle:gap-migrations` and re-run from the file that failed (or full bundle if nothing partial applied).

---

*Last updated: aligns with backlog “repo vs DB clarity”. Snapshot from user-supplied `schema_migrations` query.*
