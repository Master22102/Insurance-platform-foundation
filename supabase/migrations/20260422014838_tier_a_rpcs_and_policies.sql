/*
  # Tier A — Signal Profile, Anchor State, Consent RPCs + Missing Write Policies

  1. New RPCs
    - propose_signal_profile(account_id, voice_artifact_id, parsed_payload) -> uuid
    - confirm_signal_profile(version_id) -> uuid (stamps confirmed_at, emits event)
    - upsert_anchor_state(account_id, anchor_path) -> void (emits account_anchor_state_written)
    - record_terms_acceptance(account_id, version) -> uuid (emits account_terms_accepted)
    - record_privacy_acceptance(account_id, version) -> uuid (emits account_privacy_accepted)
    - upsert_quick_scan_result(account_id, trip_id, itinerary_hash, payload) -> void
    - record_location_ping(lat, lng, accuracy, source, provider) -> uuid with stamped certainty

  2. Policy Changes
    - Add INSERT policies on quick_scan_results (owner only)
    - Add INSERT policy on user_signal_profile_versions (owner only)

  3. Security
    - All RPCs are SECURITY DEFINER with auth.uid() ownership checks
    - RLS policies remain restrictive — only owner writes to own rows
*/

-- ============================================================================
-- INSERT / UPDATE policies that were missing
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quick_scan_results' AND policyname='Owner can insert quick scan results'
  ) THEN
    CREATE POLICY "Owner can insert quick scan results"
      ON public.quick_scan_results FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) = account_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quick_scan_results' AND policyname='Owner can update quick scan results'
  ) THEN
    CREATE POLICY "Owner can update quick scan results"
      ON public.quick_scan_results FOR UPDATE TO authenticated
      USING ((select auth.uid()) = account_id)
      WITH CHECK ((select auth.uid()) = account_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_signal_profile_versions' AND policyname='Owner can insert signal profile version'
  ) THEN
    CREATE POLICY "Owner can insert signal profile version"
      ON public.user_signal_profile_versions FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) = account_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_signal_profile_versions' AND policyname='Owner can update signal profile version'
  ) THEN
    CREATE POLICY "Owner can update signal profile version"
      ON public.user_signal_profile_versions FOR UPDATE TO authenticated
      USING ((select auth.uid()) = account_id)
      WITH CHECK ((select auth.uid()) = account_id);
  END IF;
END $$;

