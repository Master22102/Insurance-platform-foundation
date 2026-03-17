/*
  # M-27 — Retention Policies Table

  ## Summary
  Creates the `retention_policies` table to define named data retention rules
  by target entity, jurisdiction, and legal basis. This table fulfills the
  foreign key placeholder (`retention_policy_id`) already present in
  `erasure_redaction_log` (M-26).

  Retention policies define how long a category of data must be kept before
  it is eligible for hard deletion. Policies are jurisdiction-aware, supporting
  GDPR, CCPA, HIPAA-adjacent, and default (no jurisdiction) rules.

  ## New Tables

  ### retention_policies
  Each row is a named retention rule for a specific (target_table, jurisdiction)
  combination.

  | Column | Type | Description |
  |---|---|---|
  | id | uuid PK | Unique policy identifier |
  | policy_name | text UNIQUE NOT NULL | Human-readable name for this policy |
  | target_table | text NOT NULL | The table this policy applies to (e.g. 'trips') |
  | jurisdiction | text | ISO 3166-1 alpha-2 code or tag ('EU', 'US-CA', 'HIPAA', 'DEFAULT') |
  | retention_days | integer NOT NULL | Minimum days data must be retained after archival |
  | legal_basis | text | Legal basis code, e.g. 'right_to_erasure', 'ccpa_deletion_right', 'hipaa_minimum' |
  | legal_citation | text | Human-readable citation, e.g. 'GDPR Article 17' |
  | auto_delete | boolean | If true, data may be auto-purged after retention_days. If false, requires operator review. |
  | notes | text | Internal notes on this policy |
  | created_at | timestamptz | Immutable creation timestamp |
  | updated_at | timestamptz | Last update timestamp |

  ## Security
  - RLS enabled
  - SELECT: authenticated users may read all policies (public reference data)
  - INSERT / UPDATE / DELETE: service role only (no user-facing mutation policies)

  ## Seeded Policies (5 rows)
  1. DEFAULT — trips — 365 days, no auto-delete, general baseline
  2. EU_GDPR — trips — 90 days, auto-delete eligible, GDPR Article 17
  3. US_CCPA — trips — 45 days, auto-delete eligible, CCPA 1798.105
  4. HIPAA_ADJACENT — trips — 2190 days (6 years), no auto-delete, operator review required
  5. DEFAULT — policies — 365 days, no auto-delete, general baseline for uploaded policy documents

  ## Notes
  - The `erasure_redaction_log.retention_policy_id` FK now has a valid target
  - HIPAA-adjacent policies intentionally set auto_delete = false per the
    "missing enterprise controls" note in the security control summary
    (operator review workflow required before hard deletion)
*/

CREATE TABLE IF NOT EXISTS retention_policies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name     text        UNIQUE NOT NULL,
  target_table    text        NOT NULL,
  jurisdiction    text        NOT NULL DEFAULT 'DEFAULT',
  retention_days  integer     NOT NULL CHECK (retention_days > 0),
  legal_basis     text,
  legal_citation  text,
  auto_delete     boolean     NOT NULL DEFAULT false,
  notes           text        NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read retention policies"
  ON retention_policies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_rp_target_table
  ON retention_policies (target_table);

CREATE INDEX IF NOT EXISTS idx_rp_jurisdiction
  ON retention_policies (jurisdiction);

-- Add FK from erasure_redaction_log now that the target table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'erasure_redaction_log_retention_policy_id_fkey'
  ) THEN
    ALTER TABLE erasure_redaction_log
      ADD CONSTRAINT erasure_redaction_log_retention_policy_id_fkey
      FOREIGN KEY (retention_policy_id) REFERENCES retention_policies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Seed default retention policies
INSERT INTO retention_policies (policy_name, target_table, jurisdiction, retention_days, legal_basis, legal_citation, auto_delete, notes)
VALUES
  (
    'DEFAULT_TRIPS',
    'trips',
    'DEFAULT',
    365,
    'legitimate_interest',
    'General data retention baseline — no specific statutory obligation',
    false,
    'Default retention window for trip data when no jurisdiction-specific rule applies. Requires operator review before hard deletion.'
  ),
  (
    'EU_GDPR_TRIPS',
    'trips',
    'EU',
    90,
    'right_to_erasure',
    'GDPR Article 17 — Right to erasure (''right to be forgotten'')',
    true,
    'Applies to users resident in EU/EEA jurisdictions. Data eligible for automated hard deletion after 90 days from archival.'
  ),
  (
    'US_CCPA_TRIPS',
    'trips',
    'US-CA',
    45,
    'ccpa_deletion_right',
    'CCPA § 1798.105 — Right to delete personal information',
    true,
    'Applies to California residents under the California Consumer Privacy Act. 45-day retention window post-archival.'
  ),
  (
    'HIPAA_ADJACENT_TRIPS',
    'trips',
    'HIPAA',
    2190,
    'hipaa_minimum_retention',
    'HIPAA 45 CFR § 164.530(j) — 6-year minimum retention for covered documentation',
    false,
    'For trip data associated with medical travel or health-related claims. Hard deletion requires operator review. auto_delete is intentionally false.'
  ),
  (
    'DEFAULT_POLICIES',
    'policies',
    'DEFAULT',
    365,
    'legitimate_interest',
    'General data retention baseline for uploaded policy documents',
    false,
    'Default retention window for uploaded insurance and travel policy documents. Operator review required before hard deletion.'
  )
ON CONFLICT (policy_name) DO NOTHING;
