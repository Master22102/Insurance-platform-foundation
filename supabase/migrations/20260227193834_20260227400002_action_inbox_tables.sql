/*
  # Action Inbox — Tables (Prompt 2 — Section E)

  ## Summary
  Persistent system-wide action inbox auto-generated from ledger events.
  Implements Option B: projector pattern driven by event_ledger.

  ## New Tables

  ### action_inbox_items
  Core inbox item record. Each item corresponds to one actionable task
  derived from one or more ledger events.
  - item_id (PK uuid)
  - feature_id: which feature sourced this item
  - incident_id: linked incident (nullable for system-level items)
  - source_event_id: originating ledger event (FK event_ledger)
  - item_type: categorization (task / alert / notification / escalation)
  - status: open / snoozed / assigned / resolved / dismissed
  - priority: critical / high / medium / low
  - title: short human-readable label
  - body: longer explanation (founder-readable)
  - reason_code: canonical reason code driving this item
  - next_step_hint: what to do next
  - assigned_to: uuid of assignee (nullable)
  - snoozed_until: timestamptz (nullable)
  - resolved_at: timestamptz (nullable)
  - idempotency_key: used by projector to prevent duplicates (UNIQUE)
  - metadata: jsonb blob
  - created_at, updated_at

  ### action_inbox_notes
  Free-text notes attached to an inbox item.
  - note_id, item_id FK, author_id, body, created_at

  ### action_inbox_state_changes
  Immutable audit log of every status transition on an inbox item.
  - change_id, item_id FK, from_status, to_status, changed_by, reason_code,
    changed_at, metadata

  ### action_inbox_projector_state
  Tracks high-water mark for the projector job so it can resume without
  re-processing already-projected events.
  - projector_id (PK text, e.g. 'default')
  - last_processed_event_id: uuid FK event_ledger (nullable on cold start)
  - last_processed_at: timestamptz
  - events_processed_count: bigint running total
  - updated_at

  ## Security
  - RLS enabled on all tables
  - SELECT: authenticated
  - No direct INSERT/UPDATE on action_inbox_items/state_changes from authenticated
  - action_inbox_notes: authenticated can INSERT (writer) but not UPDATE/DELETE
  - action_inbox_projector_state: read-only for authenticated

  ## Event Types
  Registered in event_type_registry for all inbox lifecycle events.
*/

-- =====================================================
-- action_inbox_items
-- =====================================================

CREATE TABLE IF NOT EXISTS action_inbox_items (
  item_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id        text NOT NULL REFERENCES feature_registry(feature_id),
  incident_id       uuid REFERENCES incidents(id) ON DELETE SET NULL,
  source_event_id   uuid REFERENCES event_ledger(id) ON DELETE SET NULL,
  item_type         text NOT NULL DEFAULT 'task',
  status            text NOT NULL DEFAULT 'open',
  priority          text NOT NULL DEFAULT 'medium',
  title             text NOT NULL,
  body              text NOT NULL DEFAULT '',
  reason_code       text,
  next_step_hint    text NOT NULL DEFAULT '',
  assigned_to       uuid,
  snoozed_until     timestamptz,
  resolved_at       timestamptz,
  idempotency_key   text NOT NULL,
  metadata          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT action_inbox_item_type_valid CHECK (item_type IN ('task','alert','notification','escalation')),
  CONSTRAINT action_inbox_status_valid CHECK (status IN ('open','snoozed','assigned','resolved','dismissed')),
  CONSTRAINT action_inbox_priority_valid CHECK (priority IN ('critical','high','medium','low')),
  CONSTRAINT action_inbox_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_action_inbox_items_incident ON action_inbox_items(incident_id) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_inbox_items_status ON action_inbox_items(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_inbox_items_assigned ON action_inbox_items(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_inbox_items_snoozed ON action_inbox_items(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_inbox_items_feature ON action_inbox_items(feature_id, status);

-- =====================================================
-- action_inbox_notes
-- =====================================================

CREATE TABLE IF NOT EXISTS action_inbox_notes (
  note_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES action_inbox_items(item_id) ON DELETE CASCADE,
  author_id  uuid,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT action_inbox_note_body_not_empty CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_action_inbox_notes_item ON action_inbox_notes(item_id, created_at DESC);

-- =====================================================
-- action_inbox_state_changes
-- =====================================================

CREATE TABLE IF NOT EXISTS action_inbox_state_changes (
  change_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES action_inbox_items(item_id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  changed_by  uuid,
  reason_code text,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb NOT NULL DEFAULT '{}',

  CONSTRAINT action_inbox_state_to_status_valid CHECK (to_status IN ('open','snoozed','assigned','resolved','dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_action_inbox_state_changes_item ON action_inbox_state_changes(item_id, changed_at DESC);

-- =====================================================
-- action_inbox_projector_state
-- =====================================================

CREATE TABLE IF NOT EXISTS action_inbox_projector_state (
  projector_id              text PRIMARY KEY,
  last_processed_event_id   uuid REFERENCES event_ledger(id) ON DELETE SET NULL,
  last_processed_at         timestamptz,
  events_processed_count    bigint NOT NULL DEFAULT 0,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

INSERT INTO action_inbox_projector_state (projector_id, events_processed_count)
VALUES ('default', 0)
ON CONFLICT (projector_id) DO NOTHING;

-- =====================================================
-- updated_at trigger for action_inbox_items
-- =====================================================

CREATE OR REPLACE FUNCTION update_action_inbox_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_action_inbox_items_updated_at
  BEFORE UPDATE ON action_inbox_items
  FOR EACH ROW EXECUTE FUNCTION update_action_inbox_items_updated_at();

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE action_inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_inbox_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_inbox_state_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_inbox_projector_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inbox items"
  ON action_inbox_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read inbox notes"
  ON action_inbox_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read inbox state changes"
  ON action_inbox_state_changes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read projector state"
  ON action_inbox_projector_state FOR SELECT TO authenticated USING (true);

-- =====================================================
-- Event Type Registry
-- =====================================================

INSERT INTO event_type_registry (event_type, schema_version, feature_id) VALUES
  ('inbox_item_created',        1, 'governance'),
  ('inbox_item_snoozed',        1, 'governance'),
  ('inbox_item_assigned',       1, 'governance'),
  ('inbox_item_status_changed', 1, 'governance'),
  ('inbox_note_added',          1, 'governance'),
  ('inbox_event_linked',        1, 'governance'),
  ('inbox_projector_run',       1, 'governance')
ON CONFLICT (event_type) DO NOTHING;
