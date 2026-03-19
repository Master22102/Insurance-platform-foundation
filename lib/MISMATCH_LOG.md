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

