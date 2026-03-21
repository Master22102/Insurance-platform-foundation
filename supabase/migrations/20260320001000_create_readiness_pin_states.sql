/*
  Step 5.5 persistence: readiness pin state
  Stores per-user, per-trip checklist status and assistance mode selections.
*/

CREATE TABLE IF NOT EXISTS public.readiness_pin_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  status text,
  assist_mode text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT readiness_pin_states_status_check CHECK (
    status IS NULL OR status IN ('not_started', 'in_progress', 'ready')
  ),
  CONSTRAINT readiness_pin_states_assist_mode_check CHECK (
    assist_mode IS NULL OR assist_mode IN ('self', 'guided')
  ),
  CONSTRAINT readiness_pin_states_value_presence CHECK (
    status IS NOT NULL OR assist_mode IS NOT NULL
  ),
  CONSTRAINT readiness_pin_states_unique UNIQUE (trip_id, user_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_readiness_pin_states_trip_user
  ON public.readiness_pin_states(trip_id, user_id);

ALTER TABLE public.readiness_pin_states ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'readiness_pin_states'
      AND policyname = 'Read own readiness pin states'
  ) THEN
    CREATE POLICY "Read own readiness pin states"
      ON public.readiness_pin_states
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'readiness_pin_states'
      AND policyname = 'Insert own readiness pin states'
  ) THEN
    CREATE POLICY "Insert own readiness pin states"
      ON public.readiness_pin_states
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'readiness_pin_states'
      AND policyname = 'Update own readiness pin states'
  ) THEN
    CREATE POLICY "Update own readiness pin states"
      ON public.readiness_pin_states
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

