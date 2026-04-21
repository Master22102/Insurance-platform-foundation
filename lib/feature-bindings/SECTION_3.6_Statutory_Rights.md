# Binding Doctrine — Section 3.6 Passenger Rights & Disruption Resolution Engine

**Status:** Binding doctrine drafted; rule-table implementation **not
built**. EU/EEA commercial launch blocker.
**Source doctrine:** `lib/Doctrine/SECTION 3.6 PASSENGER RIGHTS & DISRUPTION RESOLUTION ENGINE`
(Version 1.0, March 2026).
**Governs:** F-6.5.2 Coverage Graph; F-6.5.4 Airline Disruption
Intelligence; F-6.5.5 Claim Routing; F-6.5.8 Active Disruption Options
Engine; F-6.5.14 Claim Packet Generator.
**Upstream of:** Section 3.3 Coverage Graph Model (statutory node-type
extension); FAM-16 clause family registration.
**Downstream of:** Section 3.4 Causality Model
(`cause_class_internal` drives statutory applicability).
**MISMATCH_LOG:** M-010 (OPEN).

---

## 1. Constitutional purpose

Encode the external legal frameworks that define what travelers are owed
by law — independent of any policy, credit card benefit, or airline
contract they hold. Statutory floors exist regardless of what the
traveler's documents say. The platform must surface those rights
deterministically — not AI-generated opinion, but encoded rule tables
derived from binding law.

### Binding invariant

Statutory rights are encoded as deterministic lookup tables. They are
**never** AI-generated, **never** approximated, and **never** omitted
because a traveler's documents don't mention them. If a disruption
occurs in a statutory jurisdiction, the applicable rights are surfaced
regardless of policy content.

## 2. Language guardrails

### Prohibited
- "You are entitled to €400 in compensation" — outcome certainty
- "The airline must pay you" — directive language
- "You will receive this amount" — outcome prediction
- "File immediately — you have rights" — pressure language
- "The law requires the airline to compensate you" — legal-advice
  framing

### Approved
- "EU passenger rights regulations may apply to this disruption. Under
  EU261, delays of this type and distance are typically associated with
  compensation of €[amount]. Whether it applies to your specific
  situation depends on factors including the cause of the delay."
- "Based on the route and delay duration, EU passenger rights
  regulations appear relevant. Here's what those rights typically cover
  — and what you'd need to document."
- "Your disruption happened at a US airport. DOT rules set minimum
  compensation for denied boarding on domestic flights. Here's what
  those rules say."

## 3. Frameworks encoded at MVP

| Framework | Jurisdiction | Disruption Types | Key Triggers | FAM |
| --- | --- | --- | --- | --- |
| EU Regulation 261/2004 | EU/EEA departures + EU/EEA-carrier arrivals | Delay, cancellation, denied boarding, downgrading | Flight departing EU/EEA airport, OR arriving on EU/EEA-registered carrier | FAM-16 |
| US DOT Rules (14 CFR Part 250 + 2024 Refund Rule) | US domestic + US-departing international | Denied boarding, cancellation, significant change | Flight departing US airport (all carriers), OR US carrier any route | FAM-16 |
| Montreal Convention 1999 (Articles 19 & 22) | International routes between signatory states (190+) | Delay, baggage loss/damage/delay, cargo | Any international route between MC signatories | FAM-16 |
| UK Regulation (EC) 261/2004 retained | UK departures + UK-carrier arrivals | Delay, cancellation, denied boarding | Flight departing UK airport, OR UK carrier arriving UK post-Brexit | FAM-16 |

Phase 2 additions (noted, not encoded): Canadian APPR, Australian
Consumer Law aviation provisions, ASEAN Open Skies protections.

## 4. EU261 rule table (illustrative — see source doctrine for full copy)

### Compensation tiers (Article 7)

| Distance | Delay threshold | Compensation |
| --- | --- | --- |
| Up to 1,500 km | 3 h at final destination | €250 |
| 1,500–3,500 km (intra-EU 3,500+) | 3 h | €400 |
| Over 3,500 km (non-intra-EU) | 3–4 h | €300 (50% reduction) |
| Over 3,500 km (non-intra-EU) | 4+ h | €600 |

Distance is measured great-circle from first-departure to
final-destination of the booking. For missed connections, full journey
distance applies.

### Extraordinary circumstances framing (Article 5(3))

| Circumstance | Extraordinary? | Platform framing |
| --- | --- | --- |
| Severe weather (genuine) | Generally YES | "Weather-related claims are frequently disputed. Document the official weather conditions." |
| ATC restrictions | Generally YES | "ATC restrictions are typically considered extraordinary." |
| External strike (airport / ATC) | Generally YES | "External strikes outside the airline's control are typically extraordinary." |
| Airline staff strike | Generally NO | "Airline staff strikes are generally not extraordinary." |
| Technical / mechanical fault | Generally NO | "Technical faults are generally part of normal airline operations and not extraordinary." |
| Hidden manufacturing defect | Possibly YES | "Contested area. Document the airline's stated reason." |
| COVID / pandemic government restriction | Context-dependent | "Government restrictions may qualify as extraordinary in some circumstances." |

### Right to Care (Article 9)

Duty-of-care obligations apply regardless of extraordinary circumstances
when delay is expected to be 2 h or more. Tiered by distance; see source
doctrine for exact entitlements.

## 5. Schema (migration `<ts>_f_3_6_statutory_rights_fam16.sql`)

