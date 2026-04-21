# WAYFARER — SPEC ADDENDA & GAP FIXES
# April 2026 · Paste these sections into the corresponding v2 Product Bible documents

---

# ADDENDUM A: F-6.7.2 FIELD NOTES — Gap Fixes

**Paste into F-6.7.2 v2 after Section 12 (§9a Declaration)**

## A.1 Story Correction

Replace Story 1 ("Saving from Deep Scan"). The Atacama reference was an error — Axis 5 results are scoped to the trip's destinations.

**Corrected Story 1:** Sarah runs a Deep Scan on her Japan trip. Axis 5 surfaces: "The Tanabata Star Festival takes place in Sendai during your travel window (August 6–8). One of Japan's three great festivals — decorated bamboo, parades, fireworks." Sarah isn't visiting Sendai on this trip, but she taps "Save for later." The platform creates a Field Note: title "Tanabata Star Festival — Sendai," category "event," country "JP," region "Sendai, Miyagi," seasonality "specific_dates" (Aug 6–8), source "Deep Scan." It sits in her Field Notes library for a future Japan trip.

## A.2 Dual-Action Buttons on Axis 5

On Deep Scan Axis 5 result cards, TWO buttons must appear (not one):

- **"Add to this trip"** → creates an activity_candidate on the current trip (source = 'deep_scan_signal'). This is for discoveries relevant to the current itinerary. Standard activity_candidate flow — appears in Draft Home activities page.
- **"Save for later"** → creates a Field Note (source_type = 'deep_scan_signal'). This is for discoveries the traveler finds interesting but doesn't want on this trip. Goes to Field Notes library, available for Trip Spark clustering and future trips.

