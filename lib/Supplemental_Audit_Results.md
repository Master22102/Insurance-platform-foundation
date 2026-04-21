# WAYFARER — SUPPLEMENTAL AUDIT RESULTS
# Traveler Composition · Contextual Engine · Location Certainty · Cruise/Multi-Port · Live vs History

**April 2026 · Verified against updated_repo.zip + Product Bible (documentation.zip)**

---

## AUDIT 1: TRAVELER COMPOSITION

### What Exists (Confirmed in Repo)

| Component | Status | Evidence |
|---|---|---|
| **group_participants table** | EXISTS | Migration `20260320103000`. Fields: participant_id, trip_id, account_id, role (organizer/participant), status, residence_country_code, residence_state_code, metadata JSONB |
| **Guardian/minor dual consent** | EXISTS | Migration `20260320113000`. Fields: guardian_id, requires_dual_approval, subject_approved, guardian_approved. School-trip guardian override path. |
| **Relationship verification** | EXISTS | relationship_verification_requests table with trip_type (family/school/corporate/friend_group), expiry, approval flow |
| **Blocked relationships** | EXISTS | blocked_relationships table. 3 denied/expired in 30 days → 90-day block |
| **Export authorization grants** | EXISTS | export_authorization_grants table with subject/guardian grant/revoke RPCs |
| **Signal profile companion type** | EXISTS (heuristic) | `signal-profile.ts` detects solo/group/family/couple/backpacking from keywords |
| **Group organizer onboarding** | SPECCED | F-6.6.3 through F-6.6.7 specs cover school/church/corporate/family group types, minor permissions, organizer/delegate roles |

### What Does NOT Exist (Confirmed Gaps)

| Component | Status | Impact |
|---|---|---|
| **adults_count / children_count / infant_count on trips table** | MISSING | Trips have no traveler composition fields. Only `is_group_trip` boolean. |
| **child_ages array** | MISSING | No per-trip storage of child ages. Group participants have accounts but no age/date_of_birth field on the participant record. |
| **Traveler role beyond organizer/participant** | MISSING | group_participants.role is only 'organizer' or 'participant'. No 'guardian', 'chaperone', 'minor', 'elderly', 'medical_sensitive' roles. |
| **Vulnerable traveler flags** | MISSING | No medical_sensitive, mobility_restricted, or support_needs fields on participants or trips. |
| **Traveler composition on trip creation UI** | MISSING | Trip creation (`trips/new/page.tsx`) captures destination, dates, narration. No party composition input. |
| **Budget logic by traveler type** | MISSING | No adult/child/infant pricing distinction. Budget is a single number concept. |
| **Composition-aware checklist rules** | PARTIAL | `participant_checklist_items` generates per-participant items but doesn't branch on age, role, or vulnerability. It uses nationality × destination, not age × destination. |
| **Composition-aware incident reasoning** | MISSING | Context engine (`evaluate.ts`) doesn't take party composition as input. No "parent with 3 children" vs "solo adult" differentiation in option ranking. |
| **Family/group presets on profile** | MISSING | No "my usual travel party" presets. Each trip starts from scratch. |

### What This Means

The platform has strong group authority infrastructure (organizer permissions, guardian consent, relationship verification, export controls) but weak traveler composition modeling (no age-aware party structure, no vulnerable traveler flags, no composition-aware reasoning).

The fix is a composition object on trips, not a complete rebuild. The group authority layer doesn't need to change — it needs a richer participant detail model fed into it.

### Recommended Schema Addition

```
-- On trips table:
adults_count integer DEFAULT 1
children_count integer DEFAULT 0
infant_count integer DEFAULT 0
child_ages integer[] DEFAULT '{}'
composition_notes text -- e.g. "elderly parent, medical needs"

-- On group_participants (new columns):
age_band text CHECK (age_band IN ('adult', 'child_13_17', 'child_6_12', 'child_under_6', 'infant'))
traveler_role text CHECK (traveler_role IN ('primary', 'companion', 'minor', 'guardian', 'chaperone', 'organizer'))
support_flags text[] DEFAULT '{}' -- ['medical_sensitive', 'mobility_restricted', 'dietary_restrictions']
```

