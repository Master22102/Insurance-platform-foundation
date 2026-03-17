# create_trip() RPC Usage Guide

## Overview

The `create_trip()` RPC is the **only** legal write path for creating trips in the system. Direct INSERTs via RLS are blocked. This ensures all trip creation goes through governance checks and emits proper audit events.

## Architecture Pattern

Follows the same governance substrate pattern as `create_incident()`:

1. **Idempotency Check** - Returns existing trip_id if idempotency_key matches
2. **Governance Guard** - Calls `precheck_mutation_guard()` to check region mode
3. **Validation** - Ensures required fields are present and valid
4. **Insert** - Creates the trips row
5. **Event Emission** - Emits `trip_created` event via `emit_event()`
6. **Rollback on Failure** - Full transaction rollback if event emission fails

## Function Signature

```sql
create_trip(
  p_trip_name            text,                    -- REQUIRED
  p_account_id           uuid,                    -- REQUIRED
  p_maturity_state       trip_maturity_state DEFAULT 'DRAFT',
  p_jurisdiction_ids     uuid[]              DEFAULT '{}',
  p_travel_mode_primary  text                DEFAULT 'air',
  p_is_group_trip        boolean             DEFAULT false,
  p_group_id             uuid                DEFAULT NULL,
  p_metadata             jsonb               DEFAULT '{}'::jsonb,
  p_actor_id             uuid                DEFAULT NULL,
  p_idempotency_key      text                DEFAULT NULL,
  p_region_id            uuid                DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id           text                DEFAULT 'trips'
)
RETURNS jsonb
```

## Return Value

Success:
```json
{
  "success": true,
  "trip_id": "uuid",
  "event_id": "uuid",
  "idempotent": false
}
```

Idempotent (already exists):
```json
{
  "success": true,
  "trip_id": "uuid",
  "idempotent": true
}
```

Blocked by governance:
```json
{
  "success": false,
  "error": "Blocked by governance guard",
  "mode": "LOCKDOWN",
  "mutation_class": "trip_create",
  "guard_details": { ... }
}
```

Validation error:
```json
{
  "success": false,
  "error": "trip_name is required"
}
```

## Usage Examples

### Basic Trip Creation (TypeScript/JavaScript)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Create trip
const { data, error } = await supabase.rpc('create_trip', {
  p_trip_name: 'Summer Europe Adventure 2026',
  p_account_id: user.id,
  p_maturity_state: 'DRAFT',
  p_jurisdiction_ids: [], // Will be filled after itinerary planning
  p_travel_mode_primary: 'air',
  p_is_group_trip: false
});

if (data?.success) {
  console.log('Trip created:', data.trip_id);
} else {
  console.error('Trip creation failed:', data?.error || error);
}
```

### With Idempotency Key

```typescript
const idempotencyKey = `trip-create-${Date.now()}-${user.id}`;

const { data } = await supabase.rpc('create_trip', {
  p_trip_name: 'Business Trip NYC',
  p_account_id: user.id,
  p_idempotency_key: idempotencyKey
});

if (data?.idempotent) {
  console.log('Trip already exists:', data.trip_id);
} else if (data?.success) {
  console.log('New trip created:', data.trip_id);
}
```

### Group Trip with Jurisdictions

```typescript
const jurisdictionIds = [
  '550e8400-e29b-41d4-a716-446655440000', // France
  '550e8400-e29b-41d4-a716-446655440001', // Italy
  '550e8400-e29b-41d4-a716-446655440002'  // Spain
];

const { data } = await supabase.rpc('create_trip', {
  p_trip_name: 'Family European Tour',
  p_account_id: user.id,
  p_maturity_state: 'DRAFT',
  p_jurisdiction_ids: jurisdictionIds,
  p_travel_mode_primary: 'rail',
  p_is_group_trip: true,
  p_group_id: groupId,
  p_metadata: {
    group_size: 6,
    age_range: 'multi_generational',
    special_needs: ['wheelchair_accessible']
  }
});
```

### SQL Direct Call

```sql
SELECT create_trip(
  p_trip_name := 'Weekend Getaway',
  p_account_id := auth.uid(),
  p_maturity_state := 'DRAFT',
  p_travel_mode_primary := 'car',
  p_actor_id := auth.uid()
);
```

## Maturity States

Valid `trip_maturity_state` values:

- `DRAFT` - Trip planning in progress
- `PRE_TRIP_STRUCTURED` - Itinerary locked, ready for travel
- `INCIDENT_OPEN` - Active incident during trip
- `DOCUMENTATION_IN_PROGRESS` - Gathering evidence post-incident
- `CLAIM_ROUTING_LOCKED` - Coverage determined, ready to file
- `CLAIM_SUBMITTED` - Claim filed with provider
- `POST_TRIP_RESOLVED` - Claim settled
- `ARCHIVED` - Trip archived

## Event Emission

Every successful trip creation emits a `trip_created` event to the event_ledger:

```json
{
  "event_type": "trip_created",
  "scope_type": "trip",
  "scope_id": "<trip_id>",
  "actor_type": "user",
  "reason_code": "trip_create",
  "resulting_state": {
    "trip_id": "<uuid>",
    "maturity_state": "DRAFT",
    "jurisdiction_ids": []
  },
  "metadata": {
    "trip_id": "<uuid>",
    "trip_name": "...",
    "travel_mode_primary": "air",
    "is_group_trip": false,
    "group_id": null
  }
}
```

## Governance Integration

The function calls `precheck_mutation_guard()` which checks:

- **OPERATIONAL** mode: ✅ Allows trip creation
- **DEGRADED** mode: ❌ Blocks trip creation
- **LOCKDOWN** mode: ❌ Blocks trip creation

This ensures trips cannot be created during system maintenance or incidents.

## Security

- **SECURITY DEFINER**: Runs with postgres privileges
- **RLS Bypass**: Direct INSERTs blocked via removed policies
- **Authentication**: Granted to `authenticated` role only
- **Validation**: Enforces account_id exists in auth.users
- **Audit Trail**: All operations logged via event_ledger

## Migration from Direct INSERT

### Before (❌ No longer works)

```typescript
// This will FAIL - RLS policy removed
const { data, error } = await supabase
  .from('trips')
  .insert({
    trip_name: 'My Trip',
    created_by: user.id
  });
```

### After (✅ Correct way)

```typescript
// Use RPC instead
const { data, error } = await supabase.rpc('create_trip', {
  p_trip_name: 'My Trip',
  p_account_id: user.id
});
```

## Related Functions

- `create_incident()` - Create incident for a trip (uses trip_id, not project_id)
- `register_evidence()` - Attach evidence to incident
- `compute_coverage_graph()` - Compute coverage for trip

## Testing

See test files:
- `lib/test-prewire.sql` - Feature activation testing
- `lib/test-rollout.sql` - Rollout testing with trip creation
- `lib/test-stress.sql` - Load testing with multiple trips
