# Section 2 — Implementation audit (identity / group governance slice)

This document cross-walks **product Section 2** expectations (as reflected in `lib/MISMATCH_LOG.md`, group authority migrations, and governance substrate docs) against **runtime behavior** after `20260320160000_section2_identity_guarded_mutations.sql` and the group controls UI.

Canonical sources in-repo:

- **Governance pattern (Section 2.0.1-style)**: mutating RPCs call `precheck_mutation_guard` → perform mutation → `emit_event`; ledger pairing failures abort the transaction (`RAISE EXCEPTION`). See `lib/ACTION_INBOX_README.md` and `lib/GOVERNANCE_SUBSTRATE_SUMMARY.md`.
- **Operational posture (2.0.11-style PROTECTIVE limits)**: extended `precheck_mutation_guard` lists for identity mutation classes; see migration header comments.

---

## 2.0.1 — Guard → mutate → emit (fail closed)

| Expectation | Implementation | Status |
|-------------|----------------|--------|
| No successful mutation without governance precheck when region is constrained | Identity RPCs call `precheck_mutation_guard(p_region_id, 'identity', '<mutation_class>')` and return `{ success: false, error: 'mutation_guard_blocked', guard }` when disallowed | ✅ |
| Ledger emission paired with state change; emit failure rolls back | After writes, `emit_event(...)`; `IF NOT success THEN RAISE EXCEPTION` | ✅ |
| Event types registered for checksum / registry path | `event_type_registry` rows for relationship verification, export grant/revoke, block, founder override, residence update | ✅ |
| Scope labels for `emit_event` (`trip`, `user`) valid | `entity_type` extended with `trip` and `user` where missing | ✅ |

**RPCs covered:** `update_group_participant_residence_profile`, `request_group_participant_add` (6-arg plpgsql), `resolve_relationship_verification_request`, `grant_export_authorization`, `revoke_export_authorization`, `founder_reset_relationship_block`.

---

## 2.0.11-style PROTECTIVE posture (identity classes)

| Mutation class | PROTECTIVE | RECOVERY | Notes |
|----------------|------------|----------|--------|
| `identity_invite_group_participant` | ❌ | ✅ | Organizer adds / verification requests blocked in PROTECTIVE |
| `identity_export_grant` | ❌ | ✅ | New export grants blocked in PROTECTIVE |
| `identity_founder_relationship_override` | ❌ | ✅ | Founder block reset blocked in PROTECTIVE |
| `identity_resolve_relationship_verification` | ✅ | ✅ | Subject/guardian can still approve/deny where RPC authorizes |
| `identity_export_revoke` | ✅ | ✅ | Self-defense / guardian-aided revoke remains available |
| `identity_participant_residence_profile` | ✅ | ✅ | Participant or trip organizer can patch residence via RPC |

Aligned with “fail closed” degraded posture: **membership expansion and new export grants** pause; **verification resolution, revoke, residence** remain operational.

---

## 2.0.2 / topology (partial by design)

| Expectation | Status |
|-------------|--------|
| First-class **Group** object separate from `trips` | ⚠️ **Partial** — group trips use `trips.is_group_trip` + `group_participants`; no separate `groups` entity |
| **DelegationGrant** / full **Trusted Ally** capability enforcement everywhere | ⚠️ **Partial** — export grant/revoke uses `trusted_ally_links`; broader Section 2 delegation graph not fully modeled app-wide |
| **MinorConstraint** on all minor-touching paths | ⚠️ **Partial** — dual consent + guardian fields on verification; not asserted uniformly across every surface |

Documented here so PM/ eng knows the **identity DB slice** is intentional scope, not the full Section 2 object model.

---

## 2.0.3–2.0.5 — RLS and “no direct client writes”

| Table | Direct authenticated INSERT/UPDATE (removed) | Mutations path |
|-------|-----------------------------------------------|----------------|
| `group_participants` | Organizer `FOR ALL` policy dropped | RPCs: `request_group_participant_add`, `resolve_relationship_verification_request`, `update_group_participant_residence_profile` |
| `relationship_verification_requests` | Requester insert / subject update policies dropped | RPC: `request_group_participant_add`, `resolve_relationship_verification_request` |
| `export_authorization_grants` | Subject/guardian insert & revoke policies dropped | RPC: `grant_export_authorization`, `revoke_export_authorization` |

**Reads** for organizers/subjects/guardians remain via existing SELECT policies and trip-context RLS where applicable.

---

## UI alignment (`app/(app)/trips/[trip_id]/group/page.tsx`)

| Surface | Implementation | Status |
|---------|----------------|--------|
| Residence profile edit | `update_group_participant_residence_profile` RPC (not `from('group_participants').update`) | ✅ |
| Invites / verify / export | Existing RPCs; feature flags `F-2.0.12-INVITES` / `F-2.0.6-EXPORT-AUTH` | ✅ (flags are UX rollout; DB guard is separate) |

---

## Verification checklist (manual / SQL)

1. **PROTECTIVE region:** `request_group_participant_add` → `mutation_guard_blocked`; `grant_export_authorization` → blocked; `resolve_relationship_verification_request` → allowed; `revoke_export_authorization` → allowed; `update_group_participant_residence_profile` → allowed.
2. **RECOVERY region:** organizer invite + export grant + founder override allowed (subject to RPC auth).
3. **Residence:** With migration applied, anon client `UPDATE group_participants` should fail; RPC as participant or group organizer succeeds and creates `participant_residence_profile_updated`.
4. **Emit failure:** Simulate unregistered event type only in a branch — production migration registers required types.

---

## Files

- Migration: `supabase/migrations/20260320160000_section2_identity_guarded_mutations.sql`
- Group UI: `app/(app)/trips/[trip_id]/group/page.tsx`
- Running product/doc deltas: `lib/MISMATCH_LOG.md` (append dated entries for this audit)
