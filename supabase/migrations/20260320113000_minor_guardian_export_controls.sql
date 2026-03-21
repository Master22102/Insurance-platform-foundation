/*
  Section 2 hardening:
  - Minor + guardian dual consent orchestration
  - Export authorization grants and revocation
  - Participant self-defense revoke flow
*/

CREATE TABLE IF NOT EXISTS public.trusted_ally_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ally_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (subject_id, ally_id)
);

ALTER TABLE public.trusted_ally_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trusted_ally_links'
      AND policyname='Subject and ally can read links'
  ) THEN
    CREATE POLICY "Subject and ally can read links"
      ON public.trusted_ally_links
      FOR SELECT
      TO authenticated
      USING (subject_id = auth.uid() OR ally_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.export_authorization_grants (
  grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_export_grants_subject ON public.export_authorization_grants(subject_id, organizer_id, status);

ALTER TABLE public.export_authorization_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='export_authorization_grants'
      AND policyname='Subject organizer read export grants'
  ) THEN
    CREATE POLICY "Subject organizer read export grants"
      ON public.export_authorization_grants
      FOR SELECT
      TO authenticated
      USING (subject_id = auth.uid() OR organizer_id = auth.uid() OR granted_by = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='export_authorization_grants'
      AND policyname='Subject and guardian can insert grants'
  ) THEN
    CREATE POLICY "Subject and guardian can insert grants"
      ON public.export_authorization_grants
      FOR INSERT
      TO authenticated
      WITH CHECK (granted_by = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='export_authorization_grants'
      AND policyname='Subject and guardian can revoke grants'
  ) THEN
    CREATE POLICY "Subject and guardian can revoke grants"
      ON public.export_authorization_grants
      FOR UPDATE
      TO authenticated
      USING (subject_id = auth.uid() OR granted_by = auth.uid())
      WITH CHECK (subject_id = subject_id);
  END IF;
END $$;

ALTER TABLE public.relationship_verification_requests
  ADD COLUMN IF NOT EXISTS guardian_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS requires_dual_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subject_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_approved boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.request_group_participant_add(
  p_trip_id uuid,
  p_subject_id uuid,
  p_trip_type text DEFAULT 'friend_group',
  p_requires_guardian_approval boolean DEFAULT false,
  p_guardian_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_request_id uuid;
  v_expiry_hours integer := 48;
  v_has_prior boolean := false;
BEGIN
  SELECT * INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
    AND created_by = auth.uid()
    AND is_group_trip = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_not_found_or_not_group_organizer');
  END IF;

  SELECT public.prior_relationship_exists(auth.uid(), p_subject_id) INTO v_has_prior;
  IF v_has_prior THEN
    INSERT INTO public.group_participants (trip_id, account_id, role, status, created_by)
    VALUES (p_trip_id, p_subject_id, 'participant', 'active', auth.uid())
    ON CONFLICT (trip_id, account_id) DO UPDATE SET status = 'active', updated_at = now();
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

  PERFORM emit_event(
    p_event_type := 'relationship_verification_requested',
    p_feature_id := 'identity',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := CASE WHEN p_requires_guardian_approval THEN 'minor_dual_approval_required' ELSE 'no_prior_relationship' END,
    p_metadata := jsonb_build_object('request_id', v_request_id, 'subject_id', p_subject_id, 'guardian_id', p_guardian_id, 'trip_type', p_trip_type)
  );

  RETURN jsonb_build_object('success', true, 'status', 'pending_verification', 'request_id', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_group_participant_add(uuid, uuid, text, boolean, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_relationship_verification_request(
  p_request_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req public.relationship_verification_requests%ROWTYPE;
  v_is_subject boolean := false;
  v_is_guardian boolean := false;
  v_school_guardian_override boolean := false;
BEGIN
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
    PERFORM emit_event(
      p_event_type := 'relationship_verification_timeout',
      p_feature_id := 'identity',
      p_scope_type := 'trip',
      p_scope_id := v_req.trip_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := 'request_expired',
      p_metadata := jsonb_build_object('request_id', p_request_id)
    );
    RETURN jsonb_build_object('success', false, 'error', 'request_expired');
  END IF;

  IF lower(p_decision) = 'deny' THEN
    UPDATE public.relationship_verification_requests
    SET status = 'denied', resolved_at = now()
    WHERE request_id = p_request_id;
    PERFORM emit_event(
      p_event_type := 'relationship_verification_denied',
      p_feature_id := 'identity',
      p_scope_type := 'trip',
      p_scope_id := v_req.trip_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := CASE WHEN v_is_guardian THEN 'guardian_denied' ELSE 'subject_denied' END,
      p_metadata := jsonb_build_object('request_id', p_request_id)
    );
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

  -- School-trip exception: guardian approval sufficient when tagged by organizer as verified.
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

    PERFORM emit_event(
      p_event_type := 'relationship_verification_approved',
      p_feature_id := 'identity',
      p_scope_type := 'trip',
      p_scope_id := v_req.trip_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := CASE WHEN v_req.requires_dual_approval THEN 'dual_approval_complete' ELSE 'approval_complete' END,
      p_metadata := jsonb_build_object('request_id', p_request_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_req.status,
    'subject_approved', v_req.subject_approved,
    'guardian_approved', v_req.guardian_approved
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_relationship_verification_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_export_authorization(
  p_trip_id uuid,
  p_subject_id uuid,
  p_organizer_id uuid,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guardian_allows boolean := false;
  v_grant_id uuid;
BEGIN
  IF auth.uid() <> p_subject_id THEN
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

  PERFORM emit_event(
    p_event_type := 'export_authorization_granted',
    p_feature_id := 'identity',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'explicit_grant',
    p_metadata := jsonb_build_object('grant_id', v_grant_id, 'subject_id', p_subject_id, 'organizer_id', p_organizer_id)
  );

  RETURN jsonb_build_object('success', true, 'grant_id', v_grant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_export_authorization(uuid, uuid, uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_export_authorization(
  p_grant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_grant public.export_authorization_grants%ROWTYPE;
  v_guardian_allows boolean := false;
BEGIN
  SELECT * INTO v_grant
  FROM public.export_authorization_grants
  WHERE grant_id = p_grant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'grant_not_found');
  END IF;

  IF auth.uid() <> v_grant.subject_id THEN
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

  PERFORM emit_event(
    p_event_type := 'export_authorization_revoked',
    p_feature_id := 'identity',
    p_scope_type := 'trip',
    p_scope_id := COALESCE(v_grant.trip_id, v_grant.subject_id),
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := 'subject_self_defense_revoke',
    p_metadata := jsonb_build_object('grant_id', p_grant_id, 'subject_id', v_grant.subject_id, 'organizer_id', v_grant.organizer_id)
  );

  RETURN jsonb_build_object('success', true, 'status', 'revoked');
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_export_authorization(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_organizer_export_subject(
  p_trip_id uuid,
  p_subject_id uuid,
  p_organizer_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'allowed',
    EXISTS (
      SELECT 1
      FROM public.export_authorization_grants g
      WHERE g.trip_id = p_trip_id
        AND g.subject_id = p_subject_id
        AND g.organizer_id = p_organizer_id
        AND g.status = 'active'
        AND (g.expires_at IS NULL OR g.expires_at > now())
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_organizer_export_subject(uuid, uuid, uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.blocked_relationships (
  block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'retry_limit_exceeded',
  blocked_until timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (requester_id, subject_id, active)
);

ALTER TABLE public.blocked_relationships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='blocked_relationships'
      AND policyname='Requester and subject read blocked relationships'
  ) THEN
    CREATE POLICY "Requester and subject read blocked relationships"
      ON public.blocked_relationships
      FOR SELECT
      TO authenticated
      USING (requester_id = auth.uid() OR subject_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.request_group_participant_add(
  p_trip_id uuid,
  p_subject_id uuid,
  p_trip_type text DEFAULT 'friend_group',
  p_requires_guardian_approval boolean DEFAULT false,
  p_guardian_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_request_id uuid;
  v_expiry_hours integer := 48;
  v_has_prior boolean := false;
  v_denied_or_expired_30d integer := 0;
  v_has_block boolean := false;
BEGIN
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

    PERFORM emit_event(
      p_event_type := 'blocked_relationship_created',
      p_feature_id := 'identity',
      p_scope_type := 'user',
      p_scope_id := p_subject_id,
      p_actor_id := auth.uid(),
      p_actor_type := 'user',
      p_reason_code := 'retry_limit_exceeded',
      p_metadata := jsonb_build_object('subject_id', p_subject_id, 'attempts_30d', v_denied_or_expired_30d)
    );

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

  PERFORM emit_event(
    p_event_type := 'relationship_verification_requested',
    p_feature_id := 'identity',
    p_scope_type := 'trip',
    p_scope_id := p_trip_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'user',
    p_reason_code := CASE WHEN p_requires_guardian_approval THEN 'minor_dual_approval_required' ELSE 'no_prior_relationship' END,
    p_metadata := jsonb_build_object('request_id', v_request_id, 'subject_id', p_subject_id, 'guardian_id', p_guardian_id, 'trip_type', p_trip_type)
  );

  RETURN jsonb_build_object('success', true, 'status', 'pending_verification', 'request_id', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_group_participant_add(uuid, uuid, text, boolean, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.founder_reset_relationship_block(
  p_requester_id uuid,
  p_subject_id uuid,
  p_reason_code text DEFAULT 'manual_founder_override'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_tier text;
BEGIN
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

  PERFORM emit_event(
    p_event_type := 'relationship_verification_override',
    p_feature_id := 'identity',
    p_scope_type := 'user',
    p_scope_id := p_subject_id,
    p_actor_id := auth.uid(),
    p_actor_type := 'admin',
    p_reason_code := p_reason_code,
    p_metadata := jsonb_build_object('requester_id', p_requester_id, 'subject_id', p_subject_id)
  );

  RETURN jsonb_build_object('success', true, 'status', 'override_applied');
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_reset_relationship_block(uuid, uuid, text) TO authenticated;
