export type DecisionPosture = 'direct' | 'conditional' | 'protected';
export type DecisionConfidence = 'high' | 'medium' | 'low';

export interface DecisionGuidance {
  posture: DecisionPosture;
  confidence: DecisionConfidence;
  what_applies: string;
  why_it_applies: string;
  next_steps: string[];
  evidence_checklist: string[];
  sequencing_notes: string[];
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

// Shared, deterministic posture mapping so Quick Scan / Claim Routing
// present the same "language of decisions" across surfaces.
export function deriveDecisionGuidance(input: {
  acceptedCompensation?: string;
  causeClassification?: string;
  recipientType?: string;
  amount?: number;
  actionPlan?: string[];
  documentationHints?: string[];
  claimRouting?: string[];
  strongestRuleLabel?: string;
}): DecisionGuidance {
  const acceptedComp = (input.acceptedCompensation || 'none').toLowerCase();
  const cause = (input.causeClassification || '').toLowerCase();
  const recipient = (input.recipientType || '').toLowerCase();
  const amount = Number(input.amount || 0);

  const conditionalCause =
    cause === 'shared_or_ambiguous' ||
    cause === 'external_or_systemic';
  const protectedCause = cause === 'user_or_itinerary';
  const acceptedSomething = acceptedComp !== 'none' && acceptedComp.length > 0;
  const longTermPolicy = recipient === 'home_or_renter' || recipient === 'travel_insurer';
  const smallClaimBand = amount > 0 && amount <= 300 && longTermPolicy;

  let posture: DecisionPosture = 'direct';
  if (protectedCause || smallClaimBand) posture = 'protected';
  else if (conditionalCause || acceptedSomething) posture = 'conditional';

  const confidence: DecisionConfidence =
    posture === 'direct' ? 'high' : posture === 'conditional' ? 'medium' : 'low';

  const strongestRule = input.strongestRuleLabel || 'coverage rule';
  const whatApplies =
    posture === 'direct'
      ? `${strongestRule} applies under current incident assumptions.`
      : posture === 'conditional'
        ? `${strongestRule} may apply, depending on sequencing and final carrier/provider classification.`
        : `${strongestRule} has constraints that reduce structural clarity about documented benefits until sequencing and evidence are complete.`;

  const whyItApplies =
    posture === 'direct'
      ? 'Policy signals and incident context are aligned without major conflicts.'
      : posture === 'conditional'
        ? 'There are dependency factors (accepted compensation and/or ambiguous cause) that can change downstream evaluations.'
        : 'Small-claim tradeoffs or causality constraints increase uncertainty and require extra care before filing.';

  const sequencingNotes = [...(input.claimRouting || [])];
  if (acceptedSomething) {
    sequencingNotes.push('Accepted carrier compensation can change how remaining loss is evaluated by downstream providers.');
  }
  if (smallClaimBand) {
    sequencingNotes.push('This appears to be a small claim against a long-term policy; consider long-horizon tradeoffs before filing.');
  }
  if (sequencingNotes.length === 0) {
    sequencingNotes.push('Document first, then route in an order that preserves your broadest recovery path.');
  }

  const nextSteps = [...(input.actionPlan || [])];
  if (nextSteps.length === 0) {
    nextSteps.push('Capture evidence now, then proceed with structured routing.');
  }

  const evidenceChecklist = [...(input.documentationHints || [])];
  if (evidenceChecklist.length === 0) {
    evidenceChecklist.push('Itemized receipts');
    evidenceChecklist.push('Carrier disruption notice');
    evidenceChecklist.push('Booking confirmation/itinerary');
  }

  return {
    posture,
    confidence,
    what_applies: whatApplies,
    why_it_applies: whyItApplies,
    next_steps: nextSteps.slice(0, 6),
    evidence_checklist: evidenceChecklist.slice(0, 6),
    sequencing_notes: sequencingNotes.slice(0, 6),
  };
}

export function postureLabel(posture: DecisionPosture): string {
  if (posture === 'direct') return 'Direct guidance';
  if (posture === 'conditional') return 'Conditional guidance';
  return 'Protected guidance';
}

export function postureColor(posture: DecisionPosture): string {
  if (posture === 'direct') return '#16a34a';
  if (posture === 'conditional') return '#d97706';
  return '#475569';
}

export function inferStrongestRuleLabel(clauseType?: string): string {
  if (!clauseType) return 'Coverage rule';
  const c = clauseType.toLowerCase();
  if (hasAny(c, ['delay'])) return 'Trip-delay terms';
  if (hasAny(c, ['cancellation'])) return 'Cancellation terms';
  if (hasAny(c, ['payment', 'card'])) return 'Payment-eligibility terms';
  if (hasAny(c, ['medical'])) return 'Medical terms';
  if (hasAny(c, ['liability'])) return 'Liability terms';
  return clauseType.replace(/_/g, ' ');
}

