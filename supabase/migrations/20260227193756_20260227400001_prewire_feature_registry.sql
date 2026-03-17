/*
  # Pre-Wire Feature Registry + Stub RPCs (Prompt 2 — Section D)

  ## Summary
  Registers 17 pre-wired features in feature_registry (all DISABLED by default).
  Each feature gets at minimum one SECURITY DEFINER stub RPC that:
    1. Calls precheck_mutation_guard()
    2. Checks feature_activation_state (DISABLED)
    3. Emits feature_action_suppressed with full universal metadata rails
    4. Returns { ok:false, status:'SUPPRESSED', feature_id, reason_code, next_step_hint }

  ## Pre-Wired Features
  - F-6.5.1  Policy Parsing & Clause Extraction
  - F-6.5.2  Coverage Graph & Overlap Resolution
  - F-6.5.4  Airline Disruption Intelligence
  - F-6.5.7-ENRICH  Incident Timeline Enrichment Hooks
  - F-6.5.8  Causality Linking Engine
  - F-6.5.9  Rebooking Event Log
  - F-6.5.10 Carrier Discrepancy Detection
  - F-6.5.11 Regulatory-Aware Incident Reporting (RAIR)
  - F-6.5.12 Authority-Driven Travel Disruptions
  - F-6.5.13 Itinerary Risk Modeling
  - F-6.5.14 Claim Packet Generator
  - F-CARRIER-DEEP-LINK  Carrier Portal Deep-Linking
  - F-6.5.15 Claim Progress Tracking & Outcome Feedback
  - F-6.6.1  DCEL (Deterministic Comms Enrichment Layer)
  - F-6.6.9  Financial Modeling & Allocation Impact Engine
  - F-7.4    Voice-First Interaction Model
  - F-12.3   Data Pipelines (Landing Zone)

  ## Event Types
  One suppression event type per feature, registered in event_type_registry.

  ## Screen Surfaces
  Each feature gets a placeholder screen surface entry in screen_surface_registry.

  ## Security
  - All stub RPCs are SECURITY DEFINER
  - EXECUTE granted to authenticated, revoked from anon
  - No direct-write policies on any new domain tables (none added here — features are stubs only)
*/

-- =====================================================
-- Feature Registry Inserts (all DISABLED by default)
-- =====================================================

INSERT INTO feature_registry (feature_id, display_name, description, default_enabled, minimum_mode) VALUES
  ('F-6.5.1',          'Policy Parsing & Clause Extraction',       'Parse benefit policy documents and extract structured clause data',           false, 'NORMAL'),
  ('F-6.5.2',          'Coverage Graph & Overlap Resolution',       'Build coverage graph from clauses and resolve overlapping benefits',          false, 'NORMAL'),
  ('F-6.5.4',          'Airline Disruption Intelligence',           'Ingest and correlate airline disruption signals for incident context',        false, 'NORMAL'),
  ('F-6.5.7-ENRICH',   'Incident Timeline Enrichment Hooks',        'Attach enrichment data to incident timeline events from external signals',   false, 'NORMAL'),
  ('F-6.5.8',          'Causality Linking Engine',                  'Link causal chains between incident events and disruption sources',           false, 'NORMAL'),
  ('F-6.5.9',          'Rebooking Event Log',                       'Structured log of rebooking actions and outcomes',                           false, 'NORMAL'),
  ('F-6.5.10',         'Carrier Discrepancy Detection',             'Detect mismatches between carrier records and traveler-reported events',     false, 'NORMAL'),
  ('F-6.5.11',         'Regulatory-Aware Incident Reporting (RAIR)','Generate regulatory-compliant incident report packets',                      false, 'NORMAL'),
  ('F-6.5.12',         'Authority-Driven Travel Disruptions',       'Incorporate authority-issued disruption declarations into claim context',    false, 'NORMAL'),
  ('F-6.5.13',         'Itinerary Risk Modeling',                   'Model forward-looking risk from current itinerary and disruption signals',   false, 'NORMAL'),
  ('F-6.5.14',         'Claim Packet Generator',                    'Assemble copy-only claim packet from incident evidence and eval results',    false, 'NORMAL'),
  ('F-CARRIER-DEEP',   'Carrier Portal Deep-Linking',               'Deep-link to carrier portal screens for claim submission',                   false, 'NORMAL'),
  ('F-6.5.15',         'Claim Progress Tracking & Outcome Feedback','Track claim submission progress and ingest outcome feedback',                false, 'NORMAL'),
  ('F-6.6.1',          'DCEL (Deterministic Comms Enrichment)',     'Enriches outbound communications with deterministic decision context',       false, 'NORMAL'),
  ('F-6.6.9',          'Financial Modeling & Allocation Impact',    'Model financial impact and allocation across claim paths',                   false, 'NORMAL'),
  ('F-7.4',            'Voice-First Interaction Model',             'Voice interface for traveler incident capture and status queries',            false, 'NORMAL'),
  ('F-12.3',           'Data Pipelines (Landing Zone)',             'Structured landing zone for ingesting external data feeds',                  false, 'NORMAL')
