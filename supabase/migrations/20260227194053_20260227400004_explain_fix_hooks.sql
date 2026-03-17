/*
  # Explain & Fix Hooks (Prompt 2 — Section F)

  ## Summary
  Deterministic context resolver for the FOCL Explain & Fix pattern.
  Binds ledger events to doctrine references, RPC context, and screen surface context
  to produce a full context package for any event in the system.

  ## New Screen Surfaces
  Three FOCL-specific surfaces added to screen_surface_registry:
  - FOCL_ACTION_INBOX:         The action inbox list view
  - FOCL_EVENT_HISTORY:        Full event ledger view per incident
  - FOCL_EXPLAIN_AND_FIX_PANEL: Slide-over panel showing explain & fix context for one event

  ## New RPC: get_explain_fix_context(p_event_id uuid)
  Returns a full context package for one event_ledger row:
  - event: the raw event record
  - incident: the incident record (if scope_type = 'incident')
  - feature: the feature_registry entry for this event's feature_id
  - screen_surfaces: relevant screen surfaces for this feature
  - doctrine_refs: deterministic doctrine section references per event_type
  - rpc_context: which RPC likely produced this event (from event_type → RPC mapping)
  - explain_text: founder-readable explanation of what happened
  - fix_hints: array of actionable next steps
  - confidence_label_text: human text for confidence (if present in metadata)
  - mode_display: current region mode display name

  ## Doctrine Reference Map
  Maps event types to doctrine section IDs for traceability.

  ## Security
  SECURITY DEFINER, EXECUTE granted to authenticated.
*/

-- =====================================================
-- FOCL Screen Surfaces
-- =====================================================

INSERT INTO screen_surface_registry (surface_id, feature_id, surface_label, route_path, required_data_deps, confidence_required) VALUES
  ('FOCL_ACTION_INBOX',          'F-6.5.16', 'Action Inbox',              '/focl/inbox',                     ARRAY['action_inbox_items'],  'any'),
  ('FOCL_EVENT_HISTORY',         'F-6.5.16', 'Event History',             '/focl/incidents/:id/events',      ARRAY['event_ledger'],        'any'),
  ('FOCL_EXPLAIN_AND_FIX_PANEL', 'F-6.5.16', 'Explain & Fix Panel',       '/focl/incidents/:id/explain/:eid',ARRAY['event_ledger','action_inbox_items'], 'any')
ON CONFLICT (surface_id) DO NOTHING;

-- =====================================================
-- Doctrine Reference Helper
-- =====================================================

