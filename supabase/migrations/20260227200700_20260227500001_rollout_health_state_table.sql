/*
  # Feature Rollout Health State Table (A.2)

  ## Summary
  Tracks observed health metrics per feature+region over rolling time windows.
  Used by auto-rollback evaluator to decide when to trigger rollback actions.

  ## New Table: feature_rollout_health_state
  - id (PK uuid)
  - feature_id (FK → feature_registry)
  - region_id (uuid)
  - window_minutes (int) — observation window size
  - last_evaluated_at (timestamptz) — when evaluator last ran
  - metrics (jsonb) — observed metrics snapshot:
      { suppression_rate, error_rate, battery_warning_count, inbox_open_count, ... }
  - health_status (text ENUM) — HEALTHY | DEGRADED | UNHEALTHY
  - last_rollback_at (timestamptz nullable) — timestamp of most recent auto-rollback
  - created_at, updated_at

  ## Constraints
  - UNIQUE(feature_id, region_id, window_minutes) — one health state row per config
  - health_status must be in (HEALTHY, DEGRADED, UNHEALTHY)

  ## Security
  - RLS enabled, SELECT for authenticated, no direct INSERT/UPDATE
  - Writes only via SECURITY DEFINER RPCs

  ## Indexes
  - feature_id + region_id + last_evaluated_at for evaluator scans
  - health_status for dashboard queries
*/

CREATE TABLE IF NOT EXISTS feature_rollout_health_state (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id          text NOT NULL REFERENCES feature_registry(feature_id) ON DELETE CASCADE,
  region_id           uuid NOT NULL,
  window_minutes      int NOT NULL DEFAULT 60,
  last_evaluated_at   timestamptz NOT NULL DEFAULT now(),
  metrics             jsonb NOT NULL DEFAULT '{}',
  health_status       text NOT NULL DEFAULT 'HEALTHY',
  last_rollback_at    timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT feature_rollout_health_unique UNIQUE (feature_id, region_id, window_minutes),
  CONSTRAINT feature_rollout_health_status_valid CHECK (health_status IN ('HEALTHY','DEGRADED','UNHEALTHY')),
  CONSTRAINT feature_rollout_health_window_positive CHECK (window_minutes > 0)
);

CREATE INDEX IF NOT EXISTS idx_feature_rollout_health_feature_region
  ON feature_rollout_health_state(feature_id, region_id, last_evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_rollout_health_status
  ON feature_rollout_health_state(health_status, last_evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_rollout_health_rollback
  ON feature_rollout_health_state(last_rollback_at DESC NULLS LAST)
  WHERE last_rollback_at IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_feature_rollout_health_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_feature_rollout_health_updated_at
  BEFORE UPDATE ON feature_rollout_health_state
  FOR EACH ROW EXECUTE FUNCTION update_feature_rollout_health_updated_at();

-- RLS
ALTER TABLE feature_rollout_health_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rollout health state"
  ON feature_rollout_health_state FOR SELECT TO authenticated USING (true);
