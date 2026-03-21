/*
  Allow invite subject / guardian to read trip row while a verification request is pending,
  so inbox UIs can show destination context without granting full trip access.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trips'
      AND policyname = 'trips_select_pending_invite_context'
  ) THEN
    CREATE POLICY trips_select_pending_invite_context
      ON public.trips
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.relationship_verification_requests r
          WHERE r.trip_id = trips.trip_id
            AND r.status = 'pending'
            AND (r.subject_id = auth.uid() OR r.guardian_id = auth.uid())
        )
      );
  END IF;
END $$;
