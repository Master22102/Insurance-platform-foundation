# MISMATCH_LOG — Wayfarer Platform Drift Ledger

Canonical record of discrepancies between repository state, deployed database
state, and specification/doctrine. Each entry is opened when detected, updated
when remediated, and closed only when both repo and database agree with the
doctrine.

Status legend: OPEN · IN_PROGRESS · RESOLVED · DEFERRED

---

## M-001 — Migration count drift (repo vs remote DB)

- **Status**: OPEN
- **Detected**: 2026-04-21 (Week 0 baseline verification)
- **Scope**: `supabase/migrations/` vs `mcp__supabase__list_migrations`
- **Observed**:
  - Local filesystem: 92 migration files
  - Remote Supabase DB: 155 migrations applied
  - Gap: 63 migrations applied to the DB with no corresponding file checked
    into the repo
- **Risk**: Any environment rebuild from repo will not produce the current
  database schema. CI-driven resets or fresh clones will diverge.
- **Next action**: Enumerate the 63-file delta via `list_migrations`, pull each
  applied-but-missing migration's SQL from `supabase_migrations.schema_migrations`
  and commit the files back into `supabase/migrations/` with their original
  timestamps.

---

## M-002 — M24 Options Engine events misattributed to F-6.5.7

- **Status**: RESOLVED (2026-04-21)
- **Scope**: `event_type_registry`, migration
  `20260314175212_20260315000002_M24_incidents_options_engine.sql`
- **Observed**: Six event types inserted against feature `F-6.5.7`
  ("Incident Timeline Read Model") when per the feature registry they belong
  to `F-6.5.8` ("Active Disruption Options Engine"):
  - `options_engine_activated`
  - `options_engine_preference_extracted`
  - `options_engine_arrangement_confirmed`
  - `options_engine_dismissed`
  - `live_options_searched`
  - `live_options_booking_link_opened`
- **Remediation**: Migration `fix_m24_event_attribution_f658` applied.
  Reassigned feature_id to F-6.5.8 for all six rows; registered
  `event_type_registry_correction` event type (F-6.5.8, info).
- **Verified**: Live query confirms all six rows now show F-6.5.8.

---

## M-003 — Additional events potentially misattributed (pass 2)

- **Status**: OPEN
- **Scope**: `event_type_registry`
- **Observed**: The following event types are tagged to features whose
  registry description does not obviously cover them. Source migrations
  need to be traced and registry assignments reviewed:
  - `trip_readiness_confirmed`, `trip_readiness_failed` — tagged F-6.5.7;
    may belong to F-6.5.17 (Trip Draft Engine) or a readiness-specific feature
  - `trip_state_advanced`, `unresolved_item_created`, `unresolved_item_resolved`
    — tagged F-6.5.7; likely belong to the trip maturity state machine
  - `voice_capture_completed`, `voice_parse_completed`, `voice_parse_failed`,
    `voice_proposal_confirmed`, `voice_proposal_rejected` — tagged F-6.5.7;
    likely belong to a voice parse feature
  - `causality_link_suppressed` — tagged F-6.5.8; verify ownership
  - `rebooking_log_suppressed` — tagged F-6.5.9; verify ownership
- **Next action**: Identify owning migration for each event, compare to
  feature_registry, open targeted remediation migration per feature cluster.

---

## M-004 — `f6517_*` migration prefix does not match F-6.5.17 or F-6.5.10

- **Status**: RESOLVED (2026-04-21 via ADR 0001 + feature-migration-map)
- **Scope**: Four migration files dated 2026-03-30:
  - `20260330100000_f6517_catalog_and_cost_ledger.sql`
  - `20260330100100_f6517_corpus_catalog_seed.sql`
  - `20260330100200_f6517_chase_reserve_catalog_clauses.sql`
  - `20260330100300_f6517_spec_v3_schema_alignment.sql`
- **Observed**: Prefix `f6517` suggests feature F-6.5.17 (Trip Draft Engine) or
  F-6.5.10 (Carrier Discrepancy Detection), but the content is policy/benefit
  corpus work, which is F-6.5.1 territory ("Policy Parsing & Clause Extraction").
- **Risk**: Migration provenance is misleading; any auditor tracing a feature's
  SQL surface from its ID will not find these files.
- **Next action**: Confirm true owning feature; either (a) rename the files
  (destructive to migration history) or (b) add a canonical alias entry in the
  feature_registry's migration_map and annotate the files with a corrective
  header comment. (b) is the safer option.

---

## M-005 — `erasure_requests` table missing despite Section 8.9 doctrine

- **Status**: OPEN
- **Scope**: GDPR / Section 8.9 erasure doctrine
- **Observed**: Migration M26 (`20260314201114_...M26_erasure_redaction_log.sql`)
  created `erasure_redaction_log` (the append-only redaction audit) but did
  NOT create an `erasure_requests` table to track the lifecycle of a data
  subject's erasure request (received → reviewed → executed → confirmed).
- **Risk**: No system of record for pending erasure requests. Redaction log
  exists but the request queue/state machine does not.
- **Next action**: Scope a migration that creates `erasure_requests` with
  status enum, requestor identity, scope descriptor, SLA deadline, and RLS
  limiting visibility to the requestor and privacy admins. Defer until Section
  8.9 doctrine requirements are re-reviewed.

---

## Update protocol

1. When a new mismatch is detected, append a new `M-NNN` section.
2. When remediation starts, flip status to `IN_PROGRESS` and note the migration
   filename / PR.
3. When verified fixed in both repo and database, flip to `RESOLVED` with the
   verification date and a one-line confirmation.
4. Never delete an entry; history is part of the audit trail.
