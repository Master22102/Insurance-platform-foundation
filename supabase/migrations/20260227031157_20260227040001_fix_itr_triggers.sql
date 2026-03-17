/*
  # Fix ITR Triggers

  ## Problem
  block_itr_update() and block_itr_delete() try to log to audit_trace_violations,
  which may not exist. Changed to unconditional RAISE without dependency.

  ## Solution
  Simplify triggers to only RAISE EXCEPTION (no audit table dependency).
*/

CREATE OR REPLACE FUNCTION block_itr_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'interpretive_trace_records is immutable: UPDATE blocked on trace_id %', OLD.trace_id;
END;
$$;

CREATE OR REPLACE FUNCTION block_itr_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'interpretive_trace_records is immutable: DELETE blocked on trace_id %', OLD.trace_id;
END;
$$;