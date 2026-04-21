# Claim Routing Engine Usage Guide

## Overview

The Claim Routing Engine aligns incidents against coverage graphs to determine structural alignment, evaluates causality with dual-branch logic when uncertain, and produces sequenced guidance for claim submission.

## Architecture

The routing engine follows these steps:

1. **Governance Guard** - Calls `precheck_mutation_guard()` to ensure routing is allowed
2. **Load Context** - Retrieves incident, trip, and coverage graph snapshot
3. **Structural Alignment** - Maps incident to coverage nodes by benefit type
4. **Dual-Branch Evaluation** - If causality is UNKNOWN, creates two ITR branches
5. **ITR Creation** - Records interpretive trace for audit
6. **Guidance Generation** - Produces step-by-step instructions with clause references
7. **Trip Maturity Advancement** - Moves trip to `CLAIM_ROUTING_LOCKED` state
8. **Event Emission** - Emits `claim_routing_complete` event

## Structural Alignment Categories

- **ALIGNED** - Incident directly maps to coverage node with no exclusions
- **CONDITIONAL** - Incident maps but policy has exclusions that may apply
- **EXCLUDED** - Incident explicitly excluded by policy terms
- **AMBIGUOUS** - Multiple overlapping policies create coordination-of-benefits scenario
- **INSUFFICIENT_DATA** - Cannot determine alignment (missing data or no matching coverage)

## Dual-Branch Causality Evaluation

When `causality_status = UNKNOWN`, the engine creates two evaluation branches:

- **branch_a** - Assumes causality can be CONFIRMED (optimistic path)
  - Alignment based on coverage graph matching
  - Guidance includes evidence requirements to prove causality

- **branch_b** - Assumes causality is DISPUTED (pessimistic path)
  - Alignment forced to EXCLUDED
  - Guidance warns claim will likely be denied without proof

The `active_user_presented_path` indicates which branch to show the user by default (typically branch_a).

## Function Signatures

### advance_trip_maturity()

```sql
advance_trip_maturity(
  p_trip_id          uuid,
  p_target_state     trip_maturity_state,
  p_actor_id         uuid    DEFAULT NULL,
  p_reason_code      text    DEFAULT NULL,
  p_idempotency_key  text    DEFAULT NULL,
  p_region_id        uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id       text    DEFAULT 'trips'
)
RETURNS jsonb
```

### route_claim()

```sql
route_claim(
  p_incident_id      uuid,
  p_actor_id         uuid,
  p_idempotency_key  text    DEFAULT NULL,
  p_region_id        uuid    DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  p_feature_id       text    DEFAULT 'claims'
)
RETURNS jsonb
```

## Usage Examples

### TypeScript/JavaScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Step 1: Ensure coverage graph exists
const { data: graphData } = await supabase.rpc('compute_coverage_graph', {
  p_trip_id: tripId,
  p_actor_id: userId
});

if (!graphData?.ok) {
  console.error('Coverage graph computation failed:', graphData);
  return;
}

// Step 2: Route the claim
const { data: routingData } = await supabase.rpc('route_claim', {
  p_incident_id: incidentId,
  p_actor_id: userId,
  p_idempotency_key: `claim-routing-${incidentId}`
});

if (routingData?.success) {
  console.log('Claim routing complete!');
  console.log('Alignment:', routingData.alignment_category);
  console.log('Confidence:', routingData.alignment_confidence);
  console.log('Guidance steps:', routingData.guidance_steps);

  if (routingData.has_dual_branches) {
    console.log('Dual-branch evaluation created');
    console.log('Active path:', routingData.active_path);
    console.log('Note: Causality uncertain - gather proof of causality');
  }
} else {
  console.error('Routing failed:', routingData?.error);
}
```

### SQL Direct Call

```sql
-- Route a claim with known causality
SELECT route_claim(
  p_incident_id := '550e8400-e29b-41d4-a716-446655440000'::uuid,
  p_actor_id := auth.uid()
);

-- With idempotency key
SELECT route_claim(
  p_incident_id := '550e8400-e29b-41d4-a716-446655440000'::uuid,
  p_actor_id := auth.uid(),
  p_idempotency_key := 'routing-2026-03-05-001'
);
```

### Manually Advance Trip Maturity

```typescript
// Advance trip to next state
const { data } = await supabase.rpc('advance_trip_maturity', {
  p_trip_id: tripId,
  p_target_state: 'DOCUMENTATION_IN_PROGRESS',
  p_actor_id: userId,
  p_reason_code: 'evidence_collection_started'
});

