/*
  # M25 — Participant Checklist Items

  ## Summary
  Creates the participant_checklist_items table to track per-participant,
  per-trip compliance checklist items (entry requirements, health docs,
  platform documents, emergency prep). Items are versioned by itinerary_version
  so that a checklist refresh after an itinerary change produces a new set of
  rows rather than overwriting existing ones.

  ## New Table: participant_checklist_items
    - item_id (uuid, PK) — surrogate key
    - trip_id (uuid, FK → trips) — owning trip
    - participant_account_id (uuid, FK → auth.users) — which traveler
    - item_category (text, CHECK) — entry_requirement | health_requirement | platform_document | emergency_prep
    - item_key (text) — machine-stable identifier e.g. "passport_validity_6mo"
    - item_label (text) — human-readable display label
    - item_detail (text, nullable) — supplemental explanation or instructions
    - source_country (text) — traveler's nationality/residence country code
    - destination_countries (text[]) — list of country codes this item applies to
    - status (text, CHECK) — lifecycle: not_started | in_progress | uploaded | verified | waived | waived_by_itinerary_change
    - blocking_coverage (boolean) — whether outstanding status blocks coverage routing
    - itinerary_version (integer) — snapshot version from the parent trip
    - resolved_at (timestamptz, nullable)
    - resolved_by (uuid, nullable)
    - resolution_notes (text, nullable)
    - created_at (timestamptz)

  ## Constraints
    - UNIQUE (trip_id, participant_account_id, item_key, itinerary_version)
      prevents duplicate checklist items for the same participant/version

  ## Security
    - RLS enabled; no default access
    - SELECT: participant_account_id = auth.uid()
    - INSERT: participant_account_id = auth.uid()

  ## Indexes
    - (trip_id, participant_account_id) for per-trip participant queries

  ## New Event Types (feature F-7.1, severity noted)
    - checklist_generated (info)
    - checklist_item_completed (info)
    - checklist_item_waived (info)
    - checklist_refreshed (info)
    - checklist_nudge_sent (info)
    - participant_checklist_blocking_coverage (warning)
*/


-- =============================================================================
-- Create participant_checklist_items table
-- =============================================================================

CREATE TABLE IF NOT EXISTS participant_checklist_items (
  item_id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                  uuid NOT NULL REFERENCES trips(trip_id),
  participant_account_id   uuid NOT NULL REFERENCES auth.users(id),
  item_category            text NOT NULL,
  item_key                 text NOT NULL,
  item_label               text NOT NULL,
  item_detail              text,
  source_country           text NOT NULL,
  destination_countries    text[] NOT NULL DEFAULT '{}',
  status                   text NOT NULL DEFAULT 'not_started',
  blocking_coverage        boolean NOT NULL DEFAULT false,
  itinerary_version        integer NOT NULL DEFAULT 1,
  resolved_at              timestamptz,
  resolved_by              uuid,
  resolution_notes         text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE participant_checklist_items
  DROP CONSTRAINT IF EXISTS pci_item_category_check;
ALTER TABLE participant_checklist_items
  ADD CONSTRAINT pci_item_category_check
  CHECK (item_category IN (
    'entry_requirement',
    'health_requirement',
    'platform_document',
    'emergency_prep'
  ));

ALTER TABLE participant_checklist_items
  DROP CONSTRAINT IF EXISTS pci_status_check;
ALTER TABLE participant_checklist_items
  ADD CONSTRAINT pci_status_check
  CHECK (status IN (
    'not_started',
    'in_progress',
    'uploaded',
    'verified',
    'waived',
    'waived_by_itinerary_change'
  ));

ALTER TABLE participant_checklist_items
  DROP CONSTRAINT IF EXISTS pci_unique_item_per_version;
ALTER TABLE participant_checklist_items
  ADD CONSTRAINT pci_unique_item_per_version
  UNIQUE (trip_id, participant_account_id, item_key, itinerary_version);


-- =============================================================================
-- Index
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pci_trip_participant
  ON participant_checklist_items (trip_id, participant_account_id);


-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE participant_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participant can view own checklist items"
  ON participant_checklist_items
  FOR SELECT
  TO authenticated
  USING (participant_account_id = auth.uid());

CREATE POLICY "Participant can insert own checklist items"
  ON participant_checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (participant_account_id = auth.uid());


-- =============================================================================
-- Register checklist event types
-- =============================================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('checklist_generated',                       1, 'F-7.1', 'info'),
  ('checklist_item_completed',                  1, 'F-7.1', 'info'),
  ('checklist_item_waived',                     1, 'F-7.1', 'info'),
  ('checklist_refreshed',                       1, 'F-7.1', 'info'),
  ('checklist_nudge_sent',                      1, 'F-7.1', 'info'),
  ('participant_checklist_blocking_coverage',   1, 'F-7.1', 'warning')
ON CONFLICT (event_type) DO NOTHING;
