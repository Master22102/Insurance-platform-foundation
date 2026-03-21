/*
  Pass 14 — Claim packet RPC must only assemble when incident is routing-ready.
  Aligns server contract with doctrine + UI gate on /route (CLAIM_ROUTING_READY).
  Idempotent replays (same incident + idempotency key) still short-circuit before this check.
*/

CREATE OR REPLACE FUNCTION create_claim_packet_from_incident(
  p_incident_id uuid,
  p_actor_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_uid uuid;
  v_incident incidents%ROWTYPE;
  v_trip trips%ROWTYPE;
  v_existing_packet uuid;
  v_packet_id uuid;
  v_routing jsonb;
  v_sequence jsonb := '[]'::jsonb;
  v_emit jsonb;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR p_actor_id IS NULL OR p_actor_id <> v_auth_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT packet_id INTO v_existing_packet
    FROM claim_packets
    WHERE incident_id = p_incident_id
      AND packet_payload->>'idempotency_key' = p_idempotency_key
    LIMIT 1;
    IF v_existing_packet IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'packet_id', v_existing_packet,
        'idempotent', true
      );
    END IF;
  END IF;

  SELECT i.* INTO v_incident
  FROM incidents i
  JOIN trips t ON t.trip_id = i.trip_id
  WHERE i.id = p_incident_id
    AND t.created_by = v_auth_uid;
  IF v_incident.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;

  IF v_incident.canonical_status IS DISTINCT FROM 'CLAIM_ROUTING_READY' THEN
    RETURN jsonb_build_object('success', false, 'error', 'routing_not_ready');
  END IF;

  SELECT * INTO v_trip FROM trips WHERE trip_id = v_incident.trip_id;

  SELECT to_jsonb(crd.*) INTO v_routing
  FROM claim_routing_decisions crd
  WHERE crd.incident_id = p_incident_id
  ORDER BY crd.created_at DESC
  LIMIT 1;

  IF v_routing IS NOT NULL AND v_routing ? 'guidance_steps' THEN
    v_sequence := COALESCE(v_routing->'guidance_steps', '[]'::jsonb);
  ELSE
    v_sequence := jsonb_build_array(
      jsonb_build_object('step', 1, 'action', 'Collect receipts and carrier documentation'),
      jsonb_build_object('step', 2, 'action', 'Complete provider filing form'),
      jsonb_build_object('step', 3, 'action', 'Submit and retain confirmation')
    );
  END IF;

  INSERT INTO claim_packets (
    claim_id,
    incident_id,
    trip_id,
    account_id,
    packet_status,
    packet_version,
    sequence_steps,
    packet_payload
  ) VALUES (
    NULL,
    p_incident_id,
    v_trip.trip_id,
    v_auth_uid,
    'ready',
    1,
    v_sequence,
    jsonb_build_object(
      'incident_title', v_incident.title,
      'canonical_status', v_incident.canonical_status,
      'disruption_type', v_incident.disruption_type,
      'routing_decision', COALESCE(v_routing, '{}'::jsonb),
      'idempotency_key', COALESCE(p_idempotency_key, '')
    )
  )
  RETURNING packet_id INTO v_packet_id;

  v_emit := emit_event(
    p_event_type := 'claim_packet_created',
    p_feature_id := 'F-6.5.14',
    p_scope_type := 'incident',
    p_scope_id := p_incident_id,
    p_actor_id := v_auth_uid,
    p_actor_type := 'user',
    p_reason_code := 'packet_generated',
    p_metadata := jsonb_build_object(
      'packet_id', v_packet_id,
      'trip_id', v_trip.trip_id
    ),
    p_idempotency_key := p_idempotency_key
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed for claim_packet_created: %', COALESCE(v_emit->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'packet_id', v_packet_id,
    'event_id', v_emit->>'event_id',
    'idempotent', false
  );
END;
$$;
