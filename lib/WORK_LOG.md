# WAYFARER — WORK LOG (Single Source of Truth)

Append-only ledger of work completed against the doctrine. Every future session
reads this first and appends a new entry below — nothing gets redone.

Format:
```
## <YYYY-MM-DD> — <session label>
Tier: <A|B|C|D|FOUNDATION>
Scope:
  - Bullet summary
Deliverables:
  - path/to/file — what it is
Migrations:
  - <filename> — one-line purpose
Gap Register rows touched:
  - <G-ID> — <status transition>
Verification:
  - <manual / build / RLS / RPC smoke>
Outstanding:
  - <what is still pending>
```

---

## 2026-04-22 — Session 1: Schema/Ledger Alignment
Tier: FOUNDATION (schema substrate)
Scope:
  - Landed the 16-migration pending queue from PENDING_MIGRATIONS.md.
  - Registered 12 new event types, 6 new feature IDs.
  - Aligned §3.4 CCO vocabulary on incidents.
  - Added composition, participant role, location certainty, benefit applicability,
    trip continuation, maintenance windows, clause timers, field notes, account
    anchor state, signal profile versions, quick-scan cache.

Deliverables:
  - supabase/migrations/ (16 new files, all IF EXISTS safe)

Migrations:
  - m_event_registry_fill_and_feature_pre_register
  - m_rename_cco_alias
  - m_segment_type_expand
  - m_disruption_type_constraint
  - m_composition
  - m_participant_role_ext
  - m_home_location_and_certainty
  - m_benefit_applicability_and_trip_continuation
  - m_maintenance_windows
  - m_clause_timers
  - m_field_notes
  - m_account_anchor
  - m_signal_profile
  - m_quick_scan_cache

Gap Register rows touched:
  - G-001, G-002, G-004, G-005, G-010..G-021 — RESOLVED at schema layer.

Verification:
  - `npm run build` — PASS after migrations.

Outstanding:
  - Feature-level UI/API surfaces for: F-6.6.x, F-6.7.x, F-6.8.9 traveler flow,
    §7.8 DDCL, §12.5 Connector Observability, §12.10 Maintenance control UI,
    Deep Scan results page, Right Now engine surface, Scenario 1/2/5 loops.

---

## 2026-04-22 — Session 2: FOCL Foundation
Tier: FOUNDATION (control layer)
Scope:
  - FOCL (F-6.5.16) is the founder-only control substrate every feature must
    pass through. This session hardens it so subsequent feature work has a
    deterministic registration + rollout + health + audit path.

Deliverables:
  - lib/WORK_LOG.md — this file (single source of truth going forward).
  - lib/feature-bindings/F-6.5.16_FOCL.md — canonical doctrine binding.
  - middleware.ts — server-side 404-hide of /focl/* for non-founders.
  - app/focl/page.tsx — Founder Dashboard.
  - app/focl/decision-queue/page.tsx — Action Inbox surface.
  - app/focl/maintenance/page.tsx — Maintenance Class A/B/C controls.
  - components/SplashGate.tsx — wires SplashScreen to auth bootstrap.
  - lib/focl/register-feature.ts — TS helper for checkpoint registration.

Migrations:
  - m_focl_is_founder_helper — adds public.is_founder(uuid) RLS helper.
  - m_focl_maintenance_window_rpcs — open_/close_maintenance_window SECURITY
    DEFINER RPCs, founder-gated, emit maintenance_window_* ledger events.
  - m_focl_register_feature_with_checkpoints — enforces registry + rollout rule
    + event-type checklist at registration time.
  - m_focl_founder_action_ledger_events — registers founder_action_recorded
    event type.

Gap Register rows touched:
  - (new) G-F01 FOCL doctrine binding file — RESOLVED.
  - (new) G-F02 Founder gating server-side — RESOLVED.
  - (new) G-F03 is_founder helper — RESOLVED.
  - (new) G-F04 Registration checkpoint pipeline — RESOLVED.
  - (new) G-F05 Founder Dashboard UI — RESOLVED (Tier 1).
  - (new) G-F06 Decision Queue UI — RESOLVED (Tier 1).
  - (new) G-F07 Maintenance control UI + RPCs — RESOLVED.
  - (new) G-F08 Splash screen wired — RESOLVED.

Verification:
  - `npm run build` — PASS.
  - Manual RLS smoke: non-CORPORATE user cannot SELECT/INSERT via FOCL RPCs.

Outstanding:
  - FOCL Tier 2 surfaces: Deployment Changelog, Action Ledger timeline,
    Interpretive Drift Observatory, Allocation Capacity.
  - Trip Overview mock translation (pending user HTML drop).
  - Tier A feature build: Right Now dashboard, Deep Scan UI, Scenarios 1/2/5.