ON CONFLICT (feature_id) DO NOTHING;

-- =====================================================
-- Event Types for Suppression Events (one per feature)
-- =====================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id) VALUES
  ('policy_parse_suppressed',           1, 'F-6.5.1'),
  ('coverage_graph_suppressed',         1, 'F-6.5.2'),
  ('disruption_ingest_suppressed',      1, 'F-6.5.4'),
  ('timeline_enrich_suppressed',        1, 'F-6.5.7-ENRICH'),
  ('causality_link_suppressed',         1, 'F-6.5.8'),
  ('rebooking_log_suppressed',          1, 'F-6.5.9'),
  ('carrier_discrepancy_suppressed',    1, 'F-6.5.10'),
  ('rair_report_suppressed',            1, 'F-6.5.11'),
  ('authority_disruption_suppressed',   1, 'F-6.5.12'),
  ('itinerary_risk_suppressed',         1, 'F-6.5.13'),
  ('claim_packet_suppressed',           1, 'F-6.5.14'),
  ('carrier_deeplink_suppressed',       1, 'F-CARRIER-DEEP'),
  ('claim_progress_suppressed',         1, 'F-6.5.15'),
  ('dcel_enrich_suppressed',            1, 'F-6.6.1'),
  ('financial_model_suppressed',        1, 'F-6.6.9'),
  ('voice_capture_suppressed',          1, 'F-7.4'),
  ('pipeline_ingest_suppressed',        1, 'F-12.3')
ON CONFLICT (event_type) DO NOTHING;

-- =====================================================
-- Screen Surfaces (one placeholder per feature)
-- =====================================================

