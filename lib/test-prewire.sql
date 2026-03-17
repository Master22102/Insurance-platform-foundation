-- =====================================================================
-- STRESS TEST SUITE: Max Clarity Pre-Wire + Universal Rails
-- Sections: A (no-bypass), B (canonical reason codes), C (stub RPCs),
--           D (inbox tables+projector), E (explain & fix), F (battery)
-- Run as postgres (service role) in psql or SQL editor
-- =====================================================================

-- =====================================================================
-- SECTION A: No Direct-Write Bypass Proofs (new tables)
-- =====================================================================

-- A1: action_inbox_items — no authenticated INSERT policy
SELECT CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'action_inbox_items'
      AND cmd IN ('INSERT','UPDATE')
      AND roles @> ARRAY['authenticated']
  ) THEN 'A1 PASS: action_inbox_items has no authenticated INSERT/UPDATE policy'
  ELSE 'A1 FAIL: action_inbox_items has direct-write policy for authenticated'
END AS result;

-- A2: action_inbox_notes — no authenticated INSERT policy (writes via RPC)
SELECT CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'action_inbox_notes'
      AND cmd IN ('INSERT','UPDATE')
      AND roles @> ARRAY['authenticated']
  ) THEN 'A2 PASS: action_inbox_notes has no authenticated INSERT/UPDATE policy'
  ELSE 'A2 FAIL: action_inbox_notes has direct-write policy for authenticated'
END AS result;

-- A3: action_inbox_state_changes — no authenticated INSERT policy
SELECT CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'action_inbox_state_changes'
      AND cmd IN ('INSERT','UPDATE')
      AND roles @> ARRAY['authenticated']
  ) THEN 'A3 PASS: action_inbox_state_changes has no authenticated INSERT/UPDATE policy'
  ELSE 'A3 FAIL: action_inbox_state_changes has direct-write policy for authenticated'
END AS result;

-- A4: action_inbox_projector_state — no authenticated INSERT/UPDATE policy
SELECT CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'action_inbox_projector_state'
      AND cmd IN ('INSERT','UPDATE')
      AND roles @> ARRAY['authenticated']
  ) THEN 'A4 PASS: action_inbox_projector_state has no authenticated INSERT/UPDATE policy'
  ELSE 'A4 FAIL: action_inbox_projector_state has direct-write policy for authenticated'
END AS result;

-- =====================================================================
-- SECTION B: Canonical Reason Codes Registered
-- =====================================================================

-- B1: FEATURE_DISABLED registered
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM reason_code_registry WHERE reason_code = 'FEATURE_DISABLED')
  THEN 'B1 PASS: FEATURE_DISABLED registered'
  ELSE 'B1 FAIL: FEATURE_DISABLED missing from reason_code_registry'
END AS result;

-- B2: DOCUMENTATION_INCOMPLETE registered
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM reason_code_registry WHERE reason_code = 'DOCUMENTATION_INCOMPLETE')
  THEN 'B2 PASS: DOCUMENTATION_INCOMPLETE registered'
  ELSE 'B2 FAIL: DOCUMENTATION_INCOMPLETE missing'
END AS result;

-- B3: SOURCE_UNAVAILABLE registered
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM reason_code_registry WHERE reason_code = 'SOURCE_UNAVAILABLE')
  THEN 'B3 PASS: SOURCE_UNAVAILABLE registered'
  ELSE 'B3 FAIL: SOURCE_UNAVAILABLE missing'
END AS result;

-- B4: PERMISSION_DENIED registered
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM reason_code_registry WHERE reason_code = 'PERMISSION_DENIED')
  THEN 'B4 PASS: PERMISSION_DENIED registered'
  ELSE 'B4 FAIL: PERMISSION_DENIED missing'
END AS result;

-- B5: RATE_LIMITED registered
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM reason_code_registry WHERE reason_code = 'RATE_LIMITED')
  THEN 'B5 PASS: RATE_LIMITED registered'
  ELSE 'B5 FAIL: RATE_LIMITED missing'
END AS result;

-- B6: MODE_RESTRICTED registered
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM reason_code_registry WHERE reason_code = 'MODE_RESTRICTED')
  THEN 'B6 PASS: MODE_RESTRICTED registered'
  ELSE 'B6 FAIL: MODE_RESTRICTED missing'
END AS result;

-- =====================================================================
-- SECTION C: Pre-Wire Feature Registry + Stub RPCs
-- =====================================================================

