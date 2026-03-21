/*
  Foundations for:
  - F-6.6.3 Dual-Presence Verification (DPV) v1.1
  - F-6.6.4 Emergency Location Availability (guardian-controlled expiry)
  - F-6.6.6 Emergency Delegate & Backup Contact System
*/

CREATE TABLE IF NOT EXISTS biometric_verification_log (
  verification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  biometric_type text NOT NULL CHECK (biometric_type IN ('touch_id', 'face_id', 'other')),
  verification_result text NOT NULL CHECK (verification_result IN ('success', 'failed', 'canceled')),
  device_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biometric_verification_account_created
  ON biometric_verification_log(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dual_presence_bypass_codes (
  code_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT 'add_trusted_device',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz NULL,
  used_device_id uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_dpv_bypass_code_expires
  ON dual_presence_bypass_codes(expires_at);

CREATE TABLE IF NOT EXISTS emergency_modes (
  emergency_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_id uuid NULL REFERENCES incidents(id) ON DELETE SET NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  ended_at timestamptz NULL,
  ended_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  end_method text NULL CHECK (end_method IN ('guardian_manual', 'subject_manual', 'auto_expire', 'trip_end', 'system')),
  auto_expire_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  guardian_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_is_minor boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_emergency_modes_account_status
  ON emergency_modes(account_id, status, activated_at DESC);

CREATE TABLE IF NOT EXISTS emergency_delegates (
  delegate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegate_name text NOT NULL,
  phone_e164 text NOT NULL,
  email text NOT NULL,
  role_tag text NOT NULL DEFAULT 'custom',
  priority_level integer NOT NULL DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 4),
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'confirmed', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_delegates_owner_email_unique
  ON emergency_delegates(owner_account_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_emergency_delegates_owner_status
  ON emergency_delegates(owner_account_id, verification_status);

CREATE OR REPLACE FUNCTION update_emergency_delegate_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emergency_delegate_updated_at ON emergency_delegates;
CREATE TRIGGER trg_emergency_delegate_updated_at
BEFORE UPDATE ON emergency_delegates
FOR EACH ROW EXECUTE FUNCTION update_emergency_delegate_updated_at();

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('biometric_verification_attempted', 1, 'F-6.6.3', 'info'),
  ('biometric_verification_success', 1, 'F-6.6.3', 'info'),
  ('biometric_verification_failed', 1, 'F-6.6.3', 'warning'),
  ('security_preference_changed', 1, 'F-6.6.3', 'info'),
  ('bypass_code_generated', 1, 'F-6.6.3', 'warning'),
  ('bypass_code_used', 1, 'F-6.6.3', 'info'),
  ('bypass_code_expired', 1, 'F-6.6.3', 'warning'),
  ('geolocation_manual_override', 1, 'F-6.6.3', 'warning'),
  ('emergency_mode_activated', 1, 'F-6.6.4', 'critical'),
  ('emergency_mode_ended', 1, 'F-6.6.4', 'info'),
  ('emergency_ended_by_guardian', 1, 'F-6.6.4', 'info'),
  ('emergency_end_attempt_by_minor', 1, 'F-6.6.4', 'warning'),
  ('emergency_auto_expired', 1, 'F-6.6.4', 'warning'),
  ('emergency_reactivated', 1, 'F-6.6.4', 'warning'),
  ('emergency_delegate_notified', 1, 'F-6.6.6', 'critical'),
  ('delegate_dashboard_accessed', 1, 'F-6.6.6', 'info'),
  ('delegate_notification_failed', 1, 'F-6.6.6', 'warning')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION create_dual_presence_bypass_code(
  p_account_id uuid,
  p_actor_id uuid,
  p_action_type text DEFAULT 'add_trusted_device',
  p_expires_in_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_row dual_presence_bypass_codes%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO dual_presence_bypass_codes (code, account_id, action_type, expires_at)
  VALUES (v_code, p_account_id, p_action_type, now() + make_interval(hours => GREATEST(1, p_expires_in_hours)))
  RETURNING * INTO v_row;

  v_emit := emit_event(
    p_event_type := 'bypass_code_generated',
    p_feature_id := 'F-6.6.3',
    p_scope_type := 'system',
    p_scope_id := p_account_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'manual_founder_approval',
    p_metadata := jsonb_build_object('code_id', v_row.code_id, 'account_id', p_account_id, 'action_type', p_action_type)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code_id', v_row.code_id,
    'code', v_row.code,
    'expires_at', v_row.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION consume_dual_presence_bypass_code(
  p_code text,
  p_actor_id uuid,
  p_device_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row dual_presence_bypass_codes%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT *
  INTO v_row
  FROM dual_presence_bypass_codes
  WHERE code = upper(trim(coalesce(p_code, '')))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_row.used THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_already_used');
  END IF;

  IF v_row.expires_at < now() THEN
    UPDATE dual_presence_bypass_codes
    SET used = true, used_at = now()
    WHERE code_id = v_row.code_id;
    RETURN jsonb_build_object('success', false, 'error', 'code_expired');
  END IF;

  IF v_row.account_id <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE dual_presence_bypass_codes
  SET used = true,
      used_at = now(),
      used_device_id = p_device_id
  WHERE code_id = v_row.code_id;

  v_emit := emit_event(
    p_event_type := 'bypass_code_used',
    p_feature_id := 'F-6.6.3',
    p_scope_type := 'system',
    p_scope_id := p_actor_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'trusted_device_recovery',
    p_metadata := jsonb_build_object('code_id', v_row.code_id, 'device_id', p_device_id)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object('success', true, 'account_id', p_actor_id, 'code_id', v_row.code_id);
END;
$$;

CREATE OR REPLACE FUNCTION end_emergency_mode_guardian_confirm(
  p_emergency_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_em emergency_modes%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT *
  INTO v_em
  FROM emergency_modes
  WHERE emergency_id = p_emergency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'emergency_not_found');
  END IF;

  IF v_em.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_ended');
  END IF;

  IF v_em.subject_is_minor AND v_em.guardian_id IS DISTINCT FROM p_actor_id THEN
    v_emit := emit_event(
      p_event_type := 'emergency_end_attempt_by_minor',
      p_feature_id := 'F-6.6.4',
      p_scope_type := 'incident',
      p_scope_id := COALESCE(v_em.incident_id, p_emergency_id),
      p_actor_id := p_actor_id,
      p_actor_type := 'user',
      p_reason_code := 'guardian_confirmation_required',
      p_metadata := jsonb_build_object('emergency_id', p_emergency_id, 'minor_account_id', v_em.account_id)
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'guardian_confirmation_required');
  END IF;

  IF NOT v_em.subject_is_minor AND p_actor_id NOT IN (v_em.account_id, COALESCE(v_em.guardian_id, p_actor_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE emergency_modes
  SET status = 'ended',
      ended_at = now(),
      ended_by = p_actor_id,
      end_method = CASE WHEN v_em.subject_is_minor THEN 'guardian_manual' ELSE 'subject_manual' END
  WHERE emergency_id = p_emergency_id;

  v_emit := emit_event(
    p_event_type := CASE WHEN v_em.subject_is_minor THEN 'emergency_ended_by_guardian' ELSE 'emergency_mode_ended' END,
    p_feature_id := 'F-6.6.4',
    p_scope_type := 'incident',
    p_scope_id := COALESCE(v_em.incident_id, p_emergency_id),
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'confirmed_safe',
    p_metadata := jsonb_build_object('emergency_id', p_emergency_id, 'account_id', v_em.account_id)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object('success', true, 'emergency_id', p_emergency_id, 'ended_by', p_actor_id);
END;
$$;

CREATE OR REPLACE FUNCTION add_emergency_delegate(
  p_owner_account_id uuid,
  p_delegate_name text,
  p_phone_e164 text,
  p_email text,
  p_role_tag text DEFAULT 'custom',
  p_priority_level integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row emergency_delegates%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_account_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  INSERT INTO emergency_delegates (
    owner_account_id, delegate_name, phone_e164, email, role_tag, priority_level
  ) VALUES (
    p_owner_account_id, p_delegate_name, p_phone_e164, lower(trim(p_email)), p_role_tag, GREATEST(1, LEAST(4, p_priority_level))
  )
  RETURNING * INTO v_row;

  v_emit := emit_event(
    p_event_type := 'emergency_delegate_notified',
    p_feature_id := 'F-6.6.6',
    p_scope_type := 'system',
    p_scope_id := p_owner_account_id,
    p_actor_id := p_owner_account_id,
    p_actor_type := 'user',
    p_reason_code := 'delegate_added',
    p_metadata := jsonb_build_object(
      'delegate_id', v_row.delegate_id,
      'role_tag', v_row.role_tag,
      'verification_status', v_row.verification_status
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'delegate_id', v_row.delegate_id,
    'verification_status', v_row.verification_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_dual_presence_bypass_code(uuid, uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION consume_dual_presence_bypass_code(text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION end_emergency_mode_guardian_confirm(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_emergency_delegate(uuid, text, text, text, text, integer) TO authenticated, service_role;
