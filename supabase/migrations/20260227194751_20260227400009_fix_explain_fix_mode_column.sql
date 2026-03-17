/*
  # Fix get_explain_fix_context: region_operational_state column name

  ## Summary
  region_operational_state uses column 'mode' not 'current_mode'.
  Fix the reference in get_explain_fix_context.
*/

CREATE OR REPLACE FUNCTION get_explain_fix_context(
  p_event_id  uuid,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event             record;
  v_incident          record;
  v_feature           record;
  v_surfaces          jsonb;
  v_doctrine          jsonb;
  v_rpc_ctx           jsonb;
  v_fix_hints         jsonb;
  v_explain_text      text;
  v_confidence_text   text;
  v_mode              text;
  v_mode_display      text;
  v_confidence_raw    text;
BEGIN
  SELECT * INTO v_event FROM event_ledger WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event not found');
  END IF;

  IF v_event.scope_type = 'incident' AND v_event.scope_id IS NOT NULL THEN
    SELECT * INTO v_incident FROM incidents WHERE id = v_event.scope_id;
  END IF;

  IF v_event.feature_id IS NOT NULL THEN
    SELECT * INTO v_feature FROM feature_registry WHERE feature_id = v_event.feature_id;
  END IF;

  IF v_event.feature_id IS NOT NULL THEN
    SELECT jsonb_agg(row_to_json(s)::jsonb)
    INTO v_surfaces
    FROM screen_surface_registry s
    WHERE s.feature_id = v_event.feature_id;
  END IF;

  v_doctrine  := get_doctrine_refs_for_event(v_event.event_type);
  v_rpc_ctx   := get_rpc_context_for_event(v_event.event_type);
  v_fix_hints := get_fix_hints_for_event(v_event.event_type, v_event.reason_code, COALESCE(v_event.metadata,'{}'));

  v_confidence_raw := COALESCE(
    v_event.metadata->>'confidence_label',
    v_event.resulting_state->>'confidence_label'
  );

  IF v_confidence_raw IS NOT NULL AND v_confidence_raw <> '' THEN
    BEGIN
      v_confidence_text := get_confidence_label_text(v_confidence_raw::confidence_label);
    EXCEPTION WHEN invalid_text_representation THEN
      v_confidence_text := 'Confidence: ' || v_confidence_raw;
    END;
  END IF;

  SELECT COALESCE(ros.mode, 'NORMAL')
  INTO v_mode
  FROM region_operational_state ros
  WHERE ros.region_id = p_region_id;

  v_mode_display := get_mode_display_name(COALESCE(v_mode, 'NORMAL'));

  v_explain_text := 'Event: ' || v_event.event_type ||
    CASE WHEN v_event.reason_code IS NOT NULL THEN ' | Reason: ' || v_event.reason_code ELSE '' END ||
    CASE WHEN v_confidence_text IS NOT NULL THEN ' | ' || v_confidence_text ELSE '' END ||
    ' | Mode: ' || v_mode_display;

  RETURN jsonb_build_object(
    'ok',              true,
    'event',           row_to_json(v_event)::jsonb,
    'incident',        CASE WHEN v_incident IS NOT NULL THEN row_to_json(v_incident)::jsonb ELSE NULL END,
    'feature',         CASE WHEN v_feature IS NOT NULL THEN row_to_json(v_feature)::jsonb ELSE NULL END,
    'screen_surfaces', COALESCE(v_surfaces, '[]'::jsonb),
    'doctrine_refs',   v_doctrine,
    'rpc_context',     v_rpc_ctx,
    'fix_hints',       v_fix_hints,
    'explain_text',    v_explain_text,
    'confidence_label_text', v_confidence_text,
    'mode',            v_mode,
    'mode_display',    v_mode_display
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_explain_fix_context(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_explain_fix_context(uuid, uuid) FROM anon;
