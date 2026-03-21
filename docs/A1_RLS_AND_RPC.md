# A1 — RLS + RPC pass (short)

**Purpose:** Complement the [A1 RPC inventory](./A1_RPC_INVENTORY.md) heuristic with how **row-level security** and **SECURITY DEFINER** interact in this codebase.

## Mental model

| Layer | Role |
|--------|------|
| **RLS** | Applies to table access under the **current role** (usually `authenticated`). `SECURITY INVOKER` RPCs see RLS as the caller. |
| **SECURITY DEFINER** | RPC runs as the **function owner** (often `postgres` / superuser). **RLS is bypassed** unless the function is written to respect it explicitly. **Do not rely on RLS alone** for DEFINER functions. |
| **Auth binding** | For user-scoped mutations, DEFINER RPCs should **`auth.uid()`-bind** (and optionally validate `p_actor_id` / trip ownership) *inside* the function body. |

## Where to look in-repo

- **RLS:** `grep -r "ENABLE ROW LEVEL SECURITY" supabase/migrations` and `CREATE POLICY` in the same files.
- **DEFINER RPCs:** `grep -r "SECURITY DEFINER" supabase/migrations`.
- **Sensitive tables:** `trips` (ownership `created_by`), `incidents`, `claim_packets`, `claim_routing_decisions`, `user_profiles`, `event_ledger`, `job_queue` — each should have policies aligned with product rules.

## Pass criteria (A1 “RLS + RPC” slice)

1. High-traffic **user** RPCs that touch foreign tenants are **auth-bound** (see migrations `20260325100000_*`, `20260325101000_*` for `advance_trip_maturity` / `route_claim`).
2. **Service-role-only** or **internal** RPCs are listed in [A1_EXCEPTIONS.md](./A1_EXCEPTIONS.md), not silently treated as bugs by the inventory heuristic.

## Related

- `npm run verify:a1-inventory` — baseline vs new HIGH heuristic names.
- E2E: `tests/e2e/a1-rpc-auth-contract.spec.ts`.
