/*
  Enforce strict enqueue behavior for policy parsing:
  - document update + job_queue insert + event emit are atomic
  - any failure rolls back the mutation
*/

CREATE OR REPLACE FUNCTION enqueue_policy_parse_job_atomic(
  p_document_id uuid,
  p_account_id uuid,
  p_storage_path text,
  p_policy_label text,
  p_trip_id uuid DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_file_size_bytes bigint DEFAULT NULL,
  p_mime_type text DEFAULT NULL,
  p_content_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_doc policy_documents%ROWTYPE;
  v_job_id uuid;
  v_emit jsonb;
BEGIN
  SELECT *
  INTO v_doc
  FROM policy_documents
  WHERE document_id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'DOCUMENT_NOT_FOUND');
  END IF;

  IF v_doc.account_id <> p_account_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'FORBIDDEN');
  END IF;

  UPDATE policy_documents
  SET
    raw_artifact_path = p_storage_path,
    file_size_bytes = COALESCE(p_file_size_bytes, file_size_bytes),
    mime_type = COALESCE(p_mime_type, mime_type),
    content_hash = COALESCE(p_content_hash, content_hash),
    document_status = 'queued',
    updated_at = now()
  WHERE document_id = p_document_id;

  INSERT INTO job_queue (
    job_name,
    job_type,
    payload,
    status,
    max_retries
  )
  VALUES (
    'extract-' || p_document_id::text,
    'policy_parse',
    jsonb_build_object(
      'document_id', p_document_id,
      'policy_id', v_doc.policy_id,
      'account_id', p_account_id,
      'trip_id', COALESCE(p_trip_id, v_doc.trip_id),
      'storage_path', p_storage_path,
      'original_filename', p_policy_label,
      'source_type', p_source_type
    ),
    'pending',
    3
  )
  RETURNING id INTO v_job_id;

  v_emit := emit_event(
    p_event_type := 'policy_parse_queued',
    p_feature_id := 'F-6.5.1',
    p_scope_type := 'policy_document',
    p_scope_id := p_document_id,
    p_actor_id := p_account_id,
    p_actor_type := 'system',
    p_reason_code := 'UPLOAD_CONFIRMED',
    p_metadata := jsonb_build_object(
      'job_id', v_job_id,
      'policy_id', v_doc.policy_id
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', v_job_id,
    'policy_id', v_doc.policy_id,
    'document_id', p_document_id,
    'status', 'QUEUED'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION enqueue_policy_parse_job_atomic(
  uuid, uuid, text, text, uuid, text, bigint, text, text
) TO service_role;
