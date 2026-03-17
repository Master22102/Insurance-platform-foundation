/*
  # Bypass Closure Step 1: Revoke emit_event() from authenticated role

  ## Summary
  Removes direct callable access to emit_event() from the authenticated role.
  emit_event() remains callable only by SECURITY DEFINER RPCs internally (postgres role).
  This closes bypass H3: forged event injection by any authenticated client session.

  ## Changes
  - REVOKE EXECUTE on emit_event() (all signatures) from authenticated
  - REVOKE EXECUTE on emit_event() from anon (defense in depth)
*/

REVOKE EXECUTE ON FUNCTION emit_event(
  text, text, text, uuid, uuid, text, text, jsonb, jsonb, jsonb, text
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION emit_event(
  text, text, text, uuid, uuid, text, text, jsonb, jsonb, jsonb, text
) FROM anon;
