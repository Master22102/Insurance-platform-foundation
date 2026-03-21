/*
  Registers Section 2 authority features in FOCL registry so founder can
  stage day-one vs later rollouts without code changes.
*/

INSERT INTO public.feature_registry (
  feature_id,
  display_name,
  description,
  default_enabled,
  minimum_mode,
  phase,
  capability_tier_current,
  capability_tier_max,
  has_pending_extension,
  connector_status
)
VALUES
  (
    'F-2.0.12-INVITES',
    'Relationship Verification Invites',
    'Group participant invite and relationship verification controls, including dual-consent for minors.',
    true,
    'NORMAL',
    'MVP',
    1,
    1,
    false,
    'not_required'
  ),
  (
    'F-2.0.6-EXPORT-AUTH',
    'Export Authorization Grants',
    'Subject or Trusted Ally controlled organizer export grants with revocation.',
    true,
    'NORMAL',
    'MVP',
    1,
    1,
    false,
    'not_required'
  ),
  (
    'F-2.0.8-SELF-DEFENSE',
    'Participant Self-Defense Revocation',
    'Immediate participant or trusted-ally revoke controls for organizer grants.',
    true,
    'NORMAL',
    'MVP',
    1,
    1,
    false,
    'not_required'
  )
ON CONFLICT (feature_id) DO NOTHING;
