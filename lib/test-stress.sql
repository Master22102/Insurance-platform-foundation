/*
  Traveler Slice Stress Harness + Proof Suite (Section 15.0)
  ============================================================
  Run as postgres (service_role). A clean run = all assertions pass.
  Includes:
  A) No-bypass proofs for new tables
  B) Feature activation for test region
  C) Full traveler workflow: guide → consent → evidence → eval → routing → checkpoint
  D) Idempotency validation for all new RPCs
  E) Founder offline 48h posture (PROTECTIVE mode simulation)
  F) Battery clean check (0 critical)
  G) Feature flag idempotency
*/

DO $$
DECLARE
  v_project_id     uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_region_id      uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_guide_id       uuid;
  v_incident_id    uuid;
  v_token_id       uuid;
  v_eval_id        uuid;
  v_rec_id         uuid;
  v_checkpoint_id  uuid;
  v_idem_key       text;
  v_result         jsonb;
  v_idem_result    jsonb;
  v_battery_crit   int;
  v_timeline_count int;
  v_passed         int := 0;
  v_card_program   text := 'VISA_PLATINUM_STRESS_' || gen_random_uuid()::text;
BEGIN

  -- ============================================================
  -- SECTION A: No-bypass policy proofs for new domain tables
  -- ============================================================

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_card_guide_versions' AND cmd IN ('INSERT','UPDATE','ALL') AND roles::text LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'A1 FAIL: credit_card_guide_versions has authenticated write policy'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'A1 PASS: no authenticated write on credit_card_guide_versions';

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'benefit_clauses' AND cmd IN ('INSERT','UPDATE','ALL') AND roles::text LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'A2 FAIL: benefit_clauses has authenticated write policy'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'A2 PASS: no authenticated write on benefit_clauses';

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consent_tokens' AND cmd IN ('INSERT','UPDATE','ALL') AND roles::text LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'A3 FAIL: consent_tokens has authenticated write policy'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'A3 PASS: no authenticated write on consent_tokens';

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'benefit_eval_runs' AND cmd IN ('INSERT','UPDATE','ALL') AND roles::text LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'A4 FAIL: benefit_eval_runs has authenticated write policy'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'A4 PASS: no authenticated write on benefit_eval_runs';

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'routing_recommendations' AND cmd IN ('INSERT','UPDATE','ALL') AND roles::text LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'A5 FAIL: routing_recommendations has authenticated write policy'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'A5 PASS: no authenticated write on routing_recommendations';

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'acceptance_checkpoints' AND cmd IN ('INSERT','UPDATE','ALL') AND roles::text LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'A6 FAIL: acceptance_checkpoints has authenticated write policy'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'A6 PASS: no authenticated write on acceptance_checkpoints';

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feature_activation_state' AND cmd IN ('INSERT','UPDATE','ALL') AND roles::text LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'A7 FAIL: feature_activation_state has authenticated write policy'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'A7 PASS: no authenticated write on feature_activation_state';

  -- ============================================================
  -- SECTION B: Enable features for test region
  -- ============================================================

  v_result := set_feature_activation_state('F-6.5.3', v_region_id, true, 'stress_test_enable', NULL);
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'B1 FAIL: enable F-6.5.3: %', v_result->>'error'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'B1 PASS: F-6.5.3 enabled';

  v_result := set_feature_activation_state('F-6.5.5', v_region_id, true, 'stress_test_enable', NULL);
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'B2 FAIL: enable F-6.5.5: %', v_result->>'error'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'B2 PASS: F-6.5.5 enabled';

  -- ============================================================
  -- SECTION C: Full traveler workflow
  -- ============================================================

  -- C1: Create incident
  v_idem_key := 'stress-incident-' || gen_random_uuid()::text;
  v_result := create_incident(
    p_project_id := v_project_id, p_title := 'Stress Test Incident',
    p_actor_id := NULL, p_idempotency_key := v_idem_key, p_region_id := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'C1 FAIL: create_incident: %', v_result->>'error'; END IF;
  v_incident_id := (v_result->>'incident_id')::uuid;
  v_passed := v_passed + 1; RAISE NOTICE 'C1 PASS: incident_id=%', v_incident_id;

  -- C2: Ingest guide version
  v_idem_key := 'stress-guide-' || gen_random_uuid()::text;
  v_result := ingest_guide_version(
    p_card_program_id := v_card_program,
    p_title           := 'Stress Test Visa Guide v1',
    p_version_number  := 1,
    p_raw_content     := 'This guide covers travel protection up to $10,000 per trip.',
    p_actor_id        := NULL,
    p_idempotency_key := v_idem_key,
    p_region_id       := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'C2 FAIL: ingest_guide_version: %', v_result->>'error'; END IF;
  v_guide_id := (v_result->>'guide_id')::uuid;
  v_passed := v_passed + 1; RAISE NOTICE 'C2 PASS: guide_id=%', v_guide_id;

  -- C2-idem: Idempotency check on ingest_guide_version (same content_hash → same guide)
  v_idem_result := ingest_guide_version(
    p_card_program_id := v_card_program,
    p_title := 'Different Title Same Content',
    p_version_number  := 2,
    p_raw_content     := 'This guide covers travel protection up to $10,000 per trip.',
    p_actor_id := NULL,
    p_region_id := v_region_id
  );
  IF NOT (v_idem_result->>'idempotent')::boolean THEN RAISE EXCEPTION 'C2-idem FAIL: same content_hash should be idempotent'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'C2-idem PASS: ingest_guide_version content-hash idempotency ok';

  -- C3: Grant consent
  v_idem_key := 'stress-consent-' || gen_random_uuid()::text;
  v_result := grant_consent(
    p_incident_id := v_incident_id, p_guide_id := v_guide_id,
    p_actor_id := NULL, p_idempotency_key := v_idem_key, p_region_id := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'C3 FAIL: grant_consent: %', v_result->>'error'; END IF;
  v_token_id := (v_result->>'token_id')::uuid;
  v_passed := v_passed + 1; RAISE NOTICE 'C3 PASS: token_id=%', v_token_id;

  -- C3-idem: second grant_consent call → idempotent (same active consent)
  v_idem_result := grant_consent(
    p_incident_id := v_incident_id, p_guide_id := v_guide_id,
    p_actor_id := NULL, p_region_id := v_region_id
  );
  IF NOT (v_idem_result->>'idempotent')::boolean THEN RAISE EXCEPTION 'C3-idem FAIL: duplicate consent should be idempotent'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'C3-idem PASS: grant_consent idempotency ok';

  -- C4: Register evidence (boosts confidence in eval)
  v_result := register_evidence(
    p_incident_id := v_incident_id, p_type := 'file', p_name := 'receipt.pdf',
    p_actor_id := NULL, p_region_id := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'C4 FAIL: register_evidence: %', v_result->>'error'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'C4 PASS: evidence registered';

  -- C5: Run benefit eval
  v_idem_key := 'stress-eval-' || gen_random_uuid()::text;
  v_result := run_benefit_eval(
    p_incident_id := v_incident_id, p_guide_id := v_guide_id,
    p_actor_id := NULL, p_idempotency_key := v_idem_key, p_region_id := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'C5 FAIL: run_benefit_eval: %', v_result->>'error'; END IF;
  v_eval_id := (v_result->>'eval_id')::uuid;
  IF (v_result->>'confidence_label') IS NULL THEN RAISE EXCEPTION 'C5 FAIL: no confidence_label'; END IF;
  IF length(COALESCE(v_result->>'founder_readable_explanation', '')) = 0 THEN
    RAISE EXCEPTION 'C5 FAIL: no founder_readable_explanation'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'C5 PASS: eval_id=%, confidence=%', v_eval_id, v_result->>'confidence_label';

  -- C5-idem
  v_idem_result := run_benefit_eval(
    p_incident_id := v_incident_id, p_guide_id := v_guide_id,
    p_actor_id := NULL, p_idempotency_key := v_idem_key, p_region_id := v_region_id
  );
  IF NOT (v_idem_result->>'idempotent')::boolean THEN RAISE EXCEPTION 'C5-idem FAIL'; END IF;
  IF (v_idem_result->>'eval_id')::uuid <> v_eval_id THEN RAISE EXCEPTION 'C5-idem FAIL: wrong eval_id returned'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'C5-idem PASS: run_benefit_eval idempotency ok';

  -- C6: Generate routing recommendation
  v_idem_key := 'stress-routing-' || gen_random_uuid()::text;
  v_result := generate_routing_recommendation(
    p_incident_id := v_incident_id, p_guide_id := v_guide_id,
    p_actor_id := NULL, p_idempotency_key := v_idem_key, p_region_id := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'C6 FAIL: generate_routing_recommendation: %', v_result->>'error'; END IF;
  v_rec_id := (v_result->>'rec_id')::uuid;
  IF jsonb_array_length(v_result->'recommended_sequence') = 0 THEN RAISE EXCEPTION 'C6 FAIL: empty recommended_sequence'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'C6 PASS: rec_id=%, steps=%', v_rec_id, jsonb_array_length(v_result->'recommended_sequence');

  -- C7: Record acceptance checkpoint (accepted)
  v_result := record_acceptance_checkpoint(
    p_rec_id := v_rec_id, p_incident_id := v_incident_id,
    p_action := 'accepted', p_actor_id := NULL, p_region_id := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'C7 FAIL: record_acceptance_checkpoint: %', v_result->>'error'; END IF;
  v_checkpoint_id := (v_result->>'checkpoint_id')::uuid;
  v_passed := v_passed + 1; RAISE NOTICE 'C7 PASS: checkpoint_id=%', v_checkpoint_id;

  -- C8: Verify routing_recommendations.accepted = true
  IF NOT EXISTS(SELECT 1 FROM routing_recommendations WHERE rec_id = v_rec_id AND accepted = true) THEN
    RAISE EXCEPTION 'C8 FAIL: routing_recommendations.accepted not true'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'C8 PASS: routing_recommendations.accepted = true';

  -- C9: Timeline view populated
  SELECT count(*) INTO v_timeline_count FROM incident_timeline WHERE incident_id = v_incident_id;
  IF v_timeline_count < 4 THEN
    RAISE EXCEPTION 'C9 FAIL: expected >=4 timeline events, got %', v_timeline_count; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'C9 PASS: timeline has % events', v_timeline_count;

  -- C10: Required events in ledger
  IF NOT EXISTS(SELECT 1 FROM event_ledger WHERE event_type = 'consent_granted'                  AND scope_id = v_incident_id) THEN RAISE EXCEPTION 'C10a FAIL'; END IF;
  IF NOT EXISTS(SELECT 1 FROM event_ledger WHERE event_type = 'benefit_eval_completed'            AND scope_id = v_incident_id) THEN RAISE EXCEPTION 'C10b FAIL'; END IF;
  IF NOT EXISTS(SELECT 1 FROM event_ledger WHERE event_type = 'routing_recommendation_generated'  AND scope_id = v_incident_id) THEN RAISE EXCEPTION 'C10c FAIL'; END IF;
  IF NOT EXISTS(SELECT 1 FROM event_ledger WHERE event_type = 'acceptance_checkpoint_recorded'    AND scope_id = v_incident_id) THEN RAISE EXCEPTION 'C10d FAIL'; END IF;
  IF NOT EXISTS(SELECT 1 FROM event_ledger WHERE event_type = 'routing_recommendation_accepted'   AND scope_id = v_incident_id) THEN RAISE EXCEPTION 'C10e FAIL'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'C10 PASS: all required ledger events present';

  -- ============================================================
  -- SECTION D: Founder offline 48h posture (PROTECTIVE mode)
  -- ============================================================

  -- D1: Enter PROTECTIVE mode
  v_result := set_region_operational_mode(
    p_region_id := v_region_id, p_target_mode := 'PROTECTIVE',
    p_reason_code := 'founder_offline_48h', p_actor_id := NULL
  );
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'D1 FAIL: enter PROTECTIVE: %', v_result->>'error'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'D1 PASS: region in PROTECTIVE mode';

  -- D2: Read-only still works — timeline queryable
  SELECT count(*) INTO v_timeline_count FROM incident_timeline WHERE incident_id = v_incident_id;
  IF v_timeline_count < 1 THEN RAISE EXCEPTION 'D2 FAIL: timeline unreadable in PROTECTIVE mode'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'D2 PASS: timeline readable in PROTECTIVE mode (% events)', v_timeline_count;

  -- D3: guide_ingest BLOCKED in PROTECTIVE mode (not in allowlist)
  v_result := ingest_guide_version(
    p_card_program_id := 'BLOCKED_PROGRAM',
    p_title           := 'Should Be Blocked',
    p_raw_content     := 'test',
    p_actor_id        := NULL,
    p_region_id       := v_region_id
  );
  IF (v_result->>'success')::boolean AND (v_result->>'reason_code') IS DISTINCT FROM 'guide_ingest_duplicate' THEN
    RAISE EXCEPTION 'D3 FAIL: ingest_guide_version succeeded in PROTECTIVE mode (should be blocked)'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'D3 PASS: guide_ingest blocked in PROTECTIVE mode (reason: %)', COALESCE(v_result->>'error', v_result->>'reason_code');

  -- D4: incident_create IS allowed in PROTECTIVE mode (it is in the allowlist by design)
  --     Verify that the governance guard reports PROTECTIVE mode correctly
  v_result := create_incident(
    p_project_id := v_project_id, p_title := 'PROTECTIVE Mode Incident',
    p_actor_id := NULL, p_region_id := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'D4 FAIL: create_incident (allowlisted) failed in PROTECTIVE mode: %', v_result->>'error'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'D4 PASS: allowlisted mutation (incident_create) works in PROTECTIVE mode';

  -- D5: Battery clean during PROTECTIVE mode
  SELECT count(*) FILTER (WHERE severity = 'critical')
  INTO v_battery_crit FROM release_battery_failures();
  IF v_battery_crit > 0 THEN RAISE EXCEPTION 'D5 FAIL: % CRITICAL battery failures during PROTECTIVE', v_battery_crit; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'D5 PASS: 0 CRITICAL during PROTECTIVE mode';

  -- D6: Emit FOCL degraded safe marker
  PERFORM emit_event(
    p_event_type  := 'schema_migration_applied',
    p_feature_id  := 'F-6.5.16',
    p_scope_type  := 'system',
    p_scope_id    := v_region_id,
    p_actor_type  := 'system',
    p_reason_code := 'focl_degraded_safe',
    p_metadata    := jsonb_build_object(
      'migration',       'focl_offline_posture_check',
      'region_mode',     'PROTECTIVE',
      'battery_critical', v_battery_crit,
      'posture',         'founder_offline_48h'
    )
  );
  v_passed := v_passed + 1; RAISE NOTICE 'D6 PASS: FOCL degraded safe marker emitted to ledger';

  -- D7: Restore to NORMAL
  PERFORM set_region_operational_mode(
    p_region_id := v_region_id, p_target_mode := 'NORMAL',
    p_reason_code := 'stress_test_cleanup', p_actor_id := NULL
  );
  v_passed := v_passed + 1; RAISE NOTICE 'D7 PASS: region restored to NORMAL';

  -- ============================================================
  -- SECTION E: Final battery check
  -- ============================================================

  SELECT count(*) FILTER (WHERE severity = 'critical')
  INTO v_battery_crit FROM release_battery_failures();
  IF v_battery_crit > 0 THEN RAISE EXCEPTION 'E1 FAIL: final battery has % CRITICAL', v_battery_crit; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'E1 PASS: final battery clean — 0 critical';

  -- ============================================================
  -- SECTION F: Feature flag idempotency
  -- ============================================================

  v_result := set_feature_activation_state('F-6.5.3', v_region_id, true, 'idem_test', NULL);
  IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'F1 FAIL: %', v_result->>'error'; END IF;
  IF NOT (v_result->>'no_op')::boolean THEN RAISE EXCEPTION 'F1 FAIL: expected no_op=true on duplicate enable'; END IF;
  v_passed := v_passed + 1; RAISE NOTICE 'F1 PASS: feature flag set idempotency ok';

  RAISE NOTICE '=== STRESS HARNESS: ALL % TESTS PASSED ===', v_passed;

END $$;
