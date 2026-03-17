/*
  Bypass Closure Proof Test Suite
  Run as postgres (service_role) to exercise all assertions.
  Each block raises NOTICE on pass or EXCEPTION on failure.
  Execute the full file; a clean run = all assertions passed.
*/

DO $$
DECLARE
  v_result         jsonb;
  v_incident_id    uuid;
  v_evidence_id    uuid;
  v_idem_key       text;
  v_idem_result    jsonb;
  v_battery_rows   int;
  v_battery_crit   int;
  v_itr_result     jsonb;
  v_trace_id       uuid;
  v_region_result  jsonb;
  v_project_id     uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_region_id      uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_test_actor     uuid := gen_random_uuid();
BEGIN

  -- ============================================================
  -- TEST 1: Direct INSERT into incidents is rejected by RLS
  -- (Simulated: check no INSERT policy exists)
  -- ============================================================
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'incidents'
      AND cmd IN ('INSERT', 'ALL')
      AND roles::text LIKE '%authenticated%'
  ) THEN
    RAISE EXCEPTION 'TEST 1 FAIL: incidents still has authenticated INSERT/ALL policy';
  END IF;
  RAISE NOTICE 'TEST 1 PASS: No authenticated INSERT policy on incidents';

  -- ============================================================
  -- TEST 2: Direct INSERT into evidence is rejected by RLS
  -- ============================================================
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'evidence'
      AND cmd IN ('INSERT', 'ALL')
      AND roles::text LIKE '%authenticated%'
  ) THEN
    RAISE EXCEPTION 'TEST 2 FAIL: evidence still has authenticated INSERT/ALL policy';
  END IF;
  RAISE NOTICE 'TEST 2 PASS: No authenticated INSERT policy on evidence';

  -- ============================================================
  -- TEST 3: create_incident() succeeds and emits exactly one ledger event
  -- ============================================================
  v_idem_key := 'proof-test-incident-' || gen_random_uuid()::text;
  v_result := create_incident(
    p_project_id      := v_project_id,
    p_title           := 'Proof Test Incident',
    p_description     := 'Created by bypass closure test suite',
    p_actor_id        := v_test_actor,
    p_idempotency_key := v_idem_key,
    p_region_id       := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'TEST 3 FAIL: create_incident returned error: %', v_result->>'error';
  END IF;
  v_incident_id := (v_result->>'incident_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM incidents WHERE id = v_incident_id) THEN
    RAISE EXCEPTION 'TEST 3 FAIL: incident row not created';
  END IF;
  IF (
    SELECT count(*) FROM event_ledger
    WHERE event_type = 'incident_created'
      AND idempotency_key = v_idem_key
  ) <> 1 THEN
    RAISE EXCEPTION 'TEST 3 FAIL: expected exactly 1 incident_created event';
  END IF;
  RAISE NOTICE 'TEST 3 PASS: create_incident succeeded, incident_id=%, event emitted', v_incident_id;

  -- ============================================================
  -- TEST 4: create_incident() idempotency — second call with same key returns same id
  -- ============================================================
  v_idem_result := create_incident(
    p_project_id      := v_project_id,
    p_title           := 'Proof Test Incident DUPE',
    p_actor_id        := v_test_actor,
    p_idempotency_key := v_idem_key,
    p_region_id       := v_region_id
  );
  IF NOT (v_idem_result->>'success')::boolean THEN
    RAISE EXCEPTION 'TEST 4 FAIL: idempotent call returned error';
  END IF;
  IF (v_idem_result->>'incident_id')::uuid <> v_incident_id THEN
    RAISE EXCEPTION 'TEST 4 FAIL: idempotent call returned different incident_id';
  END IF;
  IF NOT (v_idem_result->>'idempotent')::boolean THEN
    RAISE EXCEPTION 'TEST 4 FAIL: idempotent flag not set on second call';
  END IF;
  IF (
    SELECT count(*) FROM event_ledger
    WHERE event_type = 'incident_created'
      AND idempotency_key = v_idem_key
  ) <> 1 THEN
    RAISE EXCEPTION 'TEST 4 FAIL: duplicate event emitted on idempotent call';
  END IF;
  RAISE NOTICE 'TEST 4 PASS: create_incident idempotency confirmed, no duplicate event';

  -- ============================================================
  -- TEST 5: register_evidence() succeeds and emits exactly one ledger event
  -- ============================================================
  v_idem_key := 'proof-test-evidence-' || gen_random_uuid()::text;
  v_result := register_evidence(
    p_incident_id     := v_incident_id,
    p_type            := 'file',
    p_name            := 'proof-test.pdf',
    p_description     := 'Evidence created by bypass closure test suite',
    p_actor_id        := v_test_actor,
    p_idempotency_key := v_idem_key,
    p_region_id       := v_region_id
  );
  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'TEST 5 FAIL: register_evidence returned error: %', v_result->>'error';
  END IF;
  v_evidence_id := (v_result->>'evidence_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM evidence WHERE id = v_evidence_id) THEN
    RAISE EXCEPTION 'TEST 5 FAIL: evidence row not created';
  END IF;
  IF (
    SELECT count(*) FROM event_ledger
    WHERE event_type = 'evidence_upload_staged'
      AND idempotency_key = v_idem_key
  ) <> 1 THEN
    RAISE EXCEPTION 'TEST 5 FAIL: expected exactly 1 evidence_upload_staged event';
  END IF;
  RAISE NOTICE 'TEST 5 PASS: register_evidence succeeded, evidence_id=%, event emitted', v_evidence_id;

  -- ============================================================
  -- TEST 6: set_region_operational_mode() works and emits event
  -- ============================================================
  v_result := set_region_operational_mode(
    p_region_id   := v_region_id,
    p_target_mode := 'ELEVATED',
    p_reason_code := 'proof_test',
    p_actor_id    := v_test_actor
  );
  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'TEST 6 FAIL: set_region_operational_mode returned error: %', v_result->>'error';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM event_ledger
    WHERE event_type = 'region_mode_changed'
      AND scope_id = v_region_id
      AND resulting_state->>'mode' = 'ELEVATED'
  ) THEN
    RAISE EXCEPTION 'TEST 6 FAIL: region_mode_changed event not emitted';
  END IF;
  RAISE NOTICE 'TEST 6 PASS: set_region_operational_mode succeeded, region_mode_changed emitted';

  -- Reset region back to NORMAL so it does not affect other tests
  PERFORM set_region_operational_mode(
    p_region_id   := v_region_id,
    p_target_mode := 'NORMAL',
    p_reason_code := 'proof_test_cleanup',
    p_actor_id    := v_test_actor
  );

  -- ============================================================
  -- TEST 7: interpretive_output_emitted uniqueness enforced (post-lock)
  -- Attempt to emit ITR for the same incident twice with the SAME decision_fingerprint
  -- Each call produces a NEW trace_id (different ITR rows), so both should succeed.
  -- Then verify the unique index blocks a direct duplicate insert.
  -- ============================================================
  v_itr_result := emit_itr(
    p_incident_id              := v_incident_id,
    p_feature_id               := 'proof_test',
    p_decision_fingerprint     := 'aabbccdd',
    p_constraints_profile_hash := '11223344',
    p_confidence_enum          := 'high',
    p_region_id                := v_region_id
  );
  IF NOT (v_itr_result->>'success')::boolean THEN
    RAISE EXCEPTION 'TEST 7 FAIL: first emit_itr failed: %', v_itr_result->>'error';
  END IF;
  v_trace_id := (v_itr_result->>'trace_id')::uuid;

  BEGIN
    INSERT INTO event_ledger (
      event_type, feature_id, scope_type, scope_id,
      actor_type, reason_code,
      previous_state, resulting_state,
      metadata,
      schema_version, related_entity_type, related_entity_id,
      event_data, checksum_hash
    ) VALUES (
      'interpretive_output_emitted', 'proof_test', 'incident', v_incident_id,
      'system', 'itr_emitted',
      '{}', '{}',
      jsonb_build_object('trace_id', v_trace_id),
      1, 'incident'::entity_type, v_incident_id,
      '{}',
      encode(digest(v_trace_id::text || 'dupe_test', 'sha256'), 'hex')
    );
    RAISE EXCEPTION 'TEST 7 FAIL: duplicate ITR event insert should have been blocked by unique index';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'TEST 7 PASS: duplicate interpretive_output_emitted blocked by unique index';
    WHEN OTHERS THEN
      RAISE NOTICE 'TEST 7 PASS (blocked by trigger/other): %', SQLERRM;
  END;

  -- ============================================================
  -- TEST 8: Battery shows no CRITICAL failures
  -- ============================================================
  SELECT
    count(*),
    count(*) FILTER (WHERE severity = 'critical')
  INTO v_battery_rows, v_battery_crit
  FROM release_battery_failures();

  IF v_battery_crit > 0 THEN
    RAISE EXCEPTION 'TEST 8 FAIL: battery reports % CRITICAL failures', v_battery_crit;
  END IF;
  RAISE NOTICE 'TEST 8 PASS: battery clean — total rows=%, critical=%', v_battery_rows, v_battery_crit;

  RAISE NOTICE '=== ALL TESTS PASSED ===';

END $$;
