# Deep Scan Axis Doctrine — Canonical Reference

**Source of truth:** `lib/Doctrine/SECTION 6.5.13 — DEEP SCAN INTELLIGENCE ENGINE`
(Version 2.0, March 2026).
**Feature ID:** F-6.5.13.
**Absorption note:** Section 6.5.13 v2.0 formally absorbs Sections 6.5.11
(Regulatory-Aware Incident Reporting) and 6.5.12 (Authority-Driven Travel
Disruptions) as Axes 9 and 11 respectively. Standalone features F-6.5.11 and
F-6.5.12 are retired at the doctrine level. See MISMATCH_LOG M-008 for the
registry-side retirement work.

Related MISMATCH_LOG entries: M-006 (Axis 5 definition correction, RESOLVED),
M-008 (absorption of 6.5.11/6.5.12).

---

## Boundary statement

Every Deep Scan output carries this boundary statement verbatim:

> This briefing is a decision-support tool. It does not constitute legal
> advice, insurance advice, or a guarantee of coverage. All regulatory
> information reflects available data at time of scan. Verify entry
> requirements directly with relevant authorities before departure.

Deep Scan is **not** prediction. It interprets signals, surfaces what is
known, and tells the traveler what to do with that knowledge. Final
determination rests with the relevant authority or provider.

---

## The Ten Axes (plus on-demand Axis 11)

Axes 1–8 run for all trips. Axes 9 and 10 run for all international trips.
Axis 11 activates only when authority-driven disruption signals are
detected.

### Axis 1 — Transit Reliability
Reads every leg A→B→Z: flight, rail, ferry, bus, scheduled ground.
Historical on-time stats per route, per carrier, per season. Flags tight
connections with consistent failure rates.
Sources: carrier performance databases, rail/ferry operator feeds,
FlightAware/OAG (decision pending), historical disruption records.

### Axis 2 — Coverage-to-Itinerary Match
Maps attached policies against actual activities. Adventure clauses,
off-road exclusions, unscheduled transit gaps, extreme sports riders.
Surfaces what applies and what does not.
Sources: PolicyVersion objects, Coverage Graph (Section 3.3), Causality
Model (Section 3.4).

### Axis 3 — Regional Risk Intelligence
Crime patterns, civil unrest, State Dept / FCDO advisory status, health
advisories — at city and neighborhood level where data exists.
Sources: State Dept public API, FCDO, regional risk intelligence
databases, WHO health feeds.

### Axis 4 — Hyperlocal Weather
Local meteorological services in the destination country.
Microclimate-aware. Five-day modeling per itinerary stop. Flags weather
events affecting specific transit legs.
Sources: local national weather services, regional meteorological APIs,
open weather data feeds; creative integration wrapper where paid APIs are
unavailable.

### Axis 5 — Hidden Opportunity Intelligence
**Canonical definition:** astronomical events, natural phenomena, local
cultural events not on mainstream tour packages, season-specific
experiences. **The layer no competitor surfaces.**
Sources: NASA ephemeris APIs, meteor shower calendars, light pollution
databases, UNESCO intangible heritage calendar, local tourism feeds.

> Axis 5 is **not** about missed reimbursements or protections. That was a
> superseded definition retired via MISMATCH_LOG M-006.

### Axis 6 — Local Intelligence Signals
Port strikes, transit worker actions, airport construction, local
holidays closing services travelers assume will be open.
Sources: local news monitoring, labor relations feeds, airport
operational advisories.

### Axis 7 — Disruption Probability Narrative
Synthesizes Axes 1–6 into a per-leg plain-English briefing tied to the
traveler's specific coverage. **Not a number — a narrative.** Example
framing: "Your crossing has a known delay pattern. Your policy covers
trip delay after 6 hours. Here is what to document."
Sources: synthesis of Axes 1–6, Coverage Graph, Causality Model output.

### Axis 8 — Transportation Practice Intelligence
Ride-share reliability patterns, known driver-behavior issues by region
and platform, negotiation culture, pricing practices, cascade risk.
"This dispute type has caused missed departures in this city — here is
what to do."
Sources: regional transportation practice data, platform-specific
behavioral patterns, community-sourced intelligence.

