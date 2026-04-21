# Binding Doctrine — Section 3.3 v1.1 Coverage Graph Model Amendments

**Status:** Binding doctrine drafted; runtime enforcement **not built**.
**Source doctrine:** `lib/Doctrine/SECTION 3.3 COVERAGE GRAPH MODEL Amendment v1.1 `
(March 2026; supersedes open Q1–Q4 from Section 3.3 v1.0).
**Governs:** F-6.5.2 Coverage Graph; F-6.5.5 Claim Routing; F-6.5.8 Active
Disruption Options Engine; F-6.5.14 Claim Packet Generator.
**MISMATCH_LOG:** M-009 (OPEN — amendments not yet wired into codebase).

This document is a feature-adjacent **doctrine binding**, not a single
feature binding. It enumerates the amendments, the invariants they
introduce, the schema and event changes they require, and the
language-compliance rules they impose.

---

## Amendment Index

| §       | Title                                    | Source Q | Invariants      |
| ------- | ---------------------------------------- | -------- | --------------- |
| 3.3.19.A | Voucher Acceptance Doctrine             | Q1       | I-26 … I-29     |
| 3.3.19.B | Baggage Delay Pre-Claim Protocol        | Q2       | I-30 … I-34     |
| 3.3.19.C | Evidence Threshold for CCO Dispute      | Q3       | (language rules)|
| 3.3.19.D | Gap and Ambiguity Display Doctrine      | Q4       | (language rules)|
| 3.3.19.E | Solo Source Advisory Rule               | Implicit | (language rules)|

---

## 1. 3.3.19.A — Voucher Acceptance

Advisory only. The Coverage Graph MUST NEVER surface language that tells
a traveler not to accept a voucher in imperative or blocking terms.

### Prohibited language
- "Do not accept this voucher"
- "Accepting this voucher will void your claim"
- "Stop — this action cannot be undone"
- "You will lose your credit card benefit if you accept"

### Approved language (digital pre-acceptance advisory)
> Before you accept — accepting a voucher from the airline may affect
> your options with your card benefits or insurance policy. We can't
> predict exactly how, but it's worth a moment to review your situation
> first. [Show me what this could mean] [Continue anyway]

Rules for the prompt: one-time display per incident; never blocks;
"Continue anyway" always present and functional; no claim-denial
prediction; no urgency language; never appears for physical vouchers.

### Approved language (post-acceptance)
> We've updated your options based on the voucher you accepted. Some
> paths that were available before may no longer apply, but here's what
> we've found for you now.

### Voucher-type awareness

| Voucher type | Platform capability | Response model |
| --- | --- | --- |
| Digital (in-app / airline app) | May detect a pending acceptance. | Show calm informational prompt before acceptance; dismissible. |
| Physical (gate agent / counter) | Cannot intercept. | Accept the fact non-judgmentally; regenerate snapshot. |

### Post-acceptance: new snapshot required

| # | Action | Rule |
| --- | --- | --- |
| 1 | Record acceptance | Emit `voucher_acceptance_recorded` with `voucher_type` (`digital` / `physical` / `unknown`), `acceptance_at`, `declared_value` if known. Authoritative timestamp. |
| 2 | New `CoverageGraphSnapshot` | `build_coverage_graph_snapshot()` with updated context. Voucher modifies edge weights on nodes with `excludes` edges tied to `airline_compensation_accepted`. |
| 3 | New `RoutingRecommendation` version | `generate_routing_recommendation()` referencing the new snapshot_id. |
| 4 | Supersede previous recommendation | Previous row: `superseded=true`, `superseded_at=now()`, `generation_trigger="voucher_acceptance"`. Emit `routing_recommendation_superseded`. |
| 5 | Never mutate previous snapshot | Prior rows immutable. Supersedure only. |
| 6 | Notify traveler calmly | Approved post-acceptance language above. |

### Invariants

- **I-26** — No blocking/imperative language against voucher acceptance.
- **I-27** — Voucher acceptance (physical OR digital) always triggers a
  new snapshot AND a new routing recommendation version.
- **I-28** — Previous snapshots and routing recommendations are never
  mutated post-voucher. Supersedure is the only mechanism.
- **I-29** — Digital pre-acceptance advisory prompt appears at most once
  per incident. Dismissible without consequence.

### Required event types (feature_id F-6.5.2 unless noted)

- `voucher_acceptance_recorded` (info)
- `routing_recommendation_superseded` (info, feature_id F-6.5.5)

