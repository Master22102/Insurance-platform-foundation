/*
  # M22 — Feature Registry Completion

  ## Summary
  This migration completes the feature registry by extending the feature_registry table with
  phase and capability tier metadata, correcting two placeholder feature names, applying
  phase/tier data to all existing features, inserting one new sub-capability (F-6.5.8-LIVE),
  inserting 11 features with completed specs, registering three new event types for the FOCL
  Feature Intelligence Panel, and registering three new screen surfaces for that panel.

  ## Step 1 — New Columns on feature_registry
  - phase: release phase (MVP | Phase2 | Phase2Plus)
  - capability_tier_current: currently active tier (1–3)
  - capability_tier_max: maximum tier when fully built out (1–3)
  - has_pending_extension: true when a Phase 2 sub-capability row exists but is disabled
  - parent_feature_id: FK to parent feature for sub-capabilities
  - requires_connector: plain English name of required external connector
  - connector_status: licensing/integration state of that connector

  ## Step 2 — Corrected Feature Names
  - F-6.5.8: renamed from 'Causality Linking Engine' to 'Active Disruption Options Engine'
  - F-6.5.9: renamed from 'Rebooking Event Log' to 'Participant Travel Readiness & Checklist Engine'

  ## Step 3 — Phase and Tier Metadata
  Applied to all 22 currently registered features (excluding evidence/incidents system rows).

  ## Step 4 — New Sub-Capability
  - F-6.5.8-LIVE: Phase 2 live GDS flight search, child of F-6.5.8, disabled by default

  ## Step 5 — 11 New Features (Completed Specs, Not Yet Built)
  F-6.5.17 through F-6.5.20, F-6.6.2 through F-6.6.4, F-6.6.6, F-6.6.10, F-6.6.11, F-6.7.1
  All inserted as default_enabled = false.

  ## Step 6 — New Event Types
  feature_tier_advanced, feature_extension_enabled, feature_connector_activated

  ## Step 7 — New Screen Surfaces
  FOCL_FEATURE_INTELLIGENCE, FOCL_FEATURE_SUBCOMPONENTS, FOCL_FEATURE_CONNECTOR_STATUS

  ## Security
  No changes to RLS policies, RPCs, or activation state tables.
  All INSERTs use ON CONFLICT DO NOTHING for idempotency.
  All UPDATEs use exact feature_id matches.
*/


-- =============================================================================
-- STEP 1 — Extend feature_registry with new columns
-- =============================================================================