### Table `statutory_framework_registry`
| Column | Type | Notes |
| --- | --- | --- |
| `framework_code` | text PK | `EU261`, `US_DOT`, `MC_1999`, `UK261` |
| `fam_code` | text NOT NULL DEFAULT 'FAM-16' | clause family |
| `jurisdiction_tag` | text NOT NULL | |
| `effective_from` | date NOT NULL | |
| `effective_to` | date | |
| `source_version` | text NOT NULL | e.g. `EU261:2004` or `US_DOT:2024-REFUND-RULE` |

### Table `statutory_compensation_tiers`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `framework_code` | text NOT NULL | FK |
| `distance_min_km` | numeric | |
| `distance_max_km` | numeric | |
| `delay_min_hours` | numeric | |
| `compensation_amount` | numeric | |
| `compensation_currency` | text | |
| `reduction_percent` | numeric | e.g. 50 for the intermediate 3,500+ km / 3–4 h band |
| `notes` | text | |

### Table `statutory_right_to_care`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `framework_code` | text NOT NULL | |
| `distance_min_km` | numeric | |
| `distance_max_km` | numeric | |
| `delay_threshold_hours` | numeric | |
| `entitlement` | text | e.g. `meals_refreshments`, `hotel_accommodation`, `transport_hotel_airport`, `two_communications` |

### Table `statutory_extraordinary_circumstances`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `framework_code` | text NOT NULL | |
| `circumstance_key` | text NOT NULL | `severe_weather`, `atc_restriction`, etc. |
| `extraordinary` | text NOT NULL | `yes`, `no`, `contested`, `context_dependent` |
| `framing_copy` | text NOT NULL | approved-language reference |

### Table `statutory_applicability_log`
Append-only. One row per applicability evaluation performed for an
incident.
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `incident_id` | uuid NOT NULL | |
| `framework_code` | text NOT NULL | |
| `applicable` | boolean NOT NULL | |
| `trigger_reasoning` | jsonb | inputs that led to yes/no |
| `evaluated_at` | timestamptz NOT NULL DEFAULT now() | |

## 6. Applicability function

`sql_function fam16_applicable_frameworks(p_incident_id uuid) RETURNS text[]`
(SECURITY DEFINER, deterministic). Evaluates each framework's triggers
against the incident's origin/destination airports, carrier
registration, route country set, and disruption type; returns the list
of applicable `framework_code` values.

## 7. Coverage Graph statutory-node extension

Section 3.3 v1.0 supports `policy_node`, `benefit_node`, `exclusion_node`
(and related). Section 3.6 adds `statutory_node`:

- Source: rule table above, not a policy document.
- Edge weight: deterministic, immune to policy content.
- Rendering: approved-language framing from
  `statutory_extraordinary_circumstances.framing_copy`.

When a statutory framework is applicable, its nodes are always inserted
into the snapshot, even when no policy is attached.

## 8. Disruption Resolution State Machine (DRSM)

The formal sequence a traveler moves through from a suspected disruption
to a recorded outcome.

| State | Transitions in | Transitions out |
| --- | --- | --- |
| `suspected` | trip active + inbound disruption signal | → `declared` on user confirmation OR Axis 1/6 confirmation |
| `declared` | from `suspected` | → `documenting` when incident record created |
| `documenting` | from `declared` | → `options_phase` when evidence + cause_class meet threshold |
| `options_phase` | from `documenting` | → `action_taken` when user selects a recovery path |
| `action_taken` | from `options_phase` | → `resolution_pending` when action completes |
| `resolution_pending` | from `action_taken` | → `resolved` when outcome is recorded |
| `resolved` | from `resolution_pending` | terminal (closed) |

Invariants:

- DRSM state transitions emit events keyed on `{incident_id, from, to}`.
- Statutory rights surface starting at `documenting` state when
  applicability evaluates true.
- `options_phase` requires both evidence sufficiency AND (for baggage
  cases) PIR presence per §3.3.19.B.

## 9. Event types (feature_id F-6.5.2 unless noted)

- `statutory_framework_applicability_evaluated` (info)
- `statutory_right_surfaced` (info)
- `statutory_right_to_care_surfaced` (info)
- `drsm_state_transitioned` (info)
- `fam16_rule_table_loaded` (info) — emitted on app boot

## 10. RLS & security

- `statutory_*` rule tables: SELECT to `authenticated` (reference data,
  non-PII). INSERT/UPDATE/DELETE via migration only.
- `statutory_applicability_log`: SELECT account-scoped via incident
  ownership. Append-only via SECURITY DEFINER.

## 11. Acceptance criteria

- [ ] All four MVP frameworks seeded via migration with source version
      pinned.
- [ ] `fam16_applicable_frameworks` returns correct applicability for a
      table of at least 20 route/disruption specimen cases.
- [ ] Approved-language copy renders verbatim; no prohibited language
      appears in statutory-rights surfaces.
- [ ] Statutory nodes appear in a Coverage Graph snapshot even for an
      incident with zero attached policies.
- [ ] DRSM state transitions emit events; reconstruction from events
      reproduces the state machine.
- [ ] `statutory_applicability_log` rows are immutable post-insert.

## 12. Out of scope

- Outcome prediction against specific airlines.
- Compensation-claim filing automation (F-6.5.14 Claim Packet Generator
  territory).
- Phase 2 frameworks (APPR, ACL aviation, ASEAN) — scaffolded via the
  rule-table structure but not seeded.
