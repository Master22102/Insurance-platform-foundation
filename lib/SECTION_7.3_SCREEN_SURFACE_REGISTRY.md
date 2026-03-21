# Section 7.3 — Screen surface registry (platform-wide)

**Binding:** Merge/release per 7.3.0 / 7.3.1; amendments v1.1 (March 2026) and v1.2 (March 2026) add surfaces **without removing** v1.0 entries.

See **`SECTION_7_INDEX.md`** for file map and cross-references.

---

## 7.3.0 Surface governance binding

All registered surfaces are:

- Determinism-bound (**§1.9**)  
- Ledger-bound (**§3.0**)  
- Confidence-bound (**§9.2**)  
- Trace-bound (**§9.4**)  
- Permission-gated (**§8.4**)  
- Stress-survivable (**§15.x**)  

**No surface may:**

- Display interpretive output without structural order enforcement (**7.8**)  
- Display confidence without canonical enum (**9.2**)  
- Mutate state without ledger emission (**3.0.6**)  
- Bypass mutation guard (**3.0.8**)  
- Reveal model identifiers (**15.2.J**)  
- Bypass redaction rules (**15.2.P**)  

**Every surface must declare:**

- Required profile type(s)  
- Required permission scope  
- Operational mode behavior  
- Structural dependencies  
- Stress degradation policy  

If any surface cannot declare these → **incomplete; may not ship.**

---

## 7.3.1 Purpose

- Registry of **screen surfaces** across domains: maps screens ↔ roles ↔ feature IDs ↔ actions ↔ authority ↔ phone vs laptop.  
- **Does not** redefine business logic (Section **6** + RPC/DB remain source of enforcement).  
- **Merge gate:** No doctrine/feature change merges unless it maps to an existing **surface_id** or introduces a new **surface_id** with full contract + stress mapping.

---

## 7.3.2 Screen classification model

**Domains:** I Traveler · II Founder · III Institutional/Admin (Phase 2+) · IV System & utility.

Each screen maps to ≥1 **Feature ID**.

### 7.3.2.a Active profile context binding (global invariant)

**Required UI:** `active_profile_badge`, `change_context_control`, `context_switch_forces_rebind`.

**Behavior:** Context switch → permission re-eval + redaction re-eval + export-profile rebind; deep links re-check context; stale capability tokens rejected.

**Minimum context-binding surfaces (non-exhaustive):** Export Center, Export Preview/Manifest, Ask Panel, Account & Permissions, mutation-capable FOCL surfaces, export/redaction/financial role-scoped surfaces.

---

## 7.3.3 Phone vs laptop policy (summary)

- **Phone:** read-only default; low-risk approvals; draft Ask responses.  
- **Laptop:** thresholds, overrides, connector re-enable, protective mode override, feature flags — **step-up** for structural actions.

---

## 7.3.4 Technical mode toggle (Founder)

- **Calm mode (default):** plain language, impact, safe actions, risk level — no raw error codes.  
- **Technical mode:** structured IDs, failure codes, thresholds, dependency states, RPC summaries — **read-only**, session-based, access logged.

---

## 7.3.5 Survivability principle

Platform must remain operational **24–48h** without founder login; screens are **supervisory**, not required for core traveler function.

---

## 7.3.6 Cross-references (canonical)

- Feature logic: **6.5.x**  
- Logging/downgrade: **12.5**  
- QA/regression: **12.6**  
- Visual design: **7.7**  
- Calm language: **7.2**  
- Decision structure: **7.8**  
- Permissions/audit: **8.4**  
- Confidence/uncertainty: **9.2**  
- Interpretive trace/drift: **9.4**  
- Stress: **15.0 / 15.1**  

**UI polish boundary:** **7.7** governs visual/interaction polish; **7.3** governs surface existence, authority, enforcement linkage.

---

## 7.3.7–7.3.8 (headlines)

- **7.3.7** Founder activity map / allocation capacity / finance overview / crisis banner — founder operational surfaces.  
- **7.3.8** **Surface survivability mapping:** each surface declares `primary_stress_family` + `secondary_stress_families` (A–O families per spec). Release blocked if missing/invalid mapping or export/redaction surfaces lack applicable G/H/I/J/K families.

**Stress family key (abbrev):** A Infrastructure · B Connector · C Interpretive · D Financial · E Governance · F Drift · G Export overload · H Recipient misclassification · I Redaction drift · J Model identity leak · K Financial export distortion · L Regional isolation · M Feature lifecycle · N Evidence durability · O Forecast drift.

*v1.0 registry includes detailed per-surface primary/secondary mapping in the product bible; implementers must copy the authoritative row for each shipped surface.*

---

