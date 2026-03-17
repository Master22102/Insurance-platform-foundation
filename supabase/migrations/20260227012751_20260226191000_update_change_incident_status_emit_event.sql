/*
  # Update change_incident_status to use emit_event

  ## Purpose
  Demonstrates new Governance Substrate pattern: use emit_event() instead of direct INSERT INTO event_logs.

  ## Changes
  - Replace INSERT INTO event_logs with emit_event() call
  - Add state deltas (previous_state, resulting_state)
  - Add reason_code support

  ## Backward Compatibility
  - Function signature unchanged
  - Return value unchanged
  - Behavior unchanged (evidence gate still enforced)
*/

CREATE OR REPLACE FUNCTION change_incident_status(
  p_incident_id uuid,
  p_new_status incident_status,
  p_actor_id uuid,
  p_reason_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status incident_status;
  v_evidence_count integer;
  v_emit_result jsonb;
  v_result jsonb;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status
  FROM incidents
  WHERE id = p_incident_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Incident not found'
    );
  END IF;

  -- Rule A: Capture → Action requires evidence
  IF v_current_status = 'Capture' AND p_new_status = 'Action' THEN
    SELECT COUNT(*) INTO v_evidence_count
    FROM evidence
    WHERE incident_id = p_incident_id;

    IF v_evidence_count = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Cannot move to Action status without evidence'
      );
    END IF;
  END IF;

  -- Begin transaction
  BEGIN
    -- Update incident status
    UPDATE incidents
    SET status = p_new_status,
        updated_at = now()
    WHERE id = p_incident_id;

    -- Emit event using Governance Substrate pattern
    v_emit_result := emit_event(
      p_event_type := 'status_changed',
      p_feature_id := 'incidents',
      p_scope_type := 'incident',
      p_scope_id := p_incident_id,
      p_actor_id := p_actor_id,
      p_actor_type := CASE WHEN p_actor_id IS NOT NULL THEN 'user' ELSE 'system' END,
      p_reason_code := p_reason_code,
      p_previous_state := jsonb_build_object('status', v_current_status::text),
      p_resulting_state := jsonb_build_object('status', p_new_status::text),
      p_metadata := jsonb_build_object(
        'from', v_current_status::text,
        'to', p_new_status::text,
        'evidence_count', v_evidence_count
      )
    );

    IF NOT (v_emit_result->>'success')::boolean THEN
      RAISE EXCEPTION 'Failed to emit event: %', v_emit_result->>'error';
    END IF;

    v_result := jsonb_build_object(
      'success', true,
      'from', v_current_status::text,
      'to', p_new_status::text,
      'event_id', v_emit_result->>'event_id'
    );

    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Transaction failed: ' || SQLERRM
      );
  END;
END;
$$;