/*
  # Drop unused indexes and duplicate index

  ## Summary
  Removes indexes that have never been used (per pg_stat_user_indexes) and
  one exact duplicate index pair. Unused indexes waste storage, slow down
  INSERT/UPDATE/DELETE operations, and add unnecessary overhead to the planner.

  ## Duplicate index removed
  - idx_event_logs_event_type on event_ledger (identical to idx_event_ledger_event_type_created)

  ## Unused indexes dropped (grouped by table)

  ### erasure_redaction_log
  - idx_erl_account_id
  - idx_erl_event_type
  - idx_erl_target
  - idx_erl_created_at

  ### benefit_clauses
  - idx_benefit_clauses_guide

  ### consent_tokens
  - idx_consent_tokens_incident
  - idx_consent_tokens_active

  ### interpretive_trace_records
  - idx_itr_incident_id
  - idx_itr_feature_id
  - idx_itr_created_at

  ### retention_policies
  - idx_rp_target_table
  - idx_rp_jurisdiction

  ### feature_activation_state
  - idx_feature_activation_feature
  - idx_feature_activation_rollout

  ### benefit_eval_runs
  - idx_benefit_eval_runs_incident

  ### credit_card_guide_versions
  - idx_guide_versions_active

  ### routing_recommendations
  - idx_routing_recs_incident
  - idx_routing_recs_accepted

  ### acceptance_checkpoints
  - idx_acceptance_checkpoints_rec

  ### event_ledger
  - idx_event_ledger_feature
  - idx_event_logs_created_at
  - idx_event_logs_entity_lookup
  - idx_event_logs_event_type (duplicate — drop this, keep idx_event_ledger_event_type_created)
  - idx_event_ledger_event_type_created (keep)

  ### connectors
  - idx_connectors_state
  - idx_connectors_project_id

  ### job_queue
  - idx_job_queue_processing
  - idx_job_queue_job_name
  - idx_job_queue_type_status
  - idx_job_queue_created

  ### incidents
  - idx_incidents_project_status
  - idx_incidents_assigned_to

  ### evidence
  - idx_evidence_incident_id

  ### oauth_tokens
  - idx_oauth_tokens_connector_id

  ### background_job_runs
  - idx_background_job_runs_job_name

  ### action_inbox_items
  - idx_action_inbox_items_feature
  - idx_action_inbox_items_incident
  - idx_action_inbox_items_status
  - idx_action_inbox_items_assigned
  - idx_action_inbox_items_snoozed

  ### action_inbox_notes
  - idx_action_inbox_notes_item

  ### policy_clauses
  - idx_clauses_version_type
  - idx_clauses_auto_accepted
  - idx_clauses_pending

  ### clause_review_queue
  - idx_review_queue_open

  ### action_inbox_state_changes
  - idx_action_inbox_state_changes_item

  ### feature_rollout_rules
  - idx_feature_rollout_rules_feature_region_enabled
  - idx_feature_rollout_rules_type

  ### feature_rollout_health_state
  - idx_feature_rollout_health_feature_region
  - idx_feature_rollout_health_status
  - idx_feature_rollout_health_rollback

  ### claim_routing_decisions
  - idx_routing_incident
  - idx_routing_trip
  - idx_routing_snapshot

  ### user_profiles
  - idx_user_profiles_tier
  - idx_user_profiles_tier_expiry
  - idx_user_profiles_residence

  ### session_tokens
  - idx_session_tokens_user
  - idx_session_tokens_active
  - idx_session_tokens_device

  ### account_actions_log
  - idx_account_actions_user
  - idx_account_actions_type
  - idx_account_actions_status

  ### trips
  - idx_trips_itinerary_hash

  ### participant_checklist_items
  - idx_pci_trip_participant

  ### evidence_validation_runs
  - idx_evidence_validation_evidence
  - idx_evidence_validation_incident
*/

-- Duplicate: drop the older-named one
DROP INDEX IF EXISTS public.idx_event_logs_event_type;

-- erasure_redaction_log
DROP INDEX IF EXISTS public.idx_erl_account_id;
DROP INDEX IF EXISTS public.idx_erl_event_type;
DROP INDEX IF EXISTS public.idx_erl_target;
DROP INDEX IF EXISTS public.idx_erl_created_at;

-- benefit_clauses
DROP INDEX IF EXISTS public.idx_benefit_clauses_guide;

-- consent_tokens
DROP INDEX IF EXISTS public.idx_consent_tokens_incident;
DROP INDEX IF EXISTS public.idx_consent_tokens_active;

-- interpretive_trace_records
DROP INDEX IF EXISTS public.idx_itr_incident_id;
DROP INDEX IF EXISTS public.idx_itr_feature_id;
DROP INDEX IF EXISTS public.idx_itr_created_at;

