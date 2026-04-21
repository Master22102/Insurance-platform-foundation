# WAYFARER PLATFORM — DEFINITIVE SESSION DELIVERABLE
# Complete Audit, Cross-Reference, Gap Analysis & Priority Queue

**April 13, 2026 · Single Source of Truth for This Session**
**Inputs:** ChatGPT conversation (110 pages), updated_repo.zip (158 migrations, 53 E2E specs, 81 API routes), Product Bible (documentation.zip, 40 docs), Checklist Screen Family Spec, traveler composition audit, contextual engine analysis, cruise/multi-port analysis, all prior Claude sessions.

---

# TABLE OF CONTENTS

1. [P0 — Fix Before Any New Prompts](#p0)
2. [P1 — Cross-Reference Audits](#p1)
3. [P2 — New Feature Specs](#p2)
4. [P3 — Doctrine Addenda](#p3)
5. [P4 — Infrastructure & Revenue](#p4)
6. [P5 — Competitive & Marketing](#p5)
7. [Hidden Value Discoveries](#hidden-value)
8. [What ChatGPT Got Right vs Wrong](#chatgpt-verdict)
9. [Terminology Lock](#terminology)

---

<a name="p0"></a>
# PRIORITY 0 — FIX BEFORE ANY NEW PROMPTS

These must be done first. Any Cursor prompt written before these are fixed risks building on incorrect assumptions.

## P0-1. Deep Scan Axis 5 Doctrine Mismatch
- **File:** `docs/DEEP_SCAN_AXIS_DOCTRINE.md`, Axis 5 row
- **Current (WRONG):** "Missed reimbursements / protections"
- **Correct:** "Experiential discovery — astronomical events, natural phenomena, local cultural events, hidden gems, season-specific experiences not on mainstream tour packages"
- **Why it matters:** Any Cursor prompt touching axis providers will build insurance gap detection instead of experiential discovery. Axis 2 (`coverage_itinerary_match`) already handles coverage gaps correctly.
- **Evidence:** Corrected in April voice narration session. F-6.5.13 Word spec has correct definition. Repo never updated.
- **Fix:** 2-line edit + `lib/MISMATCH_LOG.md` entry. 5 minutes.

## P0-2. Cursor Rules Expansion
- **Current state:** 3 `.mdc` files exist in `.cursor/rules/` covering Doctrine §1.9, GO execution, and multi-pass hardening.
- **Missing constraints:** Security classification for new tables (T1/T2/T3 per §8.2.2), RLS requirement for every new table, GDPR immutability (never delete event_ledger rows, never silent recalculation per §3.5.4), "never modify applied migrations" rule, replay coverage verification, feature_registry INSERT required before activation.
- **Fix:** Create `.cursor/rules/security-and-data-guardrails.mdc` with these constraints. Keep separate from doctrine file for clarity.

---

<a name="p1"></a>
# PRIORITY 1 — CROSS-REFERENCE AUDITS

## P1-1. Trip Complexity Stress Audit

**Question:** Can the platform handle rebooking-heavy trips, dense multi-city, 80 saved places, group diversions, split itineraries?

**Repo findings:**
| Component | Limit | Risk |
|---|---|---|
| `route_segments` per trip | No MAX constraint, no pagination | 50+ segments may degrade query + UI |
| `activity_candidates` per trip | No MAX constraint, no pagination | 80 saved places works at DB level, untested in UI |
| `participant_checklist_items` | Versioned by itinerary_version — each change creates new rows | 10 versions × 20 items = 200 rows. Manageable but grows fast. |
| Coverage graph | All policies × all benefit types per trip | 5 policies × 12 types = 60 nodes. Reasonable. |
| Deep Scan axis connectors | Execute in browser, 11 axes × network latency | 15-destination trip = slow. Untested at scale. |

**What needs to happen:**
1. Define `MAX_SEGMENTS_PER_TRIP` (suggest 50), `MAX_ACTIVITIES_PER_TRIP` (suggest 100) as documented constants
2. Add pagination to route_segments and activity_candidates queries beyond threshold
3. Add §15.0 stress test: "Dense multi-city trip with 15+ segments, 50+ activities, 3 policies, group of 6"
4. Test Deep Scan connector performance with 15+ destinations

## P1-2. Trip Mode Audit

**Question:** What are the platform's trip modes, what's confirmed, what's implied, what needs building?

| Mode | Definition | Repo Status | What Exists | What's Missing |
|---|---|---|---|---|
| **Structure Mode** | Trip building: DRAFT → STRUCTURED → CONFIRMED → BOUND | IMPLEMENTED | `advance_trip_maturity` RPC, §3.5 states, Draft Home sub-states, readiness gate | Nothing critical |
| **Today Mode / Right Now** | Live-trip contextual intelligence | IMPLEMENTED | `evaluate.ts` (8 states), `RightNowPanel` (7 pages), Trip Presence (GPS + alerts) | DRAFT-aware nudges, readiness-aware pre-trip context, Trip Presence + context engine merge during active trips |
| **Book Mode** | Live pricing, accommodation search, booking | NOT BUILT | Nothing | Requires partner API contracts (Amadeus, Booking.com). Phase 2/3. |
| **Disruption Mode** | Active incident handling | IMPLEMENTED | Incident state machine (§3.1), F-6.5.4, F-6.5.8, routing recommendations | Ranking doctrine, evidence thresholds, authority event normalization |
| **Archive Mode** | Post-trip evidence and history | IMPLEMENTED | `archive_trip` RPC, ARCHIVED maturity state, event ledger | "What changed" traveler surface, version timeline UI |

**Context Engine Assessment:** The engine is already good and should NOT be expanded to more surfaces. It should be made phase-aware by adding maturity-state branches to `evaluate.ts`. The 5-story framework (planning → booked → travel day → during trip → disruption) maps to existing infrastructure — the fix is refinement, not new architecture.

## P1-3. Public Health / Source Priority Audit

**What exists in Product Bible:**
- EU261/DOT/Montreal Convention statutory rule tables (§3.6) ✓
- Disruption Resolution State Machine with 11 states (§3.6) ✓
- Evidence requirements per incident state (context engine) ✓

**What's missing:**
| Gap | Impact | Priority |
|---|---|---|
| Official source priority hierarchy (government > carrier > news > social) | Reasoning layer may weight unreliable sources equally with official ones | HIGH — needed before reasoning doctrine |
| Health event normalization (pandemic, quarantine, vaccination changes) | No internal states for health-specific disruptions. cultural_restrictions handles Nyepi/Ramadan but not WHO/CDC advisories | MEDIUM — needed for international travel completeness |
| Evidence thresholds for high-stakes recommendations | When can platform say "shelter in place" vs "wait"? Priority ladder agreed but not encoded as rules | HIGH — needed for trustworthy disruption guidance |
| Traveler operational state on incidents | No pre_trip/en_route/airside/in_country/stranded/sheltering field | HIGH — reasoning quality depends on knowing traveler's current situation |

## P1-4. Artifact Audit (Prior Session Outputs)

| Artifact | Session | Status | Action |
|---|---|---|---|
| GovernanceTrustPanel_v2.jsx | March | Prototype. Not in production routes. | Keep as reference for future FOCL integration |
| FOCL Cockpit v1-v7 | March | Prototypes. FOCL pages in repo are different. | Reference only — repo FOCL is canonical |
| Section 12.4 spec (docx) | March | SPEC COMPLETE. Implemented in migrations. | Closed |
| F-6.5.13 Deep Scan spec (docx) | April | In Product Bible. Axis 5 correction NOT applied to repo. | FIX — P0-1 |
| §3.6 Passenger Rights Engine (docx) | March | SPEC COMPLETE in Bible. Partial implementation. | Routing recommendations table exists, state machine not fully encoded |
| Checklist Screen Family Spec (docx) | April | SPEC COMPLETE. M25 migration exists. Page routes NOT built. | Needs Cursor prompts for Screen 1/2/3 |
| Voice narration system artifacts | April | IMPLEMENTED. Voice parse route with Zod, model routing, 7 contexts. | Closed |
| Polished checklist JSX (ChatGPT) | April | Prototype only. Not integrated. | Reference for visual direction |

## P1-5. Traveler Composition Audit

**What EXISTS (strong):**
- `group_participants` table — organizer/participant roles, residence codes, RLS
- Guardian/minor dual consent — guardian_id, requires_dual_approval, subject/guardian approval
- Relationship verification — request/approval flow with trip_type awareness
- Blocked relationships — 3 denied in 30 days → 90-day block
- Export authorization grants — subject/guardian grant/revoke RPCs
- Signal profile companion detection — heuristic categorization of solo/group/family/couple

**What DOES NOT exist (the gap):**
- No `adults_count` / `children_count` / `infant_count` on trips table
- No `child_ages` array
- No `age_band` on group_participants (only 'organizer' or 'participant' roles)
- No `vulnerable_traveler_flags` (medical_sensitive, mobility_restricted)
- No party composition input on trip creation UI
- No composition-aware budget, checklist, or incident reasoning
- No family/group presets on user profile

**Assessment:** Strong permission infrastructure, weak composition model. Group authority handles "who can do what." It doesn't understand "who is actually traveling." Fix: schema addition to trips + group_participants, then wire into checklist, context engine, Budget Intelligence.

**Recommended schema:**
```sql
-- trips table:
adults_count integer DEFAULT 1,
children_count integer DEFAULT 0,
infant_count integer DEFAULT 0,
child_ages integer[] DEFAULT '{}',
composition_notes text

-- group_participants (new columns):
age_band text CHECK (IN ('adult','child_13_17','child_6_12','child_under_6','infant')),
traveler_role text CHECK (IN ('primary','companion','minor','guardian','chaperone','organizer')),
support_flags text[] DEFAULT '{}'
```

**Where composition must flow:**
Trip creation UI, Budget Intelligence, checklist generation (age × destination), incident reasoning, activity eligibility (age minimums), readiness pins (minor-specific items), Deep Scan Axis 2 (child/infant coverage gaps), Stay Range Engine (occupancy-aware pricing).

## P1-6. Location Certainty Audit

**What EXISTS:** Device GPS watch (`lib/presence/location-service.ts` — battery-aware, accuracy field), reverse geocode via Nominatim, Trip Presence panel, middleware `geolocation=(self)`.

**What DOES NOT exist:**
- No manual home/base location on user_profiles
- No `location_source` enum (device_gps / manual_entry / ip_inferred / traveler_reported)
- No `location_certainty` enum (confirmed / approximate / stale / unknown)
- No location correction UX ("This isn't where I am")
- No distinction between confirmed and inferred location in any surface

**Doctrine rule:** Never present inferred location as confirmed fact. This is the exact problem Christian's friend experienced with Layla (showed Washington instead of Michigan).

**Fix:** Add `home_location_*` fields to user_profiles. Add `location_source` + `location_certainty` to presence snapshots. Build correction flow.

## P1-7. Cruise / Multi-Port First-Class Trip Audit

**What EXISTS:**
- `route_segments` with unconstrained `segment_type` text field (default 'flight')
- Trip detail page normalizer maps 'sea'/'ferry'/'cruise' → ferry icon — basic UI awareness exists
- `TRAVEL_MODES` array includes 'sea' as a mode option
- Cruise-related phrase clusters in document-intelligence (cruise_cancellation_window clause type)
- Cruise cancellation mapped to trip_cancellation benefit_type in extraction bridge

**What DOES NOT exist:**
- No trip_type enum (standard_air_hotel / cruise_multi_port / rail_journey / guided_tour)
- No cruise-specific segment types (embark / port_of_call / sea_day / disembark)
- No voyage-level fields (operator, embarkation/disembarkation ports/times, cabin type, booking reference)
- No port/stop object with arrival/departure windows, jurisdiction, excursion linkage
- No excursion object (ship-sponsored vs independent, refundability, meet time, port linkage)
- No cruise disruption types (missed_embarkation, missed_port, port_skipped_by_operator, medical_event_at_sea, traveler_left_behind_in_port, itinerary_resequence_by_operator)
- No port-of-call-duration-aware checklist generation (6-hour port call ≠ 3-night stay)
- No cruise-specific context engine rules (next port cutoff, on-ship vs in-port state, missed return = critical incident)
- No cruise UI layout (voyage overview, port cards, sea-day markers)
- No passenger cruise contract as corpus document type

**Assessment:** The platform can technically handle a cruise as a series of generic segments, but it doesn't understand cruise-specific concepts. This matters because cruises expose whether the trip model is a flexible travel graph or just a flight/hotel itinerary with extras bolted on.

**Status:** Deferred but broken out as its own backlog item. When prioritized, needs: trip_type enum, voyage schema, port/stop objects, excursion objects, cruise disruption types, checklist hooks, context engine rules, dedicated UI layout, and a §15.0 stress test (8 ports, 3 excursions, one missed embarkation risk, one skipped port, one delayed arrival, one canceled excursion).

## P1-8. Live Trip vs History / Evidence Audit

**What EXISTS (backend solid):**
- Immutable snapshots at alignment confirmation, policy bind, incident initiation, claim packet generation (§3.5.3)
- Append-only event ledger with replay capability
- Versioned routing recommendations with ITR trace IDs
- Policy lifecycle states: active / superseded / archived
- `archive_trip` RPC — blocks archiving with open claims, emits events

**What DOES NOT exist (traveler-facing gap):**
- No "active truth vs superseded truth" visual distinction in UI
- No "what changed" traveler surface (event ledger has the data, no UI presents it)
- No version timeline UI for policies and recommendations
- No "evidence-only trip state" UX treatment (post-archive, claim still processing)

**Fix:** "Trip History" panel on trip detail showing maturity transitions, policy lifecycle changes, recommendation versions, and alignment changes in plain language. This is Decision Replay for travelers — the same capability FOCL has, translated for non-technical users.

## P1-9. Context Engine Phase-Awareness Enhancement

**What EXISTS (strong):** 8 deterministic context states, rule-based `evaluate.ts` (59 functions), `RightNowPanel` on 7 pages, Trip Presence with GPS + cultural/border/visa/activity zone alerts, user preference toggles, feature-flagged (F-6.6.14).

**What to ADD:**
1. DRAFT-aware planning nudges — when maturity_state = DRAFT, surface: "Missing dates for Deep Scan." "No coverage attached." "3 readiness items incomplete." This is a new branch in `evaluate.ts`, NOT a new surface.
2. Readiness-aware pre-trip context — when PRE_TRIP_STRUCTURED + departure > 7 days, surface readiness gaps via context engine (not just readiness pins page).
3. Trip Presence + context engine merge — during active trip, unify RightNowPanel and TripPresencePanel signals.

**What NOT to do:** Don't make the engine more prevalent. Don't create new floating widgets. Don't add LLM inference. Don't duplicate RightNowPanel. The engine is a differentiator — make it smarter, not louder.

---

<a name="p2"></a>
# PRIORITY 2 — NEW FEATURE SPECS

All specs use existing `lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md`. Each must include: §7.3 surface registry, feature_registry INSERT, §10.2 entitlement binding, §3.0 governance emissions, §8.4 RLS, security classification (T1/T2/T3), replay coverage confirmation.

## P2-1. Field Notes (F-6.7.1) — Saved Intelligence Layer

**What it is:** Structured save layer for platform discoveries and imported external content as tagged, destination-anchored planning objects.

**Connects to (verified in repo):**
- Creator Discovery (F-6.6.11) — `video_location_tags`, `video_activity_extractions` → Field Note source_type = 'creator_video'
- Deep Scan Axis 5 — Save action on positive signals → Field Note source_type = 'deep_scan_signal'
- Signal Capture voice — `venue_intents` in catch bucket → generalize to Field Notes
- Activity Suggestions — Field Notes surface alongside activity_candidates with "From your Field Notes" badge
- Onboarding signal profile — `SignalProfile.places` seeds initial Field Notes

**Net-new needed:** `field_notes` table, import normalizer service (URL → structured metadata), FOCL management surface.
**Security:** T2 (user data), T3 (imported URL metadata). RLS account-scoped. Sanitize imported content.

## P2-2. Trip Spark (F-6.7.2) — Clustering → Trip Draft

**What it is:** When saved Field Notes cluster geographically, system detects concentration and offers to convert to trip draft.

**Connects to:** Trip Draft Engine (existing RPCs), readiness gate, participant checklist (M25), Deep Scan Axis 5 (pre-scan query on clustered region — new capability).

**Net-new needed:** Clustering algorithm, trip-worthiness scoring, duration estimation, missing-category detection, "build a trip from this" UI prompt.

## P2-3. Budget Intelligence (F-6.7.3) — Category-Level Spend Model

**What it is:** Persistent budget preferences at category level stored in `user_profiles.preferences` JSONB.

**Fields:** lodging_per_night_cap, lodging_splurge_ceiling, lodging_splurge_frequency, food_daily_comfort, activity_daily_comfort, flight_pain_threshold, train_vs_flight_bias, total_daily_target, solo_vs_group_mode, domestic_vs_international_mode.

**Connects to:** Voice parse (budget_signal extraction across all contexts), per-trip unlock model (budget + Trip Spark = conversion moment), context engine (destination over/under budget nudges).
**Security:** T2 (financial preferences). Field-level encryption on hard caps. RLS account-scoped.

## P2-4. Preference Memory (F-6.7.4) — Persistent Profile Memory

**What it is:** Three-layer memory (session, trip, profile) capturing repeated preferences.

**Connects to:** Voice artifacts table (raw input storage exists), signal profile (onboarding = seed layer), incident preference_context (post-incident promotion to profile), Deep Scan modes (inferred scan mode from accumulated preferences).

**Net-new needed:** Typed preference schema beyond SignalProfile, confirmation UX for preference promotion, session/trip/profile layer separation.

---

<a name="p3"></a>
# PRIORITY 3 — DOCTRINE ADDENDA

## P3-1. Operational Options Ranking Doctrine
Addendum to F-6.5.8. Deterministic priority ladder encoded as rules (not LLM inference):
1. Life safety → 2. Stabilization → 3. Continuity/logistics → 4. Documentation → 5. Financial/coverage optimization.
Evidence threshold matrix: LOW (document now), MEDIUM (wait for more info), HIGH (shelter in place), STRICTEST (quasi-legal determination). Authority event normalization: convert raw signals to canonical states (airport_closed, border_closed, curfew_active, transport_suspended, etc.). "Monitor and reevaluate" recommendation type with review timer.

## P3-2. Source Priority Hierarchy Doctrine
Formalize: (1) official government/authority/embassy/carrier → (2) platform-uploaded traveler evidence → (3) trusted structured feeds → (4) reputable news → (5) social signals (never decisive alone).

## P3-3. Health Event Normalization Rules
Internal states for: pandemic_advisory, quarantine_requirement, vaccination_change, health_infrastructure_disruption. Map to incident triggers and checklist generation.

## P3-4. Traveler Operational State Schema
Add `traveler_operational_state` to incidents: pre_trip, en_route_to_airport, airside, in_country, stranded, sheltering, group_with_minors. Reasoning layer uses this for option ranking.

---

<a name="p4"></a>
# PRIORITY 4 — INFRASTRUCTURE & REVENUE

## P4-1. Coverage Intelligence Loop (Revenue Pathway)
**The hidden discovery from this session.** The intersection of Field Notes + Trip Spark + Budget Intelligence + the Pre-Trip Coverage Gap Engine creates a revenue pipeline no competitor has:

Save inspiration → cluster by destination → estimate cost against budget → identify coverage gaps for this specific trip profile → recommend plan → affiliate sale → auto-attach policy → coverage graph recomputes.

This should be documented as a named revenue pathway. FOCL should surface conversion metrics at each step. The Feature Registry should show the dependency chain.

**Why it matters:** Layla builds trips. You build trips AND sell the protection for them, with the entire inspiration-to-coverage path inside your platform.

## P4-2. Stay Range Engine — Accommodation Pricing
Requires external API partner (Booking.com Demand API or Amadeus). MVP: curated regional cost index (FOCL-managed table). Phase 2: live API. Depends on Budget Intelligence being built first.

## P4-3. Readiness Lab — Scenario Simulation
Post-launch. Credit-based. Uses production incident pipeline with `simulation: true` flag — no notifications, no ledger events, no claims. Debrief shows what real platform would have done. FOCL feedback loop captures user concerns. Requires incident pipeline + coverage graph + routing recommendations all working.

## P4-4. Travel Archive — Year-End Recap
Post-launch subscriber retention feature. Countries explored, cities planned vs traveled, budget patterns, disruptions handled. Archive, don't delete. Premium retention tiers.

---

<a name="p5"></a>
# PRIORITY 5 — COMPETITIVE & MARKETING

## P5-1. Competitive Moat Map
Layla, Wanderlog, Mindtrip, TripIt, Roadtrippers, Google Travel. Maintain as living document. AI itinerary generation is commodity. Your moat: voice-first + saved intelligence clustering + category-level budget + source-backed reasoning + readiness/protection-aware planning + contextual engine (GPS + cultural alerts).

## P5-2. Launch Narrative
"Save anything. Speak naturally. Turn saves into trips. Build around exact budget rules. Import PDFs/screenshots into itinerary structure. Get source-backed recommendations. See what's missing before you book."

## P5-3. "Tested Trust" Marketing Concept
Readiness Lab + Decision Replay + Governance Trust Panel = "The only travel platform you can test before you need it, trust while you're using it, and verify after the fact."

---

<a name="hidden-value"></a>
# HIDDEN VALUE DISCOVERIES

## 1. The Coverage Intelligence Loop
(See P4-1 above.) Wasn't intentionally designed as a single feature. Created by the intersection of Field Notes + Trip Spark + Budget Intelligence + Coverage Gap Engine. No competitor has this. Major revenue and positioning implication.

## 2. The Trust Compound Effect
Readiness Lab (test before you need it) + Decision Replay (see why it told you what it told you) + Governance Trust Panel (platform integrity visible) = "Tested Trust." Users who have run a simulation before a real disruption will trust the platform's real-time guidance because they've already seen it work. This is the retention moat.

## 3. Contextual Engine as Differentiator
The combination of Trip Presence (GPS, cultural restriction alerts, border crossing detection, activity zone alerts, missed connection alerts) with the contextual intelligence engine (maturity-state-aware, disruption-aware, evidence-gap-aware, filing-deadline-aware) is genuinely unique in the consumer travel space. No competitor has anything comparable. The fix is refinement (phase-aware branches), not expansion.

---

<a name="chatgpt-verdict"></a>
# WHAT CHATGPT GOT RIGHT VS WRONG

## Right
- Competitive analysis (Layla, Wanderlog, Mindtrip, TripIt, Roadtrippers) — accurate and fair
- AI itinerary generation is becoming commodity — correct
- Positioning advice (don't out-Layla Layla, win on readiness/protection/memory) — solid
- Field Notes / saved intelligence concept — strong and genuinely new
- Trip Spark clustering → trip draft — differentiated, worth building
- Category-level budget intelligence — real opening against Layla's general buckets
- Readiness Lab / scenario simulation — strong trust-building feature
- Annual travel recap — good subscriber retention

## Wrong or Overstated
- "No traveler composition model" — WRONG. Group authority infrastructure is strong (guardian consent, relationship verification, blocked relationships). The gap is narrower: no age-aware party structure on trips.
- "No confirmed location model" — PARTIALLY WRONG. Device GPS exists with battery awareness. Gap is certainty model (no source/certainty enum, no correction UX).
- "Incident auto-trigger doesn't exist" — WRONG. F-6.5.4, F-6.5.8, Deep Scan Axis 11 cover this. Gap is signal-to-incident bridge normalization.
- "PDF/screenshot-to-itinerary is missing" — WRONG. policy-extraction-worker exists, screenshot as source type supported. Gap is surfacing as user-facing feature.
- "Voice is only onboarding" — WRONG. 7 voice contexts wired through `voice/parse/route.ts`. Gap is persistent preference memory.
- "Feature Change Intake Template missing" — WRONG. `lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md` exists with 11-category binding checklist. "Silence is not compliance" is literally in it.
- "No Cursor guardrails" — WRONG. 3 `.mdc` files exist. Gap is security/GDPR/RLS constraints.
- Never mentioned FOCL once in 110 pages — major blind spot. FOCL is the operational spine.

---

<a name="terminology"></a>
# TERMINOLOGY LOCK

| Term | Definition | Repo Equivalent |
|---|---|---|
| **Structure Mode** | Trip building and readiness flow | Trip maturity states (§3.5) — DRAFT through BOUND_COVERAGE |
| **Today Mode / Right Now** | Live-trip contextual intelligence | Context engine (`evaluate.ts`) + RightNowPanel + Trip Presence |
| **Book Mode** | Live pricing, accommodation search, booking | NOT BUILT. Future Stay Range Engine + partner APIs |
| **Disruption Mode** | Active incident handling | Incident state machine (§3.1) + F-6.5.4/F-6.5.8 |
| **Archive Mode** | Post-trip evidence and history | archive_trip RPC + ARCHIVED maturity state |
| **Planning Intelligence** | DRAFT-state contextual nudges | Context engine enhancement — DRAFT-aware branch in evaluate.ts |
| **Readiness Intelligence** | Pre-departure contextual alerts | Context engine `pre_trip` state + readiness pins |
| **Field Notes** | Saved intelligence layer | New feature (F-6.7.1) — not built |
| **Trip Spark** | Clustering → trip draft engine | New feature (F-6.7.2) — not built |
| **Budget Intelligence** | Category-level spend model | New feature (F-6.7.3) — not built |
| **Preference Memory** | Persistent structured profile memory | New feature (F-6.7.4) — not built |
| **Stay Range Engine** | Accommodation cost estimation | New feature (F-6.7.5) — not built, needs API partner |
| **Readiness Lab** | Credit-based scenario simulation | New feature (F-6.7.6) — not built, post-launch |
| **Decision Replay** | Evidence-backed explanation layer | Cross-cutting requirement, NOT a standalone module |
| **Coverage Intelligence Loop** | Revenue pathway: saves → cluster → budget → gap → recommend → sell | Emergent property of F-6.7.1 through F-6.7.3 + coverage gap engine |
| **Tested Trust** | Marketing concept for compound trust effect | Readiness Lab + Decision Replay + Governance Trust Panel |

---

# CROSS-CUTTING RULES

**Feature Intake:** `lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md` — every new feature uses this. No new process needed.

**Cursor Guardrails:** `.cursor/rules/*.mdc` — need expansion (P0-2). Always-on constitutional binding exists.

**FOCL Registration:** Every new feature gets `feature_registry` INSERT, default off, activation prerequisites documented in FOCL descriptor.

**Security Classification:** Every new table classified T1/T2/T3 per §8.2.2. T1 = field-level encryption. T2 = RLS + account-scoped. T3 = RLS enabled.

**Replay Coverage:** Every feature confirms replay coverage before closing. Evidence-linked assertions. Immutable snapshots at key decision points.

**Immutability:** `event_ledger` append-only — never UPDATE or DELETE. Coverage snapshots immutable at alignment confirmation, policy bind, incident initiation, claim packet generation (§3.5.3). No silent recalculation — ever.

**Voice Model Routing:** Haiku for simple/low-ambiguity. Sonnet for complex/ambiguous/high-stakes. Reasoning layer is deterministic rules, NOT LLM inference.

**Platform Completion:** ~58% overall, ~72% infrastructure, ~52% experience, ~61% production readiness (per System Truth Hierarchy doc).

---

*This document replaces: New_Feature_Cross_Reference_Analysis.md, Consolidated_Master_ToDo.md, and Supplemental_Audit_Results.md as the single session deliverable.*

*Verified against: updated_repo.zip (158 migrations, 53 E2E specs, 81 API routes, 16 FOCL pages, 47 corpus docs), Product Bible (40 docs), Checklist Screen Family Spec, and all prior Claude sessions.*

*Next session: Upload repo → P0-1 (5 min fix) → P0-2 (Cursor rules) → P1 audits in order → P2 feature specs using existing binding template.*
