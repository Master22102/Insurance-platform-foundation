/*
  # F-1 + F-2: Per-Trip Unlock Membership Model + Residence Fields
  Replaces subscription-tier model. Only FREE and CORPORATE exist at MVP.
  Credits move from user_profiles to trips table.
*/

-- Step 1: Fix membership_entitlements — drop STANDARD/PREMIUM, rewrite FREE/CORPORATE
DELETE FROM membership_entitlements WHERE tier IN ('STANDARD', 'PREMIUM');

ALTER TABLE membership_entitlements DROP CONSTRAINT IF EXISTS membership_entitlements_pkey CASCADE;
ALTER TABLE membership_entitlements DROP CONSTRAINT IF EXISTS membership_entitlements_tier_check;
ALTER TABLE membership_entitlements ADD CONSTRAINT membership_entitlements_tier_check CHECK (tier IN ('FREE', 'CORPORATE'));
ALTER TABLE membership_entitlements ADD PRIMARY KEY (tier);

INSERT INTO membership_entitlements (tier, monthly_basic_scan_quota, monthly_deep_scan_quota, max_trips_per_account, can_export_data, can_use_api, can_transfer_organizer, can_create_workspace, support_priority, features)
VALUES
  ('FREE', 0, 0, 0, false, false, false, false, 'standard',
   '{"lifetime_quick_scan_cap": 2, "deep_scan_eligible": false, "incident_creation_eligible": false, "note": "Tier 0 — 2 lifetime Quick Scans only. Hard paywall after. No resets ever."}'::jsonb),
  ('CORPORATE', 0, 0, 999999, true, true, true, true, 'dedicated',
   '{"deep_scan_eligible": true, "incident_creation_eligible": true, "export_eligible": true, "credits_model": "per_traveler_via_trips", "token_gated": true}'::jsonb)
ON CONFLICT (tier) DO UPDATE SET
  monthly_basic_scan_quota = EXCLUDED.monthly_basic_scan_quota,
  monthly_deep_scan_quota = EXCLUDED.monthly_deep_scan_quota,
  max_trips_per_account = EXCLUDED.max_trips_per_account,
  can_export_data = EXCLUDED.can_export_data, can_use_api = EXCLUDED.can_use_api,
  can_transfer_organizer = EXCLUDED.can_transfer_organizer,
  can_create_workspace = EXCLUDED.can_create_workspace,
  support_priority = EXCLUDED.support_priority, features = EXCLUDED.features;

-- Step 2: Fix user_profiles — remove monthly credit columns, add correct ones
ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS scan_credits_remaining,
  DROP COLUMN IF EXISTS deep_scan_credits_remaining,
  DROP COLUMN IF EXISTS credits_reset_at;

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_membership_tier_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_membership_tier_check CHECK (membership_tier IN ('FREE', 'CORPORATE'));

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS lifetime_quick_scans_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS residence_country_code text,
  ADD COLUMN IF NOT EXISTS residence_state_code text,
  ADD COLUMN IF NOT EXISTS primary_nationality text,
  ADD COLUMN IF NOT EXISTS secondary_nationality text;

CREATE INDEX IF NOT EXISTS idx_user_profiles_residence ON user_profiles(residence_country_code);

-- Audit trigger: log residence changes
CREATE OR REPLACE FUNCTION log_residence_change() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.residence_country_code IS DISTINCT FROM NEW.residence_country_code
     OR OLD.residence_state_code IS DISTINCT FROM NEW.residence_state_code THEN
    INSERT INTO account_actions_log (user_id, action_type, action_category, action_status, action_metadata)
    VALUES (NEW.user_id, 'residence_updated', 'profile', 'success',
      jsonb_build_object('old_country', OLD.residence_country_code, 'new_country', NEW.residence_country_code,
                         'old_state', OLD.residence_state_code, 'new_state', NEW.residence_state_code));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_residence_change ON user_profiles;
CREATE TRIGGER trg_log_residence_change AFTER UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION log_residence_change();

