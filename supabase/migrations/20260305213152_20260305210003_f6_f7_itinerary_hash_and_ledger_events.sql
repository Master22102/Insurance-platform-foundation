/*
  # F-6 + F-7: Itinerary Hash RPCs + Remaining Ledger Events
  update_itinerary_hash(), confirm_itinerary_snapshot(),
  record_alignment_comparison(), acknowledge_alignment_change()
*/

CREATE OR REPLACE FUNCTION update_itinerary_hash(p_trip_id uuid, p_actor_id uuid, p_itinerary_fields jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_trip trips%ROWTYPE; v_old_hash text; v_new_hash text; v_emit jsonb;
BEGIN
  SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_found'); END IF;
  v_old_hash := v_trip.itinerary_content_hash;
  v_new_hash := encode(digest((SELECT string_agg(key || '=' || value, '|' ORDER BY key) FROM jsonb_each_text(p_itinerary_fields)), 'sha256'), 'hex');
  IF v_new_hash = v_old_hash THEN RETURN jsonb_build_object('success', true, 'changed', false, 'hash', v_new_hash); END IF;
  UPDATE trips SET itinerary_content_hash = v_new_hash WHERE trip_id = p_trip_id;
  v_emit := emit_event(p_event_type := 'itinerary_version_created', p_feature_id := 'trips',
    p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_actor_id, p_actor_type := 'user',
    p_reason_code := 'itinerary_fields_changed',
    p_previous_state := jsonb_build_object('hash', v_old_hash), p_resulting_state := jsonb_build_object('hash', v_new_hash),
    p_metadata := jsonb_build_object('old_hash', v_old_hash, 'new_hash', v_new_hash, 'fields_snapshot', p_itinerary_fields));
  RETURN jsonb_build_object('success', true, 'changed', true, 'old_hash', v_old_hash, 'new_hash', v_new_hash, 'event_id', v_emit->>'event_id');
END; $$;
GRANT EXECUTE ON FUNCTION update_itinerary_hash(uuid, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION confirm_itinerary_snapshot(p_trip_id uuid, p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_trip trips%ROWTYPE; v_emit jsonb;
BEGIN
  SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_actor_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_found'); END IF;
  IF NOT v_trip.paid_unlock THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked'); END IF;
  IF v_trip.itinerary_content_hash IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'itinerary_hash_required_before_snapshot'); END IF;
  UPDATE trips SET maturity_state = 'SNAPSHOT_CONFIRMED' WHERE trip_id = p_trip_id;
  v_emit := emit_event(p_event_type := 'itinerary_snapshot_confirmed', p_feature_id := 'trips',
    p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_actor_id, p_actor_type := 'user',
    p_reason_code := 'user_confirmed',
    p_previous_state := jsonb_build_object('maturity_state', v_trip.maturity_state),
    p_resulting_state := jsonb_build_object('maturity_state', 'SNAPSHOT_CONFIRMED'),
    p_metadata := jsonb_build_object('confirmed_hash', v_trip.itinerary_content_hash));
  RETURN jsonb_build_object('success', true, 'trip_id', p_trip_id, 'maturity_state', 'SNAPSHOT_CONFIRMED',
    'confirmed_hash', v_trip.itinerary_content_hash, 'event_id', v_emit->>'event_id');
END; $$;
GRANT EXECUTE ON FUNCTION confirm_itinerary_snapshot(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION record_alignment_comparison(p_trip_id uuid, p_actor_id uuid, p_comparison_result text, p_change_summary jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_emit jsonb;
BEGIN
  IF p_comparison_result NOT IN ('no_meaningful_change', 'possible_coverage_impact', 'coverage_likely_impacted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_comparison_result');
  END IF;
  v_emit := emit_event(p_event_type := 'alignment_comparison_completed', p_feature_id := 'trips',
    p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_actor_id, p_actor_type := 'user',
    p_reason_code := p_comparison_result,
    p_metadata := jsonb_build_object('comparison_result', p_comparison_result, 'change_summary', p_change_summary));
  IF p_comparison_result IN ('possible_coverage_impact', 'coverage_likely_impacted') THEN
    PERFORM emit_event(p_event_type := 'alignment_review_prompt_presented', p_feature_id := 'trips',
      p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_actor_id, p_actor_type := 'user',
      p_reason_code := p_comparison_result,
      p_metadata := jsonb_build_object('severity', p_comparison_result, 'change_summary', p_change_summary));
  END IF;
  RETURN jsonb_build_object('success', true, 'comparison_result', p_comparison_result,
    'prompt_presented', p_comparison_result != 'no_meaningful_change', 'event_id', v_emit->>'event_id');
END; $$;
GRANT EXECUTE ON FUNCTION record_alignment_comparison(uuid, uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION acknowledge_alignment_change(p_trip_id uuid, p_actor_id uuid, p_change_context jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_emit jsonb;
BEGIN
  v_emit := emit_event(p_event_type := 'user_acknowledged_alignment_change', p_feature_id := 'trips',
    p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_actor_id, p_actor_type := 'user',
    p_reason_code := 'user_explicit_acknowledgement',
    p_metadata := jsonb_build_object('trip_id', p_trip_id, 'change_context', p_change_context, 'acknowledged_at', now()));
  RETURN jsonb_build_object('success', true, 'acknowledged_at', now(), 'event_id', v_emit->>'event_id');
END; $$;
GRANT EXECUTE ON FUNCTION acknowledge_alignment_change(uuid, uuid, jsonb) TO authenticated;