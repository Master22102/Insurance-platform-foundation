/*
  Guardian inbox RLS + revoke_export by trip/subject/organizer (matches app RPC calls).
  Safe to re-run: policies created only if missing.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'relationship_verification_requests'
      AND policyname = 'Guardian can read verification requests'
  ) THEN
    CREATE POLICY "Guardian can read verification requests"
      ON public.relationship_verification_requests
      FOR SELECT
      TO authenticated
      USING (guardian_id IS NOT NULL AND guardian_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_export_authorization(
  p_trip_id uuid,
  p_subject_id uuid,
  p_organizer_id uuid,
  p_reason_code text DEFAULT 'participant_self_defense'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_grant_id uuid;
  v_guardian_allows boolean := false;
BEGIN
  IF auth.uid() <> p_subject_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.trusted_ally_links tal
      WHERE tal.subject_id = p_subject_id
        AND tal.ally_id = auth.uid()
        AND tal.status = 'active'
    ) INTO v_guardian_allows;
    IF NOT v_guardian_allows THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_subject_or_trusted_ally');
    END IF;
  END IF;

  SELECT grant_id INTO v_grant_id
  FROM public.export_authorization_grants
  WHERE trip_id = p_trip_id
    AND subject_id = p_subject_id
    AND organizer_id = p_organizer_id
    AND status = 'active'
  ORDER BY granted_at DESC
  LIMIT 1;

  IF v_grant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'grant_not_found');
  END IF;

  RETURN public.revoke_export_authorization(v_grant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_export_authorization(uuid, uuid, uuid, text) TO authenticated;
