/*
  # Governance Substrate v1 - HYBRID Upgrade

  ## Overview
  Implements Product Bible SECTION 3.0 Governance Substrate as a phased, backward-compatible upgrade.
  Existing RPCs continue to work via compatibility view + INSTEAD OF INSERT trigger.

  ## Changes
  1. Rename event_logs → event_ledger (base table)
  2. Add Governance Substrate columns (schema_version, feature_id, scope_type/id, reason_code, state deltas, checksums)
  3. Create registries (event_type_registry, reason_code_registry)
  4. Create operational mode table (region_operational_state)
  5. Create compatibility VIEW event_logs with INSTEAD OF INSERT trigger
  6. Create canonical RPC surfaces (emit_event, precheck_mutation_guard, release_battery_failures)

  ## Backward Compatibility
  - Existing INSERT INTO event_logs continues to work via trigger
  - Existing SELECT FROM event_logs works via view
  - No breaking changes to existing functions (updated incrementally in Phase 2)

  ## Security
  - Append-only enforcement via RLS (blocks UPDATE/DELETE on event_ledger)
  - event_type_registry validates event emissions
  - PROTECTIVE mode baseline enforces mutation policies
*/

-- =====================================================
-- STEP A: Rename Base Table
-- =====================================================

ALTER TABLE event_logs RENAME TO event_ledger;

-- =====================================================
-- STEP B: Add Governance Substrate Columns
-- =====================================================

-- Schema versioning
ALTER TABLE event_ledger
  ADD COLUMN IF NOT EXISTS schema_version int NOT NULL DEFAULT 1;

-- Feature identification
ALTER TABLE event_ledger
  ADD COLUMN IF NOT EXISTS feature_id text NOT NULL DEFAULT 'unknown';

-- Scope (replaces related_entity_type/id pattern)
ALTER TABLE event_ledger
  ADD COLUMN IF NOT EXISTS scope_type text NULL,
  ADD COLUMN IF NOT EXISTS scope_id uuid NULL;

-- Reason codes for mutations
ALTER TABLE event_ledger
  ADD COLUMN IF NOT EXISTS reason_code text NULL;

-- State deltas (before/after snapshots)
ALTER TABLE event_ledger
  ADD COLUMN IF NOT EXISTS previous_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resulting_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Idempotency
ALTER TABLE event_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key text NULL;

-- Checksums for integrity verification
ALTER TABLE event_ledger
  ADD COLUMN IF NOT EXISTS previous_checksum_hash text NULL,
  ADD COLUMN IF NOT EXISTS checksum_hash text NULL;

