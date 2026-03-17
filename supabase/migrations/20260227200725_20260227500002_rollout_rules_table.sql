/*
  # Feature Rollout Rules Table (A.3)

  ## Summary
  Defines auto-rollback trigger rules per feature+region.
  Evaluator scans active rules, checks thresholds against health_state metrics,
  and triggers rollback actions when exceeded (respecting cooldown).

  ## New Table: feature_rollout_rules
  - id (PK uuid)
  - feature_id (FK → feature_registry)
  - region_id (uuid)
  - is_enabled (boolean) — can disable rule without deleting
  - rule_type (text ENUM) — ERROR_RATE | BATTERY_WARNING | SUPPRESSION_SPIKE | INBOX_SPIKE
  - threshold_value (numeric) — threshold for triggering (interpretation depends on rule_type)
  - window_minutes (int) — observation window for threshold evaluation
  - action (text ENUM) — ROLLBACK_TO_PERCENT | ROLLBACK_DISABLE
  - rollback_target_percentage (int nullable) — target % when action=ROLLBACK_TO_PERCENT
  - cooldown_minutes (int) — minimum time between rollback triggers for this rule
  - created_at, updated_at

  ## Rule Types
  - ERROR_RATE: threshold_value = max acceptable error rate (e.g., 0.05 = 5%)
  - BATTERY_WARNING: threshold_value = max acceptable battery warning count in window
  - SUPPRESSION_SPIKE: threshold_value = max suppression events count in window
  - INBOX_SPIKE: threshold_value = max open inbox items count

  ## Actions
  - ROLLBACK_TO_PERCENT: set rollout_percentage to rollback_target_percentage
  - ROLLBACK_DISABLE: set enabled=false and rollout_percentage=0

  ## Constraints
  - rule_type must be in allowed ENUMs
  - action must be in allowed ENUMs
  - rollback_target_percentage required when action=ROLLBACK_TO_PERCENT
  - cooldown_minutes >= 0

  ## Security
  - RLS enabled, SELECT for authenticated, no direct INSERT/UPDATE
  - Writes only via set_feature_rollout_rules RPC

  ## Indexes
  - feature_id + region_id + is_enabled for evaluator scans
*/

CREATE TABLE IF NOT EXISTS feature_rollout_rules (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id                  text NOT NULL REFERENCES feature_registry(feature_id) ON DELETE CASCADE,
  region_id                   uuid NOT NULL,
  is_enabled                  boolean NOT NULL DEFAULT true,
  rule_type                   text NOT NULL,
  threshold_value             numeric NOT NULL,
  window_minutes              int NOT NULL DEFAULT 60,
  action                      text NOT NULL,
  rollback_target_percentage  int,
  cooldown_minutes            int NOT NULL DEFAULT 30,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT feature_rollout_rules_type_valid CHECK (
    rule_type IN ('ERROR_RATE','BATTERY_WARNING','SUPPRESSION_SPIKE','INBOX_SPIKE')
  ),
  CONSTRAINT feature_rollout_rules_action_valid CHECK (
    action IN ('ROLLBACK_TO_PERCENT','ROLLBACK_DISABLE')
  ),
  CONSTRAINT feature_rollout_rules_threshold_positive CHECK (threshold_value >= 0),
  CONSTRAINT feature_rollout_rules_window_positive CHECK (window_minutes > 0),
  CONSTRAINT feature_rollout_rules_cooldown_nonnegative CHECK (cooldown_minutes >= 0),
  CONSTRAINT feature_rollout_rules_target_when_rollback CHECK (
    (action = 'ROLLBACK_TO_PERCENT' AND rollback_target_percentage IS NOT NULL)
    OR (action <> 'ROLLBACK_TO_PERCENT')
  ),
  CONSTRAINT feature_rollout_rules_target_range CHECK (
    rollback_target_percentage IS NULL
    OR (rollback_target_percentage >= 0 AND rollback_target_percentage <= 100)
  )
);

CREATE INDEX IF NOT EXISTS idx_feature_rollout_rules_feature_region_enabled
  ON feature_rollout_rules(feature_id, region_id, is_enabled)
  WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_feature_rollout_rules_type
  ON feature_rollout_rules(rule_type, is_enabled)
  WHERE is_enabled = true;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_feature_rollout_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_feature_rollout_rules_updated_at
  BEFORE UPDATE ON feature_rollout_rules
  FOR EACH ROW EXECUTE FUNCTION update_feature_rollout_rules_updated_at();

-- RLS
ALTER TABLE feature_rollout_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rollout rules"
  ON feature_rollout_rules FOR SELECT TO authenticated USING (true);

-- Register reason codes
INSERT INTO reason_code_registry (reason_code, description) VALUES
  ('rollback_error_rate_exceeded',      'Auto-rollback triggered: error rate exceeded threshold'),
  ('rollback_battery_warning_exceeded', 'Auto-rollback triggered: battery warnings exceeded threshold'),
  ('rollback_suppression_spike',        'Auto-rollback triggered: suppression event spike detected'),
  ('rollback_inbox_spike',              'Auto-rollback triggered: open inbox items spike detected'),
  ('rollback_manual',                   'Manual rollback requested by founder'),
  ('rollout_percentage_increased',      'Rollout percentage increased per rollout plan'),
  ('rollout_percentage_decreased',      'Rollout percentage decreased per rollout plan')
ON CONFLICT (reason_code) DO NOTHING;
