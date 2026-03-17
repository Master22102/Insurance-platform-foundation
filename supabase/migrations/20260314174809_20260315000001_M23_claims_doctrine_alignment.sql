/*
  # M23 — Claims Doctrine Alignment

  ## Summary
  Aligns the claims table, coverage graph schema, and event type registry with the
  Wayfarer Claims Doctrine. No production claim data exists so constraint replacement
  is safe.

  ## Step 1 — claim_status Enum Replacement
  Drops the old CHECK constraint (DRAFT, READY, SUBMITTED, ACKNOWLEDGED, DENIED, PAID,
  DISPUTED) and replaces it with doctrine values:
    initiated | evidence_gathering | routing_determined | packet_ready |
    submitted_by_traveler | outcome_recorded | abandoned
  Default updated to 'initiated'.

  ## Step 2 — New Claim Fields
  Adds the following columns to claims (all nullable, ADD COLUMN IF NOT EXISTS):
    - sequence_position (integer)
    - routing_rec_id (uuid, no FK — routing_recommendations may not always be present)
    - primary_provider (text)
    - estimated_amount (numeric 12,2)
    - currency_code (char 3)
    - packet_id (uuid) — no FK since claim_packets table does not yet exist
    - outcome (text, CHECK IN approved|denied|partial|pending|unknown)
    - outcome_amount (numeric 12,2)
    - outcome_recorded_at (timestamptz)
    - denial_reason_text (text)
    - filing_deadline (timestamptz) — surfaces the claim filing window close time

  ## Step 3 — clause_family_taxonomy: FAM-16 Statutory Passenger Rights
  Creates the table if it does not exist, then upserts 6 EU statutory right clause types.

  ## Step 4 — coverage_nodes source_type
  Adds source_type column to coverage_nodes if not present, then creates or replaces
  the CHECK constraint to include 'statutory_right'.

  ## Step 5 — New Event Types
  Registers 12 new event types for claim lifecycle and disruption tracking.

  ## Step 6 — TypeScript types are updated separately in lib/types/database.ts.

  ## Security
  No changes to RLS policies or SECURITY DEFINER functions.
  All INSERTs use ON CONFLICT DO NOTHING / DO UPDATE for idempotency.
*/


-- =============================================================================
-- STEP 1 — Replace claim_status CHECK constraint with doctrine values
-- =============================================================================

ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_claim_status_check;

ALTER TABLE claims
  ADD CONSTRAINT claims_claim_status_check
  CHECK (claim_status IN (
    'initiated',
    'evidence_gathering',
    'routing_determined',
    'packet_ready',
    'submitted_by_traveler',
    'outcome_recorded',
    'abandoned'
  ));

ALTER TABLE claims ALTER COLUMN claim_status SET DEFAULT 'initiated';


-- =============================================================================
-- STEP 2 — Add missing doctrine fields to claims
-- =============================================================================

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS sequence_position      integer,
  ADD COLUMN IF NOT EXISTS routing_rec_id         uuid,
  ADD COLUMN IF NOT EXISTS primary_provider       text,
  ADD COLUMN IF NOT EXISTS estimated_amount       numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency_code          char(3),
  ADD COLUMN IF NOT EXISTS packet_id              uuid,
  ADD COLUMN IF NOT EXISTS outcome                text,
  ADD COLUMN IF NOT EXISTS outcome_amount         numeric(12,2),
  ADD COLUMN IF NOT EXISTS outcome_recorded_at    timestamptz,
  ADD COLUMN IF NOT EXISTS denial_reason_text     text,
  ADD COLUMN IF NOT EXISTS filing_deadline        timestamptz;

ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_outcome_check;
ALTER TABLE claims
  ADD CONSTRAINT claims_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('approved','denied','partial','pending','unknown'));


-- =============================================================================
-- STEP 3 — Create clause_family_taxonomy if not exists, then upsert FAM-16
-- =============================================================================

CREATE TABLE IF NOT EXISTS clause_family_taxonomy (
  clause_type  text PRIMARY KEY,
  family_code  text NOT NULL,
  family_name  text NOT NULL,
  description  text
);