### Where Composition Must Flow

| System | Currently Uses Composition? | Fix |
|---|---|---|
| Trip creation UI | No | Add party composition step |
| Budget Intelligence (new feature) | N/A — not built | Build with composition awareness from day one |
| Checklist generation | Nationality × destination only | Add age × destination rules (minor consent, guardian docs) |
| Incident reasoning | No | Add composition signals to context engine inputs |
| Activity eligibility | No | Add age-minimum checks against activity_candidates |
| Readiness pins | Participant-level but not age-aware | Add minor-specific readiness items |
| Deep Scan | No | Axis 2 (coverage match) should flag child/infant coverage gaps |
| Stay Range Engine (new feature) | N/A — not built | Build with occupancy-aware pricing from day one |

---

## AUDIT 2: CONTEXTUAL ENGINE MATURITY & MULTI-PHASE INTELLIGENCE

### What Exists (Confirmed in Repo)

The contextual engine is more mature than ChatGPT gave it credit for:

| Component | Status | Files |
|---|---|---|
| **Context engine core** | IMPLEMENTED | `lib/context-engine/evaluate.ts` — 59 functions, deterministic rule-based |
| **8 context states** | IMPLEMENTED | active_disruption, departure_imminent, filing_deadline, evidence_needed, pre_trip, new_country, quiet_day, defer_protect |
| **RightNowPanel** | IMPLEMENTED | `components/context/RightNowPanel.tsx` — renders on trip overview, scan page, incident pages, policy upload, FOCL |
| **Contextual intelligence preferences** | IMPLEMENTED | User can toggle: preparation_prompts, evidence_suggestions, disruption_guidance, filing_deadline_warnings |
| **Trip Presence** | IMPLEMENTED | `lib/presence/location-service.ts` — device GPS watch, battery-aware, connection-type detection. `TripPresencePanel.tsx` + cultural restriction alerts, visa window alerts, border crossing alerts, activity zone alerts, missed connection alerts |
| **Feature flag gating** | IMPLEMENTED | F-6.6.14 feature flag gates contextual intelligence display |

### What the Uploaded Document Proposes (5-Story Framework)

The uploaded contextual intelligence document describes five stages where the engine should speak differently. Here's how each maps to current repo state:

| Story | Phase | Repo Status | What the Engine Should Say |
|---|---|---|---|
| **Story 1: Planning** | DRAFT maturity state | PARTIAL — engine handles `pre_trip` but doesn't distinguish DRAFT from PRE_TRIP_STRUCTURED | "Missing dates." "Saved enough for 6-8 days." "Kyoto over budget." |
| **Story 2: Booked** | PRE_TRIP_STRUCTURED / ALIGNMENT_CONFIRMED | PARTIAL — `pre_trip` state exists but doesn't differentiate booked-with-gaps from booked-and-ready | "Doctor's letter still needed." "Nyepi overlaps segment." |
| **Story 3: Travel day** | departure_imminent | IMPLEMENTED — `departure_imminent` fires when departure < 48hrs with active segments | "JFK departure tomorrow." "Passport + medication letter critical." |
| **Story 4: During trip** | new_country + active segments | PARTIAL — `new_country` exists but Trip Presence is the richer surface. No unified "in-country dashboard" | "Road closures tomorrow." "Finalize movement before shutdown." |
| **Story 5: Disruption** | active_disruption | IMPLEMENTED — `active_disruption` fires when open incidents exist with evidence gaps | "Flight canceled." "Save carrier notice." "Wait for rebooking confirmation." |

### My Honest Assessment

**The contextual engine is already good. It should NOT be made more prevalent — it should be made more phase-aware.**

Right now, the context engine has 8 states but only 2 maturity-aware branches (pre_trip and everything else). The 5-story framework is correct that the engine should speak differently during DRAFT vs PRE_TRIP vs departure-imminent vs in-country vs disruption. But the fix is not "put it everywhere" — it's "make the existing engine output contextually appropriate messages for each trip maturity state."

Specifically:

