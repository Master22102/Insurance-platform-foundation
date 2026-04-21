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
- **Update (2026-04-21)**: Section 8.9 doctrine v1.0 now on disk at
  `lib/Doctrine/SECTION 8.9 DATA ERASURE & RIGHT-TO-ERASURE PROTOCOL`.
  Status flipped to `IN_PROGRESS`. Migration
  `f_6_8_9_erasure_requests_table` applied; binding doctrine file
  `lib/feature-bindings/F-6.8.9_Data_Erasure_Protocol.md` committed. See
  M-011 for the resolution entry.

---

## M-007 — F-6.7.x binding draft numbering drift

- **Status**: RESOLVED (2026-04-21)
- **Scope**: `lib/feature-bindings/F-6.7.*`
- **Observed**: An earlier drafting pass bound the four Phase-2 save-layer
  features as F-6.7.1 Field Notes, F-6.7.2 Trip Spark, F-6.7.3 Budget
  Intelligence, F-6.7.4 Preference Memory. The canonical doctrine in
  `lib/Doctrine/` unambiguously numbers them F-6.7.2 Field Notes, F-6.7.3
  Trip Spark, F-6.7.4 Budget Intelligence, F-6.7.5 Preference Memory.
- **Risk**: Any feature_registry insert, migration, event type, or
  cross-reference written against the draft IDs would ship to production
  with the wrong feature_id, breaking FOCL dependency wiring and audit
  traces.
- **Remediation**: Deleted the four old draft files. Wrote replacements at
  the correct feature IDs against source doctrine:
  - `F-6.7.2_Field_Notes.md`
  - `F-6.7.3_Trip_Spark.md`
  - `F-6.7.4_Budget_Intelligence.md` (no new table — JSONB only)
  - `F-6.7.5_Preference_Memory.md` (three-layer model, preference-item
    array)
  All four carry a `Source doctrine:` header pointing at the relevant file
  in `lib/Doctrine/` plus a numbering-history note.
- **Verified**: Directory listing shows only the four canonical files;
  `grep -rn "F-6.7.1" lib/` returns no live binding references.

---

## M-008 — Section 6.5.13 v2.0 absorbs 6.5.11 and 6.5.12

- **Status**: IN_PROGRESS (doctrine side RESOLVED; registry side OPEN)
- **Scope**: `lib/Doctrine/SECTION 6.5.13 — DEEP SCAN INTELLIGENCE ENGINE`,
  `feature_registry`, `docs/DEEP_SCAN_AXIS_DOCTRINE.md`
- **Observed**: Section 6.5.13 v2.0 (March 2026) formally supersedes
  Section 6.5.13 v1.0 and absorbs Sections 6.5.11 (Regulatory-Aware
  Incident Reporting) and 6.5.12 (Authority-Driven Travel Disruptions) as
  Axes 9 and 11 respectively. Both 6.5.11 and 6.5.12 are removed from the
  Table of Contents.
- **Remediation (doctrine)**: `docs/DEEP_SCAN_AXIS_DOCTRINE.md` fully
  populated with the ten canonical axes (plus Axis 11 on-demand),
  Itinerary Optimizer mode matrix, Quick-vs-Deep comparison, credit
  governance invariants DS-1 and DS-2, and the Local Partner signal. Axes
  9 and 11 carry absorption notes.
- **Remediation (registry) — OPEN**: `feature_registry` still contains
  rows for F-6.5.11 and F-6.5.12 as standalone features. A follow-up
  migration must either mark them `absorbed_by = 'F-6.5.13'` or retire
  them to a `retired_features` table. Blocked until FOCL retirement
  semantics are agreed.
- **Next action**: Scope the registry retirement migration; decide whether
  to preserve the historical rows (preferred, with an `absorbed_by`
  column) or move them.

---

## M-009 — Section 3.3 v1.1 amendments not yet wired

- **Status**: OPEN
- **Scope**: Coverage Graph model runtime, event_type_registry,
  routing_recommendation supersedure path
