/*
  # Feature Flag System (Section 12.4)

  ## Summary
  Minimal phase-gating infrastructure. Supports per-feature activation with
  per-region granularity. Founder-only mutations via set_feature_activation_state().

  ## New Tables

  ### feature_registry
  - feature_id (PK): canonical feature identifier (e.g. 'F-6.5.3')
  - display_name: human-readable label
  - description: brief explanation
  - default_enabled: bool — what regions get if no activation row exists
  - minimum_mode: the minimum region operational mode required to activate
  - created_at

  ### feature_activation_state
  - feature_id FK → feature_registry
  - region_id: region this state applies to (default region = 00000000...)
  - enabled: true/false
  - activated_by: actor_id who last changed state
  - reason_code: why activation changed
  - metadata: jsonb blob (e.g. rollout %, expiry)
  - updated_at, created_at

  ## Security
  - RLS enabled on both tables
  - SELECT: authenticated allowed
  - INSERT/UPDATE: no direct-write policy — only via RPC (founder-only)
*/

CREATE TABLE IF NOT EXISTS feature_registry (
  feature_id    text PRIMARY KEY,
  display_name  text NOT NULL,
  description   text DEFAULT '',
  default_enabled boolean NOT NULL DEFAULT false,
  minimum_mode  text NOT NULL DEFAULT 'NORMAL',
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT feature_registry_feature_id_not_empty CHECK (length(trim(feature_id)) > 0),
  CONSTRAINT feature_registry_minimum_mode_valid CHECK (minimum_mode IN ('NORMAL','ELEVATED','PROTECTIVE','RECOVERY'))
);

CREATE TABLE IF NOT EXISTS feature_activation_state (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id   text NOT NULL REFERENCES feature_registry(feature_id) ON DELETE CASCADE,
  region_id    uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  enabled      boolean NOT NULL DEFAULT false,
  activated_by uuid,
  reason_code  text,
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT feature_activation_state_unique_feature_region UNIQUE (feature_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_activation_feature
  ON feature_activation_state(feature_id, region_id);

ALTER TABLE feature_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_activation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature registry"
  ON feature_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read feature activation state"
  ON feature_activation_state FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION update_feature_activation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_feature_activation_updated_at
  BEFORE UPDATE ON feature_activation_state
  FOR EACH ROW EXECUTE FUNCTION update_feature_activation_updated_at();

INSERT INTO feature_registry (feature_id, display_name, description, default_enabled, minimum_mode) VALUES
  ('F-6.5.3', 'Credit Card Benefits Guide',         'Benefit clause ingestion and evaluation',              false, 'NORMAL'),
  ('F-6.5.5', 'Claim Routing & Sequencing',         'Routing recommendation and acceptance checkpoint',     false, 'NORMAL'),
  ('F-6.5.6', 'Evidence & Documentation Management','Evidence attach, validate, and lifecycle management',  true,  'NORMAL'),
  ('F-6.5.7', 'Incident Timeline Read Model',       'Timeline view derived from event ledger',              true,  'NORMAL'),
  ('F-6.5.16','FOCL Founder Offline Posture',       'Founder-offline governance continuity layer',          true,  'NORMAL')
ON CONFLICT (feature_id) DO NOTHING;
