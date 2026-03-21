/*
  # Section 4.1 + 3.0 Policy Governance Determinism

  Aligns policy version confidence and deterministic governance rules with:
  - Section 4.1 (HIGH or USER_CONFIRMED auto-gap closure eligibility)
  - Section 3.0 (registry-backed event emission surfaces)

  This migration is additive and backward-safe.
*/

-- 1) Extend policy_versions confidence tier to include USER_CONFIRMED.
ALTER TABLE policy_versions
  DROP CONSTRAINT IF EXISTS policy_versions_confidence_tier_check;

ALTER TABLE policy_versions
  ADD CONSTRAINT policy_versions_confidence_tier_check
  CHECK (confidence_tier IN (
    'HIGH',
    'USER_CONFIRMED',
    'CONDITIONAL',
    'AMBIGUOUS',
    'DOCUMENTATION_INCOMPLETE',
    'CONFLICT_PRESENT',
    'INSUFFICIENT_DATA'
  ));

-- 2) Deterministic eligibility helper:
-- only HIGH or USER_CONFIRMED clauses/versions may close coverage gaps automatically.
CREATE OR REPLACE FUNCTION policy_version_is_gap_closure_eligible(
  p_version_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
BEGIN
  SELECT confidence_tier
  INTO v_tier
  FROM policy_versions
  WHERE version_id = p_version_id;

  IF v_tier IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_tier IN ('HIGH', 'USER_CONFIRMED');
END;
$$;

GRANT EXECUTE ON FUNCTION policy_version_is_gap_closure_eligible(uuid) TO authenticated, service_role;

-- 3) Manual confirmation surface for governance-aligned upgrades.
-- This enables explicit human confirmation transitions without mutable history.
CREATE OR REPLACE FUNCTION policy_versions_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Standard doctrine: immutable after creation.
  -- Narrow exception: explicit USER_CONFIRMED promotion from sanctioned RPC.
  IF current_setting('app.policy_user_confirm_override', true) = 'on'
     AND NEW.confidence_tier = 'USER_CONFIRMED'
     AND OLD.confidence_tier <> 'USER_CONFIRMED'
     AND NEW.policy_id = OLD.policy_id
     AND NEW.version_number = OLD.version_number
     AND NEW.content_hash = OLD.content_hash
     AND NEW.normalization_pipeline_version = OLD.normalization_pipeline_version
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'policy_versions is immutable after creation';
END;
$$;

CREATE OR REPLACE FUNCTION mark_policy_version_user_confirmed(
  p_version_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row policy_versions%ROWTYPE;
  v_emit jsonb;
BEGIN
  SELECT * INTO v_row
  FROM policy_versions
  WHERE version_id = p_version_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'VERSION_NOT_FOUND');
  END IF;

  IF v_row.ingested_by <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'FORBIDDEN');
  END IF;

  IF v_row.confidence_tier = 'USER_CONFIRMED' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'ALREADY_CONFIRMED');
  END IF;

  -- policy_versions is immutable by doctrine; this function is the only sanctioned
  -- confidence upgrade path and keeps all transitions event-ledger bound.
  PERFORM set_config('app.policy_user_confirm_override', 'on', true);
  UPDATE policy_versions
  SET confidence_tier = 'USER_CONFIRMED'
  WHERE version_id = p_version_id;
  PERFORM set_config('app.policy_user_confirm_override', 'off', true);

  v_emit := emit_event(
    p_event_type  := 'policy_version_user_confirmed',
    p_feature_id  := 'F-6.5.1',
    p_scope_type  := 'policy_version',
    p_scope_id    := p_version_id,
    p_actor_id    := p_actor_id,
    p_actor_type  := 'traveler',
    p_reason_code := 'USER_CONFIRMATION',
    p_metadata    := jsonb_build_object(
      'previous_confidence_tier', v_row.confidence_tier,
      'new_confidence_tier', 'USER_CONFIRMED'
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'CONFIRMED');
END;
$$;

GRANT EXECUTE ON FUNCTION mark_policy_version_user_confirmed(uuid, uuid) TO authenticated, service_role;

-- 4) Register new event types required by this section.
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('policy_version_user_confirmed', 1, 'F-6.5.1', 'info'),
  ('policy_gap_closure_eligibility_evaluated', 1, 'F-6.5.2', 'info')
ON CONFLICT (event_type) DO NOTHING;