## Amendment v1.1 — Trip draft engine & discovery (March 2026)

Adds **10** surfaces (IDs below). Prior 7.3 surfaces unchanged.

| surface_id | Name | Feature | State dependency |
|------------|------|---------|------------------|
| S-DRAFT-001 | Draft Home | F-6.5.17 | DRAFT |
| S-DRAFT-002 | Voice Narration Interface | F-6.5.17 | DRAFT, parse limit |
| S-DRAFT-003 | Narration Confirmation | F-6.5.17 | DRAFT, proposed parse |
| S-DRAFT-004 | Route Editor | F-6.5.17 | DRAFT or PRE_TRIP_STRUCTURED |
| S-DRAFT-005 | Readiness Panel | F-6.5.17 | DRAFT |
| S-DRAFT-006 | Activity Suggestions Panel | F-6.5.19 | DRAFT or PRE_TRIP_STRUCTURED |
| S-DRAFT-007 | Unresolved Items Panel | F-6.5.17 | DRAFT |
| S-CREATOR-001 | Creator Discovery Search | F-6.6.11 | Any |
| S-CREATOR-002 | Creator Video Detail | F-6.6.11 | Any |
| S-WEATHER-001 | Weather Check Interface | F-6.5.20 | ACTIVE_TRIP |

*Full component lists, copy, and flows: founder bible v1.1 amendment text.*

---

## Amendment v1.2 — Reconciliation (March 2026)

**Adds only** (v1.0 + v1.1 preserved). **14 new** traveler/founder surfaces + **2 extensions** to existing surfaces.

### New surface IDs (v1.2)

| surface_id | Name | Domain | Feature refs | Notes |
|------------|------|--------|--------------|--------|
| S-EMERGENCY-001 | Emergency SOS Sheet | Traveler | F-6.6.4, F-6.6.6 | Phone; red button; no menu; EMERGENCY label; local numbers |
| S-EMERGENCY-002 | Trip Safety Card | Traveler | F-6.6.4, F-6.5.9 | Neutral button; reference only |
| S-DISRUPT-001 | Disruption Resolution State Tracker | Traveler | §3.6.9, F-6.5.4 | Banner on incident surfaces |
| S-DISRUPT-002 | Active Disruption Options Panel | Traveler | F-6.5.8 | Phase 1 guidance; Phase 2 live options |
| S-DISRUPT-003 | Statutory Rights Advisory Surface | Traveler | §3.6.2–6, F-6.5.2 | Rule tables; not AI |
| S-DISRUPT-004 | Consequence Advisory Panel | Traveler | §3.6.8, §3.3.19.A | Offer consequences |
| S-DISRUPT-005 | Filing Deadline Tracker | Traveler | §3.6.9.B, F-6.5.5 | Embedded in routing/progress |
| S-CHECKLIST-001 | Participant Readiness Checklist | Traveler | F-6.5.9 | Per participant |
| S-CHECKLIST-002 | Group Readiness Overview | Traveler (organizer) | F-6.5.9 | Status only, no doc content |
| S-FOCL-INT-001 | Feature Intelligence Panel | Founder | F-6.5.16.j | **Built:** `/focl/features/intelligence` |
| S-FOCL-INT-002 | Sub-Capability Control Panel | Founder | F-6.5.16.j | Registered; route `/focl/features/:id/subcomponents` |
| S-FOCL-INT-003 | Connector Status Panel | Founder | F-6.5.16.j | Registered; route `/focl/features/:id/connector` |
| S-GOV-001 | Governance Trust Panel Widget | Founder | §3.0, F-6.5.16 | **Built:** floating widget |

### Extensions (gap / update required)

- **S-CLAIM-EXT-001** — **Claim Routing Screen** extension: claim **sequence** view, per-path deadlines, denial → step 2 activation messaging.  
- **S-INCIDENT-EXT-001** — **Incident Capture** extension: **S-DISRUPT-001** banner, explore options, statutory dot, evidence sidebar.

---

## Traveler domain — consolidated list (v1.0 + v1.1 + v1.2)

*v1.0 numbered surfaces (Trip Dashboard, Incident Capture, Coverage, Card Benefits, Evidence, Claim Routing, Claim Progress, Claim Packet, Itinerary Risk, Regulatory, Carrier Discrepancy, etc.) remain as in bible; combine with S-DRAFT-*, S-CREATOR-*, S-WEATHER-*, S-EMERGENCY-*, S-DISRUPT-*, S-CHECKLIST-* per reconciliation table in Section 7.3 Amendment v1.2.*

**Implementation note:** When adding a route or major UI, add/update a row in `feature_registry` / internal registry and link **surface_id** + **stress families** before merge.
