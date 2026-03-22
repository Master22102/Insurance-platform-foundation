# Core Flow Governance Implementation Matrix

This matrix converts Sections `3.0`, `3.1`, `3.2`, `3.3`, `3.4`, `3.5`, `3.6`, and `4.1` into executable platform work for the current codebase.

## Status Legend

- `Implemented`: present and materially aligned
- `Partial`: present but not fully doctrine-aligned
- `Missing`: doctrine requires new schema/rpc/flow

## A) Governance Substrate (`3.0`)

| Requirement | Current Status | Evidence in Repo | Gap | Next Implementation |
|---|---|---|---|---|
| Canonical event ledger, append-only, registry-backed | Partial | `supabase/migrations/20260227012733_20260226190000_governance_substrate_v1.sql` | Several product mutations still bypass strict guard+emit invariants | Route all mutation RPCs through `precheck_mutation_guard` + `emit_event` and add regression test battery |
| Canonical mutation class registry + minor invariants | Partial | `supabase/migrations/20260320160000_section2_identity_guarded_mutations.sql` | Identity classes exist but enforcement coverage is incomplete across all mutation surfaces | Add DB-level guard assertions and blocked-attempt event checks for all classes |
| Region operational modes and release battery gates | Partial | governance substrate migration + feature registry migrations | Release battery not fully wired to deploy gate in repo tests | Add CI database test that fails on missing registry/event/trace prerequisites |

## B) Data Objects and Schema (`3.2`)

| Object Family | Current Status | Evidence in Repo | Gap | Next Implementation |
|---|---|---|---|---|
| `trips` + maturity fields | Partial | `supabase/migrations/20260315070853_add_trip_core_fields.sql` | Needs full readiness-confirmation + downgrade lifecycle enforcement | Add readiness fields/rpcs and strict state transition guard tests |
| `policies` + `policy_versions` immutable | Implemented (base) | `supabase/migrations/20260305195803_create_policies_and_policy_versions.sql` | Missing full incident-time benefit linkage and stricter confidence-tier enforcement | Add policy version acceptance guard (HIGH/USER_CONFIRMED auto-close only) |
| `claims` doctrine alignment | Partial | `supabase/migrations/20260314174809_20260315000001_M23_claims_doctrine_alignment.sql` | UI/flow chain not fully wired from incident routing to packet lifecycle | Implement claim packet generation flow + E2E chain assertions |
| `scan_jobs` / `scan_credit_ledger` deterministic entitlement | Partial | existing scan APIs + quick-scan tests | Need strict deep-scan credit ledger semantics and full doctrine state events | Add scan ledger RPC + tests for grant/consume/insufficient paths |
| Draft v1.1 objects (`TripDraftVersion`, `RouteSegment`, `UnresolvedItem`, narration) | Partial | app draft routes and readiness surfaces exist | Schema and event model are not fully aligned with 3.2 v1.1 object doctrine | Implement missing tables/rpcs with immutable narration + blocker/warning split |

## C) Incident OS + Causality (`3.1` + `3.4`)

| Requirement | Current Status | Evidence in Repo | Gap | Next Implementation |
|---|---|---|---|---|
| Incident must be created atomically with CCO | Partial | incident routes exist; causality doctrine docs present | Atomic create contract is not fully verified by E2E or DB tests | Add single RPC `create_incident_with_cco` and migration test for rollback on CCO failure |
| Versioned CCO with dual-branch + supersedence | Partial | claims doctrine migration includes related event types | Active branch supersedence and routing rebinding need strict guarantees | Add CCO version tables/rpcs and deterministic replay tests |
| Evidence-gated Review progression | Partial | incident/evidence flows present | Need hard gate contract and late-evidence reevaluation behavior | Add state-machine RPC checks + event emissions for reevaluation supersedure |

## D) Passenger Rights + Resolution Engine (`3.6`) and Coverage Graph (`3.3`)

