# WAYFARER PLATFORM
# New Feature Cross-Reference Analysis & Hidden Value Discovery

**Version 1.0 · April 2026**
**Scope:** Cross-reference of proposed new features (Field Notes, Trip Spark, Budget Intelligence, Preference Memory, Stay Range Engine, Readiness Lab) against existing platform documentation, architecture, and feature set.

---

## EXECUTIVE SUMMARY

After reading the full ChatGPT conversation (110 pages), the Checklist Screen Family Specification, and cross-referencing against all prior Claude sessions covering the codebase, feature specs, Product Bible sections, migrations, and FOCL architecture, this document identifies:

- **7 genuine integration points** where new features connect to existing infrastructure
- **4 gaps** where existing documentation doesn't cover what the new features need
- **3 expansion opportunities** where a new feature amplifies an existing feature beyond its original scope
- **2 hidden value discoveries** — things the intersection of old and new features creates that weren't intentionally designed but have massive impact

---

## REPO VERIFICATION (April 2026 — updated_repo.zip)

The following corrections apply based on direct examination of the uploaded repo (158 migrations, 53 E2E specs, 81 API routes, 16 FOCL pages, 47 corpus documents):

**1. The Feature Change Intake Template ALREADY EXISTS.** ChatGPT said it was missing. It's not. `lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md` is a comprehensive 11-category checklist mandated by Doctrine §1.9.0. It covers: Section 1 mission/tone check, §7.3 surface registry, cockpit controls, §10.2 entitlements, §3.0 governance emissions, §8.4 permissions, §7.8 interpretive outputs, schema, RPCs, §15.0 stress behavior, and release blocking conditions. "Silence is not compliance" is literally in the template. This is the document Christian was referring to.

**2. The Cursor rules files ALREADY EXIST.** Three `.mdc` files in `.cursor/rules/`: `doctrine-1.9-structural-truth.mdc` (always-on, covers the full §1.9 constitutional binding), `go-execution-plan.mdc` (autonomous execution rules), and `multi-pass-hardening.mdc` (test-and-fix loop rules). These are the guardrails that prevent Cursor from breaking live functionality.

**3. The `participant_checklist_items` table EXISTS (M25).** The Checklist Screen Family Specification references "Migration M-20" for this table, but the actual migration is M25 (`20260314175831_20260315000003_M25_participant_checklist.sql`). It has the correct schema: item_id, trip_id, participant_account_id, categories (entry_requirement, health_requirement, platform_document, emergency_prep), status lifecycle, itinerary versioning, RLS, and event types.

**4. The `routing_recommendations` table EXISTS with evidence linkage.** Includes confidence labels (§9.2 enum), reason codes, founder-readable explanation, acceptance checkpoints, and ITR trace linkage. This is the recommendation replay structure that ChatGPT said was "likely missing." It exists — though the ranking doctrine and evidence threshold matrix are still spec-level, not yet encoded as rules.

**5. The `set_feature_activation_state` RPC EXISTS with governance guard.** It uses `precheck_mutation_guard` with mutation_class 'feature_gate', checks feature_registry, and emits `feature_activation_changed` events. The activation lifecycle infrastructure is implemented, not just specced.

**6. The System Truth Hierarchy document EXISTS** at `docs/SYSTEM_TRUTH_HIERARCHY_AND_SECTION5_RECONCILIATION.md`. This establishes the authority order: (1) flow audit findings, (2) repo behavior, (3) canonical doctrine, (4) reconciliation artifacts, (5) status/progress, (6) historical. This is the source of truth Christian referenced.

**7. Platform completion is honestly assessed at ~58%.** The truth hierarchy doc provides a repo-informed breakdown: overall 58%, infrastructure 72%, experience 52%, production readiness 61%. This is more conservative than ChatGPT's general impression of "almost ready."

---

## PART 1: FEATURE-BY-FEATURE CROSS-REFERENCE

### 1.1 FIELD NOTES (Saved Intelligence Layer)

**What it is:** A structured save layer where users bookmark platform discoveries and imported external content as tagged, destination-anchored planning objects.