Both buttons are gated on their respective features: "Add to this trip" always available (it's core activity flow). "Save for later" gated on F-6.7.2 being active.

## A.3 YouTube Transcript Extraction in Import Normalizer

When the import normalizer receives a YouTube URL (detected by domain match: youtube.com, youtu.be), it should attempt transcript extraction BEFORE falling back to Open Graph only:

1. Try YouTube's caption/subtitle API (free, available for most public videos with auto-generated captions)
2. If transcript available: extract full text, parse for location mentions, activity descriptions, food/restaurant names, travel tips, and budget signals
3. Use this richer data to suggest: title, description, category, region, and any specific venues or activities mentioned
4. If transcript unavailable: fall back to Open Graph tags (title, description, thumbnail)

For non-YouTube URLs: continue with Open Graph + HTML body text extraction as fallback.

Implementation note: YouTube transcript extraction requires a server-side fetch. Libraries like `youtube-transcript-api` (Python) or `youtube-captions-scraper` (Node) can retrieve auto-generated captions. For Node/Next.js, use the npm package or a lightweight fetch against YouTube's timedtext API endpoint.

## A.4 Mic Button on Field Notes Library

The Field Notes library page (/account/field-notes) should include a mic button (🎤) alongside the "+ Add note" and "Import URL" buttons in the action bar.

When tapped:
1. Opens VoiceNarrationPanel (existing component) or the speech capture interface
2. User speaks: "Remember that harvest festival my friend told me about in Provence"
3. Voice parse extracts: venue/place intent → title, region, category
4. Parse result is pre-filled into the Save Modal
5. User confirms/edits → POST /api/field-notes

Voice context type: reuse 'signal_capture' context or create a new 'field_note_capture' context type. Haiku is sufficient for simple venue/place intent extraction. Cost: ~$0.001-0.003 per capture.

## A.5 Draft Home Activities Integration

On the Draft Home activities page (/trips/[trip_id]/draft/activities), add a "From your Field Notes" section:

- Query field_notes WHERE country_code matches any of the trip's route_segments destinations AND status = 'active' AND attached_trip_id IS NULL
- Show matching notes as suggestion cards: "From your Field Notes: {title} ({region})"
- Each card has: "Add to itinerary" button (creates activity_candidate, sets attached_trip_id, marks note as converted) and "Not relevant" button (dismisses for this trip)
- Section only appears if matching Field Notes exist AND F-6.7.2 is active
- This bridges the gap between "I saved things months ago" and "I'm now building a trip to that destination"

---

# ADDENDUM B: F-6.7.4 BUDGET INTELLIGENCE — Gap Fixes

**Paste into F-6.7.4 v2 after Section 12 (§9a Declaration)**

## B.1 Per-Destination Override — Ground Zero (Not Phase 2)

The trips.metadata.budget_override schema must support per-destination overrides from launch:

```json
{
  "lodging_per_night_cap": 200,
  "food_daily_comfort": 65,
  "per_destination": {
    "Tokyo": { "lodging_per_night_cap": 200, "food_daily_comfort": 80 },
    "Osaka": { "lodging_per_night_cap": 125, "food_daily_comfort": 50 },
    "Kyoto": { "lodging_per_night_cap": 150 }
  }
}
```

Resolution order: per_destination[city] > trip-level override > profile-level. If a field exists at the city level, it wins. Otherwise fall back to trip level, then profile.

The voice parse must handle: "For Tokyo I want $200 a night, for Osaka $125." This requires detecting per-destination differentiation in the utterance. Escalate to Sonnet when the input references multiple cities or conditional budget logic. Match city names against the trip's route_segments destinations for validation.

The budget preferences page (v1) only shows profile-level settings. Per-trip and per-destination overrides are set via voice narration during trip planning, or via a future "Budget for this trip" panel on the trip workspace (documented as planned enhancement).

## B.2 Destination Cost Cache Table

New table for regional cost intelligence. Seeded manually for launch, automated via API later.

```sql
CREATE TABLE IF NOT EXISTS public.destination_cost_cache (
  cache_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  city text NOT NULL,
  season text NOT NULL CHECK (season IN ('spring','summer','autumn','winter','year_round')),
  avg_lodging_per_night_usd numeric,
  avg_food_per_day_usd numeric,
  avg_activity_per_day_usd numeric,
  low_range_lodging numeric,
  high_range_lodging numeric,
  sample_size integer,
  confidence text NOT NULL DEFAULT 'founder_curated' CHECK (confidence IN (
    'founder_curated','api_sourced','web_estimated','stale'
  )),
  source_names text,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_code, city, season)
);
```

FOCL management: A destination cost management page at /focl/destination-costs allows the founder to view, add, update, and flag stale entries. Phase 1: manual entry. Phase 2: automated refresh from API partners. Phase 3: periodic web-sourced estimates.

The context engine reads this table when evaluating budget nudges. If no entry exists for a destination, the budget nudge branch is a no-op for that destination (never guess at costs — only use verified data).

## B.3 Voice Parse Integration for Budget Signals

The voice parse route should detect budget statements across all 7 context types (not just signal_capture). Detection patterns:

- "$X a night" / "$X per night" → lodging_per_night_cap
- "$X a day for food" / "food budget $X" → food_daily_comfort
- "no more than $X for flights" → flight_pain_threshold
- "for [city] I want $X" → per_destination override
- "for this trip, $X" → trip-level override
- "I generally spend $X" → profile-level

When detected, the system asks layer routing: "Should I remember this for all trips, just this trip, or just for [city]?"

Model routing: Haiku for simple single-number extractions. Sonnet when the utterance contains per-destination differentiation, conditional logic, or contradicts existing budget data.

---

# ADDENDUM C: F-6.7.5 PREFERENCE MEMORY — Gap Fixes

**Paste into F-6.7.5 v2 after Section 14 (§9a Declaration)**

## C.1 Contradiction Resolution

When a new preference signal contradicts an existing stored preference, the system must:

1. **Detect the contradiction:** Compare incoming preference against existing preference_memory entries in the same category. "No hostels" + "hostels are fine for this trip" = contradiction.

2. **Surface it to the traveler:** "You've previously said you prefer to avoid hostels. For this trip, are you okay with hostels?"

3. **Let the traveler resolve it:**
   - "Just this trip" → store as trip-layer override (trips.metadata.preference_overrides). Profile preference unchanged.
   - "I've changed my mind about hostels" → update profile-layer preference. Old preference marked inactive with a change_reason. New preference created with source = 'manual_entry' or 'voice_capture' and source_context referencing the contradiction.
   - "Cancel" → discard the new signal, keep existing preference.

4. **Never silently overwrite.** The system always surfaces the conflict and lets the user decide. This applies across all capture methods: voice, manual entry, behavior inference, and incident promotion.

5. **Log contradictions:** Store contradiction events in the governance ledger: preference_contradiction_detected → { existing_preference_id, new_signal, resolution (trip_override / profile_update / dismissed), account_id }.

Contradiction detection is keyword-matching against existing preference statements in the same category. Not LLM-powered — simple string comparison is sufficient for v1. "No hostels" contradicts "hostels are fine." "Prefer trains" contradicts "prefer flights." If detection is uncertain, do not surface a contradiction — let the new preference coexist until the system can ask during a relevant interaction.

## C.2 Carrier Preference Nuance

Carrier exclusions (e.g., "I don't want United") are stored as profile preferences. But they function as **soft filters, not hard blocks.**

During normal operation (trip planning, activity suggestions, accommodation recommendations): preferences are applied as filters. The traveler never sees United suggestions.

During operational necessity (incident rebooking, only available option): the platform surfaces the preference alongside the reality: "The only rebooking option available is United. You've noted you prefer to avoid United. Want to see this option anyway?"

The traveler can:
- "Show me anyway" → display the option with a visual indicator that it conflicts with a saved preference
- "Find something else" → the platform continues searching for alternatives
- "I've changed my mind about United" → removes the carrier exclusion from profile preferences

This distinction must be documented in the preference_memory schema: each preference object should have an `enforcement` field: `filter` (default — silently hide non-matching options) or `advisory` (show but flag). Carrier exclusions default to `filter` during normal operations and automatically switch to `advisory` during disruption/incident resolution flows.

---

# ADDENDUM D: ITINERARY PARSER UPGRADE

**New section — to be added to Product Bible as an addendum to the Trip Creation flow (Section 5.0)**

## D.1 Why the Parser Needs an Upgrade

The current itinerary normalize API (/api/itinerary/normalize) uses regex-based parsing: pattern-matching for "from X to X," date extraction via month names, and travel mode detection via keyword matching. This works for simple, single-trip itineraries with conventional structure.

It fails for complex real-world documents like multi-trip planning files that contain: multiple separate trips in one document, day-by-day activity breakdowns, embedded booking URLs with pricing, budget calculations and insurance details, confirmed vs tentative items, personal notes and collaborative comments, accommodation options with per-person pricing, and conditional logic ("if flight is early morning, leave for Southern Bali").

## D.2 Upgraded Parse Pipeline

The normalize API should implement a two-tier pipeline:

**Tier 1 (Fast — regex, always runs first):**
- Extract text from PDF/DOCX/TXT/ICS
- Run existing parseTextToItinerary() for basic structure
- Score complexity: word count > 500, multiple country mentions, embedded URLs, budget numbers, day-by-day structure
- If complexity score is LOW: return Tier 1 results (current behavior, no AI cost)
- If complexity score is HIGH: escalate to Tier 2

**Tier 2 (LLM-assisted — Sonnet, runs for complex documents):**
- Send extracted text to Sonnet with a structured extraction prompt
- Prompt asks Sonnet to return JSON identifying:
  - How many distinct trips are in the document
  - For each trip: name, destinations in order, dates, duration, travel mode
  - Route segments: origin → destination with transport type and date
  - Activities: name, city, status (confirmed/tentative/needs_research), booking URL, cost
  - Budget data: per-night caps, daily spending, total budget, insurance details
  - Accommodation: hotel names, booking links, per-person pricing, confirmed vs options
  - Group/traveler information: names, nationalities
  - Personal notes and reminders (flagged but not exposed publicly)
- Return structured ProposedItinerary[] (array, not single object)
- Cost: ~$0.10-0.15 for a complex document (Sonnet). One-time per upload.

**Tier 2 output handling:**
- If multiple trips detected: present the traveler with a selection screen: "We found {N} trips in this document. Which one would you like to start with?" Each option shows: trip name, destinations, dates, estimated duration.
- Selected trip creates a single trip draft with pre-populated segments, activities, and budget data.
- Other trips are offered as "Save for later" → creates a trips.metadata.pending_imports entry or Field Notes cluster.

## D.3 What the Parser Should Extract from Christian's PDF (Target Output)

Using the actual uploaded document as the test case, Tier 2 should produce:

```json
{
  "trips_detected": 4,
  "trips": [
    {
      "name": "United States Trip",
      "destinations": ["Hometown", "Orlando"],
      "duration_days": "10-14",
      "dates": null,
      "status": "outline_only",
      "segments": [],
      "activities": ["Orlando Studios"],
      "budget": {}
    },
    {
      "name": "Europe Trip 2026",
      "destinations": ["London", "Paris", "Lourdes", "Narbonne", "Lisbon", "San Sebastián", "Madrid", "Valencia", "Milan", "Rome", "Venice", "Vienna", "Athens", "Sofia", "Istanbul"],
      "duration_days": 71,
      "dates": {"start": "2026-09-01", "end": null, "notes": "End of August / September 2026"},
      "status": "partially_planned",
      "segments": [
        {"from": "Home", "to": "London", "type": "flight", "cost_usd": 711, "carrier": "Delta"},
        {"from": "London", "to": "Paris", "type": "rail", "notes": "Eurail"},
        {"from": "Istanbul", "to": "Home", "type": "flight"}
      ],
      "activities": [
        {"name": "Phantom Peak adventure", "city": "London", "status": "tentative", "url": "facebook.com/..."},
        {"name": "Harry Potter experience", "city": "London", "status": "tentative"},
        {"name": "Picnic at Eiffel Tower", "city": "Paris", "status": "tentative"},
        {"name": "The Louvre", "city": "Paris", "status": "tentative"},
        {"name": "Les Grands Buffets", "city": "Narbonne", "status": "tentative", "url": "lesgrandsbuffets.com", "notes": "Dress code required"},
        {"name": "Visit Mt Olympus", "city": "Athens", "status": "needs_research"}
      ],
      "budget": {
        "eurail_pass": 1311,
        "flights": 711,
        "accommodation_per_night": 80,
        "spending_per_day": 70,
        "activities_weekly": 200,
        "insurance": 200,
        "total_estimated": 10213.20
      }
    },
    {
      "name": "India Trip",
      "destinations": ["New Delhi", "Agra", "Jaipur", "Ranthambore", "Udaipur", "Mumbai"],
      "duration_days": 10,
      "dates": null,
      "status": "detailed_planned",
      "segments": [
        {"from": "New Delhi", "to": "Agra", "type": "car", "cost_usd": 50},
        {"from": "Agra", "to": "Jaipur", "type": "rail", "class": "First-Class AC", "duration": "4 hours"},
        {"from": "Jaipur", "to": "Ranthambore", "type": "car", "duration": "3-4 hours"},
        {"from": "Ranthambore", "to": "Udaipur", "type": "rail", "class": "First-Class Sleeper", "duration": "7-8 hours"},
        {"from": "Udaipur", "to": "Mumbai", "type": "flight", "duration": "1.5 hours"},
        {"from": "Mumbai", "to": "Bangkok", "type": "flight", "duration": "4-5 hours"}
      ],
      "activities_confirmed": [
        {"name": "Rambagh Palace dinner", "city": "Jaipur", "status": "confirmed", "notes": "Reservation made, smart casual dress code"}
      ],
      "activities_planned": [
        {"name": "Private Old & New Delhi tour", "city": "New Delhi", "cost_usd": 6.92, "url": "viator link", "duration": "4-8 hours"},
        {"name": "Taj Mahal + Agra Fort tour", "city": "Agra", "cost_usd": 99.85, "url": "viator link", "notes": "Request price reduction - not returning to Delhi"},
        {"name": "Amber Fort + City Palace", "city": "Jaipur"},
        {"name": "Ranthambore Safari", "city": "Ranthambore"},
        {"name": "Mehtab Bagh sunset (Taj view)", "city": "Agra"}
      ],
      "accommodation": [
        {"name": "Courtyard by Marriott", "city": "Agra", "nights": 2, "status": "planned"}
      ]
    },
    {
      "name": "Asia Trip 2027",
      "destinations": ["Bangkok", "Chiang Mai", "Phuket", "Bali (Southern + Ubud)", "Singapore", "Japan"],
      "duration_days": 44,
      "dates": {"start": "2027-06-07", "end": "2027-07-26"},
      "status": "detailed_planned",
      "budget": {
        "accommodation_per_night": 80,
        "spending_per_day": 70,
        "flights_range": [2098, 2559],
        "parking": 247.55,
        "insurance_total": 982.59,
        "activities_placeholder": 2000,
        "at_home_bills": 2351.47,
        "grand_total_range": [14279.61, 14740.61]
      },
      "insurance": {
        "primary": {"name": "Trawick Safe Travels Voyager", "cost": 579.60, "medical": 250000, "evacuation": 1000000, "trip_delay_total": 25000},
        "secondary": {"name": "World Nomads Explorer", "cost": 402.99, "cancellation": 10000, "trip_delay": 3000, "medevac": 300000}
      }
    }
  ]
}
```

This is the target quality. The regex parser produces maybe 10% of this. Sonnet produces 80-90%. The remaining 10% (like understanding that the India trip flows into the Asia trip via Mumbai→Bangkok) requires contextual reasoning that even Sonnet handles well with the right prompt.

## D.4 Three-Tier Model Selection

The parser uses three tiers based on document complexity:

**Tier 1 (Regex only):** Simple documents, <500 words, single destination. $0.00. No AI call. Handles: "Flight from NYC to London, March 5-12, Hilton Mayfair." Most casual uploads.

**Tier 2 (Sonnet 4):** Medium complexity, single trip, 500-2000 words, structured but straightforward. ~$0.12. Handles: a well-organized single-trip itinerary with cities, dates, activities, and a budget summary. Good for 80% of users.

**Tier 3 (Opus 4.6):** High complexity — multi-trip documents, day-by-day breakdowns with booking links, budget calculations across categories, conditional logic, collaborative notes, 2000+ words. ~$0.57-1.50. Handles: documents like Christian's 37-page multi-trip PDF. This tier doesn't just parse — it reasons about relationships between trips (India ends in Mumbai, Asia trip starts in Bangkok = sequential), infers traveler preferences from activity patterns (anime restaurants across 4 countries = anime enthusiast profile tag), detects schedule density gaps ("Day 5 in Madrid looks open after 2 PM"), separates confirmed from tentative items with contextual understanding, and identifies personal notes vs itinerary content.

**Tier 3 escalation triggers** (score >= 4):
- Multiple trips detected by Tier 1 regex → +2
- Document exceeds 2000 words with day-by-day structure → +1
- Embedded booking URLs with pricing from multiple providers → +1
- Budget breakdowns with per-category math → +1
- Collaborative notes from multiple contributors → +1
- Conditional logic ("if flight is early...") → +1

**Economics:** At $80/year subscription, a power user creating 4 trips (one Tier 3 import at $1.50) costs $1.50 in AI — 1.9% of revenue. Acceptable for the highest-value onboarding moment.

Rate limit: 5 Tier 3 parses per user per day, 15 Tier 2 per day (prevents abuse).

## D.5 Schedule Density Analysis (Post-Parse)

After Tier 2 or Tier 3 parsing, if the result contains day-by-day activity data, run a schedule density check:

For each day in the itinerary:
1. Calculate total planned activity time (if duration data available)
2. Calculate transit time between locations (if coordinates or city data available)
3. Identify gaps > 3 hours with no planned activity

Surface gaps as suggestions:
- "Day 5 in Madrid looks open after 2 PM. Want activity suggestions for the afternoon?"
- "Day 8 in Ubud has no activities planned. It's a great day for: Monkey Forest, rice terrace walk, or a cooking class."

Also surface over-packed days:
- "Day 3 in Jaipur has 5 activities across 12 hours including transit. You may want to move Hawa Mahal to Day 4."

This connects to the existing Activity Feasibility Check (documented in Activity Auto-Population Section 7) but runs at the itinerary level rather than per-activity.

The density analysis fires after import completion, before the traveler sees their Draft Home. Results appear as a "Schedule insights" card on the draft overview, not as blocking warnings.

---

# ADDENDUM E: AI MODEL ROUTING STRATEGY (Platform-Wide)

**New section for Product Bible — cross-cutting concern**

## E.1 Model Selection by Task Complexity

| Task | Model | Approx Cost | Reasoning |
|------|-------|-------------|-----------|
| Simple preference extraction ("I don't like hostels") | Haiku 4.5 | ~$0.001 | Single entity, clear intent |
| Simple budget signal ("$200 a night") | Haiku 4.5 | ~$0.001 | Single number extraction |
| Complex budget with conditions ("$200 for Tokyo, $125 for Osaka") | Sonnet 4 | ~$0.012 | Per-destination differentiation, trip context needed |
| Preference contradiction resolution | Sonnet 4 | ~$0.010 | Needs comparison against existing preferences |
| Itinerary import (simple, <500 words) | None (regex) | $0.00 | Pattern matching sufficient |
| Itinerary import (medium, 500-2000 words, single trip) | Sonnet 4 | ~$0.12 | Structured extraction, single trip |
| Itinerary import (complex, 2000+ words, multi-trip, budgets, booking links) | Opus 4.6 | ~$0.57-1.50 | Reasoning between trips, preference inference, schedule density, conditional logic |
| Quick Scan (basic) | Haiku 4.5 | ~$0.01 | Structured rules, no deep reasoning |
| Deep Scan (per axis, complex) | Sonnet 4 | ~$0.015/axis | Contextual intelligence, source attribution |
| Incident narrative capture | Haiku 4.5 | ~$0.002 | Structured event extraction |
| Carrier response analysis | Sonnet 4 | ~$0.012 | Interpretive, needs precision |

## E.2 Automatic Escalation Triggers

The voice parse route should auto-escalate from Haiku to Sonnet when:
- Input contains conditional logic ("but if," "unless," "except when")
- Input references multiple destinations with different values
- Input contradicts an existing stored preference or budget
- Input contains complex temporal reasoning ("during cherry blossom season but not Golden Week")
- Input length exceeds 100 words (likely complex reasoning needed)

## E.3 Cost Per Trip Estimate (Realistic)

For a simple trip (weekend getaway, single destination):
- Onboarding (3 voice rounds): ~$0.003
- Itinerary: manual entry or Tier 1 regex: $0.00
- 3 voice interactions: ~$0.003
- Quick Scan: ~$0.01
- **Total: ~$0.02**

For a typical trip (7-10 days, 2-3 cities):
- Onboarding: ~$0.003
- Itinerary upload (Tier 2 Sonnet): ~$0.12
- 8 voice interactions: ~$0.04
- Quick Scan + Deep Scan: ~$0.17
- 3 during-trip interactions: ~$0.01
- **Total: ~$0.34**

For a power user trip (Christian's 44-day Asia tour):
- Onboarding: ~$0.003
- Itinerary upload (Tier 3 Opus): ~$1.00
- 15 voice interactions (mix Haiku/Sonnet): ~$0.08
- Quick Scan + Deep Scan: ~$0.17
- 10 during-trip interactions: ~$0.05
- Schedule density analysis: included in Tier 3 parse
- **Total: ~$1.30**

For 1,000 users (mix: 60% simple, 30% typical, 10% power):
- 600 × $0.02 + 300 × $0.34 + 100 × $1.30 = $12 + $102 + $130 = **~$244/month**
- Against $80/year × 1,000 = $80,000/year revenue → AI cost is ~3.7% of revenue. Healthy.