| Requirement | Current Status | Evidence in Repo | Gap | Next Implementation |
|---|---|---|---|---|
| Statutory rights as first-class deterministic source (`statutory_right`) | Partial | M23 adds `FAM-16` + `coverage_nodes.source_type` support | Rule tables and disruption-state consequence engine not fully implemented | Add statutory rule registry tables + deterministic evaluator RPC |
| Consequence matrix (voucher/refund/rebook) and state machine | Missing | docs only | Needs operational state machine + events + UI guidance integration | Add `disruption_resolution_state` on incidents and transition RPC/events |
| Never expose AMBIGUOUS/GAP labels to traveler | Partial | doctrine-aware language in docs, some UI alignment | Not fully enforced at response layer | Add response normalizer for traveler-facing messaging |

## E) Section 4.1 Policy/Governance Integration

| Requirement | Current Status | Evidence in Repo | Gap | Next Implementation |
|---|---|---|---|---|
| Deterministic pipeline chain (upload->hash->extract->version->audit) | Partial | upload/extraction APIs + policy tables | Needs explicit canonical hash contract and immutable historical replay tests | Add pipeline version/hash assertions at ingestion completion |
| Incident-time credit card guide resolution | Partial | docs and stubs, some clause taxonomy support | Guide registry/version selection logic not fully wired | Add `registry_guide_versions` + incident-time resolver RPC |
| Jurisdiction-layered filtering and disclosure registry | Missing/Partial | schema hints and doctrine migrations | Needs state/country registry + disclosure rendering contract + audit events | Add regulatory constraint tables + enforcement query layer |

## F) E2E Coverage Mapping (Current)

- **Passing now**:
  - `tests/e2e/section5-staged-smoke.spec.ts` on `chromium-desktop` and `webkit-mobile`
  - Existing smoke/regression suite around onboarding, tabs, draft persistence, scan transitions
- **Still needed for doctrine-complete core flow**:
  - Policy upload -> extraction -> `policy_version` acceptance confidence path
  - Incident creation with atomic CCO + evidence gate + routing recommendation versioning
  - Claim sequencing chain (incident -> claim packet(s) -> outcomes)
  - Statutory rights branch tests (EU261/DOT/Montreal) with deterministic fixtures
- **Pipeline truth (trip → graph → `route_claim`):** See **`docs/CORE_PIPELINE_STATUS.md`**. **App:** `compute_coverage_graph` + `route_claim` run from the claim-route flow; deep scan triggers graph build best-effort; **`tests/e2e/pipeline-coverage-golden-path.spec.ts`** asserts graph + routing + packet (needs DB migration **`20260326120000_e2e_seed_minimal_coverage_for_trip.sql`**). **`docs/INVOKE_COVERAGE_GRAPH_DECISION.md`** — `invoke_coverage_graph` vs `compute_coverage_graph`.

## Next Three Build Slices (Execution Order)

1. **Policy + Governance deterministic slice**
   - Harden ingestion pipeline invariants
   - Add confidence gating contract (`HIGH` or `USER_CONFIRMED` closes coverage gaps)
   - Add E2E: upload sample -> complete extraction -> verify policy/version/events

2. **Incident/CCO deterministic slice**
   - Implement `create_incident_with_cco` atomic RPC
   - Add late-evidence reevaluation and routing supersedure
   - Add E2E: create incident -> attach evidence -> verify review gate and recommendation version

3. **Claim + statutory resolution slice**
   - Implement disruption resolution state machine and statutory rights evaluator
   - Add claim sequencing and deadline behavior
   - Add E2E: disruption -> offer decision -> routing -> claim packet outcome path

## MVP Reliability Targeting

- Current practical readiness: core surfaces are present, but doctrine-complete flow remains incomplete.
- After slices 1-3 above: platform can be considered a strong, doctrine-aligned MVP candidate for policy/incident/claim chain.

## Slice 1 Cross-Domain Gap Applicability

This section marks whether each domain gap materially applies to the current Slice 1 work (`4.1` policy/governance deterministic path).

