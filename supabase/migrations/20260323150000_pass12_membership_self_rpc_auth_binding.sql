/*
  Pass 12: Bind account membership RPCs to the authenticated subject.

  consume_scan_credit was already REVOKE'd from authenticated in pass8.
  These functions remain callable by authenticated users but previously accepted
  arbitrary p_user_id — now p_user_id must equal auth.uid() (self-service only).
  Admin/service-tier changes should use service role or a future dedicated RPC.
*/

CREATE OR REPLACE FUNCTION request_step_up_verification(
  p_user_id uuid,
  p_mutation_class text,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_requires_step_up boolean := false;
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('required', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('required', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('required', false, 'error', 'profile_not_found');
  END IF;

  IF p_mutation_class IN ('EXPORT_GRANT', 'ORGANIZER_TRANSFER', 'TIER_UPGRADE', 'MFA_DISABLE') THEN
    v_requires_step_up := true;
  END IF;

  IF NOT v_requires_step_up THEN
    RETURN jsonb_build_object('required', false, 'reason', 'mutation_class_not_sensitive');
  END IF;

  IF v_profile.last_step_up_at IS NOT NULL
     AND v_profile.last_step_up_at > (now() - interval '15 minutes') THEN
    RETURN jsonb_build_object(
      'required', false,
      'reason', 'recently_verified',
      'last_verified_at', v_profile.last_step_up_at,
      'expires_at', v_profile.last_step_up_at + interval '15 minutes'
    );
  END IF;

  v_emit_result := emit_event(
    p_event_type := 'step_up_verification_requested',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'sensitive_mutation',
    p_metadata := jsonb_build_object(
      'mutation_class', p_mutation_class,
      'session_id', p_session_id
    )
  );

  RETURN jsonb_build_object(
    'required', true,
    'mutation_class', p_mutation_class,
    'mfa_enabled', v_profile.mfa_enabled,
    'available_methods', v_profile.mfa_methods,
    'message', 'Please re-authenticate or complete MFA challenge'
  );
END;
$$;

CREATE OR REPLACE FUNCTION complete_step_up_verification(
  p_user_id uuid,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE user_profiles
  SET last_step_up_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;

  IF p_session_id IS NOT NULL THEN
    UPDATE session_tokens
    SET step_up_verified_at = now()
    WHERE session_id = p_session_id
      AND user_id = p_user_id;
  END IF;

  v_emit_result := emit_event(
    p_event_type := 'step_up_verification_completed',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'verification_success',
    p_metadata := jsonb_build_object(
      'session_id', p_session_id,
      'verified_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'verified_at', now(),
    'expires_at', now() + interval '15 minutes'
  );
END;
$$;

CREATE OR REPLACE FUNCTION update_membership_tier(
  p_user_id uuid,
  p_new_tier text,
  p_expires_at timestamptz DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_old_tier text;
  v_entitlement membership_entitlements%ROWTYPE;
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_old_tier := v_profile.membership_tier;

  SELECT * INTO v_entitlement
  FROM membership_entitlements
  WHERE tier = p_new_tier;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tier');
  END IF;

  UPDATE user_profiles
  SET membership_tier = p_new_tier,
      previous_tier = v_old_tier,
      tier_granted_at = now(),
      tier_expires_at = p_expires_at,
      scan_credits_remaining = v_entitlement.monthly_basic_scan_quota,
      deep_scan_credits_remaining = v_entitlement.monthly_deep_scan_quota,
      updated_at = now()
  WHERE user_id = p_user_id;

  v_emit_result := emit_event(
    p_event_type := 'tier_changed',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'tier_update',
    p_previous_state := jsonb_build_object('tier', v_old_tier),
    p_resulting_state := jsonb_build_object('tier', p_new_tier),
    p_metadata := jsonb_build_object(
      'old_tier', v_old_tier,
      'new_tier', p_new_tier,
      'expires_at', p_expires_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_tier', v_old_tier,
    'new_tier', p_new_tier,
    'tier_granted_at', now(),
    'tier_expires_at', p_expires_at,
    'event_id', v_emit_result->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION record_mfa_enrollment(
  p_user_id uuid,
  p_mfa_method text,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_methods text[];
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_methods := v_profile.mfa_methods;

  IF p_action = 'enroll' THEN
    IF NOT (p_mfa_method = ANY(v_methods)) THEN
      v_methods := array_append(v_methods, p_mfa_method);
    END IF;

    UPDATE user_profiles
    SET mfa_enabled = true,
        mfa_methods = v_methods,
        updated_at = now()
    WHERE user_id = p_user_id;

    v_emit_result := emit_event(
      p_event_type := 'mfa_enrolled',
      p_feature_id := 'accounts',
      p_scope_type := 'user',
      p_scope_id := p_user_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := 'mfa_setup',
      p_metadata := jsonb_build_object(
        'mfa_method', p_mfa_method,
        'total_methods', array_length(v_methods, 1)
      )
    );

  ELSIF p_action = 'unenroll' THEN
    v_methods := array_remove(v_methods, p_mfa_method);

    UPDATE user_profiles
    SET mfa_enabled = CASE WHEN array_length(v_methods, 1) > 0 THEN true ELSE false END,
        mfa_methods = v_methods,
        updated_at = now()
    WHERE user_id = p_user_id;

    v_emit_result := emit_event(
      p_event_type := 'mfa_unenrolled',
      p_feature_id := 'accounts',
      p_scope_type := 'user',
      p_scope_id := p_user_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := 'mfa_removal',
      p_metadata := jsonb_build_object(
        'mfa_method', p_mfa_method,
        'remaining_methods', array_length(v_methods, 1)
      )
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'mfa_enabled', array_length(v_methods, 1) > 0,
    'mfa_methods', v_methods,
    'event_id', v_emit_result->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION create_session_token(
  p_user_id uuid,
  p_device_fingerprint text,
  p_device_name text DEFAULT NULL,
  p_device_type text DEFAULT 'web',
  p_user_agent text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id uuid;
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  INSERT INTO session_tokens (
    user_id,
    device_fingerprint,
    device_name,
    device_type,
    user_agent,
    ip_address
  ) VALUES (
    p_user_id,
    p_device_fingerprint,
    p_device_name,
    p_device_type,
    p_user_agent,
    p_ip_address
  )
  RETURNING session_id INTO v_session_id;

  v_emit_result := emit_event(
    p_event_type := 'session_created',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'new_session',
    p_metadata := jsonb_build_object(
      'session_id', v_session_id,
      'device_type', p_device_type
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'expires_at', now() + interval '30 days'
  );
END;
$$;
