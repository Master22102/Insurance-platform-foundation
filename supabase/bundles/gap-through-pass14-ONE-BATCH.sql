/* =============================================================================
   ONE-BATCH GAP MIGRATIONS (generated — do not edit by hand)
   SKIPPED (already applied on target): 20260321170000_section41_policy_governance_determinism.sql
   Remaining: 14 files from 20260321183000 … 20260323151000

   Regenerate:  npm run bundle:gap-migrations
   See: docs/REPO_VS_DATABASE.md
   ============================================================================= */



-- >>>>>>> BEGIN: 20260321183000_policy_parse_confidence_event_enrichment.sql <<<<<<

/*
  Enforce 9.2 confidence metadata on policy parse events.

  Applies to policy_parse_complete and policy_parse_partial events before insert
  into event_ledger so records stay append-only while carrying deterministic
  confidence logging fields.
*/

CREATE OR REPLACE FUNCTION enrich_policy_parse_confidence_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_clause_ids uuid[] := ARRAY[]::uuid[];
  v_version_id uuid;
  v_confidence_label text;
BEGIN
  IF NEW.event_type NOT IN ('policy_parse_complete', 'policy_parse_partial') THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type = 'policy_parse_complete' THEN
    v_confidence_label := 'HIGH_STRUCTURAL_ALIGNMENT';
  ELSE
    v_confidence_label := 'CONDITIONAL_ALIGNMENT';
  END IF;

  IF NEW.metadata ? 'version_id' THEN
    v_version_id := NULLIF(NEW.metadata->>'version_id', '')::uuid;
    IF v_version_id IS NOT NULL THEN
      SELECT COALESCE(array_agg(clause_id), ARRAY[]::uuid[])
      INTO v_clause_ids
      FROM policy_clauses
      WHERE policy_version_id = v_version_id;
    END IF;
  ELSIF NEW.scope_type = 'policy_document' THEN
    SELECT COALESCE(array_agg(clause_id), ARRAY[]::uuid[])
    INTO v_clause_ids
    FROM policy_clauses
    WHERE policy_document_id = NEW.scope_id;
  END IF;

  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'confidence_label', v_confidence_label,
      'confidence_version', '9.2.v1',
      'clause_ids_referenced', to_jsonb(v_clause_ids),
      'cco_reference_id', null
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrich_policy_parse_confidence_metadata ON event_ledger;
CREATE TRIGGER trg_enrich_policy_parse_confidence_metadata
BEFORE INSERT ON event_ledger
FOR EACH ROW
EXECUTE FUNCTION enrich_policy_parse_confidence_metadata();


-- >>>>>>> END: 20260321183000_policy_parse_confidence_event_enrichment.sql <<<<<<


-- >>>>>>> BEGIN: 20260321193000_atomic_policy_parse_enqueue.sql <<<<<<

/*
  Enforce strict enqueue behavior for policy parsing:
  - document update + job_queue insert + event emit are atomic
  - any failure rolls back the mutation
*/