**Cross-reference against existing platform:**

**CONNECTS TO — Creator Discovery (F-6.6.11):**
The Creator Discovery spec already defines `creator_videos`, `video_location_tags`, and `video_activity_extractions` tables. A user watching a creator video about a Tuscany restaurant and tapping "Save" should create a Field Note — not a separate bookmark object. Field Notes should consume the Creator Discovery output as one of its source types. The `video_location_tags` table already carries coordinates, place type, confidence score, and extraction method. A Field Note created from a creator video inherits all of that structure automatically.

**Action:** Field Notes schema should include a `source_type` enum that includes `creator_video` alongside `platform_discovery`, `deep_scan_signal`, `user_import`, `voice_capture`, and `manual_note`. The `source_reference_id` field links back to the originating object (creator video ID, Deep Scan result ID, etc.).

**CONNECTS TO — Deep Scan Axis 5 (Hidden Opportunity Intelligence):**
Axis 5 surfaces astronomical events, natural phenomena, local cultural events, and season-specific experiences. These are exactly the kind of things a user would want to save. When a Deep Scan surfaces "Perseid meteor shower peaks during your trip window and the Atacama has near-zero light pollution," the user should be able to tap "Save to Field Notes" and have it become a structured planning object tagged to that destination and date window.

**Action:** Deep Scan results should include a "Save" action on positive signals that creates a Field Note with `source_type: 'deep_scan_signal'` and inherits the axis, confidence, and source citation from the scan result.

**CONNECTS TO — Activity Auto-Population (F-6.5.19):**
The activity layer already handles "show me what to do in each city" with one-click add to itinerary. Field Notes that have been tagged to a destination should surface in the Activity Suggestions Panel alongside creator-sourced and AI-suggested activities. The difference: Field Notes are user-curated, so they should rank higher than algorithmic suggestions.

**Action:** The Activity Suggestions Panel query should include a Field Notes join for the current destination, displaying saved items with a "From your Field Notes" badge.

**CONNECTS TO — Signal Capture (Onboarding Voice):**
During onboarding, if a user says "I saw a video about this amazing restaurant in Tuscany called Mugaritz," the voice parse already captures this as a `venue_intent` in the catch bucket. That venue intent should automatically become a Field Note with `source_type: 'voice_capture'` and `resolved: false` — exactly the pattern we already designed for venue intents in onboarding.

**Action:** The existing `venue_intent` → resolution flow should be generalized. Any voice-captured place intent, at any point in the platform (not just onboarding), creates a Field Note.

**GAP IDENTIFIED — No import/normalization pipeline for external URLs:**
Field Notes needs to accept a pasted URL (YouTube video, blog post, restaurant page, recipe) and extract structured metadata: title, region, category, seasonality, source confidence. None of this exists. The platform has PDF extraction (policy-extraction-worker) and screenshot source type support, but no URL metadata extraction service.

**Action:** New service needed: `field-note-import-normalizer`. Accepts URL, fetches Open Graph / meta tags, extracts location signals, and creates a structured Field Note. This is net-new work.

**SECURITY CLASSIFICATION:** Field Notes contain user-curated data. Imported URLs could contain anything. Classification: T2 (Sensitive) for user-created notes, T3 (General) for metadata extracted from public URLs. RLS policy: account-scoped, visible only to the owning user. Imported content should be sanitized before storage.

---

### 1.2 TRIP SPARK (Clustering → Trip Draft Engine)

**What it is:** When saved Field Notes cluster around a geographic region, the system detects the concentration and offers to convert the cluster into a trip draft.

**Cross-reference against existing platform:**

**CONNECTS TO — Trip Draft Engine:**
The Trip Draft Engine already exists with resumable planning, destination management, and route segment creation. Trip Spark doesn't need its own trip creation flow — it needs to call the existing `create_trip_draft()` pathway with pre-populated destinations derived from the Field Notes cluster. The draft appears in the same trip list, same UI, same maturity state machine.

