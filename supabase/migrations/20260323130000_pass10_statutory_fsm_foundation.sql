/*
  Pass 10 foundation:
  - Deterministic statutory rights evaluator (v1)
  - Disruption resolution FSM state + guarded transition RPC
*/

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS disruption_resolution_state text;

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_disruption_resolution_state_check;
ALTER TABLE incidents
  ADD CONSTRAINT incidents_disruption_resolution_state_check
  CHECK (
    disruption_resolution_state IS NULL OR disruption_resolution_state IN (
      'DISRUPTION_SUSPECTED',
      'DISRUPTION_CONFIRMED',
      'CARRIER_ENGAGEMENT_ACTIVE',
      'OFFER_RECEIVED',
      'OFFER_EVALUATED',
      'OFFER_ACCEPTED',
      'OWN_RESOLUTION_ACTIVE',
      'DOCUMENTATION_ACTIVE',
      'EVIDENCE_COMPLETE',
      'CLAIM_ACTIVE',
      'ROUTING_DETERMINED',
      'RIGHTS_WINDOW_ACTIVE',
      'RESOLUTION_COMPLETE'
    )
  );

CREATE TABLE IF NOT EXISTS statutory_rights_evaluations (
  evaluation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_code text NOT NULL CHECK (framework_code IN ('EU261', 'US_DOT', 'MONTREAL_CONVENTION', 'UK_RETAINED')),
  input_hash text NOT NULL,
  evaluator_version text NOT NULL DEFAULT 'v1',
  determination_status text NOT NULL DEFAULT 'COMPLETE'
    CHECK (determination_status IN ('COMPLETE', 'INSUFFICIENT_DATA', 'CONFLICT_PRESENT', 'FAILED')),
  reasoning_trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, framework_code, input_hash, evaluator_version)
);

CREATE INDEX IF NOT EXISTS idx_sre_incident_created
  ON statutory_rights_evaluations (incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS statutory_right_outcomes (
  outcome_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES statutory_rights_evaluations(evaluation_id) ON DELETE CASCADE,
  right_code text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ELIGIBLE', 'INELIGIBLE', 'CONDITIONAL', 'UNKNOWN')),
  confidence_tier text NOT NULL
    CHECK (confidence_tier IN ('HIGH', 'USER_CONFIRMED', 'CONDITIONAL', 'AMBIGUOUS', 'DOCUMENTATION_INCOMPLETE', 'CONFLICT_PRESENT', 'INSUFFICIENT_DATA')),
  amount_currency char(3),
  amount_value numeric(12,2),
  filing_deadline_at timestamptz,
  evidence_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  basis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, right_code)
);

CREATE INDEX IF NOT EXISTS idx_sro_eval_right
  ON statutory_right_outcomes (evaluation_id, right_code);

ALTER TABLE statutory_rights_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_right_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sre_select_own ON statutory_rights_evaluations;
CREATE POLICY sre_select_own
  ON statutory_rights_evaluations FOR SELECT TO authenticated
  USING (account_id = auth.uid());