**What to add to the context engine:**

1. **DRAFT-aware nudges** — When maturity_state = DRAFT, surface planning intelligence: "Missing dates for Deep Scan." "No coverage attached." "3 readiness items incomplete." This replaces the generic `pre_trip` for DRAFT-state trips.

2. **Readiness-aware pre-trip context** — When maturity_state = PRE_TRIP_STRUCTURED and departure > 7 days, surface readiness gaps: "Doctor's letter still needed." "Visa-on-arrival confirmed." These already partially exist in readiness pins but aren't surfaced via the context engine.

3. **Trip Presence integration** — During active trip (departure_date <= now <= return_date), the context engine should merge with Trip Presence signals. Right now they're separate surfaces. The `RightNowPanel` and `TripPresencePanel` should share a unified contextual output when the trip is live.

**What NOT to do:**

- Don't create a new "contextual intelligence mode" or new floating widget
- Don't duplicate the RightNowPanel across every page
- Don't change the existing architecture — the evaluate.ts pattern is exactly right (deterministic rules over structured inputs)
- Don't add LLM inference to the context engine — keep it rule-based and fast

**The engine is your differentiator.** Layla doesn't have this. Wanderlog doesn't have this. The combination of Trip Presence (GPS-aware, cultural restriction alerts, border crossing detection) with the contextual intelligence engine (maturity-state-aware, disruption-aware, evidence-gap-aware) is genuinely unique. The fix is refinement, not expansion.

---

## AUDIT 3: LOCATION CERTAINTY

### What Exists (Confirmed in Repo)

| Location Type | Status | Implementation |
|---|---|---|
| **Device GPS location** | IMPLEMENTED | `lib/presence/location-service.ts` — `watchPresenceLocation()` with battery awareness, accuracy field, connection type |
| **Trip/itinerary location** | IMPLEMENTED | `route_segments.origin/destination` + `trips.destination_summary` |
| **Reverse geocode** | IMPLEMENTED | `/api/presence/reverse-geocode` using OpenStreetMap Nominatim |
| **Middleware geolocation permission** | IMPLEMENTED | `geolocation=(self)` in middleware headers |

### What Does NOT Exist

| Location Type | Status | Impact |
|---|---|---|
| **Manual home/base location** | MISSING | User can't set "I live in New Jersey" explicitly. Only inferred from IP or profile nationality/residence. |
| **Inferred (IP-based) location** | NOT DISTINGUISHED | No field or logic that marks a location as "inferred from IP" vs "confirmed by GPS" vs "manually entered" |
| **Location certainty enum** | MISSING | No `location_source` field: device_gps / manual_entry / ip_inferred / trip_itinerary / traveler_reported |
| **Traveler-reported current location** | MISSING | During disruption, traveler can't explicitly say "I am at gate B22" or "I'm at the hotel" as a structured location input |
| **Location correction UX** | MISSING | No "This isn't where I am — correct my location" flow |

### Recommended Schema

```
-- On user_profiles:
home_location_lat numeric
home_location_lng numeric
home_location_label text -- "Lyndhurst, NJ"
home_location_source text CHECK (source IN ('manual', 'ip_inferred', 'device_gps'))

-- On trip presence snapshots:
location_source text CHECK (source IN ('device_gps', 'manual_entry', 'ip_inferred', 'traveler_reported'))
location_certainty text CHECK (certainty IN ('confirmed', 'approximate', 'stale', 'unknown'))
```

### Doctrine Rule
**Never present inferred location as confirmed fact.** If the platform says "You are in Washington," and the user is in Michigan, trust breaks instantly. Always show location source and allow correction.

---

## AUDIT 4: CRUISE / TOUR / MULTI-PORT FIRST-CLASS TRIP SUPPORT

### What Exists (Confirmed in Repo)

| Component | Status | Notes |
|---|---|---|
| **route_segments.segment_type** | EXISTS but limited | Default 'flight'. Used values in code: 'flight', 'hotel', 'car'. No 'sea', 'cruise', 'ferry', 'tour_bus' values used despite being unconstrained text. |
| **Multi-destination trips** | EXISTS | `destination_summary` + multiple route_segments per trip. Trip can have many segments. |
| **Cruise coverage in corpus** | PARTIAL | Document-intelligence has cruise-related phrase clusters in clause-family-passes. Some cruise policy documents in corpus. |