**Action:** Trip Spark's output is a call to the existing Trip Draft Engine with a pre-populated `destination_summary` and linked Field Note IDs. No new trip infrastructure needed.

**CONNECTS TO — Deep Scan Readiness Gate:**
The existing readiness gate requires certain conditions before a Deep Scan can fire (trip must have destinations, dates, etc.). When Trip Spark creates a draft, it should be clear which readiness conditions are met (destinations: yes, from the cluster) and which are not (dates: probably no, unless Field Notes carry seasonality data).

**Action:** Trip Spark drafts should surface a "Complete your draft" prompt showing what's missing for Deep Scan eligibility, using the existing readiness gate checklist.

**CONNECTS TO — Checklist Screen Family (S-CHECKLIST-001):**
The Checklist Screen Family Specification (the project file you uploaded) defines how trip requirements are generated from the intersection of nationality × destination × medications × activities × policies × cultural events. When Trip Spark creates a draft, the `generate_trip_checklist` RPC should fire automatically, producing checklist items for the new destinations even before the user adds dates or flights.

**Action:** The Trip Spark → Trip Draft creation should trigger an initial checklist generation pass for destination-level requirements (visa, passport validity, health/vaccination). Date-dependent items (cultural event overlaps, seasonal warnings) populate when dates are added.

**EXPANSION OPPORTUNITY — Clustering as a Deep Scan Trigger:**
Here's something neither the ChatGPT conversation nor our prior sessions explicitly identified: if a user has enough Field Notes in a region to trigger Trip Spark, the clustering data itself is a signal for Deep Scan Axis 5 (Hidden Opportunity). The system knows the user cares about this region. Even before a trip draft exists, Axis 5 could run a lightweight "what's happening in northern Italy in the next 6 months" query against event calendars and surface results as additional Field Notes. This turns Trip Spark from a passive "you have enough saved" prompt into an active "and here are 3 more things you didn't know about" enrichment engine.

**Action:** When clustering score crosses the Trip Spark threshold, fire a lightweight Axis 5 query for the clustered region. Surface results as suggested Field Notes: "We noticed you're collecting Italy finds. Here's something happening in Tuscany this spring."

---

### 1.3 BUDGET INTELLIGENCE (Category-Level Spend Model)

**What it is:** Persistent budget preferences at category level (lodging per night, food spend, flight tolerance, activity budget, etc.) stored on the user profile and applied to trip drafting and recommendations.

**Cross-reference against existing platform:**

**CONNECTS TO — user_profiles.preferences JSONB:**
The existing `user_profiles` table has a `preferences` JSONB field that already stores onboarding signal data. Budget Intelligence should live here as a structured sub-object, not in a separate table. The voice artifact pipeline already writes to this field. Budget preferences captured via voice ("I usually don't spend more than $180 a night") should write to the same location.

**Action:** Define a `budget_intelligence` schema within `user_profiles.preferences`. Fields: `lodging_per_night_cap`, `lodging_splurge_ceiling`, `lodging_splurge_frequency`, `food_daily_comfort`, `activity_daily_comfort`, `flight_pain_threshold`, `train_vs_flight_bias`, `total_daily_target`, `solo_vs_group_mode`, `domestic_vs_international_mode`. All nullable — the system learns over time.

**CONNECTS TO — Per-Trip Unlock Model:**
Budget Intelligence has a direct pricing implication. The per-trip unlock model charges per trip. If the system knows a user's budget preferences and can say "a 10-day Italy trip at your comfort level costs roughly $X," that's a powerful conversion moment for triggering the trip unlock purchase. "Ready to build this trip? Unlock it for $Y."

**Action:** Trip Spark's "build this trip" prompt should include a budget-aware estimate: "Based on your preferences, this trip is likely in the $X–$Y range. Want to unlock it and start building?"

**CONNECTS TO — Stay Range Engine (Accommodation Pricing):**
Budget Intelligence provides the demand signal. Stay Range Engine provides the supply signal. Together they answer: "Can this user afford this destination at their comfort level?" This is the comparison that makes the Trip Spark prompt actually useful rather than generic.

