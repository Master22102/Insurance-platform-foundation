/*
  # Fix RLS Auth Initialization Plan — wrap auth.<function>() with (select ...)

  ## Summary
  Postgres evaluates auth.<function>() calls in RLS policies per-row by default,
  causing repeated initialization overhead. Wrapping them in a subselect
  (e.g. `(select auth.uid())`) tells Postgres to evaluate them once per query,
  not once per row, yielding significantly better performance at scale.

  ## Affected tables and policies
  1. trips — Users can delete own projects, trips_select
  2. incidents — Users can delete own incidents
  3. evidence — Users can delete own evidence
  4. connectors — Users can delete own connectors
  5. oauth_tokens — all 4 policies
  6. event_ledger — Authenticated users can create event logs
  7. interpretive_trace_records — Authenticated users can read interpretive traces
  8. policies — pol_select, pol_insert
  9. policy_versions — polv_select, polv_insert
  10. claims — claims_select, claims_insert
  11. contacts — contacts_select, contacts_insert
  12. coverage_graph_snapshots — cgs_select
  13. coverage_nodes — cn_select
  14. policy_documents — pd_select
  15. policy_clauses — pc_select
  16. clause_review_queue — crq_select
  17. scan_jobs — sj_select
  18. scan_credit_ledger — scl_select
  19. claim_routing_decisions — routing_select
  20. user_profiles — user_profiles_self_select, user_profiles_self_update
  21. session_tokens — all 3 policies
  22. account_actions_log — account_actions_self_select
  23. job_queue — job_queue_user_select
  24. participant_checklist_items — both policies
  25. erasure_redaction_log — both policies

  ## Method
  Drop and recreate each policy using (select auth.uid()) instead of auth.uid().
*/

-- ============================================================
-- trips
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own projects" ON public.trips;
CREATE POLICY "Users can delete own projects"
  ON public.trips FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "trips_select" ON public.trips;
CREATE POLICY "trips_select"
  ON public.trips FOR SELECT
  TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================================
-- incidents
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own incidents" ON public.incidents;
CREATE POLICY "Users can delete own incidents"
  ON public.incidents FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================================
-- evidence
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own evidence" ON public.evidence;
CREATE POLICY "Users can delete own evidence"
  ON public.evidence FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================================
-- connectors
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own connectors" ON public.connectors;
CREATE POLICY "Users can delete own connectors"
  ON public.connectors FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================================
