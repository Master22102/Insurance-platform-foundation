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