### Axis 9 — Cultural & Legal Intelligence *(absorbed from 6.5.11)*
Post-finalization briefing on destination-specific cultural norms and
legal requirements. Activates at Trip Maturity State 3 (Confirmed
Snapshot).

Cultural Norms Layer: greetings, dress code, tipping, photography
restrictions, bargaining norms, religious observances, gender dynamics
and safety considerations.

Legal & Regulatory Layer: visa requirements and entry conditions per the
traveler's passport nationality; customs regulations; medications legal
at home but controlled or prohibited at destination (common examples:
certain ADHD medications, opioid-based pain relief, some anxiety
medications); drone / alcohol / public-conduct / LGBTQ+ legal status /
cannabis / photography-of-government-infrastructure laws; visa-on-arrival
and e-visa eligibility; common denial causes.

Regulatory Incident Reporting (6.5.11 function preserved): incident
classification (entry denial, customs hold, visa issue, law enforcement
contact, quarantine, document confiscation), documentation prompts,
coverage implication, embassy contact surfacing. All logged to the Event
Ledger per Section 8.4.

**FRAMING REQUIREMENT:** Axis 9 is never delivered as a warning or legal
disclaimer. It is delivered as: *"Here is what you need to know before
you land in [destination]."* Calm, specific, actionable.

**INVARIANT AX9-1:** The platform does not provide legal advice for
regulatory incidents. It documents, surfaces relevant contacts, and
identifies coverage implications. The traveler is directed to their
embassy and relevant insurer for legal and financial resolution.

### Axis 10 — Financial Risk & Currency Intelligence
Currency volatility, capital controls, ATM access, economic instability
signals, coverage implications of financial disruption events.
Sources: currency data feeds, capital control databases, ATM network
reliability data, financial stability indicators.

### Axis 11 — Authority-Driven Disruption Intelligence *(absorbed from 6.5.12)*
Activates when signals indicate a government authority, security agency,
or border authority is causing or is likely to cause itinerary
disruption.

Signal types that activate Axis 11:

| Signal | Meaning | Coverage Implication |
| --- | --- | --- |
| Security recheck requirement | Additional screening mandated by airport or border authority. | May trigger trip-delay coverage depending on cause classification. Document the mandate in writing if possible. |
| Entry denial risk | Traveler's passport/visa flagged as potentially ineligible at destination. | Trip-cancellation coverage may apply. Depends on foreseeability at time of purchase. |
| Border closure | Land, air, or sea entry point closed by government authority. | Trip-interruption coverage likely applies. Document official closure notice. |
| Government travel restriction | Destination or transit country has issued a restriction affecting the traveler's nationality or route. | Force-majeure implications. Check Axis 2 output. |
| Embassy shelter-in-place advisory | Embassy recommending or ordering nationals to shelter. | Trip-interruption and emergency-evacuation coverage triggered in most policies. Document advisory timestamp. |
| Airport/port security incident | Active security event affecting departure or arrival facility. | Coverage cascade identical to standard disruption; Axis 7 narrative applies with authority classification. |

**Interaction with the Causality Model:** authority-driven disruptions
get `cause_class_internal = EXTERNAL` with `cause_label_public =
"Government Restriction"`. This classification matters because (a) some
policies cover Government Restriction events that standard trip
cancellation would not, (b) airlines may invoke force majeure exemptions
even while the traveler's insurance may still respond, and (c) the
platform surfaces the classification and its coverage implications
without determining the outcome. All Axis 11 activations are logged as
causality events per Section 3.4 and emit a platform alert to the
traveler.

---

## Itinerary Optimizer — Priority Modes

Before a Deep Scan executes, the traveler states what they are optimizing
for on this trip via a single voice-forward prioritization prompt. The
Optimizer weights scan output accordingly — same engine, personalized
delivery.

