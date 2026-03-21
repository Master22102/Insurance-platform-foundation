/*
  Section 2.0.1 — Identity / group mutations: precheck_mutation_guard → mutate → emit_event (fail closed).
  - Extends precheck_mutation_guard with identity_* mutation classes (PROTECTIVE / RECOVERY aligned with 2.0.11).
  - Registers ledger event types used by identity RPCs.
  - Removes direct authenticated writes to identity-adjacent tables; mutations only via SECURITY DEFINER RPCs.
  - Adds update_group_participant_residence_profile RPC with guard + audit emit.
*/

-- -----------------------------------------------------------------------------
-- 1) Event type registry (required for emit_event checksum path)
-- -----------------------------------------------------------------------------
-- Allow emit_event scope labels used by identity + trips layers (legacy enum baseline lacked these).
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'entity_type' AND e.enumlabel = 'trip'
  ) THEN
    ALTER TYPE public.entity_type ADD VALUE 'trip';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$enum$;

DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'entity_type' AND e.enumlabel = 'user'
  ) THEN
    ALTER TYPE public.entity_type ADD VALUE 'user';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$enum$;

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('relationship_verification_requested', 1, 'identity', 'info'),
  ('relationship_verification_automatic', 1, 'identity', 'info'),
  ('relationship_verification_approved', 1, 'identity', 'info'),
  ('relationship_verification_denied', 1, 'identity', 'info'),
  ('relationship_verification_timeout', 1, 'identity', 'info'),
  ('export_authorization_granted', 1, 'identity', 'info'),
  ('export_authorization_revoked', 1, 'identity', 'info'),
  ('blocked_relationship_created', 1, 'identity', 'warning'),
  ('relationship_verification_override', 1, 'identity', 'warning'),
  ('participant_residence_profile_updated', 1, 'identity', 'info')
ON CONFLICT (event_type) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2) precheck_mutation_guard — extend with Section 2 identity classes
--    (baseline copied from itr_storage_focl_proof migration)
-- -----------------------------------------------------------------------------
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

  IF v_mode = 'NORMAL' THEN
    v_allowed := true;

  ELSIF v_mode = 'ELEVATED' THEN
    v_allowed := p_mutation_class NOT IN (
      'registry_edit',
      'threshold_override'
    );

  ELSIF v_mode = 'PROTECTIVE' THEN
    -- 2.0.11: block membership restructuring, delegation/export grants, founder override; allow self-defense + verify + residence.
    v_allowed := p_mutation_class IN (
      'trip_create',
      'incident_create',
      'evidence_upload',
      'connector_failure_log',
      'connector_auto_downgrade',
      'connector_health_check_job',
      'itr_emit',
      'identity_resolve_relationship_verification',
      'identity_export_revoke',
      'identity_participant_residence_profile'
    );

  ELSIF v_mode = 'RECOVERY' THEN
    v_allowed := p_mutation_class IN (
      'evidence_upload',
      'incident_create',
      'incident_status_change',
      'connector_failure_log',
      'connector_auto_downgrade',
      'connector_health_check_job',
      'itr_emit',
      'identity_resolve_relationship_verification',
      'identity_export_revoke',
      'identity_participant_residence_profile',
      'identity_invite_group_participant',
      'identity_export_grant',
      'identity_founder_relationship_override'
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

-- -----------------------------------------------------------------------------
-- 3) RLS: no direct client mutations on identity-adjacent tables
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizer can upsert participants" ON public.group_participants;
DROP POLICY IF EXISTS "Requester can create verification requests" ON public.relationship_verification_requests;
DROP POLICY IF EXISTS "Subject can resolve verification requests" ON public.relationship_verification_requests;
DROP POLICY IF EXISTS "Subject and guardian can insert grants" ON public.export_authorization_grants;
DROP POLICY IF EXISTS "Subject and guardian can revoke grants" ON public.export_authorization_grants;