- **Observed**: Section 3.3 v1.1 (March 2026) is binding doctrine and adds
  five sub-doctrines plus nine new invariants:
  - **3.3.19.A Voucher Acceptance**: Advisory-only posture. Invariants
    I-26, I-27, I-28, I-29. Required events:
    `voucher_acceptance_recorded`, `routing_recommendation_superseded`.
  - **3.3.19.B Baggage Delay Pre-Claim Protocol**: Time-step ladder (0–60
    min, 1–4 h, 4–5 h threshold, confirmed-lost). Invariants I-30 through
    I-34. Required event: `traveler_boarded_without_bags`. Cross-incident
    CCO isolation rule.
  - **3.3.19.C Evidence Threshold for CCO Dispute**: Maintenance vehicle
    photo NOT VALID; Official Airline Record is the primary source. No
    false-hope generation.
  - **3.3.19.D Gap and Ambiguity Language**: AMBIGUOUS / GAP_IDENTIFIED
    strings abolished from traveler-facing surfaces. Rebook-first
    protocol. Reassurance-forward language.
  - **3.3.19.E Solo Source Advisory Rule**: Defines when the platform may
    suggest additional coverage without crossing into sales or pressure.
- **Risk**: None of the new invariants, events, or language constraints
  are enforced in the current codebase. Shipping Coverage Graph surfaces
  today would produce doctrine-non-compliant output.
- **Next action**: Scope three migrations — voucher supersedure chain,
  baggage cascade state machine, approved-language linter for Coverage
  Graph render output. Binding doctrine file
  `lib/feature-bindings/SECTION_3.3_v1.1_Amendments.md` drafted this pass.

---

## M-010 — Section 3.6 FAM-16 statutory rights engine not built

- **Status**: OPEN
- **Scope**: `lib/Doctrine/SECTION 3.6 PASSENGER RIGHTS & DISRUPTION
  RESOLUTION ENGINE`, Coverage Graph statutory-node extension, Causality
  Model `cause_class_internal` linkage
- **Observed**: Section 3.6 v1.0 (March 2026) is binding doctrine and
  encodes four statutory frameworks as deterministic lookup tables: EU
  Regulation 261/2004, US DOT Rules (14 CFR Part 250 + 2024 Refund Rule),
  Montreal Convention 1999 Articles 19 and 22, and UK retained EC
  261/2004. All four are registered under clause family FAM-16. Doctrine
  also defines the Disruption Resolution State Machine. EU/EEA commercial
  launch is gated on this work.
- **Risk**: No statutory rights are surfaced today. A traveler with a
  weak or absent policy has no visibility into the statutory floor. EU
  launch blocker.
- **Next action**: Scope the FAM-16 rule-table schema (compensation
  tiers, distance brackets, right-to-care tiers, extraordinary
  circumstances matrix, MC liability caps in SDR), the jurisdiction
  applicability function, and the Coverage Graph statutory-node
  extension. Binding doctrine file
  `lib/feature-bindings/SECTION_3.6_Statutory_Rights.md` drafted this
  pass.

---

## M-011 — Section 8.9 erasure protocol — unblocked and scoped

- **Status**: RESOLVED (2026-04-21) for doctrine + scope; IMPLEMENTATION
  follows M-005.
- **Scope**: `lib/Doctrine/SECTION 8.9 DATA ERASURE & RIGHT-TO-ERASURE
  PROTOCOL` (v1.0), `erasure_requests` table, Section 8.9 binding
  doctrine, MISMATCH_LOG M-005.
- **Observed**: Section 8.9 v1.0 is now present and binding. It defines
  intake and verification, per-object PII field register, event ledger
  redaction protocol, lawful retention exceptions, nine-step execution
  sequence, and nine behavioral invariants E-I-01 through E-I-09. EU/EEA
  commercial launch is unblocked by this section.
- **Remediation (this pass)**:
  - Created `lib/feature-bindings/F-6.8.9_Data_Erasure_Protocol.md`
    covering intake, the nine execution steps, ledger redaction
    reconciliation, actor anonymization rule, and the nine invariants.
  - Applied migration `f_6_8_9_erasure_requests_table` creating
    `erasure_requests` (status enum, requestor identity, scope descriptor,
    SLA deadline), RLS (requestor + privacy admin visibility only),
    supporting event types under feature_id `F-6.8.9`.
- **Next**: Wire the `pii_erasure_*` event types through
  `event_type_registry` (already seeded by the migration) and stand up
  the execution RPCs per the nine-step sequence. Tracked as follow-up
  under M-005.

---

## Update protocol

1. When a new mismatch is detected, append a new `M-NNN` section.
2. When remediation starts, flip status to `IN_PROGRESS` and note the migration
   filename / PR.
3. When verified fixed in both repo and database, flip to `RESOLVED` with the
   verification date and a one-line confirmation.
4. Never delete an entry; history is part of the audit trail.
