# WAYFARER — CONSOLIDATED MASTER TO-DO
# Post-ChatGPT Cross-Reference + Repo Verification + Product Bible Audit

**Created:** April 2026
**Sources:** ChatGPT conversation (110p), updated_repo.zip (158 migrations), Product Bible (documentation.zip, 40 docs), all prior Claude sessions, Checklist Screen Family Spec

---

## PRIORITY 0 — FIX BEFORE ANY NEW PROMPTS

### P0-1. Deep Scan Axis 5 Doctrine Mismatch (CRITICAL)
**Status:** CONFIRMED BROKEN in repo
**File:** `docs/DEEP_SCAN_AXIS_DOCTRINE.md` line for Axis 5
**Problem:** Says "Missed reimbursements / protections." Should say: "Experiential discovery — astronomical events, natural phenomena, local cultural events, hidden gems, season-specific experiences not on mainstream tour packages."
**Evidence:** Corrected in April voice narration session. F-6.5.13 Word spec (Product Bible) has the correct definition. Repo was never updated.
**Impact:** Any Cursor prompt touching axis providers will build the wrong thing.
**Fix:** 2-line edit to `docs/DEEP_SCAN_AXIS_DOCTRINE.md` + entry in `lib/MISMATCH_LOG.md`
**Time:** 5 minutes.

### P0-2. Cursor Rules Expansion
**Status:** Three `.mdc` files exist in `.cursor/rules/`. They cover Doctrine §1.9, GO execution, and multi-pass hardening. They do NOT cover:
- Security classification requirement for new tables (T1/T2/T3)
- Replay coverage verification before feature closes
- GDPR/immutability constraints (never delete event_ledger rows, never silent recalculation)
- Field Notes / Budget Intelligence schema constraints (when these are built)
- "Never modify applied migrations" rule
- RLS policy requirement for every new table

**Fix:** Expand `doctrine-1.9-structural-truth.mdc` OR create a new `security-and-data-guardrails.mdc` with these constraints. Both approaches work. I'd recommend a separate file so doctrine stays clean and security stays explicit.

**What to add (draft rules):**
```
- Every new table requires RLS enabled + at least one SELECT policy
- Every new table requires data classification (T1/T2/T3 per §8.2.2)
- T1 fields (passport, health docs) require field-level encryption
- T2 fields (budget, preferences, PII) require RLS + account-scoped access
- Never modify migrations that have been applied to Supabase
- event_ledger rows are append-only — never UPDATE or DELETE
- No silent recalculation — any coverage/alignment change requires user confirmation + event emission
- Every feature must have a feature_registry INSERT before activation
- Check lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md before closing any feature PR
```

---

## PRIORITY 1 — CROSS-REFERENCE AUDITS

### P1-1. Trip Complexity Stress Audit
**What Christian asked for:** Can the platform handle rebooking-heavy trips, dense multi-city itineraries, cruise multi-port journeys, family/group diversions, itineraries with 80 saved places, research-heavy drafts?
**Repo verification findings:**
- `route_segments` table: No MAX constraint on rows per trip. No pagination on queries. Index is `(trip_id, sort_order)` — OK for moderate counts, may degrade at 50+ segments.
- `activity_candidates` table: Same — no row limit, no pagination. 80 saved places would work at the DB level but UI rendering is untested.
- `participant_checklist_items` table: Versioned by `itinerary_version` — each itinerary change creates new rows. A trip with 10 itinerary versions × 20 checklist items = 200 rows. Manageable but needs awareness.
- Coverage graph: `compute_coverage_graph` processes all policies × all benefit types. A trip with 5 policies × 12 benefit types = 60 coverage nodes. Reasonable.
- Deep Scan: Runs per-trip, not per-segment. A 15-city trip runs the same scan as a 2-city trip. The axis connectors execute in the browser — 11 axes × network latency could be slow on complex trips.

**What needs to happen:**
1. Define MAX_SEGMENTS_PER_TRIP, MAX_ACTIVITIES_PER_TRIP, MAX_FIELD_NOTES_PER_TRIP as documented constants
2. Add pagination to route_segments and activity_candidates queries if count > threshold
3. Add a §15.0 stress test scenario: "Dense multi-city trip with 15+ segments, 50+ activities, 3 policies, group of 6"
4. Add a §15.0 stress test scenario: "Cruise multi-port with 8 ports, shore excursion coverage logic, missed port as disruption type"
5. Test Deep Scan connector performance with 15+ destinations (browser-side execution timing)

