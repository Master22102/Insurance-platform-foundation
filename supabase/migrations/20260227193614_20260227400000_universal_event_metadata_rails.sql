/*
  # Universal Event Metadata Rails + Canonical Reason Codes (Prompt 2 Foundation)

  ## Summary
  Establishes the canonical suppression event metadata shape and registers all
  canonical reason codes required by Prompt 2.

  ## A. Canonical Reason Codes
  Registers the 6 canonical reason codes required for all suppression/failure events:
  - FEATURE_DISABLED: Feature is registered but not activated in this region
  - DOCUMENTATION_INCOMPLETE: Required documentation or consent is missing
  - SOURCE_UNAVAILABLE: External data source is unreachable or not configured
  - PERMISSION_DENIED: Actor lacks required permission for this operation
  - RATE_LIMITED: Operation throttled due to rate limit policy
  - MODE_RESTRICTED: Current region operational mode does not permit this action

  ## B. Suppression Event Validator Function
  `validate_suppression_event_metadata(metadata jsonb)` — callable from stub RPCs
  to enforce the universal metadata rail shape before emitting suppression events.
  Returns ok:true or ok:false with a validation_error field.

  ## C. Founder-Readable Mode Display Names
  `get_mode_display_name(mode text)` — returns the founder-facing display label
  for each operational mode, used in FOCL/UX surfaces.

  ## D. Feature Gate Check Helper
  `check_feature_gate(p_feature_id text, p_region_id uuid)` — SECURITY DEFINER
  helper that returns enabled:true/false, used by all stub RPCs.

  ## E. Suppression Event Type Registration
  Registers generic suppression/pre-wire event types in event_type_registry.

  ## Security
  - All functions are SECURITY DEFINER
  - EXECUTE granted to authenticated
*/

-- =====================================================
-- A. Canonical Reason Codes
-- =====================================================

INSERT INTO reason_code_registry (reason_code, description) VALUES
  ('FEATURE_DISABLED',          'Feature is registered but not activated in this region/mode'),
  ('DOCUMENTATION_INCOMPLETE',  'Required documentation, consent, or configuration is missing'),
  ('SOURCE_UNAVAILABLE',        'External data source is unreachable or not yet configured'),
  ('PERMISSION_DENIED',         'Actor does not have the required permission for this operation'),
  ('RATE_LIMITED',              'Operation is throttled; retry after the indicated backoff period'),
  ('MODE_RESTRICTED',           'Current region operational mode does not permit this action')
ON CONFLICT (reason_code) DO NOTHING;

-- =====================================================
-- B. Feature Gate Check Helper
-- =====================================================

CREATE OR REPLACE FUNCTION check_feature_gate(
  p_feature_id text,
  p_region_id  uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_default_enabled boolean;
  v_override_enabled boolean;
  v_enabled boolean;
BEGIN
  SELECT default_enabled INTO v_default_enabled
  FROM feature_registry
  WHERE feature_id = p_feature_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'enabled', false,
      'reason',  'feature_id not found in registry',
      'feature_id', p_feature_id
    );
  END IF;

  SELECT enabled INTO v_override_enabled
  FROM feature_activation_state
  WHERE feature_id = p_feature_id
    AND region_id  = p_region_id;

  v_enabled := COALESCE(v_override_enabled, v_default_enabled);

  RETURN jsonb_build_object(
    'enabled',    v_enabled,
    'feature_id', p_feature_id,
    'region_id',  p_region_id,
    'source',     CASE WHEN v_override_enabled IS NOT NULL THEN 'override' ELSE 'default' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_feature_gate(text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION check_feature_gate(text, uuid) FROM anon;

-- =====================================================
-- C. Suppression Event Metadata Validator
-- =====================================================

CREATE OR REPLACE FUNCTION validate_suppression_event_metadata(p_metadata jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_required text[] := ARRAY[
    'feature_id', 'attempted_action', 'reason_code', 'next_step_hint',
    'scope_type', 'scope_id', 'screen_surface_id', 'idempotency_key', 'trace_id'
  ];
  v_field text;
  v_missing text[] := '{}';
BEGIN
  FOREACH v_field IN ARRAY v_required LOOP
    IF (p_metadata->>v_field) IS NULL OR (p_metadata->>v_field) = '' THEN
      v_missing := array_append(v_missing, v_field);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'validation_error', 'Missing required suppression metadata fields',
      'missing_fields', v_missing
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION validate_suppression_event_metadata(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION validate_suppression_event_metadata(jsonb) FROM anon;

-- =====================================================
-- D. Founder-Readable Mode Display Names
-- =====================================================

CREATE OR REPLACE FUNCTION get_mode_display_name(p_mode text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN CASE p_mode
    WHEN 'NORMAL'     THEN 'Full operations'
    WHEN 'ELEVATED'   THEN 'Elevated caution (non-critical changes restricted)'
    WHEN 'PROTECTIVE' THEN 'Safety mode (restrict changes, critical ops only)'
    WHEN 'RECOVERY'   THEN 'Recovery mode (read-only except recovery ops)'
    ELSE 'Unknown mode: ' || COALESCE(p_mode, 'null')
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION get_mode_display_name(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_mode_display_name(text) FROM anon;

-- =====================================================
-- E. Suppression / Pre-Wire Event Types
-- =====================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id) VALUES
  ('feature_action_suppressed',   1, 'governance'),
  ('stub_rpc_invoked',            1, 'governance'),
  ('mode_display_queried',        1, 'governance')
ON CONFLICT (event_type) DO NOTHING;
