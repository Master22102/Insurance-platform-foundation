# A1 — RPC inventory (generated)

**Purpose:** Systematic view of **Postgres RPCs** in `supabase/migrations` for **tenant isolation / auth binding** (`SHIP_BAR` **A1**).

**How generated:** `node scripts/generate-a1-rpc-inventory.mjs` — parses `CREATE OR REPLACE FUNCTION` blocks (heuristic). **Not** a substitute for manual review or penetration testing.

**Risk labels (heuristic):**

| Label | Meaning |
|-------|---------|
| **high** | `SECURITY DEFINER`, has `p_user_id` / `p_actor_id` / `p_account_id`, parsed body has **no** `auth.uid()` / `auth.jwt()` — **review first**. |
| **medium** | `SECURITY DEFINER`, no user-id params in signature, no `auth.uid` in body — may be internal; verify `GRANT` / caller. |
| **mitigated** | `SECURITY DEFINER` and body references `auth.uid()` / `auth.jwt()`. |
| **lower** | `SECURITY INVOKER` (RLS applies to table access). |
| **review** | Ambiguous header — confirm invoker vs definer in SQL. |

## Summary

| Bucket | Count |
|--------|-------|
| **high** | 50 |
| **medium** | 26 |
| **mitigated** | 39 |
| **lower** | 0 |
| **review** | 11 |
| **Total (latest definition per name)** | 126 |

## HIGH (50)

