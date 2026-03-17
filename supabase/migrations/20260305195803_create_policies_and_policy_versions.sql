/*
  # M-03: Create policies and policy_versions (BLOCKING for F-6.5.1)
  
  1. New Tables
    - policies: top-level policy artifacts with lifecycle management
    - policy_versions: immutable version records with content hash and confidence tier
  
  2. Immutability
    - policy_versions table is immutable after creation (trigger enforced)
  
  3. Security
    - RLS enabled on both tables
    - Users can only access their own policies
*/

-- policies: top-level policy artifact
CREATE TABLE IF NOT EXISTS policies (
  policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES auth.users(id),
  trip_id uuid REFERENCES trips(trip_id),
  policy_label text NOT NULL,
  active_version_id uuid,
  provider_name text,
  lifecycle_state text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN ('active','superseded','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  archived_at timestamptz,
  CONSTRAINT policy_label_not_empty CHECK (length(trim(policy_label)) > 0)
);

-- policy_versions: immutable after creation
CREATE TABLE IF NOT EXISTS policy_versions (
  version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES policies(policy_id) ON DELETE RESTRICT,
  version_number integer NOT NULL,
  effective_date date,
  expiration_date date,
  governing_jurisdiction uuid[] NOT NULL DEFAULT '{}',
  coverage_limits_json jsonb NOT NULL DEFAULT '{}',
  deductible_json jsonb,
  exclusions_json jsonb NOT NULL DEFAULT '[]',
  content_hash text NOT NULL,
  normalization_pipeline_version text NOT NULL DEFAULT 'v1.0',
  confidence_tier text NOT NULL DEFAULT 'INSUFFICIENT_DATA'
    CHECK (confidence_tier IN (
      'HIGH','CONDITIONAL','AMBIGUOUS',
      'DOCUMENTATION_INCOMPLETE','CONFLICT_PRESENT','INSUFFICIENT_DATA'
    )),
  source_type text NOT NULL
    CHECK (source_type IN ('pdf_upload','email_forward','manual_entry')),
  raw_artifact_path text,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  ingested_by uuid NOT NULL REFERENCES auth.users(id),
  itr_trace_id uuid REFERENCES interpretive_trace_records(trace_id),
  CONSTRAINT policy_version_unique UNIQUE (policy_id, version_number)
);

-- Immutability trigger on policy_versions
CREATE OR REPLACE FUNCTION policy_versions_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'policy_versions is immutable after creation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_policy_versions_immutable
  BEFORE UPDATE ON policy_versions
  FOR EACH ROW EXECUTE FUNCTION policy_versions_immutable();

-- Back-reference FK
ALTER TABLE policies
  ADD CONSTRAINT fk_active_version
  FOREIGN KEY (active_version_id) REFERENCES policy_versions(version_id);

-- RLS
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_select ON policies FOR SELECT USING (account_id = auth.uid());
CREATE POLICY pol_insert ON policies FOR INSERT WITH CHECK (account_id = auth.uid());

CREATE POLICY polv_select ON policy_versions FOR SELECT
  USING (policy_id IN (SELECT policy_id FROM policies WHERE account_id = auth.uid()));
CREATE POLICY polv_insert ON policy_versions FOR INSERT
  WITH CHECK (policy_id IN (SELECT policy_id FROM policies WHERE account_id = auth.uid()));