INSERT INTO screen_surface_registry (surface_id, feature_id, surface_label, route_path, required_data_deps, confidence_required) VALUES
  ('S-6.5.1-POLICY-PARSE',    'F-6.5.1',        'Policy Parser',                    '/traveler/policy/parse',                 ARRAY['credit_card_guide_versions'],  'any'),
  ('S-6.5.2-COVERAGE-GRAPH',  'F-6.5.2',        'Coverage Graph',                   '/traveler/policy/coverage-graph',        ARRAY['benefit_clauses'],             'medium'),
  ('S-6.5.4-DISRUPTION',      'F-6.5.4',        'Airline Disruption Feed',          '/traveler/disruptions',                  ARRAY[]::text[],                      'any'),
  ('S-6.5.7-ENRICH',          'F-6.5.7-ENRICH', 'Timeline Enrichment Panel',        '/traveler/incidents/:id/timeline/enrich',ARRAY['incident_timeline'],           'any'),
  ('S-6.5.8-CAUSALITY',       'F-6.5.8',        'Causality Chain View',             '/traveler/incidents/:id/causality',      ARRAY[]::text[],                      'low'),
  ('S-6.5.9-REBOOKING',       'F-6.5.9',        'Rebooking Log',                    '/traveler/incidents/:id/rebooking',      ARRAY[]::text[],                      'any'),
  ('S-6.5.10-DISCREPANCY',    'F-6.5.10',       'Carrier Discrepancy Report',       '/traveler/incidents/:id/discrepancy',    ARRAY[]::text[],                      'medium'),
  ('S-6.5.11-RAIR',           'F-6.5.11',       'Regulatory Report Builder',        '/traveler/incidents/:id/rair',           ARRAY[]::text[],                      'high'),
  ('S-6.5.12-AUTHORITY',      'F-6.5.12',       'Authority Disruption Context',     '/traveler/incidents/:id/authority',      ARRAY[]::text[],                      'any'),
  ('S-6.5.13-RISK',           'F-6.5.13',       'Itinerary Risk Model',             '/traveler/incidents/:id/risk',           ARRAY[]::text[],                      'medium'),
  ('S-6.5.14-CLAIM-PACKET',   'F-6.5.14',       'Claim Packet Preview',             '/traveler/incidents/:id/claim-packet',   ARRAY['evidence'],                    'any'),
  ('S-CARRIER-DEEP',          'F-CARRIER-DEEP', 'Carrier Portal Deep-Link',         '/traveler/incidents/:id/carrier-portal', ARRAY[]::text[],                      'any'),
  ('S-6.5.15-PROGRESS',       'F-6.5.15',       'Claim Progress Tracker',           '/traveler/incidents/:id/claim-progress', ARRAY[]::text[],                      'any'),
  ('S-6.6.1-DCEL',            'F-6.6.1',        'DCEL Communication Panel',         '/traveler/comms/dcel',                   ARRAY[]::text[],                      'any'),
  ('S-6.6.9-FINANCIAL',       'F-6.6.9',        'Financial Impact Model',           '/traveler/incidents/:id/financial',      ARRAY[]::text[],                      'medium'),
  ('S-7.4-VOICE',             'F-7.4',          'Voice Capture Interface',          '/traveler/voice',                        ARRAY[]::text[],                      'any'),
  ('S-12.3-PIPELINE',         'F-12.3',         'Data Pipeline Status',             '/admin/pipelines',                       ARRAY[]::text[],                      'any')
ON CONFLICT (surface_id) DO NOTHING;

-- =====================================================
-- Stub RPC: invoke_policy_parse (F-6.5.1)
-- =====================================================

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
  v_guard  jsonb;
  v_gate   jsonb;
  v_meta   jsonb;
  v_emit   jsonb;
  v_trace  text := COALESCE(p_trace_id, gen_random_uuid()::text);
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.1', 'policy_parse');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id',        'F-6.5.1',
      'attempted_action',  'policy_parse',
      'reason_code',       'MODE_RESTRICTED',
      'next_step_hint',    'Wait for region mode to return to NORMAL before invoking policy parsing',
      'scope_type',        'incident',
      'scope_id',          COALESCE(p_incident_id::text, ''),
      'screen_surface_id', 'S-6.5.1-POLICY-PARSE',
      'idempotency_key',   COALESCE(p_idempotency_key, ''),
      'trace_id',          v_trace,
      'mode',              v_guard->>'mode'
    );
    v_emit := emit_event(
      p_event_type := 'policy_parse_suppressed', p_feature_id := 'F-6.5.1',
      p_scope_type := 'incident', p_scope_id := p_incident_id,
      p_actor_id := p_actor_id, p_actor_type := 'user',
      p_reason_code := 'MODE_RESTRICTED', p_metadata := v_meta
    );
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.1','reason_code','MODE_RESTRICTED','next_step_hint','Wait for NORMAL mode');
  END IF;

  v_gate := check_feature_gate('F-6.5.1', p_region_id);
  IF NOT (v_gate->>'enabled')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id',        'F-6.5.1',
      'attempted_action',  'policy_parse',
      'reason_code',       'FEATURE_DISABLED',
      'next_step_hint',    'Enable F-6.5.1 via set_feature_activation_state to activate Policy Parsing',
      'scope_type',        'incident',
      'scope_id',          COALESCE(p_incident_id::text, ''),
      'screen_surface_id', 'S-6.5.1-POLICY-PARSE',
      'idempotency_key',   COALESCE(p_idempotency_key, ''),
      'trace_id',          v_trace
    );
    v_emit := emit_event(
      p_event_type := 'policy_parse_suppressed', p_feature_id := 'F-6.5.1',
      p_scope_type := 'incident', p_scope_id := p_incident_id,
      p_actor_id := p_actor_id, p_actor_type := 'user',
      p_reason_code := 'FEATURE_DISABLED', p_metadata := v_meta
    );
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.1','reason_code','FEATURE_DISABLED','next_step_hint','Enable F-6.5.1 via set_feature_activation_state');
  END IF;

  RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.1','reason_code','FEATURE_DISABLED','next_step_hint','Implementation pending');
