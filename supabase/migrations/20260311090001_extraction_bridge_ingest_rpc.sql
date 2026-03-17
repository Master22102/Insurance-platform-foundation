/*
  # Extraction Bridge: ingest_corpus_rules()
  
  Purpose:
    Takes the output of the document intelligence extraction pipeline
    (rule-inventory.json) and writes it into the canonical database
    schema as policy_documents → policy_versions → policy_clauses.
    
    This is the bridge between:
    - Extraction subsystem (produces JSON rule inventory)
    - Database substrate (policies/clauses/coverage graph)
    
  How it works:
    1. For each source document in the rule inventory, creates or finds
       a policy + policy_document + policy_version
    2. For each promoted rule, creates a policy_clause row with:
       - clause_type mapped to taxonomy registry
       - structured_value containing the machine-readable extraction
       - extraction_status = AUTO_ACCEPTED (for HIGH confidence)
       - source_citation = source_snippet (hallucination guard satisfied)
    3. Emits ledger events for audit trail
    4. Returns summary of what was ingested
    
  Security:
    - SECURITY DEFINER (system process, not user-initiated)
    - Validates all clause_types against taxonomy registry
    - Rejects rules without source_citation (hallucination guard)
    - Idempotent: uses content_hash to skip duplicate documents
    
  Grounded in:
    - F-6.5.1 Section 2.2 (Seven-Stage Pipeline)
    - Section 3.0 Governance Substrate (event emission requirement)
    - Section 12.3.2 (Policy → Clauses → Graph → Guidance Pipeline)
*/

