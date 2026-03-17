/*
  # Account and Membership Infrastructure
  
  1. Purpose
    - Extends Supabase Auth with membership tiers and entitlements
    - Implements per-device session tracking
    - Provides step-up verification for sensitive operations
    - Enforces membership-gated features (Deep Scan, etc.)
  
  2. Membership Tiers
    - FREE: Basic trip tracking, limited scans (5/month)
    - STANDARD: Unlimited basic scans, limited deep scans (10/month)
    - PREMIUM: Unlimited scans including deep scans, priority support
    - CORPORATE: Multi-user workspace, API access, custom integrations
  
  3. MFA Support
    - TOTP (Time-based One-Time Password) via authenticator apps
    - SMS (future: requires Twilio integration)
    - Stored in auth.users.raw_app_meta_data by Supabase Auth
  
  4. Step-Up Verification
    - Required for: EXPORT_GRANT, ORGANIZER_TRANSFER, TIER_UPGRADE
    - Forces re-authentication or MFA challenge
    - Valid for 15 minutes after verification
  
  5. New Tables
    - user_profiles: extends auth.users with membership data
    - session_tokens: per-device session tracking
    - account_actions_log: audit trail for sensitive actions
    - membership_entitlements: defines what each tier can access
  
  6. Security
    - RLS enabled on all tables
    - User can only access own profile
    - SECURITY DEFINER RPCs for privilege escalation where needed
*/

-- Register event types
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('account_created', 1, 'accounts', 'info'),
  ('account_updated', 1, 'accounts', 'info'),
  ('tier_changed', 1, 'accounts', 'info'),
  ('mfa_enrolled', 1, 'accounts', 'warning'),
  ('mfa_unenrolled', 1, 'accounts', 'warning'),
  ('step_up_verification_requested', 1, 'accounts', 'warning'),
  ('step_up_verification_completed', 1, 'accounts', 'info'),
  ('session_created', 1, 'accounts', 'info'),
  ('session_revoked', 1, 'accounts', 'warning'),
  ('entitlement_check_failed', 1, 'accounts', 'warning'),
  ('scan_credits_depleted', 1, 'accounts', 'warning')
ON CONFLICT (event_type) DO NOTHING;

-- =====================================================
-- Membership Entitlements Definition Table
-- =====================================================

