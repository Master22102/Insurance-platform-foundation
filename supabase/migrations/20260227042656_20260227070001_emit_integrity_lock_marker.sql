/*
  # Emit integrity_lock_v1 schema_migration_applied marker

  emit_event() casts p_scope_type to entity_type for related_entity_type,
  so scope_type must be a valid entity_type enum value ('system').
  This marker is required so release_battery_failures() can anchor the
  itr_dangling_trace WARNING scope dynamically via event_ledger lookup
  instead of a hard-coded timestamp.
*/

DO $$
DECLARE
  v_system_id uuid := 'abb5f1ce-d0e4-4ce8-b757-ead40fc220f2'::uuid;
  v_result    jsonb;
  v_already   boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM event_ledger
    WHERE event_type = 'schema_migration_applied'
      AND metadata->>'migration' = 'integrity_lock_v1'
  ) INTO v_already;

  IF NOT v_already THEN
    v_result := emit_event(
      p_event_type  := 'schema_migration_applied',
      p_feature_id  := 'system',
      p_scope_type  := 'system',
      p_scope_id    := v_system_id,
      p_actor_type  := 'system',
      p_reason_code := 'migration_applied',
      p_metadata    := jsonb_build_object(
        'migration',   'integrity_lock_v1',
        'description', 'ITR integrity lock canonical + full battery checks restored',
        'fixes', jsonb_build_array(
          'emit_itr: guard + ITR insert + emit_event only, no direct ledger insert',
          'trg_validate_interpretive_trace_ref: 3-layer UUID+ITR existence check',
          'check_interpretive_trace_id_required: metadata.trace_id enforced',
          'release_battery_failures: Option A checks + ITR checks + post-lock dangling scope'
        )
      )
    );

    IF NOT (v_result->>'success')::boolean THEN
      RAISE EXCEPTION 'Failed to emit integrity_lock_v1 marker: %', v_result->>'error';
    END IF;
  END IF;
END $$;