END;
$$;

GRANT EXECUTE ON FUNCTION invoke_policy_parse(uuid, uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_policy_parse(uuid, uuid, uuid, text, uuid, text) FROM anon;

-- =====================================================
-- Stub RPC: invoke_coverage_graph (F-6.5.2)
-- =====================================================

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
  v_guard  jsonb;
  v_gate   jsonb;
  v_meta   jsonb;
  v_emit   jsonb;
  v_trace  text := COALESCE(p_trace_id, gen_random_uuid()::text);
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.2', 'coverage_graph_build');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.2','attempted_action','coverage_graph_build','reason_code','MODE_RESTRICTED',
      'next_step_hint','Wait for NORMAL mode to build coverage graphs',
      'scope_type','incident','scope_id',COALESCE(p_incident_id::text,''),
      'screen_surface_id','S-6.5.2-COVERAGE-GRAPH','idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace,'mode',v_guard->>'mode'
    );
    PERFORM emit_event(p_event_type:='coverage_graph_suppressed',p_feature_id:='F-6.5.2',p_scope_type:='incident',p_scope_id:=p_incident_id,p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='MODE_RESTRICTED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.2','reason_code','MODE_RESTRICTED','next_step_hint','Wait for NORMAL mode');
  END IF;

  v_gate := check_feature_gate('F-6.5.2', p_region_id);
  IF NOT (v_gate->>'enabled')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.2','attempted_action','coverage_graph_build','reason_code','FEATURE_DISABLED',
      'next_step_hint','Enable F-6.5.2 via set_feature_activation_state to activate Coverage Graph',
      'scope_type','incident','scope_id',COALESCE(p_incident_id::text,''),
      'screen_surface_id','S-6.5.2-COVERAGE-GRAPH','idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace
    );
    PERFORM emit_event(p_event_type:='coverage_graph_suppressed',p_feature_id:='F-6.5.2',p_scope_type:='incident',p_scope_id:=p_incident_id,p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='FEATURE_DISABLED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.2','reason_code','FEATURE_DISABLED','next_step_hint','Enable F-6.5.2 via set_feature_activation_state');
  END IF;

  RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.2','reason_code','FEATURE_DISABLED','next_step_hint','Implementation pending');
END;
$$;

