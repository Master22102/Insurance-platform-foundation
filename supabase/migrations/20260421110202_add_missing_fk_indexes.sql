/*
  # Add missing foreign key covering indexes

  ## Summary
  Adds B-tree indexes on all foreign key columns that currently lack a covering index.
  Without these indexes, Postgres must do a sequential scan on the referencing table
  whenever the referenced row is updated or deleted, and when joining on those columns.

  ## Tables and columns covered
  - acceptance_checkpoints: incident_id
  - account_actions_log: session_id
  - action_inbox_items: source_event_id
  - action_inbox_projector_state: last_processed_event_id
  - benefit_eval_runs: guide_id, itr_trace_id
  - claim_routing_decisions: branch_a_itr_id, branch_b_itr_id, matched_node_id
  - claims: account_id, incident_id, itr_trace_id, policy_version_id, trip_id
  - clause_review_queue: clause_id, policy_document_id
  - connectors: created_by
  - consent_tokens: guide_id
  - contacts: account_id
  - coverage_graph_snapshots: itr_trace_id, trip_id
  - coverage_nodes: policy_version_id, snapshot_id
  - erasure_redaction_log: retention_policy_id
  - evidence: created_by, linked_guide_id
  - feature_registry: parent_feature_id
  - incidents: created_by
  - participant_checklist_items: participant_account_id
  - policies: active_version_id, account_id, created_by, trip_id
  - policy_documents: account_id, policy_id, trip_id
  - policy_versions: ingested_by, itr_trace_id
  - routing_recommendations: guide_id, itr_trace_id
  - scan_credit_ledger: account_id, scan_job_id
  - scan_jobs: account_id, trip_id
  - screen_surface_registry: feature_id
  - trips: created_by

  ## Notes
  - All indexes use IF NOT EXISTS so re-running is safe.
  - Indexes are named fki_<table>_<column> to distinguish them from query-support indexes.
*/

-- acceptance_checkpoints
CREATE INDEX IF NOT EXISTS fki_acceptance_checkpoints_incident_id
  ON public.acceptance_checkpoints (incident_id);

-- account_actions_log
CREATE INDEX IF NOT EXISTS fki_account_actions_log_session_id
  ON public.account_actions_log (session_id);

-- action_inbox_items
CREATE INDEX IF NOT EXISTS fki_action_inbox_items_source_event_id
  ON public.action_inbox_items (source_event_id);

-- action_inbox_projector_state
CREATE INDEX IF NOT EXISTS fki_action_inbox_projector_state_last_processed_event_id
  ON public.action_inbox_projector_state (last_processed_event_id);

-- benefit_eval_runs
CREATE INDEX IF NOT EXISTS fki_benefit_eval_runs_guide_id
  ON public.benefit_eval_runs (guide_id);
CREATE INDEX IF NOT EXISTS fki_benefit_eval_runs_itr_trace_id
  ON public.benefit_eval_runs (itr_trace_id);

-- claim_routing_decisions
CREATE INDEX IF NOT EXISTS fki_claim_routing_decisions_branch_a_itr_id
  ON public.claim_routing_decisions (branch_a_itr_id);
CREATE INDEX IF NOT EXISTS fki_claim_routing_decisions_branch_b_itr_id
  ON public.claim_routing_decisions (branch_b_itr_id);
CREATE INDEX IF NOT EXISTS fki_claim_routing_decisions_matched_node_id
  ON public.claim_routing_decisions (matched_node_id);

-- claims
CREATE INDEX IF NOT EXISTS fki_claims_account_id
  ON public.claims (account_id);
CREATE INDEX IF NOT EXISTS fki_claims_incident_id
  ON public.claims (incident_id);
CREATE INDEX IF NOT EXISTS fki_claims_itr_trace_id
  ON public.claims (itr_trace_id);
CREATE INDEX IF NOT EXISTS fki_claims_policy_version_id
  ON public.claims (policy_version_id);
CREATE INDEX IF NOT EXISTS fki_claims_trip_id
  ON public.claims (trip_id);

-- clause_review_queue
CREATE INDEX IF NOT EXISTS fki_clause_review_queue_clause_id
  ON public.clause_review_queue (clause_id);
CREATE INDEX IF NOT EXISTS fki_clause_review_queue_policy_document_id
  ON public.clause_review_queue (policy_document_id);