---

## 2. 3.3.19.B — Baggage Delay Pre-Claim Protocol

Facts before claims. Baggage non-arrival is first an operational problem,
not a financial dispute. The Coverage Graph does not activate
claim-routing logic until a defined time threshold has passed AND the
airline has had an opportunity to respond.

### Prohibited language
- Any claim language in the reporting phase: "file a claim", "start your
  claim", "claim eligible".
- "Your bags may be lost" — loss language before airline confirmation.
- Linking Incident B (baggage) to Incident A's (flight) CCO
  classification in edge weighting.
- Weather as a reason to reduce baggage options — baggage rights have
  their own clause basis.

### Baggage Time-Step Ladder

Clock anchor: **verified flight landing time**, not app-open time.

| Elapsed (post-landing) | Platform state | Response |
| --- | --- | --- |
| 0–60 min | Monitoring / Patience | "It sometimes takes a while for bags to reach the carousel, especially after international flights. Let's check in on this together." Encourage tracker-tag evidence. |
| 1–4 h | Active Delay — Airline Engagement | Step-by-step prompt to speak with the airline's baggage desk and obtain a written **Property Irregularity Report (PIR)** number. Capture `airline_report_number` and `contact_made_at`. |
| 4–5 h (configurable) | Threshold Crossed — Options Phase | Coverage Graph activates fully. `CoverageClaimPath` generated. Routing recommendation surfaced. |
| Bags confirmed lost | Claim Routing Active | Full Coverage Graph evaluation. Claim language now appropriate. |

### Evidence categories (baggage)

| Evidence | Classification | Rule |
| --- | --- | --- |
| Baggage tracker tag / AirTag / airline tracker | `location_evidence` | Valid. Encouraged early. |
| Airline PIR | Primary anchor | Required before Options Phase activates. |
| Flight arrival confirmation | Clock anchor | Used to set internal clock. |
| Photos of carousel | Contextual | Supports timeline, not eligibility. |
| Receipts for emergency purchases | Valid | Required for delay reimbursement once threshold crossed. |
| Tracker showing bag in different city | Diversion | Materially upgrades confidence on routing. |

### Cross-incident isolation rule

- Incident A (flight delay) and Incident B (baggage) may share
  `linked_incident_ids` for context display.
- Incident A's `cause_class_internal` does NOT flow into Incident B's
  edge weighting.
- Incident B's `EligibilityAssertions` are computed from Incident B's
  own evidence set, its own CCO version, and its own jurisdiction.
- Link is informational context only — never an algorithmic input to
  Incident B's graph computation.

### Cascading exception: board-without-bags

| Trigger | Response |
| --- | --- |
| Next connecting flight departs within a decision window while bags still missing | Surface operational guidance: gate, airline report, reroute confirmation number. Not claim routing. |
| Traveler boards without bags | Record `traveler_boarded_without_bags` with `timestamp` and `gate_location`. Anchors emergency-purchase reimbursement clock. |
| Bags confirmed diverted | Upgrade evidence classification; surface airline obligation node with upgraded confidence. |

### Invariants

- **I-30** — Claim language prohibited before airline-engagement phase
  completes AND the configurable time threshold is crossed.
- **I-31** — Platform clock anchors to verified flight landing time, not
  app-open time.
- **I-32** — Cross-incident CCO classification never flows into another
  incident's graph computation.
- **I-33** — PIR number from the airline is required before Options Phase
  activates.
- **I-34** — Cascading exception triggers operational guidance, not
  claim routing.

### Required event types (feature_id F-6.5.2)

- `baggage_delay_monitoring_started`
- `baggage_airline_engagement_entered`
- `baggage_pir_recorded`
- `baggage_options_phase_activated`
- `traveler_boarded_without_bags` (warn)
- `baggage_diversion_confirmed`

---

## 3. 3.3.19.C — Evidence Threshold for CCO Dispute

**Verdict on the specimen case (maintenance vehicle photo):** NOT VALID
for CCO dispute. A generic maintenance vehicle photo does not
contradict a weather classification; maintenance vehicles appear at
airports regardless of disruption cause.

### What counts as valid CCO-dispute evidence

- **Official Airline Record** (ops log, carrier communication, written
  notice) — primary source.
- Named technical/mechanical fault code (e.g., ACARS report,
  maintenance log number).
