# Doctrine 1.9 — Codebase audit (Full-stack binding + structural truth)

**Status:** Baseline audit vs **§1.9.0 (full-stack feature binding)** and **§1.9.1–1.9.14 (constitutional / structural truth)**.  
**Authority:** User-provided doctrine is **binding** for future work; this file records **compliance**, **partial compliance**, and **gaps**.

Companion artifacts:

- `lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md` — required drafting checklist for every new capability.
- `lib/SECTION_1_MISSION_TONE_BOUNDARIES.md` — constitutional mission/tone/boundary anchor for product and copy.
- `lib/FOCL_INACTIVE_FEATURE_DESCRIPTOR_TEMPLATE.md` — required founder-facing status + activation prerequisites for inactive features.
- `.cursor/rules/doctrine-1.9-structural-truth.mdc` — agent/IDE enforcement.
- `lib/MISMATCH_LOG.md` — dated deltas for doctrine-driven fixes.
- `lib/SECTION_7_INDEX.md` — Section **7** excerpts (7.2 OAuth, **7.3** screen registry, 7.4 voice, **7.8** decision communication, 7.9 delivery).

---

## §1.9.0 Full-stack feature binding — platform inventory

| Binding category | Present in codebase | Assessment |
|------------------|----------------------|------------|
| **UI surface(s)** | Trips, incidents, group authority, account, FOCL cockpit, marketing `app/page.tsx` | ⚠️ Partial — many backend paths (workers, scripts) lack a declared UX contract in-repo |
| **7.3 registry entries** (`focl_notification_destinations`, notification routes) | `focl_notification_destinations` + `app/api/focl/notification-settings` | ⚠️ Partial — not every feature documents “none required” vs required destinations |
| **Cockpit controls** (toggles, region rollout) | `feature_registry`, `feature_activation_state`, `set_feature_activation_state`, FOCL `useFeatureIntelligence` | ✅ Strong for registered features; **silence elsewhere = violation** |
| **Entitlement / §10.2** | `user_profiles` tiers, `check_membership_entitlement` (documented in `ACCOUNT_MEMBERSHIP_USAGE.md`) | ⚠️ Partial — not all gated features call entitlements in UI/API |
| **Governance events §3.0** | `emit_event` on identity RPCs, `initiate_deep_scan`, extraction routes/workers | ⚠️ Partial — not every mutating path verified for ledger pairing + registry |
| **Permission scope §8.4** | RLS + `SECURITY DEFINER` RPCs; group/export/verification tightened in Section 2 migration | ⚠️ Partial — no single §8.4 matrix doc tied to each RPC |
| **Confirmation gates** (mutations / voice proposals per **7.4**) | e.g. Deep Scan explicit checkbox + `p_user_confirmed` | ⚠️ Partial — many mutations (group page actions) lack confirm step |
| **§7.8 interpretive output structure** | `InterpretiveBoundaryNotice`; Deep Scan / routing copy moves toward structural truth | ⚠️ Partial — not all surfaces use full 7.8.1 ordering + approved vocabulary |
| **Schema / versioned objects** | Migrations timestamped; ledger event types registered | ⚠️ Partial — interpretive outputs not universally versioned/immutable store |
| **RPC contracts (guarded, replayable)** | `precheck_mutation_guard` on governed paths; idempotency varies by RPC | ⚠️ Mixed — must be stated per RPC in drafts |
| **Stress / §15.0 degradation** | `precheck` PROTECTIVE/RECOVERY; connector `degraded` status in Deep Scan | ⚠️ Partial — no documented “stress playbook” per feature |
| **Release blocking conditions** | Implicit via FOCL health metrics | ❌ Gap — **explicit RB checklist not centralized** |

**Invariant conclusion:** The repo **does not yet systematically prove** §1.9.0 for each feature. **Silence is not compliance** — every new PR must attach the checklist (`FEATURE_FULLSTACK_BINDING_TEMPLATE.md`) with explicit “No … required” lines where applicable.

---

## §1.9.1 Constitutional authority

- **Doctrine vs implementation:** Documented here and in Cursor rule; implementation conflicts should be resolved in favor of doctrine.
- **Gap:** No automated linter for interpretive language; rely on review + this audit.

---

## §1.9.2 Determinism principle

