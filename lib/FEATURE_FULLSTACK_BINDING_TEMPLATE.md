# Feature draft — full-stack binding checklist (Doctrine §1.9.0)

**Feature ID / name:**  
**Owner:**  
**Assumed platform scope:** *Platform-wide unless explicitly narrowed below.*

> **Silence is not compliance.** For every row, either complete it **or** paste the explicit negative line from the footer.

---

## 0. Section 1 mission / tone / boundary check

| Item | Declaration |
|------|-------------|
| Mission alignment (`lib/SECTION_1_MISSION_TONE_BOUNDARIES.md`) | |
| User Promise impact (which commitments are touched) | |
| Boundary statement requirement (where shown once per interpretive session/output; stable placement) | |
| Ethical guardrails check (data, monetization, algorithmic) | |
| Psychological tone check (non-coercive, anti-panic, no-shame) | |

*If none:* **No new Section 1 impact beyond existing behavior (reason: …).**

---

## 1. UI surface(s) & §7.3 registry

**Canonical screen / surface spec:** `lib/SECTION_7_INDEX.md` → `SECTION_7.3_SCREEN_SURFACE_REGISTRY.md` (surface_id, stress families, amendments). OAuth/email evidence copy: `SECTION_7.2_OAUTH_OPTIONAL_EMAIL_IMPORT.md`. Decision output order: `SECTION_7.8_DETERMINISTIC_DECISION_COMMUNICATION.md`.

| Item | Declaration |
|------|-------------|
| **surface_id** (existing or new per 7.3 merge gate) | |
| Required UI route(s) / component(s) | |
| §7.3 notification / destination registry impact (`focl_notification_destinations` or successor) | |
| **primary_stress_family** + **secondary** (15.x) if new surface | |

*If none:* **No new UI surface required.**  
*If no registry:* **No new §7.3 registry entries required (reason: …).**

---

## 2. Cockpit controls (rollout / region / country)

| Item | Declaration |
|------|-------------|
| `feature_registry` row(s) / parent feature | |
| Default enabled? Rollout % strategy? | |
| Region / country gating (if any) | |

*If none:* **No new cockpit control required (reason: …).**

---

## 3. Entitlement / §10.2

| Item | Declaration |
|------|-------------|
| Tier / entitlement key | |
| Enforcement locus (UI gate / API / RPC) | |
| Corporate handling | **Additive merge only** (non-launching corporate features must be gated with explicit activation prerequisites) |

*If none:* **No new entitlement binding required (reason: …).**

---

## 4. Governance events — §3.0

| Item | Declaration |
|------|-------------|
| `event_type_registry` entries | |
| `emit_event` call sites (success + rollback behavior) | |

*If none:* **No new governance emission required (reason: …).**  
*(Rare for mutating features.)*

---

## 5. Permission scope — §8.4

| Item | Declaration |
|------|-------------|
| RLS policies affected | |
| `SECURITY DEFINER` RPCs + `auth.uid()` rules | |
| Delegation / ally / guardian hooks (if any) | |

---

## 6. Confirmation gates (mutations & proposals)

**Voice / parsed proposals:** `lib/SECTION_7.4_VOICE_FIRST_INTERACTION_AUTHORITY.md` (proposal-only, explicit confirm before commit).

| Item | Declaration |
|------|-------------|
| User-visible confirm (modal / checkbox / step-up) | |
| Irreversible or high-impact? | |

*If none:* **No new confirmation gate required (reason: …).**

---

## 6b. Interpretive output shape — §7.8

**Structural order + vocabulary:** `lib/SECTION_7.8_DETERMINISTIC_DECISION_COMMUNICATION.md` (recorded fact → clause comparison → alignment/conflict → next step → boundary statement).

| Item | Declaration |
|------|-------------|
| Surfaces affected | |
| Boundary statement placement (once per output / stable) | |

*If none:* **No new interpretive surface / no §7.8 impact (reason: …).**

---

## 7. Data objects / schema

| Item | Declaration |
|------|-------------|
| Tables / columns / enums | |
| Migration filename(s) | |
| Versioning / immutability strategy (§1.9.8) | |

*If none:* **No new schema required.**

---

## 8. RPC / API contracts

| Item | Declaration |
|------|-------------|
| RPC names + arguments | |
| `precheck_mutation_guard` class (or exempt with reason) | |
| Idempotency / replay notes | |

*If none:* **No new RPC required.**

---

## 9. Stress & degradation — §15.0

| Item | Declaration |
|------|-------------|
| Behavior under PROTECTIVE / connector down / load | |
| What must **not** be silently dropped (conflicts, ambiguity, citations) | |

---

## 10. Release blocking conditions

| Item | Declaration |
|------|-------------|
| Tests / replay fixtures | |
| FOCL health thresholds | |
| Legal/compliance sign-off needed? | |
| If feature is inactive/staged off | Founder-facing descriptor + explicit activation checklist required |

---

## Structural truth acknowledgment (§1.9.2–1.9.14)

Confirm interpretive outputs are:

- [ ] Clause-bound, evidence-bound, context-bound  
- [ ] Non-predictive (no approval odds, no guaranteed reimbursement)  
- [ ] Ambiguity-explicit  
- [ ] Conflict-explicit  
- [ ] Non-coercive in tone  
- [ ] Historically immutable or versioned (no silent rewrite)

**Sign-off:** __________________ **Date:** __________
