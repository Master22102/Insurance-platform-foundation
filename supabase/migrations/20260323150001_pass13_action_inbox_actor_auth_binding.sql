/*
  Pass 13: Bind action inbox mutators to JWT identity.

  Mutating RPCs previously accepted arbitrary p_actor_id while granted to
  authenticated — emit_event and state_changes could attribute actions to another
  UUID. Now p_actor_id must match auth.uid() when provided, and emits use auth.uid().
*/

-- =====================================================
-- snooze_action_inbox_item
-- =====================================================

CREATE OR REPLACE FUNCTION snooze_action_inbox_item(
  p_item_id       uuid,
  p_snoozed_until timestamptz,
  p_actor_id      uuid    DEFAULT NULL,
  p_region_id     uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard       jsonb;
  v_prev_status text;
  v_emit        jsonb;
  v_auth_uid    uuid;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'inbox_snooze');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id IS DISTINCT FROM v_auth_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT status INTO v_prev_status FROM action_inbox_items WHERE item_id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inbox item not found');
  END IF;

  UPDATE action_inbox_items
  SET status = 'snoozed', snoozed_until = p_snoozed_until, updated_at = now()
  WHERE item_id = p_item_id;

  INSERT INTO action_inbox_state_changes (item_id, from_status, to_status, changed_by, reason_code)
  VALUES (p_item_id, v_prev_status, 'snoozed', v_auth_uid, 'snoozed_by_user');

  v_emit := emit_event(
    p_event_type := 'inbox_item_snoozed', p_feature_id := 'governance',
    p_scope_type := 'system', p_scope_id := p_region_id,
    p_actor_id := v_auth_uid, p_actor_type := 'user',
    p_reason_code := 'snoozed_by_user',
    p_metadata := jsonb_build_object('item_id', p_item_id, 'snoozed_until', p_snoozed_until, 'prev_status', v_prev_status)
  );
  IF NOT (v_emit->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for inbox_item_snoozed: %', v_emit->>'error';
  END IF;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'status', 'snoozed', 'event_id', v_emit->>'event_id');
END;
$$;

-- =====================================================
-- assign_action_inbox_item
-- =====================================================

CREATE OR REPLACE FUNCTION assign_action_inbox_item(
  p_item_id   uuid,
  p_assign_to uuid,
  p_actor_id  uuid    DEFAULT NULL,
  p_region_id uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard       jsonb;
  v_prev_status text;
  v_emit        jsonb;
  v_auth_uid    uuid;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'inbox_assign');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id IS DISTINCT FROM v_auth_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT status INTO v_prev_status FROM action_inbox_items WHERE item_id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inbox item not found');
  END IF;

  UPDATE action_inbox_items
  SET status = 'assigned', assigned_to = p_assign_to, updated_at = now()
  WHERE item_id = p_item_id;

  INSERT INTO action_inbox_state_changes (item_id, from_status, to_status, changed_by, reason_code, metadata)
  VALUES (p_item_id, v_prev_status, 'assigned', v_auth_uid, 'assigned_by_user',
          jsonb_build_object('assigned_to', p_assign_to));

  v_emit := emit_event(
    p_event_type := 'inbox_item_assigned', p_feature_id := 'governance',
    p_scope_type := 'system', p_scope_id := p_region_id,
    p_actor_id := v_auth_uid, p_actor_type := 'user',
    p_reason_code := 'assigned_by_user',
    p_metadata := jsonb_build_object('item_id', p_item_id, 'assigned_to', p_assign_to, 'prev_status', v_prev_status)
  );
  IF NOT (v_emit->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for inbox_item_assigned: %', v_emit->>'error';
  END IF;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'status', 'assigned', 'assigned_to', p_assign_to, 'event_id', v_emit->>'event_id');
END;
$$;

-- =====================================================
-- add_action_inbox_note
-- =====================================================