| `acknowledge_alignment_change` | supabase/migrations/20260305213152_20260305210003_f6_f7_itinerary_hash_and_ledger_events.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `approve_connector_manual_review` | supabase/migrations/20260227030411_20260227030000_option_a_ledger_takeover.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `change_connector_state` | supabase/migrations/20260227030411_20260227030000_option_a_ledger_takeover.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `compute_coverage_graph` | supabase/migrations/20260305202130_compute_coverage_graph_rpc.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `confirm_itinerary_snapshot` | supabase/migrations/20260305213152_20260305210003_f6_f7_itinerary_hash_and_ledger_events.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `consume_scan_credit` | supabase/migrations/20260305213033_20260305210001_f1_per_trip_unlock_membership_model.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `create_incident` | supabase/migrations/20260305202519_create_trip_guarded_rpc_v2.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `create_trip` | supabase/migrations/20260315070916_update_create_trip_rpc_with_destination_dates.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `create_user_profile_on_signup` | supabase/migrations/20260305213033_20260305210001_f1_per_trip_unlock_membership_model.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `emit_event` | supabase/migrations/20260227014056_20260227020000_governance_substrate_v1_1_patch.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `emit_itr` | supabase/migrations/20260227170119_20260227200002_itr_output_idempotency_and_emit_itr_failhard.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `enqueue_policy_parse_job_atomic` | supabase/migrations/20260321193000_atomic_policy_parse_enqueue.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `enter_protective_safety_mode` | supabase/migrations/20260322110000_f662_protective_safety_mode_foundation.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `evaluate_feature_rollout_health` | supabase/migrations/20260227200921_20260227500005_auto_rollback_evaluator_rpcs.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `evaluate_protective_safety_mode_exit` | supabase/migrations/20260322110000_f662_protective_safety_mode_foundation.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `generate_routing_recommendation` | supabase/migrations/20260227184237_20260227300005_routing_rpcs.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `grant_consent` | supabase/migrations/20260227184146_20260227300004_benefit_guide_rpcs.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `ingest_corpus_rules` | supabase/migrations/20260311090001_extraction_bridge_ingest_rpc.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `ingest_guide_version` | supabase/migrations/20260227184146_20260227300004_benefit_guide_rpcs.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `initiate_policy_upload` | supabase/migrations/20260305200017_update_rpcs_for_new_schema.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_authority_disruption` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_carrier_deeplink` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_carrier_discrepancy` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_causality_link` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_claim_packet` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_claim_progress` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_coverage_graph` | supabase/migrations/20260227194423_20260227400005_fix_stub_rpc_null_scope.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_dcel_enrich` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_disruption_ingest` | supabase/migrations/20260227194423_20260227400005_fix_stub_rpc_null_scope.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_feature_stub` | supabase/migrations/20260227194423_20260227400005_fix_stub_rpc_null_scope.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_financial_model` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_itinerary_risk` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_pipeline_ingest` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_policy_parse` | supabase/migrations/20260227194423_20260227400005_fix_stub_rpc_null_scope.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_rair_report` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_rebooking_log` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_timeline_enrich` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `invoke_voice_capture` | supabase/migrations/20260227193756_20260227400001_prewire_feature_registry.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `log_connector_failure` | supabase/migrations/20260227030411_20260227030000_option_a_ledger_takeover.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `mark_policy_version_user_confirmed` | supabase/migrations/20260321170000_section41_policy_governance_determinism.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `record_acceptance_checkpoint` | supabase/migrations/20260227184237_20260227300005_routing_rpcs.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `record_alignment_comparison` | supabase/migrations/20260305213152_20260305210003_f6_f7_itinerary_hash_and_ledger_events.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `record_extraction_complete` | supabase/migrations/20260305201809_update_record_extraction_complete_emit_policy_version_created.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `register_evidence` | supabase/migrations/20260227165925_20260227200000_guarded_create_incident_register_evidence.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `revoke_consent` | supabase/migrations/20260227184146_20260227300004_benefit_guide_rpcs.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `run_action_inbox_projector` | supabase/migrations/20260227194642_20260227400008_fix_projector_orphan_incident_fk.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `run_benefit_eval` | supabase/migrations/20260227184146_20260227300004_benefit_guide_rpcs.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `run_connector_health_check_job` | supabase/migrations/20260227030411_20260227030000_option_a_ledger_takeover.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `run_feature_rollout_auto_rollback` | supabase/migrations/20260227200921_20260227500005_auto_rollback_evaluator_rpcs.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |
| `update_itinerary_hash` | supabase/migrations/20260305213152_20260305210003_f6_f7_itinerary_hash_and_ledger_events.sql | DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**. |

## MEDIUM (26)

| `block_itr_delete` | supabase/migrations/20260227031157_20260227040001_fix_itr_triggers.sql |
| `block_itr_update` | supabase/migrations/20260227031157_20260227040001_fix_itr_triggers.sql |
| `build_founder_readable_explanation` | supabase/migrations/20260227184036_20260227300003_timeline_view_registries_observability.sql |
| `check_feature_gate` | supabase/migrations/20260227193614_20260227400000_universal_event_metadata_rails.sql |
| `event_logs_insert_trigger` | supabase/migrations/20260227012733_20260226190000_governance_substrate_v1.sql |
| `founder_readable_explanation` | supabase/migrations/20260227031913_20260227041000_patch_founder_readable_explanation.sql |
| `get_confidence_label_text` | supabase/migrations/20260227184036_20260227300003_timeline_view_registries_observability.sql |
| `get_connector_failures_24h` | supabase/migrations/20260227030411_20260227030000_option_a_ledger_takeover.sql |
| `get_doctrine_refs_for_event` | supabase/migrations/20260227194053_20260227400004_explain_fix_hooks.sql |
| `get_explain_fix_context` | supabase/migrations/20260227194751_20260227400009_fix_explain_fix_mode_column.sql |
| `get_fix_hints_for_event` | supabase/migrations/20260227194053_20260227400004_explain_fix_hooks.sql |
| `get_mode_display_name` | supabase/migrations/20260227193614_20260227400000_universal_event_metadata_rails.sql |
| `get_rpc_context_for_event` | supabase/migrations/20260227194053_20260227400004_explain_fix_hooks.sql |
| `is_feature_eligible` | supabase/migrations/20260227200750_20260227500003_deterministic_eligibility_function.sql |
| `list_action_inbox_items` | supabase/migrations/20260227193950_20260227400003_action_inbox_rpcs.sql |
| `log_residence_change` | supabase/migrations/20260305213033_20260305210001_f1_per_trip_unlock_membership_model.sql |
| `policy_version_is_gap_closure_eligible` | supabase/migrations/20260321170000_section41_policy_governance_determinism.sql |
| `precheck_mutation_guard` | supabase/migrations/20260322110000_f662_protective_safety_mode_foundation.sql |
| `prior_relationship_exists` | supabase/migrations/20260320103000_group_authority_foundation.sql |
| `psm_operation_availability` | supabase/migrations/20260322110000_f662_protective_safety_mode_foundation.sql |
| `release_battery_failures` | supabase/migrations/20260227042552_20260227070000_fix_integrity_lock_overwrites.sql |
| `request_group_participant_add` | supabase/migrations/20260320160000_section2_identity_guarded_mutations.sql |
| `reset_monthly_scan_credits` | supabase/migrations/20260305203621_account_membership_infrastructure.sql |
| `resolve_protective_mode_trigger` | supabase/migrations/20260322110000_f662_protective_safety_mode_foundation.sql |
| `validate_interpretive_trace_reference` | supabase/migrations/20260227041431_20260227060000_canonical_emit_itr_and_battery_contract.sql |
| `validate_suppression_event_metadata` | supabase/migrations/20260227193614_20260227400000_universal_event_metadata_rails.sql |


## MITIGATED (sample — first 25)

| `add_action_inbox_note` | supabase/migrations/20260323150001_pass13_action_inbox_actor_auth_binding.sql |
| `add_deep_scan_credits` | supabase/migrations/20260323123000_pass9_idempotency_hardening.sql |
| `add_emergency_delegate` | supabase/migrations/20260322113000_f663_f664_f666_foundations.sql |
| `advance_trip_maturity` | supabase/migrations/20260325100000_a1_advance_trip_maturity_auth_bind.sql |
| `archive_trip` | supabase/migrations/20260315083115_20260315080001_archive_trip_rpc.sql |
| `assign_action_inbox_item` | supabase/migrations/20260323150001_pass13_action_inbox_actor_auth_binding.sql |
| `can_organizer_export_subject` | supabase/migrations/20260320113000_minor_guardian_export_controls.sql |
| `change_disruption_resolution_state` | supabase/migrations/20260323130000_pass10_statutory_fsm_foundation.sql |
| `change_incident_status` | supabase/migrations/20260324130000_fix_change_incident_status_text_canonical.sql |
| `check_membership_entitlement` | supabase/migrations/20260323120000_pass8_payment_entitlement_auth_emit_hardening.sql |
| `complete_step_up_verification` | supabase/migrations/20260323150000_pass12_membership_self_rpc_auth_binding.sql |
| `consume_basic_scan_credit_strict` | supabase/migrations/20260321200000_strict_quick_scan_credit_consumption.sql |
| `consume_dual_presence_bypass_code` | supabase/migrations/20260322113000_f663_f664_f666_foundations.sql |
| `create_claim_packet_from_incident` | supabase/migrations/20260323151000_pass14_claim_packet_routing_ready_guard.sql |
| `create_dual_presence_bypass_code` | supabase/migrations/20260322113000_f663_f664_f666_foundations.sql |
| `create_session_token` | supabase/migrations/20260323150000_pass12_membership_self_rpc_auth_binding.sql |
| `end_emergency_mode_guardian_confirm` | supabase/migrations/20260322113000_f663_f664_f666_foundations.sql |
| `evaluate_statutory_rights` | supabase/migrations/20260323130000_pass10_statutory_fsm_foundation.sql |
| `founder_reset_relationship_block` | supabase/migrations/20260320160000_section2_identity_guarded_mutations.sql |
| `grant_export_authorization` | supabase/migrations/20260320160000_section2_identity_guarded_mutations.sql |
| `initiate_deep_scan` | supabase/migrations/20260324120000_fix_pgrst203_and_job_queue_job_name.sql |
| `initiate_quick_scan` | supabase/migrations/20260324120000_fix_pgrst203_and_job_queue_job_name.sql |
| `link_event_to_inbox_item` | supabase/migrations/20260323150001_pass13_action_inbox_actor_auth_binding.sql |
| `record_mfa_enrollment` | supabase/migrations/20260323150000_pass12_membership_self_rpc_auth_binding.sql |
| `request_step_up_verification` | supabase/migrations/20260323150000_pass12_membership_self_rpc_auth_binding.sql |

| … | … | _14 more in `scripts/a1-rpc-inventory.json`._ |

## Related

- `docs/A1_EXCEPTIONS.md` — intentional service-role / internal RPCs.
- `npm run verify:a1-inventory` — optional CI check vs baseline.
- Regenerate after migration changes.

*Generated: 2026-03-20*
