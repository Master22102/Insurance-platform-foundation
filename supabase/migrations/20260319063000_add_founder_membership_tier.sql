-- Separate founder authority from corporate client billing tier.
-- Corporate remains a customer tier; FOCL access is founder-only.

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_membership_tier_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_membership_tier_check
  CHECK (membership_tier IN ('FREE', 'CORPORATE', 'FOUNDER'));

ALTER TABLE public.membership_entitlements
  DROP CONSTRAINT IF EXISTS membership_entitlements_tier_check;

ALTER TABLE public.membership_entitlements
  ADD CONSTRAINT membership_entitlements_tier_check
  CHECK (tier IN ('FREE', 'CORPORATE', 'FOUNDER'));

INSERT INTO public.membership_entitlements (
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
)
SELECT
  'FOUNDER',
  monthly_basic_scan_quota,
  monthly_deep_scan_quota,
  max_trips_per_account,
  can_export_data,
  can_use_api,
  can_transfer_organizer,
  can_create_workspace,
  support_priority,
  COALESCE(features, '{}'::jsonb) || '{"focl_access": true, "authority_model": "founder"}'::jsonb
FROM public.membership_entitlements
WHERE tier = 'CORPORATE'
ON CONFLICT (tier) DO UPDATE
SET
  monthly_basic_scan_quota = EXCLUDED.monthly_basic_scan_quota,
  monthly_deep_scan_quota = EXCLUDED.monthly_deep_scan_quota,
  max_trips_per_account = EXCLUDED.max_trips_per_account,
  can_export_data = EXCLUDED.can_export_data,
  can_use_api = EXCLUDED.can_use_api,
  can_transfer_organizer = EXCLUDED.can_transfer_organizer,
  can_create_workspace = EXCLUDED.can_create_workspace,
  support_priority = EXCLUDED.support_priority,
  features = EXCLUDED.features;
