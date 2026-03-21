# Feature governance RPCs (rollout / activation)

**Migrations:** `20260320193000_pass4_focl_lifecycle_guardrails.sql` **replaces** earlier definitions of:

- `set_feature_activation_state`
- `set_feature_rollout_percentage`
- `set_feature_rollout_rules`

## Auth binding (Phase 1 review — closed in repo)

Each function:

1. Sets **`v_actor_id := auth.uid()`** — unauthenticated calls return **forbidden**.
2. Rejects **`p_actor_id` spoofing** — if `p_actor_id` is not null, it must equal **`auth.uid()`**.
3. Uses **`precheck_mutation_guard(..., 'feature_gate')`** — when governance is in protective mode, mutations are blocked and a **blocked** event is emitted.

**Implication:** Any **`authenticated`** user who passes the governance guard can, in principle, change activation/rollout **unless** the guard encodes founder-only or role checks. Tightening to **founder-only** is a **product/role** decision (see `lib/FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md`); may require a role table + RPC check or Edge Function with service role.

**GRANT:** `EXECUTE` to `authenticated` remains from earlier migrations; `CREATE OR REPLACE` preserves grants. Anon is revoked on those signatures.