- Carrier-issued written reason stating maintenance.
- Third-party recognized source (e.g., FAA logs where accessible,
  recognized flight-data services with documented access).

### What does NOT count

- Generic airport photos of maintenance vehicles.
- Social-media speculation.
- Traveler inference from observable delay patterns.
- Weather-contradicting evidence from consumer weather apps alone.

### No false-hope generation

Platform MUST NOT surface "you may have a case" language when evidence
does not meet the above bar. Approved response when evidence is
insufficient:

> This photo shows a maintenance vehicle, which is common at every
> airport during every kind of disruption. To contest the weather
> classification, you would need a written statement from the airline
> identifying a technical or operational cause. Here's how to request
> that.

---

## 4. 3.3.19.D — Gap and Ambiguity Display Doctrine

Internal taxonomy may continue to use `AMBIGUOUS` and `GAP_IDENTIFIED`
for engine-side logic. Traveler-facing surfaces MUST NOT render those
strings.

### Prohibited traveler-facing terms
- `AMBIGUOUS`
- `GAP_IDENTIFIED`
- "unclear coverage"
- "uncertain applicability"
- "insufficient information"

### Approved pattern
Rebook-first: surface actionable next steps before surfacing the gap.
Reassurance-forward: describe what the platform is doing / will do.

> Based on what we have so far, the clearest path forward is [rebook /
> document / contact carrier]. Here's what we're checking in the
> background, and what we'll know more about as [condition].

Implementation: a render-layer linter in `lib/coverage-graph/language/`
flags prohibited strings in any copy emitted for traveler display and
fails CI when they appear outside explicit allow-list components
(internal dev/FOCL tools).

---

## 5. 3.3.19.E — Solo Source Advisory Rule

Defines when the platform may suggest additional coverage sources
without crossing into sales or pressure. The advisory may fire only
when:

- The traveler has a confirmed trip AND
- Coverage analysis shows a category gap (Axis 2), AND
- No existing policy in the traveler's attached set addresses the gap.

The advisory surfaces **a coverage category**, not a product. The
platform does not recommend insurers, credit cards, or brokers by name.

### Approved pattern
> Your current coverage doesn't address [category]. Travelers in this
> situation commonly look for [category]-type coverage. Here's what to
> ask for and how to compare it.

Prohibited: "We recommend provider X", "This policy is best for you",
"Call our partner at [phone]", any urgency framing.

---

## 6. Enforcement plan

Three migrations + one linter pass:

1. **Voucher supersedure chain** — adds `voucher_acceptance_recorded`
   and `routing_recommendation_superseded` event types; adds
   `superseded`, `superseded_at`, `generation_trigger` to
   `routing_recommendations` if not already present; RPC
   `record_voucher_acceptance` that chains the snapshot + recommendation
   update.

2. **Baggage cascade state machine** — adds event types above, plus a
   `baggage_incident_state` column to `incidents` (or an adjunct table)
   tracking `(monitoring | engagement | options | claim_active)`;
   enforces cross-incident isolation in `build_coverage_graph_snapshot`.

3. **Approved-language linter** — a static checker over Coverage Graph
   render copy (JSX / template strings / JSON catalogs) that fails on
   any prohibited string from §1, §2, §4 appearing outside an allow-list
   module.

4. **CCO evidence classifier upgrade** — taxonomy for "Official Airline
   Record" as the primary CCO-dispute source; downgrades generic
   photographic evidence; emits `cco_dispute_evidence_rejected`
   accompanied by the approved-response copy.

## 7. Acceptance criteria

- [ ] All nine invariants (I-26 … I-34) enforced in code.
- [ ] Linter catches every prohibited string listed in this doctrine.
- [ ] Voucher acceptance flow emits both events and creates a new
      snapshot + recommendation version without mutating prior rows.
- [ ] Baggage cascade respects the time-step ladder; claim language
      does not appear before Options Phase.
- [ ] Cross-incident CCO isolation verified by test: weather flight
      delay does not suppress baggage claim paths.
- [ ] CCO dispute on maintenance-vehicle photo returns the approved
      rejection copy verbatim, no "you may have a case" language.

## 8. Out of scope

- Disputes against a CCO classification for causes other than
  weather/maintenance (handled in Section 3.4 extensions).
- Voucher *valuation* disputes (separate doctrine; this section covers
  acceptance only).
- UK-specific baggage thresholds beyond what Section 3.6 statutory
  rights layer encodes.