### P1-2. Trip Mode Audit (Book Mode / Today Mode / Structure Mode)
**What Christian asked for:** Cross-reference repo for book mode, today mode, structure mode — what's confirmed, what's implied, what needs UI only, what needs doctrine/code.

**Repo verification findings:**

| Mode | Concept | Repo Status |
|---|---|---|
| **Structure Mode** (Trip Maturity States) | DRAFT → PRE_TRIP_STRUCTURED → ALIGNMENT_CONFIRMED → BOUND_COVERAGE | IMPLEMENTED. `advance_trip_maturity` RPC exists. States defined in §3.5. Draft Home sub-states implemented. |
| **Today Mode** (Right Now / Contextual Intelligence) | What's happening on this trip right now — disruptions, deadlines, evidence needed, departure imminent | IMPLEMENTED. `lib/context-engine/evaluate.ts` + `RightNowPanel.tsx`. Feature flag `F-6.6.14`. 8 context states defined. |
| **Book Mode** (Accommodation/flight booking) | The ability to search, compare, and book flights/hotels/activities | NOT IMPLEMENTED. No booking API integration. No Amadeus/Booking.com/Skyscanner connector. Deferred. |

**Gap analysis:**
- Structure Mode is solid — §3.5 plus the draft home readiness gate cover the incremental building flow
- Today Mode exists but is limited to trip Overview — no persistent strip across Route/Coverage/Incidents tabs (FLOW-GAP-014)
- Book Mode doesn't exist and depends on external API partnerships (Stay Range Engine, flight search). This is the feature that competes with Layla's live pricing. It should be Phase 2/3 with partner contracts.

### P1-3. Public Health / Disruption Source Priority Audit
**What Christian asked for:** Official source priority rules, traveler state matrix, health event normalization, evidence thresholds for high-stakes recommendations.

**Product Bible verification (Section 3.6 — Passenger Rights & Disruption Resolution Engine):**
- Statutory frameworks ARE encoded: EU261, DOT, Montreal Convention rule tables exist in §3.6
- Disruption Resolution State Machine IS defined: signal_detected → disruption_suspected → disruption_confirmed → offer_pending → offer_evaluated → rights_evaluation_pending → entitlement_likely/uncertain → evidence_gathering → claim_packet_ready → claim_filed → outcome_recorded
- Evidence thresholds are PARTIALLY defined: "at least ONE Evidence object attached" before Review state, evidence checklist by disruption type exists in context engine

**What's NOT defined yet (genuine gaps):**
1. **Official source priority hierarchy** — Which sources outrank which? Government/embassy > carrier > news > social? Not formalized as a doctrine rule.
2. **Health event normalization** — Pandemic, quarantine, vaccination requirement changes. No normalized internal states for health-specific disruptions. The `cultural_restrictions` table handles cultural events (Nyepi, Ramadan) but not WHO/CDC health advisories.
3. **Evidence thresholds for high-stakes recommendations** — When can the platform say "shelter in place" vs "wait for more info"? The Response Priority Ladder (safety > stabilization > continuity > documentation > coverage) is conceptually agreed but not encoded as testable rules.
4. **Traveler operational state** — pre-trip / en-route / airside / in-country / stranded / sheltering. This is discussed in the ChatGPT conversation and our March session but doesn't exist as a schema field on incidents.

### P1-4. Artifact Audit (Prior Session Outputs)
**What Christian asked for:** Check all artifacts from prior sessions — some contain information not yet implemented, some may be outdated.

**Known artifacts with implementation status:**
| Artifact | Session | Status |
|---|---|---|
| GovernanceTrustPanel_v2.jsx | March session | BUILT as prototype. Not in production routes. Deep Scan signal description corrected. |
| FOCL Cockpit v1-v7 | March session | Prototypes exist. FOCL pages in repo are different implementation. |
| Section 12.4 Feature Flag & Activation Lifecycle (docx) | March session | SPEC COMPLETE. Implemented via migrations (feature_registry, activation_state, set_feature_activation_state RPC). |
| F-6.5.13 Deep Scan Intelligence Engine (docx) | April session | SPEC in Product Bible. Axis 5 correction documented but NOT applied to repo. |
| Passenger Rights & Resolution State Machine (docx) | March session | SPEC COMPLETE as §3.6 in Product Bible. Partially implemented (routing_recommendations table exists, state machine not fully encoded in code). |
| Checklist Screen Family Specification (docx) | April session | SPEC COMPLETE (project file). M25 migration exists for participant_checklist_items. Page routes NOT built yet. |
| Onboarding voice narration system artifacts | April session | Voice parse route IMPLEMENTED with Zod schemas, model routing, 7 context types. Onboarding rounds work. |
| Trip Requirements Checklist polished JSX | April ChatGPT | Prototype only. Not integrated with repo component system. |
| New Feature Cross-Reference Analysis (md) | This session | CURRENT. Updated with repo verification. |

