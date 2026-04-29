# Section 7.4 — Voice-first interaction authority model

**Finalized with cockpit controls + window governance** (per product bible).

## 7.4.0 Purpose

Voice is a **governed narrative capture** mechanism for incident (and extended: trip draft) flows.

Voice:

- Captures narrative  
- **Proposes** structured fields  
- Requires **explicit confirmation** before mutation  
- Does **not** execute business logic, consume entitlements, alter trip state, or initiate exports  

**Mutation path:** guard → `emit_event` → atomic commit (**§3.0**).

## 7.4.1 Voice scope (surface control) — MVP

**Enabled on:** `INCIDENT_CAPTURE`, `INCIDENT_UPDATE` (and **trip draft** per amendment — see 7.4.13).

**Not enabled on:** coverage engine, deep scan execution, export config, payment, founder controls, regulatory screens. Voice is **not** a general command interface in MVP.

## 7.4.2 Voice artifact model

Each capture produces:

- `transcript_raw` (verbatim)  
- `transcript_normalized` (formatting only; uncertainty preserved)  
- `parse_attempt` (structured proposal JSON)  

Parsing is **not** re-run on replay; replays use stored `parse_attempt` only.

## 7.4.3 Structured proposal states

Per field: **PROPOSED** | **CONFIRMED** | **UNKNOWN**. Only **CONFIRMED** enters active incident version. No probabilistic confidence scoring in this model (numeric conf in parse JSON is implementation detail for review thresholds — align with §9.2 in product).

## 7.4.4 Confirmation gate

After parsing: show structured proposal; highlight sensitive fields (timestamps, money, denials, causality, transport mode); user confirms **whole proposal** (edits allowed); commit requires explicit confirmation token.

## 7.4.5–7.4.12 (summary)

- **Multilingual:** store original; derived translation labeled; never overwrite raw.  
- **Redaction (user-facing):** offer redaction for export/shared views; internal record/governance trace preserved.  
- **Versioning / retention:** active version = latest confirmed; governance retention windows for artifact purge vs metadata.  
- **Concurrency:** block commit if incident version advanced since proposal.  
- **Contradictions:** surface X vs Y; no auto-resolve.  
- **Segmentation:** soft cap (e.g. 5–6 min segments); warn before split.  
- **Degradation:** STT down → transcript-only; flood → suspend parsing; ledger down → block commit, no silent failure.  
- **Founder cockpit:** toggles for voice, segment max, revision/retention windows, parsing model version, PII highlight — versioned, logged, non-retroactive.

---

## Amendment v1.1 — Trip draft narration (7.4.13)

**Second context:** Trip draft narration (**F-6.5.17**, surfaces **S-DRAFT-002** → **S-DRAFT-003**).

Same authority as incident:

| Rule | Incident | Trip draft |
|------|----------|------------|
| Proposal-only | Yes | Yes |
| Confirmation required | Yes | Yes |
| Uncertainty preserved | Yes | Yes |
| Conflict detection | Yes | Yes |
| Partial confirmation | Yes | Yes |
| Transcript immutable | Yes | Yes |
| Parse attempt immutable | Yes | Yes |

**Workflow (summary):** mic in Draft Home → record (max 5 min, warn 4:00) → save transcript → parse → **Narration Confirmation** (“Here’s what I heard”) → confirm / edit / start over → write route/activities only after confirm.

**Failure modes:** parse timeout / empty / low confidence → user retry or manual entry.

**Rate limits (§10.2):** e.g. free 10 narration parses per trip; paid unlimited; transcript capture without LLM unlimited.

**Cross-refs:** §3.5 trip maturity, §9.4 traceability, §10.2 pricing.

---

## Amendment v1.2 — Onboarding signal capture narration (April 2026)

**Third voice context.** Incident (7.4.0–7.4.12) and trip draft (7.4.13) unchanged.

### 7.4.14 Onboarding signal capture narration

**Context type:** `signal_capture`
**Surface:** S-ONBOARD-001
**Model:** claude-sonnet-4-6 via OPENROUTER_ONBOARDING_MODEL env var — not Haiku. Quality over cost for onboarding; ~$0.025 total for all three rounds.

**Hard constraints:**

- Three rounds maximum. Non-negotiable. No fourth round under any condition.
- One Sonnet call per round. Parse and response voice layer in a single call.
- One clarifying question maximum per round. Highest-value ambiguous item only.
- No background API calls during onboarding. No Google Places, no validation, no enrichment.
- No credit deduction. Onboarding narration is free and always available.
- Budget ceiling: three Sonnet calls total for entire onboarding flow. Hard limit. No exceptions.

**Four ambiguity states:**

| State | Description | Action |
|-------|-------------|--------|
| Confident | Certain of category | Assign silently. No question. |
| Probable | Mostly sure | Assign to most likely bucket. User corrects via chip edit if wrong. |
| Ambiguous-high | Uncertain + high downstream value | One clarifying question in response voice layer. |
| Ambiguous-low | Uncertain + low downstream value | Silent catch bucket. Raw text. Zero processing. |

If multiple Ambiguous-high items in one round: ask about highest-value only. Catch-bucket the rest.

**Response voice layer:**

After each parse, a second output field `wayfarer_response` returns one natural sentence delivered above the chip grid. Session context passed in: accumulated `narrationParts` array. Makes the system feel conversational. Round 3 adopts final-round tone — invites last addition rather than implying more rounds available.

**Venue intent detection:**

Sonnet flags proper nouns as `venue_intent: true` based on context clues in the narration only. No background search. All venue_intent items stored with `resolved: false`. Resolution fires at trip creation via Google Places — not during onboarding.

**Catch bucket:**

Items that cannot be confidently categorized stored as raw text with `resolved: false`. Never processed during onboarding. Never displayed to user as an error. Surfaced at trip creation when relevant.

**Chip categories (five):** Places · My Thing · Food · Companions · Avoid

**Pet signal extraction:**
- `pet_travel: boolean`
- `pet_type: string | null`
- `pet_destination_type: "domestic" | "international" | null`

**Draft persistence:** Signal profile saved to `localStorage` under key `wayfarer_onboarding_draft` after each round. On re-entry before confirmation: "Pick up where you left off?" with chip preview and timestamp. Options: "Continue" or "Start fresh."

**Authority comparison:**

| Rule | Incident | Trip draft | Onboarding |
|------|----------|------------|------------|
| Proposal-only | Yes | Yes | Yes — chips are proposals until confirmed |
| Confirmation required | Yes | Yes | Yes — "Confirm my profile" |
| Transcript immutable | Yes | Yes | Yes |
| Parse attempt immutable | Yes | Yes | Yes |
| Max rounds | N/A | 1 per session | 3 total, hard ceiling |
| Model | Haiku | Haiku | claude-sonnet-4-6 |
| Background API calls | Permitted | Permitted | Prohibited |

**Cross-refs:** §5.0 Step 2 onboarding flow, §7.3 S-ONBOARD-001/002, §9.4 traceability, `lib/SECTION_7.3_SCREEN_SURFACE_REGISTRY.md`.

---
