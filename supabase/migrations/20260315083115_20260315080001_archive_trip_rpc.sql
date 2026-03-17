/*
  # M-28 — archive_trip RPC

  ## Summary
  Creates the `archive_trip` RPC which orchestrates the full archival flow
  for a trip: soft-deletes the trip record, resolves the applicable retention
  policy by jurisdiction, and emits an erasure event to the
  `erasure_redaction_log` for compliance tracking.

  This RPC is the authoritative path for all trip archival actions. Direct
  updates to `archived_at` on the trips table are not permitted via RLS.

  ## New RPC

  ### archive_trip(p_trip_id uuid, p_reason text, p_jurisdiction text)
  - Validates the calling user owns the trip (auth.uid() = created_by)
  - Looks up the best-match retention policy for (target_table='trips', jurisdiction=p_jurisdiction)
    with fallback to DEFAULT_TRIPS if no jurisdiction-specific policy exists
  - Sets trips.archived_at = now(), trips.archived_by = auth.uid()
  - Sets trips.maturity_state = 'ARCHIVED'
  - Inserts a row into erasure_redaction_log
  - Returns: retention_policy_id, policy_name, retention_days,
    eligible_for_hard_delete_at, jurisdiction

  ## Security
  - SECURITY DEFINER with explicit search_path
  - EXECUTE granted to authenticated only
  - Revoked from public/anonymous
*/

CREATE OR REPLACE FUNCTION archive_trip(
  p_trip_id      uuid,
  p_reason       text    DEFAULT 'user_requested',
  p_jurisdiction text    DEFAULT 'DEFAULT'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip          trips%ROWTYPE;
  v_policy        retention_policies%ROWTYPE;
  v_erasure_id    uuid;
  v_expiry        timestamptz;
BEGIN
  -- 1. Fetch and validate ownership
  SELECT * INTO v_trip
  FROM trips
  WHERE trip_id = p_trip_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found: %', p_trip_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_trip.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: caller does not own this trip'
      USING ERRCODE = '42501';
  END IF;

  IF v_trip.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Trip is already archived'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Resolve retention policy: prefer jurisdiction-specific, fall back to DEFAULT
  SELECT * INTO v_policy
  FROM retention_policies
  WHERE target_table = 'trips'
    AND jurisdiction = p_jurisdiction
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_policy
    FROM retention_policies
    WHERE policy_name = 'DEFAULT_TRIPS'
    LIMIT 1;
  END IF;

  v_expiry := now() + (v_policy.retention_days || ' days')::interval;

  -- 3. Soft-delete the trip
  UPDATE trips
  SET
    archived_at    = now(),
    archived_by    = auth.uid(),
    maturity_state = 'ARCHIVED',
    updated_at     = now()
  WHERE trip_id = p_trip_id;

  -- 4. Emit erasure log entry
  INSERT INTO erasure_redaction_log (
    event_type,
    account_id,
    actor_id,
    actor_kind,
    target_table,
    target_row_id,
    legal_basis,
    jurisdiction,
    retention_policy_id,
    request_reference,
    redaction_method,
    metadata
  ) VALUES (
    'ERASURE_USER_REQUESTED',
    auth.uid(),
    auth.uid(),
    'user',
    'trips',
    p_trip_id::text,
    v_policy.legal_basis,
    p_jurisdiction,
    v_policy.id,
    p_reason,
    'deletion',
    jsonb_build_object(
      'trip_id',        p_trip_id,
      'reason',         p_reason,
      'jurisdiction',   p_jurisdiction,
      'policy_name',    v_policy.policy_name,
      'retention_days', v_policy.retention_days,
      'eligible_at',    v_expiry
    )
  )
  RETURNING id INTO v_erasure_id;

  -- 5. Return resolution details for the UI
  RETURN jsonb_build_object(
    'success',                    true,
    'trip_id',                    p_trip_id,
    'archived_at',                now(),
    'retention_policy_id',        v_policy.id,
    'policy_name',                v_policy.policy_name,
    'jurisdiction',               p_jurisdiction,
    'retention_days',             v_policy.retention_days,
    'legal_basis',                v_policy.legal_basis,
    'legal_citation',             v_policy.legal_citation,
    'auto_delete',                v_policy.auto_delete,
    'eligible_for_hard_delete_at', v_expiry,
    'erasure_log_id',             v_erasure_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION archive_trip(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION archive_trip(uuid, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION archive_trip(uuid, text, text) TO authenticated;