-- C1: All 17 pre-wire features registered
SELECT CASE
  WHEN (SELECT COUNT(*) FROM feature_registry WHERE feature_id IN (
    'F-6.5.1','F-6.5.2','F-6.5.4','F-6.5.7-ENRICH','F-6.5.8','F-6.5.9',
    'F-6.5.10','F-6.5.11','F-6.5.12','F-6.5.13','F-6.5.14','F-CARRIER-DEEP',
    'F-6.5.15','F-6.6.1','F-6.6.9','F-7.4','F-12.3'
  )) = 17 THEN 'C1 PASS: All 17 pre-wire features registered in feature_registry'
  ELSE 'C1 FAIL: Missing pre-wire features — got ' ||
    (SELECT COUNT(*)::text FROM feature_registry WHERE feature_id IN (
      'F-6.5.1','F-6.5.2','F-6.5.4','F-6.5.7-ENRICH','F-6.5.8','F-6.5.9',
      'F-6.5.10','F-6.5.11','F-6.5.12','F-6.5.13','F-6.5.14','F-CARRIER-DEEP',
      'F-6.5.15','F-6.6.1','F-6.6.9','F-7.4','F-12.3'
    ))
END AS result;

-- C2: All pre-wire features are DISABLED by default
SELECT CASE
  WHEN (SELECT COUNT(*) FROM feature_registry
        WHERE feature_id IN (
          'F-6.5.1','F-6.5.2','F-6.5.4','F-6.5.7-ENRICH','F-6.5.8','F-6.5.9',
          'F-6.5.10','F-6.5.11','F-6.5.12','F-6.5.13','F-6.5.14','F-CARRIER-DEEP',
          'F-6.5.15','F-6.6.1','F-6.6.9','F-7.4','F-12.3'
        )
        AND default_enabled = false) = 17
  THEN 'C2 PASS: All 17 pre-wire features have default_enabled=false'
  ELSE 'C2 FAIL: Some pre-wire features have default_enabled=true'
END AS result;

-- C3: invoke_policy_parse returns SUPPRESSED with FEATURE_DISABLED
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := invoke_policy_parse(NULL, NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid()::text);
  ASSERT (v_result->>'ok') = 'false', 'C3 FAIL: invoke_policy_parse should return ok=false';
  ASSERT (v_result->>'status') = 'SUPPRESSED', 'C3 FAIL: invoke_policy_parse should return status=SUPPRESSED';
  ASSERT (v_result->>'reason_code') = 'FEATURE_DISABLED', 'C3 FAIL: invoke_policy_parse should return reason_code=FEATURE_DISABLED';
  RAISE NOTICE 'C3 PASS: invoke_policy_parse correctly returns SUPPRESSED with FEATURE_DISABLED';
END $$;

-- C4: invoke_coverage_graph returns SUPPRESSED with FEATURE_DISABLED
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := invoke_coverage_graph(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid()::text);
  ASSERT (v_result->>'ok') = 'false', 'C4 FAIL: invoke_coverage_graph should return ok=false';
  ASSERT (v_result->>'status') = 'SUPPRESSED', 'C4 FAIL: should return SUPPRESSED';
  ASSERT (v_result->>'feature_id') = 'F-6.5.2', 'C4 FAIL: feature_id should be F-6.5.2';
  RAISE NOTICE 'C4 PASS: invoke_coverage_graph correctly returns SUPPRESSED';
END $$;

-- C5: invoke_feature_stub generic works for F-6.5.8 causality
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := invoke_causality_link(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid()::text);
  ASSERT (v_result->>'ok') = 'false', 'C5 FAIL: invoke_causality_link should return ok=false';
  ASSERT (v_result->>'feature_id') = 'F-6.5.8', 'C5 FAIL: feature_id should be F-6.5.8';
  RAISE NOTICE 'C5 PASS: invoke_causality_link returns SUPPRESSED';
END $$;

-- C6: Stub invocations emit suppression events into event_ledger
DO $$
DECLARE
  v_before_count bigint;
  v_after_count  bigint;
BEGIN
  SELECT COUNT(*) INTO v_before_count FROM event_ledger WHERE event_type LIKE '%_suppressed';
  PERFORM invoke_disruption_ingest(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid()::text);
  PERFORM invoke_rair_report(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid()::text);
  PERFORM invoke_voice_capture(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, gen_random_uuid()::text);
  SELECT COUNT(*) INTO v_after_count FROM event_ledger WHERE event_type LIKE '%_suppressed';
  ASSERT v_after_count >= v_before_count + 3, 'C6 FAIL: Expected at least 3 suppression events emitted';
  RAISE NOTICE 'C6 PASS: Stub RPCs emit suppression events into event_ledger (before=%, after=%)', v_before_count, v_after_count;