**Action:** These two features must be built in tandem. Budget Intelligence without pricing data is just preferences. Pricing data without budget context is just numbers. The value is in the intersection.

**CONNECTS TO — Voice Parse Contexts:**
The existing voice parse system already supports `signal_capture` and `trip_draft` contexts. Budget preferences should be extractable from any voice interaction: "I want to keep hotels under $200" during trip drafting should write to Budget Intelligence, not just the trip's metadata.

**Action:** Add `budget_signal` as a recognized extraction target across voice parse contexts. The parse prompt should detect numeric budget statements and route them to the appropriate memory layer (session, trip, or profile) based on specificity.

**GAP IDENTIFIED — No regional cost baseline data:**
Budget Intelligence can store what the user wants to spend. But without knowing what things actually cost in a given region, the system can't say "Florence is over your budget but Bologna fits." This requires either partner API data (Booking.com Demand API, Amadeus) or a curated regional cost index. Neither exists in the repo.

**Action:** This is the Stay Range Engine dependency. MVP approach: curated cost-of-travel index per major destination (manually maintained in FOCL cultural restrictions table or a new `destination_cost_index` table). Phase 2: live API enrichment.

**SECURITY CLASSIFICATION:** Budget data is T2 (Sensitive). Exact income or spending numbers are personal financial data. Field-level encryption on hard budget caps. RLS: account-scoped only.

---

### 1.4 PREFERENCE MEMORY (Persistent Structured Profile Memory)

**What it is:** A three-layer memory system (session, trip, profile) that captures what the traveler repeatedly says, chooses, rejects, and prefers.

**Cross-reference against existing platform:**

**CONNECTS TO — Voice Artifacts Table:**
The `voice_artifacts` table already stores transcripts and parse proposals with `context_type` and account linkage. Preference Memory doesn't need a new storage mechanism for raw input — it needs a structured output layer that synthesizes voice artifacts into typed preference objects.

**Action:** Preference Memory is a read-layer on top of existing voice artifacts plus a write-layer into `user_profiles.preferences`. The synthesis happens when a voice artifact contains a preference signal (detected by the parse prompt) and the user confirms it.

**CONNECTS TO — F-6.5.8 Incident-Scoped Preference Context:**
The Active Disruption Options Engine spec already defines an incident-scoped `preference_context` JSONB field on the incidents table. This stores things like "excluded carriers," "preferred mode," "budget signal" — but explicitly states it's session-only and doesn't persist to the profile. Preference Memory should be the mechanism that asks: "You said you hate United during this incident. Want us to remember that for future trips?"

**Action:** After an incident resolves, the system should surface confirmed preference signals and offer to promote them from incident-scoped to profile-scoped memory. This bridges the existing incident preference capture with the new persistent memory layer.

**CONNECTS TO — Onboarding Signal Profile:**
The onboarding flow already captures travel DNA (places, activities, food interests, travel style, companion type) into `user_profiles.preferences.onboarding`. Preference Memory is the evolution of this — onboarding is the first write, but every subsequent interaction can refine it.

**Action:** The onboarding signal profile becomes the seed layer. Preference Memory adds, refines, and occasionally overrides onboarding signals based on observed behavior and confirmed voice inputs.

**EXPANSION OPPORTUNITY — Preference Memory as a Deep Scan Personalizer:**
The F-6.5.13 spec defines an Itinerary Optimizer with six modes (Cost Efficiency, Experience Density, Safety & Low-Friction, Adventure & Off-Path, Cultural Immersion, Rest & Recovery). Currently, the user must select their mode before each scan. With Preference Memory, the system could infer the likely mode from accumulated preferences: someone who consistently saves nature experiences and says "I love off the beaten path" is probably an Adventure & Off-Path traveler. The system could pre-select the mode and say "Running your scan in Adventure mode based on your travel style. Change?"

**Action:** Preference Memory should include a `inferred_scan_mode` field derived from accumulated signals. Deep Scan uses it as a default with override option.

---

### 1.5 READINESS LAB (Scenario Simulation)

