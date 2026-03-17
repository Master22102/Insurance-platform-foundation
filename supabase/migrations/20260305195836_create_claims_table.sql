/*
  # M-05: Create claims table (MVP CORE)
  
  1. New Table
    - claims: insurance claim objects linked to incidents and policies
    - Tracks claim lifecycle from DRAFT → SUBMITTED → PAID/DENIED
  
  2. Security
    - RLS enabled with user-scoped access
  
  3. Event Types
    - claim_created, claim_status_changed, claim_submitted
*/

CREATE TABLE IF NOT EXISTS claims (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id),
  trip_id uuid NOT NULL REFERENCES trips(trip_id),
  account_id uuid NOT NULL REFERENCES auth.users(id),
  claim_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (claim_status IN ('DRAFT','READY','SUBMITTED','ACKNOWLEDGED','DENIED','PAID','DISPUTED')),
  claim_type text,
  policy_version_id uuid REFERENCES policy_versions(version_id),
  submitted_at timestamptz,
  carrier_reference text,
  itr_trace_id uuid REFERENCES interpretive_trace_records(trace_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY claims_select ON claims FOR SELECT USING (account_id = auth.uid());
CREATE POLICY claims_insert ON claims FOR INSERT WITH CHECK (account_id = auth.uid());

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('claim_created', 1, 'claims', 'info'),
  ('claim_status_changed', 1, 'claims', 'info'),
  ('claim_submitted', 1, 'claims', 'info')
ON CONFLICT (event_type) DO NOTHING;