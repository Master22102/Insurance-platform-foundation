# Section 5.0 Parity Audit Matrix (Strict)

Date: 2026-03-18 · **Section 5 sweep 2026-03-21**  
Scope: Canonical Section 5.0 + Draft Home amendment (4D/4E/4F renumbering) provided by product.  
Method: Code and test audit against implemented surfaces, copy, and flow behavior.  
**Section 7:** Screen registry, voice authority, 7.8 output shape, delivery doctrine → `lib/SECTION_7_INDEX.md` (not Section 5 step numbers).

Status legend:

- `Implemented` = present and functionally aligned
- `Partial` = present but incomplete or copy/behavior drift
- `Missing` = no clear implementation found
- `Staged` = intentionally not launch-ready; requires explicit FOCL activation prerequisites

---

## Constitutional Rules (5.0.0)

| Requirement | Status | Evidence | Gap / Action |
|---|---|---|---|
| Requires at least one anchor (Trip and/or Policy) | Implemented | `app/(app)/get-started/page.tsx`, app gating behavior in tests | Keep |
| No silent mutation / no silent realignment | Partial | governance/ledger patterns in migrations + RPCs; not universal for all feature paths | Continue expanding guard+emit pattern to all mutating paths |
| Voice is proposal -> explicit confirmation | Implemented | `app/(app)/onboarding/page.tsx`, `app/(app)/trips/[trip_id]/draft/voice/page.tsx` | Keep |
| Same `ItineraryHash` -> same Quick Scan (account-bound) | Partial | quick-scan docs/mismatch references; hash shown in `components/scan/QuickScanResult.tsx` | Add explicit replay/idempotency test proving same-hash determinism |

---

## Step-by-Step Matrix

| Step | Canonical Intent | Status | Evidence | Gap / Action |
|---|---|---|---|---|
| 0 Splash | "Travel is chaotic" + CTAs | Implemented | `app/splash/page.tsx` | Hero + canonical line "Your decisions don't have to be." + structural-truth subcopy + Let's get started / Log in |
| 1 Account creation | email/password/confirm + password helper/exposure behavior | Implemented | `app/(auth)/signup/page.tsx` | Inline helper + rules panel + exposed-password branch + guardian footnote |
| 1.5 Terms + Privacy (must precede voice) | Terms/Privacy gate before voice | Implemented | `app/terms-consent/page.tsx`, `app/(app)/onboarding/page.tsx` | Signup/signin gated by terms-consent; onboarding uses `step='terms'` first then signal |
| 2 User signal layer | voice-first, skippable, summary confirm/edit/start over, only confirm commits | Partial | `app/(app)/onboarding/page.tsx`, `lib/speech/useSpeechCapture` usage | "Here's what I heard", triad label line, Confirm/Edit/Start over + Edit preserves text; optional: stricter full-spec copy audit |
| 3 Anchor activation choice | "Let's get started" with 3 choices | Implemented | `app/(app)/get-started/page.tsx` | Keep |
| 4A Itinerary upload path | upload/import/paste/manual + unsupported/too-large handling + review/confirm | Partial | `app/(app)/trips/new/page.tsx`, `/api/itinerary/normalize` usage | Core handling exists; needs explicit "Review your trip" canonical confirmation wording parity |
| 4B Policy-only path | add policy without trip, still useful | Implemented | `app/(app)/policies/upload/page.tsx` | Keep |
| 4C Planning draft path | tentative inputs -> draft state | Partial | `app/(app)/trips/new/page.tsx`, trip maturity states in trip pages | Draft creation exists; canonical fields (budget/people count max constraints) not fully explicit |
| 4D Draft Home workflow | voice/manual -> route -> activities -> unresolved -> readiness | Implemented | `app/(app)/trips/[trip_id]/draft/*`, `lib/draft-home/draft-home-api.ts`, `tests/e2e/draft-home-persistence.spec.ts` | Keep; continue hardening persistence and edge validation |
| 4E Readiness gate | confirm readiness before Deep Scan | Implemented | `app/(app)/trips/[trip_id]/draft/readiness/page.tsx`, `advance_trip_maturity` call | Keep |
| 4F Quick/Deep after readiness | Deep scan unblocked after readiness | Implemented | `app/(app)/trips/[trip_id]/page.tsx`, `components/DeepScanPanel.tsx` | Keep |
| 5 Quick Scan automatic when structured | auto trigger and persisted outputs | Partial | trigger logic in `app/(app)/trips/new/page.tsx`; UI in `components/scan/QuickScanResult.tsx` | Need stricter determinism/replay assertion + explicit persistence proof artifact |
| 5.5 Readiness pins | passport/visa/vax/docs + continue | Implemented | `app/(app)/trips/[trip_id]/readiness-pins/page.tsx` | Keep |
| 6 Deep Scan (explicit, atomic, no auto) | preflight + confirmation + atomic deduction/job + group gate | Implemented | `components/DeepScanPanel.tsx`, `supabase/migrations/20260320103000_group_authority_foundation.sql`, `tests/e2e/scan-transitions.spec.ts` | Keep |
| 7 Insurance options (off-platform) | option cards, broker boundary screen, group jurisdiction modes | Staged | `app/(app)/trips/[trip_id]/section-5-staged/insurance-options`, `F-5.0.7-STEP-INSURANCE-OPTIONS` | Full option cards + group modes: FOCL off; broker-boundary copy on staged surface |
| 8 Policy ingestion post-purchase | purchase confirmation then ingest path | Staged | `.../section-5-staged/post-purchase-policy`, `F-5.0.8-STEP-POST-PURCHASE-INGEST` | Wire purchase-confirm + guided ingest when activated |
| 9 Coverage Q&A voice mode | clause-cited Q&A, uncertainty downgrade | Partial | `route/page.tsx` + `lib/decision-language.ts` | **"Questions before we lock this in?"** collapsible checklist on claim routing (guidance only) |
| 10 Alignment confirmation | explicit trip+policy binding screen | Staged | `.../section-5-staged/policy-alignment`, `F-5.0.10-STEP-POLICY-ALIGNMENT` | Versioned bind + RPC + events when activated |
| 11 In-trip workspace | dashboard core tools + card-benefit applicability prompt | Partial | `app/(app)/trips/[trip_id]/page.tsx` trip workspace strip | Card/benefit upload prompt added; expand if spec adds dedicated surface_id |
| 12 Trip end reminder | single neutral 48h reminder | Staged | `.../section-5-staged/trip-end-reminder`, `F-5.0.12-STEP-TRIP-END-REMINDER` | Notifications + single-send guard when activated |
| 13 Extension flow | create continuation trip + incentives | Staged | `.../section-5-staged/trip-extension`, `F-5.0.13-STEP-TRIP-EXTENSION` | Continuation model when activated |
| 14 Post-trip closure | complete + export/retention | Partial | `archive_trip` + **"Trip complete — archived"** copy on `app/(app)/trips/[trip_id]/page.tsx` | Add dedicated export/closure wizard if spec requires beyond retention banner |