-- -----------------------------------------------------------------------------
-- 4) RPC: residence update (guard + emit + subject or organizer only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_group_participant_residence_profile(
  p_participant_id uuid,
  p_residence_country_code text DEFAULT NULL,
  p_residence_state_code text DEFAULT NULL,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guard jsonb;
  v_row public.group_participants%ROWTYPE;
  v_trip public.trips%ROWTYPE;
  v_emit jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'identity', 'identity_participant_residence_profile');
  IF NOT COALESCE((v_guard->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'mutation_guard_blocked',
      'guard', v_guard
    );
  END IF;

  SELECT * INTO v_row
  FROM public.group_participants
  WHERE participant_id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'participant_not_found');
  END IF;

  SELECT * INTO v_trip
  FROM public.trips
  WHERE trip_id = v_row.trip_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found');
  END IF;

  IF NOT (
    v_row.account_id = auth.uid()
    OR (
      v_trip.created_by = auth.uid()
      AND v_trip.is_group_trip = true
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized_residence_update');
  END IF;

  UPDATE public.group_participants
  SET
    residence_country_code = CASE
      WHEN p_residence_country_code IS NULL THEN v_row.residence_country_code
      ELSE NULLIF(btrim(p_residence_country_code), '')
    END,
    residence_state_code = CASE
      WHEN p_residence_state_code IS NULL THEN v_row.residence_state_code
      ELSE NULLIF(btrim(p_residence_state_code), '')
    END,
    updated_at = now()
  WHERE participant_id = p_participant_id;

  v_emit := emit_event(
    'participant_residence_profile_updated',
    'identity',
    'trip',
    v_row.trip_id,
    auth.uid(),
    'user',
    'residence_profile_patch',
    jsonb_build_object(
      'participant_id', p_participant_id,
      'account_id', v_row.account_id,
      'previous_country', v_row.residence_country_code,
      'previous_state', v_row.residence_state_code
    ),
    jsonb_build_object(
      'participant_id', p_participant_id,
      'residence_country_code', CASE
        WHEN p_residence_country_code IS NULL THEN v_row.residence_country_code
        ELSE NULLIF(btrim(p_residence_country_code), '')
      END,
      'residence_state_code', CASE
        WHEN p_residence_state_code IS NULL THEN v_row.residence_state_code
        ELSE NULLIF(btrim(p_residence_state_code), '')
      END
    ),
    jsonb_build_object('subject_id', v_row.account_id, 'trip_id', v_row.trip_id)
  );

  IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'updated', 'event_id', v_emit->>'event_id');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_group_participant_residence_profile(uuid, text, text, uuid) TO authenticated;

-- 4b) Optional region default for clients that omit governance scope
CREATE OR REPLACE FUNCTION public.update_group_participant_residence_profile(
  p_participant_id uuid,
  p_residence_country_code text DEFAULT NULL,
  p_residence_state_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.update_group_participant_residence_profile(
    p_participant_id,
    p_residence_country_code,
    p_residence_state_code,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION public.update_group_participant_residence_profile(uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) request_group_participant_add (3-arg) → delegates to 5-arg
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_group_participant_add(
  p_trip_id uuid,
  p_subject_id uuid,
  p_trip_type text DEFAULT 'friend_group'
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.request_group_participant_add(
    p_trip_id,
    p_subject_id,
    p_trip_type,
    false,
    NULL::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION public.request_group_participant_add(uuid, uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) request_group_participant_add (5-arg) — guard + emits checked
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_group_participant_add(
  p_trip_id uuid,
  p_subject_id uuid,
  p_trip_type text DEFAULT 'friend_group',
  p_requires_guardian_approval boolean DEFAULT false,
  p_guardian_id uuid DEFAULT NULL,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guard jsonb;
  v_trip public.trips%ROWTYPE;
  v_request_id uuid;
  v_expiry_hours integer := 48;
  v_has_prior boolean := false;
  v_denied_or_expired_30d integer := 0;
  v_has_block boolean := false;
  v_emit jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'identity', 'identity_invite_group_participant');
  IF NOT COALESCE((v_guard->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'mutation_guard_blocked', 'guard', v_guard);
  END IF;

  SELECT * INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
    AND created_by = auth.uid()
    AND is_group_trip = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found_or_not_group_organizer');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_relationships br
    WHERE br.requester_id = auth.uid()
      AND br.subject_id = p_subject_id
      AND br.active = true
      AND (br.blocked_until IS NULL OR br.blocked_until > now())
  ) INTO v_has_block;

  IF v_has_block THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'relationship_invite_blocked',
      'message', 'Invite limit reached for this subject. Founder override is required to reset.'
    );
  END IF;

  SELECT count(*)::int INTO v_denied_or_expired_30d
  FROM public.relationship_verification_requests r
  WHERE r.requester_id = auth.uid()
    AND r.subject_id = p_subject_id
    AND r.created_at > now() - interval '30 days'
    AND r.status IN ('denied', 'expired');

  IF v_denied_or_expired_30d >= 3 THEN
    INSERT INTO public.blocked_relationships (
      requester_id, subject_id, reason, blocked_until, active, created_by, metadata
    ) VALUES (
      auth.uid(), p_subject_id, 'retry_limit_exceeded', now() + interval '90 days', true, auth.uid(),
      jsonb_build_object('window_days', 30, 'attempts', v_denied_or_expired_30d)
    )
    ON CONFLICT (requester_id, subject_id, active) DO UPDATE
      SET blocked_until = EXCLUDED.blocked_until,
          metadata = EXCLUDED.metadata;

    v_emit := emit_event(
      'blocked_relationship_created',
      'identity',
      'user',
      p_subject_id,
      auth.uid(),
      'user',
      'retry_limit_exceeded',
      '{}'::jsonb,
      jsonb_build_object('requester_id', auth.uid(), 'subject_id', p_subject_id, 'attempts_30d', v_denied_or_expired_30d),
      jsonb_build_object('trip_id', p_trip_id)
    );
    IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
      RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'relationship_invite_blocked',
      'message', 'Invite limit reached for this subject. Try again later.'
    );
  END IF;

  SELECT public.prior_relationship_exists(auth.uid(), p_subject_id) INTO v_has_prior;
  IF v_has_prior THEN
    INSERT INTO public.group_participants (trip_id, account_id, role, status, created_by)
    VALUES (p_trip_id, p_subject_id, 'participant', 'active', auth.uid())
    ON CONFLICT (trip_id, account_id) DO UPDATE SET status = 'active', updated_at = now();

    v_emit := emit_event(
      'relationship_verification_automatic',
      'identity',
      'trip',
      p_trip_id,
      auth.uid(),
      'user',
      'prior_relationship_exists',
      '{}'::jsonb,
      jsonb_build_object('subject_id', p_subject_id, 'added_automatic', true),
      jsonb_build_object('subject_id', p_subject_id)
    );
    IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
      RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'added_automatic');
  END IF;

  IF p_trip_type = 'family' THEN v_expiry_hours := 24; END IF;
  IF p_trip_type = 'school' THEN v_expiry_hours := 48; END IF;
  IF p_trip_type = 'corporate' THEN v_expiry_hours := 168; END IF;

  INSERT INTO public.relationship_verification_requests (
    requester_id, subject_id, trip_id, trip_type, status, expires_at,
    guardian_id, requires_dual_approval, subject_approved, guardian_approved
  ) VALUES (
    auth.uid(), p_subject_id, p_trip_id, COALESCE(p_trip_type, 'friend_group'), 'pending',
    now() + make_interval(hours => v_expiry_hours),
    p_guardian_id, COALESCE(p_requires_guardian_approval, false), false, false
  )
  RETURNING request_id INTO v_request_id;

  v_emit := emit_event(
    'relationship_verification_requested',
    'identity',
    'trip',
    p_trip_id,
    auth.uid(),
    'user',
    CASE WHEN p_requires_guardian_approval THEN 'minor_dual_approval_required' ELSE 'no_prior_relationship' END,
    '{}'::jsonb,
    jsonb_build_object('request_id', v_request_id, 'subject_id', p_subject_id, 'guardian_id', p_guardian_id),
    jsonb_build_object('request_id', v_request_id, 'subject_id', p_subject_id, 'guardian_id', p_guardian_id, 'trip_type', p_trip_type)
  );
  IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'pending_verification', 'request_id', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_group_participant_add(uuid, uuid, text, boolean, uuid, uuid) TO authenticated;
-- Keep 4-parameter overload for PostgREST / clients that omit region (default applied)
CREATE OR REPLACE FUNCTION public.request_group_participant_add(
  p_trip_id uuid,
  p_subject_id uuid,
  p_trip_type text DEFAULT 'friend_group',
  p_requires_guardian_approval boolean DEFAULT false,
  p_guardian_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.request_group_participant_add(
    p_trip_id,
    p_subject_id,
    p_trip_type,
    p_requires_guardian_approval,
    p_guardian_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION public.request_group_participant_add(uuid, uuid, text, boolean, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7) resolve_relationship_verification_request
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_relationship_verification_request(
  p_request_id uuid,
  p_decision text,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guard jsonb;
  v_req public.relationship_verification_requests%ROWTYPE;
  v_is_subject boolean := false;
  v_is_guardian boolean := false;
  v_school_guardian_override boolean := false;
  v_emit jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'identity', 'identity_resolve_relationship_verification');
  IF NOT COALESCE((v_guard->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'mutation_guard_blocked', 'guard', v_guard);
  END IF;

  SELECT * INTO v_req
  FROM public.relationship_verification_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;

  v_is_subject := (v_req.subject_id = auth.uid());
  v_is_guardian := (v_req.guardian_id = auth.uid());
  IF NOT v_is_subject AND NOT v_is_guardian THEN
    RETURN jsonb_build_object('success', false, 'error', 'actor_not_authorized');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_pending', 'status', v_req.status);
  END IF;

  IF v_req.expires_at < now() THEN
    UPDATE public.relationship_verification_requests
    SET status = 'expired', resolved_at = now()
    WHERE request_id = p_request_id;
    v_emit := emit_event(
      'relationship_verification_timeout',
      'identity',
      'trip',
      v_req.trip_id,
      auth.uid(),
      'user',
      'request_expired',
      '{}'::jsonb,
      jsonb_build_object('request_id', p_request_id),
      jsonb_build_object('request_id', p_request_id)
    );
    IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
      RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'request_expired');
  END IF;

  IF lower(p_decision) = 'deny' THEN
    UPDATE public.relationship_verification_requests
    SET status = 'denied', resolved_at = now()
    WHERE request_id = p_request_id;
    v_emit := emit_event(
      'relationship_verification_denied',
      'identity',
      'trip',
      v_req.trip_id,
      auth.uid(),
      'user',
      format('%s', CASE WHEN v_is_guardian THEN 'guardian_denied' ELSE 'subject_denied' END),
      '{}'::jsonb,
      jsonb_build_object('request_id', p_request_id),
      jsonb_build_object('request_id', p_request_id)
    );
    IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
      RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
    END IF;
    RETURN jsonb_build_object('success', true, 'status', 'denied');
  END IF;

  IF v_is_subject THEN
    UPDATE public.relationship_verification_requests
    SET subject_approved = true
    WHERE request_id = p_request_id;
  END IF;

  IF v_is_guardian THEN
    UPDATE public.relationship_verification_requests
    SET guardian_approved = true
    WHERE request_id = p_request_id;
  END IF;

  v_school_guardian_override :=
    v_req.trip_type = 'school'
    AND COALESCE((v_req.metadata->>'school_verified_organizer')::boolean, false)
    AND (SELECT guardian_approved FROM public.relationship_verification_requests WHERE request_id = p_request_id);

  IF NOT v_req.requires_dual_approval THEN
    UPDATE public.relationship_verification_requests
    SET status = 'approved', resolved_at = now(), subject_approved = true
    WHERE request_id = p_request_id;
  ELSIF v_school_guardian_override THEN
    UPDATE public.relationship_verification_requests
    SET status = 'approved', resolved_at = now()
    WHERE request_id = p_request_id;
  ELSIF (
    SELECT subject_approved AND guardian_approved
    FROM public.relationship_verification_requests
    WHERE request_id = p_request_id
  ) THEN
    UPDATE public.relationship_verification_requests
    SET status = 'approved', resolved_at = now()
    WHERE request_id = p_request_id;
  END IF;

  SELECT * INTO v_req
  FROM public.relationship_verification_requests
  WHERE request_id = p_request_id;

  IF v_req.status = 'approved' THEN
    INSERT INTO public.group_participants (trip_id, account_id, role, status, created_by)
    VALUES (v_req.trip_id, v_req.subject_id, 'participant', 'active', v_req.requester_id)
    ON CONFLICT (trip_id, account_id) DO UPDATE SET status = 'active', updated_at = now();

    v_emit := emit_event(
      'relationship_verification_approved',
      'identity',
      'trip',
      v_req.trip_id,
      auth.uid(),
      'user',
      format('%s', CASE WHEN v_req.requires_dual_approval THEN 'dual_approval_complete' ELSE 'approval_complete' END),
      '{}'::jsonb,
      jsonb_build_object('request_id', p_request_id),
      jsonb_build_object('request_id', p_request_id)
    );
    IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
      RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_req.status,
    'subject_approved', v_req.subject_approved,
    'guardian_approved', v_req.guardian_approved
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_relationship_verification_request(uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_relationship_verification_request(
  p_request_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.resolve_relationship_verification_request(
    p_request_id,
    p_decision,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_relationship_verification_request(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8) grant_export_authorization
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_export_authorization(
  p_trip_id uuid,
  p_subject_id uuid,
  p_organizer_id uuid,
  p_expires_at timestamptz DEFAULT NULL,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guard jsonb;
  v_guardian_allows boolean := false;
  v_grant_id uuid;
  v_emit jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'identity', 'identity_export_grant');
  IF NOT COALESCE((v_guard->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'mutation_guard_blocked', 'guard', v_guard);
  END IF;

  IF auth.uid() IS DISTINCT FROM p_subject_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.trusted_ally_links tal
      WHERE tal.subject_id = p_subject_id
        AND tal.ally_id = auth.uid()
        AND tal.status = 'active'
    ) INTO v_guardian_allows;
    IF NOT v_guardian_allows THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_subject_or_trusted_ally');
    END IF;
  END IF;

  INSERT INTO public.export_authorization_grants (
    subject_id, organizer_id, trip_id, status, granted_by, expires_at
  ) VALUES (
    p_subject_id, p_organizer_id, p_trip_id, 'active', auth.uid(), p_expires_at
  )
  RETURNING grant_id INTO v_grant_id;

  v_emit := emit_event(
    'export_authorization_granted',
    'identity',
    'trip',
    p_trip_id,
    auth.uid(),
    'user',
    'explicit_grant',
    '{}'::jsonb,
    jsonb_build_object('grant_id', v_grant_id, 'subject_id', p_subject_id, 'organizer_id', p_organizer_id),
    jsonb_build_object('grant_id', v_grant_id, 'subject_id', p_subject_id, 'organizer_id', p_organizer_id)
  );
  IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object('success', true, 'grant_id', v_grant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_export_authorization(uuid, uuid, uuid, timestamptz, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_export_authorization(
  p_trip_id uuid,
  p_subject_id uuid,
  p_organizer_id uuid,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.grant_export_authorization(
    p_trip_id,
    p_subject_id,
    p_organizer_id,
    p_expires_at,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION public.grant_export_authorization(uuid, uuid, uuid, timestamptz) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9) revoke_export_authorization (by grant id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_export_authorization(
  p_grant_id uuid,
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guard jsonb;
  v_grant public.export_authorization_grants%ROWTYPE;
  v_guardian_allows boolean := false;
  v_emit jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'identity', 'identity_export_revoke');
  IF NOT COALESCE((v_guard->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'mutation_guard_blocked', 'guard', v_guard);
  END IF;

  SELECT * INTO v_grant
  FROM public.export_authorization_grants
  WHERE grant_id = p_grant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'grant_not_found');
  END IF;

  IF auth.uid() IS DISTINCT FROM v_grant.subject_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.trusted_ally_links tal
      WHERE tal.subject_id = v_grant.subject_id
        AND tal.ally_id = auth.uid()
        AND tal.status = 'active'
    ) INTO v_guardian_allows;
    IF NOT v_guardian_allows THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_subject_or_trusted_ally');
    END IF;
  END IF;

  UPDATE public.export_authorization_grants
  SET status = 'revoked', revoked_at = now()
  WHERE grant_id = p_grant_id;

  v_emit := emit_event(
    'export_authorization_revoked',
    'identity',
    'trip',
    COALESCE(v_grant.trip_id, v_grant.subject_id),
    auth.uid(),
    'user',
    'subject_self_defense_revoke',
    '{}'::jsonb,
    jsonb_build_object('grant_id', p_grant_id, 'subject_id', v_grant.subject_id, 'organizer_id', v_grant.organizer_id),
    jsonb_build_object('grant_id', p_grant_id, 'subject_id', v_grant.subject_id, 'organizer_id', v_grant.organizer_id)
  );
  IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'revoked');
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_export_authorization(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_export_authorization(
  p_grant_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.revoke_export_authorization(
    p_grant_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION public.revoke_export_authorization(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10) revoke_export_authorization (trip / subject / organizer) — convenience
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_export_authorization(
  p_trip_id uuid,
  p_subject_id uuid,
  p_organizer_id uuid,
  p_reason_code text DEFAULT 'participant_self_defense',
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id uuid;
  v_guardian_allows boolean := false;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_subject_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.trusted_ally_links tal
      WHERE tal.subject_id = p_subject_id
        AND tal.ally_id = auth.uid()
        AND tal.status = 'active'
    ) INTO v_guardian_allows;
    IF NOT v_guardian_allows THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_subject_or_trusted_ally');
    END IF;
  END IF;

  SELECT grant_id INTO v_grant_id
  FROM public.export_authorization_grants
  WHERE trip_id = p_trip_id
    AND subject_id = p_subject_id
    AND organizer_id = p_organizer_id
    AND status = 'active'
  ORDER BY granted_at DESC
  LIMIT 1;

  IF v_grant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'grant_not_found');
  END IF;

  RETURN public.revoke_export_authorization(v_grant_id, p_region_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_export_authorization(uuid, uuid, uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_export_authorization(
  p_trip_id uuid,
  p_subject_id uuid,
  p_organizer_id uuid,
  p_reason_code text DEFAULT 'participant_self_defense'
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.revoke_export_authorization(
    p_trip_id,
    p_subject_id,
    p_organizer_id,
    p_reason_code,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION public.revoke_export_authorization(uuid, uuid, uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 11) founder_reset_relationship_block
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.founder_reset_relationship_block(
  p_requester_id uuid,
  p_subject_id uuid,
  p_reason_code text DEFAULT 'manual_founder_override',
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guard jsonb;
  v_actor_tier text;
  v_emit jsonb;
BEGIN
  v_guard := precheck_mutation_guard(p_region_id, 'identity', 'identity_founder_relationship_override');
  IF NOT COALESCE((v_guard->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'mutation_guard_blocked', 'guard', v_guard);
  END IF;

  SELECT membership_tier INTO v_actor_tier
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  IF COALESCE(v_actor_tier, '') <> 'FOUNDER' THEN
    RETURN jsonb_build_object('success', false, 'error', 'founder_only');
  END IF;

  UPDATE public.blocked_relationships
  SET active = false,
      blocked_until = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('founder_override_by', auth.uid(), 'founder_reason_code', p_reason_code)
  WHERE requester_id = p_requester_id
    AND subject_id = p_subject_id
    AND active = true;

  v_emit := emit_event(
    'relationship_verification_override',
    'identity',
    'user',
    p_subject_id,
    auth.uid(),
    'founder',
    p_reason_code,
    '{}'::jsonb,
    jsonb_build_object('requester_id', p_requester_id, 'subject_id', p_subject_id),
    jsonb_build_object('requester_id', p_requester_id, 'subject_id', p_subject_id)
  );
  IF NOT COALESCE((v_emit->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'emit_event_failed: %', COALESCE(v_emit->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'override_applied');
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_reset_relationship_block(uuid, uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.founder_reset_relationship_block(
  p_requester_id uuid,
  p_subject_id uuid,
  p_reason_code text DEFAULT 'manual_founder_override'
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.founder_reset_relationship_block(
    p_requester_id,
    p_subject_id,
    p_reason_code,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_reset_relationship_block(uuid, uuid, text) TO authenticated;