**What it is:** A credit-based simulation environment where users stress-test "what would happen if" scenarios against their actual trip, profile, and uploaded coverage.

**Cross-reference against existing platform:**

**CONNECTS TO — Incident Capture + Options Engine (F-6.5.4 + F-6.5.8):**
The Readiness Lab should use the exact same reasoning pipeline as real incidents. It should not be a separate "game engine." It should be the production incident capture → options → evidence → routing pipeline running in a sandboxed mode where no real notifications fire, no real evidence is stored, and no real claims are created.

**Action:** Add a `simulation: true` flag to the incident creation flow. When true: reasoning runs normally, output is displayed, but nothing persists beyond the simulation session. No notifications to emergency contacts. No ledger events. No claim objects. The debrief at the end shows what the real platform would have done.

**CONNECTS TO — E2E Test Suite:**
The platform already has 51+ E2E spec contracts covering incident, claim, disruption, and evidence flows. Readiness Lab scenarios are structurally similar to E2E test cases — they define an initial state, a disruption trigger, user actions, and expected platform responses. The scenario library should be partially derived from the E2E spec suite, translated into user-facing language.

**Action:** Create a `scenario_library` table seeded from E2E test narratives. Each scenario has: title, description, disruption_type, initial_conditions, decision_points, expected_platform_behavior, and debrief_content.

**CONNECTS TO — Coverage Graph (F-6.5.2):**
Readiness Lab is only useful if it can reference the user's actual coverage. "What happens if my flight is canceled?" is meaningless without knowing what the user's uploaded policy actually covers. The simulation should run the coverage graph against the simulated incident and show real clause-backed results.

**Action:** Readiness Lab must require at least one uploaded policy document. Scenarios that involve coverage reasoning should clearly state: "Based on your uploaded [Policy Name], here's what we found."

**CONNECTS TO — FOCL (Founder Feedback Loop):**
This is the hidden power of the feature. Every simulation session generates structured data about what users are concerned about, where they get confused, where trust breaks, and where the platform's explanations are weak. This data should flow into FOCL as a dedicated "Simulation Insights" panel.

**Action:** Simulation sessions log: scenario chosen, decision points reached, user choices at each point, time spent, confusion signals (repeated taps, back-navigation, abandoned simulations), and free-text feedback. FOCL surfaces aggregated patterns.

**SECURITY CLASSIFICATION:** Simulation data references real trip data and real policy documents. Classification: T2 (Sensitive). Simulation sessions should auto-expire after 30 days. No simulation data should be used for any purpose other than product improvement and the user's own review.

---

## PART 2: HIDDEN VALUE DISCOVERIES

### 2.1 THE COVERAGE INTELLIGENCE LOOP (Unintentionally Created)

**What it is:** The intersection of Field Notes + Trip Spark + Budget Intelligence + the Pre-Trip Coverage Gap Engine (the unbuilt but most important revenue feature) creates something that no competitor has and that wasn't explicitly designed as a single feature:

**The loop:** User saves inspiration → system clusters it → system estimates cost → system identifies what coverage the user needs for this specific trip profile → system shows the gap between what they have and what they need → system recommends a plan → user buys through affiliate → policy auto-attaches → coverage graph recomputes → Deep Scan runs with full coverage awareness.

This is not just "save inspiration and build a trip." This is: **saved inspiration triggers an insurance intelligence pipeline that generates revenue before the trip even begins.**

No competitor does this because no competitor combines saved-item clustering with coverage gap analysis and plan recommendation. Layla builds trips. Wanderlog organizes trips. TripIt tracks trips. None of them say: "Based on the trip your saved items suggest, here's the coverage you need and here's where to get it."

**Why this matters financially:** The pre-trip coverage gap engine was already identified as "arguably the most important revenue feature not yet built." Field Notes + Trip Spark + Budget Intelligence aren't just trip-planning features — they're the top of the funnel for the coverage gap engine. Every Trip Spark conversion is a potential coverage gap analysis. Every coverage gap analysis is a potential affiliate sale. The revenue model isn't just per-trip unlock fees — it's per-trip unlock + coverage recommendation commissions.

