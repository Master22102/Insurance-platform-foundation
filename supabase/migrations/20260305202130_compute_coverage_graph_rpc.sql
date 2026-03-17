/*
  # Compute Coverage Graph RPC
  
  1. Purpose
    - Deterministic computation of coverage graph from trip policies
    - Collects AUTO_ACCEPTED clauses from all policy_versions attached to trip
    - Groups by benefit_type, identifies overlaps and conflicts
    - Assigns primacy_rank based on policy effective_date
    - Creates ITR for computation session
  
  2. Algorithm
    - Collect all policy_versions linked to trip
    - Extract AUTO_ACCEPTED clauses grouped by benefit_type
    - Identify overlapping coverage (same benefit, multiple policies)
    - Detect exclusion conflicts between policies
    - Assign primacy_rank (earlier effective_date = higher rank)
    - Create deterministic input_hash from policy content_hashes
    - Insert snapshot + nodes atomically
    - Emit coverage_graph_computed event
  
  3. Determinism
    - Same policy versions → same content_hash ordering → same graph
    - Primacy rank is deterministic by effective_date
    - Node creation order is sorted by benefit_type, then primacy_rank
  
  4. Security
    - SECURITY DEFINER for system computation
    - Trip ownership validated
*/

-- Register event type
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('coverage_graph_computed', 1, 'F-7.0', 'info'),
  ('coverage_overlap_detected', 1, 'F-7.0', 'warning'),
  ('coverage_exclusion_conflict', 1, 'F-7.0', 'warning')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION compute_coverage_graph(
  p_trip_id uuid,
  p_actor_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trip           trips%ROWTYPE;
  v_itr_trace_id   uuid;
  v_snapshot_id    uuid;
  v_input_hash     text;
  v_policy_version record;
  v_clause         record;
  v_benefit_groups jsonb := '{}';
  v_benefit_type   text;
  v_benefit_data   jsonb;
  v_node_id        uuid;
  v_primacy_rank   integer;
  v_overlap_flags  jsonb;
  v_total_nodes    integer := 0;
  v_overlap_count  integer := 0;
  v_conflict_count integer := 0;
  v_emit           jsonb;
  v_policy_hashes  text[];
  v_exclusion_ids  uuid[];
BEGIN
  -- Validate trip exists and user has access
  SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'TRIP_NOT_FOUND');
  END IF;
  
  IF v_trip.created_by != p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'UNAUTHORIZED');
  END IF;

  -- Create ITR for this computation session
  INSERT INTO interpretive_trace_records (
    trace_category,
    trace_subcategory,
    actor_id,
    actor_type,
    scope_type,
    scope_id,
    trace_metadata
  ) VALUES (
    'coverage_computation',
    'graph_build',
    p_actor_id,
    'system',
    'trip',
    p_trip_id,
    jsonb_build_object('computation_started_at', now())
  )
  RETURNING trace_id INTO v_itr_trace_id;

  -- Collect all policy_versions for this trip, ordered by effective_date
  -- This ordering creates deterministic primacy_rank assignment
  FOR v_policy_version IN
    SELECT
      pv.version_id,
      pv.policy_id,
      pv.content_hash,
      pv.effective_date,
      ROW_NUMBER() OVER (ORDER BY pv.effective_date ASC NULLS LAST, pv.version_id) as rank
    FROM policy_versions pv
    JOIN policies p ON pv.policy_id = p.policy_id
    WHERE p.trip_id = p_trip_id
      AND p.lifecycle_state = 'active'
    ORDER BY pv.effective_date ASC NULLS LAST, pv.version_id
  LOOP
    v_policy_hashes := array_append(v_policy_hashes, v_policy_version.content_hash);
    
    -- Collect AUTO_ACCEPTED clauses for this policy_version
    FOR v_clause IN
      SELECT
        clause_id,
        clause_type,
        family_code,
        canonical_text,
        confidence_label
      FROM policy_clauses
      WHERE policy_version_id = v_policy_version.version_id
        AND extraction_status = 'AUTO_ACCEPTED'
      ORDER BY clause_type, clause_id
    LOOP
      -- Determine benefit_type from clause_type
      -- Map clause families to benefit categories
      v_benefit_type := CASE
        WHEN v_clause.clause_type IN ('cancellation_rule') THEN 'trip_cancellation'
        WHEN v_clause.clause_type IN ('medical') THEN 'medical_expense'
        WHEN v_clause.clause_type IN ('baggage') THEN 'baggage_protection'
        WHEN v_clause.clause_type IN ('flight_delay') THEN 'travel_delay'
        WHEN v_clause.clause_type IN ('emergency_evac') THEN 'emergency_evacuation'
        ELSE 'general_' || v_clause.clause_type
      END;

      -- Group clauses by benefit_type
      v_benefit_data := COALESCE(v_benefit_groups->v_benefit_type, '[]'::jsonb);
      v_benefit_data := v_benefit_data || jsonb_build_object(
        'clause_id', v_clause.clause_id,
        'policy_version_id', v_policy_version.version_id,
        'policy_id', v_policy_version.policy_id,
        'primacy_rank', v_policy_version.rank,
        'clause_type', v_clause.clause_type,
        'confidence_label', v_clause.confidence_label,
        'is_exclusion', v_clause.clause_type = 'exclusion'
      );
      v_benefit_groups := jsonb_set(v_benefit_groups, ARRAY[v_benefit_type], v_benefit_data);
    END LOOP;
  END LOOP;

  -- Create deterministic input_hash from sorted policy content_hashes
  v_input_hash := md5(array_to_string(v_policy_hashes, '|'));

  -- Check if identical computation already exists
  IF EXISTS (
    SELECT 1 FROM coverage_graph_snapshots
    WHERE trip_id = p_trip_id
      AND input_hash = v_input_hash
      AND graph_status = 'COMPLETE'
  ) THEN
    SELECT snapshot_id INTO v_snapshot_id
    FROM coverage_graph_snapshots
    WHERE trip_id = p_trip_id
      AND input_hash = v_input_hash
      AND graph_status = 'COMPLETE'
    ORDER BY computation_timestamp DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'CACHED',
      'snapshot_id', v_snapshot_id,
      'reason', 'Identical graph already computed'
    );
  END IF;

  -- Create coverage_graph_snapshot
  INSERT INTO coverage_graph_snapshots (
    trip_id,
    input_hash,
    graph_status,
    itr_trace_id
  ) VALUES (
    p_trip_id,
    v_input_hash,
    'COMPUTING',
    v_itr_trace_id
  )
  RETURNING snapshot_id INTO v_snapshot_id;

  -- Process each benefit_type to create coverage_nodes
  FOR v_benefit_type IN
    SELECT jsonb_object_keys(v_benefit_groups)
    ORDER BY jsonb_object_keys(v_benefit_groups)
  LOOP
    v_benefit_data := v_benefit_groups->v_benefit_type;
    
    -- Check for overlapping coverage (multiple policies covering same benefit)
    IF jsonb_array_length(v_benefit_data) > 1 THEN
      v_overlap_count := v_overlap_count + 1;
      v_overlap_flags := jsonb_build_object(
        'has_overlap', true,
        'policy_count', jsonb_array_length(v_benefit_data),
        'coordination_required', true
      );
      
      -- Emit overlap warning
      v_emit := emit_event(
        p_event_type     := 'coverage_overlap_detected',
        p_feature_id     := 'F-7.0',
        p_scope_type     := 'trip',
        p_scope_id       := p_trip_id,
        p_actor_id       := p_actor_id,
        p_actor_type     := 'system',
        p_reason_code    := 'MULTIPLE_POLICIES_SAME_BENEFIT',
        p_metadata       := jsonb_build_object(
          'benefit_type', v_benefit_type,
          'policy_count', jsonb_array_length(v_benefit_data)
        )
      );
    ELSE
      v_overlap_flags := jsonb_build_object('has_overlap', false);
    END IF;

    -- Create coverage_node for each policy covering this benefit
    FOR v_clause IN
      SELECT * FROM jsonb_array_elements(v_benefit_data)
    LOOP
      -- Collect exclusion clause IDs for this benefit
      v_exclusion_ids := ARRAY(
        SELECT (elem->>'clause_id')::uuid
        FROM jsonb_array_elements(v_benefit_data) elem
        WHERE (elem->>'is_exclusion')::boolean = true
      );

      -- Check for exclusion conflicts
      IF array_length(v_exclusion_ids, 1) > 0 AND NOT (v_clause.value->>'is_exclusion')::boolean THEN
        v_conflict_count := v_conflict_count + 1;
        
        v_emit := emit_event(
          p_event_type     := 'coverage_exclusion_conflict',
          p_feature_id     := 'F-7.0',
          p_scope_type     := 'trip',
          p_scope_id       := p_trip_id,
          p_actor_id       := p_actor_id,
          p_actor_type     := 'system',
          p_reason_code    := 'EXCLUSION_PRESENT',
          p_metadata       := jsonb_build_object(
            'benefit_type', v_benefit_type,
            'exclusion_count', array_length(v_exclusion_ids, 1)
          )
        );
      END IF;

      -- Insert coverage_node
      INSERT INTO coverage_nodes (
        snapshot_id,
        node_type,
        policy_version_id,
        benefit_type,
        coverage_trigger_clause_id,
        exclusion_clause_ids,
        primacy_rank,
        overlap_flags,
        confidence_label
      ) VALUES (
        v_snapshot_id,
        CASE
          WHEN (v_clause.value->>'is_exclusion')::boolean THEN 'exclusion'
          ELSE 'benefit'
        END,
        (v_clause.value->>'policy_version_id')::uuid,
        v_benefit_type,
        (v_clause.value->>'clause_id')::uuid,
        CASE
          WHEN (v_clause.value->>'is_exclusion')::boolean THEN NULL
          ELSE v_exclusion_ids
        END,
        (v_clause.value->>'primacy_rank')::integer,
        v_overlap_flags,
        v_clause.value->>'confidence_label'
      )
      RETURNING node_id INTO v_node_id;
      
      v_total_nodes := v_total_nodes + 1;
    END LOOP;
  END LOOP;

  -- Mark snapshot as COMPLETE
  UPDATE coverage_graph_snapshots
  SET graph_status = 'COMPLETE'
  WHERE snapshot_id = v_snapshot_id;

  -- Update ITR with completion metadata
  UPDATE interpretive_trace_records
  SET trace_metadata = trace_metadata || jsonb_build_object(
    'computation_completed_at', now(),
    'total_nodes', v_total_nodes,
    'overlap_count', v_overlap_count,
    'conflict_count', v_conflict_count
  )
  WHERE trace_id = v_itr_trace_id;

  -- Emit coverage_graph_computed event
  v_emit := emit_event(
    p_event_type     := 'coverage_graph_computed',
    p_feature_id     := 'F-7.0',
    p_scope_type     := 'trip',
    p_scope_id       := p_trip_id,
    p_actor_id       := p_actor_id,
    p_actor_type     := 'system',
    p_reason_code    := 'GRAPH_COMPUTATION_SUCCESS',
    p_metadata       := jsonb_build_object(
      'snapshot_id', v_snapshot_id,
      'input_hash', v_input_hash,
      'total_nodes', v_total_nodes,
      'overlap_count', v_overlap_count,
      'conflict_count', v_conflict_count,
      'itr_trace_id', v_itr_trace_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'COMPLETE',
    'snapshot_id', v_snapshot_id,
    'input_hash', v_input_hash,
    'total_nodes', v_total_nodes,
    'overlap_count', v_overlap_count,
    'conflict_count', v_conflict_count,
    'itr_trace_id', v_itr_trace_id
  );
END; $$;

GRANT EXECUTE ON FUNCTION compute_coverage_graph(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_coverage_graph(uuid, uuid) TO service_role;