### What Does NOT Exist

| Component | Status | Impact |
|---|---|---|
| **Cruise-specific segment model** | MISSING | No embarkation/disembarkation ports, port-of-call list, ship name, cabin type, shore excursion linking |
| **Shore excursion as activity type** | MISSING | activity_candidates.source is only 'ai_suggested' or 'user_added'. No 'shore_excursion' type. No coverage implications flagged for ship-organized vs independent excursions. |
| **Missed port as disruption type** | MISSING | Incident disruption types: delay, cancellation, missed_connection, denied_boarding, baggage, other. No 'missed_port', 'diverted_vessel', 'quarantine_at_sea', 'medical_evacuation_at_sea'. |
| **Passenger cruise contract parsing** | MISSING | Corpus has some cruise documents but no first-class cruise contract extraction pipeline like the airline policy extraction. |
| **Multi-port readiness checklist** | MISSING | Checklist generates per-destination items but doesn't account for "ports where you're only there for 6 hours and need specific documents" vs "overnight stays." |

### Assessment

Cruise support is genuinely incomplete. The platform can handle a cruise trip as a series of generic segments, but it doesn't understand cruise-specific concepts. A 12-port Mediterranean cruise would create 12 route_segments with segment_type 'flight' (wrong) or require manual 'other' type for each port. Shore excursion coverage implications are not flagged. Medical evacuation at sea — which is radically different from medical evacuation on land — is not modeled.

### Recommended: Keep as deferred but break out from trip complexity

This should be its own backlog item, not buried inside trip complexity stress testing. Cruise travelers are a specific user segment with specific needs. When it's built, it needs:
- segment_type values: 'cruise_embark', 'cruise_port_call', 'cruise_disembark', 'ferry'
- Shore excursion activity type with ship-organized vs independent flag
- Cruise-specific disruption types in the incident model
- Cruise passenger contract as a corpus document type
- Port-of-call duration awareness in checklist generation (6-hour port call ≠ 3-night stay)

---

## AUDIT 5: LIVE TRIP VS HISTORY / EVIDENCE STATE

### What Exists (Confirmed in Repo)

| Component | Status | Evidence |
|---|---|---|
| **Trip maturity states** | IMPLEMENTED | DRAFT → PRE_TRIP_STRUCTURED → ALIGNMENT_CONFIRMED → BOUND_COVERAGE → ARCHIVED |
| **Policy lifecycle states** | IMPLEMENTED | active, superseded, archived. Policy versions track lifecycle_state. |
| **Immutable snapshots** | IMPLEMENTED per §3.5.3 | Created at: alignment confirmation, policy bind, incident initiation, claim packet generation. "No historical mutation permitted." |
| **Event ledger** | IMPLEMENTED | Append-only. Every mutation emits event. Replay-capable. |
| **Archive trip RPC** | IMPLEMENTED | `archive_trip()` sets archived_at, blocks if open claims exist, emits archive event. |
| **ITR (Interpretive Trace Records)** | IMPLEMENTED | Routing recommendations carry ITR trace IDs for replay. |

### What Does NOT Exist (Genuine Gaps)

| Component | Status | Impact |
|---|---|---|
| **"Active truth" vs "superseded truth" distinction in UI** | MISSING | When a routing recommendation is superseded by a new one (because new evidence arrived), both exist in the DB but the UI doesn't clearly show "this was the recommendation at that time" vs "this is the current recommendation." |
| **"What changed" traveler-facing surface** | MISSING | No surface that shows: "Your coverage alignment changed because you added a new policy." "Your readiness score improved because you uploaded the doctor's letter." "Your routing recommendation changed because new evidence arrived." The event ledger has this data but no UI presents it to travelers. |
| **Evidence-only trip state** | MISSING | After a trip is archived and a claim is still being processed, the trip exists in ARCHIVED state. But there's no explicit "this trip is now evidence-only — you can view and export but not modify" UX treatment. The archive_trip RPC blocks archiving with open claims, so technically you can't reach this state, but the concept of "trip as evidence artifact" isn't surfaced. |
| **Supersession timeline / version history UI** | MISSING | Policy documents have lifecycle_state 'superseded' and routing_recommendations are versioned, but no UI shows the version timeline: "v1: uploaded Mar 10, superseded Mar 15. v2: uploaded Mar 15, current." |

