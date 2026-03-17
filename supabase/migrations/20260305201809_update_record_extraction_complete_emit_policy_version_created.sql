/*
  # Update record_extraction_complete to emit policy_version_created
  
  1. Changes
    - Add policy_version_created event emission after creating policy_version
    - Ensures audit trail includes version creation milestone
  
  2. Event Details
    - Emitted when all clauses are HIGH/CONDITIONAL confidence
    - Contains version_id, clause_count, and pipeline metadata
*/

CREATE OR REPLACE FUNCTION record_extraction_complete(
  p_document_id        uuid,
  p_clauses            jsonb,
  p_model_version      text,
  p_pipeline_version   text,
  p_ocr_engine_version text,
  p_itr_trace_id       uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_document       policy_documents%ROWTYPE;
  v_clause         jsonb;
  v_clause_id      uuid;
  v_pending_count  integer := 0;
  v_accepted_count integer := 0;
  v_version_id     uuid;
  v_policy_id      uuid;
  v_emit           jsonb;
BEGIN
  SELECT * INTO v_document FROM policy_documents WHERE document_id = p_document_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'DOCUMENT_NOT_FOUND');
  END IF;

  v_policy_id := v_document.policy_id;

  UPDATE policy_documents
  SET
    document_status = 'processing',
    extraction_started_at = now(),
    model_version = p_model_version,
    pipeline_version = p_pipeline_version,
    ocr_engine_version = p_ocr_engine_version
  WHERE document_id = p_document_id;

  FOR v_clause IN SELECT * FROM jsonb_array_elements(p_clauses)
  LOOP
    IF v_clause->>'source_citation' IS NULL OR length(trim(v_clause->>'source_citation')) = 0 THEN
      v_emit := emit_event(
        p_event_type     := 'extraction_hallucination_blocked',
        p_feature_id     := 'F-6.5.1',
        p_scope_type     := 'policy_document',
        p_scope_id       := p_document_id,
        p_actor_id       := v_document.account_id,
        p_actor_type     := 'system',
        p_reason_code    := 'MISSING_SOURCE_CITATION',
        p_metadata       := jsonb_build_object('clause_type', v_clause->>'clause_type')
      );
      CONTINUE;
    END IF;

    INSERT INTO policy_clauses (
      policy_document_id,
      clause_type,
      family_code,
      canonical_text,
      source_citation,
      page_number,
      section_path,
      confidence_label,
      extraction_status,
      extracted_by_model
    ) VALUES (
      p_document_id,
      v_clause->>'clause_type',
      v_clause->>'family_code',
      v_clause->>'canonical_text',
      v_clause->>'source_citation',
      (v_clause->>'page_number')::integer,
      v_clause->>'section_path',
      v_clause->>'confidence_label',
      CASE
        WHEN v_clause->>'confidence_label' IN ('HIGH', 'CONDITIONAL') THEN 'AUTO_ACCEPTED'::extraction_status
        ELSE 'PENDING_REVIEW'::extraction_status
      END,
      p_model_version
    )
    RETURNING clause_id INTO v_clause_id;

    IF v_clause->>'confidence_label' NOT IN ('HIGH', 'CONDITIONAL') THEN
      v_pending_count := v_pending_count + 1;
      
      INSERT INTO clause_review_queue (
        clause_id,
        policy_document_id,
        status,
        priority,
        sla_deadline
      ) VALUES (
        v_clause_id,
        p_document_id,
        'open',
        CASE
          WHEN v_clause->>'clause_type' IN ('coverage_trigger', 'exclusion') THEN 1
          WHEN v_clause->>'clause_type' IN ('benefit_limit', 'deductible') THEN 2
          ELSE 5
        END,
        now() + interval '48 hours'
      );
    ELSE
      v_accepted_count := v_accepted_count + 1;
    END IF;
  END LOOP;

  IF v_pending_count > 0 THEN
    UPDATE policy_documents
    SET
      document_status = 'partial',
      extraction_completed_at = now()
    WHERE document_id = p_document_id;

    v_emit := emit_event(
      p_event_type     := 'policy_parse_partial',
      p_feature_id     := 'F-6.5.1',
      p_scope_type     := 'policy_document',
      p_scope_id       := p_document_id,
      p_actor_id       := v_document.account_id,
      p_actor_type     := 'system',
      p_reason_code    := 'MANUAL_REVIEW_REQUIRED',
      p_metadata       := jsonb_build_object(
        'pending_count', v_pending_count,
        'accepted_count', v_accepted_count
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'PARTIAL',
      'pending_count', v_pending_count,
      'accepted_count', v_accepted_count
    );
  ELSE
    UPDATE policy_documents
    SET
      document_status = 'complete',
      extraction_completed_at = now()
    WHERE document_id = p_document_id;

    INSERT INTO policy_versions (
      policy_id,
      version_number,
      content_hash,
      normalization_pipeline_version,
      confidence_tier,
      source_type,
      raw_artifact_path,
      ingested_by,
      itr_trace_id
    ) VALUES (
      v_policy_id,
      1,
      md5(p_clauses::text),
      p_pipeline_version,
      'HIGH',
      v_document.source_type,
      v_document.raw_artifact_path,
      v_document.account_id,
      p_itr_trace_id
    )
    RETURNING version_id INTO v_version_id;

    UPDATE policy_clauses
    SET policy_version_id = v_version_id
    WHERE policy_document_id = p_document_id;

    UPDATE policies
    SET active_version_id = v_version_id
    WHERE policy_id = v_policy_id;

    v_emit := emit_event(
      p_event_type     := 'policy_version_created',
      p_feature_id     := 'F-6.5.1',
      p_scope_type     := 'policy_version',
      p_scope_id       := v_version_id,
      p_actor_id       := v_document.account_id,
      p_actor_type     := 'system',
      p_reason_code    := 'EXTRACTION_COMPLETE',
      p_metadata       := jsonb_build_object(
        'policy_id', v_policy_id,
        'version_number', 1,
        'clause_count', v_accepted_count,
        'model_version', p_model_version,
        'pipeline_version', p_pipeline_version,
        'itr_trace_id', p_itr_trace_id
      )
    );

    v_emit := emit_event(
      p_event_type     := 'policy_parse_complete',
      p_feature_id     := 'F-6.5.1',
      p_scope_type     := 'policy',
      p_scope_id       := v_policy_id,
      p_actor_id       := v_document.account_id,
      p_actor_type     := 'system',
      p_reason_code    := 'EXTRACTION_SUCCESS',
      p_metadata       := jsonb_build_object(
        'version_id', v_version_id,
        'clause_count', v_accepted_count
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'COMPLETE',
      'version_id', v_version_id,
      'clause_count', v_accepted_count
    );
  END IF;
END; $$;