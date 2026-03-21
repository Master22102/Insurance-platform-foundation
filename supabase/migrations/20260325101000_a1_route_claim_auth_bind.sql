/*
  A1 — Bind route_claim to the authenticated subject.

  Prior: SECURITY DEFINER with no auth.uid() check; any authenticated caller could
  route claims for another user's trip if they knew incident_id.

  Now: require auth.uid(); p_actor_id must equal auth.uid(); trip.created_by
  must equal auth.uid(). Internal advance_trip_maturity call remains consistent.
*/

CREATE OR REPLACE FUNCTION route_claim(
  p_incident_id uuid,
  p_actor_id uuid,
  p_idempotency_key text DEFAULT NULL,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id text DEFAULT 'claims'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard jsonb;
  v_incident incidents%ROWTYPE;
  v_trip trips%ROWTYPE;
  v_snapshot_id uuid;
  v_snapshot coverage_graph_snapshots%ROWTYPE;
  v_existing_routing uuid;

  -- Alignment analysis
  v_alignment_category text;
  v_matched_node_id uuid;
  v_matched_benefit_type text;
  v_alignment_confidence text;
  v_matched_node coverage_nodes%ROWTYPE;
  v_candidate_nodes CURSOR FOR
    SELECT cn.* FROM coverage_nodes cn
    WHERE cn.snapshot_id = v_snapshot_id
      AND cn.node_type = 'benefit'
    ORDER BY cn.primacy_rank ASC;

  -- Causality branches
  v_has_dual_branches boolean := false;
  v_branch_a_itr_id uuid;
  v_branch_b_itr_id uuid;
  v_active_path text := 'single';

  -- Guidance
  v_guidance_steps jsonb := '[]'::jsonb;
  v_referenced_clauses uuid[] := '{}';

  -- Results
  v_routing_id uuid;
  v_emit_result jsonb;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT routing_id INTO v_existing_routing
    FROM claim_routing_decisions
    WHERE incident_id = p_incident_id
      AND routing_metadata->>'idempotency_key' = p_idempotency_key
    LIMIT 1;

    IF v_existing_routing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'routing_id', v_existing_routing,
        'idempotent', true
      );
    END IF;
  END IF;

  -- (1) Governance guard
  v_guard := precheck_mutation_guard(p_region_id, p_feature_id, 'claim_routing');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode',
      'mutation_class', 'claim_routing'
    );
  END IF;

  -- (2) Load incident and its causality_status, disruption_type
  SELECT * INTO v_incident FROM incidents WHERE id = p_incident_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;

  -- Load trip
  SELECT * INTO v_trip FROM trips WHERE trip_id = v_incident.trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip not found');
  END IF;

  -- A1: caller must match JWT and own the trip
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF v_trip.created_by IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- Emit routing started event
  v_emit_result := emit_event(
    p_event_type := 'claim_routing_started',
    p_feature_id := p_feature_id,
    p_scope_type := 'incident',
    p_scope_id := p_incident_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'routing_initiation',
    p_metadata := jsonb_build_object('incident_id', p_incident_id)
  );

  -- (3) Load Coverage Graph snapshot for the trip
  SELECT * INTO v_snapshot
  FROM coverage_graph_snapshots
  WHERE trip_id = v_trip.trip_id
    AND graph_status = 'COMPLETE'
  ORDER BY computation_timestamp DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No coverage graph snapshot found for trip',
      'hint', 'Run compute_coverage_graph() first'
    );
  END IF;

  v_snapshot_id := v_snapshot.snapshot_id;

  -- (4) Align incident against coverage nodes
  -- Match based on disruption_type to benefit_type
  -- This is a simplified heuristic; production would use ML/rules engine

  v_alignment_category := 'INSUFFICIENT_DATA';
  v_alignment_confidence := 'low';

  FOR v_matched_node IN v_candidate_nodes LOOP
    -- Simple mapping: medical_event -> medical_expense, etc.
    IF (v_incident.metadata->>'disruption_type') = 'medical_event'
       AND v_matched_node.benefit_type = 'medical_expense' THEN
      v_matched_node_id := v_matched_node.node_id;
      v_matched_benefit_type := v_matched_node.benefit_type;
      v_alignment_confidence := v_matched_node.confidence_label;

      -- Check for exclusions
      IF v_matched_node.exclusion_clause_ids IS NOT NULL
         AND array_length(v_matched_node.exclusion_clause_ids, 1) > 0 THEN
        v_alignment_category := 'CONDITIONAL';
      ELSE
        v_alignment_category := 'ALIGNED';
      END IF;

      EXIT; -- Take first match (highest primacy)
    ELSIF (v_incident.metadata->>'disruption_type') = 'trip_cancellation'
       AND v_matched_node.benefit_type = 'trip_cancellation' THEN
      v_matched_node_id := v_matched_node.node_id;
      v_matched_benefit_type := v_matched_node.benefit_type;
      v_alignment_confidence := v_matched_node.confidence_label;

      IF v_matched_node.exclusion_clause_ids IS NOT NULL
         AND array_length(v_matched_node.exclusion_clause_ids, 1) > 0 THEN
        v_alignment_category := 'CONDITIONAL';
      ELSE
        v_alignment_category := 'ALIGNED';
      END IF;

      EXIT;
    END IF;
  END LOOP;

  -- Check for overlapping policies (ambiguity)
  IF v_matched_node_id IS NOT NULL THEN
    IF (v_matched_node.overlap_flags->>'has_overlap')::boolean = true THEN
      v_alignment_category := 'AMBIGUOUS';
    END IF;
  END IF;

  -- Emit alignment determination
  v_emit_result := emit_event(
    p_event_type := 'structural_alignment_determined',
    p_feature_id := p_feature_id,
    p_scope_type := 'incident',
    p_scope_id := p_incident_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'system',
    p_reason_code := 'coverage_alignment',
    p_metadata := jsonb_build_object(
      'alignment_category', v_alignment_category,
      'matched_node_id', v_matched_node_id,
      'benefit_type', v_matched_benefit_type,
      'confidence', v_alignment_confidence
    )
  );

  -- (5) Dual-branch evaluation if causality_status = UNKNOWN
  IF COALESCE(v_incident.metadata->>'causality_status', 'UNKNOWN') = 'UNKNOWN' THEN
    v_has_dual_branches := true;
    v_active_path := 'branch_a'; -- Default to confirmed branch

    -- Create branch_a ITR (causality CONFIRMED)
    INSERT INTO interpretive_trace_records (
      trace_category,
      trace_subcategory,
      actor_id,
      actor_type,
      scope_type,
      scope_id,
      trace_metadata
    ) VALUES (
      'claim_routing',
      'dual_branch_a_confirmed',
      p_actor_id,
      'system',
      'incident',
      p_incident_id,
      jsonb_build_object(
        'branch', 'a',
        'causality_assumption', 'CONFIRMED',
        'alignment_category', v_alignment_category,
        'matched_node_id', v_matched_node_id,
        'guidance_note', 'Assumes causality can be proven'
      )
    )
    RETURNING trace_id INTO v_branch_a_itr_id;

    -- Create branch_b ITR (causality DISPUTED)
    INSERT INTO interpretive_trace_records (
      trace_category,
      trace_subcategory,
      actor_id,
      actor_type,
      scope_type,
      scope_id,
      trace_metadata
    ) VALUES (
      'claim_routing',
      'dual_branch_b_disputed',
      p_actor_id,
      'system',
      'incident',
      p_incident_id,
      jsonb_build_object(
        'branch', 'b',
        'causality_assumption', 'DISPUTED',
        'alignment_category', 'EXCLUDED',
        'matched_node_id', v_matched_node_id,
        'guidance_note', 'Assumes causality cannot be proven - claim likely denied'
      )
    )
    RETURNING trace_id INTO v_branch_b_itr_id;

    -- Emit dual-branch event
    v_emit_result := emit_event(
      p_event_type := 'dual_branch_evaluation_created',
      p_feature_id := p_feature_id,
      p_scope_type := 'incident',
      p_scope_id := p_incident_id,
      p_actor_id := p_actor_id,
      p_actor_type := 'system',
      p_reason_code := 'causality_unknown',
      p_metadata := jsonb_build_object(
        'branch_a_itr_id', v_branch_a_itr_id,
        'branch_b_itr_id', v_branch_b_itr_id,
        'active_path', v_active_path
      )
    );
  END IF;

  -- (7) Produce sequenced guidance steps
  IF v_matched_node_id IS NOT NULL THEN
    v_referenced_clauses := array_append(v_referenced_clauses, v_matched_node.coverage_trigger_clause_id);

    v_guidance_steps := jsonb_build_array(
      jsonb_build_object(
        'step', 1,
        'action', 'Review coverage trigger clause',
        'clause_id', v_matched_node.coverage_trigger_clause_id,
        'benefit_type', v_matched_benefit_type
      ),
      jsonb_build_object(
        'step', 2,
        'action', 'Gather supporting documentation',
        'required_evidence', CASE
          WHEN v_matched_benefit_type = 'medical_expense' THEN
            jsonb_build_array('medical_records', 'receipts', 'diagnosis')
          WHEN v_matched_benefit_type = 'trip_cancellation' THEN
            jsonb_build_array('cancellation_notice', 'receipts', 'booking_confirmation')
          ELSE jsonb_build_array('incident_report', 'receipts')
        END
      ),
      jsonb_build_object(
        'step', 3,
        'action', 'Complete claim form',
        'form_type', 'standard_claim_form'
      ),
      jsonb_build_object(
        'step', 4,
        'action', 'Submit to carrier',
        'note', CASE
          WHEN v_alignment_category = 'CONDITIONAL' THEN
            'Note: Policy has exclusions that may apply. Review carefully.'
          WHEN v_alignment_category = 'AMBIGUOUS' THEN
            'Note: Multiple policies may cover this. Coordinate of benefits required.'
          ELSE 'Coverage appears aligned with your incident.'
        END
      )
    );
  ELSE
    v_guidance_steps := jsonb_build_array(
      jsonb_build_object(
        'step', 1,
        'action', 'Unable to determine coverage alignment',
        'reason', v_alignment_category,
        'next_action', 'Contact support for manual review'
      )
    );
  END IF;

  -- (6) Create claim_routing_decisions row
  INSERT INTO claim_routing_decisions (
    incident_id,
    trip_id,
    snapshot_id,
    structural_alignment_category,
    matched_node_id,
    matched_benefit_type,
    alignment_confidence,
    causality_status,
    has_dual_branches,
    branch_a_itr_id,
    branch_b_itr_id,
    active_user_presented_path,
    guidance_steps,
    referenced_clause_ids,
    routing_metadata
  ) VALUES (
    p_incident_id,
    v_trip.trip_id,
    v_snapshot_id,
    v_alignment_category,
    v_matched_node_id,
    v_matched_benefit_type,
    v_alignment_confidence,
    COALESCE(v_incident.metadata->>'causality_status', 'UNKNOWN'),
    v_has_dual_branches,
    v_branch_a_itr_id,
    v_branch_b_itr_id,
    v_active_path,
    v_guidance_steps,
    v_referenced_clauses,
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'routed_at', now()
    )
  )
  RETURNING routing_id INTO v_routing_id;

  -- (8) Advance trip maturity to CLAIM_ROUTING_LOCKED
  PERFORM advance_trip_maturity(
    p_trip_id := v_trip.trip_id,
    p_target_state := 'CLAIM_ROUTING_LOCKED',
    p_actor_id := p_actor_id,
    p_reason_code := 'claim_routing_complete',
    p_region_id := p_region_id
  );

  -- (9) Emit claim_routing_complete event
  v_emit_result := emit_event(
    p_event_type := 'claim_routing_complete',
    p_feature_id := p_feature_id,
    p_scope_type := 'incident',
    p_scope_id := p_incident_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'routing_success',
    p_previous_state := jsonb_build_object('routed', false),
    p_resulting_state := jsonb_build_object(
      'routed', true,
      'routing_id', v_routing_id,
      'alignment_category', v_alignment_category
    ),
    p_metadata := jsonb_build_object(
      'routing_id', v_routing_id,
      'incident_id', p_incident_id,
      'alignment_category', v_alignment_category,
      'has_dual_branches', v_has_dual_branches,
      'guidance_step_count', jsonb_array_length(v_guidance_steps)
    ),
    p_idempotency_key := p_idempotency_key
  );

  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for claim_routing_complete: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'routing_id', v_routing_id,
    'incident_id', p_incident_id,
    'trip_id', v_trip.trip_id,
    'alignment_category', v_alignment_category,
    'matched_benefit_type', v_matched_benefit_type,
    'alignment_confidence', v_alignment_confidence,
    'has_dual_branches', v_has_dual_branches,
    'active_path', v_active_path,
    'guidance_steps', v_guidance_steps,
    'trip_maturity_advanced_to', 'CLAIM_ROUTING_LOCKED',
    'event_id', v_emit_result->>'event_id',
    'idempotent', false
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'route_claim failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION route_claim(uuid, uuid, text, uuid, text) TO authenticated;