-- oauth_tokens
-- ============================================================
DROP POLICY IF EXISTS "Users can view tokens for own connectors" ON public.oauth_tokens;
CREATE POLICY "Users can view tokens for own connectors"
  ON public.oauth_tokens FOR SELECT
  TO authenticated
  USING (connector_id IN (
    SELECT id FROM public.connectors WHERE created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can create tokens for own connectors" ON public.oauth_tokens;
CREATE POLICY "Users can create tokens for own connectors"
  ON public.oauth_tokens FOR INSERT
  TO authenticated
  WITH CHECK (connector_id IN (
    SELECT id FROM public.connectors WHERE created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update tokens for own connectors" ON public.oauth_tokens;
CREATE POLICY "Users can update tokens for own connectors"
  ON public.oauth_tokens FOR UPDATE
  TO authenticated
  USING (connector_id IN (
    SELECT id FROM public.connectors WHERE created_by = (select auth.uid())
  ))
  WITH CHECK (connector_id IN (
    SELECT id FROM public.connectors WHERE created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete tokens for own connectors" ON public.oauth_tokens;
CREATE POLICY "Users can delete tokens for own connectors"
  ON public.oauth_tokens FOR DELETE
  TO authenticated
  USING (connector_id IN (
    SELECT id FROM public.connectors WHERE created_by = (select auth.uid())
  ));

-- ============================================================
-- event_ledger — fix "Authenticated users can create event logs"
-- (duplicate of "Authenticated users can append to event_ledger" — drop it,
--  fix the canonical one in the next migration)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can create event logs" ON public.event_ledger;

DROP POLICY IF EXISTS "Authenticated users can append to event_ledger" ON public.event_ledger;
CREATE POLICY "Authenticated users can append to event_ledger"
  ON public.event_ledger FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = (select auth.uid()) OR actor_id IS NULL);

-- ============================================================
-- interpretive_trace_records
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read interpretive traces" ON public.interpretive_trace_records;
CREATE POLICY "Authenticated users can read interpretive traces"
  ON public.interpretive_trace_records FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ============================================================
-- policies
-- ============================================================
DROP POLICY IF EXISTS "pol_select" ON public.policies;
CREATE POLICY "pol_select"
  ON public.policies FOR SELECT
  TO authenticated
  USING (account_id = (select auth.uid()));

DROP POLICY IF EXISTS "pol_insert" ON public.policies;
CREATE POLICY "pol_insert"
  ON public.policies FOR INSERT
  TO authenticated
  WITH CHECK (account_id = (select auth.uid()));

-- ============================================================
-- policy_versions
-- ============================================================
DROP POLICY IF EXISTS "polv_select" ON public.policy_versions;
CREATE POLICY "polv_select"
  ON public.policy_versions FOR SELECT
  TO authenticated
  USING (policy_id IN (
    SELECT policy_id FROM public.policies WHERE account_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "polv_insert" ON public.policy_versions;
CREATE POLICY "polv_insert"
  ON public.policy_versions FOR INSERT
  TO authenticated
  WITH CHECK (policy_id IN (
    SELECT policy_id FROM public.policies WHERE account_id = (select auth.uid())
  ));

-- ============================================================
-- claims
-- ============================================================
DROP POLICY IF EXISTS "claims_select" ON public.claims;
CREATE POLICY "claims_select"
  ON public.claims FOR SELECT
  TO authenticated
  USING (account_id = (select auth.uid()));

DROP POLICY IF EXISTS "claims_insert" ON public.claims;
CREATE POLICY "claims_insert"
  ON public.claims FOR INSERT
  TO authenticated
  WITH CHECK (account_id = (select auth.uid()));

-- ============================================================
-- contacts
-- ============================================================
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
CREATE POLICY "contacts_select"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (account_id = (select auth.uid()));

DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
CREATE POLICY "contacts_insert"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (account_id = (select auth.uid()));

-- ============================================================
-- coverage_graph_snapshots
-- ============================================================
DROP POLICY IF EXISTS "cgs_select" ON public.coverage_graph_snapshots;
CREATE POLICY "cgs_select"
  ON public.coverage_graph_snapshots FOR SELECT
  TO authenticated
  USING (trip_id IN (
    SELECT trip_id FROM public.trips WHERE created_by = (select auth.uid())
  ));

-- ============================================================
-- coverage_nodes
-- ============================================================
DROP POLICY IF EXISTS "cn_select" ON public.coverage_nodes;
CREATE POLICY "cn_select"
  ON public.coverage_nodes FOR SELECT
  TO authenticated
  USING (snapshot_id IN (
    SELECT snapshot_id FROM public.coverage_graph_snapshots
    WHERE trip_id IN (
      SELECT trip_id FROM public.trips WHERE created_by = (select auth.uid())
    )
  ));

-- ============================================================
-- policy_documents
-- ============================================================
DROP POLICY IF EXISTS "pd_select" ON public.policy_documents;
CREATE POLICY "pd_select"
  ON public.policy_documents FOR SELECT
  TO authenticated
  USING (account_id = (select auth.uid()));

-- ============================================================
-- policy_clauses
-- ============================================================
DROP POLICY IF EXISTS "pc_select" ON public.policy_clauses;
CREATE POLICY "pc_select"
  ON public.policy_clauses FOR SELECT
  TO authenticated
  USING (policy_document_id IN (
    SELECT document_id FROM public.policy_documents WHERE account_id = (select auth.uid())
  ));

-- ============================================================
-- clause_review_queue
-- ============================================================
DROP POLICY IF EXISTS "crq_select" ON public.clause_review_queue;
CREATE POLICY "crq_select"
  ON public.clause_review_queue FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = ANY (ARRAY['support', 'founder']));

-- ============================================================
-- scan_jobs
-- ============================================================
DROP POLICY IF EXISTS "sj_select" ON public.scan_jobs;
CREATE POLICY "sj_select"
  ON public.scan_jobs FOR SELECT
  TO authenticated
  USING (account_id = (select auth.uid()));

-- ============================================================
-- scan_credit_ledger
-- ============================================================
DROP POLICY IF EXISTS "scl_select" ON public.scan_credit_ledger;
CREATE POLICY "scl_select"
  ON public.scan_credit_ledger FOR SELECT
  TO authenticated
  USING (account_id = (select auth.uid()));

-- ============================================================
-- claim_routing_decisions
-- ============================================================
DROP POLICY IF EXISTS "routing_select" ON public.claim_routing_decisions;
CREATE POLICY "routing_select"
  ON public.claim_routing_decisions FOR SELECT
  TO authenticated
  USING (trip_id IN (
    SELECT trip_id FROM public.trips WHERE created_by = (select auth.uid())
  ));

-- ============================================================
-- user_profiles
-- ============================================================
DROP POLICY IF EXISTS "user_profiles_self_select" ON public.user_profiles;
CREATE POLICY "user_profiles_self_select"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_profiles_self_update" ON public.user_profiles;
CREATE POLICY "user_profiles_self_update"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================
-- session_tokens
-- ============================================================
DROP POLICY IF EXISTS "session_tokens_self_select" ON public.session_tokens;
CREATE POLICY "session_tokens_self_select"
  ON public.session_tokens FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "session_tokens_self_insert" ON public.session_tokens;
CREATE POLICY "session_tokens_self_insert"
  ON public.session_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "session_tokens_self_update" ON public.session_tokens;
CREATE POLICY "session_tokens_self_update"
  ON public.session_tokens FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================
-- account_actions_log
-- ============================================================
DROP POLICY IF EXISTS "account_actions_self_select" ON public.account_actions_log;
CREATE POLICY "account_actions_self_select"
  ON public.account_actions_log FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================
-- job_queue — fix user-scoped policy
-- ============================================================
DROP POLICY IF EXISTS "job_queue_user_select" ON public.job_queue;
CREATE POLICY "job_queue_user_select"
  ON public.job_queue FOR SELECT
  TO authenticated
  USING ((payload ->> 'user_id') = (select auth.uid())::text);

-- ============================================================
-- participant_checklist_items
-- ============================================================
DROP POLICY IF EXISTS "Participant can view own checklist items" ON public.participant_checklist_items;
CREATE POLICY "Participant can view own checklist items"
  ON public.participant_checklist_items FOR SELECT
  TO authenticated
  USING (participant_account_id = (select auth.uid()));

DROP POLICY IF EXISTS "Participant can insert own checklist items" ON public.participant_checklist_items;
CREATE POLICY "Participant can insert own checklist items"
  ON public.participant_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (participant_account_id = (select auth.uid()));

-- ============================================================
-- erasure_redaction_log
-- ============================================================
DROP POLICY IF EXISTS "Accounts can view their own erasure events" ON public.erasure_redaction_log;
CREATE POLICY "Accounts can view their own erasure events"
  ON public.erasure_redaction_log FOR SELECT
  TO authenticated
  USING (account_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert their own erasure events" ON public.erasure_redaction_log;
CREATE POLICY "Authenticated users can insert their own erasure events"
  ON public.erasure_redaction_log FOR INSERT
  TO authenticated
  WITH CHECK (account_id = (select auth.uid()));
