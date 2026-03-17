/*
  # Fix run_action_inbox_projector: Feature ID FK Resolution

  ## Summary
  Events emitted by older RPCs (create_incident, register_evidence) use
  feature_id='incidents' which is not registered in feature_registry.
  The projector inserts action_inbox_items with feature_id FK → feature_registry,
  so it must resolve to a known feature_id or fall back to 'governance'.

  ## Fix
  Replace COALESCE(v_event.feature_id, 'governance') with a subquery that
  checks whether the event's feature_id exists in feature_registry.
  If not found, fall back to 'governance' (always registered).
*/

CREATE OR REPLACE FUNCTION run_action_inbox_projector(
  p_batch_size  integer DEFAULT 50,
  p_region_id   uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_actor_id    uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard             jsonb;
  v_hwm_event_id      uuid;
  v_hwm_at            timestamptz;
  v_event             record;
  v_items_created     integer := 0;
  v_items_skipped     integer := 0;
  v_last_event_id     uuid;
  v_last_event_at     timestamptz;
  v_item_id           uuid;
  v_ikey              text;
  v_title             text;
  v_body              text;
  v_priority          text;
  v_item_type         text;
  v_feature_id        text;
  v_emit              jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'inbox_project');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('ok',false,'error','Blocked by governance guard','mode',v_guard->>'mode');
  END IF;

  SELECT last_processed_event_id, last_processed_at
  INTO v_hwm_event_id, v_hwm_at
  FROM action_inbox_projector_state
  WHERE projector_id = 'default';

  FOR v_event IN
    SELECT el.*
    FROM event_ledger el
    WHERE (v_hwm_at IS NULL
           OR el.created_at > v_hwm_at
           OR (el.created_at = v_hwm_at AND el.id > COALESCE(v_hwm_event_id,'00000000-0000-0000-0000-000000000000'::uuid)))
    ORDER BY el.created_at ASC, el.id ASC
    LIMIT p_batch_size
  LOOP
    v_last_event_id := v_event.id;
    v_last_event_at := v_event.created_at;

    v_ikey := 'proj:' || v_event.id::text;

    IF EXISTS (SELECT 1 FROM action_inbox_items WHERE idempotency_key = v_ikey) THEN
      v_items_skipped := v_items_skipped + 1;
      CONTINUE;
    END IF;

    -- Resolve feature_id to one that exists in feature_registry
    SELECT feature_id INTO v_feature_id
    FROM feature_registry
    WHERE feature_id = v_event.feature_id
    LIMIT 1;
    IF v_feature_id IS NULL THEN
      v_feature_id := 'governance';
    END IF;

    v_title    := NULL;
    v_body     := NULL;
    v_priority := 'medium';
    v_item_type := 'task';

    IF v_event.event_type IN (
      'incident_created', 'evidence_upload_staged',
      'routing_recommendation_generated', 'benefit_eval_completed'
    ) THEN
      v_title    := 'Action required: ' || v_event.event_type;
      v_body     := 'Ledger event ' || v_event.event_type || ' requires follow-up. See timeline for context.';
      v_priority := CASE
        WHEN v_event.event_type = 'incident_created'                 THEN 'high'
        WHEN v_event.event_type = 'routing_recommendation_generated' THEN 'high'
        ELSE 'medium'
      END;
      v_item_type := 'task';

    ELSIF v_event.event_type LIKE '%_suppressed' THEN
      v_title    := 'Feature suppressed: ' || COALESCE(v_event.feature_id, v_event.event_type);
      v_body     := 'Action was suppressed: ' || v_event.event_type || '. Reason: ' || COALESCE(v_event.reason_code, 'unknown');
      v_priority := 'low';
      v_item_type := 'notification';

    ELSIF v_event.event_type IN ('routing_recommendation_rejected', 'consent_revoked') THEN
      v_title    := 'Decision reversed: ' || v_event.event_type;
      v_body     := 'A decision was reversed on this incident. Manual review may be needed.';
      v_priority := 'high';
      v_item_type := 'alert';

    ELSIF v_event.event_type = 'focl_integrity_lock_marker' THEN
      v_title    := 'FOCL: Integrity lock triggered';
      v_body     := 'Founder-offline posture integrity lock was activated. Review governance state.';
      v_priority := 'critical';
      v_item_type := 'escalation';

    ELSIF v_event.event_type = 'feature_activation_changed' THEN
      v_title    := 'Feature flag changed: ' || COALESCE(v_event.resulting_state->>'feature_id', '?');
      v_body     := 'Feature activation state changed. Verify intended rollout scope.';
      v_priority := 'medium';
      v_item_type := 'notification';

    ELSE
      CONTINUE;
    END IF;

    IF v_title IS NULL THEN CONTINUE; END IF;

    INSERT INTO action_inbox_items (
      feature_id, incident_id, source_event_id,
      item_type, status, priority,
      title, body,
      reason_code, next_step_hint,
      idempotency_key, metadata
    ) VALUES (
      v_feature_id,
      CASE WHEN v_event.scope_type = 'incident' THEN v_event.scope_id ELSE NULL END,
      v_event.id,
      v_item_type, 'open', v_priority,
      v_title, v_body,
      v_event.reason_code,
      COALESCE(v_event.metadata->>'next_step_hint', 'Review the incident timeline for context.'),
      v_ikey,
      jsonb_build_object('source_event_type', v_event.event_type, 'source_feature_id', v_event.feature_id)
    )
    RETURNING item_id INTO v_item_id;

    v_items_created := v_items_created + 1;
  END LOOP;

  IF v_last_event_id IS NOT NULL THEN
    UPDATE action_inbox_projector_state
    SET last_processed_event_id = v_last_event_id,
        last_processed_at       = v_last_event_at,
        events_processed_count  = events_processed_count + v_items_created + v_items_skipped,
        updated_at              = now()
    WHERE projector_id = 'default';
  END IF;

  v_emit := emit_event(
    p_event_type  := 'inbox_projector_run',
    p_feature_id  := 'governance',
    p_scope_type  := 'system',
    p_scope_id    := p_region_id,
    p_actor_id    := p_actor_id,
    p_actor_type  := 'system',
    p_reason_code := 'projector_run_ok',
    p_metadata    := jsonb_build_object(
      'items_created', v_items_created,
      'items_skipped', v_items_skipped,
      'last_event_id', v_last_event_id,
      'batch_size',    p_batch_size
    )
  );

  RETURN jsonb_build_object(
    'ok',              true,
    'items_created',   v_items_created,
    'items_skipped',   v_items_skipped,
    'last_event_id',   v_last_event_id,
    'projector_event_id', v_emit->>'event_id'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION run_action_inbox_projector(integer, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION run_action_inbox_projector(integer, uuid, uuid) FROM anon;
