-- Section 5 staged flows (Steps 7, 8, 10, 12, 13) — registry only, default off.
-- UI: /trips/:id/section-5-staged/:slug

INSERT INTO public.feature_registry (
  feature_id,
  display_name,
  description,
  default_enabled,
  minimum_mode,
  phase,
  capability_tier_current,
  capability_tier_max,
  has_pending_extension,
  connector_status
)
VALUES
  (
    'F-5.0.7-STEP-INSURANCE-OPTIONS',
    'Section 5 Step 7 — Insurance options (off-platform)',
    'Educational / handoff surfaces for coverage purchased outside Wayfarer. Broker boundary copy; no licensed sales.',
    false,
    'NORMAL',
    'Phase2',
    1,
    2,
    false,
    'not_required'
  ),
  (
    'F-5.0.8-STEP-POST-PURCHASE-INGEST',
    'Section 5 Step 8 — Post-purchase policy ingestion',
    'Confirm off-platform purchase completed; guide ingest so scans and routing match held policies.',
    false,
    'NORMAL',
    'Phase2',
    1,
    2,
    false,
    'not_required'
  ),
  (
    'F-5.0.10-STEP-POLICY-ALIGNMENT',
    'Section 5 Step 10 — Trip + policy alignment confirmation',
    'Explicit bind/lock of which policies apply to trip version; governance events on commit.',
    false,
    'NORMAL',
    'Phase2',
    1,
    2,
    false,
    'not_required'
  ),
  (
    'F-5.0.12-STEP-TRIP-END-REMINDER',
    'Section 5 Step 12 — Single neutral trip-end reminder',
    'One calm ~48h reminder; scheduling + notification guardrails.',
    false,
    'NORMAL',
    'Phase2',
    1,
    2,
    false,
    'not_required'
  ),
  (
    'F-5.0.13-STEP-TRIP-EXTENSION',
    'Section 5 Step 13 — Trip continuation / extension',
    'Continuation trip creation + optional incentives; corporate tie-ins later.',
    false,
    'NORMAL',
    'Phase2Plus',
    1,
    3,
    false,
    'not_required'
  )
ON CONFLICT (feature_id) DO NOTHING;