CREATE OR REPLACE FUNCTION add_action_inbox_note(
  p_item_id   uuid,
  p_body      text,
  p_actor_id  uuid    DEFAULT NULL,
  p_region_id uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard   jsonb;
  v_note_id uuid;
  v_emit    jsonb;
  v_auth_uid uuid;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'inbox_note');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id IS DISTINCT FROM v_auth_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM action_inbox_items WHERE item_id = p_item_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inbox item not found');
  END IF;

  IF p_body IS NULL OR trim(p_body) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'note body cannot be empty');
  END IF;

  INSERT INTO action_inbox_notes (item_id, author_id, body)
  VALUES (p_item_id, v_auth_uid, p_body)
  RETURNING note_id INTO v_note_id;

  v_emit := emit_event(
    p_event_type := 'inbox_note_added', p_feature_id := 'governance',
    p_scope_type := 'system', p_scope_id := p_region_id,
    p_actor_id := v_auth_uid, p_actor_type := 'user',
    p_reason_code := 'note_added_ok',
    p_metadata := jsonb_build_object('item_id', p_item_id, 'note_id', v_note_id)
  );
  IF NOT (v_emit->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for inbox_note_added: %', v_emit->>'error';
  END IF;

  RETURN jsonb_build_object('ok', true, 'note_id', v_note_id, 'item_id', p_item_id, 'event_id', v_emit->>'event_id');
END;
$$;

-- =====================================================
-- set_action_inbox_status
-- =====================================================

CREATE OR REPLACE FUNCTION set_action_inbox_status(
  p_item_id     uuid,
  p_new_status  text,
  p_reason_code text    DEFAULT NULL,
  p_actor_id    uuid    DEFAULT NULL,
  p_region_id   uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard       jsonb;
  v_prev_status text;
  v_emit        jsonb;
  v_auth_uid    uuid;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'inbox_status_change');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id IS DISTINCT FROM v_auth_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_new_status NOT IN ('open', 'snoozed', 'assigned', 'resolved', 'dismissed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid status: ' || p_new_status);
  END IF;

  SELECT status INTO v_prev_status FROM action_inbox_items WHERE item_id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inbox item not found');
  END IF;

  IF v_prev_status = p_new_status THEN
    RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'status', p_new_status, 'no_op', true);
  END IF;

  UPDATE action_inbox_items
  SET status      = p_new_status,
      resolved_at = CASE WHEN p_new_status = 'resolved' THEN now() ELSE resolved_at END,
      updated_at  = now()
  WHERE item_id = p_item_id;

  INSERT INTO action_inbox_state_changes (item_id, from_status, to_status, changed_by, reason_code)
  VALUES (p_item_id, v_prev_status, p_new_status, v_auth_uid, p_reason_code);

  v_emit := emit_event(
    p_event_type := 'inbox_item_status_changed', p_feature_id := 'governance',
    p_scope_type := 'system', p_scope_id := p_region_id,
    p_actor_id := v_auth_uid, p_actor_type := 'user',
    p_reason_code := COALESCE(p_reason_code, 'status_changed_ok'),
    p_previous_state  := jsonb_build_object('status', v_prev_status),
    p_resulting_state := jsonb_build_object('status', p_new_status),
    p_metadata := jsonb_build_object('item_id', p_item_id, 'from_status', v_prev_status, 'to_status', p_new_status)
  );
  IF NOT (v_emit->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for inbox_item_status_changed: %', v_emit->>'error';
  END IF;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'status', p_new_status, 'prev_status', v_prev_status, 'event_id', v_emit->>'event_id');
END;
$$;

-- =====================================================
-- link_event_to_inbox_item
-- =====================================================

CREATE OR REPLACE FUNCTION link_event_to_inbox_item(
  p_item_id   uuid,
  p_event_id  uuid,
  p_actor_id  uuid    DEFAULT NULL,
  p_region_id uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard          jsonb;
  v_emit           jsonb;
  v_current_linked jsonb;
  v_auth_uid       uuid;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'governance', 'inbox_link_event');
  IF NOT (v_guard->>'allowed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Blocked by governance guard', 'mode', v_guard->>'mode');
  END IF;

  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id IS DISTINCT FROM v_auth_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM action_inbox_items WHERE item_id = p_item_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inbox item not found');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM event_ledger WHERE id = p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_ledger entry not found');
  END IF;

  SELECT COALESCE(metadata->'linked_event_ids', '[]'::jsonb)
  INTO v_current_linked
  FROM action_inbox_items WHERE item_id = p_item_id;

  IF v_current_linked @> jsonb_build_array(p_event_id::text) THEN
    RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'event_id', p_event_id, 'no_op', true);
  END IF;

  UPDATE action_inbox_items
  SET metadata   = metadata || jsonb_build_object('linked_event_ids', v_current_linked || jsonb_build_array(p_event_id::text)),
      updated_at = now()
  WHERE item_id = p_item_id;

  v_emit := emit_event(
    p_event_type := 'inbox_event_linked', p_feature_id := 'governance',
    p_scope_type := 'system', p_scope_id := p_region_id,
    p_actor_id := v_auth_uid, p_actor_type := 'user',
    p_reason_code := 'event_linked_ok',
    p_metadata := jsonb_build_object('item_id', p_item_id, 'linked_event_id', p_event_id)
  );
  IF NOT (v_emit->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for inbox_event_linked: %', v_emit->>'error';
  END IF;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'event_id', p_event_id, 'event_ledger_id', v_emit->>'event_id');
END;
$$;
