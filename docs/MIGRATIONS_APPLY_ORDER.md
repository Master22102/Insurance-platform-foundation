# Supabase migrations — recommended apply order (security / claim-routing)

Apply to the **target** Supabase project in timestamp order (same as folder sort). These passes are especially important for **RPC auth binding** and **claim packet** behavior tested by E2E.

**Unsure if DB = repo?** See **`docs/REPO_VS_DATABASE.md`** (SQL you can run in the dashboard).

| Order | File | Purpose |
|------:|------|--------|
| 1 | `20260323150000_pass12_membership_self_rpc_auth_binding.sql` | Membership / self RPC: `p_user_id` ↔ `auth.uid()` |
| 2 | `20260323150001_pass13_action_inbox_actor_auth_binding.sql` | FOCL inbox: actor / `auth.uid()` binding |
| 3 | `20260323151000_pass14_claim_packet_routing_ready_guard.sql` | `create_claim_packet_from_incident` requires `CLAIM_ROUTING_READY` |
| 4 | `20260324120000_fix_pgrst203_and_job_queue_job_name.sql` | **PostgREST:** drop legacy `change_incident_status(…, incident_status, …)` overload vs pass6 `text`; **`job_queue.job_name`** on `initiate_quick_scan` / `initiate_deep_scan` (E2E pass9) |
| 5 | `20260324130000_fix_change_incident_status_text_canonical.sql` | **`change_incident_status`:** `canonical_status` column is **text** (M-04), not `incident_canonical_status` enum — removes bogus cast (**42704** in E2E) |
| 6 | `20260325100000_a1_advance_trip_maturity_auth_bind.sql` | **A1:** `advance_trip_maturity` — `auth.uid()` + trip ownership; optional `p_actor_id` must match JWT |
| 7 | `20260325101000_a1_route_claim_auth_bind.sql` | **A1:** `route_claim` — `auth.uid()`, `p_actor_id`, trip ownership before routing |

**Earlier** platform migrations (pass8–11, pass7 claim packet table, etc.) must already be applied on that database; this doc only highlights the **recent chain** called out in `docs/SHIP_BAR.md` and `docs/NEXT_PASS_BACKLOG.md`.

## How to apply

From **`Insurance-platform-foundation-main`** (or repo root, with correct `--workdir`):

```bash
# Linked project (Supabase CLI)
supabase db push

# Or run SQL in dashboard SQL editor in the same order as filenames above.
```

## Verify

- Repo: `npm run verify:migration-chain` ensures pass12–14 **files** exist (CI).
- Remote: `npm run e2e:contracts` with real env + `e2e:auth` storage state should pass **claim-packet** + **claim-route** specs against that project (requires **row 4** if you see **PGRST203** on `change_incident_status` or **`job_name` null** on scan RPCs).
- Ship / era checklist: **`docs/BLOCK_AB_PRODUCTION_TRACKER.md`**, **`docs/SHIP_BAR.md`** gate **A2** / **B1**.
