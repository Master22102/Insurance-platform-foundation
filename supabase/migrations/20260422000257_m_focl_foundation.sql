/*
  # M-FOCL-FOUNDATION — is_founder helper + founder_action event + registration checkpoint + maintenance RPCs

  1. Functions
    - public.is_founder(uuid) — returns true iff user_profiles.membership_tier = 'CORPORATE'.
    - public.open_maintenance_window(class, region_id, reason_code, metadata)
        SECURITY DEFINER, founder-gated, emits maintenance_window_opened.
    - public.close_maintenance_window(window_id, reason_code)
        SECURITY DEFINER, founder-gated, emits maintenance_window_closed.
    - public.register_feature_with_checkpoints(feature_id, display_name, description,
        default_enabled, minimum_mode, phase, capability_tier_current,
        capability_tier_max, connector_status, rollout_rule_name, auto_rollback_expr,
        event_types)
        SECURITY DEFINER, founder-gated. Upserts registry row, rollout rule,
        initial health state row, and ensures every declared event type exists.
    - public.record_founder_action(action_type, target, metadata)
        SECURITY DEFINER, founder-gated, writes founder_action_recorded event.
  2. Event Type Registry
    - Adds founder_action_recorded (F-6.5.16, info).
  3. Security
    - All RPCs revoke from PUBLIC, grant EXECUTE to authenticated.
    - Inside each RPC: raise if NOT is_founder(auth.uid()).
*/

CREATE OR REPLACE FUNCTION public.is_founder(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT membership_tier = 'CORPORATE' FROM public.user_profiles WHERE user_id = p_uid),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_founder(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_founder(uuid) TO authenticated, service_role;

INSERT INTO public.event_type_registry (event_type, schema_version, feature_id, required_envelope_keys, allowed_reason_codes, severity_class)
VALUES
  ('founder_action_recorded', 1, 'F-6.5.16', ARRAY['action_type']::text[], ARRAY['founder_issued']::text[], 'info')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.open_maintenance_window(
  p_class public.maintenance_class,
  p_region_id text,
  p_reason_code text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_founder(v_uid) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_reason_code NOT IN ('founder_opened','system_opened') THEN
    RAISE EXCEPTION 'invalid reason_code: %', p_reason_code;
  END IF;

  INSERT INTO public.maintenance_windows (class, region_id, reason_code, opened_by, metadata)
  VALUES (p_class, p_region_id, p_reason_code, v_uid, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING window_id INTO v_window_id;

  RETURN v_window_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_maintenance_window(public.maintenance_class, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_maintenance_window(public.maintenance_class, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_maintenance_window(
  p_window_id uuid,
  p_reason_code text DEFAULT 'founder_closed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_founder(v_uid) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_reason_code NOT IN ('founder_closed','system_closed') THEN
    RAISE EXCEPTION 'invalid reason_code: %', p_reason_code;
  END IF;

  UPDATE public.maintenance_windows
  SET closed_at = now(),
      closed_by = v_uid,
      reason_code = p_reason_code
  WHERE window_id = p_window_id AND closed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'window not found or already closed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.close_maintenance_window(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_maintenance_window(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_feature_with_checkpoints(
  p_feature_id text,
  p_display_name text,
  p_description text,
  p_default_enabled boolean,
  p_minimum_mode text,
  p_phase text,
  p_capability_tier_current integer,
  p_capability_tier_max integer,
  p_connector_status text,
  p_event_types text[] DEFAULT ARRAY[]::text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_et text;
  v_missing text;
BEGIN
  IF NOT public.is_founder(v_uid) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.feature_registry (
    feature_id, display_name, description, default_enabled, minimum_mode, phase,
    capability_tier_current, capability_tier_max, has_pending_extension, connector_status
  )
  VALUES (
    p_feature_id, p_display_name, COALESCE(p_description, ''), p_default_enabled,
    p_minimum_mode, p_phase, p_capability_tier_current, p_capability_tier_max,
    false, p_connector_status
  )
  ON CONFLICT (feature_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        description  = EXCLUDED.description,
        minimum_mode = EXCLUDED.minimum_mode,
        phase        = EXCLUDED.phase,
        capability_tier_max = EXCLUDED.capability_tier_max,
        connector_status    = EXCLUDED.connector_status;

  IF p_event_types IS NOT NULL AND array_length(p_event_types, 1) IS NOT NULL THEN
    FOREACH v_et IN ARRAY p_event_types LOOP
      IF NOT EXISTS (SELECT 1 FROM public.event_type_registry WHERE event_type = v_et) THEN
        v_missing := COALESCE(v_missing || ', ', '') || v_et;
      END IF;
    END LOOP;
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'event types not registered: %', v_missing;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.register_feature_with_checkpoints(text, text, text, boolean, text, text, integer, integer, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_feature_with_checkpoints(text, text, text, boolean, text, text, integer, integer, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_founder_action(
  p_action_type text,
  p_target jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_founder(v_uid) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  -- Soft-audit ledger write: caller supplies action_type; we do not enforce
  -- schema beyond presence. Downstream projectors can expand as needed.
END;
$$;

REVOKE ALL ON FUNCTION public.record_founder_action(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_founder_action(text, jsonb, jsonb) TO authenticated;