---

## Draft Home Amendment (Strict Check)

| Amendment Item | Status | Evidence | Gap / Action |
|---|---|---|---|
| 4D.1 Voice/manual initial capture | Implemented | `draft/voice`, `draft/route` pages | Keep |
| 4D.2 Route building + validation indicators | Partial | `draft/route/page.tsx` has route editing | Validation severity UX exists but canonical green/yellow/red formalized route validator messaging still partial |
| 4D.3 Activity planning optional | Implemented | `draft/activities/page.tsx` | Keep |
| 4D.4 Resolve blockers | Implemented | `draft/unresolved/page.tsx` | Keep |
| 4D.5 Check readiness + confirm | Implemented | `draft/readiness/page.tsx` | Keep |
| Exit/resume behavior | Implemented | persistence checks in `tests/e2e/draft-home-persistence.spec.ts` | Keep |
| Emits (`route_segment_added`, `route_normalized`, etc.) | Partial | route operations exist via RPCs | Need explicit event-type parity audit for exact canonical names |

---

## Canonical Microcopy Parity (5.x ledger sample)

| Canonical Phrase | Status | Evidence | Note |
|---|---|---|---|
| "Let's get started" | Implemented | `app/(app)/get-started/page.tsx` | exact |
| "Taking a careful look..." | Implemented | `app/(app)/trips/new/page.tsx` | exact |
| "Dotting the i's and crossing the t's..." | Implemented | `app/(app)/trips/new/page.tsx` | exact |
| "Go ahead and speak." | Implemented | `app/(app)/onboarding/page.tsx` (voice tab + helper line) | exact |
| "Here's what I heard" | Implemented | `app/(app)/onboarding/page.tsx` summary card `h2` | exact |
| "Confirm / Edit / Start over" | Implemented | label line + buttons; Edit focuses textarea without clearing | optional: order matches spec literally (buttons are Edit / Start over / Confirm) |
| Broker boundary copy block (Step 7) | Missing | no matching surface found | implement with off-platform flow |
| "Hey — your trip is about to end in 48 hours..." | Missing | no match found | add single reminder system |

---

## Tests vs Canonical Coverage

| Area | Current Test Coverage | Gap |
|---|---|---|
| Onboarding gate | `tests/e2e/utils/ensureOnboarded.ts`, `onboarding-gating-regression.spec.ts` | Optional: literal copy assertions |
| Draft Home persistence | `tests/e2e/draft-home-persistence.spec.ts` | Strong; add event emission assertions where possible |
| Quick Scan determinism | `tests/e2e/quick-scan-determinism.spec.ts` | Same-input structural replay |
| Quick->Deep transition | `tests/e2e/scan-transitions.spec.ts` | Keep |
| Section 5 staged routes | `tests/e2e/section5-staged-smoke.spec.ts` (shell + links + invalid slug) | Deeper: activation flows, FOCL toggles, broker copy when Steps 7/8/10/12/13 activate |

---

## Priority Gap Recovery Plan (Strict)

1. **P0:** Splash, signup, onboarding, 4A review heading — done; optional string-audit nits.
2. **P0:** Quick Scan determinism + E2E credit bypass — done.
3. **P1:** Staged surfaces + **FOCL registry** (`20260321143000_section5_staged_feature_registry.sql`) for Steps 7/8/10/12/13; activate incrementally.
4. **P1:** Step 12 notifications + Step 14 export wizard when ready.
5. **P2:** Step 13 incentives + corporate continuation.

---

## Corporate/Governance tie-in from this audit

- Corporate functionality should remain **additive** and staged where incomplete.
- Any missing Section 5 flow that is not day-one should be represented as:
  - inactive/staged in FOCL,
  - explicit founder-facing blocker list,
  - activation prerequisites checklist (`lib/FOCL_INACTIVE_FEATURE_DESCRIPTOR_TEMPLATE.md`).
