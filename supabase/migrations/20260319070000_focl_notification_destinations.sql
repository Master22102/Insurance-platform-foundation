-- Founder FOCL notification destinations:
-- one dedicated operations email plus optional backup emails.

CREATE TABLE IF NOT EXISTS public.focl_notification_destinations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_ops_email text NOT NULL,
  backup_emails text[] NOT NULL DEFAULT '{}',
  weekly_digest_enabled boolean NOT NULL DEFAULT true,
  incident_alerts_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT focl_notification_destinations_primary_email_format
    CHECK (position('@' in primary_ops_email) > 1)
);

ALTER TABLE public.focl_notification_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "focl_notification_destinations_select_own" ON public.focl_notification_destinations;
CREATE POLICY "focl_notification_destinations_select_own"
ON public.focl_notification_destinations
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "focl_notification_destinations_insert_own" ON public.focl_notification_destinations;
CREATE POLICY "focl_notification_destinations_insert_own"
ON public.focl_notification_destinations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "focl_notification_destinations_update_own" ON public.focl_notification_destinations;
CREATE POLICY "focl_notification_destinations_update_own"
ON public.focl_notification_destinations
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_focl_notification_destinations_updated_at ON public.focl_notification_destinations;
CREATE TRIGGER set_focl_notification_destinations_updated_at
BEFORE UPDATE ON public.focl_notification_destinations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