### P1-5. Traveler Composition Audit
**Status:** GROUP AUTHORITY EXISTS. COMPOSITION MODEL DOES NOT.
**What exists:** group_participants (organizer/participant roles, residence codes), guardian/minor dual consent, relationship verification, blocked relationships, export authorization. Strong group permission infrastructure.
**What's missing:** No adults_count/children_count/infant_count on trips. No child_ages. No age_band on participants. No vulnerable_traveler_flags. No composition-aware budget, checklist, or incident reasoning. Trip creation UI has no party composition input.
**Impact:** Budget logic ignores adult/child pricing. Checklist doesn't generate minor-specific requirements. Incident reasoning treats "solo adult" and "parent with 3 children" identically.
**Fix:** Add composition fields to trips table + age_band/traveler_role/support_flags to group_participants. Wire into checklist generation, context engine, and future Budget Intelligence.
**Full audit details:** See `Supplemental_Audit_Results.md` Audit 1.

### P1-6. Location Certainty Audit
**Status:** DEVICE GPS EXISTS. CERTAINTY MODEL DOES NOT.
**What exists:** `lib/presence/location-service.ts` (GPS watch, battery-aware), reverse geocode via Nominatim, Trip Presence panel.
**What's missing:** No manual home/base location. No location_source enum (device_gps/manual/ip_inferred/traveler_reported). No location correction UX. No distinction between confirmed and inferred location.
**Doctrine:** Never present inferred location as confirmed fact.
**Fix:** Add home_location fields to user_profiles. Add location_source + location_certainty to presence snapshots. Build "This isn't where I am" correction flow.
**Full audit details:** See `Supplemental_Audit_Results.md` Audit 3.

### P1-7. Cruise / Multi-Port First-Class Trip Audit (SEPARATED FROM P1-1)
**Status:** GENERIC MULTI-DESTINATION WORKS. CRUISE-SPECIFIC DOES NOT.
**What exists:** route_segments with multiple segments per trip. Cruise-related phrase clusters in document-intelligence.
**What's missing:** No cruise segment types (embark/port_call/disembark). No shore excursion activity type with coverage implications. No cruise-specific disruption types (missed_port, medical_evacuation_at_sea, quarantine_at_sea). No passenger cruise contract parsing. No port-call-duration-aware checklist generation.
**Fix:** Deferred but documented as its own backlog item. When built: segment_type expansion, cruise disruption types, shore excursion coverage logic, port-of-call checklist generation.
**Full audit details:** See `Supplemental_Audit_Results.md` Audit 4.

### P1-8. Live Trip vs History / Evidence Audit
**Status:** BACKEND SOLID. TRAVELER-FACING "WHAT CHANGED" MISSING.
**What exists:** Immutable snapshots (§3.5.3), append-only event ledger, versioned routing recommendations with ITR trace, policy lifecycle states (active/superseded/archived), archive_trip RPC.
**What's missing:** No "what changed" traveler-facing surface. No version timeline UI for policies and recommendations. No "active truth vs superseded truth" visual distinction. No "evidence-only trip state" UX treatment.
**Fix:** Add "Trip History" panel showing maturity transitions, policy changes, recommendation versions, and alignment status changes in plain language. This is Decision Replay for travelers.
**Full audit details:** See `Supplemental_Audit_Results.md` Audit 5.

### P1-9. Context Engine Phase-Awareness Enhancement
**Status:** ENGINE IS GOOD. NEEDS MATURITY-STATE-AWARE BRANCHES.
**What exists:** 8 context states, deterministic rule engine, RightNowPanel on 7 pages, Trip Presence with GPS + cultural/border/visa alerts. Feature-flagged.
**What to add:** DRAFT-aware planning nudges (not a new mode — a branch in evaluate.ts). Readiness-aware pre-trip context. Trip Presence integration with context engine during active trips.
**What NOT to do:** Don't make it more prevalent. Don't create new floating widgets. Don't add LLM inference. Don't duplicate RightNowPanel everywhere.
**Assessment:** The engine is your differentiator. Layla doesn't have it. The fix is refinement, not expansion.
**Full audit details:** See `Supplemental_Audit_Results.md` Audit 2.