-- Indexes for Governance Substrate patterns
CREATE INDEX IF NOT EXISTS idx_event_ledger_event_type_created
  ON event_ledger(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_ledger_scope
  ON event_ledger(scope_type, scope_id, created_at DESC)
  WHERE scope_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_ledger_feature
  ON event_ledger(feature_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_ledger_idempotency
  ON event_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- =====================================================
-- STEP C: Create Registries
-- =====================================================

-- Event Type Registry
CREATE TABLE IF NOT EXISTS event_type_registry (
  event_type text PRIMARY KEY,
  schema_version int NOT NULL DEFAULT 1,
  feature_id text NOT NULL,
  required_envelope_keys text[] DEFAULT '{}',
  allowed_reason_codes text[] DEFAULT '{}',
  severity_class text CHECK (severity_class IN ('info', 'warning', 'error', 'critical')),
  deprecated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_type_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view event_type_registry"
  ON event_type_registry FOR SELECT
  TO authenticated
  USING (true);

-- Reason Code Registry
CREATE TABLE IF NOT EXISTS reason_code_registry (
  reason_code text PRIMARY KEY,
  description text NOT NULL,
  deprecated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reason_code_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reason_code_registry"
  ON reason_code_registry FOR SELECT
  TO authenticated
  USING (true);

-- Seed event_type_registry with existing + canonical types
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  -- Existing events
  ('schema_migration_applied', 1, 'system', 'info'),
  ('status_changed', 1, 'incidents', 'info'),
  ('connector_state_changed', 1, 'connectors', 'info'),
  ('connector_failure_logged', 1, 'connectors', 'warning'),
  ('auto_downgrade_to_degraded', 1, 'connectors', 'warning'),
  ('auto_downgrade_to_manual_only', 1, 'connectors', 'error'),
  ('manual_review_approved', 1, 'connectors', 'info'),
  ('connector_failure', 1, 'connectors', 'warning'),
  -- New canonical events
  ('trip_created', 1, 'trips', 'info'),
  ('incident_created', 1, 'incidents', 'info'),
  ('evidence_upload_accepted', 1, 'evidence', 'info'),
  ('evidence_upload_processing', 1, 'evidence', 'info'),
  ('evidence_upload_staged', 1, 'evidence', 'info'),
  ('evidence_upload_confirmed', 1, 'evidence', 'info'),
  ('protective_mode_entered', 1, 'system', 'critical'),
  ('ledger_write_failure', 1, 'system', 'critical')
ON CONFLICT (event_type) DO NOTHING;

-- =====================================================
-- STEP D: Operational Mode Table
-- =====================================================

CREATE TABLE IF NOT EXISTS region_operational_state (
  region_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('NORMAL', 'ELEVATED', 'PROTECTIVE', 'RECOVERY')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE region_operational_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view region_operational_state"
  ON region_operational_state FOR SELECT
  TO authenticated
  USING (true);

-- Insert default region in PROTECTIVE mode (fail-safe baseline)
INSERT INTO region_operational_state (region_id, mode, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'PROTECTIVE',
  '{"description": "Default region - baseline protective mode"}'::jsonb
)
ON CONFLICT (region_id) DO NOTHING;

-- =====================================================
-- STEP E: Compatibility Layer
-- =====================================================

-- Create view that exposes legacy schema
CREATE OR REPLACE VIEW event_logs AS
SELECT
  id,
  related_entity_type,
  related_entity_id,
  event_type,
  failure_code,
  event_data,
  actor_id,
  actor_type,
  metadata,
  created_at
FROM event_ledger;

-- INSTEAD OF INSERT trigger to route inserts to event_ledger
CREATE OR REPLACE FUNCTION event_logs_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into event_ledger, mapping legacy columns to new schema
  INSERT INTO event_ledger (
    id,
    related_entity_type,
    related_entity_id,
    event_type,
    failure_code,
    event_data,
    actor_id,
    actor_type,
    metadata,
    created_at,
    -- New Governance Substrate columns with safe defaults
    schema_version,
    feature_id,
    scope_type,
    scope_id,
    previous_state,
    resulting_state
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.related_entity_type,
    NEW.related_entity_id,
    NEW.event_type,
    NEW.failure_code,
    COALESCE(NEW.event_data, '{}'::jsonb),
    NEW.actor_id,
    NEW.actor_type,
    COALESCE(NEW.metadata, '{}'::jsonb),
    COALESCE(NEW.created_at, now()),
    -- Default Governance Substrate values
    1, -- schema_version
    COALESCE((SELECT feature_id FROM event_type_registry WHERE event_type = NEW.event_type), 'unknown'),
    COALESCE(NEW.related_entity_type::text, NULL), -- map to scope_type
    NEW.related_entity_id, -- map to scope_id
    '{}'::jsonb, -- previous_state (legacy inserts don't have this)
    '{}'::jsonb  -- resulting_state (legacy inserts don't have this)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER event_logs_instead_of_insert
  INSTEAD OF INSERT ON event_logs
  FOR EACH ROW
  EXECUTE FUNCTION event_logs_insert_trigger();

-- =====================================================
-- STEP F: Canonical RPC Surfaces
-- =====================================================

-- emit_event: Validates against event_type_registry and inserts into event_ledger
CREATE OR REPLACE FUNCTION emit_event(
  p_event_type text,
  p_feature_id text,
  p_scope_type text DEFAULT NULL,
  p_scope_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_actor_type text DEFAULT 'system',
  p_reason_code text DEFAULT NULL,
  p_previous_state jsonb DEFAULT '{}'::jsonb,
  p_resulting_state jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
  v_registered boolean;
BEGIN
  -- Validate event_type is registered
  SELECT EXISTS(
    SELECT 1 FROM event_type_registry
    WHERE event_type = p_event_type
    AND deprecated_at IS NULL
  ) INTO v_registered;

  IF NOT v_registered THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unregistered event_type: ' || p_event_type
    );
  END IF;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_event_id
    FROM event_ledger
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_event_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Insert event
  INSERT INTO event_ledger (
    event_type,
    feature_id,
    scope_type,
    scope_id,
    actor_id,
    actor_type,
    reason_code,
    previous_state,
    resulting_state,
    metadata,
    idempotency_key,
    schema_version,
    related_entity_type,
    related_entity_id,
    event_data
  ) VALUES (
    p_event_type,
    p_feature_id,
    p_scope_type,
    p_scope_id,
    p_actor_id,
    p_actor_type,
    p_reason_code,
    p_previous_state,
    p_resulting_state,
    p_metadata,
    p_idempotency_key,
    1,
    p_scope_type::entity_type,
    p_scope_id,
    '{}'::jsonb
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'idempotent', false
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to emit event: ' || SQLERRM
    );
END;
$$;

-- precheck_mutation_guard: PROTECTIVE baseline enforcement
CREATE OR REPLACE FUNCTION precheck_mutation_guard(
  p_region_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id text DEFAULT 'unknown',
  p_mutation_class text DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mode text;
  v_allowed boolean := false;
BEGIN
  -- Get region operational mode (default to PROTECTIVE if missing)
  SELECT mode INTO v_mode
  FROM region_operational_state
  WHERE region_id = p_region_id;

  IF v_mode IS NULL THEN
    v_mode := 'PROTECTIVE';
  END IF;

  -- PROTECTIVE mode baseline: allow read-only + critical write operations
  IF v_mode = 'PROTECTIVE' THEN
    v_allowed := p_mutation_class IN (
      'trip_create',
      'incident_create',
      'evidence_upload'
    );
  ELSIF v_mode = 'NORMAL' THEN
    v_allowed := true; -- All mutations allowed in NORMAL mode
  ELSIF v_mode = 'ELEVATED' THEN
    v_allowed := p_mutation_class NOT IN (
      'registry_edit',
      'threshold_override'
    );
  ELSIF v_mode = 'RECOVERY' THEN
    v_allowed := p_mutation_class IN (
      'evidence_upload',
      'incident_create'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'mode', v_mode,
    'mutation_class', p_mutation_class,
    'region_id', p_region_id
  );
END;
$$;

-- release_battery_failures: Diagnostic function for Phase 1 validation
CREATE OR REPLACE FUNCTION release_battery_failures()
RETURNS TABLE (
  failure_type text,
  severity text,
  entity_id uuid,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check 1: Unregistered event types in event_ledger
  RETURN QUERY
  SELECT
    'unregistered_event_type'::text as failure_type,
    'critical'::text as severity,
    el.id as entity_id,
    jsonb_build_object(
      'event_type', el.event_type,
      'created_at', el.created_at,
      'feature_id', el.feature_id
    ) as details
  FROM event_ledger el
  LEFT JOIN event_type_registry etr ON el.event_type = etr.event_type
  WHERE etr.event_type IS NULL;

  -- Check 2: Missing region operational state (warning-level)
  RETURN QUERY
  SELECT
    'missing_region_state'::text as failure_type,
    'warning'::text as severity,
    NULL::uuid as entity_id,
    jsonb_build_object(
      'message', 'No explicit region operational state configured',
      'default_behavior', 'Defaulting to PROTECTIVE mode'
    ) as details
  WHERE NOT EXISTS (SELECT 1 FROM region_operational_state WHERE region_id != '00000000-0000-0000-0000-000000000000'::uuid);

  -- Check 3: Events with missing checksums (info-level, expected in Phase 1)
  RETURN QUERY
  SELECT
    'missing_checksum'::text as failure_type,
    'info'::text as severity,
    el.id as entity_id,
    jsonb_build_object(
      'event_type', el.event_type,
      'created_at', el.created_at,
      'note', 'Phase 1 allows null checksums'
    ) as details
  FROM event_ledger el
  WHERE el.checksum_hash IS NULL
  LIMIT 5; -- Sample only

  RETURN;
END;
$$;

-- =====================================================
-- RLS: Enforce Append-Only on event_ledger
-- =====================================================

-- Block UPDATE/DELETE on event_ledger (append-only enforcement)
CREATE POLICY "Block all updates on event_ledger"
  ON event_ledger FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Block all deletes on event_ledger"
  ON event_ledger FOR DELETE
  TO authenticated
  USING (false);

-- Allow SELECT for authenticated users (read-only audit trail)
CREATE POLICY "Authenticated users can read event_ledger"
  ON event_ledger FOR SELECT
  TO authenticated
  USING (true);

-- Allow INSERT for authenticated users (append-only)
CREATE POLICY "Authenticated users can append to event_ledger"
  ON event_ledger FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- Migration Event
-- =====================================================

INSERT INTO event_ledger (
  event_type,
  feature_id,
  scope_type,
  scope_id,
  actor_type,
  actor_id,
  metadata,
  schema_version,
  related_entity_type,
  related_entity_id,
  event_data,
  previous_state,
  resulting_state
) VALUES (
  'schema_migration_applied',
  'system',
  'system',
  gen_random_uuid(),
  'system',
  NULL,
  jsonb_build_object(
    'migration', 'governance_substrate_v1',
    'changes', jsonb_build_array(
      'renamed event_logs to event_ledger',
      'added governance substrate columns',
      'created event_type_registry and reason_code_registry',
      'created region_operational_state table',
      'created compatibility view event_logs with INSTEAD OF INSERT trigger',
      'created emit_event, precheck_mutation_guard, release_battery_failures functions'
    )
  ),
  1,
  'system'::entity_type,
  gen_random_uuid(),
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
);