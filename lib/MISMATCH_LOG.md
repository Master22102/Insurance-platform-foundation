# Wayfarer — Docs vs UI Mismatch Log

This log tracks **observable mismatches** between the documented product flows/specs and the current implementation.

## 2026-03-19

- **Missing spec artifact**: Section 5.0 references **Section 7.3 (Screen Registry)** (and related Section 7 copy/UX standards), but no corresponding Section 7 registry document was found in-repo (only Feature-ID documents referencing “Section 7.x”).
  - **Impact**: Cannot validate screen IDs (e.g. `S-DRAFT-002`) or required copy rules from Section 7 against implementation.
  - **Source**: `lib/SECTION_5.0_#U2014_Core_Product_Flows.txt` (mentions “Section 7.3 (Screen Registry)”).

- **Trip → policy upload deep link param mismatch**: “Trip created → Add a policy” linked to `'/policies/upload?trip=…'` but upload page reads `trip_id`.
  - **Fix**: Changed link to `'/policies/upload?trip_id=…'`.
  - **Files**: `app/(app)/trips/new/page.tsx`, `app/(app)/policies/upload/page.tsx`

- **Voice capture not implemented (placeholder only)**: Section 5.0 Draft Home Step 4D.1 calls for a mic-based narration path. Current implementation supports **typed narration** parsing only. Additionally, the onboarding “User Signal Layer” includes a mic UI placeholder, but the mic button is currently disabled (no real capture/provider yet).
  - **Planned**: Add adapter-based speech capture placeholder (Web Speech API now; Wispr pluggable later).

- **Quick Scan API session + credits query mismatch**: `/api/quick-scan` was using an auth client that didn’t read session cookies reliably and initially queried `user_profiles` with the wrong key (`eq('id', user.id)` instead of `eq('user_id', user.id)`), causing scan failures in E2E.
  - **Fix**: Aligned `/api/quick-scan` to use `@supabase/ssr` with request cookies and corrected the credits lookup to `eq('user_id', user.id)`.
  - **Files**: `app/api/quick-scan/route.ts`

- **Incident creation RPC param mismatch**: the incident intake UI called `create_incident` with outdated parameter names (`p_project_id`, `p_disruption_type`). The backend RPC now expects `p_trip_id` and stores disruption via `p_metadata`.
  - **Fix**: Updated `app/(app)/trips/[trip_id]/incidents/new/page.tsx` to pass `p_trip_id`, store `disruption_type` in `p_metadata`, and match the correct description payload.
  - **Files**: `app/(app)/trips/[trip_id]/incidents/new/page.tsx`

- **Policy upload completion API mismatch**: The upload UI created `policy_documents` via `initiate_policy_upload()` and then called `/api/extraction/upload-complete` with only `{ document_id }`, but the server route expected storage metadata and (previously) a service-role key, causing extraction to never queue correctly in local/dev.
  - **Fix**: Aligned client + API:
    - Client now POSTs `document_id`, `storage_path`, `policy_label`, and file metadata after storage upload completes.
    - `/api/extraction/upload-complete` now uses the logged-in session (RLS) to update `policy_documents` and insert a `job_queue` row.
    - `/api/extraction/status` now uses the logged-in session (RLS) and returns a UI-friendly status (`processing` unless terminal `complete`/`failed`).
  - **Files**: `app/(app)/policies/upload/page.tsx`, `app/api/extraction/upload-complete/route.ts`, `app/api/extraction/status/route.ts`

- **Onboarding missing vs Section 5**: The documented flow requires (a) Terms+Privacy acceptance gate before any voice capture, (b) a skippable “User Signal Layer” screen with mic + “Type instead” + “Skip for now”, and (c) a “Let’s get started” menu after onboarding. Previously, signing in dropped users directly into `/trips`.
  - **Fix**: Added `/onboarding` (Terms+Privacy + expectations) and `/get-started` (anchor activation choice menu), plus an app-level redirect to `/onboarding` when `user_profiles.onboarding_completed=false`.
  - **Files**: `app/(app)/layout.tsx`, `app/(app)/onboarding/page.tsx`, `app/(app)/get-started/page.tsx`, `tests/e2e/onboarding.spec.ts`

