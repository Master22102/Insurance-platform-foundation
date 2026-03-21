export type ReadinessStatus = 'complete' | 'hardening_in_progress' | 'partial' | 'missing';

export interface ReadinessItem {
  name: string;
  doctrine: string;
  status: ReadinessStatus;
  gate: string;
  note: string;
}

export const readinessItems: ReadinessItem[] = [
  {
    name: 'Policy chain (upload -> extract -> status)',
    doctrine: '4.1 / 8.4 / 9.2',
    status: 'hardening_in_progress',
    gate: 'deterministic_e2e',
    note: 'Atomic enqueue + confidence envelope + tamper rejection are gated in E2E.',
  },
  {
    name: 'Quick Scan entitlement mutation',
    doctrine: '8.4 / 10.2',
    status: 'hardening_in_progress',
    gate: 'doctrine_contract_e2e',
    note: 'Strict credit consumption RPC now enforces emit-or-rollback.',
  },
  {
    name: 'Deep Scan credit lifecycle',
    doctrine: '10.2 / 10.3',
    status: 'hardening_in_progress',
    gate: 'scan_transitions_and_contract_e2e',
    note: 'Emit-or-rollback guards are enforced; payment/refund idempotency rails are next.',
  },
  {
    name: 'FOCL founder operational controls',
    doctrine: '12.4 / F-6.5.16 / F-6.5.7',
    status: 'partial',
    gate: 'needs_surface_completion',
    note: 'Decision queue inbox: status filter, pagination, snooze/assign/resolve/dismiss wired to RPCs; adversarial cadence + full FOCL matrix still expanding.',
  },
];

export function readinessSummary(items: ReadinessItem[]) {
  const total = items.length;
  const complete = items.filter((i) => i.status === 'complete').length;
  const hardening = items.filter((i) => i.status === 'hardening_in_progress').length;
  const partial = items.filter((i) => i.status === 'partial').length;
  const missing = items.filter((i) => i.status === 'missing').length;
  return { total, complete, hardening, partial, missing };
}
