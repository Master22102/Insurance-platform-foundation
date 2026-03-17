/*
  # M-09: Create scan_jobs and scan_credit_ledger
  
  1. New Tables
    - scan_jobs: AI scan job tracking for quick/deep coverage analysis
    - scan_credit_ledger: append-only credit usage ledger
  
  2. Immutability
    - scan_credit_ledger is append-only (trigger enforced)
  
  3. Security
    - RLS enabled with user-scoped access
*/

CREATE TABLE IF NOT EXISTS scan_jobs (
  scan_job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(trip_id),
  account_id uuid NOT NULL REFERENCES auth.users(id),
  scan_type text NOT NULL CHECK (scan_type IN ('quick','deep')),
  scan_axis text,
  job_status text NOT NULL DEFAULT 'queued'
    CHECK (job_status IN ('queued','running','complete','failed','suppressed')),
  confidence_label text,
  result_json jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scan_credit_ledger (
  ledger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES auth.users(id),
  scan_job_id uuid REFERENCES scan_jobs(scan_job_id),
  credit_type text NOT NULL,
  credit_delta integer NOT NULL,
  balance_after integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- scan_credit_ledger is append-only
CREATE OR REPLACE FUNCTION scan_credit_ledger_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'scan_credit_ledger is append-only'; END; $$;

CREATE TRIGGER trg_scl_immutable
  BEFORE UPDATE OR DELETE ON scan_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION scan_credit_ledger_immutable();

ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY sj_select ON scan_jobs FOR SELECT USING (account_id = auth.uid());
CREATE POLICY scl_select ON scan_credit_ledger FOR SELECT USING (account_id = auth.uid());