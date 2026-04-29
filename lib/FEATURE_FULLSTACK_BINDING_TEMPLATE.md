# Feature draft — full-stack binding checklist (Doctrine §1.9.0)

**Feature ID / name:**  
**Owner:**  
**Assumed platform scope:** *Platform-wide unless explicitly narrowed below.*

> **Silence is not compliance.** For every row, either complete it **or** paste the explicit negative line from the footer.

---

## 0a. Source-of-truth intake (agent + author)

| Item | Declaration |
|------|-------------|
| **Primary workflow anchor** — `docs/SYSTEM_TRUTH_HIERARCHY_AND_SECTION5_RECONCILIATION.md` opened; authority order + **File roles (what to keep open)** acknowledged | |
| **Ship / release bar** — `docs/SHIP_BAR.md` tier selected for this change (internal / private pilot / broader production) | |
| **Surface registry** — `lib/SECTION_7.3_SCREEN_SURFACE_REGISTRY.md` + `lib/SECTION_7_INDEX.md` consulted if UI/interpreting surfaces touched | |
| **Archive exclusion** — no reliance on `docs/archive/*` as current truth without cross-checking SYSTEM_TRUTH + live code | |
| **Conflict handling** — if sources disagree and hierarchy does not resolve: **`lib/MISMATCH_LOG.md`** entry planned or filed (no silent pick) | |

*If N/A:* **No doctrine/source conflict encountered (reason: …).**

---

## 0b. Security classification & retention (T1 / T2 / T3)

| Item | Declaration |
|------|-------------|
| **Tier per table/column set** — T1 / T2 / T3 (or equivalent) for each new or materially extended store | |
| **T1** — field-level encryption at rest (or approved equivalent pattern); if impossible, **MISMATCH_LOG** + waiver path | |
| **T2 / T3** — retention expectation, deletion/anonymization, and **§8.3.7** log/event/error redaction | |
| **Reference** — `lib/CORE_FLOW_GOVERNANCE_IMPLEMENTATION_MATRIX.md` §8.3 / §8.3.7 | |

*If none:* **No new persisted fields (reason: …).**

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

**Trip / readiness / context / FOCL:** When any row below is “yes,” also complete **§11 (§9a rows)** and **`.cursor/rules/system-truth-and-platform-gates.mdc` §9a** in session notes or this draft.

| Item | Declaration |
|------|-------------|
| **surface_id** (existing or new per 7.3 merge gate) | |
| Required UI route(s) / component(s) | |
| §7.3 notification / destination registry impact (`focl_notification_destinations` or successor) | |
| **primary_stress_family** + **secondary** (15.x) if new surface | |
| **§9a — Trip workspace / trip overview / detail / cross-tab trip surfaces** — touched? If **yes**: map to **`surface_id`** + plain-language cross-tab impact | |
| **§9a — Readiness flows / readiness routes or components** — touched? If **yes**: note Draft Home / pins / scan or maturity dependencies | |
| **§9a — Right Now / context engine / context strips or panels** — touched? If **yes**: list components; note cross-tab or layout consumers | |
| **§9a — Feature activation / FOCL visibility / notification–registry** — touched? If **yes**: complete **§2** and the **`focl_notification_destinations`** row above with specifics | |

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
| **New tables** — confirm RLS enabled + policies ship **in the same change** as table creation (or documented exception + `MISMATCH_LOG`) | |
| RLS policies affected (existing + new) | |
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
| **Persisted coverage / alignment / interpretive snapshots** — no silent overwrite; new version, supersession record, or new job (per §1.9.8 + `docs/DEEP_SCAN_AXIS_DOCTRINE.md` for scan axes) | |

*If none:* **No new schema required.**

### 7a. Migration immutability check

| Item | Declaration |
|------|-------------|
| **No edits** to migration files already applied to shared/prod history — only **new forward** migrations added | |
| Apply order / bundle docs followed (`docs/MIGRATIONS_APPLY_ORDER.md`, `supabase/bundles/README.md` as relevant) | |

*If N/A:* **No migration files touched.**

---

## 8. RPC / API contracts

| Item | Declaration |
|------|-------------|
| RPC names + arguments | |
| `precheck_mutation_guard` class (or exempt with reason) | |
| Idempotency / replay notes | |

*If none:* **No new RPC required.**

---

### 8b. Replay coverage block

| Item | Declaration |
|------|-------------|
| **Replay-sensitive paths** — list RPCs/jobs/APIs where same inputs must yield deterministic, safe outcomes | |
| **Contract / golden tests** — which specs or fixtures prove replay (e.g. `e2e:contracts`, idempotency keys) | |
| **Verification status** — run / scheduled / waived with SHIP_BAR tier + owner | |
| **`event_ledger`** — append-only for business facts (no DELETE; no ad-hoc UPDATE to rewrite history); compliance metadata redaction only via existing controlled paths | |

*If N/A:* **No replay-sensitive or idempotent mutation paths (reason: …).**

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

## 10b. Test obligations (E2E / contract / stress)

| Item | Declaration |
|------|-------------|
| **`npm run typecheck` / `npm run build`** — required per `docs/SHIP_BAR.md` for intended tier | |
| **E2E** — suite(s) or manual protocol; CI truth vs local (`docs/CD_CONTRACTS_AND_CORE_SLICE.md`) | |
| **Contract / replay** — `e2e:contracts` or equivalent when RPC/job chains touched | |
| **Stress / §15.0** — degradation behavior tested or explicitly deferred with owner | |
| **Waivers** — any skip documented with tier + risk owner | |
| **§9a surfaces** — if **§1** any §9a row is **yes**: name **E2E suite, manual protocol, or waiver** (tier + owner) covering trip workspace / readiness / context strip / FOCL visibility as applicable | |

*If trivial doc-only:* **No automated test delta (reason: …).**

---

## 11. Dependency impact declaration

| Item | Declaration |
|------|-------------|
| **Screens / routes / components** affected (traveler, FOCL, admin) | |
| **APIs / RPCs / consumers** (including mobile or partner callers if any) | |
| **Docs** — SYSTEM_TRUTH, RUNBOOK, SHIP_BAR snapshot, GO_PROGRESS, etc. | |
| **Tests** — specs to add/update/remove | |
| **§9a — Trip workspace** — **Touched: Y/N.** If Y, plain-language downstream risk | |
| **§9a — Readiness** — **Touched: Y/N.** If Y, plain-language downstream risk | |
| **§9a — Right Now / context engine** — **Touched: Y/N.** If Y, plain-language downstream risk | |
| **§9a — FOCL / activation / notification–registry** — **Touched: Y/N.** If Y, plain-language downstream risk | |

**Plain-language summary for reviewers (what could break downstream):**



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