CREATE TABLE IF NOT EXISTS membership_entitlements (
  tier text PRIMARY KEY CHECK (tier IN ('FREE', 'STANDARD', 'PREMIUM', 'CORPORATE')),
  monthly_basic_scan_quota integer NOT NULL,
  monthly_deep_scan_quota integer NOT NULL,
  max_trips_per_account integer NOT NULL,
  can_export_data boolean NOT NULL DEFAULT false,
  can_use_api boolean NOT NULL DEFAULT false,
  can_transfer_organizer boolean NOT NULL DEFAULT false,
  can_create_workspace boolean NOT NULL DEFAULT false,
  support_priority text NOT NULL CHECK (support_priority IN ('standard', 'priority', 'dedicated')),
  features jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed entitlements
INSERT INTO membership_entitlements (
  tier,
  monthly_basic_scan_quota,
  monthly_deep_scan_quota,
  max_trips_per_account,
  can_export_data,
  can_use_api,
  can_transfer_organizer,
  can_create_workspace,
  support_priority,
  features
) VALUES
  ('FREE', 5, 0, 3, false, false, false, false, 'standard', 
   '{"max_policies_per_trip": 2, "max_incidents_per_trip": 5}'::jsonb),
  ('STANDARD', 999999, 10, 20, true, false, true, false, 'standard',
   '{"max_policies_per_trip": 10, "max_incidents_per_trip": 50}'::jsonb),
  ('PREMIUM', 999999, 999999, 100, true, false, true, false, 'priority',
   '{"max_policies_per_trip": 50, "max_incidents_per_trip": 999999, "claim_assistance": true}'::jsonb),
  ('CORPORATE', 999999, 999999, 999999, true, true, true, true, 'dedicated',
   '{"max_policies_per_trip": 999999, "max_incidents_per_trip": 999999, "claim_assistance": true, "custom_integrations": true, "multi_user_workspace": true}'::jsonb)
ON CONFLICT (tier) DO UPDATE SET
  monthly_basic_scan_quota = EXCLUDED.monthly_basic_scan_quota,
  monthly_deep_scan_quota = EXCLUDED.monthly_deep_scan_quota,
  max_trips_per_account = EXCLUDED.max_trips_per_account,
  can_export_data = EXCLUDED.can_export_data,
  can_use_api = EXCLUDED.can_use_api,
  can_transfer_organizer = EXCLUDED.can_transfer_organizer,
  can_create_workspace = EXCLUDED.can_create_workspace,
  support_priority = EXCLUDED.support_priority,
  features = EXCLUDED.features;

ALTER TABLE membership_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY entitlements_public_read ON membership_entitlements
  FOR SELECT USING (true);

-- =====================================================
-- User Profiles Table
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  
  -- Membership
  membership_tier text NOT NULL DEFAULT 'FREE'
    CHECK (membership_tier IN ('FREE', 'STANDARD', 'PREMIUM', 'CORPORATE')),
  tier_granted_at timestamptz NOT NULL DEFAULT now(),
  tier_expires_at timestamptz,
  previous_tier text,
  
  -- Scan credits (resets monthly)
  scan_credits_remaining integer NOT NULL DEFAULT 5,
  deep_scan_credits_remaining integer NOT NULL DEFAULT 0,
  credits_reset_at timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  
  -- MFA tracking
  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_methods text[] DEFAULT '{}',
  
  -- Step-up verification
  last_step_up_at timestamptz,
  
  -- Metadata
  onboarding_completed boolean NOT NULL DEFAULT false,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(membership_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier_expiry ON user_profiles(tier_expires_at)
  WHERE tier_expires_at IS NOT NULL;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_self_select ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY user_profiles_self_update ON user_profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- Session Tokens Table (Per-Device Tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS session_tokens (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Device info
  device_fingerprint text NOT NULL,
  device_name text,
  device_type text CHECK (device_type IN ('web', 'mobile', 'tablet', 'desktop')),
  user_agent text,
  ip_address inet,
  
  -- Session state
  is_active boolean NOT NULL DEFAULT true,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  revoked_reason text,
  
  -- Security
  step_up_verified_at timestamptz,
  requires_mfa boolean NOT NULL DEFAULT false,
  
  -- Metadata
  session_metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tokens_active ON session_tokens(user_id, is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_session_tokens_device ON session_tokens(device_fingerprint);

ALTER TABLE session_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_tokens_self_select ON session_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY session_tokens_self_insert ON session_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY session_tokens_self_update ON session_tokens
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- Account Actions Log (Audit Trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS account_actions_log (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action_type text NOT NULL,
  action_category text NOT NULL CHECK (action_category IN (
    'authentication', 'authorization', 'profile', 'membership', 'security', 'data_access'
  )),
  
  -- Context
  session_id uuid REFERENCES session_tokens(session_id),
  ip_address inet,
  user_agent text,
  
  -- Action details
  action_status text NOT NULL CHECK (action_status IN ('success', 'failure', 'blocked')),
  action_metadata jsonb DEFAULT '{}'::jsonb,
  failure_reason text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_actions_user ON account_actions_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_actions_type ON account_actions_log(action_type);
CREATE INDEX IF NOT EXISTS idx_account_actions_status ON account_actions_log(action_status)
  WHERE action_status IN ('failure', 'blocked');

ALTER TABLE account_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_actions_self_select ON account_actions_log
  FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- Auto-create user profile on signup
-- =====================================================

CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_profiles (
    user_id,
    display_name,
    membership_tier,
    scan_credits_remaining,
    deep_scan_credits_remaining
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'FREE',
    5,
    0
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_user_profile ON auth.users;
CREATE TRIGGER trg_create_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_on_signup();

-- =====================================================
-- Monthly credit reset function
-- =====================================================

CREATE OR REPLACE FUNCTION reset_monthly_scan_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_entitlement membership_entitlements%ROWTYPE;
BEGIN
  FOR v_profile IN
    SELECT * FROM user_profiles
    WHERE credits_reset_at <= now()
  LOOP
    SELECT * INTO v_entitlement
    FROM membership_entitlements
    WHERE tier = v_profile.membership_tier;
    
    UPDATE user_profiles
    SET scan_credits_remaining = v_entitlement.monthly_basic_scan_quota,
        deep_scan_credits_remaining = v_entitlement.monthly_deep_scan_quota,
        credits_reset_at = date_trunc('month', now()) + interval '1 month',
        updated_at = now()
    WHERE user_id = v_profile.user_id;
  END LOOP;
END;
$$;

-- =====================================================
-- Check Membership Entitlement RPC
-- =====================================================

CREATE OR REPLACE FUNCTION check_membership_entitlement(
  p_user_id uuid,
  p_feature_check text,
  p_scan_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_entitlement membership_entitlements%ROWTYPE;
  v_has_access boolean := false;
  v_reason text;
  v_emit_result jsonb;
BEGIN
  -- Load profile
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'user_profile_not_found'
    );
  END IF;
  
  -- Check if tier expired
  IF v_profile.tier_expires_at IS NOT NULL 
     AND v_profile.tier_expires_at < now() THEN
    -- Downgrade to FREE tier
    UPDATE user_profiles
    SET membership_tier = 'FREE',
        previous_tier = membership_tier,
        tier_granted_at = now(),
        tier_expires_at = NULL,
        scan_credits_remaining = 5,
        deep_scan_credits_remaining = 0,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    v_profile.membership_tier := 'FREE';
  END IF;
  
  -- Load entitlements
  SELECT * INTO v_entitlement
  FROM membership_entitlements
  WHERE tier = v_profile.membership_tier;
  
  -- Check specific feature
  CASE p_feature_check
    WHEN 'basic_scan' THEN
      IF v_profile.scan_credits_remaining > 0 THEN
        v_has_access := true;
      ELSE
        v_has_access := false;
        v_reason := 'scan_credits_depleted';
      END IF;
      
    WHEN 'deep_scan' THEN
      IF v_profile.deep_scan_credits_remaining > 0 THEN
        v_has_access := true;
      ELSE
        v_has_access := false;
        v_reason := 'deep_scan_credits_depleted';
      END IF;
      
    WHEN 'export_data' THEN
      v_has_access := v_entitlement.can_export_data;
      v_reason := CASE WHEN NOT v_has_access THEN 'tier_insufficient_for_export' ELSE NULL END;
      
    WHEN 'api_access' THEN
      v_has_access := v_entitlement.can_use_api;
      v_reason := CASE WHEN NOT v_has_access THEN 'tier_insufficient_for_api' ELSE NULL END;
      
    WHEN 'transfer_organizer' THEN
      v_has_access := v_entitlement.can_transfer_organizer;
      v_reason := CASE WHEN NOT v_has_access THEN 'tier_insufficient_for_transfer' ELSE NULL END;
      
    WHEN 'create_workspace' THEN
      v_has_access := v_entitlement.can_create_workspace;
      v_reason := CASE WHEN NOT v_has_access THEN 'tier_insufficient_for_workspace' ELSE NULL END;
      
    ELSE
      v_has_access := false;
      v_reason := 'unknown_feature_check';
  END CASE;
  
  -- Emit event if access denied
  IF NOT v_has_access THEN
    v_emit_result := emit_event(
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
        'scan_credits_remaining', v_profile.scan_credits_remaining,
        'deep_scan_credits_remaining', v_profile.deep_scan_credits_remaining
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_has_access,
    'reason', v_reason,
    'membership_tier', v_profile.membership_tier,
    'scan_credits_remaining', v_profile.scan_credits_remaining,
    'deep_scan_credits_remaining', v_profile.deep_scan_credits_remaining,
    'credits_reset_at', v_profile.credits_reset_at,
    'entitlements', row_to_json(v_entitlement)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_membership_entitlement(uuid, text, text) TO authenticated;

-- =====================================================
-- Consume Scan Credit RPC
-- =====================================================

CREATE OR REPLACE FUNCTION consume_scan_credit(
  p_user_id uuid,
  p_scan_type text,
  p_trip_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_emit_result jsonb;
BEGIN
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;
  
  -- Deduct credit based on scan type
  IF p_scan_type = 'basic' THEN
    IF v_profile.scan_credits_remaining <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_credits_remaining');
    END IF;
    
    UPDATE user_profiles
    SET scan_credits_remaining = scan_credits_remaining - 1,
        updated_at = now()
    WHERE user_id = p_user_id;
    
  ELSIF p_scan_type = 'deep' THEN
    IF v_profile.deep_scan_credits_remaining <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_deep_scan_credits_remaining');
    END IF;
    
    UPDATE user_profiles
    SET deep_scan_credits_remaining = deep_scan_credits_remaining - 1,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_scan_type');
  END IF;
  
  -- Emit warning if credits depleted
  IF (p_scan_type = 'basic' AND v_profile.scan_credits_remaining = 1)
     OR (p_scan_type = 'deep' AND v_profile.deep_scan_credits_remaining = 1) THEN
    v_emit_result := emit_event(
      p_event_type := 'scan_credits_depleted',
      p_feature_id := 'accounts',
      p_scope_type := 'user',
      p_scope_id := p_user_id,
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := CASE WHEN p_scan_type = 'basic' THEN 'basic_credits_depleted' ELSE 'deep_scan_credits_depleted' END,
      p_metadata := jsonb_build_object(
        'scan_type', p_scan_type,
        'trip_id', p_trip_id,
        'membership_tier', v_profile.membership_tier
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'scan_credits_remaining', CASE WHEN p_scan_type = 'basic' THEN v_profile.scan_credits_remaining - 1 ELSE v_profile.scan_credits_remaining END,
    'deep_scan_credits_remaining', CASE WHEN p_scan_type = 'deep' THEN v_profile.deep_scan_credits_remaining - 1 ELSE v_profile.deep_scan_credits_remaining END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION consume_scan_credit(uuid, text, uuid) TO authenticated;

-- =====================================================
-- Step-Up Verification RPC
-- =====================================================

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
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('required', false, 'error', 'profile_not_found');
  END IF;
  
  -- Check if step-up is required for this mutation class
  IF p_mutation_class IN ('EXPORT_GRANT', 'ORGANIZER_TRANSFER', 'TIER_UPGRADE', 'MFA_DISABLE') THEN
    v_requires_step_up := true;
  END IF;
  
  IF NOT v_requires_step_up THEN
    RETURN jsonb_build_object('required', false, 'reason', 'mutation_class_not_sensitive');
  END IF;
  
  -- Check if recently verified (within 15 minutes)
  IF v_profile.last_step_up_at IS NOT NULL 
     AND v_profile.last_step_up_at > (now() - interval '15 minutes') THEN
    RETURN jsonb_build_object(
      'required', false,
      'reason', 'recently_verified',
      'last_verified_at', v_profile.last_step_up_at,
      'expires_at', v_profile.last_step_up_at + interval '15 minutes'
    );
  END IF;
  
  -- Emit step-up requested event
  v_emit_result := emit_event(
    p_event_type := 'step_up_verification_requested',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := p_user_id,
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

GRANT EXECUTE ON FUNCTION request_step_up_verification(uuid, text, uuid) TO authenticated;

-- =====================================================
-- Complete Step-Up Verification RPC
-- =====================================================

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
  -- Update profile
  UPDATE user_profiles
  SET last_step_up_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Update session if provided
  IF p_session_id IS NOT NULL THEN
    UPDATE session_tokens
    SET step_up_verified_at = now()
    WHERE session_id = p_session_id
      AND user_id = p_user_id;
  END IF;
  
  -- Emit event
  v_emit_result := emit_event(
    p_event_type := 'step_up_verification_completed',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := p_user_id,
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

GRANT EXECUTE ON FUNCTION complete_step_up_verification(uuid, uuid) TO authenticated;

-- =====================================================
-- Update Membership Tier RPC
-- =====================================================

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
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;
  
  v_old_tier := v_profile.membership_tier;
  
  -- Validate new tier
  SELECT * INTO v_entitlement
  FROM membership_entitlements
  WHERE tier = p_new_tier;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tier');
  END IF;
  
  -- Update tier and reset credits
  UPDATE user_profiles
  SET membership_tier = p_new_tier,
      previous_tier = v_old_tier,
      tier_granted_at = now(),
      tier_expires_at = p_expires_at,
      scan_credits_remaining = v_entitlement.monthly_basic_scan_quota,
      deep_scan_credits_remaining = v_entitlement.monthly_deep_scan_quota,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Emit tier changed event
  v_emit_result := emit_event(
    p_event_type := 'tier_changed',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := COALESCE(p_actor_id, p_user_id),
    p_actor_type := CASE WHEN p_actor_id IS NULL THEN 'user' ELSE 'admin' END,
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

GRANT EXECUTE ON FUNCTION update_membership_tier(uuid, text, timestamptz, uuid) TO authenticated;

-- =====================================================
-- Record MFA Enrollment RPC
-- =====================================================

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
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;
  
  v_methods := v_profile.mfa_methods;
  
  IF p_action = 'enroll' THEN
    -- Add method if not already present
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
      p_actor_id := p_user_id,
      p_actor_type := 'user',
      p_reason_code := 'mfa_setup',
      p_metadata := jsonb_build_object(
        'mfa_method', p_mfa_method,
        'total_methods', array_length(v_methods, 1)
      )
    );
    
  ELSIF p_action = 'unenroll' THEN
    -- Remove method
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
      p_actor_id := p_user_id,
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

GRANT EXECUTE ON FUNCTION record_mfa_enrollment(uuid, text, text) TO authenticated;

-- =====================================================
-- Create Session Token RPC
-- =====================================================

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
  -- Create session
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
  
  -- Emit event
  v_emit_result := emit_event(
    p_event_type := 'session_created',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := p_user_id,
    p_actor_id := p_user_id,
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

GRANT EXECUTE ON FUNCTION create_session_token(uuid, text, text, text, text, inet) TO authenticated;

-- =====================================================
-- Revoke Session Token RPC
-- =====================================================

CREATE OR REPLACE FUNCTION revoke_session_token(
  p_session_id uuid,
  p_reason text DEFAULT 'user_initiated'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session session_tokens%ROWTYPE;
  v_emit_result jsonb;
BEGIN
  SELECT * INTO v_session
  FROM session_tokens
  WHERE session_id = p_session_id
    AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;
  
  UPDATE session_tokens
  SET is_active = false,
      revoked_at = now(),
      revoked_reason = p_reason
  WHERE session_id = p_session_id;
  
  -- Emit event
  v_emit_result := emit_event(
    p_event_type := 'session_revoked',
    p_feature_id := 'accounts',
    p_scope_type := 'user',
    p_scope_id := v_session.user_id,
    p_actor_id := v_session.user_id,
    p_actor_type := 'user',
    p_reason_code := p_reason,
    p_metadata := jsonb_build_object(
      'session_id', p_session_id,
      'device_type', v_session.device_type
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'revoked_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_session_token(uuid, text) TO authenticated;