/*
  # Guarded Write RPCs: create_incident() and register_evidence()

  ## Summary
  Adds two SECURITY DEFINER RPCs that are the only legal write paths into
  incidents and evidence tables now that direct INSERT RLS policies are removed.

  ## New Functions

  ### create_incident(p_project_id, p_title, p_description, p_classification,
                      p_control_type, p_assigned_to, p_metadata,
                      p_actor_id, p_idempotency_key, p_region_id, p_feature_id)
  - Calls precheck_mutation_guard(region_id, feature_id, 'incident_create')
  - Idempotency: if idempotency_key already in event_ledger, returns existing incident_id
  - INSERTs incident row
  - Emits 'incident_created' via emit_event()
  - Full rollback on emit failure (RAISE EXCEPTION propagates)

  ### register_evidence(p_incident_id, p_type, p_name, p_description,
                        p_file_path, p_file_size_bytes, p_mime_type,
                        p_hash_sha256, p_metadata,
                        p_actor_id, p_idempotency_key, p_region_id, p_feature_id)
  - Calls precheck_mutation_guard(region_id, feature_id, 'evidence_upload')
  - Idempotency: if idempotency_key already in event_ledger, returns existing evidence_id
  - Verifies incident exists
  - INSERTs evidence row
  - Emits 'evidence_upload_staged' via emit_event()
  - Full rollback on emit failure (RAISE EXCEPTION propagates)

  ## Security
  - Both are SECURITY DEFINER (run as postgres, bypass RLS)
  - EXECUTE granted to authenticated
  - EXECUTE revoked from anon

  ## Event Type Registry
  - incident_created and evidence_upload_staged registered with feature_id='incidents'
*/

-- =====================================================
-- create_incident()
-- =====================================================

CREATE OR REPLACE FUNCTION create_incident(
  p_project_id      uuid,
  p_title           text,
  p_description     text    DEFAULT '',
  p_classification  text    DEFAULT 'Unknown',
  p_control_type    text    DEFAULT 'Internal',
  p_assigned_to     uuid    DEFAULT NULL,
  p_metadata        jsonb   DEFAULT '{}'::jsonb,
  p_actor_id        uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_region_id       uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id      text    DEFAULT 'incidents'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard       jsonb;
  v_incident_id uuid;
  v_emit_result jsonb;
  v_existing_id uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT (el.resulting_state->>'incident_id')::uuid
    INTO v_existing_id
    FROM event_ledger el
    WHERE el.idempotency_key = p_idempotency_key
      AND el.event_type = 'incident_created'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success',     true,
        'incident_id', v_existing_id,
        'idempotent',  true
      );
    END IF;
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, p_feature_id, 'incident_create');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success',        false,
      'error',          'Blocked by governance guard',
      'mode',           v_guard->>'mode',
      'mutation_class', 'incident_create'
    );
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'title is required');
  END IF;
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'project_id is required');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM projects WHERE id = p_project_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'project not found');
  END IF;

  INSERT INTO incidents (
    project_id, title, description,
    classification, control_type,
    assigned_to, metadata,
    created_by, status
  ) VALUES (
    p_project_id, p_title, COALESCE(p_description, ''),
    p_classification::classification, p_control_type::control_type,
    p_assigned_to, COALESCE(p_metadata, '{}'),
    p_actor_id, 'Capture'
  )
  RETURNING id INTO v_incident_id;

  v_emit_result := emit_event(
    p_event_type      := 'incident_created',
    p_feature_id      := p_feature_id,
    p_scope_type      := 'incident',
    p_scope_id        := v_incident_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := 'incident_create',
    p_previous_state  := '{}'::jsonb,
    p_resulting_state := jsonb_build_object(
      'incident_id', v_incident_id,
      'status',      'Capture',
      'project_id',  p_project_id
    ),
    p_metadata        := jsonb_build_object(
      'incident_id',    v_incident_id,
      'title',          p_title,
      'classification', p_classification,
      'control_type',   p_control_type
    ),
    p_idempotency_key := p_idempotency_key
  );

  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for incident_created: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',     true,
    'incident_id', v_incident_id,
    'event_id',    v_emit_result->>'event_id',
    'idempotent',  false
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION create_incident(
  uuid, text, text, text, text, uuid, jsonb, uuid, text, uuid, text
) TO authenticated;
REVOKE EXECUTE ON FUNCTION create_incident(
  uuid, text, text, text, text, uuid, jsonb, uuid, text, uuid, text
) FROM anon;

