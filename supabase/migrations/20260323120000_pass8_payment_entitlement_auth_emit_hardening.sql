/*
  Pass 8 hardening:
  - Auth-bind legacy payment/entitlement RPCs
  - Enforce emit_event success (emit-or-rollback) on mutating payment paths
  - Revoke deprecated unsafe credit mutation RPC from authenticated users
*/

CREATE OR REPLACE FUNCTION unlock_trip(
  p_trip_id uuid,
  p_actor_id uuid,
  p_credits_to_add integer DEFAULT 2,
  p_payment_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip trips%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_trip
  FROM trips
  WHERE trip_id = p_trip_id
    AND account_id = p_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;

  IF v_trip.paid_unlock THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_unlocked', 'paid_unlock_at', v_trip.paid_unlock_at);
  END IF;

  UPDATE trips
  SET
    paid_unlock = true,
    paid_unlock_at = now(),
    deep_scan_credits_remaining = p_credits_to_add,
    deep_scan_credits_purchased = p_credits_to_add
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(
    p_event_type := 'trip_unlocked',
    p_feature_id := 'trips',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'payment_confirmed',
    p_resulting_state := jsonb_build_object('paid_unlock', true, 'deep_scan_credits', p_credits_to_add),
    p_metadata := jsonb_build_object('credits_added', p_credits_to_add, 'payment_ref', p_payment_ref)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', p_trip_id,
    'deep_scan_credits_remaining', p_credits_to_add,
    'paid_unlock_at', now(),
    'event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION add_deep_scan_credits(
  p_trip_id uuid,
  p_actor_id uuid,
  p_credits integer,
  p_payment_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip trips%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_trip
  FROM trips
  WHERE trip_id = p_trip_id
    AND account_id = p_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;
  IF NOT v_trip.paid_unlock THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked');
  END IF;

  UPDATE trips
  SET
    deep_scan_credits_remaining = deep_scan_credits_remaining + p_credits,
    deep_scan_credits_purchased = deep_scan_credits_purchased + p_credits
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(
    p_event_type := 'deep_scan_credit_added',
    p_feature_id := 'trips',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'purchase',
    p_metadata := jsonb_build_object(
      'credits_added', p_credits,
      'new_total', v_trip.deep_scan_credits_remaining + p_credits,
      'payment_ref', p_payment_ref
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'credits_added', p_credits,
    'deep_scan_credits_remaining', v_trip.deep_scan_credits_remaining + p_credits
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_membership_entitlement(
  p_user_id uuid,
  p_feature_check text,
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
  v_has_access boolean := false;
  v_reason text;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_profile FROM user_profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_profile_not_found');
  END IF;

  CASE p_feature_check
    WHEN 'quick_scan' THEN
      IF v_profile.lifetime_quick_scans_used < 2 THEN
        v_has_access := true;
      ELSE
        v_has_access := false;
        v_reason := 'lifetime_quick_scan_cap_reached';
        v_emit := emit_event(
          p_event_type := 'tier_0_paywall_triggered',
          p_feature_id := 'accounts',
          p_scope_type := 'user',
          p_scope_id := p_user_id,
          p_actor_id := p_user_id,
          p_actor_type := 'user',
          p_reason_code := 'lifetime_cap_reached',
          p_metadata := jsonb_build_object('lifetime_scans_used', v_profile.lifetime_quick_scans_used)
        );
        IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
          RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
        END IF;
      END IF;
    WHEN 'quick_scan_paid' THEN
      IF p_trip_id IS NULL THEN
        v_has_access := false;
        v_reason := 'trip_id_required';
      ELSE
        SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_user_id;
        IF NOT FOUND OR NOT v_trip.paid_unlock THEN
          v_has_access := false;
          v_reason := 'trip_not_unlocked';
        ELSIF v_trip.quick_scan_week_reset_at < now() - interval '7 days' THEN
          UPDATE trips SET quick_scans_used_this_week = 0, quick_scan_week_reset_at = now() WHERE trip_id = p_trip_id;
          v_has_access := true;
        ELSIF v_trip.quick_scans_used_this_week < 4 THEN
          v_has_access := true;
        ELSE
          v_has_access := false;
          v_reason := 'weekly_quick_scan_limit_reached';
        END IF;
      END IF;
    WHEN 'deep_scan' THEN
      IF p_trip_id IS NULL THEN
        v_has_access := false;
        v_reason := 'trip_id_required';
      ELSE
        SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_user_id;
        IF NOT FOUND OR NOT v_trip.paid_unlock THEN
          v_has_access := false;
          v_reason := 'trip_not_unlocked';
        ELSIF v_trip.deep_scan_credits_remaining > 0 THEN
          v_has_access := true;
        ELSE
          v_has_access := false;
          v_reason := 'deep_scan_credits_exhausted';
        END IF;
      END IF;
    WHEN 'export_data' THEN
      v_has_access := (SELECT can_export_data FROM membership_entitlements WHERE tier = v_profile.membership_tier);
      v_reason := CASE WHEN NOT v_has_access THEN 'tier_insufficient_for_export' ELSE NULL END;
    WHEN 'api_access' THEN
      v_has_access := (SELECT can_use_api FROM membership_entitlements WHERE tier = v_profile.membership_tier);
      v_reason := CASE WHEN NOT v_has_access THEN 'tier_insufficient_for_api' ELSE NULL END;
    WHEN 'create_workspace' THEN
      v_has_access := (SELECT can_create_workspace FROM membership_entitlements WHERE tier = v_profile.membership_tier);
      v_reason := CASE WHEN NOT v_has_access THEN 'corporate_account_required' ELSE NULL END;
    ELSE
      v_has_access := false;
      v_reason := 'unknown_feature_check';
  END CASE;

  IF NOT v_has_access THEN
    v_emit := emit_event(
      p_event_type := 'entitlement_check_failed',
      p_feature_id := 'accounts',
      p_scope_type := 'user',
      p_scope_id := p_user_id,
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := v_reason,
      p_metadata := jsonb_build_object(
        'feature_check', p_feature_check,
        'membership_tier', v_profile.membership_tier,
        'lifetime_quick_scans_used', v_profile.lifetime_quick_scans_used,
        'trip_id', p_trip_id
      )
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_has_access,
    'reason', v_reason,
    'membership_tier', v_profile.membership_tier,
    'lifetime_quick_scans_used', v_profile.lifetime_quick_scans_used,
    'trip_id', p_trip_id,
    'deep_scan_credits_remaining', CASE WHEN v_trip.trip_id IS NOT NULL THEN v_trip.deep_scan_credits_remaining ELSE NULL END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION consume_scan_credit(uuid, text, uuid) FROM authenticated;