| Gap Domain | Applies to Slice 1? | Why |
|---|---|---|
| Governance substrate (`3.0`) guard+emit completeness | **Yes** | Policy ingestion transitions must be event-ledger bound and registry-backed to be doctrine-valid |
| Data objects (`3.2`) policy confidence-tier contract | **Yes** | `HIGH`/`USER_CONFIRMED` gate determines whether extracted versions can auto-close gaps |
| Incident OS + CCO (`3.1`/`3.4`) atomic incident creation | **Not yet (Slice 2)** | Required for incident correctness, but not blocking policy ingestion determinism |
| Passenger rights + resolution engine (`3.6`) consequence state machine | **Not yet (Slice 3)** | Depends on policy and incident outputs but does not block policy extraction completion |
| Section `4.1` guide resolution + jurisdiction registry | **Partial (next in Slice 1)** | Policy extraction path is active; incident-time guide resolver and jurisdiction overlay remain open |
| E2E policy chain (`upload -> extract -> version -> event`) | **Yes** | Core verification path for this slice; currently environment-gated and requires route stabilization |

## G) Newly Added Doctrine Crosswalk (`12.4` / `12.5` / `12.6` / `12.7` / `12.9`)

| New Section Requirement | Current Status | Applies to Current Policy Slice? | Gap | Next Implementation |
|---|---|---|---|---|
| `12.4` Feature Registry canonical lifecycle (`DESIGNED -> ... -> ACTIVE`) | Partial | **Yes** (governance coupling) | Existing feature-flag tables exist, but explicit lifecycle preflight gating is not fully enforced across all activations | Add strict transition RPC guard + registry-first activation assertion (`FA-I-01`, `FA-I-02`) |
| `12.4.3` Universal preflight checks (10 checks, non-skippable) | Partial/Missing | **Yes** | Current activation flows do not present/record full 10-check preflight result set before activation confirmation | Add `feature_preflight_checks` table + evaluator RPC + mandatory ledger emit on each activation attempt (`FA-I-03`) |
| `12.4.4` Activation Snapshot before production activation | Missing/Partial | **Yes** | Rollback anchor snapshot is not consistently created/enforced as pre-activation gate | Add immutable `activation_snapshots` object and block activation if snapshot creation fails (`FA-I-04`) |
| `12.4.5` Continuous adversarial engine + relevance-filtered queue | Partial | **Indirect** (slice-adjacent) | Pieces exist in FOCL/inbox, but no formal always-on adversarial run cadence and discovery gate SLA contract | Add adversarial run registry + mode discovery gate + queue relevance filter enforcement (`FA-I-07`, `FA-I-08`) |
| `12.4.7` key rotation concrete intervals + FOCL alert severities | Missing/Partial | **Indirect** | Rotation event model exists in parts, but concrete interval policy and P1/P2 enforcement mapping are not codified in one enforceable schedule | Add rotation schedule registry + overdue detector + FOCL severity mapping; mirror into `12.7` implementation docs (`FA-I-10`) |
| `12.5` Airline connector structured events and downgrade logic | Missing/Partial | **Not blocking policy upload slice** | Required event families (`connector_submission_*`, downgrade/fallback/oAuth telemetry) and threshold evaluators not fully present | Implement connector event schema + threshold daemon + downgrade state machine (`Enabled/Degraded/Manual Only/Under Review`) |
| `12.6` QA formal matrix + release gating percentages | Partial | **Yes** (for release criteria) | Existing E2E coverage is strong but does not yet encode formal matrix gates (`>=95%`, no unresolved downgrade defects, no unclassified reason codes) | Add release-gate test aggregator and machine-readable matrix coverage report in CI |
| `12.9` Internal LLM architecture (self-hosted + fallback governance) | Designed only | **Not blocking policy chain MVP** | No internal LLM runtime deployment contract yet; this is architecture-level and Phase progression work | Track as Phase plan epic; keep external fallback path deterministic in current slice |

## H) Security + Compliance Crosswalk (`8.1`–`8.6`, `8.8`, `8.9`, `8.10`)