- **FOCL access tied to Corporate tier (incorrect authority model)**: Identity docs define founder authority as distinct from corporate client membership. FOCL is a founder command layer, not a corporate customer feature.
  - **Fix**: Added `FOUNDER` membership tier in DB constraints + entitlements, updated FOCL gate to founder-only, updated account tier UI/types, and moved the current test user from `CORPORATE` to `FOUNDER`.
  - **Files**: `supabase/migrations/20260319063000_add_founder_membership_tier.sql`, `app/focl/layout.tsx`, `lib/auth/auth-context.tsx`, `app/(app)/account/page.tsx`, `tests/e2e/focl-gating.spec.ts`

- **FOCL founder notification destination system missing**: F-6.5.7 specifies weekly digest/incident routing to founder email, but there was no persisted destination config for dedicated ops email + personal backup emails.
  - **Fix**: Added founder-only FOCL notification destinations table (RLS), API endpoints, and `/focl/notifications` settings screen.
  - **Files**: `supabase/migrations/20260319070000_focl_notification_destinations.sql`, `app/api/focl/notification-settings/route.ts`, `app/focl/notifications/page.tsx`, `app/focl/layout.tsx`

- **FOCL spec surface coverage gap remains**: Docs for F-6.5.7 call for additional founder surfaces (incident query, threshold configuration, pattern dashboard, decision queue, weekly digest links). Current UI implements feature intelligence + notification destinations, but not the full F-6.5.7 surface set yet.
  - **Status**: logged for next implementation pass.

- **Email confirmation UX mismatch**: Confirmation links previously returned users to generic home without explicit success messaging, causing confusion during signup verification.
  - **Fix**: Added explicit confirmation destination and success screen.
  - **Files**: `lib/auth/auth-context.tsx`, `app/(auth)/auth/confirmed/page.tsx`

- **Mobile UI contract divergence**: Live app routes under `app/(app)` use a responsive web shell, while the bespoke mobile visual system exists separately in prototype-style components (`components/TripHomeScreen.jsx` + `components/screens/*`) and is not the runtime surface for signed-in app routes.
  - **Impact**: Phone users see responsive web styling instead of the previously designed mobile-specific visual treatment.
  - **Status**: requires integration pass to map prototype mobile shell tokens/components into production route surfaces.

- **Quick Scan did not provide actionable guidance**: F-6.5.2 / F-6.5.5 intent calls for immediate interpretation + next-step guidance (what to do, evidence needed, claim order). The UI previously showed extracted categories/highlights but lacked explicit recommendations.
  - **Fix**: Added API-generated advisory summary, action plan, and suggested filing order, then surfaced those blocks in the Quick Scan result UI.
  - **Files**: `app/api/quick-scan/route.ts`, `components/scan/QuickScanResult.tsx`

- **Quick Scan credits decrement query mismatch (regression risk)**: Credits update used `eq('id', user.id)` while profile lookups use `user_id`; this can silently fail on common schemas.
  - **Fix**: Aligned credits decrement to `eq('user_id', user.id)` to match the existing profile key pattern.
  - **Files**: `app/api/quick-scan/route.ts`

- **E2E suite not runnable in current snapshot**: `playwright.config.ts` targets `./tests/e2e`, but the folder/specs are missing from this local workspace snapshot.
  - **Impact**: Full desktop/mobile regression run cannot execute until test specs are restored.
  - **Status**: blocked in this checkout; requires restoring committed tests folder.

## 2026-03-20

