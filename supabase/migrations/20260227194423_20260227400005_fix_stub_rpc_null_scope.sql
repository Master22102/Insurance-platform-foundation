/*
  # Fix Stub RPC Null Scope (emit_event NULL scope_id crash)

  ## Summary
  emit_event maps p_scope_id → related_entity_id (NOT NULL).
  When stub RPCs are called without an incident_id, p_scope_id=NULL causes
  the insert to fail with a NOT NULL violation.

  ## Fix
  - invoke_feature_stub: when p_incident_id IS NULL, emit with scope_type='system'
    and scope_id=p_region_id (the default region sentinel UUID is always non-null).
  - invoke_policy_parse and invoke_coverage_graph: same fix applied inline.
  - invoke_disruption_ingest: same fix applied inline.
  All named delegate stubs (invoke_timeline_enrich, etc.) already delegate to
  invoke_feature_stub so they are fixed automatically.

  ## No schema changes — function replacements only.
*/

-- Fix invoke_feature_stub (generic factory used by 14 named stubs)
CREATE OR REPLACE FUNCTION invoke_feature_stub(
  p_feature_id        text,
  p_attempted_action  text,
  p_suppression_event text,
  p_screen_surface_id text,
  p_incident_id       uuid    DEFAULT NULL,
  p_actor_id          uuid    DEFAULT NULL,
  p_idempotency_key   text    DEFAULT NULL,
  p_region_id         uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_trace_id          text    DEFAULT NULL,
  p_extra_clarity     jsonb   DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard      jsonb;
  v_gate       jsonb;
  v_meta       jsonb;
  v_trace      text    := COALESCE(p_trace_id, gen_random_uuid()::text);
  v_reason     text;
  v_hint       text;
  v_scope_type text;
  v_scope_id   uuid;
BEGIN
  v_scope_type := CASE WHEN p_incident_id IS NOT NULL THEN 'incident' ELSE 'system' END;
  v_scope_id   := COALESCE(p_incident_id, p_region_id);

  v_guard := precheck_mutation_guard(p_region_id, p_feature_id, p_attempted_action);
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_reason := 'MODE_RESTRICTED';
    v_hint   := 'Current region operational mode (' || get_mode_display_name(v_guard->>'mode') || ') does not permit ' || p_attempted_action || '. Wait for mode to change.';
    v_meta   := jsonb_build_object(
      'feature_id', p_feature_id, 'attempted_action', p_attempted_action,
      'reason_code', v_reason, 'next_step_hint', v_hint,
      'scope_type', v_scope_type, 'scope_id', v_scope_id::text,
      'screen_surface_id', p_screen_surface_id,
      'idempotency_key', COALESCE(p_idempotency_key, ''), 'trace_id', v_trace,
      'mode', v_guard->>'mode'
    ) || p_extra_clarity;
    PERFORM emit_event(
      p_event_type  := p_suppression_event, p_feature_id := p_feature_id,
      p_scope_type  := v_scope_type,        p_scope_id   := v_scope_id,
      p_actor_id    := p_actor_id,          p_actor_type := 'user',
      p_reason_code := v_reason,            p_metadata   := v_meta
    );
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id',p_feature_id,'reason_code',v_reason,'next_step_hint',v_hint);
  END IF;

  v_gate := check_feature_gate(p_feature_id, p_region_id);
  IF NOT (v_gate->>'enabled')::boolean THEN
    v_reason := 'FEATURE_DISABLED';
    v_hint   := 'Enable ' || p_feature_id || ' via set_feature_activation_state to activate this feature.';
    v_meta   := jsonb_build_object(
      'feature_id', p_feature_id, 'attempted_action', p_attempted_action,
      'reason_code', v_reason, 'next_step_hint', v_hint,
      'scope_type', v_scope_type, 'scope_id', v_scope_id::text,
      'screen_surface_id', p_screen_surface_id,
      'idempotency_key', COALESCE(p_idempotency_key, ''), 'trace_id', v_trace
    ) || p_extra_clarity;
    PERFORM emit_event(
      p_event_type  := p_suppression_event, p_feature_id := p_feature_id,
      p_scope_type  := v_scope_type,        p_scope_id   := v_scope_id,
      p_actor_id    := p_actor_id,          p_actor_type := 'user',
      p_reason_code := v_reason,            p_metadata   := v_meta
    );
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id',p_feature_id,'reason_code',v_reason,'next_step_hint',v_hint);
  END IF;

  RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id',p_feature_id,'reason_code','FEATURE_DISABLED','next_step_hint','Implementation pending — feature enabled but not yet built');
END;
$$;

GRANT EXECUTE ON FUNCTION invoke_feature_stub(text, text, text, text, uuid, uuid, text, uuid, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_feature_stub(text, text, text, text, uuid, uuid, text, uuid, text, jsonb) FROM anon;

-- Fix invoke_policy_parse (F-6.5.1) — inline version
CREATE OR REPLACE FUNCTION invoke_policy_parse(
  p_incident_id     uuid    DEFAULT NULL,
  p_guide_id        uuid    DEFAULT NULL,
  p_actor_id        uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_trace_id        text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard      jsonb;
  v_gate       jsonb;
  v_meta       jsonb;
  v_trace      text    := COALESCE(p_trace_id, gen_random_uuid()::text);
  v_scope_type text    := CASE WHEN p_incident_id IS NOT NULL THEN 'incident' ELSE 'system' END;
  v_scope_id   uuid    := COALESCE(p_incident_id, p_region_id);
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.1', 'policy_parse');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.1','attempted_action','policy_parse','reason_code','MODE_RESTRICTED',
      'next_step_hint','Wait for NORMAL mode before invoking policy parsing',
      'scope_type',v_scope_type,'scope_id',v_scope_id::text,
      'screen_surface_id','S-6.5.1-POLICY-PARSE',
      'idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace,'mode',v_guard->>'mode'
    );
    PERFORM emit_event(p_event_type:='policy_parse_suppressed',p_feature_id:='F-6.5.1',
      p_scope_type:=v_scope_type,p_scope_id:=v_scope_id,
      p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='MODE_RESTRICTED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.1','reason_code','MODE_RESTRICTED','next_step_hint','Wait for NORMAL mode');
  END IF;

  v_gate := check_feature_gate('F-6.5.1', p_region_id);
  IF NOT (v_gate->>'enabled')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.1','attempted_action','policy_parse','reason_code','FEATURE_DISABLED',
      'next_step_hint','Enable F-6.5.1 via set_feature_activation_state to activate Policy Parsing',
      'scope_type',v_scope_type,'scope_id',v_scope_id::text,
      'screen_surface_id','S-6.5.1-POLICY-PARSE',
      'idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace
    );
    PERFORM emit_event(p_event_type:='policy_parse_suppressed',p_feature_id:='F-6.5.1',
      p_scope_type:=v_scope_type,p_scope_id:=v_scope_id,
      p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='FEATURE_DISABLED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.1','reason_code','FEATURE_DISABLED','next_step_hint','Enable F-6.5.1 via set_feature_activation_state');
  END IF;

  RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.1','reason_code','FEATURE_DISABLED','next_step_hint','Implementation pending');
END;
$$;

GRANT EXECUTE ON FUNCTION invoke_policy_parse(uuid, uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_policy_parse(uuid, uuid, uuid, text, uuid, text) FROM anon;

-- Fix invoke_coverage_graph (F-6.5.2)
CREATE OR REPLACE FUNCTION invoke_coverage_graph(
  p_incident_id     uuid    DEFAULT NULL,
  p_actor_id        uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_trace_id        text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard      jsonb;
  v_gate       jsonb;
  v_meta       jsonb;
  v_trace      text    := COALESCE(p_trace_id, gen_random_uuid()::text);
  v_scope_type text    := CASE WHEN p_incident_id IS NOT NULL THEN 'incident' ELSE 'system' END;
  v_scope_id   uuid    := COALESCE(p_incident_id, p_region_id);
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.2', 'coverage_graph_build');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.2','attempted_action','coverage_graph_build','reason_code','MODE_RESTRICTED',
      'next_step_hint','Wait for NORMAL mode to build coverage graphs',
      'scope_type',v_scope_type,'scope_id',v_scope_id::text,
      'screen_surface_id','S-6.5.2-COVERAGE-GRAPH','idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace,'mode',v_guard->>'mode'
    );
    PERFORM emit_event(p_event_type:='coverage_graph_suppressed',p_feature_id:='F-6.5.2',
      p_scope_type:=v_scope_type,p_scope_id:=v_scope_id,
      p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='MODE_RESTRICTED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.2','reason_code','MODE_RESTRICTED','next_step_hint','Wait for NORMAL mode');
  END IF;

  v_gate := check_feature_gate('F-6.5.2', p_region_id);
  IF NOT (v_gate->>'enabled')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.2','attempted_action','coverage_graph_build','reason_code','FEATURE_DISABLED',
      'next_step_hint','Enable F-6.5.2 via set_feature_activation_state to activate Coverage Graph',
      'scope_type',v_scope_type,'scope_id',v_scope_id::text,
      'screen_surface_id','S-6.5.2-COVERAGE-GRAPH','idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace
    );
    PERFORM emit_event(p_event_type:='coverage_graph_suppressed',p_feature_id:='F-6.5.2',
      p_scope_type:=v_scope_type,p_scope_id:=v_scope_id,
      p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='FEATURE_DISABLED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.2','reason_code','FEATURE_DISABLED','next_step_hint','Enable F-6.5.2 via set_feature_activation_state');
  END IF;

  RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.2','reason_code','FEATURE_DISABLED','next_step_hint','Implementation pending');
END;
$$;

GRANT EXECUTE ON FUNCTION invoke_coverage_graph(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_coverage_graph(uuid, uuid, text, uuid, text) FROM anon;

-- Fix invoke_disruption_ingest (F-6.5.4)
CREATE OR REPLACE FUNCTION invoke_disruption_ingest(
  p_incident_id     uuid    DEFAULT NULL,
  p_actor_id        uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_trace_id        text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard      jsonb;
  v_gate       jsonb;
  v_meta       jsonb;
  v_trace      text    := COALESCE(p_trace_id, gen_random_uuid()::text);
  v_scope_type text    := CASE WHEN p_incident_id IS NOT NULL THEN 'incident' ELSE 'system' END;
  v_scope_id   uuid    := COALESCE(p_incident_id, p_region_id);
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.4', 'disruption_ingest');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.4','attempted_action','disruption_ingest','reason_code','MODE_RESTRICTED',
      'next_step_hint','Wait for NORMAL mode before ingesting disruption signals',
      'scope_type',v_scope_type,'scope_id',v_scope_id::text,
      'screen_surface_id','S-6.5.4-DISRUPTION','idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace,'mode',v_guard->>'mode'
    );
    PERFORM emit_event(p_event_type:='disruption_ingest_suppressed',p_feature_id:='F-6.5.4',
      p_scope_type:=v_scope_type,p_scope_id:=v_scope_id,
      p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='MODE_RESTRICTED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.4','reason_code','MODE_RESTRICTED','next_step_hint','Wait for NORMAL mode');
  END IF;

  v_gate := check_feature_gate('F-6.5.4', p_region_id);
  IF NOT (v_gate->>'enabled')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.4','attempted_action','disruption_ingest','reason_code','FEATURE_DISABLED',
      'next_step_hint','Enable F-6.5.4 via set_feature_activation_state to activate Airline Disruption Intelligence',
      'scope_type',v_scope_type,'scope_id',v_scope_id::text,
      'screen_surface_id','S-6.5.4-DISRUPTION','idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace
    );
    PERFORM emit_event(p_event_type:='disruption_ingest_suppressed',p_feature_id:='F-6.5.4',
      p_scope_type:=v_scope_type,p_scope_id:=v_scope_id,
      p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='FEATURE_DISABLED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.4','reason_code','FEATURE_DISABLED','next_step_hint','Enable F-6.5.4 via set_feature_activation_state');
  END IF;

  RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.4','reason_code','FEATURE_DISABLED','next_step_hint','Implementation pending');
END;
$$;

GRANT EXECUTE ON FUNCTION invoke_disruption_ingest(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_disruption_ingest(uuid, uuid, text, uuid, text) FROM anon;
