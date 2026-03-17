/*
  # Incident Timeline View + Screen Surface Registry + Reason Code Registry (F-6.5.7, 7.3, 8.4, 12.5)

  ## Summary

  ## A. Incident Timeline View (F-6.5.7)
  Projects event_ledger into an ordered incident timeline read model.
  Derived from event_ledger only — no new mutable state.
  Exposes: incident_id, timeline_order (ordinal), event_type, feature_id,
  event_summary, actor_type, reason_code, confidence_label, happened_at, metadata.

  ## B. Screen Surface Registry (7.3)
  Seeds the traveler-facing screen surfaces used by this slice.

  ### screen_surface_registry
  - surface_id (PK), feature_id, surface_label, route_path, required_data_deps,
    confidence_required (min confidence_label for display), created_at

  ## C. Reason Code Registry additions (8.4)
  Additional reason codes for all new mutation paths in this slice.

  ## D. Deterministic Comms helpers
  Helper function get_confidence_label_text(confidence_label) → user-displayable text.
  Helper function build_founder_readable_explanation(reason_codes, confidence_label, context) → text.
*/

-- =====================================================
-- A. Incident Timeline View
-- =====================================================

CREATE OR REPLACE VIEW incident_timeline AS
SELECT
  el.scope_id                                                    AS incident_id,
  ROW_NUMBER() OVER (PARTITION BY el.scope_id ORDER BY el.created_at ASC) AS timeline_order,
  el.id                                                          AS event_id,
  el.event_type,
  el.feature_id,
  el.reason_code,
  el.actor_type,
  COALESCE(el.metadata->>'confidence_label', '')                 AS confidence_label,
  CASE
    WHEN el.event_type = 'incident_created'                   THEN 'Incident opened'
    WHEN el.event_type = 'incident_status_changed'            THEN 'Status changed to ' || COALESCE(el.resulting_state->>'status', '?')
    WHEN el.event_type = 'evidence_upload_staged'             THEN 'Evidence staged: ' || COALESCE(el.metadata->>'name', 'unnamed')
    WHEN el.event_type = 'evidence_validation_completed'      THEN 'Evidence validated: ' || COALESCE(el.resulting_state->>'result', '?')
    WHEN el.event_type = 'guide_version_ingested'             THEN 'Benefit guide ingested: ' || COALESCE(el.metadata->>'title', '?')
    WHEN el.event_type = 'consent_granted'                    THEN 'Consent granted for guide ' || COALESCE(el.metadata->>'guide_id', '?')
    WHEN el.event_type = 'consent_revoked'                    THEN 'Consent revoked: ' || COALESCE(el.reason_code, '?')
    WHEN el.event_type = 'benefit_eval_completed'             THEN 'Benefit evaluation: ' || COALESCE(el.resulting_state->>'overall_result', '?')
    WHEN el.event_type = 'routing_recommendation_generated'   THEN 'Routing recommendation generated'
    WHEN el.event_type = 'routing_recommendation_accepted'    THEN 'Routing recommendation accepted'
    WHEN el.event_type = 'routing_recommendation_rejected'    THEN 'Routing recommendation rejected: ' || COALESCE(el.reason_code, '?')
    WHEN el.event_type = 'acceptance_checkpoint_recorded'     THEN 'Checkpoint recorded: ' || COALESCE(el.metadata->>'action', '?')
    WHEN el.event_type = 'interpretive_output_emitted'        THEN 'ITR emitted (confidence: ' || COALESCE(el.metadata->>'confidence_enum', '?') || ')'
    ELSE el.event_type
  END                                                            AS event_summary,
  el.resulting_state,
  el.metadata                                                    AS event_metadata,
  el.created_at                                                  AS happened_at
FROM event_ledger el
WHERE el.scope_type = 'incident'
  AND el.scope_id IS NOT NULL
ORDER BY el.scope_id, el.created_at ASC;

-- =====================================================
-- B. Screen Surface Registry (7.3)
-- =====================================================

CREATE TABLE IF NOT EXISTS screen_surface_registry (
  surface_id          text PRIMARY KEY,
  feature_id          text NOT NULL REFERENCES feature_registry(feature_id),
  surface_label       text NOT NULL,
  route_path          text NOT NULL,
  required_data_deps  text[] NOT NULL DEFAULT '{}',
  confidence_required text NOT NULL DEFAULT 'low',
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT screen_surface_confidence_valid CHECK (
    confidence_required IN ('high','medium','low','insufficient_data','conflicted','any')
  )
);

ALTER TABLE screen_surface_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read screen surfaces"
  ON screen_surface_registry FOR SELECT TO authenticated USING (true);