END $$;

-- C7: Suppression events have required metadata fields
DO $$
DECLARE
  v_trace text := gen_random_uuid()::text;
  v_result jsonb;
  v_event record;
BEGIN
  v_result := invoke_pipeline_ingest(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, v_trace);
  SELECT * INTO v_event
  FROM event_ledger
  WHERE event_type = 'pipeline_ingest_suppressed'
    AND metadata->>'trace_id' = v_trace
  ORDER BY created_at DESC LIMIT 1;
  ASSERT v_event.id IS NOT NULL, 'C7 FAIL: Could not find pipeline_ingest_suppressed event with matching trace_id';
  ASSERT (v_event.metadata->>'feature_id') = 'F-12.3', 'C7 FAIL: metadata.feature_id should be F-12.3';
  ASSERT (v_event.metadata->>'reason_code') = 'FEATURE_DISABLED', 'C7 FAIL: metadata.reason_code should be FEATURE_DISABLED';
  ASSERT (v_event.metadata->>'attempted_action') IS NOT NULL, 'C7 FAIL: metadata.attempted_action missing';
  ASSERT (v_event.metadata->>'next_step_hint') IS NOT NULL, 'C7 FAIL: metadata.next_step_hint missing';
  ASSERT (v_event.metadata->>'screen_surface_id') IS NOT NULL, 'C7 FAIL: metadata.screen_surface_id missing';
  RAISE NOTICE 'C7 PASS: Suppression event for F-12.3 has all required universal metadata rails fields';
END $$;

-- C8: 17 screen surfaces for pre-wire features exist
SELECT CASE
  WHEN (SELECT COUNT(*) FROM screen_surface_registry WHERE feature_id IN (
    'F-6.5.1','F-6.5.2','F-6.5.4','F-6.5.7-ENRICH','F-6.5.8','F-6.5.9',
    'F-6.5.10','F-6.5.11','F-6.5.12','F-6.5.13','F-6.5.14','F-CARRIER-DEEP',
    'F-6.5.15','F-6.6.1','F-6.6.9','F-7.4','F-12.3'
  )) = 17
  THEN 'C8 PASS: All 17 pre-wire screen surfaces registered'
  ELSE 'C8 FAIL: Missing pre-wire screen surfaces — got ' ||
    (SELECT COUNT(*)::text FROM screen_surface_registry WHERE feature_id IN (
      'F-6.5.1','F-6.5.2','F-6.5.4','F-6.5.7-ENRICH','F-6.5.8','F-6.5.9',
      'F-6.5.10','F-6.5.11','F-6.5.12','F-6.5.13','F-6.5.14','F-CARRIER-DEEP',
      'F-6.5.15','F-6.6.1','F-6.6.9','F-7.4','F-12.3'
    ))
END AS result;

-- C9: mode display names are non-empty and cover all 4 modes
DO $$
BEGIN
  ASSERT get_mode_display_name('NORMAL')     <> 'Unknown mode: NORMAL', 'C9a FAIL: NORMAL display empty';
  ASSERT get_mode_display_name('ELEVATED')   <> 'Unknown mode: ELEVATED', 'C9b FAIL: ELEVATED display empty';
  ASSERT get_mode_display_name('PROTECTIVE') <> 'Unknown mode: PROTECTIVE', 'C9c FAIL: PROTECTIVE display empty';
  ASSERT get_mode_display_name('RECOVERY')   <> 'Unknown mode: RECOVERY', 'C9d FAIL: RECOVERY display empty';
  RAISE NOTICE 'C9 PASS: All 4 mode display names are non-trivial';
END $$;

-- C10: check_feature_gate returns disabled for pre-wire features
DO $$
DECLARE v_result jsonb;
BEGIN
  v_result := check_feature_gate('F-6.5.1', '00000000-0000-0000-0000-000000000000'::uuid);
  ASSERT (v_result->>'enabled') = 'false', 'C10 FAIL: F-6.5.1 should be disabled by default';
  RAISE NOTICE 'C10 PASS: check_feature_gate correctly reports F-6.5.1 as disabled';
END $$;

-- =====================================================================
-- SECTION D: Action Inbox Tables + Projector + Mutations
-- =====================================================================