- **Section 5 Step 0 splash flow missing**: Canonical flow requires a dedicated splash screen ("Travel is chaotic...") with "Let's get started" and "Log in" as Step 0 before account flow. Current runtime starts on marketing/home and does not implement this explicit mobile-first splash step.
  - **Source**: `C:\Users\Supsa\Desktop\current documentation\SECTION 5.0 — Core Product Flows.txt`
  - **Status**: pending implementation.

- **Section 5 Step 4A itinerary ingestion capability gap**: Spec requires itinerary upload/import support for PDF, ICS, DOCX, AI itinerary text, and manual entry. Current `trips/new` surface supports typed narration + manual fields only; no ICS/DOCX/import workflow is exposed.
  - **Source**: `C:\Users\Supsa\Desktop\current documentation\SECTION 5.0 — Core Product Flows.txt`
  - **Files inspected**: `app/(app)/trips/new/page.tsx`
  - **Status**: pending implementation.

- **Section 5 Step 4B policy-only intake options incomplete**: Spec requires PDF upload + email forwarding + manual plan detail entry. Current UI supports PDF upload flow only.
  - **Source**: `C:\Users\Supsa\Desktop\current documentation\SECTION 5.0 — Core Product Flows.txt`
  - **Files inspected**: `app/(app)/policies/upload/page.tsx`
  - **Status**: pending implementation.

- **Section 5 Step 4D Draft Home workflow not mapped to runtime routes**: Route-building, validation severity bands, activity planning, unresolved blockers, and readiness gate are specified as first-class steps with dedicated screen IDs. Current runtime still uses simplified trip creation and does not expose the full Draft Home sequence.
  - **Source**: `C:\Users\Supsa\Desktop\current documentation\SECTION 5.0 — Core Product Flows.txt`
  - **Status**: pending implementation.

- **F-6.5.7 FOCL founder surface gap remains**: Incident natural-language query, threshold configuration sliders, pattern dashboard, weekly digest-linked decision queue, and retrospective storytelling surfaces are specified but not present in current FOCL runtime (current FOCL primarily provides feature intelligence + notification destination settings).
  - **Source**: `C:\Users\Supsa\Desktop\current documentation\Feature ID_ F-6.5.7.txt`
  - **Files inspected**: `app/focl/features/intelligence/page.tsx`, `app/focl/features/intelligence/hooks.ts`, `app/focl/notifications/page.tsx`
  - **Status**: pending implementation.

- **F-6.5.5 claim routing depth partially addressed**: Quick Scan now surfaces suggested filing order and action guidance, but the full incident-time acceptance checkpoint (refund/voucher/rebooking accepted), small-claim warning band, and explicit cause-classification flow described in F-6.5.5 are not fully implemented as a dedicated guided sequence.
  - **Source**: `C:\Users\Supsa\Desktop\current documentation\Feature ID F-6.5.5.txt`
  - **Status**: in progress.

- **Authenticated nav behavior is currently anchor-gated to "Let's get started"**: Deployed tests with valid session repeatedly redirect `/trips`, `/coverage`, `/scan`, etc. to the anchor selection surface (`/get-started`) for this account state. Public routes pass, but full tab traversal fails until an anchor completion path is finalized.
  - **Observed in tests**: `tests/e2e/app-everything-smoke.spec.ts` (desktop + mobile), deployed run on `https://luxury-lebkuchen-6d1677.netlify.app/`
  - **Implication**: We cannot yet claim "all tabs load end-to-end" for fresh/anchor-incomplete users; this is either intended hard-gating or a UX mismatch depending on expected navigation behavior.
  - **Fix (code-level, pending redeploy verification)**: Added explicit anchor-selection persistence in `get-started` actions and an app-layout gate that redirects to `/get-started` only until `preferences.onboarding.anchor_selection.completed === true`.
  - **Files**: `app/(app)/get-started/page.tsx`, `app/(app)/layout.tsx`
  - **Status**: in progress; needs redeploy + rerun to confirm.