**Action:** This loop should be documented as a first-class revenue pathway, not an afterthought. The Feature Registry should show the dependency chain: Field Notes → Trip Spark → Budget Intelligence → Coverage Gap Engine → Plan Recommendation → Affiliate → Auto-Attach → Coverage Graph. FOCL should surface conversion metrics at each step.

---

### 2.2 THE TRUST COMPOUND EFFECT (Emergent Property)

**What it is:** Readiness Lab + Decision Replay + the Governance Trust Panel create something that wasn't designed as a single experience but functions as one: **the user has tested the system before they need it, and when they do need it, they can see exactly why it told them what it told them.**

Most travel protection products are opaque. You pay, you hope it works, and when something goes wrong you fight with a customer service rep. The compound effect of your platform is:

- Before the trip: "I ran a simulation and I know exactly what the platform would do if my flight gets canceled. I trust it."
- During the trip: "My flight got canceled and the platform is telling me exactly what it told me during the simulation. It's consistent."
- After the trip: "I can see the evidence trail, the reasoning, and the sources. The claim packet was generated from real documentation, not my memory."

That compound effect — tested trust + consistent behavior + replayable reasoning — is the thing that makes a user say "I will never travel without this." It's the retention moat that no competitor can copy by adding an AI chatbot to their existing product.

**Action:** This compound should be named and marketed. The working name should be something like "Tested Trust" or "Confidence Architecture." It should appear in the launch narrative: "The only travel platform you can test before you need it, trust while you're using it, and verify after the fact."

---

## PART 3: GAPS REQUIRING NEW DOCUMENTATION

### 3.1 Field Note Import Normalizer — New Service Spec Needed
External URL → structured metadata extraction. No existing pipeline covers this. Needs its own feature spec with security review (sanitization of imported content).

### 3.2 Regional Cost Index — New Data Object Needed
Budget Intelligence and Stay Range Engine both depend on knowing what things cost in a given destination. No curated cost data exists. Needs either a FOCL-managed table or an API partner integration spec.

### 3.3 Simulation Mode Flag — Incident Pipeline Amendment Needed
Readiness Lab requires the incident pipeline to operate in a sandboxed mode. This is an amendment to F-6.5.4 and F-6.5.8, not a separate system. Needs formal specification of what "simulation: true" means for each pipeline stage.

### 3.4 Voice Budget Signal Extraction — Voice Parse Prompt Amendment Needed
The voice parse prompts need to be updated to detect and route budget statements. This is an amendment to the `buildParsingPrompt` function for all context types, not just `signal_capture`.

---

## PART 4: FOCL INTEGRATION REQUIREMENTS

Every new feature requires the following FOCL registration:

| Feature | Proposed Feature ID | Phase | Initial State | Dependencies |
|---|---|---|---|---|
| Field Notes | F-6.7.1 | Phase 2 | REGISTERED | Creator Discovery (F-6.6.11), Deep Scan (F-6.5.13) |
| Trip Spark | F-6.7.2 | Phase 2 | REGISTERED | Field Notes (F-6.7.1), Trip Draft Engine |
| Budget Intelligence | F-6.7.3 | Phase 2 | REGISTERED | Voice Parse, user_profiles schema |
| Preference Memory | F-6.7.4 | Phase 2 | REGISTERED | Voice Artifacts, user_profiles schema |
| Stay Range Engine | F-6.7.5 | Phase 3 | REGISTERED | Budget Intelligence (F-6.7.3), Amadeus API or cost index |
| Readiness Lab | F-6.7.6 | Phase 3 | REGISTERED | Incident Pipeline (F-6.5.4, F-6.5.8), Coverage Graph (F-6.5.2) |
| Travel Archive | F-6.7.7 | Phase 3 | REGISTERED | Trip maturity states, user_profiles |

Each feature advances through the standard lifecycle: REGISTERED → ELIGIBLE → INSTALLING → INSTALLED → ACTIVATING → ACTIVE. Preflight checks must include security classification confirmation, RLS policy definition, and replay coverage verification.

