# Action Inbox — Developer Reference

**Feature:** F-6.5.16 (FOCL — Founder Operational Command Layer)
**Migrations:** `20260227400002_action_inbox_tables.sql`, `20260227400003_action_inbox_rpcs.sql`
**Screen surfaces:** `FOCL_ACTION_INBOX`, `FOCL_EVENT_HISTORY`, `FOCL_EXPLAIN_AND_FIX_PANEL`

---

## Overview

The Action Inbox is a persistent, system-wide queue of actionable items derived from the `event_ledger`. It implements the **projector pattern** (Option B): a background job reads new ledger events, translates them into structured inbox items, and writes them to `action_inbox_items`. The inbox is the primary data source for the FOCL Decision Queue UI — the surface the founder uses to triage, assign, snooze, and resolve operational tasks.

No direct INSERT is permitted from authenticated sessions. Every item enters the system through the projector RPC. Every status change is written by a guarded RPC and logged to the immutable audit table.

---

## Table Reference

### 1. `action_inbox_items`

**Purpose:** The primary inbox record. Each row represents one actionable task, alert, notification, or escalation derived from one or more ledger events.

**Key fields:**

| Column | Type | Description |
|---|---|---|
| `item_id` | uuid PK | Stable identifier for this inbox item. |
| `feature_id` | text FK → feature_registry | Which platform feature sourced this item. |
| `incident_id` | uuid FK → incidents (nullable) | Linked incident, if this item is incident-scoped. Null for system-level items. |
| `source_event_id` | uuid FK → event_ledger (nullable) | The originating ledger event that caused this item to be created. |
| `item_type` | text | `task` · `alert` · `notification` · `escalation` |
| `status` | text | `open` · `snoozed` · `assigned` · `resolved` · `dismissed` |
| `priority` | text | `critical` · `high` · `medium` · `low` |
| `title` | text | Short founder-readable label. |
| `body` | text | Longer explanation. |
| `reason_code` | text (nullable) | Canonical reason code driving this item, from `reason_code_registry`. |
| `next_step_hint` | text | Pre-computed action prompt surfaced in the FOCL UI. |
| `assigned_to` | uuid (nullable) | UUID of the assignee when status = `assigned`. |
| `snoozed_until` | timestamptz (nullable) | Wake-up timestamp when status = `snoozed`. |
| `resolved_at` | timestamptz (nullable) | Set by `set_action_inbox_status` when transitioning to `resolved`. |
| `idempotency_key` | text UNIQUE | Format: `proj:<source_event_id>`. Prevents duplicate projection. |
| `metadata` | jsonb | Projector-written context. Includes `source_event_type`, `source_feature_id`, and `linked_event_ids` array (populated by `link_event_to_inbox_item`). |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger on every UPDATE. |

**Valid item_type values:** `task`, `alert`, `notification`, `escalation`

**Valid status values:** `open`, `snoozed`, `assigned`, `resolved`, `dismissed`

**Valid priority values:** `critical`, `high`, `medium`, `low`

**Indexes:**
- `(status, priority, created_at DESC)` — primary sort for the Decision Queue list view
- `(incident_id)` partial — incident-scoped item lookup
- `(assigned_to)` partial — assignee inbox view
- `(snoozed_until)` partial — wake-up scheduler
- `(feature_id, status)` — feature-filtered inbox views

**Who writes:** `run_action_inbox_projector` (SECURITY DEFINER). No authenticated direct-write policy exists.

**Who reads:** All authenticated users via SELECT RLS policy. `list_action_inbox_items` RPC is the recommended read path for the FOCL Decision Queue.

---

### 2. `action_inbox_notes`

**Purpose:** Free-text notes attached to an inbox item. Append-only — no UPDATE or DELETE policies exist for authenticated users.

**Key fields:**

| Column | Type | Description |
|---|---|---|
| `note_id` | uuid PK | |
| `item_id` | uuid FK → action_inbox_items (CASCADE DELETE) | Parent inbox item. |
| `author_id` | uuid (nullable) | Auth user who wrote the note. Null for system-generated notes. |
| `body` | text | Note text. Must be non-empty (enforced by CHECK constraint). |
| `created_at` | timestamptz | Immutable once written. |

**Index:** `(item_id, created_at DESC)` — ordered note thread per item.

**Who writes:** `add_action_inbox_note` RPC (SECURITY DEFINER). Authenticated users cannot INSERT directly.

**Who reads:** All authenticated users via SELECT RLS policy.

---

### 3. `action_inbox_state_changes`

