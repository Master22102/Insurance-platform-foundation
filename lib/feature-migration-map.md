# Feature → Migration Map

Maintained per ADR 0001. Any migration that delivers, extends, or patches a
feature must be listed under that feature's row. A migration that touches
multiple features is listed under each (with a note on its scope).

## F-6.5.1 — Policy Parsing & Clause Extraction

- `20260305195936_policy_parsing_schema.sql`
- `20260305201403_create_record_extraction_complete_rpc.sql`
- `20260305201809_update_record_extraction_complete_emit_policy_version_created.sql`
- `20260311090000_extraction_bridge_schema.sql`
- `20260311090001_extraction_bridge_ingest_rpc.sql`
- `20260330100000_f6517_catalog_and_cost_ledger.sql`         *(legacy prefix; owner = F-6.5.1 per ADR 0001)*
- `20260330100100_f6517_corpus_catalog_seed.sql`              *(legacy prefix)*
- `20260330100200_f6517_chase_reserve_catalog_clauses.sql`    *(legacy prefix)*
- `20260330100300_f6517_spec_v3_schema_alignment.sql`         *(legacy prefix)*

## F-6.5.2 — Coverage Graph

- `20260305195903_create_coverage_graph_tables.sql`
- `20260305202130_compute_coverage_graph_rpc.sql`

## F-6.5.5 — Claim Routing Engine

- `20260305203142_claim_routing_engine.sql`
- `20260227183948_20260227300002_routing_and_evidence_schema.sql`
- `20260227184237_20260227300005_routing_rpcs.sql`

## F-6.5.6 — Evidence Management

- `20260227183948_20260227300002_routing_and_evidence_schema.sql` *(shared with F-6.5.5)*

## F-6.5.7 — Incident Timeline Read Model

- `20260227184036_20260227300003_timeline_view_registries_observability.sql`

## F-6.5.8 — Active Disruption Options Engine

- `20260314175212_20260315000002_M24_incidents_options_engine.sql`
- `20260421120614_fix_m24_event_attribution_f658.sql`   *(corrects event_type_registry attribution)*

## F-6.5.25 — Statutory Rights Engine (conditional, pending D-2 decision)

- _(none applied yet)_

## Governance / Cross-feature

- `20260227012733_20260226190000_governance_substrate_v1.sql`
- `20260227012751_20260226191000_update_change_incident_status_emit_event.sql`
- `20260227193614_20260227400000_universal_event_metadata_rails.sql`
- `20260227193756_20260227400001_prewire_feature_registry.sql`
- `20260227193834_20260227400002_action_inbox_tables.sql`
- `20260314174441_20260315000000_M22_feature_registry_completion.sql`
- `20260314180136_20260315000004_M11b_connector_failure_enums.sql`

## Trust / Privacy / Erasure

- `20260314201114_20260315000005_M26_erasure_redaction_log.sql` *(erasure_requests table still pending per M-005)*
- `20260315083050_20260315080000_retention_policies_table.sql`
- `20260315083115_20260315080001_archive_trip_rpc.sql`

---

This map is a living document; update it in the same PR as any migration.
