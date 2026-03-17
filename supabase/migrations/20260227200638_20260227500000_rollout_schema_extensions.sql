/*
  # Rollout Schema Extensions (A.1)

  ## Summary
  Extends feature_activation_state with rollout control fields:
  - rollout_percentage: 0-100 granular rollout gate
  - rollout_strategy: deterministic hash algorithm selector
  - rollout_scope_type: what entity to hash (INCIDENT/USER/TRIP/PROJECT)
  - canary_only: restrict to canary regions only
  - enabled_at: timestamp when feature was enabled (audit trail)

  ## Changes
  - ADD COLUMN rollout_percentage int DEFAULT 0 CHECK (0..100)
  - ADD COLUMN rollout_strategy text DEFAULT 'DETERMINISTIC_HASH'
  - ADD COLUMN rollout_scope_type text DEFAULT 'INCIDENT'
  - ADD COLUMN canary_only boolean DEFAULT false
  - ADD COLUMN enabled_at timestamptz NULL

  ## Constraints
  - rollout_percentage must be 0-100
  - rollout_strategy currently only supports 'DETERMINISTIC_HASH'
  - rollout_scope_type must be in (INCIDENT, USER, TRIP, PROJECT)

  ## Notes
  - updated_at already exists (trigger maintains it)
  - Default rollout_percentage=0 means no gradual rollout (only enabled=true matters)
  - enabled_at gets set by set_feature_activation_state when enabled changes from false→true
*/

-- Add rollout control columns
ALTER TABLE feature_activation_state
  ADD COLUMN IF NOT EXISTS rollout_percentage int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rollout_strategy text NOT NULL DEFAULT 'DETERMINISTIC_HASH',
  ADD COLUMN IF NOT EXISTS rollout_scope_type text NOT NULL DEFAULT 'INCIDENT',
  ADD COLUMN IF NOT EXISTS canary_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enabled_at timestamptz;

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feature_activation_rollout_percentage_range'
  ) THEN
    ALTER TABLE feature_activation_state
      ADD CONSTRAINT feature_activation_rollout_percentage_range
      CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feature_activation_rollout_strategy_valid'
  ) THEN
    ALTER TABLE feature_activation_state
      ADD CONSTRAINT feature_activation_rollout_strategy_valid
      CHECK (rollout_strategy IN ('DETERMINISTIC_HASH'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feature_activation_rollout_scope_type_valid'
  ) THEN
    ALTER TABLE feature_activation_state
      ADD CONSTRAINT feature_activation_rollout_scope_type_valid
      CHECK (rollout_scope_type IN ('INCIDENT','USER','TRIP','PROJECT'));
  END IF;
END $$;

-- Create index for rollout queries
CREATE INDEX IF NOT EXISTS idx_feature_activation_rollout
  ON feature_activation_state(feature_id, region_id, enabled, rollout_percentage)
  WHERE enabled = true;
