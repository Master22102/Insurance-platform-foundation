/*
  # Add Core Trip Fields

  1. Changes
    - Add `account_id` (uuid) — the owning user account, aliases `created_by` for RLS consistency
    - Add `destination_summary` (text) — human-readable destination string, e.g. "Lisbon, Portugal"
    - Add `departure_date` (date) — trip start date
    - Add `return_date` (date) — trip end date

  2. Notes
    - All columns are nullable to avoid breaking existing rows
    - `account_id` is backfilled from `created_by` for existing rows
    - RLS trips_select already uses `created_by`, account_id is an alias for UI consistency
*/

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS destination_summary text,
  ADD COLUMN IF NOT EXISTS departure_date date,
  ADD COLUMN IF NOT EXISTS return_date date;

-- Backfill account_id from created_by for existing rows
UPDATE trips SET account_id = created_by WHERE account_id IS NULL AND created_by IS NOT NULL;

-- Keep account_id in sync with created_by on insert going forward
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'sync_account_id_from_created_by'
      AND event_object_table = 'trips'
  ) THEN
    CREATE OR REPLACE FUNCTION sync_trip_account_id()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW.account_id IS NULL AND NEW.created_by IS NOT NULL THEN
        NEW.account_id := NEW.created_by;
      END IF;
      RETURN NEW;
    END;
    $fn$;

    CREATE TRIGGER sync_account_id_from_created_by
      BEFORE INSERT OR UPDATE ON trips
      FOR EACH ROW EXECUTE FUNCTION sync_trip_account_id();
  END IF;
END $$;
