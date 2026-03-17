/*
  # Patch founder_readable_explanation for interpretive_output_emitted

  ## Change
  Update founder_readable_explanation() to render interpretive_output_emitted as:
  "Interpretive trace emitted for incident <scope_id>. Feature: <feature_id>. Confidence: <confidence>."

  All other event types unchanged.
*/

CREATE OR REPLACE FUNCTION founder_readable_explanation(
  p_event_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event record;
  v_explanation text := '';
  v_prev_state jsonb;
  v_result_state jsonb;
  v_metadata jsonb;
BEGIN
  -- Fetch the event from event_ledger
  SELECT el.event_type, el.scope_id, el.scope_type, el.reason_code,
         el.previous_state, el.resulting_state, el.metadata, el.actor_type,
         el.feature_id
  INTO v_event
  FROM event_ledger el
  WHERE el.id = p_event_id;

  IF NOT FOUND THEN
    RETURN 'No event found with ID ' || p_event_id;
  END IF;

  v_prev_state := COALESCE(v_event.previous_state, '{}'::jsonb);
  v_result_state := COALESCE(v_event.resulting_state, '{}'::jsonb);
  v_metadata := COALESCE(v_event.metadata, '{}'::jsonb);

  -- Build explanation from facts only (no predictive language)
  IF v_event.event_type = 'incident_status_changed' THEN
    v_explanation := 'Incident status changed from ' ||
      COALESCE(v_prev_state->>'status', 'unknown') || ' to ' ||
      COALESCE(v_result_state->>'status', 'unknown');
    IF v_event.reason_code IS NOT NULL THEN
      v_explanation := v_explanation || ' (reason: ' || v_event.reason_code || ')';
    END IF;

  ELSIF v_event.event_type = 'connector_state_changed' THEN
    v_explanation := 'Connector transitioned from ' ||
      COALESCE(v_prev_state->>'state', 'unknown') || ' to ' ||
      COALESCE(v_result_state->>'state', 'unknown');
    IF v_metadata->>'change_type' IS NOT NULL THEN
      v_explanation := v_explanation || ' via ' || v_metadata->>'change_type';
    END IF;

  ELSIF v_event.event_type = 'connector_failure_logged' THEN
    v_explanation := 'Connector failure recorded. Code: ' ||
      COALESCE(v_metadata->>'failure_code', 'unspecified');
    IF v_metadata->>'error_details' IS NOT NULL THEN
      v_explanation := v_explanation || '. Details: ' || v_metadata->>'error_details';
    END IF;

  ELSIF v_event.event_type IN ('auto_downgrade_to_degraded', 'auto_downgrade_to_manual_only') THEN
    v_explanation := 'Automatic state transition: ' ||
      COALESCE(v_metadata->>'from', 'unknown') || ' to ' ||
      COALESCE(v_metadata->>'to', 'unknown') || '. Reason: ' ||
      COALESCE(v_metadata->>'reason', 'threshold exceeded');

  ELSIF v_event.event_type = 'interpretive_output_emitted' THEN
    v_explanation := 'Interpretive trace emitted for incident ' ||
      v_event.scope_id || '. Feature: ' ||
      COALESCE(v_event.feature_id, 'unknown') || '. Confidence: ' ||
      COALESCE(v_metadata->>'confidence_enum', 'unspecified') || '.';

  ELSE
    v_explanation := 'Event type ' || v_event.event_type || ' recorded';
    IF v_event.reason_code IS NOT NULL THEN
      v_explanation := v_explanation || ' (reason: ' || v_event.reason_code || ')';
    END IF;
  END IF;

  -- Append actor info if available
  IF v_event.actor_type IS NOT NULL AND v_event.actor_type != 'system' THEN
    v_explanation := v_explanation || ' [by ' || v_event.actor_type || ']';
  END IF;

  RETURN v_explanation;
END;
$$;