| Area | Assessment |
|------|------------|
| `lib/decision-language.ts` | ✅ **Deterministic** mapping from structured inputs → posture/guidance (no RNG). |
| Deep Scan / connectors | ⚠️ Connector **availability** can change outputs; doctrine §1.9.11 requires structure to remain intact when degraded — surface **degraded** clearly (partially done in UI). |
| AI extraction workers | ⚠️ If non-deterministic models are introduced, outputs must still be **clause-bound** and stored as **structural artifacts**, not silent overrides. |

---

## §1.9.3 Structural truth standard

| Finding | Location | Risk |
|---------|----------|------|
| Predictive / outcome-oriented marketing copy | `app/page.tsx` hero, steps, testimonials; trip unlock blurbs | **High** — implies certainty of coverage / filing outcomes |
| “Confirmed coverage” labeling | `DeepScanPanel.tsx` signal section | **Medium** — reads like guaranteed truth vs documented alignment |

**Remediation:** Copy tightened in-product toward **documented alignment**, **filing structure**, and **no payout prediction** (see recent edits + keep iterating).

---

## §1.9.4 Causality preservation

- Incident / routing copy in places still uses informal sequencing language — generally OK if **dependencies** are explicit.
- **Gap:** No unified “causality unknown” state machine in UI for interpretive branches.

---

## §1.9.5 Optionality preservation

- **Gap:** Single-path UX (one “best” recommendation) in some flows — doctrine requires **visible branches** when structurally valid alternatives exist.
- **Action:** When routing suggests an order, label it as **one documented ordering**, not the only valid ordering.

---

## §1.9.6 Ambiguity handling

- Decision language sometimes collapses to posture without an explicit **ambiguity** bucket.
- **Gap:** Add explicit “undefined / ambiguous clause” surface where extraction confidence is low (rename fields over time from `confidence_label` → **structural clarity** per §1.9.10).

---

## §1.9.7 Conflict transparency

- Deep Scan exposes gaps/risks/positives — **good directional fit**.
- **Gap:** No guaranteed **cross-document conflict** panel (policy A vs policy B) in all modes.

---

## §1.9.8 Non-mutation guarantee (historical immutability)

- Ledger `emit_event` supports audit trail for many mutations.
- **Gap:** User-visible “interpretive reports” should be **append-only** (new version on reinterpretation) — not fully modeled in app layer.

---

## §1.9.9 Drift containment

- FOCL rollout health + feature status: partial supervision story.
- **Gap:** No formal drift alarm tied to **classification changes** on same inputs (needs replay harness).

---

## §1.9.10 Confidence integrity

| Finding | Location | Note |
|---------|----------|------|
| Label “Confidence: high/medium/low” | `DeepScanPanel.tsx` | Renamed/framed as **structural clarity** to avoid statistical implication |
| `confidence_label` in extraction mocks | `policy-extraction-worker` | Technical debt — align naming with **structural clarity** |

---

## §1.9.11 Survivability requirement

- `precheck_mutation_guard` + PROTECTIVE limits: **aligns** with “no silent shortcutting” for governed mutations.
- Deep Scan: group residence gate + connector degraded states — **partial** alignment.
- **Gap:** Explicit §15.0 test cases per feature.

---

## §1.9.12 Non-coercive communication

- Marketing urgency/scarcity: review hero and unlock pricing copy for **pressure** framing (ongoing).
- Product UX: generally informational; credits warnings are factual (OK).

---

## §1.9.13–1.9.14 Hierarchy & scope

- Doctrine applies to **all interpretive surfaces**, not only LLM paths.
- This audit + template + Cursor rule operationalize scope for engineering.

---

## Prioritized next actions

1. **Process:** Require `FEATURE_FULLSTACK_BINDING_TEMPLATE.md` on every feature PR.
2. **UX/legal defensibility:** Second pass on **marketing + unlock** strings for §1.9.3 / §1.9.12.
3. **Data model:** Versioned interpretive artifacts + append-only history (§1.9.8).
4. **Terminology:** Replace “confidence” with **structural clarity** in user-visible strings and types over time (§1.9.10).
5. **Tests:** Replay fixtures for deterministic outputs (§1.9.2) on core interpretive functions.

---

## Product decisions captured

- Boundary statement should render **once per interpretive session/output** in a **stable placement**.
- Corporate logic is **additive** to existing account/tier infrastructure (merge forward, do not replace baseline unless explicitly superseded).
- Inactive/staged features require founder-facing status language and explicit activation prerequisites.
