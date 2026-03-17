/*
  # Bypass Closure Step 3: Enable RLS on interpretive_trace_records

  ## Summary
  interpretive_trace_records previously had no RLS. Any authenticated user could
  INSERT directly, bypassing emit_itr() and the full guard→ITR→emit_event chain.

  This migration:
  - Enables RLS on interpretive_trace_records
  - Grants SELECT to authenticated users (read is safe)
  - Denies INSERT, UPDATE, DELETE from authenticated role (no direct-write policy)
  - Only emit_itr() (SECURITY DEFINER, runs as postgres) can write to this table

  ## Policies Added
  - "Authenticated users can read interpretive traces" (SELECT)

  ## No INSERT/UPDATE/DELETE policies = block all direct writes from authenticated
*/

ALTER TABLE interpretive_trace_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read interpretive traces"
  ON interpretive_trace_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