| Security Requirement | Current Status | Applies to Current Policy Chain Unblock? | Gap | Next Implementation |
|---|---|---|---|---|
| `8.3` T1/T2 encryption + SSE-KMS + short presigned TTL | Partial | **Yes** | Storage/upload path must prove SSE-KMS enforcement and short-lived URL policy in tests and audit events | Add explicit upload-path assertions + security event coverage in E2E and DB tests (`S-INV-02`, `S-INV-03`) |
| `8.3.7` no-plaintext invariant | Partial | **Yes** | Need stronger guard that sensitive fields/tokens/signatures never appear in logs/events/errors | Add log redaction checks + CI grep-equivalent policy test for forbidden plaintext artifacts (`S-INV-04`) |
| `8.4` transactional emit-or-rollback structural actions | Partial | **Yes** | Some state transitions still rely on best-effort emit behavior and do not fail closed | Move mutation paths to strict transactional `emit_event` contract with rollback on emit failure |
| `8.4.7` logging failure posture (capture continues, structural blocks) | Partial | **Yes** | Policy chain tests currently prove happy-path status but not degraded logging posture behavior | Add targeted reliability tests for logging backpressure and ledger outage behavior preserving capture flows |
| `8.5` safe failure UX + non-alarmist traveler messaging | Partial | **Yes** | Upload/extraction failures need tighter doctrine wording and explicit next-step continuity | Normalize failure copy and verify 2AM Airport rule behavior in E2E (`one next action`, no panic wording) |
| `8.6.1` 14-point per-feature security declaration | Missing/Partial | **Yes** | Feature-level checklist is not consistently attached to active features in code/docs | Add a feature security declaration artifact for `F-6.5.1` and enforce as release gate (`S-INV-10`) |
| `8.6.3` AI sandboxing + no ledger write without human confirm | Partial | **Slice-adjacent** | AI-assisted paths need explicit confirmation boundaries and model-version trace consistency | Add explicit confirmation gate checks and ITR model-version assertions in ingestion-assist surfaces |
| `8.8` breach narrative workflow + mobile/Founder reach + FIP | Missing/Partial | **Not blocking policy upload chain** | Event families and workflow objects for FIP / two-gate law enforcement protocol not yet implemented | Track as FOCL security epic; implement event registry + workflow surfaces (`BR-I-11`..`BR-I-22`) |
| `8.9` right-to-erasure with immutable-ledger reconciliation | Missing/Partial | **Not blocking immediate unblock, but required for EU readiness** | `erasure_redaction_log` and PII redaction flow over immutable ledger not yet present | Add migration + RPC pipeline for erasure processing and actor anonymization (`E-I-01`..`E-I-09`) |
| `8.10` third-party API governance + vendor approval/audit logging | Partial | **Slice-adjacent** | API call audit controls and approval checklist enforcement are not fully codified as runtime gates | Add `api_call_audit_log`, vendor registry + approval state checks, and spend-cap event hooks |

### Immediate Impact On Current Unblock

- **Must satisfy before removing policy-chain skip:** `8.3`, `8.4`, `8.5`, and `8.6.1` minimum controls for `F-6.5.1`.
- **Can proceed as next epics after unblock:** `8.8` breach/FIP workflows, `8.9` erasure protocol implementation, `8.10` vendor governance hard gates.

## I) AI Confidence + Tiering + Pricing + Payment Crosswalk (`9.2`, `9.5`, `10.2`, `10.3`)

