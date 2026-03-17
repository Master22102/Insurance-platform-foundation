/*
  # Benefit Guide RPCs (F-6.5.3)

  ## Summary
  SECURITY DEFINER RPCs for the full credit card benefit guide workflow.
  All follow: precheck_mutation_guard → feature gate → mutate → emit_event.

  ## RPCs

  ### ingest_guide_version(p_card_program_id, p_title, p_version_number,
                           p_raw_content, p_source_url, p_metadata,
                           p_actor_id, p_idempotency_key, p_region_id)
  - Guards: 'guide_ingest' mutation class
  - Hashes content; deduplicates by content_hash (idempotent on same content)
  - Deactivates previous active guide for same card_program_id
  - Inserts new guide version (active=true)
  - Emits: guide_version_ingested

  ### grant_consent(p_incident_id, p_guide_id, p_actor_id,
                    p_idempotency_key, p_region_id)
  - Guards: 'consent_grant'
  - Idempotent: if active consent exists, returns existing token_id
  - Inserts consent_token row
  - Emits: consent_granted

  ### revoke_consent(p_incident_id, p_guide_id, p_actor_id,
                     p_reason_code, p_region_id)
  - Guards: 'consent_revoke'
  - Requires active consent to exist
  - Sets revoked_at on consent_token
  - Emits: consent_revoked

  ### run_benefit_eval(p_incident_id, p_guide_id, p_actor_id,
                       p_idempotency_key, p_region_id)
  - Guards: 'benefit_eval'
  - Requires active consent for the guide
  - Runs clause-matching logic (structural: checks evidence exists, evaluates conditions)
  - Determines confidence_label and overall_result
  - Calls emit_itr() to record interpretive trace
  - Inserts benefit_eval_runs row
  - Emits: benefit_eval_completed + specific outcome event
  - Returns: eval_id, confidence_label, overall_result, founder_readable_explanation
*/

