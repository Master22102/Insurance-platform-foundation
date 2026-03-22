# Business Logic Module

## Overview

`/lib/business-logic.ts` is the **single source of truth** for all state machine rules and state transitions in the reliability orchestration system.

**Scope note:** This module covers **orchestration / incident status** patterns used by the app. **Claim routing v2** (coverage graph + `route_claim`) lives in **Postgres** and is documented in **`lib/CLAIM_ROUTING_ENGINE_USAGE.md`** with product wiring status in **`docs/CORE_PIPELINE_STATUS.md`**. Do not assume every transition here matches the routing engine’s maturity rules without checking migrations.

**Critical Design Principles:**
- All state transitions are **transactional** (state update + event_logs insert succeed or fail together)
- API routes **MUST** call functions from this module and **MUST NOT** duplicate rules
- All rolling-window metrics are computed from `event_logs` (no stored counters)
- Transaction guarantees provided by Postgres RPC functions

## Architecture

### Transaction Strategy

We use **Postgres RPC functions** (Option A) to guarantee atomicity:

1. Each state transition has a corresponding Postgres function
2. Functions use `BEGIN...EXCEPTION...END` blocks for transactions
3. State updates and event logging execute atomically within each function
4. TypeScript layer wraps RPC calls with type-safe interfaces