-- ============================================================================
-- propose_signal_profile — creates a new (unconfirmed) signal profile version
-- ============================================================================
CREATE OR REPLACE FUNCTION public.propose_signal_profile(
  p_account_id uuid,
  p_parsed_payload jsonb,
  p_source_voice_artifact_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_id uuid;
BEGIN
  IF p_account_id IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() <> p_account_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.user_signal_profile_versions (account_id, parsed_payload, source_voice_artifact_id, proposed_at)
  VALUES (p_account_id, COALESCE(p_parsed_payload, '{}'::jsonb), p_source_voice_artifact_id, now())
  RETURNING version_id INTO v_version_id;

  INSERT INTO public.event_logs (event_type, actor_id, actor_type, related_entity_type, related_entity_id, event_data)
  VALUES ('signal_profile_proposed', p_account_id, 'user', 'account', p_account_id,
          jsonb_build_object('version_id', v_version_id));

  RETURN v_version_id;
END;
$$;

-- ============================================================================
-- confirm_signal_profile — stamps confirmed_at and emits ledger event
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirm_signal_profile(
  p_version_id uuid
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
  SELECT account_id INTO v_account_id
  FROM public.user_signal_profile_versions
  WHERE version_id = p_version_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'signal_profile_version_not_found';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_account_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.event_logs (event_type, actor_id, actor_type, related_entity_type, related_entity_id, event_data)
  VALUES ('signal_profile_confirmed', v_account_id, 'user', 'account', v_account_id,
          jsonb_build_object('version_id', p_version_id))
  RETURNING id INTO v_event_id;

  UPDATE public.user_signal_profile_versions
  SET confirmed_at = COALESCE(confirmed_at, now()),
      confirm_action_event_id = COALESCE(confirm_action_event_id, v_event_id)
  WHERE version_id = p_version_id;

  RETURN p_version_id;
END;
$$;

-- ============================================================================
-- upsert_anchor_state — writes first-anchored-at and path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_anchor_state(
  p_account_id uuid,
  p_anchor_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_account_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.account_anchor_state (account_id, anchor_path, first_anchored_at, updated_at)
  VALUES (p_account_id, p_anchor_path, now(), now())
  ON CONFLICT (account_id) DO UPDATE
    SET anchor_path = EXCLUDED.anchor_path,
        updated_at = now();

  INSERT INTO public.event_logs (event_type, actor_id, actor_type, related_entity_type, related_entity_id, event_data)
  VALUES ('account_anchor_state_written', p_account_id, 'user', 'account', p_account_id,
          jsonb_build_object('anchor_path', p_anchor_path));
END;
$$;

-- ============================================================================
-- record_terms_acceptance / record_privacy_acceptance — append-only ledger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_terms_acceptance(
  p_account_id uuid,
  p_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_account_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.event_logs (event_type, actor_id, actor_type, related_entity_type, related_entity_id, event_data)
  VALUES ('account_terms_accepted', p_account_id, 'user', 'account', p_account_id,
          jsonb_build_object('version', COALESCE(p_version,'v1')))
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_privacy_acceptance(
  p_account_id uuid,
  p_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_account_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.event_logs (event_type, actor_id, actor_type, related_entity_type, related_entity_id, event_data)
  VALUES ('account_privacy_accepted', p_account_id, 'user', 'account', p_account_id,
          jsonb_build_object('version', COALESCE(p_version,'v1')))
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- ============================================================================
-- upsert_quick_scan_result — cache write with owner check
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_quick_scan_result(
  p_account_id uuid,
  p_itinerary_hash text,
  p_payload jsonb,
  p_trip_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash_key text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_account_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_hash_key := p_account_id::text || ':' || p_itinerary_hash;

  INSERT INTO public.quick_scan_results (account_id, trip_id, itinerary_hash, hash_key, computed_payload, computed_at)
  VALUES (p_account_id, p_trip_id, p_itinerary_hash, v_hash_key, p_payload, now())
  ON CONFLICT (hash_key) DO UPDATE
    SET computed_payload = EXCLUDED.computed_payload,
        computed_at = now(),
        trip_id = COALESCE(EXCLUDED.trip_id, public.quick_scan_results.trip_id);
END;
$$;

-- ============================================================================
-- record_location_ping — stamps location_source + location_certainty
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_location_ping(
  p_account_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_meters numeric,
  p_source text,
  p_group_id uuid DEFAULT NULL,
  p_battery_level integer DEFAULT NULL,
  p_connection_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ping_id uuid;
  v_source text;
  v_certainty text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_account_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_source := COALESCE(p_source, 'unknown');
  v_certainty := CASE
    WHEN v_source IN ('gps','gnss') AND COALESCE(p_accuracy_meters, 9999) <= 50 THEN 'confirmed'
    WHEN v_source = 'wifi' AND COALESCE(p_accuracy_meters, 9999) <= 150 THEN 'likely'
    WHEN v_source IN ('cell','cellular') THEN 'approximate'
    WHEN v_source = 'ip' THEN 'approximate'
    ELSE 'approximate'
  END;

  INSERT INTO public.travelshield_location_pings (
    account_id, group_id, latitude, longitude, accuracy_meters,
    location_source, location_certainty, battery_level, connection_type
  )
  VALUES (
    p_account_id, p_group_id, p_latitude, p_longitude, p_accuracy_meters,
    v_source, v_certainty, p_battery_level, p_connection_type
  )
  RETURNING ping_id INTO v_ping_id;

  RETURN v_ping_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.propose_signal_profile(uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_signal_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_anchor_state(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_terms_acceptance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_privacy_acceptance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_quick_scan_result(uuid, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_location_ping(uuid, numeric, numeric, numeric, text, uuid, integer, text) TO authenticated;