DROP POLICY IF EXISTS sro_select_own ON statutory_right_outcomes;
CREATE POLICY sro_select_own
  ON statutory_right_outcomes FOR SELECT TO authenticated
  USING (
    evaluation_id IN (
      SELECT evaluation_id
      FROM statutory_rights_evaluations
      WHERE account_id = auth.uid()
    )
  );

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('statutory_rights_evaluated', 1, 'F-6.5.2', 'info'),
  ('statutory_rights_evaluation_failed', 1, 'F-6.5.2', 'warning')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION evaluate_statutory_rights(
  p_incident_id uuid,
  p_actor_id uuid,
  p_framework_code text DEFAULT 'EU261',
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_incident incidents%ROWTYPE;
  v_input jsonb;
  v_input_hash text;
  v_eval statutory_rights_evaluations%ROWTYPE;
  v_emit jsonb;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR p_actor_id IS NULL OR p_actor_id <> v_auth_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT i.*
  INTO v_incident
  FROM incidents i
  JOIN trips t ON t.trip_id = i.trip_id
  WHERE i.id = p_incident_id
    AND t.created_by = v_auth_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;

  v_input := jsonb_build_object(
    'incident_id', v_incident.id,
    'trip_id', v_incident.trip_id,
    'canonical_status', v_incident.canonical_status,
    'disruption_type', COALESCE(v_incident.disruption_type, ''),
    'framework_code', p_framework_code
  );
  v_input_hash := encode(digest(v_input::text, 'sha256'), 'hex');

  SELECT *
  INTO v_eval
  FROM statutory_rights_evaluations
  WHERE incident_id = p_incident_id
    AND framework_code = p_framework_code
    AND input_hash = v_input_hash
    AND evaluator_version = 'v1'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'evaluation_id', v_eval.evaluation_id,
      'framework_code', p_framework_code,
      'input_hash', v_input_hash
    );
  END IF;

  INSERT INTO statutory_rights_evaluations (
    incident_id,
    trip_id,
    account_id,
    framework_code,
    input_hash,
    evaluator_version,
    determination_status,
    reasoning_trace
  ) VALUES (
    p_incident_id,
    v_incident.trip_id,
    v_auth_uid,
    p_framework_code,
    v_input_hash,
    'v1',
    'COMPLETE',
    jsonb_build_object('source', 'deterministic_v1')
  )
  RETURNING * INTO v_eval;

  INSERT INTO statutory_right_outcomes (
    evaluation_id,
    right_code,
    outcome,
    confidence_tier,
    amount_currency,
    amount_value,
    filing_deadline_at,
    evidence_requirements,
    basis
  ) VALUES
    (
      v_eval.evaluation_id,
      p_framework_code || '_RIGHTS_WINDOW',
      'CONDITIONAL',
      'CONDITIONAL',
      'EUR',
      NULL,
      now() + interval '30 days',
      jsonb_build_array('carrier_notice', 'itinerary_record', 'delay_or_disruption_proof'),
      jsonb_build_object('framework_code', p_framework_code, 'input_hash', v_input_hash)
    );

  v_emit := emit_event(
    p_event_type := 'statutory_rights_evaluated',
    p_feature_id := 'F-6.5.2',
    p_scope_type := 'incident',
    p_scope_id := p_incident_id,
    p_actor_id := v_auth_uid,
    p_actor_type := 'user',
    p_reason_code := 'statutory_evaluation_complete',
    p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object(
      'evaluation_id', v_eval.evaluation_id,
      'framework_code', p_framework_code,
      'input_hash', v_input_hash
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'evaluation_id', v_eval.evaluation_id,
    'framework_code', p_framework_code,
    'input_hash', v_input_hash,
    'event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION change_disruption_resolution_state(
  p_incident_id uuid,
  p_new_state text,
  p_actor_id uuid,
  p_reason_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_old_state text;
  v_new_state text;
  v_event_type text;
  v_emit jsonb;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR p_actor_id IS NULL OR p_actor_id <> v_auth_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT i.disruption_resolution_state
  INTO v_old_state
  FROM incidents i
  JOIN trips t ON t.trip_id = i.trip_id
  WHERE i.id = p_incident_id
    AND t.created_by = v_auth_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;

  v_new_state := upper(trim(p_new_state));
  IF v_new_state NOT IN (
    'DISRUPTION_SUSPECTED',
    'DISRUPTION_CONFIRMED',
    'CARRIER_ENGAGEMENT_ACTIVE',
    'OFFER_RECEIVED',
    'OFFER_EVALUATED',
    'OFFER_ACCEPTED',
    'OWN_RESOLUTION_ACTIVE',
    'DOCUMENTATION_ACTIVE',
    'EVIDENCE_COMPLETE',
    'CLAIM_ACTIVE',
    'ROUTING_DETERMINED',
    'RIGHTS_WINDOW_ACTIVE',
    'RESOLUTION_COMPLETE'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_state');
  END IF;

  IF v_old_state = v_new_state THEN
    RETURN jsonb_build_object('success', true, 'incident_id', p_incident_id, 'state', v_new_state, 'no_op', true);
  END IF;

  UPDATE incidents
  SET disruption_resolution_state = v_new_state,
      updated_at = now()
  WHERE id = p_incident_id;

  v_event_type := CASE v_new_state
    WHEN 'DISRUPTION_SUSPECTED' THEN 'disruption_suspected'
    WHEN 'DISRUPTION_CONFIRMED' THEN 'disruption_confirmed'
    WHEN 'OFFER_RECEIVED' THEN 'offer_received'
    WHEN 'OFFER_EVALUATED' THEN 'offer_evaluated'
    WHEN 'OFFER_ACCEPTED' THEN 'offer_accepted'
    WHEN 'OWN_RESOLUTION_ACTIVE' THEN 'own_resolution_active'
    WHEN 'EVIDENCE_COMPLETE' THEN 'evidence_complete'
    WHEN 'ROUTING_DETERMINED' THEN 'routing_determined'
    WHEN 'RIGHTS_WINDOW_ACTIVE' THEN 'rights_window_active'
    WHEN 'RESOLUTION_COMPLETE' THEN 'resolution_complete'
    ELSE NULL
  END;

  IF v_event_type IS NOT NULL THEN
    v_emit := emit_event(
      p_event_type := v_event_type,
      p_feature_id := 'F-6.5.5',
      p_scope_type := 'incident',
      p_scope_id := p_incident_id,
      p_actor_id := v_auth_uid,
      p_actor_type := 'user',
      p_reason_code := COALESCE(p_reason_code, 'disruption_state_transition'),
      p_previous_state := jsonb_build_object('disruption_resolution_state', v_old_state),
      p_resulting_state := jsonb_build_object('disruption_resolution_state', v_new_state),
      p_metadata := jsonb_build_object('old_state', v_old_state, 'new_state', v_new_state)
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'incident_id', p_incident_id,
    'old_state', v_old_state,
    'new_state', v_new_state,
    'event_id', COALESCE(v_emit->>'event_id', NULL),
    'no_op', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION evaluate_statutory_rights(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION change_disruption_resolution_state(uuid, text, uuid, text) TO authenticated;
