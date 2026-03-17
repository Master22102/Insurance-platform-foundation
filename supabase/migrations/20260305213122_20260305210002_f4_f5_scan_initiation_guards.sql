/*
  # F-4 + F-5: Scan Initiation Guards
  Single guarded RPC entry point for all scan requests.
  Enforces Tier 0 lifetime cap, paid trip weekly cap, cache hit detection, credit consumption.
  Invariant DS-1: Deep Scan requires explicit user confirmation. No silent deduction.
  Invariant DS-2: Credits always finite — checked against trip before deduction.
*/

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('quick_scan_requested', 1, 'scans', 'info'),
  ('quick_scan_completed', 1, 'scans', 'info'),
  ('quick_scan_rate_limited', 1, 'scans', 'warning'),
  ('quick_scan_cache_hit', 1, 'scans', 'info'),
  ('deep_scan_requested', 1, 'scans', 'info'),
  ('deep_scan_completed', 1, 'scans', 'info'),
  ('deep_scan_credit_purchase_required', 1, 'scans', 'warning'),
  ('itinerary_snapshot_confirmed', 1, 'trips', 'info'),
  ('itinerary_version_created', 1, 'trips', 'info'),
  ('alignment_comparison_completed', 1, 'trips', 'info'),
  ('alignment_review_prompt_presented', 1, 'trips', 'warning'),
  ('user_acknowledged_alignment_change', 1, 'trips', 'info')
ON CONFLICT (event_type) DO NOTHING;

-- Create job_queue table if it doesn't exist (needed for scan job tracking)
CREATE TABLE IF NOT EXISTS job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_job_queue_type_status ON job_queue(job_type, status);
CREATE INDEX IF NOT EXISTS idx_job_queue_created ON job_queue(created_at DESC);

ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_queue_user_select ON job_queue
  FOR SELECT USING (payload->>'user_id' = auth.uid()::text);

-- initiate_quick_scan(): guarded entry for all Quick Scan requests
CREATE OR REPLACE FUNCTION initiate_quick_scan(p_user_id uuid, p_itinerary_snapshot jsonb, p_trip_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile user_profiles%ROWTYPE; v_trip trips%ROWTYPE;
  v_hash text; v_job_id uuid; v_cached_job uuid; v_emit jsonb;
  v_is_paid boolean := (p_trip_id IS NOT NULL);
BEGIN
  SELECT * INTO v_profile FROM user_profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'profile_not_found'); END IF;

  v_hash := encode(digest(p_itinerary_snapshot::text, 'sha256'), 'hex');

  IF NOT v_is_paid THEN
    -- Tier 0 hard cap (Invariant T0-1)
    IF v_profile.lifetime_quick_scans_used >= 2 THEN
      v_emit := emit_event(p_event_type := 'quick_scan_rate_limited', p_feature_id := 'scans',
        p_scope_type := 'user', p_scope_id := p_user_id, p_actor_id := p_user_id, p_actor_type := 'user',
        p_reason_code := 'lifetime_cap_reached',
        p_metadata := jsonb_build_object('lifetime_scans_used', v_profile.lifetime_quick_scans_used, 'lifetime_cap', 2));
      RETURN jsonb_build_object('success', false, 'error', 'lifetime_quick_scan_cap_reached',
        'paywall', true, 'scans_used', v_profile.lifetime_quick_scans_used, 'conversion_prompt', 'unlock_trip');
    END IF;

    -- Cache hit check (7-day TTL)
    SELECT j.id INTO v_cached_job FROM job_queue j
    WHERE j.job_type = 'quick_scan' AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'user_id' = p_user_id::text AND j.created_at > now() - interval '7 days' AND j.status = 'completed'
    ORDER BY j.created_at DESC LIMIT 1;

    IF v_cached_job IS NOT NULL THEN
      PERFORM emit_event(p_event_type := 'quick_scan_cache_hit', p_feature_id := 'scans',
        p_scope_type := 'user', p_scope_id := p_user_id, p_actor_id := p_user_id, p_actor_type := 'user',
        p_reason_code := 'identical_itinerary_hash', p_metadata := jsonb_build_object('cached_job_id', v_cached_job, 'hash', v_hash));
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'hash', v_hash);
    END IF;

    UPDATE user_profiles SET lifetime_quick_scans_used = lifetime_quick_scans_used + 1, updated_at = now() WHERE user_id = p_user_id;

  ELSE
    -- Paid trip path
    SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_found'); END IF;
    IF NOT v_trip.paid_unlock THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked'); END IF;

    IF v_trip.quick_scan_week_reset_at < now() - interval '7 days' THEN
      UPDATE trips SET quick_scans_used_this_week = 0, quick_scan_week_reset_at = now() WHERE trip_id = p_trip_id;
      v_trip.quick_scans_used_this_week := 0;
    END IF;

    IF v_trip.quick_scans_used_this_week >= 4 THEN
      v_emit := emit_event(p_event_type := 'quick_scan_rate_limited', p_feature_id := 'scans',
        p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_user_id, p_actor_type := 'user',
        p_reason_code := 'weekly_limit_reached',
        p_metadata := jsonb_build_object('trip_id', p_trip_id, 'scans_this_week', v_trip.quick_scans_used_this_week));
      RETURN jsonb_build_object('success', false, 'error', 'weekly_quick_scan_limit_reached',
        'scans_used', v_trip.quick_scans_used_this_week, 'resets_at', v_trip.quick_scan_week_reset_at + interval '7 days');
    END IF;

    -- Cache hit on paid trip (does not count against weekly limit)
    SELECT j.id INTO v_cached_job FROM job_queue j
    WHERE j.job_type = 'quick_scan' AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'trip_id' = p_trip_id::text AND j.created_at > now() - interval '7 days' AND j.status = 'completed'
    ORDER BY j.created_at DESC LIMIT 1;

    IF v_cached_job IS NOT NULL THEN
      PERFORM emit_event(p_event_type := 'quick_scan_cache_hit', p_feature_id := 'scans',
        p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_user_id, p_actor_type := 'user',
        p_reason_code := 'identical_itinerary_hash', p_metadata := jsonb_build_object('cached_job_id', v_cached_job));
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'hash', v_hash);
    END IF;

    UPDATE trips SET quick_scans_used_this_week = quick_scans_used_this_week + 1 WHERE trip_id = p_trip_id;
  END IF;

  INSERT INTO job_queue (job_type, status, payload)
  VALUES ('quick_scan', 'pending', jsonb_build_object('user_id', p_user_id, 'trip_id', p_trip_id,
    'itinerary_hash', v_hash, 'itinerary_data', p_itinerary_snapshot,
    'scan_tier', CASE WHEN v_is_paid THEN 'paid' ELSE 'free' END))
  RETURNING id INTO v_job_id;

  v_emit := emit_event(p_event_type := 'quick_scan_requested', p_feature_id := 'scans',
    p_scope_type := CASE WHEN v_is_paid THEN 'trip' ELSE 'user' END,
    p_scope_id := COALESCE(p_trip_id, p_user_id), p_actor_id := p_user_id, p_actor_type := 'user',
    p_reason_code := 'user_initiated',
    p_metadata := jsonb_build_object('job_id', v_job_id, 'itinerary_hash', v_hash,
      'scan_tier', CASE WHEN v_is_paid THEN 'paid' ELSE 'free' END, 'trip_id', p_trip_id));

  RETURN jsonb_build_object('success', true, 'cache_hit', false, 'job_id', v_job_id,
    'itinerary_hash', v_hash, 'event_id', v_emit->>'event_id');
