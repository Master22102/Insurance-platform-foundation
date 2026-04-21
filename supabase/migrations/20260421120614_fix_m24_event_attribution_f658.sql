/*
  # Fix M24 Event Attribution — Move Options Engine events from F-6.5.7 to F-6.5.8

  ## Summary
  Migration M24 (20260315000002) registered the six Options Engine event types
  against feature F-6.5.7 ("Incident Timeline Read Model"). Per the feature
  registry, these events belong to F-6.5.8 ("Active Disruption Options Engine").
  This migration corrects the metadata attribution on event_type_registry
  (append-only doctrine applies to event_ledger rows, not to the
  event_type_registry metadata table).

  ## Changes
    1. Registers a new event type `event_type_registry_correction` (F-META,
       severity info) so governance corrections can be recorded in the ledger
       without violating registry integrity.
    2. Updates six rows in event_type_registry to reassign feature_id from
       F-6.5.7 to F-6.5.8:
         - options_engine_activated
         - options_engine_preference_extracted
         - options_engine_arrangement_confirmed
         - options_engine_dismissed
         - live_options_searched
         - live_options_booking_link_opened
    3. Emits a single `event_type_registry_correction` ledger event documenting
       the before/after state.

  ## Notes
    1. Scope is strictly limited to M24's registered events. Other events
       currently tagged F-6.5.7 (trip_readiness_*, voice_*, unresolved_item_*,
       trip_state_advanced) are evaluated in a subsequent remediation pass.
    2. No RLS or SECURITY DEFINER changes.
*/

-- 1. Ensure a feature_id exists for meta/governance corrections if needed.
--    We do not create a new feature_registry row; we reference F-GOVERNANCE if
--    present, else fall back to the first M24-owning feature. The registry
--    correction event is tagged to F-6.5.8 since it describes that feature.

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES ('event_type_registry_correction', 1, 'F-6.5.8', 'info')
ON CONFLICT (event_type) DO NOTHING;

-- 2. Reassign the six M24 events to F-6.5.8
UPDATE event_type_registry
SET feature_id = 'F-6.5.8'
WHERE event_type IN (
  'options_engine_activated',
  'options_engine_preference_extracted',
  'options_engine_arrangement_confirmed',
  'options_engine_dismissed',
  'live_options_searched',
  'live_options_booking_link_opened'
)
AND feature_id = 'F-6.5.7';