**Purpose:** Immutable audit log of every status transition on an inbox item. One row is written for every status change, regardless of which RPC caused it. This table is never updated — rows are only inserted.

**Key fields:**

| Column | Type | Description |
|---|---|---|
| `change_id` | uuid PK | |
| `item_id` | uuid FK → action_inbox_items (CASCADE DELETE) | The item that changed. |
| `from_status` | text (nullable) | Previous status. Null only on the very first projection (unused in practice — projector sets status directly). |
| `to_status` | text | The status transitioned into. Constrained to the five valid status values. |
| `changed_by` | uuid (nullable) | Auth user who triggered the change. Null for system-originated transitions. |
| `reason_code` | text (nullable) | Why the change happened. Sourced from the RPC's `p_reason_code` parameter. |
| `changed_at` | timestamptz | Wall-clock time of the transition. |
| `metadata` | jsonb | Additional context. `assign_action_inbox_item` writes `assigned_to` here. |

**Valid to_status values:** `open`, `snoozed`, `assigned`, `resolved`, `dismissed`

**Index:** `(item_id, changed_at DESC)` — full history for one item in reverse-chronological order.

**Who writes:**
- `snooze_action_inbox_item` — writes `to_status = 'snoozed'`, `reason_code = 'snoozed_by_user'`
- `assign_action_inbox_item` — writes `to_status = 'assigned'`, `reason_code = 'assigned_by_user'`
- `set_action_inbox_status` — writes any valid status with caller-provided `reason_code`

No authenticated direct-write policy exists.

**Who reads:** All authenticated users via SELECT RLS policy.

---

### 4. `action_inbox_projector_state`

**Purpose:** Tracks the high-water mark (HWM) for the projector job. The projector reads this table at the start of each run to determine which `event_ledger` events have already been processed, then resumes from that point. This prevents re-projecting events that already produced inbox items.

**Key fields:**

| Column | Type | Description |
|---|---|---|
| `projector_id` | text PK | Named projector instance. Currently only `'default'` exists. |
| `last_processed_event_id` | uuid FK → event_ledger (nullable) | UUID of the last event successfully projected. Null on cold start. |
| `last_processed_at` | timestamptz (nullable) | `created_at` timestamp of the last processed event. Used with `last_processed_event_id` for cursor-based pagination to handle events with identical timestamps. |
| `events_processed_count` | bigint | Running total of events seen (items created + items skipped due to idempotency). Never decremented. |
| `updated_at` | timestamptz | Refreshed after every projector run that processes at least one event. |

**Seeded row:** A single `projector_id = 'default'` row with `events_processed_count = 0` is inserted at migration time.

**HWM resume logic:** The projector queries `event_ledger` for rows where `created_at > last_processed_at OR (created_at = last_processed_at AND id > last_processed_event_id)`, ordered by `(created_at ASC, id ASC)`, with a configurable `p_batch_size` limit (default 50).

**Who writes:** `run_action_inbox_projector` (SECURITY DEFINER). Updates the HWM row after each batch.

**Who reads:** All authenticated users via SELECT RLS policy. The FOCL Decision Queue can display projector health (last run time, total events processed) using direct table reads or the projector RPC response.

---

## RPC Reference

All RPCs are `SECURITY DEFINER`. All pass through `precheck_mutation_guard` before any mutation. All emit a ledger event on success. All reject unknown item IDs with `{ok: false}` rather than raising exceptions.

### `run_action_inbox_projector(p_batch_size, p_region_id, p_actor_id)`

Projects new `event_ledger` events into `action_inbox_items` using the HWM cursor in `action_inbox_projector_state`.

**Event type mapping (which ledger events produce inbox items):**

| event_type | item_type | priority |
|---|---|---|
| `incident_created` | `task` | `high` |
| `evidence_upload_staged` | `task` | `medium` |
| `routing_recommendation_generated` | `task` | `high` |
| `benefit_eval_completed` | `task` | `medium` |
| `*_suppressed` (any) | `notification` | `low` |
| `routing_recommendation_rejected` | `alert` | `high` |
| `consent_revoked` | `alert` | `high` |
| `focl_integrity_lock_marker` | `escalation` | `critical` |
| `feature_activation_changed` | `notification` | `medium` |
| All other event types | — | skipped |

Deduplicates by idempotency_key `proj:<event_id>`. Emits `inbox_projector_run` on completion regardless of batch size.

Returns: `{ok, items_created, items_skipped, last_event_id, projector_event_id}`

