/*
  Quick Scan hardening:
  - enforce emit_event success checks (raise -> rollback)
  - add explicit search_path for security
*/

CREATE OR REPLACE FUNCTION initiate_quick_scan(
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

    SELECT j.id
    INTO v_cached_job
    FROM job_queue j
    WHERE j.job_type = 'quick_scan'
      AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'user_id' = p_user_id::text
      AND j.created_at > now() - interval '7 days'
      AND j.status = 'completed'
    ORDER BY j.created_at DESC
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
        p_metadata := jsonb_build_object('cached_job_id', v_cached_job, 'hash', v_hash)
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'hash', v_hash);
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

    SELECT j.id
    INTO v_cached_job
    FROM job_queue j
    WHERE j.job_type = 'quick_scan'
      AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'trip_id' = p_trip_id::text
      AND j.created_at > now() - interval '7 days'
      AND j.status = 'completed'
    ORDER BY j.created_at DESC
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
        p_metadata := jsonb_build_object('cached_job_id', v_cached_job)
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'hash', v_hash);
    END IF;

    UPDATE trips
    SET quick_scans_used_this_week = quick_scans_used_this_week + 1
    WHERE trip_id = p_trip_id;
  END IF;

  INSERT INTO job_queue (job_type, status, payload)
  VALUES (
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

GRANT EXECUTE ON FUNCTION initiate_quick_scan(uuid, jsonb, uuid) TO authenticated;