CREATE OR REPLACE FUNCTION enqueue_policy_parse_job_atomic(
  p_document_id uuid,
  p_account_id uuid,
  p_storage_path text,
  p_policy_label text,
  p_trip_id uuid DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_file_size_bytes bigint DEFAULT NULL,
  p_mime_type text DEFAULT NULL,
  p_content_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_doc policy_documents%ROWTYPE;
  v_job_id uuid;
  v_emit jsonb;
BEGIN
  SELECT *
  INTO v_doc
  FROM policy_documents
  WHERE document_id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'DOCUMENT_NOT_FOUND');
  END IF;

  IF v_doc.account_id <> p_account_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'FORBIDDEN');
  END IF;

  UPDATE policy_documents
  SET
    raw_artifact_path = p_storage_path,
    file_size_bytes = COALESCE(p_file_size_bytes, file_size_bytes),
    mime_type = COALESCE(p_mime_type, mime_type),
    content_hash = COALESCE(p_content_hash, content_hash),
    document_status = 'queued',
    updated_at = now()
  WHERE document_id = p_document_id;

  INSERT INTO job_queue (
    job_name,
    job_type,
    payload,
    status,
    max_retries
  )
  VALUES (
    'extract-' || p_document_id::text,
    'policy_parse',
    jsonb_build_object(
      'document_id', p_document_id,
      'policy_id', v_doc.policy_id,
      'account_id', p_account_id,
      'trip_id', COALESCE(p_trip_id, v_doc.trip_id),
      'storage_path', p_storage_path,
      'original_filename', p_policy_label,
      'source_type', p_source_type
    ),
    'pending',
    3
  )
  RETURNING id INTO v_job_id;

  v_emit := emit_event(
    p_event_type := 'policy_parse_queued',
    p_feature_id := 'F-6.5.1',
    p_scope_type := 'policy_document',
    p_scope_id := p_document_id,
    p_actor_id := p_account_id,
    p_actor_type := 'system',
    p_reason_code := 'UPLOAD_CONFIRMED',
    p_metadata := jsonb_build_object(
      'job_id', v_job_id,
      'policy_id', v_doc.policy_id
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', v_job_id,
    'policy_id', v_doc.policy_id,
    'document_id', p_document_id,
    'status', 'QUEUED'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION enqueue_policy_parse_job_atomic(
  uuid, uuid, text, text, uuid, text, bigint, text, text
) TO service_role;


-- >>>>>>> END: 20260321193000_atomic_policy_parse_enqueue.sql <<<<<<


-- >>>>>>> BEGIN: 20260321200000_strict_quick_scan_credit_consumption.sql <<<<<<

/*
  Enforce strict emit-or-rollback for quick scan credit consumption.
  This function is intended for server-side quick scan flow usage.
*/

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES ('quick_scan_credit_consumed', 1, 'scans', 'info')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION consume_basic_scan_credit_strict(
  p_user_id uuid,
  p_reason text DEFAULT 'quick_scan_used'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_balance_after integer;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT *
  INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  IF v_profile.scan_credits_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_credits_remaining');
  END IF;

  v_balance_after := v_profile.scan_credits_remaining - 1;

  UPDATE user_profiles
  SET
    scan_credits_remaining = v_balance_after,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO scan_credit_ledger (
    account_id,
    credit_type,
    credit_delta,
    balance_after,
    reason
  ) VALUES (
    p_user_id,
    'basic',
    -1,
    v_balance_after,
    p_reason
  );

  v_emit := emit_event(
    p_event_type := 'quick_scan_credit_consumed',
    p_feature_id := 'scans',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'quick_scan_credit_decrement',
    p_previous_state := jsonb_build_object('scan_credits_remaining', v_profile.scan_credits_remaining),
    p_resulting_state := jsonb_build_object('scan_credits_remaining', v_balance_after),
    p_metadata := jsonb_build_object('reason', p_reason)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  IF v_balance_after = 0 THEN
    v_emit := emit_event(
      p_event_type := 'scan_credits_depleted',
      p_feature_id := 'accounts',
      p_scope_type := 'user',
      p_scope_id := p_user_id,
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := 'basic_credits_depleted',
      p_metadata := jsonb_build_object('scan_type', 'basic', 'membership_tier', v_profile.membership_tier)
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'scan_credits_remaining', v_balance_after
  );
END;
$$;

GRANT EXECUTE ON FUNCTION consume_basic_scan_credit_strict(uuid, text) TO authenticated;


-- >>>>>>> END: 20260321200000_strict_quick_scan_credit_consumption.sql <<<<<<


-- >>>>>>> BEGIN: 20260321213000_strict_deep_scan_emit_or_rollback.sql <<<<<<

/*
  Deep Scan hardening:
  - enforce emit_event success checks (raise -> rollback)
  - keep compatibility for frontend expecting scan_id
*/

CREATE OR REPLACE FUNCTION public.initiate_deep_scan(
  p_user_id uuid,
  p_trip_id uuid,
  p_itinerary_snapshot jsonb,
  p_user_confirmed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_hash text;
  v_job_id uuid;
  v_emit jsonb;
  v_missing integer := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF NOT p_user_confirmed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'explicit_user_confirmation_required',
      'message', 'Deep Scan requires explicit user confirmation before credit is consumed.'
    );
  END IF;

  SELECT *
  INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
    AND account_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;

  IF NOT v_trip.paid_unlock THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked');
  END IF;

  IF v_trip.is_group_trip THEN
    SELECT count(*)::int
    INTO v_missing
    FROM public.group_participants gp
    WHERE gp.trip_id = p_trip_id
      AND gp.status = 'active'
      AND (
        gp.residence_country_code IS NULL
        OR btrim(gp.residence_country_code) = ''
        OR (
          upper(gp.residence_country_code) = 'US'
          AND (gp.residence_state_code IS NULL OR btrim(gp.residence_state_code) = '')
        )
      );

    IF v_missing > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'group_residence_incomplete',
        'missing_participants', v_missing,
        'message', 'Deep Scan can filter insurance options based on where each traveler lives. Some participants have not added their location yet.'
      );
    END IF;
  END IF;

  IF v_trip.deep_scan_credits_remaining <= 0 THEN
    v_emit := emit_event(
      p_event_type := 'deep_scan_credit_purchase_required',
      p_feature_id := 'scans',
      p_scope_type := 'trip',
      p_scope_id := p_trip_id,
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := 'credits_exhausted',
      p_metadata := jsonb_build_object('trip_id', p_trip_id)
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_deep_scan_credits_remaining',
      'purchase_required', true,
      'credits_remaining', 0
    );
  END IF;

  v_hash := encode(digest(p_itinerary_snapshot::text, 'sha256'), 'hex');

  UPDATE public.trips
  SET deep_scan_credits_remaining = deep_scan_credits_remaining - 1
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(
    p_event_type := 'deep_scan_credit_consumed',
    p_feature_id := 'trips',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_initiated',
    p_previous_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining),
    p_resulting_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining - 1),
    p_metadata := jsonb_build_object(
      'trip_id', p_trip_id,
      'credits_before', v_trip.deep_scan_credits_remaining,
      'credits_after', v_trip.deep_scan_credits_remaining - 1
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  INSERT INTO public.job_queue (job_type, status, payload)
  VALUES (
    'deep_scan',
    'pending',
    jsonb_build_object(
      'user_id', p_user_id,
      'trip_id', p_trip_id,
      'itinerary_hash', v_hash,
      'itinerary_data', p_itinerary_snapshot
    )
  )
  RETURNING id INTO v_job_id;

  v_emit := emit_event(
    p_event_type := 'deep_scan_requested',
    p_feature_id := 'scans',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_confirmed',
    p_metadata := jsonb_build_object(
      'job_id', v_job_id,
      'itinerary_hash', v_hash,
      'credits_remaining', v_trip.deep_scan_credits_remaining - 1
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'scan_id', v_job_id,
    'itinerary_hash', v_hash,
    'credits_remaining', v_trip.deep_scan_credits_remaining - 1,
    'credit_event_id', v_emit->>'event_id'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.initiate_deep_scan(uuid, uuid, jsonb, boolean) TO authenticated;


-- >>>>>>> END: 20260321213000_strict_deep_scan_emit_or_rollback.sql <<<<<<


-- >>>>>>> BEGIN: 20260321220000_strict_quick_scan_emit_or_rollback.sql <<<<<<

/*
  Quick Scan hardening:
  - enforce emit_event success checks (raise -> rollback)
  - add explicit search_path for security
*/

CREATE OR REPLACE FUNCTION initiate_quick_scan(
  p_user_id uuid,
  p_itinerary_snapshot jsonb,
  p_trip_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_trip trips%ROWTYPE;
  v_hash text;
  v_job_id uuid;
  v_cached_job uuid;
  v_emit jsonb;
  v_is_paid boolean := (p_trip_id IS NOT NULL);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT *
  INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_hash := encode(digest(p_itinerary_snapshot::text, 'sha256'), 'hex');

  IF NOT v_is_paid THEN
    IF v_profile.lifetime_quick_scans_used >= 2 THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_rate_limited',
        p_feature_id := 'scans',
        p_scope_type := 'user',
        p_scope_id := p_user_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'lifetime_cap_reached',
        p_metadata := jsonb_build_object(
          'lifetime_scans_used', v_profile.lifetime_quick_scans_used,
          'lifetime_cap', 2
        )
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'lifetime_quick_scan_cap_reached',
        'paywall', true,
        'scans_used', v_profile.lifetime_quick_scans_used,
        'conversion_prompt', 'unlock_trip'
      );
    END IF;

    SELECT j.id
    INTO v_cached_job
    FROM job_queue j
    WHERE j.job_type = 'quick_scan'
      AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'user_id' = p_user_id::text
      AND j.created_at > now() - interval '7 days'
      AND j.status = 'completed'
    ORDER BY j.created_at DESC
    LIMIT 1;

    IF v_cached_job IS NOT NULL THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_cache_hit',
        p_feature_id := 'scans',
        p_scope_type := 'user',
        p_scope_id := p_user_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'identical_itinerary_hash',
        p_metadata := jsonb_build_object('cached_job_id', v_cached_job, 'hash', v_hash)
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'hash', v_hash);
    END IF;

    UPDATE user_profiles
    SET
      lifetime_quick_scans_used = lifetime_quick_scans_used + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    SELECT *
    INTO v_trip
    FROM trips
    WHERE trip_id = p_trip_id
      AND account_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
    END IF;
    IF NOT v_trip.paid_unlock THEN
      RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked');
    END IF;

    IF v_trip.quick_scan_week_reset_at < now() - interval '7 days' THEN
      UPDATE trips
      SET
        quick_scans_used_this_week = 0,
        quick_scan_week_reset_at = now()
      WHERE trip_id = p_trip_id;
      v_trip.quick_scans_used_this_week := 0;
    END IF;

    IF v_trip.quick_scans_used_this_week >= 4 THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_rate_limited',
        p_feature_id := 'scans',
        p_scope_type := 'trip',
        p_scope_id := p_trip_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'weekly_limit_reached',
        p_metadata := jsonb_build_object(
          'trip_id', p_trip_id,
          'scans_this_week', v_trip.quick_scans_used_this_week
        )
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'weekly_quick_scan_limit_reached',
        'scans_used', v_trip.quick_scans_used_this_week,
        'resets_at', v_trip.quick_scan_week_reset_at + interval '7 days'
      );
    END IF;

    SELECT j.id
    INTO v_cached_job
    FROM job_queue j
    WHERE j.job_type = 'quick_scan'
      AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'trip_id' = p_trip_id::text
      AND j.created_at > now() - interval '7 days'
      AND j.status = 'completed'
    ORDER BY j.created_at DESC
    LIMIT 1;

    IF v_cached_job IS NOT NULL THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_cache_hit',
        p_feature_id := 'scans',
        p_scope_type := 'trip',
        p_scope_id := p_trip_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'identical_itinerary_hash',
        p_metadata := jsonb_build_object('cached_job_id', v_cached_job)
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'hash', v_hash);
    END IF;

    UPDATE trips
    SET quick_scans_used_this_week = quick_scans_used_this_week + 1
    WHERE trip_id = p_trip_id;
  END IF;

  INSERT INTO job_queue (job_type, status, payload)
  VALUES (
    'quick_scan',
    'pending',
    jsonb_build_object(
      'user_id', p_user_id,
      'trip_id', p_trip_id,
      'itinerary_hash', v_hash,
      'itinerary_data', p_itinerary_snapshot,
      'scan_tier', CASE WHEN v_is_paid THEN 'paid' ELSE 'free' END
    )
  )
  RETURNING id INTO v_job_id;

  v_emit := emit_event(
    p_event_type := 'quick_scan_requested',
    p_feature_id := 'scans',
    p_scope_type := CASE WHEN v_is_paid THEN 'trip' ELSE 'user' END,
    p_scope_id := COALESCE(p_trip_id, p_user_id),
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_initiated',
    p_metadata := jsonb_build_object(
      'job_id', v_job_id,
      'itinerary_hash', v_hash,
      'scan_tier', CASE WHEN v_is_paid THEN 'paid' ELSE 'free' END,
      'trip_id', p_trip_id
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cache_hit', false,
    'job_id', v_job_id,
    'itinerary_hash', v_hash,
    'event_id', v_emit->>'event_id'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION initiate_quick_scan(uuid, jsonb, uuid) TO authenticated;


-- >>>>>>> END: 20260321220000_strict_quick_scan_emit_or_rollback.sql <<<<<<


-- >>>>>>> BEGIN: 20260322110000_f662_protective_safety_mode_foundation.sql <<<<<<

/*
  F-6.6.2 Protective Safety Mode (PSM) foundation.
  - Regional trigger log for PSM episodes
  - Deterministic enter/exit helpers with cooldown
  - Read-model helper for blocked operations messaging
  - Expanded PROTECTIVE allowlist in precheck_mutation_guard
*/

CREATE TABLE IF NOT EXISTS protective_mode_triggers (
  trigger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  trigger_reason text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_psm_triggers_region_detected
  ON protective_mode_triggers(region_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_psm_triggers_region_unresolved
  ON protective_mode_triggers(region_id)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS protective_mode_resource_allocations (
  allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  resource_type text NOT NULL,
  allocation_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NULL,
  allocated_by uuid NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_psm_allocations_region_active
  ON protective_mode_resource_allocations(region_id, allocated_at DESC);

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('protective_mode_entered', 1, 'F-6.6.2', 'critical'),
  ('protective_mode_exited', 1, 'F-6.6.2', 'info'),
  ('protective_mode_resource_allocated', 1, 'F-6.6.2', 'warning'),
  ('psm_flapping_detected', 1, 'F-6.6.2', 'warning'),
  ('psm_activation_failure', 1, 'F-6.6.2', 'critical')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION enter_protective_safety_mode(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_trigger_reason text DEFAULT 'unknown_trigger',
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_mode text;
  v_mode_result jsonb;
  v_emit jsonb;
  v_trigger_id uuid;
BEGIN
  SELECT mode INTO v_prev_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  v_mode_result := set_region_operational_mode(
    p_region_id := p_region_id,
    p_target_mode := 'PROTECTIVE',
    p_reason_code := p_trigger_reason,
    p_actor_id := p_actor_id
  );
  IF COALESCE((v_mode_result->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_mode_result->>'error', 'mode_transition_failed'));
  END IF;

  INSERT INTO protective_mode_triggers (region_id, trigger_reason, metadata)
  VALUES (
    p_region_id,
    p_trigger_reason,
    jsonb_build_object(
      'entered_from_mode', COALESCE(v_prev_mode, 'UNKNOWN'),
      'mode_event_id', v_mode_result->>'event_id'
    ) || COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING trigger_id INTO v_trigger_id;

  -- Disable high-risk features while region is in protective posture.
  UPDATE feature_activation_state
  SET enabled = false,
      reason_code = 'protective_mode_active',
      activated_by = COALESCE(p_actor_id, activated_by)
  WHERE region_id = p_region_id
    AND feature_id IN ('F-6.5.13', 'F-10.3', 'F-6.5.14');

  v_emit := emit_event(
    p_event_type := 'protective_mode_entered',
    p_feature_id := 'F-6.6.2',
    p_scope_type := 'system',
    p_scope_id := p_region_id,
    p_actor_id := p_actor_id,
    p_actor_type := CASE WHEN p_actor_id IS NULL THEN 'system' ELSE 'user' END,
    p_reason_code := p_trigger_reason,
    p_metadata := jsonb_build_object(
      'region_id', p_region_id,
      'trigger_id', v_trigger_id,
      'previous_mode', COALESCE(v_prev_mode, 'UNKNOWN')
    ) || COALESCE(p_metadata, '{}'::jsonb)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'region_id', p_region_id,
    'trigger_id', v_trigger_id,
    'previous_mode', COALESCE(v_prev_mode, 'UNKNOWN'),
    'current_mode', 'PROTECTIVE',
    'event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION resolve_protective_mode_trigger(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_trigger_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE protective_mode_triggers
  SET resolved_at = now()
  WHERE region_id = p_region_id
    AND resolved_at IS NULL
    AND (p_trigger_reason IS NULL OR trigger_reason = p_trigger_reason);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION evaluate_protective_safety_mode_exit(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode text;
  v_unresolved integer;
  v_last_resolved timestamptz;
  v_entered_at timestamptz;
  v_duration_minutes numeric := NULL;
  v_mode_result jsonb;
  v_emit jsonb;
BEGIN
  SELECT mode INTO v_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  IF COALESCE(v_mode, 'NORMAL') <> 'PROTECTIVE' THEN
    RETURN jsonb_build_object('success', true, 'no_op', true, 'reason', 'region_not_in_protective');
  END IF;

  SELECT count(*)::int INTO v_unresolved
  FROM protective_mode_triggers
  WHERE region_id = p_region_id
    AND resolved_at IS NULL;

  IF v_unresolved > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'unresolved_triggers',
      'unresolved_trigger_count', v_unresolved
    );
  END IF;

  SELECT max(resolved_at) INTO v_last_resolved
  FROM protective_mode_triggers
  WHERE region_id = p_region_id;

  IF v_last_resolved IS NULL OR now() - v_last_resolved < interval '5 minutes' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'cooldown_not_elapsed',
      'cooldown_seconds_remaining',
      GREATEST(0, (300 - EXTRACT(EPOCH FROM (now() - COALESCE(v_last_resolved, now()))))::int)
    );
  END IF;

  SELECT min(detected_at) INTO v_entered_at
  FROM protective_mode_triggers
  WHERE region_id = p_region_id;

  IF v_entered_at IS NOT NULL THEN
    v_duration_minutes := EXTRACT(EPOCH FROM (now() - v_entered_at)) / 60.0;
  END IF;

  v_mode_result := set_region_operational_mode(
    p_region_id := p_region_id,
    p_target_mode := 'NORMAL',
    p_reason_code := 'protective_conditions_cleared',
    p_actor_id := p_actor_id
  );
  IF COALESCE((v_mode_result->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_mode_result->>'error', 'mode_transition_failed'));
  END IF;

  UPDATE feature_activation_state
  SET enabled = true,
      reason_code = 'protective_mode_exited',
      activated_by = COALESCE(p_actor_id, activated_by)
  WHERE region_id = p_region_id
    AND feature_id IN ('F-6.5.13', 'F-10.3', 'F-6.5.14');

  v_emit := emit_event(
    p_event_type := 'protective_mode_exited',
    p_feature_id := 'F-6.6.2',
    p_scope_type := 'system',
    p_scope_id := p_region_id,
    p_actor_id := p_actor_id,
    p_actor_type := CASE WHEN p_actor_id IS NULL THEN 'system' ELSE 'user' END,
    p_reason_code := 'auto_recovery',
    p_metadata := jsonb_build_object(
      'region_id', p_region_id,
      'duration_minutes', v_duration_minutes,
      'trigger_count', (SELECT count(*) FROM protective_mode_triggers WHERE region_id = p_region_id)
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'region_id', p_region_id,
    'current_mode', 'NORMAL',
    'duration_minutes', v_duration_minutes,
    'event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION psm_operation_availability(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_operation text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode text;
  v_op text := lower(coalesce(p_operation, ''));
  v_blocked boolean := false;
  v_message text := null;
  v_alt text := null;
BEGIN
  SELECT mode INTO v_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;
  v_mode := COALESCE(v_mode, 'PROTECTIVE');

  IF v_mode = 'PROTECTIVE' THEN
    v_blocked := v_op = ANY(ARRAY[
      'deep_scan_create',
      'paid_unlock',
      'claim_packet_generation',
      'identity_mutation',
      'evidence_delete',
      'policy_attachment',
      'group_invite_accept',
      'coverage_graph_snapshot',
      'financial_modeling',
      'activity_ai_suggestions'
    ]);

    IF v_blocked THEN
      IF v_op = 'deep_scan_create' THEN
        v_message := 'Deep Scan is temporarily unavailable while we stabilize the platform.';
        v_alt := 'You can still add details manually.';
      ELSIF v_op = 'paid_unlock' THEN
        v_message := 'Upgrades are paused for now while safe mode is active.';
        v_alt := 'You can continue using the free tier.';
      ELSIF v_op = 'claim_packet_generation' THEN
        v_message := 'Claim packet generation is temporarily unavailable in safe mode.';
        v_alt := 'You can still upload and export documentation.';
      ELSE
        v_message := 'This action is temporarily unavailable while safe mode protects your data.';
        v_alt := 'Core workflows are still available.';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'region_id', p_region_id,
    'mode', v_mode,
    'operation', p_operation,
    'blocked', v_blocked,
    'message', v_message,
    'alternative_path', v_alt
  );
END;
$$;

CREATE OR REPLACE FUNCTION precheck_mutation_guard(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id text DEFAULT 'unknown',
  p_mutation_class text DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mode text;
  v_allowed boolean := false;
BEGIN
  SELECT mode INTO v_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  IF v_mode IS NULL THEN
    v_mode := 'PROTECTIVE';
  END IF;

  IF v_mode = 'PROTECTIVE' THEN
    v_allowed := p_mutation_class IN (
      'trip_create',
      'trip_draft_edit',
      'itinerary_confirm',
      'incident_create',
      'evidence_upload',
      'evidence_export',
      'voice_narration_capture',
      'account_auth'
    );
  ELSIF v_mode = 'NORMAL' THEN
    v_allowed := true;
  ELSIF v_mode = 'ELEVATED' THEN
    v_allowed := p_mutation_class NOT IN (
      'registry_edit',
      'threshold_override'
    );
  ELSIF v_mode = 'RECOVERY' THEN
    v_allowed := p_mutation_class IN (
      'trip_create',
      'trip_draft_edit',
      'incident_create',
      'evidence_upload',
      'evidence_export'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'mode', v_mode,
    'mutation_class', p_mutation_class,
    'region_id', p_region_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION enter_protective_safety_mode(uuid, text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resolve_protective_mode_trigger(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION evaluate_protective_safety_mode_exit(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION psm_operation_availability(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION precheck_mutation_guard(uuid, text, text) TO authenticated, service_role;


-- >>>>>>> END: 20260322110000_f662_protective_safety_mode_foundation.sql <<<<<<


-- >>>>>>> BEGIN: 20260322113000_f663_f664_f666_foundations.sql <<<<<<

/*
  Foundations for:
  - F-6.6.3 Dual-Presence Verification (DPV) v1.1
  - F-6.6.4 Emergency Location Availability (guardian-controlled expiry)
  - F-6.6.6 Emergency Delegate & Backup Contact System
*/

CREATE TABLE IF NOT EXISTS biometric_verification_log (
  verification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  biometric_type text NOT NULL CHECK (biometric_type IN ('touch_id', 'face_id', 'other')),
  verification_result text NOT NULL CHECK (verification_result IN ('success', 'failed', 'canceled')),
  device_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biometric_verification_account_created
  ON biometric_verification_log(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dual_presence_bypass_codes (
  code_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT 'add_trusted_device',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz NULL,
  used_device_id uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_dpv_bypass_code_expires
  ON dual_presence_bypass_codes(expires_at);

CREATE TABLE IF NOT EXISTS emergency_modes (
  emergency_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_id uuid NULL REFERENCES incidents(id) ON DELETE SET NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  ended_at timestamptz NULL,
  ended_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  end_method text NULL CHECK (end_method IN ('guardian_manual', 'subject_manual', 'auto_expire', 'trip_end', 'system')),
  auto_expire_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  guardian_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_is_minor boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_emergency_modes_account_status
  ON emergency_modes(account_id, status, activated_at DESC);

CREATE TABLE IF NOT EXISTS emergency_delegates (
  delegate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegate_name text NOT NULL,
  phone_e164 text NOT NULL,
  email text NOT NULL,
  role_tag text NOT NULL DEFAULT 'custom',
  priority_level integer NOT NULL DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 4),
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'confirmed', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_delegates_owner_email_unique
  ON emergency_delegates(owner_account_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_emergency_delegates_owner_status
  ON emergency_delegates(owner_account_id, verification_status);

CREATE OR REPLACE FUNCTION update_emergency_delegate_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emergency_delegate_updated_at ON emergency_delegates;
CREATE TRIGGER trg_emergency_delegate_updated_at
BEFORE UPDATE ON emergency_delegates
FOR EACH ROW EXECUTE FUNCTION update_emergency_delegate_updated_at();

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('biometric_verification_attempted', 1, 'F-6.6.3', 'info'),
  ('biometric_verification_success', 1, 'F-6.6.3', 'info'),
  ('biometric_verification_failed', 1, 'F-6.6.3', 'warning'),
  ('security_preference_changed', 1, 'F-6.6.3', 'info'),
  ('bypass_code_generated', 1, 'F-6.6.3', 'warning'),
  ('bypass_code_used', 1, 'F-6.6.3', 'info'),
  ('bypass_code_expired', 1, 'F-6.6.3', 'warning'),
  ('geolocation_manual_override', 1, 'F-6.6.3', 'warning'),
  ('emergency_mode_activated', 1, 'F-6.6.4', 'critical'),
  ('emergency_mode_ended', 1, 'F-6.6.4', 'info'),
  ('emergency_ended_by_guardian', 1, 'F-6.6.4', 'info'),
  ('emergency_end_attempt_by_minor', 1, 'F-6.6.4', 'warning'),
  ('emergency_auto_expired', 1, 'F-6.6.4', 'warning'),
  ('emergency_reactivated', 1, 'F-6.6.4', 'warning'),
  ('emergency_delegate_notified', 1, 'F-6.6.6', 'critical'),
  ('delegate_dashboard_accessed', 1, 'F-6.6.6', 'info'),
  ('delegate_notification_failed', 1, 'F-6.6.6', 'warning')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION create_dual_presence_bypass_code(
  p_account_id uuid,
  p_actor_id uuid,
  p_action_type text DEFAULT 'add_trusted_device',
  p_expires_in_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_row dual_presence_bypass_codes%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO dual_presence_bypass_codes (code, account_id, action_type, expires_at)
  VALUES (v_code, p_account_id, p_action_type, now() + make_interval(hours => GREATEST(1, p_expires_in_hours)))
  RETURNING * INTO v_row;

  v_emit := emit_event(
    p_event_type := 'bypass_code_generated',
    p_feature_id := 'F-6.6.3',
    p_scope_type := 'system',
    p_scope_id := p_account_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'manual_founder_approval',
    p_metadata := jsonb_build_object('code_id', v_row.code_id, 'account_id', p_account_id, 'action_type', p_action_type)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code_id', v_row.code_id,
    'code', v_row.code,
    'expires_at', v_row.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION consume_dual_presence_bypass_code(
  p_code text,
  p_actor_id uuid,
  p_device_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row dual_presence_bypass_codes%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT *
  INTO v_row
  FROM dual_presence_bypass_codes
  WHERE code = upper(trim(coalesce(p_code, '')))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_row.used THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_already_used');
  END IF;

  IF v_row.expires_at < now() THEN
    UPDATE dual_presence_bypass_codes
    SET used = true, used_at = now()
    WHERE code_id = v_row.code_id;
    RETURN jsonb_build_object('success', false, 'error', 'code_expired');
  END IF;

  IF v_row.account_id <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE dual_presence_bypass_codes
  SET used = true,
      used_at = now(),
      used_device_id = p_device_id
  WHERE code_id = v_row.code_id;

  v_emit := emit_event(
    p_event_type := 'bypass_code_used',
    p_feature_id := 'F-6.6.3',
    p_scope_type := 'system',
    p_scope_id := p_actor_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'trusted_device_recovery',
    p_metadata := jsonb_build_object('code_id', v_row.code_id, 'device_id', p_device_id)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object('success', true, 'account_id', p_actor_id, 'code_id', v_row.code_id);
END;
$$;

CREATE OR REPLACE FUNCTION end_emergency_mode_guardian_confirm(
  p_emergency_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_em emergency_modes%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT *
  INTO v_em
  FROM emergency_modes
  WHERE emergency_id = p_emergency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'emergency_not_found');
  END IF;

  IF v_em.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_ended');
  END IF;

  IF v_em.subject_is_minor AND v_em.guardian_id IS DISTINCT FROM p_actor_id THEN
    v_emit := emit_event(
      p_event_type := 'emergency_end_attempt_by_minor',
      p_feature_id := 'F-6.6.4',
      p_scope_type := 'incident',
      p_scope_id := COALESCE(v_em.incident_id, p_emergency_id),
      p_actor_id := p_actor_id,
      p_actor_type := 'user',
      p_reason_code := 'guardian_confirmation_required',
      p_metadata := jsonb_build_object('emergency_id', p_emergency_id, 'minor_account_id', v_em.account_id)
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'guardian_confirmation_required');
  END IF;

  IF NOT v_em.subject_is_minor AND p_actor_id NOT IN (v_em.account_id, COALESCE(v_em.guardian_id, p_actor_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE emergency_modes
  SET status = 'ended',
      ended_at = now(),
      ended_by = p_actor_id,
      end_method = CASE WHEN v_em.subject_is_minor THEN 'guardian_manual' ELSE 'subject_manual' END
  WHERE emergency_id = p_emergency_id;

  v_emit := emit_event(
    p_event_type := CASE WHEN v_em.subject_is_minor THEN 'emergency_ended_by_guardian' ELSE 'emergency_mode_ended' END,
    p_feature_id := 'F-6.6.4',
    p_scope_type := 'incident',
    p_scope_id := COALESCE(v_em.incident_id, p_emergency_id),
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'confirmed_safe',
    p_metadata := jsonb_build_object('emergency_id', p_emergency_id, 'account_id', v_em.account_id)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object('success', true, 'emergency_id', p_emergency_id, 'ended_by', p_actor_id);
END;
$$;

CREATE OR REPLACE FUNCTION add_emergency_delegate(
  p_owner_account_id uuid,
  p_delegate_name text,
  p_phone_e164 text,
  p_email text,
  p_role_tag text DEFAULT 'custom',
  p_priority_level integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row emergency_delegates%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_account_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  INSERT INTO emergency_delegates (
    owner_account_id, delegate_name, phone_e164, email, role_tag, priority_level
  ) VALUES (
    p_owner_account_id, p_delegate_name, p_phone_e164, lower(trim(p_email)), p_role_tag, GREATEST(1, LEAST(4, p_priority_level))
  )
  RETURNING * INTO v_row;

  v_emit := emit_event(
    p_event_type := 'emergency_delegate_notified',
    p_feature_id := 'F-6.6.6',
    p_scope_type := 'system',
    p_scope_id := p_owner_account_id,
    p_actor_id := p_owner_account_id,
    p_actor_type := 'user',
    p_reason_code := 'delegate_added',
    p_metadata := jsonb_build_object(
      'delegate_id', v_row.delegate_id,
      'role_tag', v_row.role_tag,
      'verification_status', v_row.verification_status
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'delegate_id', v_row.delegate_id,
    'verification_status', v_row.verification_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_dual_presence_bypass_code(uuid, uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION consume_dual_presence_bypass_code(text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION end_emergency_mode_guardian_confirm(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_emergency_delegate(uuid, text, text, text, text, integer) TO authenticated, service_role;


-- >>>>>>> END: 20260322113000_f663_f664_f666_foundations.sql <<<<<<


-- >>>>>>> BEGIN: 20260323120000_pass8_payment_entitlement_auth_emit_hardening.sql <<<<<<

/*
  Pass 8 hardening:
  - Auth-bind legacy payment/entitlement RPCs
  - Enforce emit_event success (emit-or-rollback) on mutating payment paths
  - Revoke deprecated unsafe credit mutation RPC from authenticated users
*/

CREATE OR REPLACE FUNCTION unlock_trip(
  p_trip_id uuid,
  p_actor_id uuid,
  p_credits_to_add integer DEFAULT 2,
  p_payment_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip trips%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_trip
  FROM trips
  WHERE trip_id = p_trip_id
    AND account_id = p_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;

  IF v_trip.paid_unlock THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_unlocked', 'paid_unlock_at', v_trip.paid_unlock_at);
  END IF;

  UPDATE trips
  SET
    paid_unlock = true,
    paid_unlock_at = now(),
    deep_scan_credits_remaining = p_credits_to_add,
    deep_scan_credits_purchased = p_credits_to_add
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(
    p_event_type := 'trip_unlocked',
    p_feature_id := 'trips',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'payment_confirmed',
    p_resulting_state := jsonb_build_object('paid_unlock', true, 'deep_scan_credits', p_credits_to_add),
    p_metadata := jsonb_build_object('credits_added', p_credits_to_add, 'payment_ref', p_payment_ref)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', p_trip_id,
    'deep_scan_credits_remaining', p_credits_to_add,
    'paid_unlock_at', now(),
    'event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION add_deep_scan_credits(
  p_trip_id uuid,
  p_actor_id uuid,
  p_credits integer,
  p_payment_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip trips%ROWTYPE;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_trip
  FROM trips
  WHERE trip_id = p_trip_id
    AND account_id = p_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;
  IF NOT v_trip.paid_unlock THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked');
  END IF;

  UPDATE trips
  SET
    deep_scan_credits_remaining = deep_scan_credits_remaining + p_credits,
    deep_scan_credits_purchased = deep_scan_credits_purchased + p_credits
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(
    p_event_type := 'deep_scan_credit_added',
    p_feature_id := 'trips',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'purchase',
    p_metadata := jsonb_build_object(
      'credits_added', p_credits,
      'new_total', v_trip.deep_scan_credits_remaining + p_credits,
      'payment_ref', p_payment_ref
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'credits_added', p_credits,
    'deep_scan_credits_remaining', v_trip.deep_scan_credits_remaining + p_credits
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_membership_entitlement(
  p_user_id uuid,
  p_feature_check text,
  p_trip_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_trip trips%ROWTYPE;
  v_has_access boolean := false;
  v_reason text;
  v_emit jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_profile FROM user_profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_profile_not_found');
  END IF;

  CASE p_feature_check
    WHEN 'quick_scan' THEN
      IF v_profile.lifetime_quick_scans_used < 2 THEN
        v_has_access := true;
      ELSE
        v_has_access := false;
        v_reason := 'lifetime_quick_scan_cap_reached';
        v_emit := emit_event(
          p_event_type := 'tier_0_paywall_triggered',
          p_feature_id := 'accounts',
          p_scope_type := 'user',
          p_scope_id := p_user_id,
          p_actor_id := p_user_id,
          p_actor_type := 'user',
          p_reason_code := 'lifetime_cap_reached',
          p_metadata := jsonb_build_object('lifetime_scans_used', v_profile.lifetime_quick_scans_used)
        );
        IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
          RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
        END IF;
      END IF;
    WHEN 'quick_scan_paid' THEN
      IF p_trip_id IS NULL THEN
        v_has_access := false;
        v_reason := 'trip_id_required';
      ELSE
        SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_user_id;
        IF NOT FOUND OR NOT v_trip.paid_unlock THEN
          v_has_access := false;
          v_reason := 'trip_not_unlocked';
        ELSIF v_trip.quick_scan_week_reset_at < now() - interval '7 days' THEN
          UPDATE trips SET quick_scans_used_this_week = 0, quick_scan_week_reset_at = now() WHERE trip_id = p_trip_id;
          v_has_access := true;
        ELSIF v_trip.quick_scans_used_this_week < 4 THEN
          v_has_access := true;
        ELSE
          v_has_access := false;
          v_reason := 'weekly_quick_scan_limit_reached';
        END IF;
      END IF;
    WHEN 'deep_scan' THEN
      IF p_trip_id IS NULL THEN
        v_has_access := false;
        v_reason := 'trip_id_required';
      ELSE
        SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_user_id;
        IF NOT FOUND OR NOT v_trip.paid_unlock THEN
          v_has_access := false;
          v_reason := 'trip_not_unlocked';
        ELSIF v_trip.deep_scan_credits_remaining > 0 THEN
          v_has_access := true;
        ELSE
          v_has_access := false;
          v_reason := 'deep_scan_credits_exhausted';
        END IF;
      END IF;
    WHEN 'export_data' THEN
      v_has_access := (SELECT can_export_data FROM membership_entitlements WHERE tier = v_profile.membership_tier);
      v_reason := CASE WHEN NOT v_has_access THEN 'tier_insufficient_for_export' ELSE NULL END;
    WHEN 'api_access' THEN
      v_has_access := (SELECT can_use_api FROM membership_entitlements WHERE tier = v_profile.membership_tier);
      v_reason := CASE WHEN NOT v_has_access THEN 'tier_insufficient_for_api' ELSE NULL END;
    WHEN 'create_workspace' THEN
      v_has_access := (SELECT can_create_workspace FROM membership_entitlements WHERE tier = v_profile.membership_tier);
      v_reason := CASE WHEN NOT v_has_access THEN 'corporate_account_required' ELSE NULL END;
    ELSE
      v_has_access := false;
      v_reason := 'unknown_feature_check';
  END CASE;

  IF NOT v_has_access THEN
    v_emit := emit_event(
      p_event_type := 'entitlement_check_failed',
      p_feature_id := 'accounts',
      p_scope_type := 'user',
      p_scope_id := p_user_id,
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := v_reason,
      p_metadata := jsonb_build_object(
        'feature_check', p_feature_check,
        'membership_tier', v_profile.membership_tier,
        'lifetime_quick_scans_used', v_profile.lifetime_quick_scans_used,
        'trip_id', p_trip_id
      )
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_has_access,
    'reason', v_reason,
    'membership_tier', v_profile.membership_tier,
    'lifetime_quick_scans_used', v_profile.lifetime_quick_scans_used,
    'trip_id', p_trip_id,
    'deep_scan_credits_remaining', CASE WHEN v_trip.trip_id IS NOT NULL THEN v_trip.deep_scan_credits_remaining ELSE NULL END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION consume_scan_credit(uuid, text, uuid) FROM authenticated;


-- >>>>>>> END: 20260323120000_pass8_payment_entitlement_auth_emit_hardening.sql <<<<<<


-- >>>>>>> BEGIN: 20260323123000_pass9_idempotency_hardening.sql <<<<<<

/*
  Pass 9 hardening:
  - Retry-safe idempotency for deep/quick scan initiation
  - Replay-safe idempotency for trip unlock and deep-scan top-ups
*/

CREATE INDEX IF NOT EXISTS idx_job_queue_deep_scan_trip_hash_created
ON public.job_queue ((payload->>'trip_id'), (payload->>'itinerary_hash'), created_at DESC)
WHERE job_type = 'deep_scan';

CREATE INDEX IF NOT EXISTS idx_job_queue_quick_scan_user_hash_created
ON public.job_queue ((payload->>'user_id'), (payload->>'itinerary_hash'), created_at DESC)
WHERE job_type = 'quick_scan';

CREATE INDEX IF NOT EXISTS idx_job_queue_quick_scan_trip_hash_created
ON public.job_queue ((payload->>'trip_id'), (payload->>'itinerary_hash'), created_at DESC)
WHERE job_type = 'quick_scan';

CREATE OR REPLACE FUNCTION unlock_trip(
  p_trip_id uuid,
  p_actor_id uuid,
  p_credits_to_add integer DEFAULT 2,
  p_payment_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip trips%ROWTYPE;
  v_emit jsonb;
  v_replay_key text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_replay_key := NULLIF(btrim(p_payment_ref), '');

  SELECT * INTO v_trip
  FROM trips
  WHERE trip_id = p_trip_id
    AND account_id = p_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;

  IF v_trip.paid_unlock THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'trip_id', p_trip_id,
      'deep_scan_credits_remaining', v_trip.deep_scan_credits_remaining,
      'paid_unlock_at', v_trip.paid_unlock_at
    );
  END IF;

  UPDATE trips
  SET
    paid_unlock = true,
    paid_unlock_at = now(),
    deep_scan_credits_remaining = p_credits_to_add,
    deep_scan_credits_purchased = p_credits_to_add
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(
    p_event_type := 'trip_unlocked',
    p_feature_id := 'trips',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'payment_confirmed',
    p_idempotency_key := v_replay_key,
    p_resulting_state := jsonb_build_object('paid_unlock', true, 'deep_scan_credits', p_credits_to_add),
    p_metadata := jsonb_build_object('credits_added', p_credits_to_add, 'payment_ref', p_payment_ref)
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'trip_id', p_trip_id,
    'deep_scan_credits_remaining', p_credits_to_add,
    'paid_unlock_at', now(),
    'event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION add_deep_scan_credits(
  p_trip_id uuid,
  p_actor_id uuid,
  p_credits integer,
  p_payment_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip trips%ROWTYPE;
  v_emit jsonb;
  v_replay_key text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_replay_key := NULLIF(btrim(p_payment_ref), '');

  SELECT * INTO v_trip
  FROM trips
  WHERE trip_id = p_trip_id
    AND account_id = p_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;
  IF NOT v_trip.paid_unlock THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked');
  END IF;

  IF v_replay_key IS NOT NULL AND EXISTS (
    SELECT 1
    FROM event_ledger
    WHERE event_type = 'deep_scan_credit_added'
      AND scope_id = p_trip_id
      AND actor_id = p_actor_id
      AND idempotency_key = v_replay_key
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'credits_added', 0,
      'deep_scan_credits_remaining', v_trip.deep_scan_credits_remaining
    );
  END IF;

  UPDATE trips
  SET
    deep_scan_credits_remaining = deep_scan_credits_remaining + p_credits,
    deep_scan_credits_purchased = deep_scan_credits_purchased + p_credits
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(
    p_event_type := 'deep_scan_credit_added',
    p_feature_id := 'trips',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_actor_id,
    p_actor_type := 'user',
    p_reason_code := 'purchase',
    p_idempotency_key := v_replay_key,
    p_resulting_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining + p_credits),
    p_metadata := jsonb_build_object(
      'credits_added', p_credits,
      'new_total', v_trip.deep_scan_credits_remaining + p_credits,
      'payment_ref', p_payment_ref
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'credits_added', p_credits,
    'deep_scan_credits_remaining', v_trip.deep_scan_credits_remaining + p_credits
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.initiate_deep_scan(
  p_user_id uuid,
  p_trip_id uuid,
  p_itinerary_snapshot jsonb,
  p_user_confirmed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_hash text;
  v_job_id uuid;
  v_cached_job uuid;
  v_emit jsonb;
  v_missing integer := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF NOT p_user_confirmed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'explicit_user_confirmation_required',
      'message', 'Deep Scan requires explicit user confirmation before credit is consumed.'
    );
  END IF;

  v_hash := encode(digest(p_itinerary_snapshot::text, 'sha256'), 'hex');

  SELECT *
  INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
    AND account_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;

  IF NOT v_trip.paid_unlock THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked');
  END IF;

  IF v_trip.is_group_trip THEN
    SELECT count(*)::int
    INTO v_missing
    FROM public.group_participants gp
    WHERE gp.trip_id = p_trip_id
      AND gp.status = 'active'
      AND (
        gp.residence_country_code IS NULL
        OR btrim(gp.residence_country_code) = ''
        OR (
          upper(gp.residence_country_code) = 'US'
          AND (gp.residence_state_code IS NULL OR btrim(gp.residence_state_code) = '')
        )
      );

    IF v_missing > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'group_residence_incomplete',
        'missing_participants', v_missing,
        'message', 'Deep Scan can filter insurance options based on where each traveler lives. Some participants have not added their location yet.'
      );
    END IF;
  END IF;

  SELECT j.id
  INTO v_cached_job
  FROM public.job_queue j
  WHERE j.job_type = 'deep_scan'
    AND j.payload->>'trip_id' = p_trip_id::text
    AND j.payload->>'itinerary_hash' = v_hash
    AND j.status::text IN ('pending', 'running', 'retry', 'processing', 'completed')
    AND j.created_at > now() - interval '7 days'
  ORDER BY j.created_at DESC
  LIMIT 1;

  IF v_cached_job IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'cache_hit', true,
      'job_id', v_cached_job,
      'scan_id', v_cached_job,
      'itinerary_hash', v_hash,
      'credits_remaining', v_trip.deep_scan_credits_remaining
    );
  END IF;

  IF v_trip.deep_scan_credits_remaining <= 0 THEN
    v_emit := emit_event(
      p_event_type := 'deep_scan_credit_purchase_required',
      p_feature_id := 'scans',
      p_scope_type := 'trip',
      p_scope_id := p_trip_id,
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := 'credits_exhausted',
      p_metadata := jsonb_build_object('trip_id', p_trip_id)
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_deep_scan_credits_remaining',
      'purchase_required', true,
      'credits_remaining', 0
    );
  END IF;

  UPDATE public.trips
  SET deep_scan_credits_remaining = deep_scan_credits_remaining - 1
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(
    p_event_type := 'deep_scan_credit_consumed',
    p_feature_id := 'trips',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_initiated',
    p_previous_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining),
    p_resulting_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining - 1),
    p_metadata := jsonb_build_object(
      'trip_id', p_trip_id,
      'credits_before', v_trip.deep_scan_credits_remaining,
      'credits_after', v_trip.deep_scan_credits_remaining - 1
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  INSERT INTO public.job_queue (job_type, status, payload)
  VALUES (
    'deep_scan',
    'pending',
    jsonb_build_object(
      'user_id', p_user_id,
      'trip_id', p_trip_id,
      'itinerary_hash', v_hash,
      'itinerary_data', p_itinerary_snapshot
    )
  )
  RETURNING id INTO v_job_id;

  v_emit := emit_event(
    p_event_type := 'deep_scan_requested',
    p_feature_id := 'scans',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_confirmed',
    p_metadata := jsonb_build_object(
      'job_id', v_job_id,
      'itinerary_hash', v_hash,
      'credits_remaining', v_trip.deep_scan_credits_remaining - 1
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cache_hit', false,
    'job_id', v_job_id,
    'scan_id', v_job_id,
    'itinerary_hash', v_hash,
    'credits_remaining', v_trip.deep_scan_credits_remaining - 1,
    'credit_event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION initiate_quick_scan(
  p_user_id uuid,
  p_itinerary_snapshot jsonb,
  p_trip_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_trip trips%ROWTYPE;
  v_hash text;
  v_job_id uuid;
  v_cached_job uuid;
  v_cached_status text;
  v_emit jsonb;
  v_is_paid boolean := (p_trip_id IS NOT NULL);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT *
  INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_hash := encode(digest(p_itinerary_snapshot::text, 'sha256'), 'hex');

  IF NOT v_is_paid THEN
    SELECT j.id, j.status::text
    INTO v_cached_job, v_cached_status
    FROM job_queue j
    WHERE j.job_type = 'quick_scan'
      AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'user_id' = p_user_id::text
      AND j.status::text IN ('pending', 'processing', 'completed')
    ORDER BY
      CASE j.status::text
        WHEN 'processing' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'completed' THEN 3
        ELSE 4
      END,
      j.created_at DESC
    LIMIT 1;

    IF v_cached_job IS NOT NULL THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_cache_hit',
        p_feature_id := 'scans',
        p_scope_type := 'user',
        p_scope_id := p_user_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'identical_itinerary_hash',
        p_metadata := jsonb_build_object('cached_job_id', v_cached_job, 'cached_job_status', v_cached_status, 'hash', v_hash)
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'job_status', v_cached_status, 'hash', v_hash);
    END IF;

    IF v_profile.lifetime_quick_scans_used >= 2 THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_rate_limited',
        p_feature_id := 'scans',
        p_scope_type := 'user',
        p_scope_id := p_user_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'lifetime_cap_reached',
        p_metadata := jsonb_build_object(
          'lifetime_scans_used', v_profile.lifetime_quick_scans_used,
          'lifetime_cap', 2
        )
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'lifetime_quick_scan_cap_reached',
        'paywall', true,
        'scans_used', v_profile.lifetime_quick_scans_used,
        'conversion_prompt', 'unlock_trip'
      );
    END IF;

    UPDATE user_profiles
    SET
      lifetime_quick_scans_used = lifetime_quick_scans_used + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    SELECT *
    INTO v_trip
    FROM trips
    WHERE trip_id = p_trip_id
      AND account_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
    END IF;
    IF NOT v_trip.paid_unlock THEN
      RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked');
    END IF;

    SELECT j.id, j.status::text
    INTO v_cached_job, v_cached_status
    FROM job_queue j
    WHERE j.job_type = 'quick_scan'
      AND j.payload->>'itinerary_hash' = v_hash
      AND j.payload->>'trip_id' = p_trip_id::text
      AND j.status::text IN ('pending', 'processing', 'completed')
    ORDER BY
      CASE j.status::text
        WHEN 'processing' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'completed' THEN 3
        ELSE 4
      END,
      j.created_at DESC
    LIMIT 1;

    IF v_cached_job IS NOT NULL THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_cache_hit',
        p_feature_id := 'scans',
        p_scope_type := 'trip',
        p_scope_id := p_trip_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'identical_itinerary_hash',
        p_metadata := jsonb_build_object('cached_job_id', v_cached_job, 'cached_job_status', v_cached_status, 'hash', v_hash)
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object('success', true, 'cache_hit', true, 'job_id', v_cached_job, 'job_status', v_cached_status, 'hash', v_hash);
    END IF;

    IF v_trip.quick_scan_week_reset_at < now() - interval '7 days' THEN
      UPDATE trips
      SET
        quick_scans_used_this_week = 0,
        quick_scan_week_reset_at = now()
      WHERE trip_id = p_trip_id;
      v_trip.quick_scans_used_this_week := 0;
    END IF;

    IF v_trip.quick_scans_used_this_week >= 4 THEN
      v_emit := emit_event(
        p_event_type := 'quick_scan_rate_limited',
        p_feature_id := 'scans',
        p_scope_type := 'trip',
        p_scope_id := p_trip_id,
        p_actor_id := p_user_id,
        p_actor_type := 'user',
        p_reason_code := 'weekly_limit_reached',
        p_metadata := jsonb_build_object(
          'trip_id', p_trip_id,
          'scans_this_week', v_trip.quick_scans_used_this_week
        )
      );
      IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
      END IF;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'weekly_quick_scan_limit_reached',
        'scans_used', v_trip.quick_scans_used_this_week,
        'resets_at', v_trip.quick_scan_week_reset_at + interval '7 days'
      );
    END IF;

    UPDATE trips
    SET quick_scans_used_this_week = quick_scans_used_this_week + 1
    WHERE trip_id = p_trip_id;
  END IF;

  INSERT INTO job_queue (job_type, status, payload)
  VALUES (
    'quick_scan',
    'pending',
    jsonb_build_object(
      'user_id', p_user_id,
      'trip_id', p_trip_id,
      'itinerary_hash', v_hash,
      'itinerary_data', p_itinerary_snapshot,
      'scan_tier', CASE WHEN v_is_paid THEN 'paid' ELSE 'free' END
    )
  )
  RETURNING id INTO v_job_id;

  v_emit := emit_event(
    p_event_type := 'quick_scan_requested',
    p_feature_id := 'scans',
    p_scope_type := CASE WHEN v_is_paid THEN 'trip' ELSE 'user' END,
    p_scope_id := COALESCE(p_trip_id, p_user_id),
    p_actor_id := p_user_id,
    p_actor_type := 'user',
    p_reason_code := 'user_initiated',
    p_metadata := jsonb_build_object(
      'job_id', v_job_id,
      'itinerary_hash', v_hash,
      'scan_tier', CASE WHEN v_is_paid THEN 'paid' ELSE 'free' END,
      'trip_id', p_trip_id
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cache_hit', false,
    'job_id', v_job_id,
    'itinerary_hash', v_hash,
    'event_id', v_emit->>'event_id'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION unlock_trip(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION add_deep_scan_credits(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initiate_deep_scan(uuid, uuid, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION initiate_quick_scan(uuid, jsonb, uuid) TO authenticated;


-- >>>>>>> END: 20260323123000_pass9_idempotency_hardening.sql <<<<<<


-- >>>>>>> BEGIN: 20260323130000_pass10_statutory_fsm_foundation.sql <<<<<<

/*
  Pass 10 foundation:
  - Deterministic statutory rights evaluator (v1)
  - Disruption resolution FSM state + guarded transition RPC
*/

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS disruption_resolution_state text;

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_disruption_resolution_state_check;
ALTER TABLE incidents
  ADD CONSTRAINT incidents_disruption_resolution_state_check
  CHECK (
    disruption_resolution_state IS NULL OR disruption_resolution_state IN (
      'DISRUPTION_SUSPECTED',
      'DISRUPTION_CONFIRMED',
      'CARRIER_ENGAGEMENT_ACTIVE',
      'OFFER_RECEIVED',
      'OFFER_EVALUATED',
      'OFFER_ACCEPTED',
      'OWN_RESOLUTION_ACTIVE',
      'DOCUMENTATION_ACTIVE',
      'EVIDENCE_COMPLETE',
      'CLAIM_ACTIVE',
      'ROUTING_DETERMINED',
      'RIGHTS_WINDOW_ACTIVE',
      'RESOLUTION_COMPLETE'
    )
  );

CREATE TABLE IF NOT EXISTS statutory_rights_evaluations (
  evaluation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_code text NOT NULL CHECK (framework_code IN ('EU261', 'US_DOT', 'MONTREAL_CONVENTION', 'UK_RETAINED')),
  input_hash text NOT NULL,
  evaluator_version text NOT NULL DEFAULT 'v1',
  determination_status text NOT NULL DEFAULT 'COMPLETE'
    CHECK (determination_status IN ('COMPLETE', 'INSUFFICIENT_DATA', 'CONFLICT_PRESENT', 'FAILED')),
  reasoning_trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, framework_code, input_hash, evaluator_version)
);

CREATE INDEX IF NOT EXISTS idx_sre_incident_created
  ON statutory_rights_evaluations (incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS statutory_right_outcomes (
  outcome_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES statutory_rights_evaluations(evaluation_id) ON DELETE CASCADE,
  right_code text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ELIGIBLE', 'INELIGIBLE', 'CONDITIONAL', 'UNKNOWN')),
  confidence_tier text NOT NULL
    CHECK (confidence_tier IN ('HIGH', 'USER_CONFIRMED', 'CONDITIONAL', 'AMBIGUOUS', 'DOCUMENTATION_INCOMPLETE', 'CONFLICT_PRESENT', 'INSUFFICIENT_DATA')),
  amount_currency char(3),
  amount_value numeric(12,2),
  filing_deadline_at timestamptz,
  evidence_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  basis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, right_code)
);

CREATE INDEX IF NOT EXISTS idx_sro_eval_right
  ON statutory_right_outcomes (evaluation_id, right_code);

ALTER TABLE statutory_rights_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_right_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sre_select_own ON statutory_rights_evaluations;
CREATE POLICY sre_select_own
  ON statutory_rights_evaluations FOR SELECT TO authenticated
  USING (account_id = auth.uid());

DROP POLICY IF EXISTS sro_select_own ON statutory_right_outcomes;
CREATE POLICY sro_select_own
  ON statutory_right_outcomes FOR SELECT TO authenticated
  USING (
    evaluation_id IN (
      SELECT evaluation_id
      FROM statutory_rights_evaluations
      WHERE account_id = auth.uid()
    )
  );

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('statutory_rights_evaluated', 1, 'F-6.5.2', 'info'),
  ('statutory_rights_evaluation_failed', 1, 'F-6.5.2', 'warning')
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION evaluate_statutory_rights(
  p_incident_id uuid,
  p_actor_id uuid,
  p_framework_code text DEFAULT 'EU261',
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_incident incidents%ROWTYPE;
  v_input jsonb;
  v_input_hash text;
  v_eval statutory_rights_evaluations%ROWTYPE;
  v_emit jsonb;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR p_actor_id IS NULL OR p_actor_id <> v_auth_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT i.*
  INTO v_incident
  FROM incidents i
  JOIN trips t ON t.trip_id = i.trip_id
  WHERE i.id = p_incident_id
    AND t.created_by = v_auth_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;

  v_input := jsonb_build_object(
    'incident_id', v_incident.id,
    'trip_id', v_incident.trip_id,
    'canonical_status', v_incident.canonical_status,
    'disruption_type', COALESCE(v_incident.disruption_type, ''),
    'framework_code', p_framework_code
  );
  v_input_hash := encode(digest(v_input::text, 'sha256'), 'hex');

  SELECT *
  INTO v_eval
  FROM statutory_rights_evaluations
  WHERE incident_id = p_incident_id
    AND framework_code = p_framework_code
    AND input_hash = v_input_hash
    AND evaluator_version = 'v1'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'evaluation_id', v_eval.evaluation_id,
      'framework_code', p_framework_code,
      'input_hash', v_input_hash
    );
  END IF;

  INSERT INTO statutory_rights_evaluations (
    incident_id,
    trip_id,
    account_id,
    framework_code,
    input_hash,
    evaluator_version,
    determination_status,
    reasoning_trace
  ) VALUES (
    p_incident_id,
    v_incident.trip_id,
    v_auth_uid,
    p_framework_code,
    v_input_hash,
    'v1',
    'COMPLETE',
    jsonb_build_object('source', 'deterministic_v1')
  )
  RETURNING * INTO v_eval;

  INSERT INTO statutory_right_outcomes (
    evaluation_id,
    right_code,
    outcome,
    confidence_tier,
    amount_currency,
    amount_value,
    filing_deadline_at,
    evidence_requirements,
    basis
  ) VALUES
    (
      v_eval.evaluation_id,
      p_framework_code || '_RIGHTS_WINDOW',
      'CONDITIONAL',
      'CONDITIONAL',
      'EUR',
      NULL,
      now() + interval '30 days',
      jsonb_build_array('carrier_notice', 'itinerary_record', 'delay_or_disruption_proof'),
      jsonb_build_object('framework_code', p_framework_code, 'input_hash', v_input_hash)
    );

  v_emit := emit_event(
    p_event_type := 'statutory_rights_evaluated',
    p_feature_id := 'F-6.5.2',
    p_scope_type := 'incident',
    p_scope_id := p_incident_id,
    p_actor_id := v_auth_uid,
    p_actor_type := 'user',
    p_reason_code := 'statutory_evaluation_complete',
    p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object(
      'evaluation_id', v_eval.evaluation_id,
      'framework_code', p_framework_code,
      'input_hash', v_input_hash
    )
  );
  IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'evaluation_id', v_eval.evaluation_id,
    'framework_code', p_framework_code,
    'input_hash', v_input_hash,
    'event_id', v_emit->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION change_disruption_resolution_state(
  p_incident_id uuid,
  p_new_state text,
  p_actor_id uuid,
  p_reason_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_old_state text;
  v_new_state text;
  v_event_type text;
  v_emit jsonb;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR p_actor_id IS NULL OR p_actor_id <> v_auth_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT i.disruption_resolution_state
  INTO v_old_state
  FROM incidents i
  JOIN trips t ON t.trip_id = i.trip_id
  WHERE i.id = p_incident_id
    AND t.created_by = v_auth_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'incident not found');
  END IF;

  v_new_state := upper(trim(p_new_state));
  IF v_new_state NOT IN (
    'DISRUPTION_SUSPECTED',
    'DISRUPTION_CONFIRMED',
    'CARRIER_ENGAGEMENT_ACTIVE',
    'OFFER_RECEIVED',
    'OFFER_EVALUATED',
    'OFFER_ACCEPTED',
    'OWN_RESOLUTION_ACTIVE',
    'DOCUMENTATION_ACTIVE',
    'EVIDENCE_COMPLETE',
    'CLAIM_ACTIVE',
    'ROUTING_DETERMINED',
    'RIGHTS_WINDOW_ACTIVE',
    'RESOLUTION_COMPLETE'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_state');
  END IF;

  IF v_old_state = v_new_state THEN
    RETURN jsonb_build_object('success', true, 'incident_id', p_incident_id, 'state', v_new_state, 'no_op', true);
  END IF;

  UPDATE incidents
  SET disruption_resolution_state = v_new_state,
      updated_at = now()
  WHERE id = p_incident_id;

  v_event_type := CASE v_new_state
    WHEN 'DISRUPTION_SUSPECTED' THEN 'disruption_suspected'
    WHEN 'DISRUPTION_CONFIRMED' THEN 'disruption_confirmed'
    WHEN 'OFFER_RECEIVED' THEN 'offer_received'
    WHEN 'OFFER_EVALUATED' THEN 'offer_evaluated'
    WHEN 'OFFER_ACCEPTED' THEN 'offer_accepted'
    WHEN 'OWN_RESOLUTION_ACTIVE' THEN 'own_resolution_active'
    WHEN 'EVIDENCE_COMPLETE' THEN 'evidence_complete'
    WHEN 'ROUTING_DETERMINED' THEN 'routing_determined'
    WHEN 'RIGHTS_WINDOW_ACTIVE' THEN 'rights_window_active'
    WHEN 'RESOLUTION_COMPLETE' THEN 'resolution_complete'
    ELSE NULL
  END;

  IF v_event_type IS NOT NULL THEN
    v_emit := emit_event(
      p_event_type := v_event_type,
      p_feature_id := 'F-6.5.5',
      p_scope_type := 'incident',
      p_scope_id := p_incident_id,
      p_actor_id := v_auth_uid,
      p_actor_type := 'user',
      p_reason_code := COALESCE(p_reason_code, 'disruption_state_transition'),
      p_previous_state := jsonb_build_object('disruption_resolution_state', v_old_state),
      p_resulting_state := jsonb_build_object('disruption_resolution_state', v_new_state),
      p_metadata := jsonb_build_object('old_state', v_old_state, 'new_state', v_new_state)
    );
    IF COALESCE((v_emit->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'emit_event failed: %', COALESCE(v_emit->>'error', 'unknown error');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'incident_id', p_incident_id,
    'old_state', v_old_state,
    'new_state', v_new_state,
    'event_id', COALESCE(v_emit->>'event_id', NULL),
    'no_op', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION evaluate_statutory_rights(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION change_disruption_resolution_state(uuid, text, uuid, text) TO authenticated;


-- >>>>>>> END: 20260323130000_pass10_statutory_fsm_foundation.sql <<<<<<


-- >>>>>>> BEGIN: 20260323140000_pass11_region_mode_auth_binding.sql <<<<<<

/*
  Pass 11: bind set_region_operational_mode to JWT actor (no spoofed p_actor_id).
*/

CREATE OR REPLACE FUNCTION set_region_operational_mode(
  p_region_id   uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_target_mode text    DEFAULT 'NORMAL',
  p_reason_code text    DEFAULT NULL,
  p_actor_id    uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_previous_mode text;
  v_emit_result   jsonb;
  v_valid_modes   text[] := ARRAY['NORMAL', 'ELEVATED', 'PROTECTIVE', 'RECOVERY'];
  v_auth_uid      uuid;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id <> v_auth_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF NOT (p_target_mode = ANY(v_valid_modes)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'target_mode must be one of: NORMAL, ELEVATED, PROTECTIVE, RECOVERY'
    );
  END IF;

  SELECT mode INTO v_previous_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  IF v_previous_mode = p_target_mode THEN
    RETURN jsonb_build_object(
      'success',       true,
      'region_id',     p_region_id,
      'previous_mode', v_previous_mode,
      'current_mode',  p_target_mode,
      'no_op',         true
    );
  END IF;

  INSERT INTO region_operational_state (region_id, mode, updated_at, metadata)
  VALUES (p_region_id, p_target_mode, now(), '{}'::jsonb)
  ON CONFLICT (region_id) DO UPDATE
    SET mode       = EXCLUDED.mode,
        updated_at = now();

  v_emit_result := emit_event(
    p_event_type      := 'region_mode_changed',
    p_feature_id      := 'governance',
    p_scope_type      := 'system',
    p_scope_id        := p_region_id,
    p_actor_id        := v_auth_uid,
    p_actor_type      := 'user',
    p_reason_code     := p_reason_code,
    p_previous_state  := jsonb_build_object('mode', COALESCE(v_previous_mode, 'none')),
    p_resulting_state := jsonb_build_object('mode', p_target_mode),
    p_metadata        := jsonb_build_object(
      'region_id',     p_region_id,
      'previous_mode', COALESCE(v_previous_mode, 'none'),
      'target_mode',   p_target_mode,
      'reason_code',   p_reason_code
    )
  );

  IF NOT (v_emit_result->>'success')::boolean THEN
    RAISE EXCEPTION 'emit_event failed for region_mode_changed: %', v_emit_result->>'error';
  END IF;

  RETURN jsonb_build_object(
    'success',       true,
    'region_id',     p_region_id,
    'previous_mode', COALESCE(v_previous_mode, 'none'),
    'current_mode',  p_target_mode,
    'event_id',      v_emit_result->>'event_id',
    'no_op',         false
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION set_region_operational_mode(uuid, text, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION set_region_operational_mode(uuid, text, text, uuid) FROM anon;


-- >>>>>>> END: 20260323140000_pass11_region_mode_auth_binding.sql <<<<<<


-- >>>>>>> BEGIN: 20260323150000_pass12_membership_self_rpc_auth_binding.sql <<<<<<

/*
  Pass 12: Bind account membership RPCs to the authenticated subject.

  consume_scan_credit was already REVOKE'd from authenticated in pass8.
  These functions remain callable by authenticated users but previously accepted
  arbitrary p_user_id — now p_user_id must equal auth.uid() (self-service only).
  Admin/service-tier changes should use service role or a future dedicated RPC.
*/

CREATE OR REPLACE FUNCTION request_step_up_verification(
  p_user_id uuid,
  p_mutation_class text,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_requires_step_up boolean := false;
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('required', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('required', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('required', false, 'error', 'profile_not_found');
  END IF;

  IF p_mutation_class IN ('EXPORT_GRANT', 'ORGANIZER_TRANSFER', 'TIER_UPGRADE', 'MFA_DISABLE') THEN
    v_requires_step_up := true;
  END IF;

  IF NOT v_requires_step_up THEN
    RETURN jsonb_build_object('required', false, 'reason', 'mutation_class_not_sensitive');
  END IF;

  IF v_profile.last_step_up_at IS NOT NULL
     AND v_profile.last_step_up_at > (now() - interval '15 minutes') THEN
    RETURN jsonb_build_object(
      'required', false,
      'reason', 'recently_verified',
      'last_verified_at', v_profile.last_step_up_at,
      'expires_at', v_profile.last_step_up_at + interval '15 minutes'
    );
  END IF;

  v_emit_result := emit_event(
    p_event_type := 'step_up_verification_requested',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'sensitive_mutation',
    p_metadata := jsonb_build_object(
      'mutation_class', p_mutation_class,
      'session_id', p_session_id
    )
  );

  RETURN jsonb_build_object(
    'required', true,
    'mutation_class', p_mutation_class,
    'mfa_enabled', v_profile.mfa_enabled,
    'available_methods', v_profile.mfa_methods,
    'message', 'Please re-authenticate or complete MFA challenge'
  );
END;
$$;

CREATE OR REPLACE FUNCTION complete_step_up_verification(
  p_user_id uuid,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE user_profiles
  SET last_step_up_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;

  IF p_session_id IS NOT NULL THEN
    UPDATE session_tokens
    SET step_up_verified_at = now()
    WHERE session_id = p_session_id
      AND user_id = p_user_id;
  END IF;

  v_emit_result := emit_event(
    p_event_type := 'step_up_verification_completed',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'verification_success',
    p_metadata := jsonb_build_object(
      'session_id', p_session_id,
      'verified_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'verified_at', now(),
    'expires_at', now() + interval '15 minutes'
  );
END;
$$;

CREATE OR REPLACE FUNCTION update_membership_tier(
  p_user_id uuid,
  p_new_tier text,
  p_expires_at timestamptz DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_old_tier text;
  v_entitlement membership_entitlements%ROWTYPE;
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_old_tier := v_profile.membership_tier;

  SELECT * INTO v_entitlement
  FROM membership_entitlements
  WHERE tier = p_new_tier;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tier');
  END IF;

  UPDATE user_profiles
  SET membership_tier = p_new_tier,
      previous_tier = v_old_tier,
      tier_granted_at = now(),
      tier_expires_at = p_expires_at,
      scan_credits_remaining = v_entitlement.monthly_basic_scan_quota,
      deep_scan_credits_remaining = v_entitlement.monthly_deep_scan_quota,
      updated_at = now()
  WHERE user_id = p_user_id;

  v_emit_result := emit_event(
    p_event_type := 'tier_changed',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'tier_update',
    p_previous_state := jsonb_build_object('tier', v_old_tier),
    p_resulting_state := jsonb_build_object('tier', p_new_tier),
    p_metadata := jsonb_build_object(
      'old_tier', v_old_tier,
      'new_tier', p_new_tier,
      'expires_at', p_expires_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_tier', v_old_tier,
    'new_tier', p_new_tier,
    'tier_granted_at', now(),
    'tier_expires_at', p_expires_at,
    'event_id', v_emit_result->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION record_mfa_enrollment(
  p_user_id uuid,
  p_mfa_method text,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_methods text[];
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  v_methods := v_profile.mfa_methods;

  IF p_action = 'enroll' THEN
    IF NOT (p_mfa_method = ANY(v_methods)) THEN
      v_methods := array_append(v_methods, p_mfa_method);
    END IF;

    UPDATE user_profiles
    SET mfa_enabled = true,
        mfa_methods = v_methods,
        updated_at = now()
    WHERE user_id = p_user_id;

    v_emit_result := emit_event(
      p_event_type := 'mfa_enrolled',
      p_feature_id := 'accounts',
      p_scope_type := 'user',
      p_scope_id := p_user_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := 'mfa_setup',
      p_metadata := jsonb_build_object(
        'mfa_method', p_mfa_method,
        'total_methods', array_length(v_methods, 1)
      )
    );

  ELSIF p_action = 'unenroll' THEN
    v_methods := array_remove(v_methods, p_mfa_method);

    UPDATE user_profiles
    SET mfa_enabled = CASE WHEN array_length(v_methods, 1) > 0 THEN true ELSE false END,
        mfa_methods = v_methods,
        updated_at = now()
    WHERE user_id = p_user_id;

    v_emit_result := emit_event(
      p_event_type := 'mfa_unenrolled',
      p_feature_id := 'accounts',
      p_scope_type := 'user',
      p_scope_id := p_user_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := 'mfa_removal',
      p_metadata := jsonb_build_object(
        'mfa_method', p_mfa_method,
        'remaining_methods', array_length(v_methods, 1)
      )
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'mfa_enabled', array_length(v_methods, 1) > 0,
    'mfa_methods', v_methods,
    'event_id', v_emit_result->>'event_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION create_session_token(
  p_user_id uuid,
  p_device_fingerprint text,
  p_device_name text DEFAULT NULL,
  p_device_type text DEFAULT 'web',
  p_user_agent text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id uuid;
  v_emit_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  INSERT INTO session_tokens (
    user_id,
    device_fingerprint,
    device_name,
    device_type,
    user_agent,
    ip_address
  ) VALUES (
    p_user_id,
    p_device_fingerprint,
    p_device_name,
    p_device_type,
    p_user_agent,
    p_ip_address
  )
  RETURNING session_id INTO v_session_id;

  v_emit_result := emit_event(
    p_event_type := 'session_created',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'new_session',
    p_metadata := jsonb_build_object(
      'session_id', v_session_id,
      'device_type', p_device_type
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'expires_at', now() + interval '30 days'
  );
END;
$$;


-- >>>>>>> END: 20260323150000_pass12_membership_self_rpc_auth_binding.sql <<<<<<


-- >>>>>>> BEGIN: 20260323150001_pass13_action_inbox_actor_auth_binding.sql <<<<<<

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


-- >>>>>>> END: 20260323150001_pass13_action_inbox_actor_auth_binding.sql <<<<<<


-- >>>>>>> BEGIN: 20260323151000_pass14_claim_packet_routing_ready_guard.sql <<<<<<

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


-- >>>>>>> END: 20260323151000_pass14_claim_packet_routing_ready_guard.sql <<<<<<
