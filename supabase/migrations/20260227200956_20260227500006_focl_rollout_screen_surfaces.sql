/*
  # FOCL Rollout Screen Surfaces (E)

  ## Summary
  Registry entries for FOCL rollout console surfaces.
  These surfaces provide founder-facing UX for managing feature rollouts,
  viewing health metrics, and configuring auto-rollback rules.

  ## New Screen Surfaces
  - FOCL_FEATURE_CONSOLE: List all features with activation + rollout status
  - FOCL_FEATURE_ROLLOUT_CONTROL: Set rollout %, enable/disable feature
  - FOCL_FEATURE_ROLLOUT_HEALTH: View health metrics + recent rollbacks
  - FOCL_FEATURE_ROLLOUT_RULES: Edit auto-rollback rules

  ## RPC Contract Notes
  Each surface documents which RPCs it calls and what data deps it requires.
  This serves as a contract for future UI implementation.

  ## No UI Build
  This migration only creates registry entries. No front-end code is written.
  The surface_id and route_path serve as placeholders for future UI wiring.
*/

INSERT INTO screen_surface_registry (
  surface_id,
  feature_id,
  surface_label,
  route_path,
  required_data_deps,
  confidence_required
) VALUES
  (
    'FOCL_FEATURE_CONSOLE',
    'F-6.5.16',
    'Feature Console',
    '/focl/features',
    ARRAY['feature_registry', 'feature_activation_state', 'feature_rollout_health_state'],
    'any'
  ),
  (
    'FOCL_FEATURE_ROLLOUT_CONTROL',
    'F-6.5.16',
    'Rollout Control',
    '/focl/features/:id/rollout',
    ARRAY['feature_registry', 'feature_activation_state'],
    'any'
  ),
  (
    'FOCL_FEATURE_ROLLOUT_HEALTH',
    'F-6.5.16',
    'Rollout Health Metrics',
    '/focl/features/:id/health',
    ARRAY['feature_rollout_health_state', 'event_ledger', 'action_inbox_items'],
    'any'
  ),
  (
    'FOCL_FEATURE_ROLLOUT_RULES',
    'F-6.5.16',
    'Auto-Rollback Rules',
    '/focl/features/:id/rules',
    ARRAY['feature_rollout_rules', 'feature_rollout_health_state'],
    'any'
  )
ON CONFLICT (surface_id) DO NOTHING;
