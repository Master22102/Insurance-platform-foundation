# A1 — Exceptions (intentional DEFINER / service paths)

The [A1 RPC inventory](./A1_RPC_INVENTORY.md) flags **HIGH** when `SECURITY DEFINER` + user-like params appear without `auth.uid()` in the **parsed** function text. Many entries are **false positives** (auth in nested blocks, `auth.uid()` in called helpers, or governance guards) or **intentionally** different.

Use this doc to record **owner**, **intended caller**, and **why** the pattern is acceptable — and to shrink the baseline over time as functions are hardened or reclassified.

## How to list an exception

| Function | Intended caller | Notes |
|----------|-----------------|-------|
| *example* | `service_role` / Edge only | Document `GRANT` and any `request.jwt` checks. |

## Categories

### 1. Signup / bootstrap

- **`create_user_profile_on_signup`** — Typically triggered on first auth; may use `p_user_id` from trusted signup path. Confirm trigger vs direct RPC exposure.

### 2. Orchestration / `invoke_*` pipeline stubs

- Functions named **`invoke_*`** often delegate to workers or feature flags. **Verify** they are not callable cross-tenant from the anon/authenticated PostgREST surface, or that they enforce scope inside.

### 3. Internal jobs / projectors

- **`run_action_inbox_projector`**, **`emit_event`**, **`emit_itr`** — May be **service_role** or job-only. If exposed to `authenticated`, they need explicit guards.

### 4. Governance-guarded mutations

- RPCs that call **`precheck_mutation_guard`** still need **subject binding** where user data is involved; governance is not a substitute for `auth.uid()` checks on ownership.

### 5. Recently hardened (reference)

| Function | Migration | Binding |
|----------|-----------|---------|
| `advance_trip_maturity` | `20260325100000_a1_advance_trip_maturity_auth_bind.sql` | `auth.uid()`, trip `created_by`, optional `p_actor_id` must match JWT |
| `route_claim` | `20260325101000_a1_route_claim_auth_bind.sql` | `auth.uid()`, `p_actor_id`, trip `created_by` |

## Baseline file

`scripts/a1-rpc-inventory-baseline.json` lists **allowed** HIGH heuristic names until each is reviewed or fixed. **Update the baseline** only when adding a **documented** exception or after confirming a function is safe.

## Related

- `npm run verify:a1-inventory` — fails if a **new** HIGH name appears that is not in the baseline.
- `docs/A1_RLS_AND_RPC.md` — RLS vs DEFINER.
