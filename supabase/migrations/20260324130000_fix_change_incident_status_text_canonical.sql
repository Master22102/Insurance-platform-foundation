/*
  incidents.canonical_status is text + CHECK (M-04), not type incident_canonical_status.
  Pass 6 incorrectly cast with ::incident_canonical_status → 42704 at runtime.
  Align UPDATE with the real column type.
*/

CREATE OR REPLACE FUNCTION change_incident_status(
  p_incident_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_reason_code text DEFAULT NULL,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard jsonb;
  v_old_canonical text;
  v_new_canonical text;
  v_evidence_count int;
  v_emit jsonb;
  v_auth_uid uuid;
  v_legacy incident_status;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR p_actor_id IS NULL OR p_actor_id <> v_auth_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_guard := precheck_mutation_guard(p_region_id, 'incidents', 'incident_status_change');
  IF NOT COALESCE((v_guard->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Blocked by governance guard',
      'mode', v_guard->>'mode',
      'mutation_class', 'incident_status_change'
    );
  END IF;

  SELECT canonical_status
  INTO v_old_canonical
  FROM incidents i
  JOIN trips t ON t.trip_id = i.trip_id
  WHERE i.id = p_incident_id
    AND t.created_by = v_auth_uid;

  IF v_old_canonical IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;

  v_new_canonical := upper(trim(p_new_status));
  IF v_new_canonical NOT IN (
    'OPEN',
    'EVIDENCE_GATHERING',
    'REVIEW_PENDING',
    'CLAIM_ROUTING_READY',
    'SUBMITTED',
    'CLOSED',
    'DISPUTED'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid status');
  END IF;

  IF v_old_canonical = v_new_canonical THEN
    RETURN jsonb_build_object(
      'success', true,
      'incident_id', p_incident_id,
      'old_status', v_old_canonical,
      'new_status', v_new_canonical,
      'no_op', true
    );
  END IF;

  IF NOT (
    (v_old_canonical = 'OPEN' AND v_new_canonical = 'EVIDENCE_GATHERING') OR
    (v_old_canonical = 'EVIDENCE_GATHERING' AND v_new_canonical = 'REVIEW_PENDING') OR
    (v_old_canonical = 'REVIEW_PENDING' AND v_new_canonical = 'CLAIM_ROUTING_READY') OR
    (v_old_canonical = 'CLAIM_ROUTING_READY' AND v_new_canonical = 'SUBMITTED') OR
    (v_old_canonical = 'SUBMITTED' AND v_new_canonical = 'CLOSED') OR
    (v_old_canonical IN ('OPEN','EVIDENCE_GATHERING','REVIEW_PENDING','CLAIM_ROUTING_READY','SUBMITTED') AND v_new_canonical = 'DISPUTED')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid status transition',
      'from_status', v_old_canonical,
      'to_status', v_new_canonical
    );
  END IF;

  IF v_old_canonical = 'REVIEW_PENDING' AND v_new_canonical = 'CLAIM_ROUTING_READY' THEN
    SELECT count(*) INTO v_evidence_count
    FROM evidence
    WHERE incident_id = p_incident_id;
    IF v_evidence_count = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Cannot move to claim routing without evidence',
        'required', 'evidence'
      );
    END IF;
  END IF;

  v_legacy := CASE
    WHEN v_new_canonical IN ('OPEN', 'EVIDENCE_GATHERING') THEN 'Capture'::incident_status
    WHEN v_new_canonical = 'REVIEW_PENDING' THEN 'Review'::incident_status
    ELSE 'Action'::incident_status
  END;

  UPDATE incidents
  SET canonical_status = v_new_canonical,
      status = v_legacy,
      updated_at = now()
  WHERE id = p_incident_id;

  v_emit := emit_event(
    p_event_type := 'incident_status_canonical_changed',
    p_feature_id := 'incidents',
    p_scope_type := 'incident',
    p_scope_id := p_incident_id,
    p_actor_id := v_auth_uid,
    p_actor_type := 'user',
    p_reason_code := COALESCE(p_reason_code, 'status_transition'),
    p_previous_state := jsonb_build_object('canonical_status', v_old_canonical),
    p_resulting_state := jsonb_build_object('canonical_status', v_new_canonical),
    p_metadata := jsonb_build_object('old_status', v_old_canonical, 'new_status', v_new_canonical)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed for incident_status_canonical_changed: %', COALESCE(v_emit->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'incident_id', p_incident_id,
    'old_status', v_old_canonical,
    'new_status', v_new_canonical,
    'event_id', v_emit->>'event_id'
  );
END;
$$;
