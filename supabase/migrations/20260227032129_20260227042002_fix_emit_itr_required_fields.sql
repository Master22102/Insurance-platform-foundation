/*
  # Fix emit_itr - supply required fields for interpretive_trace_records
*/

DROP FUNCTION IF EXISTS emit_itr(uuid, text, text, text);
CREATE OR REPLACE FUNCTION emit_itr(
  p_scope_id uuid,
  p_feature_id text,
  p_confidence text,
  p_proof_data text
)
RETURNS TABLE(trace_id uuid, event_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trace_id uuid;
  v_event_id uuid;
  v_metadata jsonb;
  v_fingerprint text;
  v_profile_hash text;
BEGIN
  -- Generate fingerprint and profile hash from proof data
  v_fingerprint := encode(digest(p_proof_data, 'sha256'), 'hex');
  v_profile_hash := encode(digest(p_proof_data || p_confidence, 'sha256'), 'hex');

  -- Insert into interpretive_trace_records
  INSERT INTO interpretive_trace_records (
    incident_id, feature_id, decision_fingerprint, constraints_profile_hash,
    confidence_enum, metadata
  )
  VALUES (
    p_scope_id, p_feature_id, v_fingerprint, v_profile_hash, 
    p_confidence, jsonb_build_object('proof_data', p_proof_data)
  )
  RETURNING interpretive_trace_records.trace_id INTO v_trace_id;

  -- Prepare metadata with trace_id
  v_metadata := jsonb_build_object(
    'trace_id', v_trace_id,
    'confidence_enum', p_confidence,
    'proof_data_length', length(p_proof_data)
  );

  -- Emit interpretive_output_emitted event with trace_id
  INSERT INTO event_ledger (
    event_type, scope_id, scope_type, feature_id,
    metadata, actor_type
  )
  VALUES (
    'interpretive_output_emitted', p_scope_id, 'incident', p_feature_id,
    v_metadata, 'system'
  )
  RETURNING event_ledger.id INTO v_event_id;

  RETURN QUERY SELECT v_trace_id, v_event_id;
END;
$$;