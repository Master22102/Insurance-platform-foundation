/*
  Section 2.0 foundation for group authority and relationship verification.
  - Canonical participant roster + residence fields
  - Relationship verification requests
  - Group Deep Scan readiness enforcement in initiate_deep_scan()
*/

CREATE TABLE IF NOT EXISTS public.group_participants (
  participant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'participant' CHECK (role IN ('organizer', 'participant')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'revoked', 'archived')),
  residence_country_code text,
  residence_state_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_group_participants_trip ON public.group_participants(trip_id);
CREATE INDEX IF NOT EXISTS idx_group_participants_account ON public.group_participants(account_id);

ALTER TABLE public.group_participants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'group_participants'
      AND policyname = 'Group participants read own trips'
  ) THEN
    CREATE POLICY "Group participants read own trips"
      ON public.group_participants
      FOR SELECT
      TO authenticated
      USING (
        account_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.trips t
          WHERE t.trip_id = group_participants.trip_id
            AND t.created_by = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'group_participants'
      AND policyname = 'Organizer can upsert participants'
  ) THEN
    CREATE POLICY "Organizer can upsert participants"
      ON public.group_participants
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.trips t
          WHERE t.trip_id = group_participants.trip_id
            AND t.created_by = auth.uid()
            AND t.is_group_trip = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.trips t
          WHERE t.trip_id = group_participants.trip_id
            AND t.created_by = auth.uid()
            AND t.is_group_trip = true
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.relationship_verification_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  trip_type text NOT NULL DEFAULT 'friend_group' CHECK (trip_type IN ('family', 'school', 'corporate', 'friend_group')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_rel_verify_subject ON public.relationship_verification_requests(subject_id, status);
CREATE INDEX IF NOT EXISTS idx_rel_verify_trip ON public.relationship_verification_requests(trip_id, status);

ALTER TABLE public.relationship_verification_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'relationship_verification_requests'
      AND policyname = 'Requester and subject can read verification requests'
  ) THEN
    CREATE POLICY "Requester and subject can read verification requests"
      ON public.relationship_verification_requests
      FOR SELECT
      TO authenticated
      USING (requester_id = auth.uid() OR subject_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'relationship_verification_requests'
      AND policyname = 'Requester can create verification requests'
  ) THEN
    CREATE POLICY "Requester can create verification requests"
      ON public.relationship_verification_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (requester_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'relationship_verification_requests'
      AND policyname = 'Subject can resolve verification requests'
  ) THEN
    CREATE POLICY "Subject can resolve verification requests"
      ON public.relationship_verification_requests
      FOR UPDATE
      TO authenticated
      USING (subject_id = auth.uid())
      WITH CHECK (subject_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prior_relationship_exists(
  p_requester_id uuid,
  p_subject_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_participants gp_a
    JOIN public.group_participants gp_b
      ON gp_a.trip_id = gp_b.trip_id
    WHERE gp_a.account_id = p_requester_id
      AND gp_b.account_id = p_subject_id
      AND gp_a.status = 'active'
      AND gp_b.status = 'active'
      AND gp_a.updated_at > now() - interval '365 days'
      AND gp_b.updated_at > now() - interval '365 days'
  );
$$;

GRANT EXECUTE ON FUNCTION public.prior_relationship_exists(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_group_participant_add(
  p_trip_id uuid,
  p_subject_id uuid,
  p_trip_type text DEFAULT 'friend_group'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_request_id uuid;
  v_expiry_hours integer := 48;
  v_has_prior boolean := false;
BEGIN
  SELECT * INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
    AND created_by = auth.uid()
    AND is_group_trip = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found_or_not_group_organizer');
  END IF;

  SELECT public.prior_relationship_exists(auth.uid(), p_subject_id) INTO v_has_prior;

  IF v_has_prior THEN
    INSERT INTO public.group_participants (
      trip_id, account_id, role, status, created_by
    ) VALUES (
      p_trip_id, p_subject_id, 'participant', 'active', auth.uid()
    )
    ON CONFLICT (trip_id, account_id) DO UPDATE
      SET status = 'active', updated_at = now();

    PERFORM emit_event(
      p_event_type := 'relationship_verification_automatic',
      p_feature_id := 'identity',
      p_scope_type := 'trip',
      p_scope_id := p_trip_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := 'prior_relationship_exists',
      p_metadata := jsonb_build_object('subject_id', p_subject_id)
    );

    RETURN jsonb_build_object('success', true, 'status', 'added_automatic');
  END IF;

  IF p_trip_type = 'family' THEN v_expiry_hours := 24; END IF;
  IF p_trip_type = 'school' THEN v_expiry_hours := 48; END IF;
  IF p_trip_type = 'corporate' THEN v_expiry_hours := 168; END IF;

  INSERT INTO public.relationship_verification_requests (
    requester_id, subject_id, trip_id, trip_type, status, expires_at
  ) VALUES (
    auth.uid(), p_subject_id, p_trip_id, COALESCE(p_trip_type, 'friend_group'),
    'pending', now() + make_interval(hours => v_expiry_hours)
  )
  RETURNING request_id INTO v_request_id;

  PERFORM emit_event(
    p_event_type := 'relationship_verification_requested',
    p_feature_id := 'identity',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'no_prior_relationship',
    p_metadata := jsonb_build_object('request_id', v_request_id, 'subject_id', p_subject_id, 'trip_type', p_trip_type)
  );

  RETURN jsonb_build_object('success', true, 'status', 'pending_verification', 'request_id', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_group_participant_add(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_relationship_verification_request(
  p_request_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req public.relationship_verification_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req
  FROM public.relationship_verification_requests
  WHERE request_id = p_request_id
    AND subject_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_pending', 'status', v_req.status);
  END IF;

  IF v_req.expires_at < now() THEN
    UPDATE public.relationship_verification_requests
    SET status = 'expired', resolved_at = now()
    WHERE request_id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'request_expired');
  END IF;

  IF lower(p_decision) = 'approve' THEN
    UPDATE public.relationship_verification_requests
    SET status = 'approved', resolved_at = now()
    WHERE request_id = p_request_id;

    INSERT INTO public.group_participants (
      trip_id, account_id, role, status, created_by
    ) VALUES (
      v_req.trip_id, v_req.subject_id, 'participant', 'active', v_req.requester_id
    )
    ON CONFLICT (trip_id, account_id) DO UPDATE
      SET status = 'active', updated_at = now();

    PERFORM emit_event(
      p_event_type := 'relationship_verification_approved',
      p_feature_id := 'identity',
      p_scope_type := 'trip',
      p_scope_id := v_req.trip_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := 'subject_approved',
      p_metadata := jsonb_build_object('request_id', p_request_id)
    );

    RETURN jsonb_build_object('success', true, 'status', 'approved');
  END IF;

  UPDATE public.relationship_verification_requests
  SET status = 'denied', resolved_at = now()
  WHERE request_id = p_request_id;

  PERFORM emit_event(
    p_event_type := 'relationship_verification_denied',
    p_feature_id := 'identity',
    p_scope_type := 'trip',
    p_scope_id := v_req.trip_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'subject_denied',
    p_metadata := jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object('success', true, 'status', 'denied');
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_relationship_verification_request(uuid, text) TO authenticated;

-- Deep Scan backend gate hardened for group residence completeness.
CREATE OR REPLACE FUNCTION public.initiate_deep_scan(
  p_user_id uuid,
  p_trip_id uuid,
  p_itinerary_snapshot jsonb,
  p_user_confirmed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_hash text;
  v_job_id uuid;
  v_emit jsonb;
  v_missing integer := 0;
BEGIN
  IF NOT p_user_confirmed THEN
    RETURN jsonb_build_object('success', false, 'error', 'explicit_user_confirmation_required',
      'message', 'Deep Scan requires explicit user confirmation before credit is consumed.');
  END IF;

  SELECT * INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
    AND account_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_found'); END IF;
  IF NOT v_trip.paid_unlock THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked'); END IF;

  IF v_trip.is_group_trip THEN
    SELECT count(*)::int INTO v_missing
    FROM public.group_participants gp
    WHERE gp.trip_id = p_trip_id
      AND gp.status = 'active'
      AND (
        gp.residence_country_code IS NULL
        OR btrim(gp.residence_country_code) = ''
        OR (upper(gp.residence_country_code) = 'US' AND (gp.residence_state_code IS NULL OR btrim(gp.residence_state_code) = ''))
      );

    IF v_missing > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'group_residence_incomplete',
        'missing_participants', v_missing,
        'message', 'Deep Scan can filter insurance options based on where each traveler lives. Some participants have not added their location yet.'
      );
    END IF;
  END IF;

  IF v_trip.deep_scan_credits_remaining <= 0 THEN
    PERFORM emit_event(
      p_event_type := 'deep_scan_credit_purchase_required',
      p_feature_id := 'scans',
      p_scope_type := 'trip',
      p_scope_id := p_trip_id,
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := 'credits_exhausted',
      p_metadata := jsonb_build_object('trip_id', p_trip_id)
    );
    RETURN jsonb_build_object('success', false, 'error', 'no_deep_scan_credits_remaining', 'purchase_required', true, 'credits_remaining', 0);
  END IF;

  v_hash := encode(digest(p_itinerary_snapshot::text, 'sha256'), 'hex');

  UPDATE public.trips
  SET deep_scan_credits_remaining = deep_scan_credits_remaining - 1
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(
    p_event_type := 'deep_scan_credit_consumed',
    p_feature_id := 'trips',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_initiated',
    p_previous_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining),
    p_resulting_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining - 1),
    p_metadata := jsonb_build_object('trip_id', p_trip_id, 'credits_before', v_trip.deep_scan_credits_remaining, 'credits_after', v_trip.deep_scan_credits_remaining - 1)
  );

  INSERT INTO public.job_queue (job_type, status, payload)
  VALUES (
    'deep_scan',
    'pending',
    jsonb_build_object('user_id', p_user_id, 'trip_id', p_trip_id, 'itinerary_hash', v_hash, 'itinerary_data', p_itinerary_snapshot)
  )
  RETURNING id INTO v_job_id;

  PERFORM emit_event(
    p_event_type := 'deep_scan_requested',
    p_feature_id := 'scans',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_confirmed',
    p_metadata := jsonb_build_object('job_id', v_job_id, 'itinerary_hash', v_hash, 'credits_remaining', v_trip.deep_scan_credits_remaining - 1)
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'itinerary_hash', v_hash,
    'credits_remaining', v_trip.deep_scan_credits_remaining - 1,
    'credit_event_id', v_emit->>'event_id'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.initiate_deep_scan(uuid, uuid, jsonb, boolean) TO authenticated;
