/*
  # Add Degraded → ManualOnly Auto-Downgrade Rule

  ## Problem
  The `log_connector_failure` function implements:
  - Rule C1: Enabled → Degraded at 10 total failures ✓
  - Rule C2: Degraded → ManualOnly at 50 total failures ✗ (missing)

  After 10 failures, connectors move to Degraded but get stuck there.
  At 50 failures, they should escalate to ManualOnly for human review.

  ## Solution
  Add second-tier downgrade rule without modifying schema/RLS:
  - IF total_failures >= 50 AND state = 'Degraded' THEN state = 'ManualOnly'
  - Log event: auto_downgrade_to_manual_only with actor_type='system'
  - Maintain transaction atomicity (state + event in same block)

  ## Preserves Invariants
  - Atomicity: State update and event log coupled in transaction ✓
  - Immutability: event_logs RLS unchanged ✓
  - Portability: No new dependencies ✓

  ## Schema Changes
  Before: Missing ELSIF branch for Degraded → ManualOnly
  After:  Complete cascade: Enabled → Degraded → ManualOnly
*/

CREATE OR REPLACE FUNCTION log_connector_failure(
  p_connector_id uuid,
  p_failure_code failure_code,
  p_actor_id uuid,
  p_error_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state connector_state;
  v_total_failures integer;
  v_structure_failures integer;
  v_new_state connector_state;
  v_downgrade_reason text;
  v_result jsonb;
BEGIN
  -- Get current state
  SELECT state INTO v_current_state
  FROM connectors
  WHERE id = p_connector_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Connector not found'
    );
  END IF;

  -- Begin transaction
  BEGIN
    -- Log failure event
    INSERT INTO event_logs (
      related_entity_type,
      related_entity_id,
      event_type,
      failure_code,
      actor_id,
      actor_type,
      metadata
    ) VALUES (
      'connector',
      p_connector_id,
      'connector_failure',
      p_failure_code,
      p_actor_id,
      'system',
      jsonb_build_object(
        'error_details', COALESCE(p_error_details, ''),
        'failure_code', p_failure_code::text
      )
    );

    -- Get failure counts from event_logs (rolling 24 hours)
    v_total_failures := get_connector_failures_24h(p_connector_id, NULL);
    v_structure_failures := get_connector_failures_24h(p_connector_id, 'structure_changed'::failure_code);

    -- Update failure_count_24h counter
    UPDATE connectors
    SET failure_count_24h = v_total_failures,
        updated_at = now()
    WHERE id = p_connector_id;

    -- Rule C: Auto-downgrade logic
    v_new_state := v_current_state;

    -- Rule C1: structure_changed threshold (3+ in 24h → ManualOnly from any state)
    IF v_structure_failures >= 3 AND v_current_state != 'ManualOnly' THEN
      v_new_state := 'ManualOnly';
      v_downgrade_reason := 'structure_changed failures exceeded threshold';

      UPDATE connectors
      SET state = v_new_state,
          updated_at = now()
      WHERE id = p_connector_id;

      INSERT INTO event_logs (
        related_entity_type,
        related_entity_id,
        event_type,
        actor_id,
        actor_type,
        metadata
      ) VALUES (
        'connector',
        p_connector_id,
        'auto_downgrade_to_manual_only',
        p_actor_id,
        'system',
        jsonb_build_object(
          'reason', v_downgrade_reason,
          'structure_failures_24h', v_structure_failures,
          'threshold', 3,
          'from', v_current_state::text,
          'to', v_new_state::text
        )
      );

    -- Rule C2: Total failure threshold (50+ in 24h → ManualOnly from Degraded)
    ELSIF v_total_failures >= 50 AND v_current_state = 'Degraded' THEN
      v_new_state := 'ManualOnly';
      v_downgrade_reason := 'total failures exceeded manual review threshold';

      UPDATE connectors
      SET state = v_new_state,
          updated_at = now()
      WHERE id = p_connector_id;

      INSERT INTO event_logs (
        related_entity_type,
        related_entity_id,
        event_type,
        actor_id,
        actor_type,
        metadata
      ) VALUES (
        'connector',
        p_connector_id,
        'auto_downgrade_to_manual_only',
        p_actor_id,
        'system',
        jsonb_build_object(
          'reason', v_downgrade_reason,
          'total_failures_24h', v_total_failures,
          'threshold', 50,
          'from', v_current_state::text,
          'to', v_new_state::text
        )
      );

    -- Rule C3: Total failure threshold (10+ in 24h → Degraded from Enabled)
    ELSIF v_total_failures >= 10 AND v_current_state = 'Enabled' THEN
      v_new_state := 'Degraded';
      v_downgrade_reason := 'total failures exceeded threshold';

      UPDATE connectors
      SET state = v_new_state,
          updated_at = now()
      WHERE id = p_connector_id;

      INSERT INTO event_logs (
        related_entity_type,
        related_entity_id,
        event_type,
        actor_id,
        actor_type,
        metadata
      ) VALUES (
        'connector',
        p_connector_id,
        'auto_downgrade_to_degraded',
        p_actor_id,
        'system',
        jsonb_build_object(
          'reason', v_downgrade_reason,
          'total_failures_24h', v_total_failures,
          'threshold', 10,
          'from', v_current_state::text,
          'to', v_new_state::text
        )
      );
    END IF;

    v_result := jsonb_build_object(
      'success', true,
      'failure_logged', true,
      'total_failures_24h', v_total_failures,
      'structure_failures_24h', v_structure_failures,
      'state_changed', v_new_state != v_current_state,
      'previous_state', v_current_state::text,
      'current_state', v_new_state::text
    );

    IF v_new_state != v_current_state THEN
      v_result := v_result || jsonb_build_object(
        'downgrade_reason', v_downgrade_reason
      );
    END IF;

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