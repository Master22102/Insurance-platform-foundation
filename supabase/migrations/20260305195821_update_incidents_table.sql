/*
  # M-04: Update incidents table
  
  1. Changes
    - Replace incident_status ENUM with canonical_status text field
    - Add CCO and causality model fields
    - Migrate existing status values from old ENUM
  
  2. New Fields
    - canonical_status: OPEN | EVIDENCE_GATHERING | REVIEW_PENDING | CLAIM_ROUTING_READY | SUBMITTED | CLOSED | DISPUTED
    - causality_status: CONFIRMED | PROBABLE | DISPUTED | UNKNOWN
    - disruption_type, cco_id, dual_branch_active
    - documentation_completeness_state, resolution_status
  
  3. Event Types
    - Register new incident event types for canonical status machine
*/

-- Add new canonical status as text column
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS canonical_status text NOT NULL DEFAULT 'OPEN'
    CHECK (canonical_status IN (
      'OPEN','EVIDENCE_GATHERING','REVIEW_PENDING',
      'CLAIM_ROUTING_READY','SUBMITTED','CLOSED','DISPUTED'
    ));

-- Migrate existing status values if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='status') THEN
    UPDATE incidents SET canonical_status = CASE
      WHEN status::text = 'Capture' THEN 'OPEN'
      WHEN status::text = 'Review'  THEN 'REVIEW_PENDING'
      WHEN status::text = 'Action'  THEN 'CLAIM_ROUTING_READY'
      ELSE 'OPEN'
    END
    WHERE canonical_status = 'OPEN';  -- Only update rows still at default
  END IF;
END $$;

-- Add CCO and Causality Model fields
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS cco_id uuid,
  ADD COLUMN IF NOT EXISTS disruption_type text,
  ADD COLUMN IF NOT EXISTS resolution_status text,
  ADD COLUMN IF NOT EXISTS dual_branch_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disruption_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS disruption_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS documentation_completeness_state text,
  ADD COLUMN IF NOT EXISTS causality_status text
    CHECK (causality_status IN ('CONFIRMED','PROBABLE','DISPUTED','UNKNOWN'));

-- Register new incident event types
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('incident_status_canonical_changed', 1, 'incidents', 'info'),
  ('causality_status_set', 1, 'incidents', 'info'),
  ('dual_branch_activated', 1, 'incidents', 'warning')
ON CONFLICT (event_type) DO NOTHING;