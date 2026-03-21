/*
  Deep Scan hardening:
  - enforce emit_event success checks (raise -> rollback)
  - keep compatibility for frontend expecting scan_id
*/

CREATE OR REPLACE FUNCTION public.initiate_deep_scan(
  p_user_id uuid,
  p_trip_id uuid,
  p_itinerary_snapshot jsonb,
  p_user_confirmed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_hash text;
  v_job_id uuid;
  v_emit jsonb;
  v_missing integer := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF NOT p_user_confirmed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'explicit_user_confirmation_required',
      'message', 'Deep Scan requires explicit user confirmation before credit is consumed.'
    );
  END IF;

  SELECT *
  INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
    AND account_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;

  IF NOT v_trip.paid_unlock THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked');
  END IF;

  IF v_trip.is_group_trip THEN
    SELECT count(*)::int
    INTO v_missing
    FROM public.group_participants gp
    WHERE gp.trip_id = p_trip_id
      AND gp.status = 'active'
      AND (
        gp.residence_country_code IS NULL
        OR btrim(gp.residence_country_code) = ''
        OR (
          upper(gp.residence_country_code) = 'US'
          AND (gp.residence_state_code IS NULL OR btrim(gp.residence_state_code) = '')
        )
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
    v_emit := emit_event(
      p_event_type := 'deep_scan_credit_purchase_required',
      p_feature_id := 'scans',
      p_scope_type := 'trip',
      p_scope_id := p_trip_id,
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := 'credits_exhausted',
      p_metadata := jsonb_build_object('trip_id', p_trip_id)
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_deep_scan_credits_remaining',
      'purchase_required', true,
      'credits_remaining', 0
    );
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
    p_metadata := jsonb_build_object(
      'trip_id', p_trip_id,
      'credits_before', v_trip.deep_scan_credits_remaining,
      'credits_after', v_trip.deep_scan_credits_remaining - 1
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  INSERT INTO public.job_queue (job_type, status, payload)
  VALUES (
    'deep_scan',
    'pending',
    jsonb_build_object(
      'user_id', p_user_id,
      'trip_id', p_trip_id,
      'itinerary_hash', v_hash,
      'itinerary_data', p_itinerary_snapshot
    )
  )
  RETURNING id INTO v_job_id;

  v_emit := emit_event(
    p_event_type := 'deep_scan_requested',
    p_feature_id := 'scans',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_confirmed',
    p_metadata := jsonb_build_object(
      'job_id', v_job_id,
      'itinerary_hash', v_hash,
      'credits_remaining', v_trip.deep_scan_credits_remaining - 1
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'scan_id', v_job_id,
    'itinerary_hash', v_hash,
    'credits_remaining', v_trip.deep_scan_credits_remaining - 1,
    'credit_event_id', v_emit->>'event_id'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.initiate_deep_scan(uuid, uuid, jsonb, boolean) TO authenticated;
