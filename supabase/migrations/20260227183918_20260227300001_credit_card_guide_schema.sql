/*
  # Credit Card Benefits Guide Schema (F-6.5.3)

  ## Summary
  Stores ingested benefit guide versions, extracted benefit clauses,
  traveler consent tokens, and evaluation run results.

  ## New Tables

  ### credit_card_guide_versions
  - Immutable versioned snapshots of a benefit guide document.
  - Fields: guide_id (PK), card_program_id, version_number, title,
    source_url, raw_content, content_hash, ingested_by, ingested_at,
    is_active, metadata

  ### benefit_clauses
  - Individual extracted clauses from a guide version.
  - Fields: clause_id, guide_id FK, clause_key (unique within guide),
    benefit_category, clause_text, coverage_limit, coverage_currency,
    conditions, exclusions, requires_consent, metadata, created_at

  ### consent_tokens
  - Traveler consent grants and revocations for a specific guide version.
  - Fields: token_id (PK), incident_id FK, guide_id FK, granted_by (actor),
    granted_at, revoked_at, revocation_reason, metadata

  ### benefit_eval_runs
  - Immutable record of a benefit evaluation run against an incident + guide.
  - Fields: eval_id (PK), incident_id FK, guide_id FK, triggered_by,
    confidence_label (9.2 enum), overall_result (eligible/ineligible/uncertain),
    clauses_matched jsonb, reason_codes text[], founder_readable_explanation,
    itr_trace_id (FK interpretive_trace_records), run_at, metadata

  ## Security
  - RLS enabled on all tables
  - SELECT: authenticated
  - No direct INSERT/UPDATE policies — writes via SECURITY DEFINER RPCs only
*/

CREATE TABLE IF NOT EXISTS credit_card_guide_versions (
  guide_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_program_id  text NOT NULL,
  version_number   integer NOT NULL DEFAULT 1,
  title            text NOT NULL,
  source_url       text,
  raw_content      text NOT NULL DEFAULT '',
  content_hash     text NOT NULL,
  ingested_by      uuid,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  is_active        boolean NOT NULL DEFAULT true,
  metadata         jsonb NOT NULL DEFAULT '{}',

  CONSTRAINT guide_version_card_program_unique UNIQUE (card_program_id, version_number),
  CONSTRAINT guide_version_hash_not_empty CHECK (length(trim(content_hash)) > 0)
);

CREATE TABLE IF NOT EXISTS benefit_clauses (
  clause_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id         uuid NOT NULL REFERENCES credit_card_guide_versions(guide_id) ON DELETE CASCADE,
  clause_key       text NOT NULL,
  benefit_category text NOT NULL DEFAULT 'general',
  clause_text      text NOT NULL,
  coverage_limit   numeric,
  coverage_currency text DEFAULT 'USD',
  conditions       jsonb NOT NULL DEFAULT '[]',
  exclusions       jsonb NOT NULL DEFAULT '[]',
  requires_consent boolean NOT NULL DEFAULT false,
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT benefit_clause_unique_key_per_guide UNIQUE (guide_id, clause_key),
  CONSTRAINT benefit_clause_text_not_empty CHECK (length(trim(clause_text)) > 0)
);

CREATE TABLE IF NOT EXISTS consent_tokens (
  token_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  guide_id          uuid NOT NULL REFERENCES credit_card_guide_versions(guide_id) ON DELETE CASCADE,
  granted_by        uuid,
  granted_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz,
  revocation_reason text,
  metadata          jsonb NOT NULL DEFAULT '{}',

  CONSTRAINT consent_token_unique_per_incident_guide UNIQUE (incident_id, guide_id),
  CONSTRAINT consent_token_revoke_after_grant CHECK (revoked_at IS NULL OR revoked_at > granted_at)
);

CREATE TYPE confidence_label AS ENUM (
  'high',
  'medium',
  'low',
  'insufficient_data',
  'conflicted'
);

CREATE TABLE IF NOT EXISTS benefit_eval_runs (
  eval_id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id                 uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  guide_id                    uuid NOT NULL REFERENCES credit_card_guide_versions(guide_id) ON DELETE CASCADE,
  triggered_by                uuid,
  confidence_label            confidence_label NOT NULL DEFAULT 'insufficient_data',
  overall_result              text NOT NULL DEFAULT 'uncertain',
  clauses_matched             jsonb NOT NULL DEFAULT '[]',
  reason_codes                text[] NOT NULL DEFAULT '{}',
  founder_readable_explanation text NOT NULL DEFAULT '',
  itr_trace_id                uuid REFERENCES interpretive_trace_records(trace_id),
  run_at                      timestamptz NOT NULL DEFAULT now(),
  metadata                    jsonb NOT NULL DEFAULT '{}',

  CONSTRAINT benefit_eval_result_valid CHECK (overall_result IN ('eligible','ineligible','uncertain'))
);

CREATE INDEX IF NOT EXISTS idx_benefit_clauses_guide ON benefit_clauses(guide_id, benefit_category);
CREATE INDEX IF NOT EXISTS idx_consent_tokens_incident ON consent_tokens(incident_id);
CREATE INDEX IF NOT EXISTS idx_consent_tokens_active ON consent_tokens(incident_id, guide_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_benefit_eval_runs_incident ON benefit_eval_runs(incident_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_guide_versions_active ON credit_card_guide_versions(card_program_id, is_active) WHERE is_active = true;

ALTER TABLE credit_card_guide_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_eval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read guide versions"
  ON credit_card_guide_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read benefit clauses"
  ON benefit_clauses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read consent tokens"
  ON consent_tokens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read eval runs"
  ON benefit_eval_runs FOR SELECT TO authenticated USING (true);

INSERT INTO event_type_registry (event_type, schema_version, feature_id) VALUES
  ('guide_version_ingested',      1, 'F-6.5.3'),
  ('consent_granted',             1, 'F-6.5.3'),
  ('consent_revoked',             1, 'F-6.5.3'),
  ('benefit_eval_completed',      1, 'F-6.5.3'),
  ('benefit_eval_eligible',       1, 'F-6.5.3'),
  ('benefit_eval_ineligible',     1, 'F-6.5.3'),
  ('benefit_eval_uncertain',      1, 'F-6.5.3')
ON CONFLICT (event_type) DO NOTHING;