CREATE OR REPLACE FUNCTION get_doctrine_refs_for_event(p_event_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN CASE p_event_type
    WHEN 'incident_created'                  THEN '["8.4 Permissioning & Audit Logs","12.5 Logging, Observability & Reliability"]'::jsonb
    WHEN 'evidence_upload_staged'            THEN '["8.4 Permissioning & Audit Logs","F-6.5.6 Evidence Management"]'::jsonb
    WHEN 'benefit_eval_completed'            THEN '["7.8 Deterministic Decision Communication","9.2 Confidence Labels & Uncertainty Language","F-6.5.3 Credit Card Benefits Guide"]'::jsonb
    WHEN 'benefit_eval_eligible'             THEN '["9.2 Confidence Labels & Uncertainty Language","F-6.5.3"]'::jsonb
    WHEN 'benefit_eval_ineligible'           THEN '["9.2 Confidence Labels & Uncertainty Language","F-6.5.3"]'::jsonb
    WHEN 'routing_recommendation_generated' THEN '["7.8 Deterministic Decision Communication","9.2 Confidence Labels","F-6.5.5 Claim Routing & Sequencing"]'::jsonb
    WHEN 'routing_recommendation_accepted'  THEN '["F-6.5.5 Claim Routing","8.4 Audit Logs"]'::jsonb
    WHEN 'routing_recommendation_rejected'  THEN '["F-6.5.5 Claim Routing","8.4 Audit Logs"]'::jsonb
    WHEN 'guide_version_ingested'            THEN '["F-6.5.3 Credit Card Benefits Guide","8.4 Audit Logs"]'::jsonb
    WHEN 'consent_granted'                   THEN '["F-6.5.3","8.4 Audit Logs"]'::jsonb
    WHEN 'consent_revoked'                   THEN '["F-6.5.3","8.4 Audit Logs"]'::jsonb
    WHEN 'feature_activation_changed'        THEN '["12.4 Feature Flag System","8.4 Audit Logs"]'::jsonb
    WHEN 'feature_action_suppressed'         THEN '["12.4 Feature Flag System","F-6.5.16 FOCL"]'::jsonb
    WHEN 'focl_integrity_lock_marker'        THEN '["F-6.5.16 FOCL Founder Offline Posture","8.4 Audit Logs"]'::jsonb
    WHEN 'interpretive_output_emitted'       THEN '["7.8 Deterministic Decision Communication","9.2 Confidence Labels"]'::jsonb
    WHEN 'inbox_item_created'                THEN '["F-6.5.16 FOCL","12.5 Observability"]'::jsonb
    WHEN 'inbox_item_status_changed'         THEN '["F-6.5.16 FOCL","8.4 Audit Logs"]'::jsonb
    WHEN 'inbox_projector_run'               THEN '["F-6.5.16 FOCL","12.5 Observability"]'::jsonb
    ELSE '["8.4 Permissioning & Audit Logs"]'::jsonb
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION get_doctrine_refs_for_event(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_doctrine_refs_for_event(text) FROM anon;

-- =====================================================
-- RPC Context Helper
-- =====================================================

CREATE OR REPLACE FUNCTION get_rpc_context_for_event(p_event_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN CASE p_event_type
    WHEN 'incident_created'                  THEN jsonb_build_object('rpc','create_incident','mutation_class','incident_create','guarded',true)
    WHEN 'evidence_upload_staged'            THEN jsonb_build_object('rpc','register_evidence','mutation_class','evidence_upload','guarded',true)
    WHEN 'guide_version_ingested'            THEN jsonb_build_object('rpc','ingest_guide_version','mutation_class','guide_ingest','guarded',true)
    WHEN 'consent_granted'                   THEN jsonb_build_object('rpc','grant_consent','mutation_class','consent_grant','guarded',true)
    WHEN 'consent_revoked'                   THEN jsonb_build_object('rpc','revoke_consent','mutation_class','consent_revoke','guarded',true)
    WHEN 'benefit_eval_completed'            THEN jsonb_build_object('rpc','run_benefit_eval','mutation_class','benefit_eval','guarded',true)
    WHEN 'routing_recommendation_generated' THEN jsonb_build_object('rpc','generate_routing_recommendation','mutation_class','routing_generate','guarded',true)
    WHEN 'routing_recommendation_accepted'  THEN jsonb_build_object('rpc','record_acceptance_checkpoint','mutation_class','routing_accept','guarded',true)
    WHEN 'routing_recommendation_rejected'  THEN jsonb_build_object('rpc','record_acceptance_checkpoint','mutation_class','routing_reject','guarded',true)
    WHEN 'acceptance_checkpoint_recorded'   THEN jsonb_build_object('rpc','record_acceptance_checkpoint','mutation_class','routing_checkpoint','guarded',true)
    WHEN 'feature_activation_changed'        THEN jsonb_build_object('rpc','set_feature_activation_state','mutation_class','feature_gate','guarded',true)
    WHEN 'feature_action_suppressed'         THEN jsonb_build_object('rpc','invoke_feature_stub','mutation_class','stub_invoke','guarded',true)
    WHEN 'inbox_item_snoozed'               THEN jsonb_build_object('rpc','snooze_action_inbox_item','mutation_class','inbox_snooze','guarded',true)
    WHEN 'inbox_item_assigned'              THEN jsonb_build_object('rpc','assign_action_inbox_item','mutation_class','inbox_assign','guarded',true)
    WHEN 'inbox_item_status_changed'        THEN jsonb_build_object('rpc','set_action_inbox_status','mutation_class','inbox_status_change','guarded',true)
    WHEN 'inbox_note_added'                 THEN jsonb_build_object('rpc','add_action_inbox_note','mutation_class','inbox_note','guarded',true)
    WHEN 'inbox_projector_run'              THEN jsonb_build_object('rpc','run_action_inbox_projector','mutation_class','inbox_project','guarded',true)
    ELSE jsonb_build_object('rpc','unknown','mutation_class','unknown','guarded',false)
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION get_rpc_context_for_event(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_rpc_context_for_event(text) FROM anon;

-- =====================================================
-- Fix Hints Helper
-- =====================================================

CREATE OR REPLACE FUNCTION get_fix_hints_for_event(p_event_type text, p_reason_code text, p_metadata jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hints jsonb := '[]'::jsonb;
  v_next  text;
BEGIN
  v_next := p_metadata->>'next_step_hint';
  IF v_next IS NOT NULL AND v_next <> '' THEN
    v_hints := v_hints || jsonb_build_array(v_next);
  END IF;

  CASE p_reason_code
    WHEN 'FEATURE_DISABLED' THEN
      v_hints := v_hints || jsonb_build_array(
        'Call set_feature_activation_state with p_enabled=true for feature_id: ' || COALESCE(p_metadata->>'feature_id','?'),
        'Verify the feature is ready for activation in the current region mode'
      );
    WHEN 'MODE_RESTRICTED' THEN
      v_hints := v_hints || jsonb_build_array(
        'Current mode: ' || get_mode_display_name(COALESCE(p_metadata->>'mode','?')),
        'Wait for the region to return to a less restrictive mode before retrying'
      );
    WHEN 'DOCUMENTATION_INCOMPLETE' THEN
      v_hints := v_hints || jsonb_build_array(
        'Ensure all required documentation is uploaded and validated',
        'Call register_evidence to attach supporting documents'
      );
    WHEN 'SOURCE_UNAVAILABLE' THEN
      v_hints := v_hints || jsonb_build_array(
        'Verify the external source is reachable and credentials are valid',
        'Check connector state via the connector health check RPC'
      );
    WHEN 'PERMISSION_DENIED' THEN
      v_hints := v_hints || jsonb_build_array(
        'Verify the actor has the required role for this operation',
        'Contact the founder to grant the necessary permissions'
      );
    WHEN 'RATE_LIMITED' THEN
      v_hints := v_hints || jsonb_build_array(
        'Wait for the rate limit window to reset before retrying',
        'Check the backoff period in the event metadata'
      );
    ELSE NULL;
  END CASE;

  CASE p_event_type
    WHEN 'routing_recommendation_rejected' THEN
      v_hints := v_hints || jsonb_build_array('Review rejection reason and generate a new routing recommendation if needed');
    WHEN 'benefit_eval_ineligible' THEN
      v_hints := v_hints || jsonb_build_array('Upload additional supporting evidence and re-run benefit evaluation');
    WHEN 'consent_revoked' THEN
      v_hints := v_hints || jsonb_build_array('Re-grant consent via grant_consent RPC if re-evaluation is needed');
    WHEN 'focl_integrity_lock_marker' THEN
      v_hints := v_hints || jsonb_build_array('Review the governance state immediately','Contact founder to assess offline posture window');
    ELSE NULL;
  END CASE;

  IF jsonb_array_length(v_hints) = 0 THEN
    v_hints := jsonb_build_array('Review the incident timeline for additional context');
  END IF;

  RETURN v_hints;
END;
$$;

GRANT EXECUTE ON FUNCTION get_fix_hints_for_event(text, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_fix_hints_for_event(text, text, jsonb) FROM anon;

-- =====================================================
-- Main RPC: get_explain_fix_context
-- =====================================================

CREATE OR REPLACE FUNCTION get_explain_fix_context(
  p_event_id  uuid,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event             record;
  v_incident          record;
  v_feature           record;
  v_surfaces          jsonb;
  v_doctrine          jsonb;
  v_rpc_ctx           jsonb;
  v_fix_hints         jsonb;
  v_explain_text      text;
  v_confidence_text   text;
  v_mode              text;
  v_mode_display      text;
  v_confidence_raw    text;
BEGIN
  SELECT * INTO v_event FROM event_ledger WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event not found');
  END IF;

  IF v_event.scope_type = 'incident' AND v_event.scope_id IS NOT NULL THEN
    SELECT * INTO v_incident FROM incidents WHERE id = v_event.scope_id;
  END IF;

  IF v_event.feature_id IS NOT NULL THEN
    SELECT * INTO v_feature FROM feature_registry WHERE feature_id = v_event.feature_id;
  END IF;

  IF v_event.feature_id IS NOT NULL THEN
    SELECT jsonb_agg(row_to_json(s)::jsonb)
    INTO v_surfaces
    FROM screen_surface_registry s
    WHERE s.feature_id = v_event.feature_id;
  END IF;

  v_doctrine  := get_doctrine_refs_for_event(v_event.event_type);
  v_rpc_ctx   := get_rpc_context_for_event(v_event.event_type);
  v_fix_hints := get_fix_hints_for_event(v_event.event_type, v_event.reason_code, COALESCE(v_event.metadata,'{}'));

  v_confidence_raw := COALESCE(
    v_event.metadata->>'confidence_label',
    v_event.resulting_state->>'confidence_label'
  );

  IF v_confidence_raw IS NOT NULL AND v_confidence_raw <> '' THEN
    BEGIN
      v_confidence_text := get_confidence_label_text(v_confidence_raw::confidence_label);
    EXCEPTION WHEN invalid_text_representation THEN
      v_confidence_text := 'Confidence: ' || v_confidence_raw;
    END;
  END IF;

  SELECT COALESCE(ros.current_mode, 'NORMAL')
  INTO v_mode
  FROM region_operational_state ros
  WHERE ros.region_id = p_region_id;

  v_mode_display := get_mode_display_name(COALESCE(v_mode, 'NORMAL'));

  v_explain_text := 'Event: ' || v_event.event_type ||
    CASE WHEN v_event.reason_code IS NOT NULL THEN ' | Reason: ' || v_event.reason_code ELSE '' END ||
    CASE WHEN v_confidence_text IS NOT NULL THEN ' | ' || v_confidence_text ELSE '' END ||
    ' | Mode: ' || v_mode_display;

  RETURN jsonb_build_object(
    'ok',              true,
    'event',           row_to_json(v_event)::jsonb,
    'incident',        CASE WHEN v_incident IS NOT NULL THEN row_to_json(v_incident)::jsonb ELSE NULL END,
    'feature',         CASE WHEN v_feature IS NOT NULL THEN row_to_json(v_feature)::jsonb ELSE NULL END,
    'screen_surfaces', COALESCE(v_surfaces, '[]'::jsonb),
    'doctrine_refs',   v_doctrine,
    'rpc_context',     v_rpc_ctx,
    'fix_hints',       v_fix_hints,
    'explain_text',    v_explain_text,
    'confidence_label_text', v_confidence_text,
    'mode',            v_mode,
    'mode_display',    v_mode_display
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_explain_fix_context(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_explain_fix_context(uuid, uuid) FROM anon;

-- Register event types
INSERT INTO event_type_registry (event_type, schema_version, feature_id) VALUES
  ('explain_fix_context_queried', 1, 'F-6.5.16')
ON CONFLICT (event_type) DO NOTHING;
