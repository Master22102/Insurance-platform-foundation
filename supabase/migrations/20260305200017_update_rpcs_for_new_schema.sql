/*
  # Update RPCs for New Schema
  
  1. New RPCs
    - advance_trip_maturity: governs trip state machine
    - initiate_policy_upload: replaces invoke_policy_parse stub with real implementation
  
  2. Updates
    - Existing RPCs now reference trip_id instead of project_id
*/

-- advance_trip_maturity: governs trip state machine
CREATE OR REPLACE FUNCTION advance_trip_maturity(
  p_trip_id     uuid,
  p_actor_id    uuid,
  p_new_state   trip_maturity_state,
  p_reason_code text DEFAULT 'user_initiated'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_guard       jsonb;
  v_trip        trips%ROWTYPE;
  v_emit_result jsonb;
BEGIN
  v_guard := precheck_mutation_guard(
    '00000000-0000-0000-0000-000000000000'::uuid, 'trips', 'trip_advance_maturity'
  );
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('ok',false,'reason','MUTATION_BLOCKED','mode',v_guard->>'mode');
  END IF;

  SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'reason','TRIP_NOT_FOUND');
  END IF;

  v_emit_result := emit_event(
    p_event_type     := 'trip_maturity_advanced',
    p_feature_id     := 'trips',
    p_scope_type     := 'trip',
    p_scope_id       := p_trip_id,
    p_actor_id       := p_actor_id,
    p_actor_type     := 'traveler',
    p_reason_code    := p_reason_code,
    p_previous_state := jsonb_build_object('maturity_state', v_trip.maturity_state),
    p_resulting_state:= jsonb_build_object('maturity_state', p_new_state)
  );
  IF NOT (v_emit_result->>'success')::boolean THEN
    RETURN jsonb_build_object('ok',false,'reason','LEDGER_WRITE_FAILED');
  END IF;

  UPDATE trips SET maturity_state = p_new_state WHERE trip_id = p_trip_id;
  RETURN jsonb_build_object('ok',true,'new_state',p_new_state,'event_id',v_emit_result->>'event_id');
END; $$;

GRANT EXECUTE ON FUNCTION advance_trip_maturity(uuid,uuid,trip_maturity_state,text) TO authenticated;

-- initiate_policy_upload: replaces invoke_policy_parse stub
CREATE OR REPLACE FUNCTION initiate_policy_upload(
  p_account_id    uuid,
  p_trip_id       uuid,
  p_policy_label  text,
  p_source_type   text DEFAULT 'pdf_upload',
  p_region_id     uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_guard       jsonb;
  v_gate        jsonb;
  v_policy_id   uuid;
  v_document_id uuid;
  v_emit        jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.1', 'policy_parse');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_emit := emit_event(
      p_event_type     := 'policy_parse_suppressed',
      p_feature_id     := 'F-6.5.1',
      p_scope_type     := 'system',
      p_scope_id       := p_region_id,
      p_actor_id       := p_account_id,
      p_actor_type     := 'traveler',
      p_reason_code    := 'MODE_RESTRICTED'
    );
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','reason','MODE_RESTRICTED');
  END IF;

  v_gate := check_feature_gate('F-6.5.1', p_region_id, NULL, 'policy');
  IF NOT (v_gate->>'enabled')::boolean THEN
    v_emit := emit_event(
      p_event_type     := 'policy_parse_suppressed',
      p_feature_id     := 'F-6.5.1',
      p_scope_type     := 'system',
      p_scope_id       := p_region_id,
      p_actor_id       := p_account_id,
      p_actor_type     := 'traveler',
      p_reason_code    := 'FEATURE_DISABLED',
      p_metadata       := v_gate
    );
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','reason','FEATURE_DISABLED');
  END IF;

  INSERT INTO policies (account_id, trip_id, policy_label, created_by)
  VALUES (p_account_id, p_trip_id, p_policy_label, p_account_id)
  RETURNING policy_id INTO v_policy_id;

  INSERT INTO policy_documents (policy_id, account_id, trip_id, source_type)
  VALUES (v_policy_id, p_account_id, p_trip_id, p_source_type)
  RETURNING document_id INTO v_document_id;

  v_emit := emit_event(
    p_event_type     := 'policy_parse_queued',
    p_feature_id     := 'F-6.5.1',
    p_scope_type     := 'policy',
    p_scope_id       := v_document_id,
    p_actor_id       := p_account_id,
    p_actor_type     := 'traveler',
    p_reason_code    := 'user_upload',
    p_resulting_state:= jsonb_build_object('document_id',v_document_id,'policy_id',v_policy_id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'policy_id', v_policy_id,
    'document_id', v_document_id,
    'status', 'QUEUED'
  );
END; $$;

GRANT EXECUTE ON FUNCTION initiate_policy_upload(uuid,uuid,text,text,uuid) TO authenticated;