END; $$;
GRANT EXECUTE ON FUNCTION initiate_quick_scan(uuid, jsonb, uuid) TO authenticated;

-- initiate_deep_scan(): requires explicit user confirmation (Invariant DS-1)
CREATE OR REPLACE FUNCTION initiate_deep_scan(p_user_id uuid, p_trip_id uuid, p_itinerary_snapshot jsonb, p_user_confirmed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_trip trips%ROWTYPE; v_hash text; v_job_id uuid; v_emit jsonb;
BEGIN
  IF NOT p_user_confirmed THEN
    RETURN jsonb_build_object('success', false, 'error', 'explicit_user_confirmation_required',
      'message', 'Deep Scan requires explicit user confirmation before credit is consumed.');
  END IF;

  SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_found'); END IF;
  IF NOT v_trip.paid_unlock THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked'); END IF;

  IF v_trip.deep_scan_credits_remaining <= 0 THEN
    PERFORM emit_event(p_event_type := 'deep_scan_credit_purchase_required', p_feature_id := 'scans',
      p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_user_id, p_actor_type := 'user',
      p_reason_code := 'credits_exhausted', p_metadata := jsonb_build_object('trip_id', p_trip_id));
    RETURN jsonb_build_object('success', false, 'error', 'no_deep_scan_credits_remaining',
      'purchase_required', true, 'credits_remaining', 0);
  END IF;

  v_hash := encode(digest(p_itinerary_snapshot::text, 'sha256'), 'hex');

  UPDATE trips SET deep_scan_credits_remaining = deep_scan_credits_remaining - 1 WHERE trip_id = p_trip_id;

  v_emit := emit_event(p_event_type := 'deep_scan_credit_consumed', p_feature_id := 'trips',
    p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_user_id, p_actor_type := 'user',
    p_reason_code := 'user_initiated',
    p_previous_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining),
    p_resulting_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining - 1),
    p_metadata := jsonb_build_object('trip_id', p_trip_id, 'credits_before', v_trip.deep_scan_credits_remaining, 'credits_after', v_trip.deep_scan_credits_remaining - 1));

  IF v_trip.deep_scan_credits_remaining - 1 = 0 THEN
    PERFORM emit_event(p_event_type := 'deep_scan_credits_exhausted', p_feature_id := 'trips',
      p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_user_id, p_actor_type := 'user',
      p_reason_code := 'last_credit_consumed', p_metadata := jsonb_build_object('trip_id', p_trip_id));
  END IF;

  INSERT INTO job_queue (job_type, status, payload)
  VALUES ('deep_scan', 'pending', jsonb_build_object('user_id', p_user_id, 'trip_id', p_trip_id,
    'itinerary_hash', v_hash, 'itinerary_data', p_itinerary_snapshot))
  RETURNING id INTO v_job_id;

  PERFORM emit_event(p_event_type := 'deep_scan_requested', p_feature_id := 'scans',
    p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_user_id, p_actor_type := 'user',
    p_reason_code := 'user_confirmed',
    p_metadata := jsonb_build_object('job_id', v_job_id, 'itinerary_hash', v_hash, 'credits_remaining', v_trip.deep_scan_credits_remaining - 1));

  RETURN jsonb_build_object('success', true, 'job_id', v_job_id, 'itinerary_hash', v_hash,
    'credits_remaining', v_trip.deep_scan_credits_remaining - 1, 'credit_event_id', v_emit->>'event_id');
END; $$;
GRANT EXECUTE ON FUNCTION initiate_deep_scan(uuid, uuid, jsonb, boolean) TO authenticated;