---

## PART 5: RECOMMENDATIONS FOR THE FOUNDER

### What to build first:
**Field Notes + Budget Intelligence schema.** These are the data foundations that everything else depends on. They're relatively simple (new table, new JSONB schema) and they unlock Trip Spark and the Coverage Intelligence Loop.

### What to spec first:
**The Coverage Intelligence Loop as a named revenue pathway.** This is the thing that makes investors understand why the platform is different. It's not "we also do AI trip planning." It's "saved inspiration triggers an insurance intelligence pipeline."

### What to defer:
**Stay Range Engine and Readiness Lab.** Both depend on external data sources or complex pipeline modifications. They're high value but high complexity. Get Field Notes → Trip Spark → Budget Intelligence → Coverage Gap Engine live first.

### What to name:
**"Tested Trust"** — the compound effect of Readiness Lab + Decision Replay + Governance. This should be a marketing concept, not just an internal architecture note.

---

---

## PART 6: VERIFIED INTEGRATION MAP (What Connects Where in the Actual Repo)

Based on direct examination of updated_repo.zip:

### 6.1 Field Notes → Existing Touch Points

| Existing System | File(s) | Integration Point |
|---|---|---|
| Creator Discovery | `app/focl/creators/`, `CreatorSearchPanel` | Field Note source_type = 'creator_video'; inherits location tags |
| Deep Scan Axis 5 | `lib/intelligence/connectors/types.ts` (hidden_opportunity) | Save action on positive scan signals creates Field Note |
| Signal Capture Voice | `app/api/voice/parse/route.ts` (signal_capture context) | venue_intents already captured; generalize to Field Notes |
| Activity Suggestions | Draft Home 4D.3 (`app/(app)/trips/[trip_id]/draft/`) | Field Notes surface alongside activity candidates |
| Onboarding Profile | `lib/onboarding/signal-profile.ts` | SignalProfile.places/activities seed initial Field Notes |

**Net-new needed:** `field_notes` table, import normalizer service, FOCL management surface.

### 6.2 Trip Spark → Existing Touch Points

| Existing System | File(s) | Integration Point |
|---|---|---|
| Trip Draft Engine | `lib/draft-home/draft-home-api.ts`, `app/(app)/trips/[trip_id]/draft/*` | Trip Spark output = pre-populated draft via existing RPCs |
| Readiness Gate | `docs/STEP4D_READINESS_GATE.md`, `advance_trip_maturity` | Auto-fire checklist generation for clustered destinations |
| Participant Checklist | `20260314175831_M25_participant_checklist.sql` | generate_trip_checklist fires on Trip Spark draft creation |
| Deep Scan | `components/DeepScanPanel.tsx` | Pre-scan Axis 5 query on clustered region (new capability) |

**Net-new needed:** Clustering algorithm, trip-worthiness scoring, "build a trip from this" UI prompt.

### 6.3 Budget Intelligence → Existing Touch Points

| Existing System | File(s) | Integration Point |
|---|---|---|
| user_profiles.preferences | `lib/onboarding/signal-profile.ts` | Budget schema lives as sub-object of existing JSONB field |
| Voice Parse | `app/api/voice/parse/route.ts` | Add budget_signal extraction to all context types |
| Per-Trip Unlock | `20260305213033_f1_per_trip_unlock_membership_model.sql` | Budget + Trip Spark = conversion moment for unlock |
| Context Engine | `lib/context-engine/evaluate.ts` | Budget-aware contextual prompts (destination over/under budget) |

**Net-new needed:** Budget schema definition, voice extraction for budget signals, regional cost index data.

### 6.4 Preference Memory → Existing Touch Points

| Existing System | File(s) | Integration Point |
|---|---|---|
| Voice Artifacts | voice_artifacts table | Raw input storage already exists |
| Signal Profile | `lib/onboarding/signal-profile.ts` (SignalProfile interface) | Onboarding = seed layer; Preference Memory = evolution layer |
| Incident Preferences | F-6.5.8 preference_context JSONB on incidents | Post-incident preference promotion (session → profile) |
| Context Engine | `lib/context-engine/evaluate.ts` | Preference-aware contextual intelligence rules |
| Deep Scan Modes | F-6.5.13 §6.5.13.2 Itinerary Optimizer (6 modes) | Inferred scan mode from accumulated preferences |

