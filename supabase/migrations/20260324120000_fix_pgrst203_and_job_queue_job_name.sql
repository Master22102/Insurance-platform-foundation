/*
  E2E / PostgREST fixes (2026-03-24)
  1) PGRST203: two change_incident_status overloads (incident_status vs text same arity) — PostgREST
     cannot pick; pass6 canonical RPC uses text — drop legacy enum overload.
  2) job_queue.job_name is NOT NULL; pass9 initiate_*_scan inserted without job_name — fix inserts.
*/

-- Enum overload collides with pass6 text overload for PostgREST JSON RPC.
DROP FUNCTION IF EXISTS public.change_incident_status(uuid, public.incident_status, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.change_incident_status(uuid, incident_status, uuid, text, uuid);

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
  v_cached_job uuid;
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

  v_hash := encode(digest(p_itinerary_snapshot::text, 'sha256'), 'hex');

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

  SELECT j.id
  INTO v_cached_job
  FROM public.job_queue j
  WHERE j.job_type = 'deep_scan'
    AND j.payload->>'trip_id' = p_trip_id::text
    AND j.payload->>'itinerary_hash' = v_hash
    AND j.status::text IN ('pending', 'running', 'retry', 'processing', 'completed')
    AND j.created_at > now() - interval '7 days'
  ORDER BY j.created_at DESC
  LIMIT 1;

  IF v_cached_job IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'cache_hit', true,
      'job_id', v_cached_job,
      'scan_id', v_cached_job,
      'itinerary_hash', v_hash,
      'credits_remaining', v_trip.deep_scan_credits_remaining
    );
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

  INSERT INTO public.job_queue (job_name, job_type, status, payload)
  VALUES (
    'deep_scan',
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
    'cache_hit', false,
    'job_id', v_job_id,
    'scan_id', v_job_id,
    'itinerary_hash', v_hash,
    'credits_remaining', v_trip.deep_scan_credits_remaining - 1,
    'credit_event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.initiate_quick_scan(
  p_user_id uuid,
  p_itinerary_snapshot jsonb,
  p_trip_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_trip trips%ROWTYPE;
  v_hash text;
  v_job_id uuid;
  v_cached_job uuid;
  v_cached_status text;
  v_emit jsonb;
  v_is_paid boolean := (p_trip_id IS NOT NULL);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT *
  INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_hash := encode(digest(p_itinerary_snapshot::text, 'sha256'), 'hex');

  IF NOT v_is_paid THEN
    SELECT j.id, j.status::text
    INTO v_cached_job, v_cached_status
    FROM job_queue j
    WHERE j.job_type = 'quick_scan'
      AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'user_id' = p_user_id::text
      AND j.status::text IN ('pending', 'processing', 'completed')
    ORDER BY
      CASE j.status::text
        WHEN 'processing' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'completed' THEN 3
        ELSE 4
      END,
      j.created_at DESC
    LIMIT 1;

    IF v_cached_job IS NOT NULL THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_cache_hit',
        p_feature_id := 'scans',
        p_scope_type := 'user',
        p_scope_id := p_user_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'identical_itinerary_hash',
        p_metadata := jsonb_build_object('cached_job_id', v_cached_job, 'cached_job_status', v_cached_status, 'hash', v_hash)
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'job_status', v_cached_status, 'hash', v_hash);
    END IF;

    IF v_profile.lifetime_quick_scans_used >= 2 THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_rate_limited',
        p_feature_id := 'scans',
        p_scope_type := 'user',
        p_scope_id := p_user_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'lifetime_cap_reached',
        p_metadata := jsonb_build_object(
          'lifetime_scans_used', v_profile.lifetime_quick_scans_used,
          'lifetime_cap', 2
        )
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'lifetime_quick_scan_cap_reached',
        'paywall', true,
        'scans_used', v_profile.lifetime_quick_scans_used,
        'conversion_prompt', 'unlock_trip'
      );
    END IF;

    UPDATE user_profiles
    SET
      lifetime_quick_scans_used = lifetime_quick_scans_used + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    SELECT *
    INTO v_trip
    FROM trips
    WHERE trip_id = p_trip_id
      AND account_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
    END IF;
    IF NOT v_trip.paid_unlock THEN
      RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked');
    END IF;

    SELECT j.id, j.status::text
    INTO v_cached_job, v_cached_status
    FROM job_queue j
    WHERE j.job_type = 'quick_scan'
      AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'trip_id' = p_trip_id::text
      AND j.status::text IN ('pending', 'processing', 'completed')
    ORDER BY
      CASE j.status::text
        WHEN 'processing' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'completed' THEN 3
        ELSE 4
      END,
      j.created_at DESC
    LIMIT 1;

    IF v_cached_job IS NOT NULL THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_cache_hit',
        p_feature_id := 'scans',
        p_scope_type := 'trip',
        p_scope_id := p_trip_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'identical_itinerary_hash',
        p_metadata := jsonb_build_object('cached_job_id', v_cached_job, 'cached_job_status', v_cached_status, 'hash', v_hash)
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'job_status', v_cached_status, 'hash', v_hash);
    END IF;

    IF v_trip.quick_scan_week_reset_at < now() - interval '7 days' THEN
      UPDATE trips
      SET
        quick_scans_used_this_week = 0,
        quick_scan_week_reset_at = now()
      WHERE trip_id = p_trip_id;
      v_trip.quick_scans_used_this_week := 0;
    END IF;

    IF v_trip.quick_scans_used_this_week >= 4 THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_rate_limited',
        p_feature_id := 'scans',
        p_scope_type := 'trip',
        p_scope_id := p_trip_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'weekly_limit_reached',
        p_metadata := jsonb_build_object(
          'trip_id', p_trip_id,
          'scans_this_week', v_trip.quick_scans_used_this_week
        )
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'weekly_quick_scan_limit_reached',
        'scans_used', v_trip.quick_scans_used_this_week,
        'resets_at', v_trip.quick_scan_week_reset_at + interval '7 days'
      );
    END IF;

    UPDATE trips
    SET quick_scans_used_this_week = quick_scans_used_this_week + 1
    WHERE trip_id = p_trip_id;
  END IF;

  INSERT INTO public.job_queue (job_name, job_type, status, payload)
  VALUES (
    'quick_scan',
    'quick_scan',
    'pending',
    jsonb_build_object(
      'user_id', p_user_id,
      'trip_id', p_trip_id,
      'itinerary_hash', v_hash,
      'itinerary_data', p_itinerary_snapshot,
      'scan_tier', CASE WHEN v_is_paid THEN 'paid' ELSE 'free' END
    )
  )
  RETURNING id INTO v_job_id;

  v_emit := emit_event(
    p_event_type := 'quick_scan_requested',
    p_feature_id := 'scans',
    p_scope_type := CASE WHEN v_is_paid THEN 'trip' ELSE 'user' END,
    p_scope_id := COALESCE(p_trip_id, p_user_id),
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_initiated',
    p_metadata := jsonb_build_object(
      'job_id', v_job_id,
      'itinerary_hash', v_hash,
      'scan_tier', CASE WHEN v_is_paid THEN 'paid' ELSE 'free' END,
      'trip_id', p_trip_id
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cache_hit', false,
    'job_id', v_job_id,
    'itinerary_hash', v_hash,
    'event_id', v_emit->>'event_id'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.initiate_deep_scan(uuid, uuid, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initiate_quick_scan(uuid, jsonb, uuid) TO authenticated;
