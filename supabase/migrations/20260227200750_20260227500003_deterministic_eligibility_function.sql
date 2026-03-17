/*
  # Deterministic Feature Eligibility Function (B)

  ## Summary
  Core gating logic: decides if a given scope_id is eligible for a feature
  based on rollout_percentage using stable deterministic hash.

  ## Function: is_feature_eligible(feature_id, region_id, scope_id, scope_type)
  Returns boolean:
  - If feature DISABLED → false
  - If rollout_percentage = 100 → true
  - If rollout_percentage = 0 → false
  - Else: hash(scope_id || feature_id || region_id) mod 100 < rollout_percentage

  ## Hash Algorithm
  Uses PostgreSQL's hashtext() for deterministic string hashing.
  Stability: same inputs always yield same hash → same eligibility decision.

  ## Usage
  Called by:
  - All feature RPCs before executing logic (guard pattern)
  - FOCL UI to show eligibility status per incident/user/trip
  - Test harness to verify deterministic behavior

  ## Security
  - SECURITY DEFINER (read-only, no side effects)
  - EXECUTE granted to authenticated

  ## Returns
  - true: scope is eligible (feature gate open)
  - false: scope not eligible (feature suppressed or rolled back)
*/

CREATE OR REPLACE FUNCTION is_feature_eligible(
  p_feature_id  text,
  p_region_id   uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_scope_id    uuid    DEFAULT NULL,
  p_scope_type  text    DEFAULT 'INCIDENT'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_enabled              boolean;
  v_rollout_percentage   int;
  v_rollout_scope_type   text;
  v_default_enabled      boolean;
  v_hash_input           text;
  v_hash_mod             int;
BEGIN
  -- Resolve feature state (override or default)
  SELECT
    COALESCE(fas.enabled, fr.default_enabled),
    COALESCE(fas.rollout_percentage, 0),
    COALESCE(fas.rollout_scope_type, 'INCIDENT'),
    fr.default_enabled
  INTO
    v_enabled,
    v_rollout_percentage,
    v_rollout_scope_type,
    v_default_enabled
  FROM feature_registry fr
  LEFT JOIN feature_activation_state fas
    ON fas.feature_id = fr.feature_id
    AND fas.region_id = p_region_id
  WHERE fr.feature_id = p_feature_id;

  IF NOT FOUND THEN
    RETURN false;  -- Unknown feature → not eligible
  END IF;

  IF NOT v_enabled THEN
    RETURN false;  -- Feature disabled → not eligible
  END IF;

  -- Full rollout (100%)
  IF v_rollout_percentage >= 100 THEN
    RETURN true;
  END IF;

  -- No rollout (0%)
  IF v_rollout_percentage <= 0 THEN
    RETURN false;
  END IF;

  -- Gradual rollout: deterministic hash eligibility
  -- If scope_id is NULL, cannot evaluate gradual rollout → return false
  IF p_scope_id IS NULL THEN
    RETURN false;
  END IF;

  -- Build hash input: scope_id || feature_id || region_id
  -- This ensures stable, reproducible hash per (scope, feature, region) tuple
  v_hash_input := p_scope_id::text || '|' || p_feature_id || '|' || p_region_id::text;

  -- Compute hash mod 100
  -- hashtext() returns int4, abs() ensures positive, mod 100 yields 0..99
  v_hash_mod := abs(hashtext(v_hash_input)) % 100;

  -- Eligible if hash_mod < rollout_percentage
  -- Example: rollout_percentage=20 → eligible if hash_mod in [0..19] (20% of scope_ids)
  RETURN v_hash_mod < v_rollout_percentage;
END;
$$;

GRANT EXECUTE ON FUNCTION is_feature_eligible(text, uuid, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION is_feature_eligible(text, uuid, uuid, text) FROM anon;

COMMENT ON FUNCTION is_feature_eligible IS 'Deterministic feature eligibility check based on rollout_percentage. Stable hash ensures same scope_id always gets same result for given feature+region.';