ALTER TABLE clause_family_taxonomy ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clause_family_taxonomy' AND policyname = 'Authenticated users can read clause family taxonomy'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Authenticated users can read clause family taxonomy"
        ON clause_family_taxonomy FOR SELECT
        TO authenticated
        USING (true)
    $pol$;
  END IF;
END $$;

INSERT INTO clause_family_taxonomy (clause_type, family_code, family_name, description)
VALUES
  ('eu_delay_compensation_threshold',  'FAM-16', 'Statutory Passenger Rights', 'EU Regulation 261/2004: delay duration thresholds that trigger compensation entitlement.'),
  ('eu_denied_boarding_compensation',  'FAM-16', 'Statutory Passenger Rights', 'EU Regulation 261/2004: fixed compensation for involuntary denied boarding.'),
  ('eu_care_obligation',               'FAM-16', 'Statutory Passenger Rights', 'EU Regulation 261/2004: duty of care obligations (meals, refreshments, accommodation) during disruptions.'),
  ('eu_rerouting_obligation',          'FAM-16', 'Statutory Passenger Rights', 'EU Regulation 261/2004: carrier obligation to offer rerouting to final destination.'),
  ('eu_refund_deadline',               'FAM-16', 'Statutory Passenger Rights', 'EU Regulation 261/2004: mandatory refund timeline when traveler chooses not to travel.'),
  ('eu_cancellation_compensation',     'FAM-16', 'Statutory Passenger Rights', 'EU Regulation 261/2004: compensation rights for flights cancelled with insufficient notice.')
ON CONFLICT (clause_type) DO UPDATE SET
  family_code = 'FAM-16',
  family_name = 'Statutory Passenger Rights';


-- =============================================================================
-- STEP 4 — Add source_type to coverage_nodes with statutory_right support
-- =============================================================================

ALTER TABLE coverage_nodes
  ADD COLUMN IF NOT EXISTS source_type text;

ALTER TABLE coverage_nodes DROP CONSTRAINT IF EXISTS coverage_nodes_source_type_check;

ALTER TABLE coverage_nodes
  ADD CONSTRAINT coverage_nodes_source_type_check
  CHECK (source_type IS NULL OR source_type IN (
    'policy_clause',
    'cc_benefit',
    'statutory_right',
    'manual'
  ));


-- =============================================================================
-- STEP 5 — Register new event types
-- =============================================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('claim_filing_deadline_approaching', 1, 'F-6.5.5',  'warning'),
  ('claim_filing_window_expired',       1, 'F-6.5.5',  'warning'),
  ('disruption_suspected',              1, 'F-6.5.4',  'info'),
  ('disruption_confirmed',              1, 'F-6.5.4',  'info'),
  ('offer_received',                    1, 'F-6.5.5',  'info'),
  ('offer_evaluated',                   1, 'F-6.5.5',  'info'),
  ('offer_accepted',                    1, 'F-6.5.5',  'info'),
  ('own_resolution_active',             1, 'F-6.5.5',  'info'),
  ('evidence_complete',                 1, 'F-6.5.6',  'info'),
  ('routing_determined',                1, 'F-6.5.5',  'info'),
  ('rights_window_active',              1, 'F-6.5.2',  'info'),
  ('resolution_complete',               1, 'F-6.5.5',  'info')
ON CONFLICT (event_type) DO NOTHING;


-- =============================================================================
-- VERIFICATION QUERIES (run manually post-deploy)
-- =============================================================================

-- 1. Confirm new claim_status constraint is in place
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'claims'::regclass AND conname = 'claims_claim_status_check';

-- 2. Confirm new columns exist on claims
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'claims' ORDER BY ordinal_position;

-- 3. Confirm clause_family_taxonomy has FAM-16 rows
-- SELECT * FROM clause_family_taxonomy WHERE family_code = 'FAM-16' ORDER BY clause_type;

-- 4. Confirm coverage_nodes source_type constraint
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'coverage_nodes'::regclass AND conname = 'coverage_nodes_source_type_check';

-- 5. Confirm new event types
-- SELECT event_type, feature_id, severity_class FROM event_type_registry WHERE event_type IN ('claim_filing_deadline_approaching','disruption_suspected','resolution_complete') ORDER BY event_type;