-- connectors
CREATE INDEX IF NOT EXISTS fki_connectors_created_by
  ON public.connectors (created_by);

-- consent_tokens
CREATE INDEX IF NOT EXISTS fki_consent_tokens_guide_id
  ON public.consent_tokens (guide_id);

-- contacts
CREATE INDEX IF NOT EXISTS fki_contacts_account_id
  ON public.contacts (account_id);

-- coverage_graph_snapshots
CREATE INDEX IF NOT EXISTS fki_coverage_graph_snapshots_itr_trace_id
  ON public.coverage_graph_snapshots (itr_trace_id);
CREATE INDEX IF NOT EXISTS fki_coverage_graph_snapshots_trip_id
  ON public.coverage_graph_snapshots (trip_id);

-- coverage_nodes
CREATE INDEX IF NOT EXISTS fki_coverage_nodes_policy_version_id
  ON public.coverage_nodes (policy_version_id);
CREATE INDEX IF NOT EXISTS fki_coverage_nodes_snapshot_id
  ON public.coverage_nodes (snapshot_id);

-- erasure_redaction_log
CREATE INDEX IF NOT EXISTS fki_erasure_redaction_log_retention_policy_id
  ON public.erasure_redaction_log (retention_policy_id);

-- evidence
CREATE INDEX IF NOT EXISTS fki_evidence_created_by
  ON public.evidence (created_by);
CREATE INDEX IF NOT EXISTS fki_evidence_linked_guide_id
  ON public.evidence (linked_guide_id);

-- feature_registry
CREATE INDEX IF NOT EXISTS fki_feature_registry_parent_feature_id
  ON public.feature_registry (parent_feature_id);

-- incidents
CREATE INDEX IF NOT EXISTS fki_incidents_created_by
  ON public.incidents (created_by);

-- participant_checklist_items
CREATE INDEX IF NOT EXISTS fki_participant_checklist_items_participant_account_id
  ON public.participant_checklist_items (participant_account_id);

-- policies
CREATE INDEX IF NOT EXISTS fki_policies_active_version_id
  ON public.policies (active_version_id);
CREATE INDEX IF NOT EXISTS fki_policies_account_id
  ON public.policies (account_id);
CREATE INDEX IF NOT EXISTS fki_policies_created_by
  ON public.policies (created_by);
CREATE INDEX IF NOT EXISTS fki_policies_trip_id
  ON public.policies (trip_id);

-- policy_documents
CREATE INDEX IF NOT EXISTS fki_policy_documents_account_id
  ON public.policy_documents (account_id);
CREATE INDEX IF NOT EXISTS fki_policy_documents_policy_id
  ON public.policy_documents (policy_id);
CREATE INDEX IF NOT EXISTS fki_policy_documents_trip_id
  ON public.policy_documents (trip_id);

-- policy_versions
CREATE INDEX IF NOT EXISTS fki_policy_versions_ingested_by
  ON public.policy_versions (ingested_by);
CREATE INDEX IF NOT EXISTS fki_policy_versions_itr_trace_id
  ON public.policy_versions (itr_trace_id);

-- routing_recommendations
CREATE INDEX IF NOT EXISTS fki_routing_recommendations_guide_id
  ON public.routing_recommendations (guide_id);
CREATE INDEX IF NOT EXISTS fki_routing_recommendations_itr_trace_id
  ON public.routing_recommendations (itr_trace_id);

-- scan_credit_ledger
CREATE INDEX IF NOT EXISTS fki_scan_credit_ledger_account_id
  ON public.scan_credit_ledger (account_id);
CREATE INDEX IF NOT EXISTS fki_scan_credit_ledger_scan_job_id
  ON public.scan_credit_ledger (scan_job_id);

-- scan_jobs
CREATE INDEX IF NOT EXISTS fki_scan_jobs_account_id
  ON public.scan_jobs (account_id);
CREATE INDEX IF NOT EXISTS fki_scan_jobs_trip_id
  ON public.scan_jobs (trip_id);

-- screen_surface_registry
CREATE INDEX IF NOT EXISTS fki_screen_surface_registry_feature_id
  ON public.screen_surface_registry (feature_id);

-- trips
CREATE INDEX IF NOT EXISTS fki_trips_created_by
  ON public.trips (created_by);
