/*
  # Mobile screen schema extensions

  Adds columns and tables required by the rebuilt mobile preview surfaces
  so the four HTML-backed screens can persist traveler state instead of
  rendering hardcoded fixtures.

  1. passport_restrictions additions
     - issuing_passport_code (text) — the traveler passport that is restricted
     - destination_code (text) — target country the restriction applies to
     - scope (text) — entry | transit | stamp
     - consequence (text) — plain-language outcome if attempted
     - alternative_routes (jsonb) — list of safer routing suggestions
     - citation_ministry (text) — authoritative ministry for verification

  2. New tables
     - contextual_state_snapshots — persists which of the five Right-now
       states (pretrip / airport / disruption / quiet / defer) a traveler
       is in for a given trip, plus the triggering signals
     - presence_alert_templates — canonical copy for the five presence
       alert variants so the mobile screen reads from a single source

  3. Security
     - RLS enabled on every new table
     - Per-operation policies keyed on (select auth.uid()) = user_id
     - presence_alert_templates is readable by any authenticated user
       because templates are shared reference data
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='passport_restrictions' AND column_name='issuing_passport_code') THEN
    ALTER TABLE passport_restrictions ADD COLUMN issuing_passport_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='passport_restrictions' AND column_name='destination_code') THEN
    ALTER TABLE passport_restrictions ADD COLUMN destination_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='passport_restrictions' AND column_name='scope') THEN
    ALTER TABLE passport_restrictions ADD COLUMN scope text DEFAULT 'entry';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='passport_restrictions' AND column_name='consequence') THEN
    ALTER TABLE passport_restrictions ADD COLUMN consequence text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='passport_restrictions' AND column_name='alternative_routes') THEN
    ALTER TABLE passport_restrictions ADD COLUMN alternative_routes jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='passport_restrictions' AND column_name='citation_ministry') THEN
    ALTER TABLE passport_restrictions ADD COLUMN citation_ministry text DEFAULT '';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS contextual_state_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid,
  state_id text NOT NULL DEFAULT 'quiet',
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contextual_state_snapshots_user_trip_idx
  ON contextual_state_snapshots (user_id, trip_id, captured_at DESC);

ALTER TABLE contextual_state_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own state snapshots" ON contextual_state_snapshots;
CREATE POLICY "Users can view own state snapshots"
  ON contextual_state_snapshots FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own state snapshots" ON contextual_state_snapshots;
CREATE POLICY "Users can insert own state snapshots"
  ON contextual_state_snapshots FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own state snapshots" ON contextual_state_snapshots;
CREATE POLICY "Users can update own state snapshots"
  ON contextual_state_snapshots FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own state snapshots" ON contextual_state_snapshots;
CREATE POLICY "Users can delete own state snapshots"
  ON contextual_state_snapshots FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS presence_alert_templates (
  id text PRIMARY KEY,
  label text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  caption text NOT NULL DEFAULT '',
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE presence_alert_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read presence templates" ON presence_alert_templates;
CREATE POLICY "Authenticated users can read presence templates"
  ON presence_alert_templates FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO presence_alert_templates (id, label, severity, caption, body) VALUES
  ('missed',   'Missed conn.', 'danger',  'Missed connection alert',       '{"heading":"Missed boarding risk"}'::jsonb),
  ('activity', 'Ski resort',   'warning', 'Activity zone — ski resort',    '{"heading":"Coverage alert"}'::jsonb),
  ('border',   'Border',       'info',    'Border crossing',               '{"heading":"Welcome to Switzerland"}'::jsonb),
  ('local',    'Local risk',   'warning', 'Local risk alert',              '{"heading":"Travel disruption nearby"}'::jsonb),
  ('summary',  'Summary',      'info',    'Daily travel summary',          '{"heading":"Today''s travel summary"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