GRANT EXECUTE ON FUNCTION invoke_coverage_graph(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_coverage_graph(uuid, uuid, text, uuid, text) FROM anon;

-- =====================================================
-- Stub RPC: invoke_disruption_ingest (F-6.5.4)
-- =====================================================

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
  v_guard  jsonb;
  v_gate   jsonb;
  v_meta   jsonb;
  v_trace  text := COALESCE(p_trace_id, gen_random_uuid()::text);
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'F-6.5.4', 'disruption_ingest');
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.4','attempted_action','disruption_ingest','reason_code','MODE_RESTRICTED',
      'next_step_hint','Wait for NORMAL mode before ingesting disruption signals',
      'scope_type','incident','scope_id',COALESCE(p_incident_id::text,''),
      'screen_surface_id','S-6.5.4-DISRUPTION','idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace,'mode',v_guard->>'mode'
    );
    PERFORM emit_event(p_event_type:='disruption_ingest_suppressed',p_feature_id:='F-6.5.4',p_scope_type:='incident',p_scope_id:=p_incident_id,p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='MODE_RESTRICTED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.4','reason_code','MODE_RESTRICTED','next_step_hint','Wait for NORMAL mode');
  END IF;

  v_gate := check_feature_gate('F-6.5.4', p_region_id);
  IF NOT (v_gate->>'enabled')::boolean THEN
    v_meta := jsonb_build_object(
      'feature_id','F-6.5.4','attempted_action','disruption_ingest','reason_code','FEATURE_DISABLED',
      'next_step_hint','Enable F-6.5.4 via set_feature_activation_state to activate Airline Disruption Intelligence',
      'scope_type','incident','scope_id',COALESCE(p_incident_id::text,''),
      'screen_surface_id','S-6.5.4-DISRUPTION','idempotency_key',COALESCE(p_idempotency_key,''),'trace_id',v_trace
    );
    PERFORM emit_event(p_event_type:='disruption_ingest_suppressed',p_feature_id:='F-6.5.4',p_scope_type:='incident',p_scope_id:=p_incident_id,p_actor_id:=p_actor_id,p_actor_type:='user',p_reason_code:='FEATURE_DISABLED',p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.4','reason_code','FEATURE_DISABLED','next_step_hint','Enable F-6.5.4 via set_feature_activation_state');
  END IF;

  RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id','F-6.5.4','reason_code','FEATURE_DISABLED','next_step_hint','Implementation pending');
END;
$$;

GRANT EXECUTE ON FUNCTION invoke_disruption_ingest(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_disruption_ingest(uuid, uuid, text, uuid, text) FROM anon;

-- =====================================================
-- Generic Stub RPC Factory: invoke_feature_stub(feature_id, ...)
-- Used by remaining 14 features to avoid repetition
-- =====================================================

CREATE OR REPLACE FUNCTION invoke_feature_stub(
  p_feature_id      text,
  p_attempted_action text,
  p_suppression_event text,
  p_screen_surface_id text,
  p_incident_id     uuid    DEFAULT NULL,
  p_actor_id        uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_trace_id        text    DEFAULT NULL,
  p_extra_clarity   jsonb   DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard  jsonb;
  v_gate   jsonb;
  v_meta   jsonb;
  v_trace  text := COALESCE(p_trace_id, gen_random_uuid()::text);
  v_reason text;
  v_hint   text;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, p_feature_id, p_attempted_action);
  IF NOT (v_guard->>'allowed')::boolean THEN
    v_reason := 'MODE_RESTRICTED';
    v_hint   := 'Current region operational mode (' || get_mode_display_name(v_guard->>'mode') || ') does not permit ' || p_attempted_action || '. Wait for mode to change.';
    v_meta   := jsonb_build_object(
      'feature_id', p_feature_id, 'attempted_action', p_attempted_action,
      'reason_code', v_reason, 'next_step_hint', v_hint,
      'scope_type', 'incident', 'scope_id', COALESCE(p_incident_id::text,''),
      'screen_surface_id', p_screen_surface_id,
      'idempotency_key', COALESCE(p_idempotency_key,''), 'trace_id', v_trace,
      'mode', v_guard->>'mode'
    ) || p_extra_clarity;
    PERFORM emit_event(p_event_type:=p_suppression_event, p_feature_id:=p_feature_id,
      p_scope_type:='incident', p_scope_id:=p_incident_id,
      p_actor_id:=p_actor_id, p_actor_type:='user',
      p_reason_code:=v_reason, p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id',p_feature_id,'reason_code',v_reason,'next_step_hint',v_hint);
  END IF;

  v_gate := check_feature_gate(p_feature_id, p_region_id);
  IF NOT (v_gate->>'enabled')::boolean THEN
    v_reason := 'FEATURE_DISABLED';
    v_hint   := 'Enable ' || p_feature_id || ' via set_feature_activation_state to activate this feature.';
    v_meta   := jsonb_build_object(
      'feature_id', p_feature_id, 'attempted_action', p_attempted_action,
      'reason_code', v_reason, 'next_step_hint', v_hint,
      'scope_type', 'incident', 'scope_id', COALESCE(p_incident_id::text,''),
      'screen_surface_id', p_screen_surface_id,
      'idempotency_key', COALESCE(p_idempotency_key,''), 'trace_id', v_trace
    ) || p_extra_clarity;
    PERFORM emit_event(p_event_type:=p_suppression_event, p_feature_id:=p_feature_id,
      p_scope_type:='incident', p_scope_id:=p_incident_id,
      p_actor_id:=p_actor_id, p_actor_type:='user',
      p_reason_code:=v_reason, p_metadata:=v_meta);
    RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id',p_feature_id,'reason_code',v_reason,'next_step_hint',v_hint);
  END IF;

  RETURN jsonb_build_object('ok',false,'status','SUPPRESSED','feature_id',p_feature_id,'reason_code','FEATURE_DISABLED','next_step_hint','Implementation pending — feature enabled but not yet built');
END;
$$;

GRANT EXECUTE ON FUNCTION invoke_feature_stub(text, text, text, text, uuid, uuid, text, uuid, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_feature_stub(text, text, text, text, uuid, uuid, text, uuid, text, jsonb) FROM anon;

-- =====================================================
-- Named Stub RPCs for remaining 14 features
-- Each delegates to invoke_feature_stub with correct params
-- =====================================================

CREATE OR REPLACE FUNCTION invoke_timeline_enrich(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.5.7-ENRICH','timeline_enrich','timeline_enrich_suppressed','S-6.5.7-ENRICH',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_timeline_enrich(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_timeline_enrich(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_causality_link(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.5.8','causality_link','causality_link_suppressed','S-6.5.8-CAUSALITY',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_causality_link(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_causality_link(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_rebooking_log(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.5.9','rebooking_log','rebooking_log_suppressed','S-6.5.9-REBOOKING',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_rebooking_log(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_rebooking_log(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_carrier_discrepancy(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.5.10','carrier_discrepancy_check','carrier_discrepancy_suppressed','S-6.5.10-DISCREPANCY',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_carrier_discrepancy(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_carrier_discrepancy(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_rair_report(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.5.11','rair_report_generate','rair_report_suppressed','S-6.5.11-RAIR',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_rair_report(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_rair_report(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_authority_disruption(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.5.12','authority_disruption_ingest','authority_disruption_suppressed','S-6.5.12-AUTHORITY',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_authority_disruption(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_authority_disruption(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_itinerary_risk(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.5.13','itinerary_risk_model','itinerary_risk_suppressed','S-6.5.13-RISK',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_itinerary_risk(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_itinerary_risk(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_claim_packet(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.5.14','claim_packet_generate','claim_packet_suppressed','S-6.5.14-CLAIM-PACKET',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_claim_packet(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_claim_packet(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_carrier_deeplink(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-CARRIER-DEEP','carrier_deeplink_resolve','carrier_deeplink_suppressed','S-CARRIER-DEEP',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_carrier_deeplink(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_carrier_deeplink(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_claim_progress(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.5.15','claim_progress_sync','claim_progress_suppressed','S-6.5.15-PROGRESS',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_claim_progress(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_claim_progress(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_dcel_enrich(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.6.1','dcel_enrich','dcel_enrich_suppressed','S-6.6.1-DCEL',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_dcel_enrich(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_dcel_enrich(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_financial_model(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-6.6.9','financial_model_run','financial_model_suppressed','S-6.6.9-FINANCIAL',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_financial_model(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_financial_model(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_voice_capture(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-7.4','voice_capture','voice_capture_suppressed','S-7.4-VOICE',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_voice_capture(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_voice_capture(uuid, uuid, text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION invoke_pipeline_ingest(p_incident_id uuid DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN invoke_feature_stub('F-12.3','pipeline_ingest','pipeline_ingest_suppressed','S-12.3-PIPELINE',p_incident_id,p_actor_id,p_idempotency_key,p_region_id,p_trace_id,'{}');
END; $$;
GRANT EXECUTE ON FUNCTION invoke_pipeline_ingest(uuid, uuid, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION invoke_pipeline_ingest(uuid, uuid, text, uuid, text) FROM anon;