if (data?.success) {
  console.log('Trip advanced from', data.previous_state, 'to', data.new_state);
}
```

## Return Values

### route_claim() Success

```json
{
  "success": true,
  "routing_id": "uuid",
  "incident_id": "uuid",
  "trip_id": "uuid",
  "alignment_category": "ALIGNED",
  "matched_benefit_type": "medical_expense",
  "alignment_confidence": "high",
  "has_dual_branches": false,
  "active_path": "single",
  "guidance_steps": [
    {
      "step": 1,
      "action": "Review coverage trigger clause",
      "clause_id": "uuid",
      "benefit_type": "medical_expense"
    },
    {
      "step": 2,
      "action": "Gather supporting documentation",
      "required_evidence": ["medical_records", "receipts", "diagnosis"]
    },
    {
      "step": 3,
      "action": "Complete claim form",
      "form_type": "standard_claim_form"
    },
    {
      "step": 4,
      "action": "Submit to carrier",
      "note": "Coverage appears aligned with your incident."
    }
  ],
  "trip_maturity_advanced_to": "CLAIM_ROUTING_LOCKED",
  "event_id": "uuid",
  "idempotent": false
}
```

### route_claim() with Dual Branches

```json
{
  "success": true,
  "routing_id": "uuid",
  "alignment_category": "ALIGNED",
  "has_dual_branches": true,
  "active_path": "branch_a",
  "guidance_steps": [...],
  "trip_maturity_advanced_to": "CLAIM_ROUTING_LOCKED"
}
```

### Governance Blocked

```json
{
  "success": false,
  "error": "Blocked by governance guard",
  "mode": "LOCKDOWN",
  "mutation_class": "claim_routing"
}
```

## Workflow Integration

### Complete Claim Routing Flow

```typescript
async function routeClaimForIncident(incidentId: string, userId: string) {
  // 1. Get incident details
  const { data: incident } = await supabase
    .from('incidents')
    .select('*, trips(*)')
    .eq('id', incidentId)
    .maybeSingle();

  if (!incident) {
    throw new Error('Incident not found');
  }

  // 2. Ensure coverage graph exists
  const { data: graphResult } = await supabase.rpc('compute_coverage_graph', {
    p_trip_id: incident.trips.trip_id,
    p_actor_id: userId
  });

  if (!graphResult?.ok) {
    throw new Error(`Coverage graph error: ${graphResult?.reason}`);
  }

  // 3. Route the claim
  const { data: routing } = await supabase.rpc('route_claim', {
    p_incident_id: incidentId,
    p_actor_id: userId
  });

  if (!routing?.success) {
    throw new Error(`Routing failed: ${routing?.error}`);
  }

  // 4. Present guidance to user
  return {
    alignmentCategory: routing.alignment_category,
    confidence: routing.alignment_confidence,
    steps: routing.guidance_steps,
    hasDualBranches: routing.has_dual_branches,
    activePath: routing.active_path
  };
}
```

## Database Schema

### claim_routing_decisions Table

```sql
CREATE TABLE claim_routing_decisions (
  routing_id uuid PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES incidents(id),
  trip_id uuid NOT NULL REFERENCES trips(trip_id),
  snapshot_id uuid NOT NULL REFERENCES coverage_graph_snapshots(snapshot_id),

  structural_alignment_category text NOT NULL,
  matched_node_id uuid REFERENCES coverage_nodes(node_id),
  matched_benefit_type text,
  alignment_confidence text,

  causality_status text NOT NULL,
  has_dual_branches boolean NOT NULL DEFAULT false,
  branch_a_itr_id uuid REFERENCES interpretive_trace_records(trace_id),
  branch_b_itr_id uuid REFERENCES interpretive_trace_records(trace_id),
  active_user_presented_path text,

  guidance_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  referenced_clause_ids uuid[],

  routing_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## Event Emission

Every routing operation emits multiple events:

1. **claim_routing_started** - When routing begins
2. **structural_alignment_determined** - After alignment analysis
3. **dual_branch_evaluation_created** (optional) - If causality is UNKNOWN
4. **trip_maturity_advanced** - When trip state changes
5. **claim_routing_complete** - Final routing success event

## Querying Routing Decisions

```typescript
// Get routing decision for an incident
const { data: routing } = await supabase
  .from('claim_routing_decisions')
  .select(`
    *,
    incidents(*),
    coverage_nodes(*)
  `)
  .eq('incident_id', incidentId)
  .maybeSingle();

// Get all guidance steps
const steps = routing.guidance_steps;
steps.forEach(step => {
  console.log(`Step ${step.step}: ${step.action}`);
});

// Check if dual branches exist
if (routing.has_dual_branches) {
  console.log('Causality is uncertain');
  console.log('Branch A ITR:', routing.branch_a_itr_id);
  console.log('Branch B ITR:', routing.branch_b_itr_id);
}
```

## Alignment Algorithm

The current implementation uses simple heuristic mapping:

- `disruption_type: medical_event` → `benefit_type: medical_expense`
- `disruption_type: trip_cancellation` → `benefit_type: trip_cancellation`
- Selects node with highest primacy (earliest effective_date)
- Checks for exclusions in matched node
- Detects overlaps from coverage_node.overlap_flags

Production implementations would use:
- ML models trained on claims data
- Complex rules engines with jurisdiction-specific logic
- Natural language processing of policy text
- Historical claims outcome analysis

## Security

- **SECURITY DEFINER** - Both RPCs run with postgres privileges
- **RLS Enabled** - claim_routing_decisions enforces user ownership via trips
- **Governance Guards** - All mutations check regional operational mode
- **Audit Trail** - Every routing creates ITR records and event_ledger entries
- **Idempotency** - Safe to retry with same idempotency_key

## Error Handling

```typescript
try {
  const { data, error } = await supabase.rpc('route_claim', {
    p_incident_id: incidentId,
    p_actor_id: userId
  });

  if (error) throw error;

  if (!data.success) {
    switch (data.error) {
      case 'Blocked by governance guard':
        // System in DEGRADED/LOCKDOWN mode
        showMaintenanceMessage();
        break;
      case 'No coverage graph snapshot found for trip':
        // Need to compute graph first
        await computeCoverageGraph(tripId);
        break;
      case 'incident not found':
        showErrorMessage('Incident not found');
        break;
      default:
        showErrorMessage(data.error);
    }
  }
} catch (err) {
  console.error('Routing RPC failed:', err);
  showErrorMessage('System error during routing');
}
```

## Testing

See test files:
- `lib/test-prewire.sql` - Feature activation testing
- `lib/test-rollout.sql` - Rollout testing with claim routing
- `lib/test-stress.sql` - Load testing with multiple claims

## Related Functions

- `create_incident()` - Create incident to route
- `compute_coverage_graph()` - Generate coverage graph before routing
- `register_evidence()` - Attach evidence after routing
- `advance_trip_maturity()` - Manually advance trip state