-- Step 3: Add per-trip scan credit columns to trips
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS deep_scan_credits_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deep_scan_credits_purchased integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quick_scans_used_this_week integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quick_scan_week_reset_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS itinerary_content_hash text;

CREATE INDEX IF NOT EXISTS idx_trips_itinerary_hash ON trips(itinerary_content_hash) WHERE itinerary_content_hash IS NOT NULL;

-- Step 4: Register new event types
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('trip_unlocked', 1, 'trips', 'info'),
  ('deep_scan_credit_added', 1, 'trips', 'info'),
  ('deep_scan_credit_consumed', 1, 'trips', 'info'),
  ('deep_scan_credits_exhausted', 1, 'trips', 'warning'),
  ('quick_scan_lifetime_cap_reached', 1, 'accounts', 'warning'),
  ('tier_0_paywall_triggered', 1, 'accounts', 'warning')
ON CONFLICT (event_type) DO NOTHING;

-- Step 5: unlock_trip() — called after payment confirmed upstream
CREATE OR REPLACE FUNCTION unlock_trip(p_trip_id uuid, p_actor_id uuid, p_credits_to_add integer DEFAULT 2, p_payment_ref text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_trip trips%ROWTYPE; v_emit jsonb;
BEGIN
  SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_actor_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_found'); END IF;
  IF v_trip.paid_unlock THEN RETURN jsonb_build_object('success', false, 'error', 'already_unlocked', 'paid_unlock_at', v_trip.paid_unlock_at); END IF;

  UPDATE trips SET paid_unlock = true, paid_unlock_at = now(),
    deep_scan_credits_remaining = p_credits_to_add, deep_scan_credits_purchased = p_credits_to_add
  WHERE trip_id = p_trip_id;

  v_emit := emit_event(p_event_type := 'trip_unlocked', p_feature_id := 'trips', p_scope_type := 'trip',
    p_scope_id := p_trip_id, p_actor_id := p_actor_id, p_actor_type := 'user', p_reason_code := 'payment_confirmed',
    p_resulting_state := jsonb_build_object('paid_unlock', true, 'deep_scan_credits', p_credits_to_add),
    p_metadata := jsonb_build_object('credits_added', p_credits_to_add, 'payment_ref', p_payment_ref));

  RETURN jsonb_build_object('success', true, 'trip_id', p_trip_id,
    'deep_scan_credits_remaining', p_credits_to_add, 'paid_unlock_at', now(), 'event_id', v_emit->>'event_id');
END; $$;
GRANT EXECUTE ON FUNCTION unlock_trip(uuid, uuid, integer, text) TO authenticated;

-- Step 6: add_deep_scan_credits() — à la carte top-up
CREATE OR REPLACE FUNCTION add_deep_scan_credits(p_trip_id uuid, p_actor_id uuid, p_credits integer, p_payment_ref text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_trip trips%ROWTYPE; v_emit jsonb;
BEGIN
  SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_actor_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_found'); END IF;
  IF NOT v_trip.paid_unlock THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked'); END IF;

  UPDATE trips SET deep_scan_credits_remaining = deep_scan_credits_remaining + p_credits,
    deep_scan_credits_purchased = deep_scan_credits_purchased + p_credits WHERE trip_id = p_trip_id;

  v_emit := emit_event(p_event_type := 'deep_scan_credit_added', p_feature_id := 'trips', p_scope_type := 'trip',
    p_scope_id := p_trip_id, p_actor_id := p_actor_id, p_actor_type := 'user', p_reason_code := 'purchase',
    p_metadata := jsonb_build_object('credits_added', p_credits, 'new_total', v_trip.deep_scan_credits_remaining + p_credits, 'payment_ref', p_payment_ref));

  RETURN jsonb_build_object('success', true, 'credits_added', p_credits, 'deep_scan_credits_remaining', v_trip.deep_scan_credits_remaining + p_credits);
END; $$;
GRANT EXECUTE ON FUNCTION add_deep_scan_credits(uuid, uuid, integer, text) TO authenticated;

-- Step 7: Rewrite check_membership_entitlement() — trip-aware
CREATE OR REPLACE FUNCTION check_membership_entitlement(p_user_id uuid, p_feature_check text, p_trip_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile user_profiles%ROWTYPE; v_trip trips%ROWTYPE;
  v_has_access boolean := false; v_reason text; v_emit jsonb;
BEGIN
  SELECT * INTO v_profile FROM user_profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', false, 'reason', 'user_profile_not_found'); END IF;

  -- Auto-downgrade expired CORPORATE
  IF v_profile.tier_expires_at IS NOT NULL AND v_profile.tier_expires_at < now() THEN
    UPDATE user_profiles SET membership_tier = 'FREE', previous_tier = membership_tier,
      tier_granted_at = now(), tier_expires_at = NULL, updated_at = now() WHERE user_id = p_user_id;
    v_profile.membership_tier := 'FREE';
  END IF;

  CASE p_feature_check
    WHEN 'quick_scan' THEN
      IF v_profile.lifetime_quick_scans_used < 2 THEN v_has_access := true;
      ELSE
        v_has_access := false; v_reason := 'lifetime_quick_scan_cap_reached';
        v_emit := emit_event(p_event_type := 'tier_0_paywall_triggered', p_feature_id := 'accounts',
          p_scope_type := 'user', p_scope_id := p_user_id, p_actor_id := p_user_id, p_actor_type := 'user',
          p_reason_code := 'lifetime_cap_reached',
          p_metadata := jsonb_build_object('lifetime_scans_used', v_profile.lifetime_quick_scans_used));
      END IF;
    WHEN 'quick_scan_paid' THEN
      IF p_trip_id IS NULL THEN v_has_access := false; v_reason := 'trip_id_required';
      ELSE
        SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id;
        IF NOT v_trip.paid_unlock THEN v_has_access := false; v_reason := 'trip_not_unlocked';
        ELSIF v_trip.quick_scan_week_reset_at < now() - interval '7 days' THEN
          UPDATE trips SET quick_scans_used_this_week = 0, quick_scan_week_reset_at = now() WHERE trip_id = p_trip_id;
          v_has_access := true;
        ELSIF v_trip.quick_scans_used_this_week < 4 THEN v_has_access := true;
        ELSE v_has_access := false; v_reason := 'weekly_quick_scan_limit_reached';
        END IF;
      END IF;
    WHEN 'deep_scan' THEN
      IF p_trip_id IS NULL THEN v_has_access := false; v_reason := 'trip_id_required';
      ELSE
        SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id;
        IF NOT v_trip.paid_unlock THEN v_has_access := false; v_reason := 'trip_not_unlocked';
        ELSIF v_trip.deep_scan_credits_remaining > 0 THEN v_has_access := true;
        ELSE v_has_access := false; v_reason := 'deep_scan_credits_exhausted';
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
    ELSE v_has_access := false; v_reason := 'unknown_feature_check';
  END CASE;

  IF NOT v_has_access THEN
    v_emit := emit_event(p_event_type := 'entitlement_check_failed', p_feature_id := 'accounts',
      p_scope_type := 'user', p_scope_id := p_user_id, p_actor_id := p_user_id, p_actor_type := 'user',
      p_reason_code := v_reason,
      p_metadata := jsonb_build_object('feature_check', p_feature_check, 'membership_tier', v_profile.membership_tier,
        'lifetime_quick_scans_used', v_profile.lifetime_quick_scans_used, 'trip_id', p_trip_id));
  END IF;

  RETURN jsonb_build_object('allowed', v_has_access, 'reason', v_reason, 'membership_tier', v_profile.membership_tier,
    'lifetime_quick_scans_used', v_profile.lifetime_quick_scans_used, 'trip_id', p_trip_id,
    'deep_scan_credits_remaining', CASE WHEN v_trip.trip_id IS NOT NULL THEN v_trip.deep_scan_credits_remaining ELSE NULL END);
END; $$;
GRANT EXECUTE ON FUNCTION check_membership_entitlement(uuid, text, uuid) TO authenticated;

-- Step 8: Rewrite consume_scan_credit() — quick on profile, deep on trip
CREATE OR REPLACE FUNCTION consume_scan_credit(p_user_id uuid, p_scan_type text, p_trip_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_profile user_profiles%ROWTYPE; v_trip trips%ROWTYPE; v_emit jsonb;
BEGIN
  IF p_scan_type = 'quick' THEN
    SELECT * INTO v_profile FROM user_profiles WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'profile_not_found'); END IF;
    IF v_profile.membership_tier = 'FREE' AND v_profile.lifetime_quick_scans_used >= 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'lifetime_quick_scan_cap_reached', 'lifetime_scans_used', v_profile.lifetime_quick_scans_used);
    END IF;
    UPDATE user_profiles SET lifetime_quick_scans_used = lifetime_quick_scans_used + 1, updated_at = now() WHERE user_id = p_user_id;
    IF p_trip_id IS NOT NULL THEN UPDATE trips SET quick_scans_used_this_week = quick_scans_used_this_week + 1 WHERE trip_id = p_trip_id; END IF;
    RETURN jsonb_build_object('success', true, 'scan_type', 'quick',
      'lifetime_scans_used', v_profile.lifetime_quick_scans_used + 1, 'lifetime_cap', 2,
      'scans_remaining', GREATEST(0, 1 - v_profile.lifetime_quick_scans_used));

  ELSIF p_scan_type = 'deep' THEN
    IF p_trip_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'trip_id_required_for_deep_scan'); END IF;
    SELECT * INTO v_trip FROM trips WHERE trip_id = p_trip_id AND account_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_found'); END IF;
    IF NOT v_trip.paid_unlock THEN RETURN jsonb_build_object('success', false, 'error', 'trip_not_unlocked'); END IF;
    IF v_trip.deep_scan_credits_remaining <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'no_deep_scan_credits_remaining', 'credits_remaining', 0); END IF;

    UPDATE trips SET deep_scan_credits_remaining = deep_scan_credits_remaining - 1 WHERE trip_id = p_trip_id;

    v_emit := emit_event(p_event_type := 'deep_scan_credit_consumed', p_feature_id := 'trips',
      p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_user_id, p_actor_type := 'user',
      p_reason_code := 'user_initiated',
      p_previous_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining),
      p_resulting_state := jsonb_build_object('credits_remaining', v_trip.deep_scan_credits_remaining - 1),
      p_metadata := jsonb_build_object('trip_id', p_trip_id, 'credits_before', v_trip.deep_scan_credits_remaining, 'credits_after', v_trip.deep_scan_credits_remaining - 1));

    IF v_trip.deep_scan_credits_remaining - 1 = 0 THEN
      PERFORM emit_event(p_event_type := 'deep_scan_credits_exhausted', p_feature_id := 'trips',
        p_scope_type := 'trip', p_scope_id := p_trip_id, p_actor_id := p_user_id, p_actor_type := 'user',
        p_reason_code := 'last_credit_consumed', p_metadata := jsonb_build_object('trip_id', p_trip_id));
    END IF;

    RETURN jsonb_build_object('success', true, 'scan_type', 'deep', 'trip_id', p_trip_id,
      'credits_remaining', v_trip.deep_scan_credits_remaining - 1, 'event_id', v_emit->>'event_id');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_scan_type');
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION consume_scan_credit(uuid, text, uuid) TO authenticated;

-- Step 9: Drop monthly reset function — does not exist in this model
DROP FUNCTION IF EXISTS reset_monthly_scan_credits();

-- Step 10: Fix signup trigger — remove deleted columns
CREATE OR REPLACE FUNCTION create_user_profile_on_signup() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, display_name, membership_tier, lifetime_quick_scans_used)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), 'FREE', 0)
  ON CONFLICT (user_id) DO NOTHING;
  PERFORM emit_event(p_event_type := 'account_created', p_feature_id := 'accounts', p_scope_type := 'user',
    p_scope_id := NEW.id, p_actor_id := NEW.id, p_actor_type := 'user', p_reason_code := 'signup');
  RETURN NEW;
END; $$;