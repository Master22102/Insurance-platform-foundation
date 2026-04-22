/*
  # Mobile Screen Surface Tables

  Adds the minimum persistence layer that backs the new mobile screens
  introduced in this batch. Every table is traveler-scoped and locked
  down via RLS so data can never leak across users.

  1. New Tables
     - `passport_restrictions` — reference of country-level restrictions
       (visa, medication import, entry stamp rules) feeding the Passport
       Restriction Alert screen and Safety Card warnings.
     - `onboarding_progress` — per-user state for the Onboarding Compass.
     - `contextual_signals` — time-bounded "what matters now" items
       rendered on the Contextual Intelligence Now panel.
     - `presence_mode_settings` — per-trip presence mode configuration
       (silent, buddy, sos, auto-geofence).
     - `trip_presence_events` — append-only event log for presence-mode
       alerts (geofence crossings, missed check-ins, partner offline).
     - `governance_posture_snapshots` — immutable snapshot of the
       traveler's governance/trust posture at a point in time.
     - `safety_cards` — allergies, medications, accommodations, QR token.

  2. Security
     - RLS enabled on every new table.
     - Separate SELECT/INSERT/UPDATE/DELETE policies.
     - `passport_restrictions` is public reference data and is readable
       by any authenticated user but writable only by service role.
*/

CREATE TABLE IF NOT EXISTS passport_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  restriction_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  citation_url text,
  effective_from date,
  effective_to date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE passport_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read passport restrictions"
  ON passport_restrictions FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step text NOT NULL DEFAULT 'welcome',
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  trip_archetype text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own onboarding progress"
  ON onboarding_progress FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "User can insert own onboarding progress"
  ON onboarding_progress FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User can update own onboarding progress"
  ON onboarding_progress FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User can delete own onboarding progress"
  ON onboarding_progress FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS contextual_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid,
  kind text NOT NULL,
  priority smallint NOT NULL DEFAULT 3,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  window_start timestamptz NOT NULL DEFAULT now(),
  window_end timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contextual_signals_user ON contextual_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_contextual_signals_trip ON contextual_signals(trip_id);

ALTER TABLE contextual_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own contextual signals"
  ON contextual_signals FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "User can insert own contextual signals"
  ON contextual_signals FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User can update own contextual signals"
  ON contextual_signals FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User can delete own contextual signals"
  ON contextual_signals FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS presence_mode_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'standard',
  check_in_interval_minutes integer NOT NULL DEFAULT 120,
  geofence jsonb NOT NULL DEFAULT '{}'::jsonb,
  silent_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, trip_id)
);

CREATE INDEX IF NOT EXISTS idx_presence_mode_settings_user ON presence_mode_settings(user_id);

ALTER TABLE presence_mode_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own presence settings"
  ON presence_mode_settings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "User can insert own presence settings"
  ON presence_mode_settings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User can update own presence settings"
  ON presence_mode_settings FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User can delete own presence settings"
  ON presence_mode_settings FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS trip_presence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL DEFAULT '',
  geo jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_presence_events_user ON trip_presence_events(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_presence_events_trip ON trip_presence_events(trip_id);

ALTER TABLE trip_presence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own presence events"
  ON trip_presence_events FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "User can insert own presence events"
  ON trip_presence_events FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS governance_posture_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_version text NOT NULL DEFAULT 'v1',
  consent_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  retention_tier text NOT NULL DEFAULT 'standard',
  flags_visible jsonb NOT NULL DEFAULT '[]'::jsonb,
  maintenance_status text NOT NULL DEFAULT 'normal',
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_posture_user ON governance_posture_snapshots(user_id);

ALTER TABLE governance_posture_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own governance snapshots"
  ON governance_posture_snapshots FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "User can insert own governance snapshots"
  ON governance_posture_snapshots FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS safety_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid,
  display_name text NOT NULL DEFAULT '',
  nationality_code text NOT NULL DEFAULT '',
  allergies jsonb NOT NULL DEFAULT '[]'::jsonb,
  medications jsonb NOT NULL DEFAULT '[]'::jsonb,
  accommodations jsonb NOT NULL DEFAULT '{}'::jsonb,
  emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  qr_token text NOT NULL DEFAULT '',
  locale_hint text NOT NULL DEFAULT 'en',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_cards_user ON safety_cards(user_id);

ALTER TABLE safety_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own safety cards"
  ON safety_cards FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "User can insert own safety cards"
  ON safety_cards FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User can update own safety cards"
  ON safety_cards FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User can delete own safety cards"
  ON safety_cards FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