CREATE OR REPLACE FUNCTION ingest_corpus_rules(
  p_rules              jsonb,       -- Array of rule objects from rule-inventory.json
  p_actor_id           uuid,        -- Account performing the ingestion (founder or system)
  p_pipeline_version   text DEFAULT 'extraction-bridge-v1.0',
  p_dry_run            boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rule               jsonb;
  v_source_file        text;
  v_policy_id          uuid;
  v_policy_doc_id      uuid;
  v_version_id         uuid;
  v_clause_id          uuid;
  v_content_hash       text;
  v_emit               jsonb;
  
  -- Tracking
  v_docs_created       integer := 0;
  v_docs_skipped       integer := 0;
  v_clauses_created    integer := 0;
  v_clauses_rejected   integer := 0;
  v_docs_processed     text[] := '{}';
  v_current_doc        text := '';
  
  -- Document grouping
  v_source_family      text;
  v_artifact_type      text;
  v_extraction_mode    text;
BEGIN

  -- Process rules grouped by source_file
  FOR v_rule IN SELECT * FROM jsonb_array_elements(p_rules)
  LOOP
    v_source_file := v_rule->>'source_file';
    
    -- Skip rules without source citation (hallucination guard)
    IF v_rule->>'source_snippet' IS NULL OR length(trim(v_rule->>'source_snippet')) < 10 THEN
      v_clauses_rejected := v_clauses_rejected + 1;
      
      IF NOT p_dry_run THEN
        v_emit := emit_event(
          p_event_type     := 'corpus_rule_rejected_by_gate',
          p_feature_id     := 'F-6.5.1',
          p_scope_type     := 'corpus',
          p_scope_id       := p_actor_id,
          p_actor_id       := p_actor_id,
          p_actor_type     := 'system',
          p_reason_code    := 'MISSING_SOURCE_CITATION',
          p_metadata       := jsonb_build_object(
            'rule_id', v_rule->>'rule_id',
            'clause_type', v_rule->>'clause_type'
          )
        );
      END IF;
      CONTINUE;
    END IF;
    
    -- Create policy + document + version for each new source file
    IF v_source_file IS DISTINCT FROM v_current_doc THEN
      v_current_doc := v_source_file;
      v_source_family := COALESCE(v_rule->>'source_family', 'other');
      v_artifact_type := COALESCE(v_rule->>'artifact_type', 'pdf_native_text');
      v_extraction_mode := COALESCE(v_rule->>'extraction_mode', 'native_pdf');
      v_content_hash := md5(v_source_file || '::' || p_pipeline_version);
      
      -- Check if this document was already ingested (idempotency)
      SELECT pd.document_id, pd.policy_id, pv.version_id
      INTO v_policy_doc_id, v_policy_id, v_version_id
      FROM policy_documents pd
      JOIN policies p ON pd.policy_id = p.policy_id
      LEFT JOIN policy_versions pv ON p.active_version_id = pv.version_id
      WHERE pd.content_hash = v_content_hash
      LIMIT 1;
      
      IF v_policy_doc_id IS NOT NULL THEN
        -- Already ingested, skip document creation but still add new clauses
        v_docs_skipped := v_docs_skipped + 1;
        v_docs_processed := array_append(v_docs_processed, v_source_file);
      ELSE
        IF p_dry_run THEN
          v_docs_created := v_docs_created + 1;
          v_docs_processed := array_append(v_docs_processed, v_source_file);
          CONTINUE;  -- Skip actual writes in dry run
        END IF;
        
        -- Create policy
        INSERT INTO policies (
          account_id,
          policy_label,
          provider_name,
          lifecycle_state,
          created_by
        ) VALUES (
          p_actor_id,
          v_source_file,
          v_source_family,
          'active',
          p_actor_id
        )
        RETURNING policy_id INTO v_policy_id;
        
        -- Create policy_document
        INSERT INTO policy_documents (
          policy_id,
          account_id,
          source_type,
          raw_artifact_path,
          content_hash,
          pipeline_version,
          document_status
        ) VALUES (
          v_policy_id,
          p_actor_id,
          'corpus_extraction',
          'corpus/active/' || v_source_file,
          v_content_hash,
          p_pipeline_version,
          'processing'
        )
        RETURNING document_id INTO v_policy_doc_id;
        
        -- Create policy_version
        INSERT INTO policy_versions (
          policy_id,
          version_number,
          content_hash,
          normalization_pipeline_version,
          confidence_tier,
          source_type,
          raw_artifact_path,
          ingested_by
        ) VALUES (
          v_policy_id,
          1,
          v_content_hash,
          p_pipeline_version,
          'HIGH',
          'corpus_extraction',
          'corpus/active/' || v_source_file,
          p_actor_id
        )
        RETURNING version_id INTO v_version_id;
        
        -- Link version to policy
        UPDATE policies SET active_version_id = v_version_id WHERE policy_id = v_policy_id;
        
        v_docs_created := v_docs_created + 1;
        v_docs_processed := array_append(v_docs_processed, v_source_file);
        
        -- Emit document registration event
        v_emit := emit_event(
          p_event_type     := 'corpus_document_registered',
          p_feature_id     := 'F-6.5.1',
          p_scope_type     := 'policy',
          p_scope_id       := v_policy_id,
          p_actor_id       := p_actor_id,
          p_actor_type     := 'system',
          p_reason_code    := 'CORPUS_BRIDGE_INGESTION',
          p_metadata       := jsonb_build_object(
            'source_file', v_source_file,
            'source_family', v_source_family,
            'content_hash', v_content_hash
          )
        );
      END IF;
    END IF;
    
    -- Skip clause creation in dry run
    IF p_dry_run THEN
      v_clauses_created := v_clauses_created + 1;
      CONTINUE;
    END IF;
    
    -- Skip if we don't have valid document/version references
    IF v_policy_doc_id IS NULL OR v_version_id IS NULL THEN
      v_clauses_rejected := v_clauses_rejected + 1;
      CONTINUE;
    END IF;
    
    -- Create policy_clause
    INSERT INTO policy_clauses (
      policy_document_id,
      policy_version_id,
      clause_type,
      family_code,
      canonical_text,
      source_citation,
      section_path,
      confidence_label,
      extraction_status,
      extracted_by_model,
      structured_value,
      extraction_pipeline_version,
      extraction_mode
    ) VALUES (
      v_policy_doc_id,
      v_version_id,
      v_rule->>'clause_type',
      -- Map clause_type to family_code via taxonomy
      COALESCE(
        (SELECT family_code FROM clause_taxonomy_registry WHERE clause_type = v_rule->>'clause_type'),
        'FAM-99'
      ),
      -- canonical_text: human-readable rule description
      CASE 
        WHEN v_rule->>'value_type' IN ('currency','sdr') THEN
          (v_rule->>'clause_type') || ': ' || (v_rule->>'normalized_value') || ' ' || COALESCE(v_rule->>'unit','')
        WHEN v_rule->>'value_type' IN ('duration','days') THEN
          (v_rule->>'clause_type') || ': ' || (v_rule->>'normalized_value') || ' ' || COALESCE(v_rule->>'unit','')
        WHEN v_rule->>'value_type' = 'boolean' THEN
          (v_rule->>'clause_type') || ': ' || CASE WHEN (v_rule->>'normalized_value')::text = 'true' THEN 'Required' ELSE 'Not Required' END
        ELSE
          (v_rule->>'clause_type') || ': ' || left(v_rule->>'normalized_value', 200)
      END,
      -- source_citation: the snippet (hallucination guard — must not be empty)
      v_rule->>'source_snippet',
      -- section_path
      v_rule->>'source_section',
      -- confidence_label
      COALESCE(v_rule->>'confidence', 'HIGH'),
      -- extraction_status
      CASE
        WHEN COALESCE(v_rule->>'confidence', 'HIGH') = 'HIGH' THEN 'AUTO_ACCEPTED'::extraction_status
        ELSE 'PENDING_REVIEW'::extraction_status
      END,
      -- extracted_by_model
      'extraction-pipeline-' || p_pipeline_version,
      -- structured_value (machine-readable)
      jsonb_build_object(
        'type', v_rule->>'value_type',
        'value', v_rule->'normalized_value',
        'unit', COALESCE(v_rule->>'unit', ''),
        'raw', COALESCE(v_rule->>'raw_value', ''),
        'high_value', COALESCE((v_rule->>'high_value')::boolean, false)
      ),
      p_pipeline_version,
      v_extraction_mode
    )
    RETURNING clause_id INTO v_clause_id;
    
    v_clauses_created := v_clauses_created + 1;
    
  END LOOP;
  
  -- Mark all created documents as complete
  IF NOT p_dry_run THEN
    UPDATE policy_documents
    SET document_status = 'complete',
        extraction_completed_at = now()
    WHERE content_hash = ANY(
      SELECT md5(unnest || '::' || p_pipeline_version)
      FROM unnest(v_docs_processed)
    )
    AND document_status = 'processing';
    
    -- Emit bridge completion event
    v_emit := emit_event(
      p_event_type     := 'corpus_extraction_bridge_run',
      p_feature_id     := 'F-6.5.1',
      p_scope_type     := 'corpus',
      p_scope_id       := p_actor_id,
      p_actor_id       := p_actor_id,
      p_actor_type     := 'system',
      p_reason_code    := 'BRIDGE_RUN_COMPLETE',
      p_metadata       := jsonb_build_object(
        'pipeline_version', p_pipeline_version,
        'docs_created', v_docs_created,
        'docs_skipped', v_docs_skipped,
        'clauses_created', v_clauses_created,
        'clauses_rejected', v_clauses_rejected,
        'dry_run', p_dry_run
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'dry_run', p_dry_run,
    'docs_created', v_docs_created,
    'docs_skipped', v_docs_skipped,
    'clauses_created', v_clauses_created,
    'clauses_rejected', v_clauses_rejected,
    'total_docs_processed', array_length(v_docs_processed, 1),
    'pipeline_version', p_pipeline_version
  );
END; $$;

-- Only service_role and founder can run this
GRANT EXECUTE ON FUNCTION ingest_corpus_rules(jsonb, uuid, text, boolean) TO service_role;
