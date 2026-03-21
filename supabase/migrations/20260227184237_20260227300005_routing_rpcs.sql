/*
  # Routing RPCs (F-6.5.5)

  ## Summary
  SECURITY DEFINER RPCs for claim routing workflow.

  ## RPCs

  ### generate_routing_recommendation(p_incident_id, p_guide_id, p_actor_id,
                                       p_idempotency_key, p_region_id)
  - Guards: 'routing_generate'
  - Feature gate: F-6.5.5
  - Checks for active consent (if guide_id supplied)
  - Builds recommended_sequence from evidence + guide context
  - Determines confidence_label and reason_codes
  - Calls emit_itr() for interpretive trace
  - Inserts routing_recommendations row
  - Emits: routing_recommendation_generated

  ### record_acceptance_checkpoint(p_rec_id, p_incident_id, p_actor_id,
                                    p_action, p_reason_code, p_traveler_notes,
                                    p_region_id)
  - Guards: 'acceptance_checkpoint'
  - Validates rec_id + incident_id match
  - Inserts acceptance_checkpoints row
  - Updates routing_recommendations.accepted if action=accepted|rejected
  - Emits: acceptance_checkpoint_recorded + routing_recommendation_accepted/rejected
*/

CREATE OR REPLACE FUNCTION generate_routing_recommendation(
  p_incident_id     uuid,
  p_guide_id        uuid    DEFAULT NULL,
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
  v_rec_id              uuid;
  v_emit_result         jsonb;
  v_existing_id         uuid;
  v_feat_enabled        boolean;
  v_evidence_count      integer;
  v_confidence          confidence_label;
  v_reason_codes        text[];
  v_explanation         text;
  v_sequence            jsonb;
  v_itr_result          jsonb;
  v_trace_id            uuid;
  v_fp                  text;
  v_ph                  text;
  v_guide_title         text;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT (el.resulting_state->>'rec_id')::uuid INTO v_existing_id
    FROM event_ledger el
    WHERE el.idempotency_key = p_idempotency_key AND el.event_type = 'routing_recommendation_generated' LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'rec_id', v_existing_id, 'idempotent', true);
    END IF;
  END IF;

  SELECT COALESCE(fas.enabled, fr.default_enabled) INTO v_feat_enabled
  FROM feature_registry fr
  LEFT JOIN feature_activation_state fas ON fas.feature_id = fr.feature_id AND fas.region_id = p_region_id
  WHERE fr.feature_id = 'F-6.5.5';
  IF NOT COALESCE(v_feat_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Feature F-6.5.5 not enabled', 'reason_code', 'feature_not_enabled');
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.5', 'routing_generate');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM incidents WHERE id = p_incident_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;

  IF p_guide_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM consent_tokens
      WHERE incident_id = p_incident_id AND guide_id = p_guide_id AND revoked_at IS NULL
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'No active consent for guide', 'reason_code', 'benefit_eval_no_consent');
    END IF;
    SELECT title INTO v_guide_title FROM credit_card_guide_versions WHERE guide_id = p_guide_id;
  END IF;

  SELECT count(*) INTO v_evidence_count FROM evidence WHERE incident_id = p_incident_id;

  IF v_evidence_count = 0 THEN
    v_confidence   := 'low';
    v_reason_codes := ARRAY['routing_generated_ok'];
    v_sequence     := jsonb_build_array(
      jsonb_build_object('step', 1, 'action', 'gather_evidence', 'description', 'Collect supporting documentation before routing'),
      jsonb_build_object('step', 2, 'action', 'initial_assessment', 'description', 'Submit claim for initial assessment once evidence is ready')
    );
  ELSE
    v_confidence   := 'medium';
    v_reason_codes := ARRAY['routing_generated_ok'];
    v_sequence     := jsonb_build_array(
      jsonb_build_object('step', 1, 'action', 'submit_to_card_issuer', 'description', 'Submit claim directly to card issuer with attached evidence'),
      jsonb_build_object('step', 2, 'action', 'await_issuer_response', 'description', 'Wait for issuer acknowledgment (typically 3-5 business days)'),
      jsonb_build_object('step', 3, 'action', 'escalate_if_denied', 'description', 'If denied, escalate via benefit dispute process')
    );
    IF p_guide_id IS NOT NULL THEN
      v_sequence := v_sequence || jsonb_build_array(
        jsonb_build_object('step', 4, 'action', 'reference_benefit_guide', 'description', 'Reference clause from guide: ' || COALESCE(v_guide_title, '?'))
      );
    END IF;
  END IF;

  v_explanation := build_founder_readable_explanation(
    v_reason_codes, v_confidence,
    jsonb_build_object('incident_id', p_incident_id, 'guide_id', p_guide_id, 'evidence_count', v_evidence_count)
  );

  v_fp := encode(digest(p_incident_id::text || COALESCE(p_guide_id::text,'') || v_confidence::text, 'sha256'), 'hex');
  v_ph := encode(digest(v_fp || array_to_string(v_reason_codes, ','), 'sha256'), 'hex');

  v_itr_result := emit_itr(
    p_incident_id              := p_incident_id,
    p_feature_id               := 'F-6.5.5',
    p_decision_fingerprint     := v_fp,
    p_constraints_profile_hash := v_ph,
    p_confidence_enum          := CASE v_confidence WHEN 'high' THEN 'high' WHEN 'medium' THEN 'medium' ELSE 'low' END,
    p_metadata                 := jsonb_build_object('reason_codes', v_reason_codes, 'evidence_count', v_evidence_count),
    p_region_id                := p_region_id
  );
  v_trace_id := CASE WHEN (v_itr_result->>'success')::boolean THEN (v_itr_result->>'trace_id')::uuid ELSE NULL END;

  INSERT INTO routing_recommendations (
    incident_id, guide_id, triggered_by, recommended_sequence,
    confidence_label, reason_codes, founder_readable_explanation, itr_trace_id, metadata
  ) VALUES (
    p_incident_id, p_guide_id, p_actor_id, v_sequence,
    v_confidence, v_reason_codes, v_explanation, v_trace_id,
    jsonb_build_object('evidence_count', v_evidence_count)
  ) RETURNING rec_id INTO v_rec_id;

  v_emit_result := emit_event(
    p_event_type      := 'routing_recommendation_generated',
    p_feature_id      := 'F-6.5.5',
    p_scope_type      := 'incident',
    p_scope_id        := p_incident_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := 'routing_generated_ok',
    p_resulting_state := jsonb_build_object('rec_id', v_rec_id, 'confidence_label', v_confidence, 'step_count', jsonb_array_length(v_sequence)),
    p_metadata        := jsonb_build_object('rec_id', v_rec_id, 'guide_id', p_guide_id, 'itr_trace_id', v_trace_id),
    p_idempotency_key := p_idempotency_key
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for routing_recommendation_generated: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',                    true,
    'rec_id',                     v_rec_id,
    'confidence_label',           v_confidence,
    'confidence_label_text',      get_confidence_label_text(v_confidence),
    'recommended_sequence',       v_sequence,
    'reason_codes',               v_reason_codes,
    'founder_readable_explanation', v_explanation,
    'itr_trace_id',               v_trace_id,
    'idempotent',                 false
  );
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_routing_recommendation(uuid, uuid, uuid, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION generate_routing_recommendation(uuid, uuid, uuid, text, uuid) FROM anon;

CREATE OR REPLACE FUNCTION record_acceptance_checkpoint(
  p_rec_id        uuid,
  p_incident_id   uuid,
  p_actor_id      uuid    DEFAULT NULL,
  p_action        text    DEFAULT 'accepted',
  p_reason_code   text    DEFAULT NULL,
  p_traveler_notes text   DEFAULT NULL,
  p_region_id     uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard          jsonb;
  v_checkpoint_id  uuid;
  v_emit_result    jsonb;
  v_outcome_event  text;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.5', 'acceptance_checkpoint');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  IF p_action NOT IN ('accepted','rejected','deferred') THEN
    RETURN jsonb_build_object('success', false, 'error', 'action must be accepted, rejected, or deferred');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM routing_recommendations WHERE rec_id = p_rec_id AND incident_id = p_incident_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'routing recommendation not found for this incident');
  END IF;

  INSERT INTO acceptance_checkpoints (rec_id, incident_id, actor_id, action, reason_code, traveler_notes)
  VALUES (p_rec_id, p_incident_id, p_actor_id, p_action, p_reason_code, p_traveler_notes)
  RETURNING checkpoint_id INTO v_checkpoint_id;

  IF p_action IN ('accepted', 'rejected') THEN
    UPDATE routing_recommendations
    SET accepted    = (p_action = 'accepted'),
        accepted_at = now(),
        accepted_by = p_actor_id,
        rejection_reason = CASE WHEN p_action = 'rejected' THEN COALESCE(p_traveler_notes, p_reason_code) ELSE NULL END
    WHERE rec_id = p_rec_id;
  END IF;

  v_emit_result := emit_event(
    p_event_type      := 'acceptance_checkpoint_recorded',
    p_feature_id      := 'F-6.5.5',
    p_scope_type      := 'incident',
    p_scope_id        := p_incident_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := COALESCE(p_reason_code, 'checkpoint_recorded_ok'),
    p_resulting_state := jsonb_build_object('checkpoint_id', v_checkpoint_id, 'action', p_action, 'rec_id', p_rec_id),
    p_metadata        := jsonb_build_object('checkpoint_id', v_checkpoint_id, 'rec_id', p_rec_id, 'action', p_action)
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for acceptance_checkpoint_recorded: %', v_emit_result->>'error';
  END IF;

  IF p_action = 'accepted' THEN
    v_outcome_event := 'routing_recommendation_accepted';
  ELSIF p_action = 'rejected' THEN
    v_outcome_event := 'routing_recommendation_rejected';
  END IF;

  IF v_outcome_event IS NOT NULL THEN
    v_emit_result := emit_event(
      p_event_type      := v_outcome_event,
      p_feature_id      := 'F-6.5.5',
      p_scope_type      := 'incident',
      p_scope_id        := p_incident_id,
      p_actor_id        := p_actor_id,
      p_actor_type      := 'user',
      p_reason_code     := CASE p_action WHEN 'accepted' THEN 'routing_accepted_ok' ELSE 'routing_rejected_ok' END,
      p_metadata        := jsonb_build_object('rec_id', p_rec_id, 'checkpoint_id', v_checkpoint_id)
    );
    IF NOT (v_emit_result->>'success')::boolean THEN
      RAISE EXCEPTION 'emit_event failed for %: %', v_outcome_event, v_emit_result->>'error';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',       true,
    'checkpoint_id', v_checkpoint_id,
    'action',        p_action,
    'rec_id',        p_rec_id
  );
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION record_acceptance_checkpoint(uuid, uuid, uuid, text, text, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION record_acceptance_checkpoint(uuid, uuid, uuid, text, text, text, uuid) FROM anon;
