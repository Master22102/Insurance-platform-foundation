/*
  # M-26 — Erasure & Redaction Log

  ## Summary
  Creates the `erasure_redaction_log` table to record all data erasure and
  redaction events across the platform. This table is append-only and provides
  an auditable, tamper-resistant trail of every personal data removal, redaction,
  or anonymization action taken — whether triggered by a user request, a legal
  obligation, an automated retention policy, or an operator action.

  ## New Tables

  ### erasure_redaction_log
  Append-only audit log. Each row records one erasure or redaction event.

  | Column | Type | Description |
  |---|---|---|
  | id | uuid PK | Unique event identifier |
  | event_type | text NOT NULL | Classification drawn from event_type_registry |
  | account_id | uuid | The account whose data was affected (nullable for system events) |
  | actor_id | uuid | The user or service principal that triggered the action (nullable) |
  | actor_kind | text | 'user', 'operator', 'system', or 'legal_process' |
  | target_table | text NOT NULL | The table where data was erased/redacted |
  | target_row_id | text NOT NULL | Primary key of the affected row (stored as text for flexibility) |
  | target_columns | text[] | Specific columns that were redacted (null = full row deletion) |
  | legal_basis | text | GDPR/CCPA basis code, e.g. 'right_to_erasure', 'retention_expiry' |
  | jurisdiction | text | ISO 3166-1 alpha-2 country code or jurisdiction tag |
  | retention_policy_id | uuid | FK to a retention_policies table if one exists |
  | request_reference | text | External ticket/request ID for audit linkage |
  | redaction_method | text | 'deletion', 'nullification', 'pseudonymization', 'truncation' |
  | before_hash | text | SHA-256 of before-state (for integrity verification, no PII stored) |
  | after_hash | text | SHA-256 of after-state (for integrity verification, no PII stored) |
  | metadata | jsonb | Freeform supplementary context |
  | created_at | timestamptz | Immutable timestamp set at insert |

  ## Security
  - RLS enabled
  - SELECT: only the owning account can read their own erasure events
  - INSERT: authenticated users may insert their own events; system inserts go via service role
  - No UPDATE policy (append-only)
  - No DELETE policy (append-only)

  ## Indexes
  - account_id (for per-user lookups)
  - event_type (for analytics / compliance queries)
  - target_table + target_row_id (for row-level provenance lookups)
  - created_at (for time-range queries)

  ## Event Type Registry Inserts
  Nine erasure/redaction event types are registered in event_type_registry.
  severity_class values: 'info', 'warning', 'error', 'critical'
*/


-- =============================================================================
-- Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS erasure_redaction_log (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type           text        NOT NULL,
  account_id           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id             uuid,
  actor_kind           text        NOT NULL DEFAULT 'system'
                                   CHECK (actor_kind IN ('user', 'operator', 'system', 'legal_process')),
  target_table         text        NOT NULL,
  target_row_id        text        NOT NULL,
  target_columns       text[],
  legal_basis          text,
  jurisdiction         text,
  retention_policy_id  uuid,
  request_reference    text,
  redaction_method     text        NOT NULL DEFAULT 'deletion'
                                   CHECK (redaction_method IN ('deletion', 'nullification', 'pseudonymization', 'truncation')),
  before_hash          text,
  after_hash           text,
  metadata             jsonb       NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE erasure_redaction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounts can view their own erasure events"
  ON erasure_redaction_log
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

CREATE POLICY "Authenticated users can insert their own erasure events"
  ON erasure_redaction_log
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id = auth.uid());


-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_erl_account_id
  ON erasure_redaction_log (account_id);

CREATE INDEX IF NOT EXISTS idx_erl_event_type
  ON erasure_redaction_log (event_type);

CREATE INDEX IF NOT EXISTS idx_erl_target
  ON erasure_redaction_log (target_table, target_row_id);

CREATE INDEX IF NOT EXISTS idx_erl_created_at
  ON erasure_redaction_log (created_at DESC);


-- =============================================================================
-- Event type registry inserts
-- =============================================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class)
VALUES
  ('ERASURE_USER_REQUESTED',      1, 'erasure_redaction', 'info'),
  ('ERASURE_RETENTION_EXPIRY',    1, 'erasure_redaction', 'info'),
  ('ERASURE_LEGAL_PROCESS',       1, 'erasure_redaction', 'warning'),
  ('ERASURE_OPERATOR_INITIATED',  1, 'erasure_redaction', 'warning'),
  ('REDACTION_PII_DETECTED',      1, 'erasure_redaction', 'info'),
  ('REDACTION_MANUAL_REVIEW',     1, 'erasure_redaction', 'info'),
  ('PSEUDONYMIZATION_APPLIED',    1, 'erasure_redaction', 'info'),
  ('ERASURE_EVIDENCE_WITHDRAWN',  1, 'erasure_redaction', 'info'),
  ('ERASURE_SCAN_RESULT_PURGED',  1, 'erasure_redaction', 'info')
ON CONFLICT (event_type) DO NOTHING;