| Priority Mode | Surfaced First | Receded |
| --- | --- | --- |
| Cost Efficiency | Transit reliability, budget transit alternatives, financial-risk flags, currency optimization | Axis 5, extended cultural detail |
| Experience Density | Axis 5, off-path local events, seasonal phenomena, cultural immersion | Granular transit statistics, financial-risk detail |
| Safety & Low-Friction | Axis 3, Axis 8, transit reliability, Axis 9 legal layer | Opportunity intelligence, financial nuance |
| Adventure & Off-Path | Axis 5 expanded, coverage-to-activity match for extreme activities, remote-area intelligence | Standard urban transit stats, routine crime patterns |
| Cultural Immersion | Axis 9 cultural layer expanded, local events, religious/social context, legal awareness | Transit-reliability detail, financial risk |
| Rest & Recovery | Axis 4 precision, accommodation-area intelligence, minimal-disruption routing | Adventure content, dense opportunity surfacing |

Mode inference from accumulated traveler preferences is specified in
F-6.7.5 Preference Memory §10 as a future enhancement.

---

## Quick Scan vs. Deep Scan

| Dimension | Quick Scan | Deep Scan |
| --- | --- | --- |
| Purpose | Conversion tool. Proof of concept. Onboarding bridge. | Full trip-intelligence briefing. Primary value delivery. |
| Axes covered | Surface-level: basic coverage summary, obvious transit flags only | All 10 axes (+ Axis 11 on signal detection) |
| Resolution layer | None | Included at MVP. Subscriber-differentiated in Phase 2+ |
| Regulatory layer | None | Full Axis 9 Cultural & Legal briefing for international trips |
| Authority disruption | None | Axis 11 activates on signal detection |
| Confidence labels | Not included | Required on all interpretive outputs per Section 9.2 |
| Credit consumption | No credit consumed | 1 credit per scan. No silent deduction. Explicit confirmation required. |
| Export | No export | Export eligible per Section 8.7 |

---

## Vulnerability Resolution Layer

**MVP posture:** Full inclusion. Deep Scan price bundles finding and
solving. The traveler sees a gap and immediately receives what closes it.

Resolution output includes: identification by axis and clause basis;
coverage category that addresses each gap (not a specific product); what
to ask a broker, insurer, or carrier for; documentation checklist for
pre-departure if the gap is not closed; pre-departure action sequence.

**BROKER LINE COMPLIANCE:** The Resolution Layer does not recommend
specific products, insurers, or policies. It identifies gap categories
and tells the traveler what to ask for — keeping the platform on the
correct side of insurance-broker licensing boundaries in all
jurisdictions.

**Phase 2+ subscription differentiation:** per-trip Deep Scan gets full
10-axis diagnosis + basic resolution suggestions; subscriber tiers get
full guided resolution including specific action sequences and
documentation prep. Users are informed at MVP launch. No one loses
something they currently have.

---

## Credit Governance

| Tier | Included Credits | Rollover Cap | À la Carte Price |
| --- | --- | --- | --- |
| Tier 0 (Free Preview) | 0 | N/A | $44.99/scan |
| Per-Trip Unlock (MVP) | 2 per trip unlock | No rollover | $44.99/additional scan |
| Prepared (Phase 2 sub) | 1/month | 3 | $34.99/additional scan |
| Protected Pro (Phase 2) | 2/month | 4 | $34.99/additional scan |
| Advocate (Phase 2) | 3/month | 6 | $29.99/additional scan |

**Invariant DS-1:** Deep Scan credits are never deducted silently. Every
credit consumption requires explicit user confirmation and emits a
`deep_scan_credit_consumed` ledger event.

**Invariant DS-2:** Unlimited Deep Scans are never offered at any tier.
Scarcity preserves output quality and ensures credits are used on
finalized or near-finalized itineraries.

---

## Local Partner Business Development Signal

When Deep Scan returns thin data for a region — limited local activity
options, sparse Axis 5 opportunity content — that gap is logged as a
business-development signal, not a product failure. The gap is an
outreach opportunity to local operators, tourism boards, and experience
providers not yet visible to the platform's intelligence layer.

Revenue model (listing fees, verification fees, featured placement) is
Phase 2+. The data signal is generated automatically from day one.

---

## Retirements

- **F-6.5.11 (Regulatory-Aware Incident Reporting)** — absorbed as Axis 9.
  Registry retirement tracked under MISMATCH_LOG M-008.
- **F-6.5.12 (Authority-Driven Travel Disruptions)** — absorbed as Axis
  11. Registry retirement tracked under MISMATCH_LOG M-008.

Do not build against F-6.5.11 or F-6.5.12 directly.