**Net-new needed:** Typed preference schema (beyond current SignalProfile), session/trip/profile layer separation, confirmation UX for preference promotion.

### 6.5 Reasoning Layer Expansion → Existing Touch Points

| Existing System | File(s) | Integration Point |
|---|---|---|
| Routing Recommendations | `20260227183948_routing_and_evidence_schema.sql` | Table exists with confidence_label, reason_codes, founder_readable_explanation |
| Acceptance Checkpoints | Same migration | acceptance tracking exists |
| Context Engine | `lib/context-engine/evaluate.ts` | Rule-based deterministic logic pattern to replicate for options ranking |
| Incident State | incidents table (canonical_status) | Traveler operational state (pre-trip, in-transit, in-country, stranded) |
| Coverage Graph | `compute_coverage_graph` RPC | Document-backed coverage awareness for options |

**Net-new needed:** Priority ladder encoding (safety > stabilization > continuity > documentation > coverage), evidence threshold matrix, authority event normalization layer, "monitor and reevaluate" recommendation type with review timer.

### 6.6 Deep Scan Axis 5 Correction (CRITICAL)

The Deep Scan Axis Doctrine (`docs/DEEP_SCAN_AXIS_DOCTRINE.md`) STILL describes Axis 5 (`hidden_opportunity`) as "Missed reimbursements / protections." This was corrected in our April voice narration session — Axis 5 is supposed to be experiential discovery (astronomical events, natural phenomena, local cultural events, hidden gems). The repo doctrine file has NOT been updated.

**Action required:** Update `docs/DEEP_SCAN_AXIS_DOCTRINE.md` line for Axis 5 to match the corrected definition from F-6.5.13 (Word-based Product Bible). The coverage gap detection belongs on Axis 2 (`coverage_itinerary_match`), which is correctly defined and has a working provider.

---

## PART 7: PRECISE PRIORITY QUEUE FOR NEXT SESSION

When I have you at the computer:

**Priority 1 — Fix existing doctrine error:**
- Update `docs/DEEP_SCAN_AXIS_DOCTRINE.md` Axis 5 description
- Add to `lib/MISMATCH_LOG.md`

**Priority 2 — Write Feature Binding Drafts (using existing template):**
- Field Notes (F-6.7.1) — using `lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md`
- Trip Spark (F-6.7.2) — same template
- Budget Intelligence (F-6.7.3) — same template

**Priority 3 — Write Operational Options Ranking Doctrine:**
- Addendum to F-6.5.8
- Priority ladder as deterministic rules in context engine pattern
- Evidence threshold matrix

**Priority 4 — Coverage Intelligence Loop documentation:**
- Name and document the revenue pathway
- Field Notes → Trip Spark → Budget Intelligence → Coverage Gap → Plan Recommendation → Affiliate → Auto-Attach → Coverage Graph recompute
- Add to FOCL as conversion funnel metrics

**Priority 5 — .cursorrules expansion:**
- Add security classification requirement for new tables
- Add replay coverage verification requirement
- Add Field Notes / Budget Intelligence schema constraints

---

**Document prepared by Claude · April 2026**
**Cross-referenced against:** Checklist Screen Family Specification v1.0, ChatGPT conversation (110 pages), all prior Claude sessions, and direct examination of updated_repo.zip (158 migrations, 53 E2E specs, 81 API routes, 16 FOCL pages, 47 corpus documents). Verified against `docs/SYSTEM_TRUTH_HIERARCHY_AND_SECTION5_RECONCILIATION.md`, `docs/SHIP_BAR.md`, `lib/MISMATCH_LOG.md`, `lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md`, `.cursor/rules/doctrine-1.9-structural-truth.mdc`, and `docs/DEEP_SCAN_AXIS_DOCTRINE.md`.