**Why RPC Functions?**
- Supabase JS client doesn't support explicit transactions
- Postgres functions guarantee atomicity at the database level
- Reduces network round-trips (single RPC call vs multiple queries)
- Business rules enforced in database layer (portable, can't be bypassed)

## Database Functions

RPCs evolve across **`supabase/migrations/`** (and bundled SQL). The filename **`00002_business_logic_functions.sql`** is **historical** in this doc; search migrations for the function name you need.

### Helper Functions

#### `get_connector_failures_24h(connector_id, failure_code_filter?)`
- Computes rolling 24-hour failure count from event_logs
- Optional filter by specific failure_code
- Used by auto-downgrade rules

### Core Business Logic Functions

#### `change_incident_status(incident_id, new_status, actor_id)`
**Rule A: Capture → Action requires evidence**

Transaction:
1. Check if incident exists
2. Validate: If Capture → Action, require evidence.count > 0
3. Update `incidents.status`
4. Insert `event_logs` with event_type='status_changed'

#### `change_connector_state(connector_id, new_state, actor_id)`
**Rule B: ManualOnly → Enabled requires manual review approval**

Transaction:
1. Check if connector exists
2. Validate: If ManualOnly → Enabled, require `manual_review_approved` event exists
3. Update `connectors.state`
4. Insert `event_logs` with event_type='state_changed'

#### `approve_connector_manual_review(connector_id, actor_id)`
Creates `manual_review_approved` event in event_logs.
Required before a connector can transition from ManualOnly → Enabled.

#### `log_connector_failure(connector_id, failure_code, actor_id, error_details?)`
**Rule C: Auto-downgrade based on rolling 24-hour failure counts**

Transaction:
1. Insert `event_logs` with event_type='connector_failure' and failure_code
2. Query failure counts from event_logs (rolling 24h window)
3. Update `connectors.failure_count_24h`
4. Apply downgrade rules:
   - **3+ structure_changed failures in 24h** → ManualOnly
   - **10+ total failures in 24h + state=Enabled** → Degraded
5. If downgraded, insert additional event_logs entry with auto_downgrade event

#### `run_connector_health_check_job(actor_id?)`
Batch job that processes all Enabled/Degraded connectors:
1. Recalculate failure counts from event_logs
2. Update `failure_count_24h` fields
3. Apply auto-downgrade rules to all connectors
4. Log auto-downgrade events

Designed for scheduled execution (cron or script runner).

## TypeScript API

### Exported Functions

```typescript
// Incident state transitions
changeIncidentStatus(incidentId: string, newStatus: IncidentStatus, actorId: string)
  → Promise<IncidentStatusChangeResult>

// Connector state transitions
changeConnectorState(connectorId: string, newState: ConnectorState, actorId: string)
  → Promise<ConnectorStateChangeResult>

// Connector manual review
approveConnectorManualReview(connectorId: string, actorId: string)
  → Promise<BusinessResult>

// Connector failure logging with auto-downgrade
logConnectorFailure(connectorId: string, failureCode: FailureCode, actorId: string, errorDetails?: string)
  → Promise<ConnectorFailureResult>

// Health check job (scheduled execution)
runConnectorHealthCheckJob(actorId?: string)
  → Promise<HealthCheckResult>
```

### Return Types

All functions return structured results with calm, non-alarmist error messages:

```typescript
type BusinessResult<T> = {
  success: boolean;
  error?: string;
  data?: T;
}
```

### Error Handling

- Database errors are caught and wrapped with context
- Validation failures return `success: false` with clear error messages
- No exceptions thrown (all errors returned as results)
- Error messages are user-friendly, not technical stack traces

## State Machine Rules

### Incidents: Capture → Review → Action

**Status Flow:**
- `Capture`: Initial state, gathering information
- `Review`: Under review, analyzing
- `Action`: Taking action, requires evidence

**Rule A: Evidence Requirement**
- Cannot transition from `Capture` to `Action` without evidence
- Evidence table must have at least 1 row for the incident
- Other transitions (Capture→Review, Review→Action with evidence) are allowed

### Connectors: Enabled ↔ Degraded ↔ ManualOnly ↔ UnderReview

**State Meanings:**
- `Enabled`: Fully operational, automatic sync enabled
- `Degraded`: Operational but experiencing issues (10+ failures in 24h)
- `ManualOnly`: Automatic sync disabled, requires manual intervention (3+ structure failures)
- `UnderReview`: Under investigation or approval

**Rule B: Manual Review Gate**
- ManualOnly → Enabled requires `manual_review_approved` event
- Use `approveConnectorManualReview()` to create approval event
- Prevents re-enabling problematic connectors without review

**Rule C: Auto-Downgrade Thresholds**

Computed from `event_logs.created_at` (rolling 24-hour window):

| Threshold | Current State | Target State | Event Type |
|-----------|---------------|--------------|------------|
| 3+ structure_changed failures | Any except ManualOnly | ManualOnly | auto_downgrade_to_manual_only |
| 10+ total failures | Enabled | Degraded | auto_downgrade_to_degraded |

Auto-downgrades are logged with:
- `actor_type = 'system'`
- Metadata includes: reason, failure counts, threshold, from/to states

## Event Logs

All state transitions create immutable audit trail entries in `event_logs`:

### Status Changed Events
```json
{
  "related_entity_type": "incident",
  "related_entity_id": "<incident_id>",
  "event_type": "status_changed",
  "metadata": {
    "from": "Capture",
    "to": "Action"
  }
}
```

### State Changed Events
```json
{
  "related_entity_type": "connector",
  "related_entity_id": "<connector_id>",
  "event_type": "state_changed",
  "metadata": {
    "from": "Enabled",
    "to": "Degraded"
  }
}
```

### Failure Events
```json
{
  "related_entity_type": "connector",
  "related_entity_id": "<connector_id>",
  "event_type": "connector_failure",
  "failure_code": "structure_changed",
  "metadata": {
    "error_details": "API schema version mismatch",
    "failure_code": "structure_changed"
  }
}
```

### Auto-Downgrade Events
```json
{
  "related_entity_type": "connector",
  "related_entity_id": "<connector_id>",
  "event_type": "auto_downgrade_to_manual_only",
  "actor_type": "system",
  "metadata": {
    "reason": "structure_changed failures exceeded threshold",
    "structure_failures_24h": 5,
    "threshold": 3,
    "from": "Enabled",
    "to": "ManualOnly"
  }
}
```

## Usage Examples

### Change Incident Status

```typescript
import { changeIncidentStatus } from '@/lib/business-logic';

const result = await changeIncidentStatus(
  'incident-uuid',
  'Action',
  'user-uuid'
);

if (result.success) {
  console.log(`Status changed from ${result.data.from} to ${result.data.to}`);
} else {
  console.error(result.error);
  // "Cannot move to Action status without evidence"
}
```

### Log Connector Failure (with auto-downgrade)

```typescript
import { logConnectorFailure } from '@/lib/business-logic';

const result = await logConnectorFailure(
  'connector-uuid',
  'structure_changed',
  'system-uuid',
  'API schema version mismatch detected'
);

if (result.success) {
  console.log(`Failure logged. Total: ${result.data.total_failures_24h}`);

  if (result.data.state_changed) {
    console.log(`Auto-downgraded: ${result.data.previous_state} → ${result.data.current_state}`);
    console.log(`Reason: ${result.data.downgrade_reason}`);
  }
}
```

### Approve Connector for Re-enabling

```typescript
import { approveConnectorManualReview, changeConnectorState } from '@/lib/business-logic';

// Step 1: Approve manual review
const approval = await approveConnectorManualReview('connector-uuid', 'admin-uuid');

if (approval.success) {
  // Step 2: Re-enable connector (now allowed)
  const stateChange = await changeConnectorState('connector-uuid', 'Enabled', 'admin-uuid');

  if (stateChange.success) {
    console.log('Connector re-enabled after manual review');
  }
}
```

### Run Scheduled Health Check

```typescript
import { runConnectorHealthCheckJob } from '@/lib/business-logic';

// Mode A: Script runner
const result = await runConnectorHealthCheckJob();

// Mode B: HTTP cron endpoint
const result = await runConnectorHealthCheckJob('cron-system-uuid');

if (result.success) {
  console.log(`Processed ${result.data.processed_count} connectors`);
  console.log(`Downgraded ${result.data.downgraded_count} connectors`);
}
```

## API Route Pattern

API routes should be thin wrappers that:
1. Parse/validate request
2. Call business logic function
3. Return formatted response

**DO NOT duplicate business rules in API routes.**

Example:
```typescript
// app/api/incidents/[id]/status/route.ts
import { changeIncidentStatus } from '@/lib/business-logic';

export async function POST(req: Request) {
  const { newStatus, actorId } = await req.json();
  const incidentId = req.url.split('/')[5];

  const result = await changeIncidentStatus(incidentId, newStatus, actorId);

  return Response.json(result, {
    status: result.success ? 200 : 400
  });
}
```

## Testing Notes

When testing business logic:
1. Test validation rules (evidence check, manual review requirement)
2. Test transaction atomicity (state + event_logs together)
3. Test auto-downgrade thresholds with time-based event_logs
4. Test error handling and result structures
5. Verify event_logs immutability (no UPDATE/DELETE)

## Performance Considerations

- `get_connector_failures_24h()` queries event_logs with time-window filter (indexed)
- Health check job processes all connectors in batch (suitable for cron)
- Event_logs indexed on: `(related_entity_type, related_entity_id, created_at)`
- For high-frequency failure logging, consider batching or queueing

## Migration Notes

- Migration `00001_initial_schema.sql`: Tables, enums, indexes, RLS
- Migration `00002_business_logic_functions.sql`: RPC functions for transactions
- All business rules live in database layer (portable, version-controlled)
