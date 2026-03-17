/*
  # M-08: Policy Parsing Schema (F-6.5.1 ACTIVATION)
  
  1. New Tables
    - policy_documents: raw artifact receipt and pipeline tracking
    - policy_clauses: extracted clause objects with confidence scoring
    - clause_review_queue: FOCL human review surface
    - clause_taxonomy_registry: clause type definitions
  
  2. ENUMs
    - policy_document_status, extraction_status, review_action
  
  3. Hallucination Guard
    - source_citation field is required on all clauses
  
  4. Security
    - RLS with user-scoped access for documents/clauses
    - Review queue restricted to support/founder roles
    - Taxonomy is public read
  
  5. Event Types
    - Register 12 F-6.5.1 event types for pipeline tracking
*/

-- ENUMs
DO $$ BEGIN
  CREATE TYPE policy_document_status AS ENUM (
    'uploaded','queued','processing','partial','complete','failed','superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE extraction_status AS ENUM (
    'PENDING_REVIEW','AUTO_ACCEPTED','CORRECTED','REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_action AS ENUM ('ACCEPTED','CORRECTED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- policy_documents: raw artifact receipt and pipeline tracking
CREATE TABLE IF NOT EXISTS policy_documents (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES policies(policy_id),
  account_id uuid NOT NULL REFERENCES auth.users(id),
  trip_id uuid REFERENCES trips(trip_id),
  document_status policy_document_status NOT NULL DEFAULT 'uploaded',
  source_type text NOT NULL CHECK (source_type IN ('pdf_upload','email_forward','manual_entry')),
  raw_artifact_path text,
  file_size_bytes bigint,
  mime_type text,
  content_hash text,
  malware_scan_status text,
  malware_scanned_at timestamptz,
  ocr_engine_version text,
  extraction_started_at timestamptz,
  extraction_completed_at timestamptz,
  extraction_error_message text,
  pipeline_version text,
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- policy_clauses: extracted clause objects
CREATE TABLE IF NOT EXISTS policy_clauses (
  clause_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_document_id uuid NOT NULL REFERENCES policy_documents(document_id),
  policy_version_id uuid REFERENCES policy_versions(version_id),
  clause_type text NOT NULL,
  family_code text,
  canonical_text text NOT NULL,
  source_citation text NOT NULL,
  page_number integer,
  section_path text,
  confidence_label text NOT NULL,
  extraction_status extraction_status NOT NULL DEFAULT 'PENDING_REVIEW',
  extracted_by_model text,
  cross_references uuid[],
  unresolved_references jsonb,
  reviewer_id uuid,
  reviewer_action review_action,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- clause_review_queue: FOCL review surface
CREATE TABLE IF NOT EXISTS clause_review_queue (
  queue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_id uuid NOT NULL REFERENCES policy_clauses(clause_id),
  policy_document_id uuid NOT NULL REFERENCES policy_documents(document_id),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_review','resolved','escalated')),
  priority integer NOT NULL DEFAULT 5,
  sla_deadline timestamptz,
  assigned_to uuid,
  resolved_at timestamptz,
  resolution_action review_action,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- clause_taxonomy_registry: clause type definitions
CREATE TABLE IF NOT EXISTS clause_taxonomy_registry (
  clause_type text PRIMARY KEY,
  family_code text NOT NULL,
  family_name text NOT NULL,
  description text NOT NULL,
  downstream_features text[],
  active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now()
);

-- Seed taxonomy
INSERT INTO clause_taxonomy_registry (clause_type, family_code, family_name, description) VALUES
  ('coverage_trigger',   'FAM-01', 'Triggers',   'Conditions under which coverage activates'),
  ('exclusion',          'FAM-02', 'Exclusions',  'Conditions under which coverage does not apply'),
  ('condition',          'FAM-03', 'Conditions',  'Pre-conditions required for benefit to apply'),
  ('definition',         'FAM-04', 'Definitions', 'Defined terms used throughout the policy'),
  ('benefit_limit',      'FAM-05', 'Limits',      'Maximum benefit amounts per category'),
  ('deductible',         'FAM-06', 'Deductibles', 'Amounts paid by insured before coverage'),
  ('waiting_period',     'FAM-07', 'Timing',      'Time-based conditions on coverage'),
  ('cancellation_rule',  'FAM-08', 'Cancellation','Trip cancellation and interruption rules'),
  ('medical',            'FAM-09', 'Medical',     'Medical expense and emergency coverage'),
  ('baggage',            'FAM-10', 'Baggage',     'Lost, delayed, or damaged baggage coverage'),
  ('flight_delay',       'FAM-11', 'Delay',       'Flight and travel delay coverage'),
  ('emergency_evac',     'FAM-12', 'Evacuation',  'Emergency evacuation and repatriation'),
  ('secondary_payer',    'FAM-13', 'Coordination','Secondary payer and coordination of benefits'),
  ('notice_requirement', 'FAM-14', 'Notice',      'Claim notification timing requirements'),
  ('arbitration',        'FAM-15', 'Dispute',     'Dispute resolution and arbitration clauses')
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clauses_version_type
  ON policy_clauses(policy_version_id, clause_type, extraction_status);
CREATE INDEX IF NOT EXISTS idx_clauses_auto_accepted
  ON policy_clauses(policy_version_id, clause_type)
  WHERE extraction_status = 'AUTO_ACCEPTED';
CREATE INDEX IF NOT EXISTS idx_clauses_pending
  ON policy_clauses(policy_document_id, created_at)
  WHERE extraction_status = 'PENDING_REVIEW';
CREATE INDEX IF NOT EXISTS idx_review_queue_open
  ON clause_review_queue(priority, sla_deadline)
  WHERE status = 'open';

-- RLS
ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_taxonomy_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY pd_select ON policy_documents FOR SELECT
  USING (account_id = auth.uid());

CREATE POLICY pc_select ON policy_clauses FOR SELECT
  USING (policy_document_id IN (
    SELECT document_id FROM policy_documents WHERE account_id = auth.uid()));

CREATE POLICY crq_select ON clause_review_queue FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('support','founder'));

CREATE POLICY ctr_select ON clause_taxonomy_registry FOR SELECT USING (true);

-- Register F-6.5.1 event types
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('policy_parse_queued',              1, 'F-6.5.1', 'info'),
  ('policy_parse_started',             1, 'F-6.5.1', 'info'),
  ('policy_parse_complete',            1, 'F-6.5.1', 'info'),
  ('policy_parse_failed',              1, 'F-6.5.1', 'error'),
  ('policy_parse_partial',             1, 'F-6.5.1', 'warning'),
  ('clause_review_required',           1, 'F-6.5.1', 'warning'),
  ('clause_review_sla_breach',         1, 'F-6.5.1', 'error'),
  ('policy_version_created',           1, 'F-6.5.1', 'info'),
  ('policy_coverage_narrowed',         1, 'F-6.5.1', 'warning'),
  ('extraction_hallucination_blocked', 1, 'F-6.5.1', 'error'),
  ('model_version_logged',             1, 'F-6.5.1', 'info'),
  ('policy_parse_suppressed',          1, 'F-6.5.1', 'warning')
ON CONFLICT (event_type) DO NOTHING;