-- =====================================================
-- register_evidence()
-- =====================================================

CREATE OR REPLACE FUNCTION register_evidence(
  p_incident_id      uuid,
  p_type             text,
  p_name             text,
  p_description      text    DEFAULT '',
  p_file_path        text    DEFAULT NULL,
  p_file_size_bytes  bigint  DEFAULT NULL,
  p_mime_type        text    DEFAULT NULL,
  p_hash_sha256      text    DEFAULT NULL,
  p_metadata         jsonb   DEFAULT '{}'::jsonb,
  p_actor_id         uuid    DEFAULT NULL,
  p_idempotency_key  text    DEFAULT NULL,
  p_region_id        uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id       text    DEFAULT 'incidents'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard       jsonb;
  v_evidence_id uuid;
  v_emit_result jsonb;
  v_existing_id uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT (el.resulting_state->>'evidence_id')::uuid
    INTO v_existing_id
    FROM event_ledger el
    WHERE el.idempotency_key = p_idempotency_key
      AND el.event_type = 'evidence_upload_staged'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success',     true,
        'evidence_id', v_existing_id,
        'idempotent',  true
      );
    END IF;
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, p_feature_id, 'evidence_upload');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success',        false,
      'error',          'Blocked by governance guard',
      'mode',           v_guard->>'mode',
      'mutation_class', 'evidence_upload'
    );
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'name is required');
  END IF;
  IF p_incident_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident_id is required');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM incidents WHERE id = p_incident_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;

  INSERT INTO evidence (
    incident_id, type, name, description,
    file_path, file_size_bytes, mime_type,
    hash_sha256, metadata, created_by
  ) VALUES (
    p_incident_id,
    p_type::evidence_type,
    p_name,
    COALESCE(p_description, ''),
    p_file_path, p_file_size_bytes, p_mime_type,
    p_hash_sha256,
    COALESCE(p_metadata, '{}'),
    p_actor_id
  )
  RETURNING id INTO v_evidence_id;

  v_emit_result := emit_event(
    p_event_type      := 'evidence_upload_staged',
    p_feature_id      := p_feature_id,
    p_scope_type      := 'incident',
    p_scope_id        := p_incident_id,
    p_actor_id        := p_actor_id,
    p_actor_type      := 'user',
    p_reason_code     := 'evidence_upload',
    p_previous_state  := '{}'::jsonb,
    p_resulting_state := jsonb_build_object(
      'evidence_id', v_evidence_id,
      'incident_id', p_incident_id,
      'type',        p_type
    ),
    p_metadata        := jsonb_build_object(
      'evidence_id', v_evidence_id,
      'name',        p_name,
      'type',        p_type,
      'hash_sha256', p_hash_sha256
    ),
    p_idempotency_key := p_idempotency_key
  );

  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for evidence_upload_staged: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',     true,
    'evidence_id', v_evidence_id,
    'event_id',    v_emit_result->>'event_id',
    'idempotent',  false
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION register_evidence(
  uuid, text, text, text, text, bigint, text, text, jsonb, uuid, text, uuid, text
) TO authenticated;
REVOKE EXECUTE ON FUNCTION register_evidence(
  uuid, text, text, text, text, bigint, text, text, jsonb, uuid, text, uuid, text
) FROM anon;

INSERT INTO event_type_registry (event_type, schema_version, feature_id)
VALUES
  ('incident_created',       1, 'incidents'),
  ('evidence_upload_staged', 1, 'incidents')
ON CONFLICT (event_type) DO NOTHING;
