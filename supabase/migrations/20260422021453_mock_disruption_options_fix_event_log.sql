/*
  # Fix mock disruption options connector event log shape

  Adjusts populate_mock_disruption_options to insert event_logs using the
  actual column names on that table (related_entity_*, event_data, actor_type).
*/

CREATE OR REPLACE FUNCTION public.populate_mock_disruption_options(
  p_incident_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_trip_id uuid;
  v_payload jsonb;
BEGIN
  SELECT t.account_id, i.trip_id
    INTO v_account_id, v_trip_id
  FROM incidents i
  JOIN trips t ON t.trip_id = i.trip_id
  WHERE i.id = p_incident_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'incident_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_account_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  v_payload := jsonb_build_object(
    'connector_source', 'mock',
    'disclaimer', 'Mock data — no carrier API is connected. Values are illustrative and must not be used to file or decide.',
    'retrieved_at', now(),
    'options', jsonb_build_array(
      jsonb_build_object('option_id','mock_rebook_next_available','provider','Mock Carrier','category','rebook','summary','Rebook onto the next available flight (illustrative only).','price','No fare difference (mock)'),
      jsonb_build_object('option_id','mock_refund_full','provider','Mock Carrier','category','refund','summary','Full refund to original form of payment (illustrative only).','price','Full fare refunded (mock)'),
      jsonb_build_object('option_id','mock_accommodation_voucher','provider','Mock Carrier','category','accommodation','summary','Overnight hotel voucher if the delay crosses local 00:00 (illustrative only).','price','Up to $150 (mock)'),
      jsonb_build_object('option_id','mock_travel_voucher','provider','Mock Carrier','category','voucher','summary','Future travel voucher with 12-month validity (illustrative only).','price','120% of fare in voucher credit (mock)')
    )
  );

  UPDATE incidents
     SET live_options_result = v_payload,
         live_options_retrieved_at = now(),
         live_options_expires_at = now() + interval '30 minutes',
         options_engine_activated = true,
         options_engine_activated_at = COALESCE(options_engine_activated_at, now()),
         options_engine_trigger = COALESCE(options_engine_trigger, 'mock_connector'),
         updated_at = now()
   WHERE id = p_incident_id;

  INSERT INTO event_logs (
    event_type, related_entity_type, related_entity_id,
    actor_id, actor_type, event_data, created_at
  ) VALUES (
    'live_options_mock_populated',
    'incident',
    p_incident_id,
    auth.uid(),
    'user',
    jsonb_build_object(
      'incident_id', p_incident_id,
      'trip_id', v_trip_id,
      'connector_source', 'mock',
      'option_count', 4
    ),
    now()
  );

  RETURN v_payload;
END;
$$;