---

## PRIORITY 2 — NEW FEATURE SPECS (using existing FEATURE_FULLSTACK_BINDING_TEMPLATE.md)

### P2-1. Field Notes (F-6.7.1) — Saved Intelligence Layer
Full binding draft needed. Touch points verified in Part 6 of cross-reference analysis.

### P2-2. Trip Spark (F-6.7.2) — Clustering → Trip Draft Engine
Full binding draft needed. Depends on Field Notes schema.

### P2-3. Budget Intelligence (F-6.7.3) — Category-Level Spend Model
Full binding draft needed. Lives in user_profiles.preferences JSONB.

### P2-4. Preference Memory (F-6.7.4) — Persistent Structured Profile Memory
Full binding draft needed. Extends existing SignalProfile + voice artifacts.

---

## PRIORITY 3 — DOCTRINE ADDENDA

### P3-1. Operational Options Ranking Doctrine
Addendum to F-6.5.8. Deterministic priority ladder. Evidence threshold matrix. Authority event normalization rules. "Monitor and reevaluate" recommendation type.

### P3-2. Source Priority Hierarchy Doctrine
Formalize: (1) official government/authority/embassy/carrier, (2) platform-uploaded traveler evidence, (3) trusted structured feeds, (4) reputable news, (5) social signals (never decisive alone).

### P3-3. Health Event Normalization Rules
Define internal states for: pandemic advisory, quarantine requirement, vaccination requirement change, health infrastructure disruption. Map to incident creation triggers and checklist generation.

### P3-4. Traveler Operational State Schema
Add `traveler_operational_state` to incidents: pre_trip, en_route_to_airport, airside, in_country, stranded, sheltering, group_with_minors. Reasoning layer uses this to determine option ranking.

---

## PRIORITY 4 — INFRASTRUCTURE / SCALING

### P4-1. Coverage Intelligence Loop (Revenue Pathway)
Document as named revenue pathway. Field Notes → Trip Spark → Budget Intelligence → Coverage Gap Engine → Plan Recommendation → Affiliate → Auto-Attach → Coverage Graph recompute.

### P4-2. Stay Range Engine (Accommodation Pricing)
Requires external API partner (Booking.com Demand API or Amadeus). MVP: curated regional cost index. Phase 2: live API.

### P4-3. Readiness Lab (Scenario Simulation)
Post-launch feature. Requires incident pipeline in simulation mode. Credit-based. FOCL feedback loop.

### P4-4. Travel Archive (Year-End Recap)
Post-launch subscriber retention feature. Archive, don't delete.

---

## PRIORITY 5 — COMPETITIVE POSITIONING

### P5-1. Layla/Wanderlog/Mindtrip Competitive Moat Map
Maintain as living document. Update quarterly. Focus on what's commodity vs what's differentiated.

### P5-2. Launch Narrative
"Save anything. Speak naturally. Turn saves into trips. Build around exact budget rules. Import PDFs/screenshots into itinerary structure. Get source-backed recommendations. See what's missing before you book."

### P5-3. "Tested Trust" Marketing Concept
Readiness Lab + Decision Replay + Governance Trust Panel = "The only travel platform you can test before you need it, trust while you're using it, and verify after the fact."

---

## CROSS-CUTTING NOTES

**Feature Intake Process:** Already exists at `lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md`. Every new feature above uses this template. No new process needed.

**Cursor Guardrails:** Already exist at `.cursor/rules/`. Need expansion (P0-2 above).

**FOCL Registration:** Every new feature gets a feature_registry INSERT, default off, with activation prerequisites documented.

**Security Classification:** Every new table gets T1/T2/T3 classification per §8.2.2.

**Replay Coverage:** Every feature must confirm replay coverage before closing — add to preflight checklist if not already there.

**Immutability:** event_ledger is append-only. No migration may ALTER or DELETE from it. Coverage snapshots are immutable at alignment confirmation, policy bind, incident initiation, and claim packet generation (§3.5.3).

---

*Last updated: April 2026 — Consolidated from ChatGPT conversation, repo verification, Product Bible audit, and all prior Claude sessions.*