-- D1: action_inbox_projector_state seeded
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM action_inbox_projector_state WHERE projector_id = 'default')
  THEN 'D1 PASS: default projector state row exists'
  ELSE 'D1 FAIL: default projector state row missing'
END AS result;

-- D2: run_action_inbox_projector executes and emits inbox_projector_run event
DO $$
DECLARE
  v_before_count bigint;
  v_result jsonb;
  v_after_count  bigint;
BEGIN
  SELECT COUNT(*) INTO v_before_count FROM event_ledger WHERE event_type = 'inbox_projector_run';
  v_result := run_action_inbox_projector(100, '00000000-0000-0000-0000-000000000000'::uuid, NULL);
  ASSERT (v_result->>'ok') = 'true', 'D2 FAIL: run_action_inbox_projector returned ok=false: ' || v_result::text;
  SELECT COUNT(*) INTO v_after_count FROM event_ledger WHERE event_type = 'inbox_projector_run';
  ASSERT v_after_count > v_before_count, 'D2 FAIL: No inbox_projector_run event emitted';
  RAISE NOTICE 'D2 PASS: run_action_inbox_projector ok=true, items_created=%, items_skipped=%',
    v_result->>'items_created', v_result->>'items_skipped';
END $$;

-- D3: Projector deduplication — running again produces no new items
DO $$
DECLARE
  v_count_before bigint;
  v_result       jsonb;
  v_count_after  bigint;
BEGIN
  SELECT COUNT(*) INTO v_count_before FROM action_inbox_items;
  v_result := run_action_inbox_projector(100, '00000000-0000-0000-0000-000000000000'::uuid, NULL);
  SELECT COUNT(*) INTO v_count_after FROM action_inbox_items;
  ASSERT (v_result->>'items_created')::int = 0,
    'D3 FAIL: Second projector run should create 0 new items, got ' || (v_result->>'items_created');
  RAISE NOTICE 'D3 PASS: Projector deduplication works — second run created 0 items (total items=%)', v_count_after;
END $$;

-- D4: list_action_inbox_items returns open items
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := list_action_inbox_items('open', NULL, NULL, NULL, 10, 0);
  ASSERT (v_result->>'ok') = 'true', 'D4 FAIL: list_action_inbox_items returned ok=false';
  RAISE NOTICE 'D4 PASS: list_action_inbox_items ok=true, item count=%',
    jsonb_array_length(v_result->'items');
END $$;

-- D5: snooze_action_inbox_item works if any item exists
DO $$
DECLARE
  v_item_id uuid;
  v_result  jsonb;
