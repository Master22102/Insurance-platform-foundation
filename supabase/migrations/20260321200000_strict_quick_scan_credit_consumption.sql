/*
  Enforce strict emit-or-rollback for quick scan credit consumption.
  This function is intended for server-side quick scan flow usage.
*/

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES ('quick_scan_credit_consumed', 1, 'scans', 'info')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION consume_basic_scan_credit_strict(
  p_user_id uuid,
  p_reason text DEFAULT 'quick_scan_used'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_balance_after integer;
  v_emit jsonb;
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

  IF v_profile.scan_credits_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_credits_remaining');
  END IF;

  v_balance_after := v_profile.scan_credits_remaining - 1;

  UPDATE user_profiles
  SET
    scan_credits_remaining = v_balance_after,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO scan_credit_ledger (
    account_id,
    credit_type,
    credit_delta,
    balance_after,
    reason
  ) VALUES (
    p_user_id,
    'basic',
    -1,
    v_balance_after,
    p_reason
  );

  v_emit := emit_event(
    p_event_type := 'quick_scan_credit_consumed',
    p_feature_id := 'scans',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'quick_scan_credit_decrement',
    p_previous_state := jsonb_build_object('scan_credits_remaining', v_profile.scan_credits_remaining),
    p_resulting_state := jsonb_build_object('scan_credits_remaining', v_balance_after),
    p_metadata := jsonb_build_object('reason', p_reason)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  IF v_balance_after = 0 THEN
    v_emit := emit_event(
      p_event_type := 'scan_credits_depleted',
      p_feature_id := 'accounts',
      p_scope_type := 'user',
      p_scope_id := p_user_id,
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := 'basic_credits_depleted',
      p_metadata := jsonb_build_object('scan_type', 'basic', 'membership_tier', v_profile.membership_tier)
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'scan_credits_remaining', v_balance_after
  );
END;
$$;

GRANT EXECUTE ON FUNCTION consume_basic_scan_credit_strict(uuid, text) TO authenticated;
