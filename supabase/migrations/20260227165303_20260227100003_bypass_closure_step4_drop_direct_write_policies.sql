/*
  # Bypass Closure Step 4: Remove direct-write RLS policies on domain tables

  ## Summary
  Drops all authenticated INSERT and UPDATE RLS policies on incidents, evidence,
  connectors, and projects. After this migration, no authenticated session can
  write to these tables directly via supabase.from().insert() or .update().
  All writes must go through SECURITY DEFINER RPCs (the only callers with
  the postgres role that bypasses RLS).

  This is Approach A: "writes only via SECURITY DEFINER RPCs."
  It is the safest approach because accidental future .from().insert() calls
  will fail with RLS permission denied at the database level, not silently succeed.

  ## Policies Dropped

  ### incidents
  - "Authenticated users can create incidents"  (INSERT)
  - "Authenticated users can update incidents"  (UPDATE)

  ### evidence
  - "Authenticated users can create evidence"  (INSERT)

  ### connectors
  - "Authenticated users can create connectors"  (INSERT)
  - "Users can update own connectors"  (UPDATE)

  ### projects
  - "Authenticated users can create projects"  (INSERT)
  - "Users can update own projects"  (UPDATE)

  ## Policies Retained (SELECT and DELETE remain for operational access)
  All SELECT and DELETE policies are unchanged.

  ## Notes
  - SECURITY DEFINER RPCs run as postgres, which bypasses RLS entirely.
  - Any future guarded RPC (create_incident, register_evidence, etc.) will work.
  - This does NOT affect the background_job_runs or job_queue tables.
*/

DROP POLICY IF EXISTS "Authenticated users can create incidents" ON incidents;
DROP POLICY IF EXISTS "Authenticated users can update incidents" ON incidents;

DROP POLICY IF EXISTS "Authenticated users can create evidence" ON evidence;

DROP POLICY IF EXISTS "Authenticated users can create connectors" ON connectors;
DROP POLICY IF EXISTS "Users can update own connectors" ON connectors;

DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
