/*
  # M24 — Incidents: Options Engine Fields

  ## Summary
  Adds the Options Engine column set to the incidents table, enabling the
  in-session traveler transport preference and rebooking flow. Also registers
  the six Options Engine event types.

  ## New Columns on incidents (all nullable unless noted)
    - preference_context (jsonb) — in-session traveler transport preferences
    - options_engine_activated (boolean, NOT NULL DEFAULT false) — whether the engine has been activated for this incident
    - options_engine_activated_at (timestamptz) — timestamp of first activation
    - options_engine_trigger (text, CHECK IN narrative_detection|explicit_tap) — what triggered activation
    - arrangement_intent_confirmed (text, CHECK IN arranging_own|waiting_airline|undecided) — traveler's stated intent
    - live_options_connector_id (uuid) — Phase 2 connector reference, no FK yet
    - live_options_result (jsonb) — Phase 2 populated payload, schema reserved now
    - live_options_retrieved_at (timestamptz) — when live options were last fetched
    - live_options_expires_at (timestamptz) — when the current live options cache expires
    - selected_option_id (text) — traveler-selected option identifier
    - booking_link_opened_at (timestamptz) — when the booking deep-link was opened

  ## New Event Types (feature F-6.5.7, severity info)
    - options_engine_activated
    - options_engine_preference_extracted
    - options_engine_arrangement_confirmed
    - options_engine_dismissed
    - live_options_searched
    - live_options_booking_link_opened

  ## Security
  No RLS changes. No SECURITY DEFINER function changes.
*/


-- =============================================================================
-- Add Options Engine columns to incidents
-- =============================================================================

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS preference_context               jsonb,
  ADD COLUMN IF NOT EXISTS options_engine_activated         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS options_engine_activated_at      timestamptz,
  ADD COLUMN IF NOT EXISTS options_engine_trigger           text,
  ADD COLUMN IF NOT EXISTS arrangement_intent_confirmed     text,
  ADD COLUMN IF NOT EXISTS live_options_connector_id        uuid,
  ADD COLUMN IF NOT EXISTS live_options_result              jsonb,
  ADD COLUMN IF NOT EXISTS live_options_retrieved_at        timestamptz,
  ADD COLUMN IF NOT EXISTS live_options_expires_at          timestamptz,
  ADD COLUMN IF NOT EXISTS selected_option_id               text,
  ADD COLUMN IF NOT EXISTS booking_link_opened_at           timestamptz;

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_options_engine_trigger_check;
ALTER TABLE incidents
  ADD CONSTRAINT incidents_options_engine_trigger_check
  CHECK (options_engine_trigger IS NULL OR options_engine_trigger IN (
    'narrative_detection',
    'explicit_tap'
  ));

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_arrangement_intent_confirmed_check;
ALTER TABLE incidents
  ADD CONSTRAINT incidents_arrangement_intent_confirmed_check
  CHECK (arrangement_intent_confirmed IS NULL OR arrangement_intent_confirmed IN (
    'arranging_own',
    'waiting_airline',
    'undecided'
  ));


-- =============================================================================
-- Register Options Engine event types
-- =============================================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('options_engine_activated',               1, 'F-6.5.7', 'info'),
  ('options_engine_preference_extracted',    1, 'F-6.5.7', 'info'),
  ('options_engine_arrangement_confirmed',   1, 'F-6.5.7', 'info'),
  ('options_engine_dismissed',               1, 'F-6.5.7', 'info'),
  ('live_options_searched',                  1, 'F-6.5.7', 'info'),
  ('live_options_booking_link_opened',       1, 'F-6.5.7', 'info')
ON CONFLICT (event_type) DO NOTHING;
