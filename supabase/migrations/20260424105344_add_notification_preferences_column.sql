/*
  # Add notification preferences to user_profiles

  1. Modified Tables
    - `user_profiles`
      - Added `notification_preferences` (jsonb, default includes email alerts + push off)

  2. Notes
    - Defaults to a safe set: email alerts on, push off, no quiet hours
    - Column is nullable JSONB — missing rows get defaults client-side
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN notification_preferences jsonb
      DEFAULT '{"email_disruption_alerts":true,"email_readiness_reminders":true,"email_coverage_changes":true,"push_enabled":false}'::jsonb;
  END IF;
END $$;
