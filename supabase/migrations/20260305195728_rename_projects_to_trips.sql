/*
  # M-01: Rename projects → trips (BLOCKING MIGRATION)
  
  1. Critical Changes
    - Rename `projects` table to `trips`
    - Rename `projects.id` → `trips.trip_id`
    - Replace project_status ENUM with trip_maturity_state ENUM
    - Update all foreign key references (incidents.project_id → incidents.trip_id)
    - Update event_ledger scope_type 'project' → 'trip'
  
  2. New Columns
    - maturity_state (ENUM): replaces legacy status field
    - itinerary_hash, itinerary_version, jurisdiction_ids
    - travel_mode_primary, is_group_trip, paid_unlock fields
    - lifecycle_flags (jsonb), group_id, archived_at/archived_by
  
  3. Security
    - Update RLS policies to reference trip_id
*/

-- Step 1: Create new ENUM
DO $$ BEGIN
  CREATE TYPE trip_maturity_state AS ENUM (
    'DRAFT',
    'PRE_TRIP_STRUCTURED',
    'INCIDENT_OPEN',
    'DOCUMENTATION_IN_PROGRESS',
    'CLAIM_ROUTING_LOCKED',
    'CLAIM_SUBMITTED',
    'POST_TRIP_RESOLVED',
    'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Rename table and columns
ALTER TABLE IF EXISTS projects RENAME TO trips;
ALTER TABLE trips RENAME COLUMN id TO trip_id;
ALTER TABLE trips RENAME COLUMN name TO trip_name;

-- Step 3: Handle status column migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='status') THEN
    ALTER TABLE trips RENAME COLUMN status TO legacy_status;
  END IF;
END $$;

-- Step 4: Add maturity_state with ENUM
ALTER TABLE trips ADD COLUMN IF NOT EXISTS maturity_state trip_maturity_state NOT NULL DEFAULT 'DRAFT';

-- Migrate legacy status values if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='legacy_status') THEN
    UPDATE trips SET maturity_state = CASE
      WHEN legacy_status::text = 'active'   THEN 'PRE_TRIP_STRUCTURED'::trip_maturity_state
      WHEN legacy_status::text = 'archived' THEN 'ARCHIVED'::trip_maturity_state
      ELSE 'DRAFT'::trip_maturity_state
    END;
    ALTER TABLE trips DROP COLUMN legacy_status;
  END IF;
END $$;

-- Step 5: Add all required new columns
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS itinerary_hash text,
  ADD COLUMN IF NOT EXISTS itinerary_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS jurisdiction_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_mode_primary text DEFAULT 'air',
  ADD COLUMN IF NOT EXISTS is_group_trip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_unlock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_unlock_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_flags jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

-- Step 6: Update FK references in incidents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='project_id') THEN
    ALTER TABLE incidents RENAME COLUMN project_id TO trip_id;
  END IF;
END $$;

-- Step 7: Update event_ledger scope_type references
UPDATE event_ledger SET scope_type = 'trip' WHERE scope_type = 'project';

-- Step 8: Update RLS policies
DROP POLICY IF EXISTS projects_select ON trips;
DROP POLICY IF EXISTS projects_insert ON trips;
DROP POLICY IF EXISTS projects_update ON trips;

CREATE POLICY trips_select ON trips FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY trips_insert ON trips FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY trips_update ON trips FOR UPDATE
  USING (created_by = auth.uid());

-- Register event type
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('trip_maturity_advanced', 1, 'trips', 'info')
ON CONFLICT (event_type) DO NOTHING;