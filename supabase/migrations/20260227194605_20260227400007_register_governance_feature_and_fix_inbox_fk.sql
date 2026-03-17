/*
  # Register 'governance' in feature_registry + Fix action_inbox_items FK

  ## Summary
  The action_inbox_items table has feature_id FK → feature_registry.
  The projector falls back to 'governance' when event.feature_id is not a
  registered feature, but 'governance' is only used in event_type_registry,
  not feature_registry.

  ## Fix
  1. Register 'governance' as a meta-feature in feature_registry so the FK holds.
  2. Also register 'incidents' and 'evidence' since those are feature_ids emitted
     by the guarded create_incident / register_evidence RPCs.

  ## No data changes — these are INSERT ON CONFLICT DO NOTHING rows.
*/

INSERT INTO feature_registry (feature_id, display_name, description, default_enabled, minimum_mode) VALUES
  ('governance', 'Governance & Observability', 'Core governance, audit, and observability infrastructure', true, 'NORMAL'),
  ('incidents',  'Incident Management',        'Core incident lifecycle management',                       true, 'NORMAL'),
  ('evidence',   'Evidence Management',        'Core evidence attachment and management',                  true, 'NORMAL')
ON CONFLICT (feature_id) DO NOTHING;