### `list_action_inbox_items(p_status, p_feature_id, p_incident_id, p_assigned_to, p_limit, p_offset)`

Read-only helper. All parameters are optional filters. Returns `{ok, items, limit, offset}` where `items` is a jsonb array sorted by priority (`critical` first) then `created_at DESC`. Intended as the primary data-fetch for the FOCL Decision Queue list view.

### `snooze_action_inbox_item(p_item_id, p_snoozed_until, p_actor_id, p_region_id)`

Sets `status = 'snoozed'` and `snoozed_until = p_snoozed_until`. Writes a `state_changes` row with `reason_code = 'snoozed_by_user'`. Emits `inbox_item_snoozed`.

### `assign_action_inbox_item(p_item_id, p_assign_to, p_actor_id, p_region_id)`

Sets `status = 'assigned'` and `assigned_to = p_assign_to`. Writes a `state_changes` row with `reason_code = 'assigned_by_user'` and `metadata = {assigned_to}`. Emits `inbox_item_assigned`.

### `add_action_inbox_note(p_item_id, p_body, p_actor_id, p_region_id)`

Inserts a row into `action_inbox_notes`. Validates that `p_body` is non-empty and that the parent item exists. Emits `inbox_note_added`.

### `set_action_inbox_status(p_item_id, p_new_status, p_reason_code, p_actor_id, p_region_id)`

General-purpose status transition. Accepts any of the five valid status values. Sets `resolved_at = now()` when transitioning to `resolved`. No-ops (returns `{ok: true, no_op: true}`) if the item is already in the requested status. Writes a `state_changes` row. Emits `inbox_item_status_changed` with `previous_state` and `resulting_state` populated.

### `link_event_to_inbox_item(p_item_id, p_event_id, p_actor_id, p_region_id)`

Appends `p_event_id` to the `metadata.linked_event_ids` array on the inbox item. Validates that both the item and the event_ledger entry exist. No-ops if the event is already linked. Emits `inbox_event_linked`.

---

## Event Types Registered

| event_type | Emitted by |
|---|---|
| `inbox_item_created` | (reserved — not currently emitted by projector directly) |
| `inbox_item_snoozed` | `snooze_action_inbox_item` |
| `inbox_item_assigned` | `assign_action_inbox_item` |
| `inbox_item_status_changed` | `set_action_inbox_status` |
| `inbox_note_added` | `add_action_inbox_note` |
| `inbox_event_linked` | `link_event_to_inbox_item` |
| `inbox_projector_run` | `run_action_inbox_projector` |

---

## FOCL Decision Queue — UI Integration Notes

The FOCL Decision Queue lives at screen surface `FOCL_ACTION_INBOX` (`/focl/inbox`). Required data dependency: `action_inbox_items`.

**Recommended data fetch pattern:**

```typescript
const { data } = await supabase.rpc('list_action_inbox_items', {
  p_status: 'open',
  p_limit: 50,
  p_offset: 0,
});
```

**Status filter tabs:** The UI should offer filter views for `open`, `snoozed`, `assigned` (active work), and `resolved`/`dismissed` (archive).

**Priority sort:** `list_action_inbox_items` already sorts `critical → high → medium → low` then by recency. Do not re-sort on the client.

**Explain & Fix:** Every inbox item has a `source_event_id`. Pass that to `get_explain_fix_context(source_event_id)` to populate the `FOCL_EXPLAIN_AND_FIX_PANEL` slide-over. This returns `explain_text`, `fix_hints`, `doctrine_refs`, and `rpc_context` pre-computed for the event.

**Projector health:** Read `action_inbox_projector_state` directly (it has a SELECT policy for authenticated users) to display last-run time and cumulative event count in an operational health panel.

**Governance guard:** All mutating RPCs pass through `precheck_mutation_guard`. If the platform is in a restricted operational mode, mutation RPCs return `{ok: false, error: 'Blocked by governance guard', mode: '<mode>'}`. The FOCL UI should surface this as a dismissible banner rather than a generic error, since it is expected behavior during degraded posture.

---

## Security Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `action_inbox_items` | authenticated (all rows) | SECURITY DEFINER only | SECURITY DEFINER only | — |
| `action_inbox_notes` | authenticated (all rows) | SECURITY DEFINER only | — | — |
| `action_inbox_state_changes` | authenticated (all rows) | SECURITY DEFINER only | — | — |
| `action_inbox_projector_state` | authenticated (all rows) | — | SECURITY DEFINER only | — |

No authenticated user can write to any inbox table directly. All mutations flow through named, guarded RPCs that emit ledger events.