| Requirement | Current Status | Applies to Current Policy Chain Unblock? | Gap | Next Implementation |
|---|---|---|---|---|
| `9.2` canonical confidence label enum + deterministic non-predictive language | Partial | **Yes** | Existing confidence handling is present but not fully aligned to canonical enum (`HIGH_STRUCTURAL_ALIGNMENT`, etc.) and explicit anti-predictive guard | Add canonical enum mapping layer + prohibited-expression regression tests + render placement checks |
| `9.2.9` confidence logging contract (`confidence_label`, `confidence_version`, clause refs, CCO ref) | Partial | **Yes** | Not all interpretive outputs emit full confidence envelope consistently | Add mandatory event payload schema checks in API/RPC + E2E assertions for confidence metadata presence |
| `9.5` AI tiering and fallback governance (Tier1/Tier2/Tier3) | Partial/Designed | **Slice-adjacent** | Current routing/fallback posture exists in parts but lacks complete tier policy and escalation event semantics | Implement routing policy object + escalation/fallback event model (`ai_tier_escalated`, `ai_fallback_triggered`) |
| `9.5.5` protective-mode AI behavior (quality depth may drop, classification logic must not) | Partial | **Yes** | Need hard rule that protective throttling cannot alter confidence classification outcomes | Add protective-mode tests verifying invariant classification under throttled explanation depth |
| `10.2` entitlement governance (quick/deep scan, anti-abuse, no silent consumption) | Partial | **Not blocking policy upload E2E, but core monetization blocker** | Existing scan/credits exist, but full amended entitlement constraints and counters are not fully codified | Add entitlement ledger + RPC gate checks + full event set conformance from `10.2.9`/`10.2 v1.2` |
| `10.2` amendment pricing posture (`$44.99` deep scan, tier constraints, transparency) | Partial/Doc-only | **Not immediate unblock** | Pricing constants and UI copy likely drift from amended doctrine | Add centralized pricing config + doctrine-copy checks + FOCL-configurable non-retroactive versioning |
| `10.3` atomic payment + entitlement doctrine | Missing/Partial | **Not blocking current policy chain unblock, but launch-critical** | Need canonical payment transaction RPC sequence with emit-or-rollback, idempotency, desync remediator | Implement payment core tables/RPCs + reconciliation jobs + invariant tests (`PAY-I-01..PAY-I-12`) |
| `10.3.4` append-only credit ledger + no ghost entitlements | Missing/Partial | **Not immediate unblock** | Credit semantics are split across features; no single append-only ledger authority with strict gate | Add `credit_ledger` canonical table + `check_credit_balance()` gate for paid actions |
| `10.3.5` auditor/bank/investor export binding for financial integrity | Partial | **Slice-adjacent** | Export profiles exist conceptually but finance doctrine bindings and completeness states need stricter enforcement | Add financial export completeness manifest checks and profile-specific field validation |

### Doctrine-Driven Priority (Updated)

1. **Finish policy-chain unblock and hard-pass E2E gate** (`4.1` + `8.3/8.4/8.5/8.6` + `9.2` logging).
2. **Implement canonical confidence governance** (`9.2`) across policy/coverage/claim-facing surfaces.
3. **Land entitlement + pricing enforcement** (`10.2` + amendments) with append-only event coverage.
4. **Build payment atomic core** (`10.3`) before monetization activation.
5. **Expand AI tier/fallback controls** (`9.5`) after confidence and payment invariants are stable.

## J) Finish-Started-First Execution Queue (Production Readiness Gate)

| Started Domain | Current Stage | Foundation Risk If Deferred | Required Screen/FOCL Surface | Finish Criteria |
|---|---|---|---|---|
| Policy upload -> extract -> status -> event (`4.1`, `8.4`, `9.2`) | In progress / mostly functional | Silent drift between queue writes and event ledger coverage | Traveler upload screen + FOCL Ops event feed | Atomic enqueue RPC live, E2E deterministic pass, confidence envelope asserted |
| Confidence enum governance (`9.2`) | In progress | Mixed enum usage undermines audit consistency | Traveler status card + FOCL explain-why view | Canonical enum mapping shared; all interpretive outputs emit `confidence_label` + `confidence_version` |
| Entitlement enforcement (`10.2` + amended) | Partially started | Consumption without full event trace violates monetization integrity | Pricing/paywall screen + FOCL Financials and Decision Queue | Emit-or-rollback entitlement mutation path, append-only ledger checks, regression gates for no silent consumption |
| Secure upload invariants (`8.3`, `8.5`, `12.6.2.a`) | Partially started | Unsafe failure can acknowledge completion without durable path or valid auth scope | Upload flow + FOCL Attention for failure reasons | Invalid path/policy rejected, deterministic safe-failure messaging, explicit matrix regression coverage |
| Feature lifecycle governance (`12.4`) | Started in docs/matrix | Activation drift without cockpit controls blocks production governance | FOCL Features tab + activation wizard | Registry + lifecycle transitions enforced, preflight checks logged, blocked-state plain-language reasons |

### Stability Rule (Applied To Every Started Feature)

1. **No new feature starts before all in-progress slices have deterministic E2E or integration gates.**
2. **Every started capability must map to at least one user-facing screen and, when governance-sensitive, one FOCL surface.**
3. **Every structural mutation path must prove emit-or-rollback behavior before expansion.**
4. **All fallback paths must fail safe, visible, and replayable (`8.5`).**
