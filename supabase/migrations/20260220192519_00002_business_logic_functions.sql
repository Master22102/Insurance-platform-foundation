/*
  # Business Logic Transactional Functions

  ## Purpose
  Provides atomic state transitions with event logging.
  All state changes and event_logs inserts execute in a single transaction.

  ## Functions

  1. **change_incident_status**
     - Validates state transition rules
     - Checks evidence requirement (Capture → Action)
     - Atomically updates incident and logs event

  2. **change_connector_state**
     - Validates state transition rules
     - Checks manual review approval (ManualOnly → Enabled)
     - Atomically updates connector and logs event

  3. **log_connector_failure**
     - Records connector failure event
     - Updates failure_count_24h counter
     - Triggers auto-downgrade rules if thresholds exceeded

  4. **approve_connector_manual_review**
     - Records manual review approval event
     - Required before ManualOnly → Enabled transition

  5. **get_connector_failures_24h**
     - Helper function to compute rolling 24-hour failure counts
     - Reads from event_logs only (no stored counters)

  ## Transaction Guarantees
  All functions use BEGIN/END blocks to ensure atomicity.
  State updates and event logging succeed or fail together.
*/

-- =====================================================
-- Helper: Get connector failure count in last 24 hours
-- =====================================================

CREATE OR REPLACE FUNCTION get_connector_failures_24h(
  p_connector_id uuid,
  p_failure_code_filter failure_code DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM event_logs
  WHERE related_entity_type = 'connector'
    AND related_entity_id = p_connector_id
    AND event_type = 'connector_failure'
    AND created_at >= now() - interval '24 hours'
    AND (p_failure_code_filter IS NULL OR failure_code = p_failure_code_filter);
  
  RETURN v_count;
END;
$$;

-- =====================================================
-- Change Incident Status (with evidence check)
-- =====================================================

CREATE OR REPLACE FUNCTION change_incident_status(
  p_incident_id uuid,
  p_new_status incident_status,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status incident_status;
  v_evidence_count integer;
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

    -- Log event
    INSERT INTO event_logs (
      related_entity_type,
      related_entity_id,
      event_type,
      actor_id,
      metadata
    ) VALUES (
      'incident',
      p_incident_id,
      'status_changed',
      p_actor_id,
      jsonb_build_object(
        'from', v_current_status::text,
        'to', p_new_status::text
      )
    );

    v_result := jsonb_build_object(
      'success', true,
      'from', v_current_status::text,
      'to', p_new_status::text
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

-- =====================================================
-- Approve Connector Manual Review
-- =====================================================

CREATE OR REPLACE FUNCTION approve_connector_manual_review(
  p_connector_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connector_exists boolean;
BEGIN
  -- Check if connector exists
  SELECT EXISTS(
    SELECT 1 FROM connectors WHERE id = p_connector_id
  ) INTO v_connector_exists;

  IF NOT v_connector_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Connector not found'
    );
  END IF;

  -- Log approval event
  INSERT INTO event_logs (
    related_entity_type,
    related_entity_id,
    event_type,
    actor_id,
    metadata
  ) VALUES (
    'connector',
    p_connector_id,
    'manual_review_approved',
    p_actor_id,
    jsonb_build_object(
      'approved_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Manual review approved'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to approve review: ' || SQLERRM
    );
END;
$$;

-- =====================================================
-- Change Connector State (with manual review check)
-- =====================================================

CREATE OR REPLACE FUNCTION change_connector_state(
  p_connector_id uuid,
  p_new_state connector_state,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state connector_state;
  v_approval_exists boolean;
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

  -- Rule B: ManualOnly → Enabled requires manual review approval
  IF v_current_state = 'ManualOnly' AND p_new_state = 'Enabled' THEN
    SELECT EXISTS(
      SELECT 1
      FROM event_logs
      WHERE related_entity_type = 'connector'
        AND related_entity_id = p_connector_id
        AND event_type = 'manual_review_approved'
    ) INTO v_approval_exists;

    IF NOT v_approval_exists THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Manual review approval required before enabling connector'
      );
    END IF;
  END IF;

  -- Begin transaction
  BEGIN
    -- Update connector state
    UPDATE connectors
    SET state = p_new_state,
        updated_at = now()
    WHERE id = p_connector_id;

    -- Log event
    INSERT INTO event_logs (
      related_entity_type,
      related_entity_id,
      event_type,
      actor_id,
      metadata
    ) VALUES (
      'connector',
      p_connector_id,
      'state_changed',
      p_actor_id,
      jsonb_build_object(
        'from', v_current_state::text,
        'to', p_new_state::text
      )
    );

    v_result := jsonb_build_object(
      'success', true,
      'from', v_current_state::text,
      'to', p_new_state::text
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

-- =====================================================
-- Log Connector Failure (with auto-downgrade rules)
-- =====================================================

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
      metadata
    ) VALUES (
      'connector',
      p_connector_id,
      'connector_failure',
      p_failure_code,
      p_actor_id,
      jsonb_build_object(
        'error_details', COALESCE(p_error_details, ''),
        'failure_code', p_failure_code::text
      )
    );

    -- Get failure counts from event_logs (rolling 24 hours)
    v_total_failures := get_connector_failures_24h(p_connector_id, NULL);
    v_structure_failures := get_connector_failures_24h(p_connector_id, 'structure_changed');

    -- Update failure_count_24h counter
    UPDATE connectors
    SET failure_count_24h = v_total_failures,
        updated_at = now()
    WHERE id = p_connector_id;

    -- Rule C: Auto-downgrade logic
    v_new_state := v_current_state;

    -- Check structure_changed threshold (3+ in 24h → ManualOnly)
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

    -- Check total failure threshold (10+ in 24h → Degraded)
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

-- =====================================================
-- Run Connector Health Check Job
-- =====================================================

CREATE OR REPLACE FUNCTION run_connector_health_check_job(
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connector record;
  v_total_failures integer;
  v_structure_failures integer;
  v_processed_count integer := 0;
  v_downgraded_count integer := 0;
  v_result jsonb;
BEGIN
  -- Process all connectors
  FOR v_connector IN
    SELECT id, state
    FROM connectors
    WHERE state IN ('Enabled', 'Degraded')
  LOOP
    v_total_failures := get_connector_failures_24h(v_connector.id, NULL);
    v_structure_failures := get_connector_failures_24h(v_connector.id, 'structure_changed');

    -- Update failure count
    UPDATE connectors
    SET failure_count_24h = v_total_failures,
        updated_at = now()
    WHERE id = v_connector.id;

    -- Check thresholds and downgrade if needed
    IF v_structure_failures >= 3 AND v_connector.state != 'ManualOnly' THEN
      UPDATE connectors
      SET state = 'ManualOnly',
          updated_at = now()
      WHERE id = v_connector.id;

      INSERT INTO event_logs (
        related_entity_type,
        related_entity_id,
        event_type,
        actor_id,
        actor_type,
        metadata
      ) VALUES (
        'connector',
        v_connector.id,
        'auto_downgrade_to_manual_only',
        p_actor_id,
        'system',
        jsonb_build_object(
          'reason', 'structure_changed failures exceeded threshold',
          'structure_failures_24h', v_structure_failures,
          'threshold', 3,
          'from', v_connector.state::text,
          'to', 'ManualOnly'
        )
      );

      v_downgraded_count := v_downgraded_count + 1;

    ELSIF v_total_failures >= 10 AND v_connector.state = 'Enabled' THEN
      UPDATE connectors
      SET state = 'Degraded',
          updated_at = now()
      WHERE id = v_connector.id;

      INSERT INTO event_logs (
        related_entity_type,
        related_entity_id,
        event_type,
        actor_id,
        actor_type,
        metadata
      ) VALUES (
        'connector',
        v_connector.id,
        'auto_downgrade_to_degraded',
        p_actor_id,
        'system',
        jsonb_build_object(
          'reason', 'total failures exceeded threshold',
          'total_failures_24h', v_total_failures,
          'threshold', 10,
          'from', v_connector.state::text,
          'to', 'Degraded'
        )
      );

      v_downgraded_count := v_downgraded_count + 1;
    END IF;

    v_processed_count := v_processed_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'downgraded_count', v_downgraded_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Health check failed: ' || SQLERRM
    );
END;
$$;