### Assessment

The backend handles truth states correctly — immutable snapshots, append-only ledger, versioned recommendations, lifecycle states. What's missing is the traveler-facing "what changed and why" surface. This is a UX gap, not an architecture gap.

### Recommended Addition

A "Trip History" or "What Changed" panel on the trip detail page that surfaces:
- Maturity state transitions (when did DRAFT → STRUCTURED → CONFIRMED happen?)
- Policy lifecycle changes (uploaded, superseded, current)
- Routing recommendation versions (v1 at Review entry → v2 after new evidence → current)
- Alignment status changes (VALID → NEEDS_REVIEW → re-confirmed)
- Key event ledger milestones in plain language

This is a Decision Replay surface for the traveler — the same replay capability FOCL has, but translated into non-technical language.

---

## INTEGRATION WITH CONSOLIDATED MASTER TO-DO

### New Items to Add

**P1-5. Traveler Composition Audit** — Add to Priority 1 audits. Schema addition needed. Affects trip creation, budget, checklist, incident reasoning, activity eligibility, Deep Scan Axis 2.

**P1-6. Location Certainty Audit** — Add to Priority 1 audits. Schema addition needed on user_profiles + presence snapshots. Doctrine rule: never present inferred as confirmed.

**P1-7. Cruise / Multi-Port First-Class Trip Audit** — Break out from trip complexity as its own item. Deferred but documented. segment_type expansion, cruise disruption types, shore excursion coverage logic, port-of-call checklist generation.

**P1-8. Live Trip vs History / Evidence Audit** — Add to Priority 1 audits. Backend is solid. Gap is traveler-facing "what changed" surface. Version history UI. Decision Replay for travelers.

### Modified Items

**P1-1. Trip Complexity Stress Audit** — Keep but remove cruise-specific items (now P1-7). Focus on: dense multi-city, rebooking-heavy, 80-saved-places performance, group diversions, split itineraries.

**P1-2. Trip Mode Audit** — Expand to reference the 5-story contextual framework. Confirm that Structure Mode (maturity states), Today Mode (context engine), and Book Mode (not built, deferred) cover the stories. Add: DRAFT-aware nudges as a context engine enhancement (NOT a new mode).

### Items That Do NOT Need New Work

**Contextual Engine expansion** — The engine should NOT be made more prevalent. It should be made more phase-aware within its existing placement. The `evaluate.ts` pattern is correct. The RightNowPanel placement is appropriate. The fix is adding maturity-state-aware branches to the existing engine, not spreading it to new surfaces.

### Terminology Finalization

| Term | Definition | Repo Equivalent |
|---|---|---|
| **Structure Mode** | Trip building and readiness flow | Trip maturity states (§3.5) — DRAFT through BOUND_COVERAGE |
| **Today Mode / Right Now** | Live-trip contextual intelligence | Context engine (`evaluate.ts`) + RightNowPanel + Trip Presence |
| **Book Mode** | Live pricing, accommodation search, booking | NOT BUILT. Future Stay Range Engine + partner APIs |
| **Disruption Mode** | Active incident handling | Incident state machine (§3.1) + F-6.5.4/F-6.5.8 |
| **Archive Mode** | Post-trip evidence and history | archive_trip RPC + ARCHIVED maturity state |
| **Planning Intelligence** | DRAFT-state contextual nudges | Context engine enhancement — add DRAFT-aware branch |
| **Readiness Intelligence** | Pre-departure contextual alerts | Context engine `pre_trip` state + readiness pins |

---

*Verified against updated_repo.zip and Product Bible. All status claims backed by file paths and migration names.*