INSERT INTO screen_surface_registry (surface_id, feature_id, surface_label, route_path, required_data_deps, confidence_required) VALUES
  ('S-6.5.3-GUIDE-LIST',    'F-6.5.3', 'Benefit Guide Library',          '/traveler/guides',                    ARRAY['credit_card_guide_versions'],      'any'),
  ('S-6.5.3-GUIDE-DETAIL',  'F-6.5.3', 'Benefit Guide Detail',           '/traveler/guides/:guide_id',          ARRAY['benefit_clauses','consent_tokens'], 'any'),
  ('S-6.5.3-CONSENT',       'F-6.5.3', 'Consent Capture',                '/traveler/guides/:guide_id/consent',  ARRAY['consent_tokens'],                  'any'),
  ('S-6.5.3-EVAL-RESULT',   'F-6.5.3', 'Benefit Evaluation Result',      '/traveler/incidents/:id/benefit-eval',ARRAY['benefit_eval_runs'],               'low'),
  ('S-6.5.5-ROUTING',       'F-6.5.5', 'Claim Routing Recommendation',   '/traveler/incidents/:id/routing',     ARRAY['routing_recommendations'],          'medium'),
  ('S-6.5.5-CHECKPOINT',    'F-6.5.5', 'Acceptance Checkpoint',          '/traveler/incidents/:id/checkpoint',  ARRAY['acceptance_checkpoints'],           'low'),
  ('S-6.5.6-EVIDENCE-LIST', 'F-6.5.6', 'Evidence Manager',               '/traveler/incidents/:id/evidence',    ARRAY['evidence'],                        'any'),
  ('S-6.5.6-EVIDENCE-ADD',  'F-6.5.6', 'Add Evidence',                   '/traveler/incidents/:id/evidence/add',ARRAY['evidence'],                        'any'),
  ('S-6.5.7-TIMELINE',      'F-6.5.7', 'Incident Timeline',              '/traveler/incidents/:id/timeline',    ARRAY['incident_timeline'],               'any')
ON CONFLICT (surface_id) DO NOTHING;

-- =====================================================
-- C. Reason Code Registry additions
-- =====================================================

INSERT INTO reason_code_registry (reason_code, description) VALUES
  ('guide_ingest_ok',              'Guide version successfully ingested and activated'),
  ('guide_ingest_duplicate',       'Guide ingest skipped: identical content_hash already active'),
  ('consent_granted_ok',           'Traveler consent granted for benefit guide'),
  ('consent_already_active',       'Consent idempotent: already active for this incident+guide'),
  ('consent_revoked_ok',           'Traveler consent revoked'),
  ('consent_not_found',            'Revocation failed: no active consent found'),
  ('benefit_eval_eligible',        'Evaluation determined benefit coverage is eligible'),
  ('benefit_eval_ineligible',      'Evaluation determined benefit coverage is not eligible'),
  ('benefit_eval_uncertain',       'Evaluation result uncertain: insufficient evidence or conflicting clauses'),
  ('benefit_eval_no_consent',      'Evaluation blocked: no active consent for this guide'),
  ('routing_generated_ok',         'Routing recommendation generated successfully'),
  ('routing_no_eligible_path',     'Routing failed: no eligible routing path found for incident'),
  ('routing_accepted_ok',          'Traveler accepted routing recommendation'),
  ('routing_rejected_ok',          'Traveler rejected routing recommendation'),
  ('checkpoint_recorded_ok',       'Acceptance checkpoint recorded'),
  ('evidence_validated_ok',        'Evidence validation completed successfully'),
  ('evidence_validation_failed',   'Evidence validation failed: see findings for detail'),
  ('feature_not_enabled',          'Operation blocked: feature not enabled in current region mode'),
  ('feature_activated_ok',         'Feature activation state updated by founder'),
  ('founder_offline_degraded',     'Operation recorded in degraded mode: founder offline posture active'),
  ('focl_degraded_safe',           'FOCL: system degraded safely, no critical failures during founder offline window')
ON CONFLICT (reason_code) DO NOTHING;

-- =====================================================
-- D. Deterministic Comms Helpers (7.8 / 9.2)
-- =====================================================

CREATE OR REPLACE FUNCTION get_confidence_label_text(p_label confidence_label)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN CASE p_label
    WHEN 'high'              THEN 'We are highly confident in this assessment'
    WHEN 'medium'            THEN 'We have moderate confidence in this assessment; additional evidence may refine it'
    WHEN 'low'               THEN 'Our confidence is limited; this is a preliminary assessment only'
    WHEN 'insufficient_data' THEN 'Insufficient data to assess at this time'
    WHEN 'conflicted'        THEN 'Conflicting signals detected; manual review recommended'
    ELSE 'Confidence unknown'
  END;
END;
$$;

CREATE OR REPLACE FUNCTION build_founder_readable_explanation(
  p_reason_codes   text[],
  p_confidence     confidence_label,
  p_context        jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lines text[] := '{}';
  v_rc    text;
  v_desc  text;
BEGIN
  v_lines := array_append(v_lines, 'Decision context:');
  v_lines := array_append(v_lines, '  Confidence: ' || get_confidence_label_text(p_confidence));

  IF array_length(p_reason_codes, 1) > 0 THEN
    v_lines := array_append(v_lines, '  Reason codes:');
    FOREACH v_rc IN ARRAY p_reason_codes LOOP
      SELECT description INTO v_desc FROM reason_code_registry WHERE reason_code = v_rc;
      v_lines := array_append(v_lines, '    - ' || v_rc || COALESCE(': ' || v_desc, ''));
    END LOOP;
  END IF;

  IF p_context IS NOT NULL AND p_context <> '{}'::jsonb THEN
    v_lines := array_append(v_lines, '  Context: ' || p_context::text);
  END IF;

  RETURN array_to_string(v_lines, E'\n');
END;
$$;

GRANT EXECUTE ON FUNCTION get_confidence_label_text(confidence_label) TO authenticated;
GRANT EXECUTE ON FUNCTION build_founder_readable_explanation(text[], confidence_label, jsonb) TO authenticated;