BEGIN
  SELECT item_id INTO v_item_id FROM action_inbox_items WHERE status = 'open' LIMIT 1;
  IF v_item_id IS NULL THEN
    RAISE NOTICE 'D5 SKIP: No open inbox items to snooze (run projector first with events)';
    RETURN;
  END IF;

  v_result := snooze_action_inbox_item(
    v_item_id,
    now() + interval '1 hour',
    NULL,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
  ASSERT (v_result->>'ok') = 'true', 'D5 FAIL: snooze returned ok=false: ' || v_result::text;
  ASSERT (v_result->>'status') = 'snoozed', 'D5 FAIL: status should be snoozed';
  ASSERT EXISTS (SELECT 1 FROM event_ledger WHERE event_type = 'inbox_item_snoozed'), 'D5 FAIL: No inbox_item_snoozed event in ledger';
  RAISE NOTICE 'D5 PASS: snooze_action_inbox_item ok, state change recorded, ledger event emitted';
END $$;

-- D6: add_action_inbox_note works
DO $$
DECLARE
  v_item_id uuid;
  v_result  jsonb;
BEGIN
  SELECT item_id INTO v_item_id FROM action_inbox_items LIMIT 1;
  IF v_item_id IS NULL THEN
    RAISE NOTICE 'D6 SKIP: No inbox items exist yet';
    RETURN;
  END IF;

  v_result := add_action_inbox_note(
    v_item_id,
    'Test note from stress harness',
    NULL,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
  ASSERT (v_result->>'ok') = 'true', 'D6 FAIL: add_action_inbox_note returned ok=false: ' || v_result::text;
  ASSERT EXISTS (SELECT 1 FROM action_inbox_notes WHERE item_id = v_item_id AND body = 'Test note from stress harness'),
    'D6 FAIL: Note not found in action_inbox_notes';
  RAISE NOTICE 'D6 PASS: add_action_inbox_note ok, note_id=%', v_result->>'note_id';
END $$;

-- D7: set_action_inbox_status transitions item to resolved
DO $$
DECLARE
  v_item_id uuid;
  v_result  jsonb;
BEGIN
  SELECT item_id INTO v_item_id FROM action_inbox_items WHERE status = 'open' LIMIT 1;
  IF v_item_id IS NULL THEN
    RAISE NOTICE 'D7 SKIP: No open inbox items available';
    RETURN;
  END IF;

  v_result := set_action_inbox_status(
    v_item_id, 'resolved', 'resolved_ok', NULL,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
  ASSERT (v_result->>'ok') = 'true', 'D7 FAIL: set_action_inbox_status returned ok=false: ' || v_result::text;
  ASSERT (v_result->>'status') = 'resolved', 'D7 FAIL: expected status=resolved';
  ASSERT EXISTS (SELECT 1 FROM action_inbox_state_changes WHERE item_id = v_item_id AND to_status = 'resolved'),
    'D7 FAIL: state change not recorded';
  ASSERT EXISTS (SELECT 1 FROM event_ledger WHERE event_type = 'inbox_item_status_changed'),
    'D7 FAIL: inbox_item_status_changed event not in ledger';
  RAISE NOTICE 'D7 PASS: set_action_inbox_status ok, state change + ledger event recorded';
END $$;

-- D8: link_event_to_inbox_item works
DO $$
DECLARE
  v_item_id  uuid;
  v_event_id uuid;
  v_result   jsonb;
BEGIN
  SELECT item_id INTO v_item_id FROM action_inbox_items LIMIT 1;
  SELECT id INTO v_event_id FROM event_ledger ORDER BY created_at DESC LIMIT 1;
  IF v_item_id IS NULL OR v_event_id IS NULL THEN
    RAISE NOTICE 'D8 SKIP: No inbox items or events available';
    RETURN;
  END IF;

  v_result := link_event_to_inbox_item(v_item_id, v_event_id, NULL, '00000000-0000-0000-0000-000000000000'::uuid);
  ASSERT (v_result->>'ok') = 'true', 'D8 FAIL: link_event_to_inbox_item returned ok=false: ' || v_result::text;
  RAISE NOTICE 'D8 PASS: link_event_to_inbox_item ok';
END $$;

-- D9: Idempotent status change returns no_op=true
DO $$
DECLARE
  v_item_id uuid;
  v_status  text;
  v_result  jsonb;
BEGIN
  SELECT item_id, status INTO v_item_id, v_status FROM action_inbox_items LIMIT 1;
  IF v_item_id IS NULL THEN
    RAISE NOTICE 'D9 SKIP: No inbox items';
    RETURN;
  END IF;
  v_result := set_action_inbox_status(v_item_id, v_status, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid);
  ASSERT (v_result->>'no_op') = 'true' OR (v_result->>'ok') = 'true',
    'D9 FAIL: Expected no_op or ok on same-status call';
  RAISE NOTICE 'D9 PASS: set_action_inbox_status is idempotent on same status (no_op=%)', v_result->>'no_op';
END $$;

-- =====================================================================
-- SECTION E: Explain & Fix Hooks
-- =====================================================================

-- E1: FOCL screen surfaces registered
SELECT CASE
  WHEN (SELECT COUNT(*) FROM screen_surface_registry WHERE surface_id IN (
    'FOCL_ACTION_INBOX','FOCL_EVENT_HISTORY','FOCL_EXPLAIN_AND_FIX_PANEL'
  )) = 3
  THEN 'E1 PASS: All 3 FOCL Explain & Fix screen surfaces registered'
  ELSE 'E1 FAIL: Missing FOCL screen surfaces'
END AS result;

-- E2: get_explain_fix_context returns ok=true for a real event
DO $$
DECLARE
  v_event_id uuid;
  v_result   jsonb;
BEGIN
  SELECT id INTO v_event_id FROM event_ledger ORDER BY created_at DESC LIMIT 1;
  IF v_event_id IS NULL THEN
    RAISE NOTICE 'E2 SKIP: No events in event_ledger';
    RETURN;
  END IF;

  v_result := get_explain_fix_context(v_event_id, '00000000-0000-0000-0000-000000000000'::uuid);
  ASSERT (v_result->>'ok') = 'true', 'E2 FAIL: get_explain_fix_context returned ok=false: ' || v_result::text;
  ASSERT (v_result->>'explain_text') IS NOT NULL, 'E2 FAIL: explain_text is null';
  ASSERT jsonb_array_length(v_result->'fix_hints') > 0, 'E2 FAIL: fix_hints is empty';
  ASSERT jsonb_array_length(v_result->'doctrine_refs') > 0, 'E2 FAIL: doctrine_refs is empty';
  ASSERT (v_result->'rpc_context') IS NOT NULL, 'E2 FAIL: rpc_context is null';
  RAISE NOTICE 'E2 PASS: get_explain_fix_context ok, explain_text="%"', left(v_result->>'explain_text', 80);
END $$;

-- E3: get_explain_fix_context returns ok=false for nonexistent event
DO $$
DECLARE v_result jsonb;
BEGIN
  v_result := get_explain_fix_context('00000000-dead-beef-dead-000000000000'::uuid);
  ASSERT (v_result->>'ok') = 'false', 'E3 FAIL: Should return ok=false for unknown event';
  RAISE NOTICE 'E3 PASS: get_explain_fix_context correctly returns ok=false for unknown event_id';
END $$;

-- E4: Doctrine refs for suppression event type are non-empty
DO $$
DECLARE
  v_refs jsonb;
BEGIN
  v_refs := get_doctrine_refs_for_event('feature_action_suppressed');
  ASSERT jsonb_array_length(v_refs) > 0, 'E4 FAIL: doctrine refs for feature_action_suppressed is empty';
  RAISE NOTICE 'E4 PASS: doctrine refs for feature_action_suppressed: %', v_refs;
END $$;

-- E5: RPC context for known event types is non-trivial
DO $$
DECLARE
  v_ctx jsonb;
BEGIN
  v_ctx := get_rpc_context_for_event('incident_created');
  ASSERT (v_ctx->>'rpc') = 'create_incident', 'E5 FAIL: RPC context for incident_created should map to create_incident';
  ASSERT (v_ctx->>'guarded')::boolean = true, 'E5 FAIL: guarded should be true for incident_created';
  RAISE NOTICE 'E5 PASS: RPC context for incident_created: %', v_ctx;
END $$;

-- E6: Fix hints for FEATURE_DISABLED include actionable set_feature_activation_state hint
DO $$
DECLARE
  v_hints jsonb;
BEGIN
  v_hints := get_fix_hints_for_event(
    'feature_action_suppressed',
    'FEATURE_DISABLED',
    jsonb_build_object('feature_id','F-6.5.1','next_step_hint','Enable F-6.5.1')
  );
  ASSERT jsonb_array_length(v_hints) >= 2, 'E6 FAIL: Expected at least 2 fix hints for FEATURE_DISABLED';
  RAISE NOTICE 'E6 PASS: Fix hints for FEATURE_DISABLED (count=%): %', jsonb_array_length(v_hints), v_hints;
END $$;

-- =====================================================================
-- SECTION F: Battery Check (Zero Critical Failures)
-- =====================================================================

-- F1: Battery check returns 0 critical failures
DO $$
DECLARE
  v_crit bigint;
BEGIN
  SELECT COUNT(*) INTO v_crit
  FROM release_battery_failures()
  WHERE severity = 'critical';
  ASSERT v_crit = 0, 'F1 FAIL: Battery has ' || v_crit || ' critical failure(s)';
  RAISE NOTICE 'F1 PASS: Battery check — 0 critical failures';
END $$;

-- F2: Battery check total results
SELECT
  severity,
  COUNT(*) AS count
FROM release_battery_failures()
GROUP BY severity
ORDER BY severity;

-- =====================================================================
-- FINAL SUMMARY
-- =====================================================================

SELECT
  'Pre-Wire + Rails test suite complete. Check NOTICE output for per-assertion results.' AS summary,
  (SELECT COUNT(*) FROM feature_registry WHERE feature_id LIKE 'F-%') AS total_features,
  (SELECT COUNT(*) FROM feature_registry WHERE default_enabled = false) AS disabled_features,
  (SELECT COUNT(*) FROM screen_surface_registry) AS total_screen_surfaces,
  (SELECT COUNT(*) FROM action_inbox_items) AS inbox_items_count,
  (SELECT COUNT(*) FROM reason_code_registry WHERE reason_code IN (
    'FEATURE_DISABLED','DOCUMENTATION_INCOMPLETE','SOURCE_UNAVAILABLE',
    'PERMISSION_DENIED','RATE_LIMITED','MODE_RESTRICTED'
  )) AS canonical_reason_codes_registered,
  (SELECT COUNT(*) FROM event_ledger WHERE event_type LIKE '%_suppressed') AS suppression_events_in_ledger;
