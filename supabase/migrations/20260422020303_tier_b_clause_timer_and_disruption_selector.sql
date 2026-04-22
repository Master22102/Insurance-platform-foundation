/*
  # Tier B — Clause Timer Emitter + Disruption Option Selector

  1. New RPCs
    - emit_elapsed_clause_timers() — scans clause_timers, emits clause_timer_elapsed events for any timer whose due_at has passed and elapsed_at is null. Stamps elapsed_at. Callable by authenticated users for their own rows.
    - select_disruption_option(incident_id, option_id, actor_id) — records selected_option_id on incidents and emits disruption_option_selected event.
    - resolve_jurisdiction(incident_id) — returns likely framework codes (EU261/UK261/DOT) based on incident trip route.

  2. Security
    - All SECURITY DEFINER with auth.uid() ownership checks via incident -> trip -> account_id chain.
*/

CREATE OR REPLACE FUNCTION public.emit_elapsed_clause_timers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT timer_id, trip_id, account_id, clause_id, trigger_type, due_at
    FROM public.clause_timers
    WHERE elapsed_at IS NULL
      AND due_at IS NOT NULL
      AND due_at <= now()
      AND (auth.uid() IS NULL OR account_id = auth.uid())
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.clause_timers
    SET elapsed_at = now()
    WHERE timer_id = v_row.timer_id;

    INSERT INTO public.event_logs (event_type, actor_id, actor_type, related_entity_type, related_entity_id, event_data)
    VALUES ('clause_timer_elapsed', v_row.account_id, 'system', 'trip', v_row.trip_id,
            jsonb_build_object(
              'timer_id', v_row.timer_id,
              'clause_id', v_row.clause_id,
              'trigger_type', v_row.trigger_type,
              'due_at', v_row.due_at
            ));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.select_disruption_option(
  p_incident_id uuid,
  p_option_id text,
  p_actor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_event_id uuid;
BEGIN
  SELECT t.account_id INTO v_account_id
  FROM public.incidents i
  JOIN public.trips t ON t.trip_id = i.trip_id
  WHERE i.id = p_incident_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'incident_not_found';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_account_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.incidents
  SET selected_option_id = p_option_id,
      booking_link_opened_at = COALESCE(booking_link_opened_at, now())
  WHERE id = p_incident_id;

  INSERT INTO public.event_logs (event_type, actor_id, actor_type, related_entity_type, related_entity_id, event_data)
  VALUES ('disruption_option_selected', COALESCE(p_actor_id, v_account_id), 'user', 'incident', p_incident_id,
          jsonb_build_object('option_id', p_option_id, 'selected_at', now()))
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_jurisdiction(
  p_incident_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_destination text;
  v_frameworks text[];
BEGIN
  SELECT t.account_id, t.destination_summary
  INTO v_account_id, v_destination
  FROM public.incidents i
  JOIN public.trips t ON t.trip_id = i.trip_id
  WHERE i.id = p_incident_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'incident_not_found';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_account_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_frameworks := ARRAY[]::text[];
  IF v_destination ILIKE '%united kingdom%' OR v_destination ILIKE '%england%' OR v_destination ILIKE '%scotland%' OR v_destination ILIKE '%wales%' THEN
    v_frameworks := v_frameworks || 'UK261';
  END IF;
  IF v_destination ILIKE '%france%' OR v_destination ILIKE '%germany%' OR v_destination ILIKE '%spain%' OR v_destination ILIKE '%italy%' OR v_destination ILIKE '%portugal%' OR v_destination ILIKE '%netherlands%' OR v_destination ILIKE '%poland%' OR v_destination ILIKE '%greece%' THEN
    v_frameworks := v_frameworks || 'EU261';
  END IF;
  IF v_destination ILIKE '%united states%' OR v_destination ILIKE '%usa%' OR v_destination IS NULL THEN
    v_frameworks := v_frameworks || 'DOT';
  END IF;

  RETURN jsonb_build_object(
    'incident_id', p_incident_id,
    'destination', v_destination,
    'frameworks', v_frameworks
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.emit_elapsed_clause_timers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_disruption_option(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_jurisdiction(uuid) TO authenticated;