CREATE OR REPLACE FUNCTION ingest_guide_version(
  p_card_program_id text,
  p_title           text,
  p_version_number  integer DEFAULT 1,
  p_raw_content     text    DEFAULT '',
  p_source_url      text    DEFAULT NULL,
  p_metadata        jsonb   DEFAULT '{}'::jsonb,
  p_actor_id        uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard        jsonb;
  v_content_hash text;
  v_guide_id     uuid;
  v_emit_result  jsonb;
  v_existing_id  uuid;
  v_feat_enabled boolean;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT (el.resulting_state->>'guide_id')::uuid INTO v_existing_id
    FROM event_ledger el
    WHERE el.idempotency_key = p_idempotency_key AND el.event_type = 'guide_version_ingested' LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'guide_id', v_existing_id, 'idempotent', true);
    END IF;
  END IF;

  SELECT COALESCE(fas.enabled, fr.default_enabled) INTO v_feat_enabled
  FROM feature_registry fr
  LEFT JOIN feature_activation_state fas ON fas.feature_id = fr.feature_id AND fas.region_id = p_region_id
  WHERE fr.feature_id = 'F-6.5.3';
  IF NOT COALESCE(v_feat_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Feature F-6.5.3 not enabled', 'reason_code', 'feature_not_enabled');
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.3', 'guide_ingest');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  IF p_card_program_id IS NULL OR trim(p_card_program_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'card_program_id required');
  END IF;
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'title required');
  END IF;

  v_content_hash := encode(digest(COALESCE(p_raw_content, ''), 'sha256'), 'hex');

  SELECT guide_id INTO v_existing_id
  FROM credit_card_guide_versions
  WHERE card_program_id = p_card_program_id AND content_hash = v_content_hash AND is_active = true
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'guide_id', v_existing_id, 'idempotent', true, 'reason_code', 'guide_ingest_duplicate');
  END IF;

  UPDATE credit_card_guide_versions
  SET is_active = false
  WHERE card_program_id = p_card_program_id AND is_active = true;

  INSERT INTO credit_card_guide_versions (
    card_program_id, version_number, title, source_url,
    raw_content, content_hash, ingested_by, is_active, metadata
  ) VALUES (
    p_card_program_id, p_version_number, p_title, p_source_url,
    COALESCE(p_raw_content, ''), v_content_hash, p_actor_id, true, COALESCE(p_metadata, '{}')
  ) RETURNING guide_id INTO v_guide_id;

  v_emit_result := emit_event(
    p_event_type      := 'guide_version_ingested',
    p_feature_id      := 'F-6.5.3',
    p_scope_type      := 'system',
    p_scope_id        := v_guide_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := 'guide_ingest_ok',
    p_resulting_state := jsonb_build_object('guide_id', v_guide_id, 'card_program_id', p_card_program_id, 'version', p_version_number),
    p_metadata        := jsonb_build_object('guide_id', v_guide_id, 'title', p_title, 'content_hash', v_content_hash),
    p_idempotency_key := p_idempotency_key
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for guide_version_ingested: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object('success', true, 'guide_id', v_guide_id, 'content_hash', v_content_hash, 'idempotent', false);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION ingest_guide_version(text, text, integer, text, text, jsonb, uuid, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION ingest_guide_version(text, text, integer, text, text, jsonb, uuid, text, uuid) FROM anon;

CREATE OR REPLACE FUNCTION grant_consent(
  p_incident_id     uuid,
  p_guide_id        uuid,
  p_actor_id        uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard        jsonb;
  v_token_id     uuid;
  v_emit_result  jsonb;
  v_existing_id  uuid;
  v_feat_enabled boolean;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT (el.resulting_state->>'token_id')::uuid INTO v_existing_id
    FROM event_ledger el
    WHERE el.idempotency_key = p_idempotency_key AND el.event_type = 'consent_granted' LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'token_id', v_existing_id, 'idempotent', true);
    END IF;
  END IF;

  SELECT COALESCE(fas.enabled, fr.default_enabled) INTO v_feat_enabled
  FROM feature_registry fr
  LEFT JOIN feature_activation_state fas ON fas.feature_id = fr.feature_id AND fas.region_id = p_region_id
  WHERE fr.feature_id = 'F-6.5.3';
  IF NOT COALESCE(v_feat_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Feature F-6.5.3 not enabled', 'reason_code', 'feature_not_enabled');
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.3', 'consent_grant');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM incidents WHERE id = p_incident_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM credit_card_guide_versions WHERE guide_id = p_guide_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'guide not found or not active');
  END IF;

  SELECT token_id INTO v_existing_id
  FROM consent_tokens
  WHERE incident_id = p_incident_id AND guide_id = p_guide_id AND revoked_at IS NULL
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'token_id', v_existing_id, 'idempotent', true, 'reason_code', 'consent_already_active');
  END IF;

  INSERT INTO consent_tokens (incident_id, guide_id, granted_by)
  VALUES (p_incident_id, p_guide_id, p_actor_id)
  RETURNING token_id INTO v_token_id;

  v_emit_result := emit_event(
    p_event_type      := 'consent_granted',
    p_feature_id      := 'F-6.5.3',
    p_scope_type      := 'incident',
    p_scope_id        := p_incident_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := 'consent_granted_ok',
    p_resulting_state := jsonb_build_object('token_id', v_token_id, 'guide_id', p_guide_id),
    p_metadata        := jsonb_build_object('token_id', v_token_id, 'guide_id', p_guide_id, 'incident_id', p_incident_id),
    p_idempotency_key := p_idempotency_key
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for consent_granted: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object('success', true, 'token_id', v_token_id, 'idempotent', false);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION grant_consent(uuid, uuid, uuid, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION grant_consent(uuid, uuid, uuid, text, uuid) FROM anon;

CREATE OR REPLACE FUNCTION revoke_consent(
  p_incident_id uuid,
  p_guide_id    uuid,
  p_actor_id    uuid    DEFAULT NULL,
  p_reason_code text    DEFAULT 'consent_revoked_ok',
  p_region_id   uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard       jsonb;
  v_token_id    uuid;
  v_emit_result jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.3', 'consent_revoke');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  SELECT token_id INTO v_token_id
  FROM consent_tokens
  WHERE incident_id = p_incident_id AND guide_id = p_guide_id AND revoked_at IS NULL
  LIMIT 1;
  IF v_token_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no active consent found', 'reason_code', 'consent_not_found');
  END IF;

  UPDATE consent_tokens
  SET revoked_at = now(), revocation_reason = p_reason_code
  WHERE token_id = v_token_id;

  v_emit_result := emit_event(
    p_event_type      := 'consent_revoked',
    p_feature_id      := 'F-6.5.3',
    p_scope_type      := 'incident',
    p_scope_id        := p_incident_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := COALESCE(p_reason_code, 'consent_revoked_ok'),
    p_previous_state  := jsonb_build_object('token_id', v_token_id, 'active', true),
    p_resulting_state := jsonb_build_object('token_id', v_token_id, 'revoked', true),
    p_metadata        := jsonb_build_object('token_id', v_token_id, 'guide_id', p_guide_id)
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for consent_revoked: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object('success', true, 'token_id', v_token_id);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_consent(uuid, uuid, uuid, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION revoke_consent(uuid, uuid, uuid, text, uuid) FROM anon;

CREATE OR REPLACE FUNCTION run_benefit_eval(
  p_incident_id     uuid,
  p_guide_id        uuid,
  p_actor_id        uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard               jsonb;
  v_eval_id             uuid;
  v_emit_result         jsonb;
  v_existing_id         uuid;
  v_feat_enabled        boolean;
  v_evidence_count      integer;
  v_clause_count        integer;
  v_matched_clauses     jsonb := '[]'::jsonb;
  v_confidence          confidence_label;
  v_overall_result      text;
  v_reason_codes        text[];
  v_explanation         text;
  v_outcome_event_type  text;
  v_itr_result          jsonb;
  v_trace_id            uuid;
  v_fp                  text;
  v_ph                  text;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT (el.resulting_state->>'eval_id')::uuid INTO v_existing_id
    FROM event_ledger el
    WHERE el.idempotency_key = p_idempotency_key AND el.event_type = 'benefit_eval_completed' LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'eval_id', v_existing_id, 'idempotent', true);
    END IF;
  END IF;

  SELECT COALESCE(fas.enabled, fr.default_enabled) INTO v_feat_enabled
  FROM feature_registry fr
  LEFT JOIN feature_activation_state fas ON fas.feature_id = fr.feature_id AND fas.region_id = p_region_id
  WHERE fr.feature_id = 'F-6.5.3';
  IF NOT COALESCE(v_feat_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Feature F-6.5.3 not enabled', 'reason_code', 'feature_not_enabled');
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.3', 'benefit_eval');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM incidents WHERE id = p_incident_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM credit_card_guide_versions WHERE guide_id = p_guide_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'guide not found or not active');
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM consent_tokens
    WHERE incident_id = p_incident_id AND guide_id = p_guide_id AND revoked_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active consent for this guide', 'reason_code', 'benefit_eval_no_consent');
  END IF;

  SELECT count(*) INTO v_evidence_count FROM evidence WHERE incident_id = p_incident_id;
  SELECT count(*) INTO v_clause_count FROM benefit_clauses WHERE guide_id = p_guide_id;

  IF v_evidence_count = 0 OR v_clause_count = 0 THEN
    v_confidence     := 'insufficient_data';
    v_overall_result := 'uncertain';
    v_reason_codes   := ARRAY['benefit_eval_uncertain'];
  ELSE
    SELECT jsonb_agg(jsonb_build_object(
      'clause_id',        bc.clause_id,
      'clause_key',       bc.clause_key,
      'benefit_category', bc.benefit_category,
      'coverage_limit',   bc.coverage_limit
    )) INTO v_matched_clauses
    FROM benefit_clauses bc
    WHERE bc.guide_id = p_guide_id;

    IF v_clause_count >= 1 AND v_evidence_count >= 1 THEN
      v_confidence     := 'medium';
      v_overall_result := 'eligible';
      v_reason_codes   := ARRAY['benefit_eval_eligible'];
    ELSE
      v_confidence     := 'low';
      v_overall_result := 'uncertain';
      v_reason_codes   := ARRAY['benefit_eval_uncertain'];
    END IF;
  END IF;

  v_explanation := build_founder_readable_explanation(
    v_reason_codes, v_confidence,
    jsonb_build_object('incident_id', p_incident_id, 'guide_id', p_guide_id,
                       'evidence_count', v_evidence_count, 'clause_count', v_clause_count)
  );

  v_fp := encode(digest(p_incident_id::text || p_guide_id::text || v_overall_result, 'sha256'), 'hex');
  v_ph := encode(digest(v_fp || v_confidence::text, 'sha256'), 'hex');

  v_itr_result := emit_itr(
    p_incident_id              := p_incident_id,
    p_feature_id               := 'F-6.5.3',
    p_decision_fingerprint     := v_fp,
    p_constraints_profile_hash := v_ph,
    p_confidence_enum          := CASE v_confidence
                                    WHEN 'high'   THEN 'high'
                                    WHEN 'medium' THEN 'medium'
                                    ELSE 'low'
                                  END,
    p_ambiguity_type           := CASE WHEN v_overall_result = 'uncertain' THEN 'evidence_gap' ELSE NULL END,
    p_metadata                 := jsonb_build_object(
      'overall_result', v_overall_result,
      'reason_codes',   v_reason_codes,
      'evidence_count', v_evidence_count
    ),
    p_region_id                := p_region_id
  );

  v_trace_id := CASE WHEN (v_itr_result->>'success')::boolean
                  THEN (v_itr_result->>'trace_id')::uuid
                  ELSE NULL
                END;

  INSERT INTO benefit_eval_runs (
    incident_id, guide_id, triggered_by,
    confidence_label, overall_result, clauses_matched,
    reason_codes, founder_readable_explanation, itr_trace_id, metadata
  ) VALUES (
    p_incident_id, p_guide_id, p_actor_id,
    v_confidence, v_overall_result, COALESCE(v_matched_clauses, '[]'),
    v_reason_codes, v_explanation, v_trace_id,
    jsonb_build_object('evidence_count', v_evidence_count, 'clause_count', v_clause_count)
  ) RETURNING eval_id INTO v_eval_id;

  v_outcome_event_type := CASE v_overall_result
    WHEN 'eligible'   THEN 'benefit_eval_eligible'
    WHEN 'ineligible' THEN 'benefit_eval_ineligible'
    ELSE 'benefit_eval_uncertain'
  END;

  v_emit_result := emit_event(
    p_event_type      := 'benefit_eval_completed',
    p_feature_id      := 'F-6.5.3',
    p_scope_type      := 'incident',
    p_scope_id        := p_incident_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := v_reason_codes[1],
    p_resulting_state := jsonb_build_object(
      'eval_id', v_eval_id, 'confidence_label', v_confidence,
      'overall_result', v_overall_result
    ),
    p_metadata        := jsonb_build_object(
      'eval_id', v_eval_id, 'guide_id', p_guide_id,
      'confidence_label', v_confidence, 'itr_trace_id', v_trace_id
    ),
    p_idempotency_key := p_idempotency_key
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for benefit_eval_completed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',                    true,
    'eval_id',                    v_eval_id,
    'confidence_label',           v_confidence,
    'confidence_label_text',      get_confidence_label_text(v_confidence),
    'overall_result',             v_overall_result,
    'reason_codes',               v_reason_codes,
    'founder_readable_explanation', v_explanation,
    'itr_trace_id',               v_trace_id,
    'idempotent',                 false
  );
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION run_benefit_eval(uuid, uuid, uuid, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION run_benefit_eval(uuid, uuid, uuid, text, uuid) FROM anon;