-- retention_policies
DROP INDEX IF EXISTS public.idx_rp_target_table;
DROP INDEX IF EXISTS public.idx_rp_jurisdiction;

-- feature_activation_state
DROP INDEX IF EXISTS public.idx_feature_activation_feature;
DROP INDEX IF EXISTS public.idx_feature_activation_rollout;

-- benefit_eval_runs
DROP INDEX IF EXISTS public.idx_benefit_eval_runs_incident;

-- credit_card_guide_versions
DROP INDEX IF EXISTS public.idx_guide_versions_active;

-- routing_recommendations
DROP INDEX IF EXISTS public.idx_routing_recs_incident;
DROP INDEX IF EXISTS public.idx_routing_recs_accepted;

-- acceptance_checkpoints
DROP INDEX IF EXISTS public.idx_acceptance_checkpoints_rec;

-- event_ledger
DROP INDEX IF EXISTS public.idx_event_ledger_feature;
DROP INDEX IF EXISTS public.idx_event_logs_created_at;
DROP INDEX IF EXISTS public.idx_event_logs_entity_lookup;
DROP INDEX IF EXISTS public.idx_event_ledger_event_type_created;

-- connectors
DROP INDEX IF EXISTS public.idx_connectors_state;
DROP INDEX IF EXISTS public.idx_connectors_project_id;

-- job_queue
DROP INDEX IF EXISTS public.idx_job_queue_processing;
DROP INDEX IF EXISTS public.idx_job_queue_job_name;
DROP INDEX IF EXISTS public.idx_job_queue_type_status;
DROP INDEX IF EXISTS public.idx_job_queue_created;

-- incidents
DROP INDEX IF EXISTS public.idx_incidents_project_status;
DROP INDEX IF EXISTS public.idx_incidents_assigned_to;

-- evidence
DROP INDEX IF EXISTS public.idx_evidence_incident_id;

-- oauth_tokens
DROP INDEX IF EXISTS public.idx_oauth_tokens_connector_id;

-- background_job_runs
DROP INDEX IF EXISTS public.idx_background_job_runs_job_name;

-- action_inbox_items
DROP INDEX IF EXISTS public.idx_action_inbox_items_feature;
DROP INDEX IF EXISTS public.idx_action_inbox_items_incident;
DROP INDEX IF EXISTS public.idx_action_inbox_items_status;
DROP INDEX IF EXISTS public.idx_action_inbox_items_assigned;
DROP INDEX IF EXISTS public.idx_action_inbox_items_snoozed;

-- action_inbox_notes
DROP INDEX IF EXISTS public.idx_action_inbox_notes_item;

-- policy_clauses
DROP INDEX IF EXISTS public.idx_clauses_version_type;
DROP INDEX IF EXISTS public.idx_clauses_auto_accepted;
DROP INDEX IF EXISTS public.idx_clauses_pending;

-- clause_review_queue
DROP INDEX IF EXISTS public.idx_review_queue_open;

-- action_inbox_state_changes
DROP INDEX IF EXISTS public.idx_action_inbox_state_changes_item;

-- feature_rollout_rules
DROP INDEX IF EXISTS public.idx_feature_rollout_rules_feature_region_enabled;
DROP INDEX IF EXISTS public.idx_feature_rollout_rules_type;

-- feature_rollout_health_state
DROP INDEX IF EXISTS public.idx_feature_rollout_health_feature_region;
DROP INDEX IF EXISTS public.idx_feature_rollout_health_status;
DROP INDEX IF EXISTS public.idx_feature_rollout_health_rollback;

-- claim_routing_decisions
DROP INDEX IF EXISTS public.idx_routing_incident;
DROP INDEX IF EXISTS public.idx_routing_trip;
DROP INDEX IF EXISTS public.idx_routing_snapshot;

-- user_profiles
DROP INDEX IF EXISTS public.idx_user_profiles_tier;
DROP INDEX IF EXISTS public.idx_user_profiles_tier_expiry;
DROP INDEX IF EXISTS public.idx_user_profiles_residence;

-- session_tokens
DROP INDEX IF EXISTS public.idx_session_tokens_user;
DROP INDEX IF EXISTS public.idx_session_tokens_active;
DROP INDEX IF EXISTS public.idx_session_tokens_device;

-- account_actions_log
DROP INDEX IF EXISTS public.idx_account_actions_user;
DROP INDEX IF EXISTS public.idx_account_actions_type;
DROP INDEX IF EXISTS public.idx_account_actions_status;

-- trips
DROP INDEX IF EXISTS public.idx_trips_itinerary_hash;

-- participant_checklist_items
DROP INDEX IF EXISTS public.idx_pci_trip_participant;

-- evidence_validation_runs
DROP INDEX IF EXISTS public.idx_evidence_validation_evidence;
DROP INDEX IF EXISTS public.idx_evidence_validation_incident;
