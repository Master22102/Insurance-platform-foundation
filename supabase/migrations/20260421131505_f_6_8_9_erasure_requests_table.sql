/*
  # F-6.8.9 Data Erasure & Right-to-Erasure Protocol — erasure_requests table

  Case-record backbone for Section 8.9 sitting above the existing
  `erasure_redaction_log` (M26) per-artifact redaction record.

  1. New Tables
    - `erasure_requests`
      - id uuid PK; erasure_record_id uuid UNIQUE
      - requestor_user_id, requestor_email, requestor_identity_method (CHECK)
      - scope_descriptor jsonb
      - status (9-value CHECK)
      - received_at, acknowledged_at, verified_at
      - sla_deadline_at (default received_at + 30 days)
      - extension_reason, extension_deadline_at
      - completed_at, confirmation_document_path, notes, created_by

  2. Security
    - RLS enabled. Requestor SELECT own rows. Authenticated INSERT bound to own uid.
    - No UPDATE/DELETE policies; mutations via SECURITY DEFINER RPCs only.

  3. Event types
    - 10 pii_erasure_* event types seeded under F-6.8.9.

  4. Feature registry
    - F-6.8.9 seeded (minimum_mode NORMAL, phase MVP, severity warning per registry check).
*/

INSERT INTO feature_registry (
  feature_id, display_name, description, default_enabled, minimum_mode,
  phase, capability_tier_current, capability_tier_max,
  has_pending_extension, parent_feature_id,
  requires_connector, connector_status
) VALUES (
  'F-6.8.9',
  'Data Erasure & Right-to-Erasure Protocol',
  'GDPR Article 17 / CCPA erasure protocol. Case-record table plus ledger redaction reconciliation. 9-step execution sequence with hold-exception handling.',
  true, 'NORMAL',
  'MVP', 1, 2,
  true, NULL,
  false, 'not_required'
) ON CONFLICT (feature_id) DO NOTHING;

INSERT INTO event_type_registry (event_type, schema_version, feature_id, required_envelope_keys, allowed_reason_codes, severity_class)
VALUES
  ('pii_erasure_request_received',        1, 'F-6.8.9', ARRAY['erasure_record_id','requestor_identity_method'], NULL, 'info'),
  ('pii_erasure_request_acknowledged',    1, 'F-6.8.9', ARRAY['erasure_record_id'], NULL, 'info'),
  ('pii_erasure_identity_verified',       1, 'F-6.8.9', ARRAY['erasure_record_id','verification_method'], NULL, 'info'),
  ('pii_erasure_scope_determined',        1, 'F-6.8.9', ARRAY['erasure_record_id','scope_descriptor'], NULL, 'info'),
  ('pii_erasure_execution_started',       1, 'F-6.8.9', ARRAY['erasure_record_id'], NULL, 'info'),
  ('pii_erasure_step_completed',          1, 'F-6.8.9', ARRAY['erasure_record_id','step_name'], NULL, 'info'),
  ('pii_erasure_hold_exception_applied',  1, 'F-6.8.9', ARRAY['erasure_record_id','hold_basis'], NULL, 'warning'),
  ('pii_erasure_request_extended',        1, 'F-6.8.9', ARRAY['erasure_record_id','extension_reason','extension_deadline_at'], NULL, 'warning'),
  ('pii_erasure_request_completed',       1, 'F-6.8.9', ARRAY['erasure_record_id','confirmation_document_path'], NULL, 'info'),
  ('pii_erasure_request_rejected',        1, 'F-6.8.9', ARRAY['erasure_record_id','rejection_reason'], NULL, 'warning')
ON CONFLICT (event_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS erasure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erasure_record_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  requestor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requestor_email text,
  requestor_identity_method text NOT NULL
    CHECK (requestor_identity_method IN ('session','email_otp','guardian_document','other')),
  scope_descriptor jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN (
      'received','verified','in_progress','completed',
      'partially_completed_hold_exception','rejected','extended',
      'deferred_legal_hold','deferred_dispute_hold'
    )),
  received_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  verified_at timestamptz,
  sla_deadline_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  extension_reason text,
  extension_deadline_at timestamptz,
  completed_at timestamptz,
  confirmation_document_path text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT erasure_requests_requestor_present
    CHECK (requestor_user_id IS NOT NULL OR requestor_email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS erasure_requests_requestor_user_id_idx
  ON erasure_requests(requestor_user_id);
CREATE INDEX IF NOT EXISTS erasure_requests_status_idx
  ON erasure_requests(status);
CREATE INDEX IF NOT EXISTS erasure_requests_sla_deadline_at_idx
  ON erasure_requests(sla_deadline_at);

ALTER TABLE erasure_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requestors can view own erasure requests"
  ON erasure_requests FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = requestor_user_id);

CREATE POLICY "Authenticated users can open own erasure request"
  ON erasure_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = requestor_user_id
    AND status = 'received'
  );