ALTER TABLE feature_registry
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'MVP'
    CHECK (phase IN ('MVP','Phase2','Phase2Plus')),
  ADD COLUMN IF NOT EXISTS capability_tier_current int NOT NULL DEFAULT 1
    CHECK (capability_tier_current BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS capability_tier_max int NOT NULL DEFAULT 1
    CHECK (capability_tier_max BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS has_pending_extension boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_feature_id text REFERENCES feature_registry(feature_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_connector text,
  ADD COLUMN IF NOT EXISTS connector_status text NOT NULL DEFAULT 'not_required'
    CHECK (connector_status IN ('not_required','required_unlicensed','licensed_not_integrated','active'));


-- =============================================================================
-- STEP 2 — Correct two wrong feature names
-- =============================================================================

UPDATE feature_registry SET
  display_name = 'Active Disruption Options Engine',
  description  = 'Coverage-aware alternative transport guidance and preference capture during active incidents. Phase 2: live flight/transport options via GDS connector.'
WHERE feature_id = 'F-6.5.8';

UPDATE feature_registry SET
  display_name = 'Participant Travel Readiness & Checklist Engine',
  description  = 'Residence-personalized travel readiness checklist for every trip participant. Auto-updates when itinerary changes. Covers entry requirements, health requirements, platform documents, and emergency preparedness.'
WHERE feature_id = 'F-6.5.9';


-- =============================================================================
-- STEP 3 — Update phase and capability tier for all existing registered features
-- =============================================================================

-- F-6.5.1 Policy Parsing: MVP, complete, no extensions
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.1';

-- F-6.5.2 Coverage Graph: MVP Tier 1, Tier 2 unlocks when Section 3.6 statutory rights layer is added
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=2, has_pending_extension=true, connector_status='not_required' WHERE feature_id='F-6.5.2';

-- F-6.5.3 CC Benefit Orchestration: MVP Tier 1, Tier 2 = live airline API (Phase 2)
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=2, has_pending_extension=true, requires_connector='Live Airline API', connector_status='required_unlicensed' WHERE feature_id='F-6.5.3';

-- F-6.5.4 Airline Disruption Intelligence: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.4';

-- F-6.5.5 Claim Routing: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.5';

-- F-6.5.6 Evidence Capture: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.6';

-- F-6.5.7 Incident Timeline Read Model: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.7';

-- F-6.5.7-ENRICH Incident Timeline Enrichment: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.7-ENRICH';

-- F-6.5.8 Active Disruption Options Engine: MVP Tier 1, Tier 3 = live GDS search (F-6.5.8-LIVE sub-capability)
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=3, has_pending_extension=true, requires_connector='GDS Flight Search API (Amadeus recommended)', connector_status='required_unlicensed' WHERE feature_id='F-6.5.8';

-- F-6.5.9 Participant Readiness Checklist: MVP Tier 1, Tier 2 = live visa API
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=2, has_pending_extension=true, requires_connector='Visa/Entry Requirements API (Sherpa recommended)', connector_status='required_unlicensed' WHERE feature_id='F-6.5.9';

-- F-6.5.10 Carrier Discrepancy Detection: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.10';

-- F-6.5.11 RAIR: MVP complete (absorbed into F-6.5.13 Axis 9)
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.11';

-- F-6.5.12 Authority-Driven Disruptions: MVP complete (absorbed into F-6.5.13 Axis 11)
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.12';

-- F-6.5.13 Deep Scan: MVP Tier 1, Tier 3 = all axes active with licensed data sources
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=3, has_pending_extension=true, requires_connector='FlightAware/OAG (Axis 1), Weather APIs (Axis 4)', connector_status='required_unlicensed' WHERE feature_id='F-6.5.13';

-- F-6.5.14 Claim Packet Generator: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.14';

-- F-6.5.15 Claim Progress Tracking: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.15';

-- F-6.5.16 FOCL: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.5.16';

-- F-6.6.1 DCEL: Phase 2+
UPDATE feature_registry SET phase='Phase2Plus', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.6.1';

-- F-6.6.9 Financial Modeling: Phase 2
UPDATE feature_registry SET phase='Phase2', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-6.6.9';

-- F-7.4 Voice-First: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-7.4';

-- F-12.3 Data Pipelines: MVP complete
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='F-12.3';

-- F-CARRIER-DEEP Carrier Deep-Linking: Phase 2
UPDATE feature_registry SET phase='Phase2', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, requires_connector='Carrier Portal APIs', connector_status='required_unlicensed' WHERE feature_id='F-CARRIER-DEEP';

-- governance: system internal
UPDATE feature_registry SET phase='MVP', capability_tier_current=1, capability_tier_max=1, has_pending_extension=false, connector_status='not_required' WHERE feature_id='governance';


-- =============================================================================
-- STEP 4 — Insert F-6.5.8-LIVE sub-capability
-- =============================================================================

INSERT INTO feature_registry (feature_id, display_name, description, default_enabled, minimum_mode, phase, capability_tier_current, capability_tier_max, parent_feature_id, requires_connector, connector_status)
VALUES (
  'F-6.5.8-LIVE',
  'Active Disruption Options — Live Flight Search',
  'Phase 2 sub-capability of F-6.5.8. Enables live GDS flight search during active incidents, showing real available flights matching traveler preferences with per-option coverage implications and direct booking links.',
  false,
  'NORMAL',
  'Phase2',
  1, 1,
  'F-6.5.8',
  'GDS Flight Search API (Amadeus Flight Offers Search recommended)',
  'required_unlicensed'
)
ON CONFLICT (feature_id) DO NOTHING;


-- =============================================================================
-- STEP 5 — Insert 11 features with completed specs, not yet registered
-- =============================================================================

INSERT INTO feature_registry (feature_id, display_name, description, default_enabled, minimum_mode, phase, capability_tier_current, capability_tier_max, has_pending_extension, connector_status)
VALUES
  ('F-6.5.17', 'Trip Draft Engine',
   'Voice-first and manual trip itinerary drafting with readiness gate, route building, activity planning, and narration conflict resolution.',
   false, 'NORMAL', 'MVP', 1, 1, false, 'not_required'),

  ('F-6.5.18', 'Route Normalization & Validation',
   'Schedule conflict detection, connection buffer validation, impossible travel time detection, and route feasibility assessment.',
   false, 'NORMAL', 'MVP', 1, 1, false, 'not_required'),

  ('F-6.5.19', 'Activity Auto-Population',
   'AI-suggested and creator-sourced activity recommendations for trip drafts. Rejection signals feed personalization model.',
   false, 'NORMAL', 'MVP', 1, 2, true, 'not_required'),

  ('F-6.5.20', 'Route Environmental Intelligence',
   'Weather and environmental context per route segment. MVP uses open weather APIs. Phase 2 upgrades to hyperlocal premium APIs.',
   false, 'NORMAL', 'MVP', 1, 2, true, 'not_required'),

  ('F-6.6.2', 'Protective Safety Mode (PSM)',
   'Elevated safety posture for at-risk travelers during active incidents. Restricts sensitive account actions and surfaces emergency resources.',
   false, 'NORMAL', 'Phase2', 1, 1, false, 'not_required'),

  ('F-6.6.3', 'Dual-Presence Verification (DPV)',
   'Biometric and device co-verification for high-risk account actions. Corporate refinements in v1.1.',
   false, 'NORMAL', 'Phase2', 1, 1, false, 'not_required'),

  ('F-6.6.4', 'Emergency Location Availability',
   'Guardian-controlled location sharing with expiry during declared emergencies.',
   false, 'NORMAL', 'Phase2', 1, 1, false, 'not_required'),

  ('F-6.6.6', 'Emergency Delegate & Backup Contact System',
   'Designated backup contact with scoped read-only platform access during emergencies.',
   false, 'NORMAL', 'Phase2', 1, 1, false, 'not_required'),

  ('F-6.6.10', 'Medical Tourism Module',
   'Verified provider discovery and transparent pricing for medical travel. Phase 2+ concept doctrine.',
   false, 'NORMAL', 'Phase2Plus', 1, 1, false, 'not_required'),

  ('F-6.6.11', 'Creator-Indexed Travel Discovery Engine',
   'Travel content creator videos indexed for destination and activity discovery. Feeds ActivityCandidate population.',
   false, 'NORMAL', 'Phase2', 1, 1, false, 'not_required'),

  ('F-6.7.1', 'Founder Operational Command Engine',
   'Global operational oversight linking regional stability, automation state, financial performance, and allocation levers.',
   false, 'NORMAL', 'MVP', 1, 1, false, 'not_required')

ON CONFLICT (feature_id) DO NOTHING;


-- =============================================================================
-- STEP 6 — Register new event types
-- =============================================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('feature_tier_advanced',       1, 'governance', 'info'),
  ('feature_extension_enabled',   1, 'governance', 'info'),
  ('feature_connector_activated', 1, 'governance', 'info')
ON CONFLICT (event_type) DO NOTHING;


-- =============================================================================
-- STEP 7 — Register new FOCL screen surfaces for the Feature Intelligence Panel
-- =============================================================================

INSERT INTO screen_surface_registry (surface_id, feature_id, surface_label, route_path, required_data_deps, confidence_required)
VALUES
  ('FOCL_FEATURE_INTELLIGENCE',
   'F-6.5.16',
   'Feature Intelligence Panel',
   '/focl/features/intelligence',
   ARRAY['feature_registry','feature_activation_state','feature_rollout_health_state','feature_rollout_rules'],
   'any'),

  ('FOCL_FEATURE_SUBCOMPONENTS',
   'F-6.5.16',
   'Sub-Capability Control Panel',
   '/focl/features/:id/subcomponents',
   ARRAY['feature_registry','feature_activation_state'],
   'any'),

  ('FOCL_FEATURE_CONNECTOR_STATUS',
   'F-6.5.16',
   'Connector Status Panel',
   '/focl/features/:id/connector',
   ARRAY['feature_registry'],
   'any')

ON CONFLICT (surface_id) DO NOTHING;


-- =============================================================================
-- VERIFICATION QUERIES (run manually post-deploy)
-- =============================================================================

-- 1. Confirm total feature count (should be 34 including governance and sub-capabilities)
-- SELECT COUNT(*) FROM feature_registry;

-- 2. Confirm no features are missing phase column (should be 0)
-- SELECT COUNT(*) FROM feature_registry WHERE phase IS NULL;

-- 3. Confirm F-6.5.8 has correct name
-- SELECT feature_id, display_name, capability_tier_max, has_pending_extension FROM feature_registry WHERE feature_id = 'F-6.5.8';

-- 4. Confirm F-6.5.8-LIVE exists with correct parent
-- SELECT feature_id, parent_feature_id, phase, connector_status FROM feature_registry WHERE feature_id = 'F-6.5.8-LIVE';

-- 5. Confirm F-6.5.9 has correct name
-- SELECT feature_id, display_name FROM feature_registry WHERE feature_id = 'F-6.5.9';

-- 6. List all features with pending extensions (should be 7)
-- SELECT feature_id, display_name, capability_tier_current, capability_tier_max, requires_connector FROM feature_registry WHERE has_pending_extension = true ORDER BY feature_id;

-- 7. List all Phase 2 and Phase 2+ features (should be 9)
-- SELECT feature_id, display_name, phase FROM feature_registry WHERE phase IN ('Phase2','Phase2Plus') ORDER BY feature_id;

-- 8. Confirm new event types registered
-- SELECT event_type FROM event_type_registry WHERE event_type IN ('feature_tier_advanced','feature_extension_enabled','feature_connector_activated');

-- 9. Confirm new screen surfaces registered
-- SELECT surface_id, route_path FROM screen_surface_registry WHERE surface_id LIKE 'FOCL_FEATURE_%' ORDER BY surface_id;
