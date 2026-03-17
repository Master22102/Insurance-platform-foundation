import { ClauseCandidate, ClauseType, ConfidenceTier, ExtractedValue } from './types';

const REQUIREMENT_CLAUSE_TYPES = new Set<ClauseType>([
  'round_trip_requirement',
  'common_carrier_requirement',
  'payment_method_requirement',
  'refund_eligibility_rule',
  'requires_receipts',
  'requires_police_report',
  'requires_medical_certificate',
  'requires_carrier_delay_letter',
  'requires_baggage_pir',
  'requires_itinerary',
  'requires_payment_proof',
]);

const NEGATION_MARKERS = [
  'not required', 'no requirement', 'not necessary', 'not needed',
  'waived', 'exempt', 'does not require', 'not applicable',
  'need not', 'not obligated', 'not mandatory',
];

const SCOPE_DISCRIMINATORS: Array<[string, string]> = [
  ['domestic', 'international'],
  ['economy', 'business'],
  ['economy', 'first class'],
  ['business', 'first class'],
  ['checked baggage', 'carry on'],
  ['carry-on', 'checked'],
  ['adult', 'child'],
  ['infant', 'adult'],
  ['member', 'non-member'],
  ['elite', 'standard'],
  ['advance', 'same day'],
  ['online', 'in person'],
  ['voluntary', 'involuntary'],
  ['cancellation', 'interruption'],
  ['direct', 'connecting'],
  ['refundable', 'non-refundable'],
];

const EXCEPTION_MARKERS = [
  'except', 'unless', 'excluding', 'does not apply',
  'not applicable', 'other than', 'but not', 'notwithstanding',
  'save for', 'subject to',
];

function extractNumericValue(value: ExtractedValue): number | null {
  if (typeof value.value === 'number') return value.value;
  if (typeof value.value === 'string') {
    const parsed = parseFloat(value.value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function valuesAreSimilar(v1: ExtractedValue, v2: ExtractedValue): boolean {
  if (v1.type !== v2.type) return false;
  if (v1.type === 'boolean') return v1.value === v2.value;

  const num1 = extractNumericValue(v1);
  const num2 = extractNumericValue(v2);
  if (num1 !== null && num2 !== null) {
    const tolerance = Math.max(num1, num2) * 0.05;
    return Math.abs(num1 - num2) <= tolerance;
  }

  if (v1.type === 'text_rule' || v1.type === 'text') {
    const str1 = String(v1.value).toLowerCase().trim();
    const str2 = String(v2.value).toLowerCase().trim();
    if (str1 === str2) return true;
    if (str1.includes(str2) || str2.includes(str1)) return true;
    return false;
  }

  return String(v1.value).toLowerCase() === String(v2.value).toLowerCase();
}

function hasDistinctScope(text1: string, text2: string): boolean {
  const lower1 = text1.toLowerCase();
  const lower2 = text2.toLowerCase();
  for (const [a, b] of SCOPE_DISCRIMINATORS) {
    const has1A = lower1.includes(a);
    const has1B = lower1.includes(b);
    const has2A = lower2.includes(a);
    const has2B = lower2.includes(b);
    if (has1A && has2B && !has1B && !has2A) return true;
    if (has1B && has2A && !has1A && !has2B) return true;
  }
  return false;
}

function hasExceptionLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return EXCEPTION_MARKERS.some(marker => lower.includes(marker));
}

function hasNegation(text: string): boolean {
  const lower = text.toLowerCase();
  return NEGATION_MARKERS.some(marker => lower.includes(marker));
}

function isTrueConflict(c1: ClauseCandidate, c2: ClauseCandidate): boolean {
  if (valuesAreSimilar(c1.value, c2.value)) return false;
  if (hasDistinctScope(c1.sourceSnippet, c2.sourceSnippet)) return false;
  if (hasExceptionLanguage(c1.sourceSnippet) !== hasExceptionLanguage(c2.sourceSnippet)) return false;

  if (c1.sourceSection && c2.sourceSection) {
    const sec1Top = parseInt(c1.sourceSection.split(/[.\s]+/)[0] || '0', 10);
    const sec2Top = parseInt(c2.sourceSection.split(/[.\s]+/)[0] || '0', 10);
    if (Math.abs(sec1Top - sec2Top) > 10) return false;
  }

  if (REQUIREMENT_CLAUSE_TYPES.has(c1.clauseType)) {
    const c1Negated = hasNegation(c1.sourceSnippet);
    const c2Negated = hasNegation(c2.sourceSnippet);
    return c1Negated !== c2Negated;
  }

  const num1 = extractNumericValue(c1.value);
  const num2 = extractNumericValue(c2.value);
  if (num1 !== null && num2 !== null) {
    const pctDiff = Math.abs(num1 - num2) / Math.max(num1, num2);
    if (pctDiff <= 0.1) return false;
    return true;
  }

  if (c1.value.type === 'boolean' && c2.value.type === 'boolean') {
    return c1.value.value !== c2.value.value;
  }

  if (c1.value.type === 'text_rule' || c1.value.type === 'text') {
    const str1 = String(c1.value.value).toLowerCase().trim();
    const str2 = String(c2.value.value).toLowerCase().trim();
    if (str1.includes(str2) || str2.includes(str1)) return false;
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const shared = Array.from(set1).filter(w => set2.has(w)).length;
    const unionSize = new Set(Array.from(set1).concat(Array.from(set2))).size;
    const jaccard = shared / unionSize;
    if (jaccard >= 0.5) return false;
    return true;
  }

  return false;
}

// High-value numeric clause types that should be more lenient in promotion
const NUMERIC_OPERATIONAL_TYPES = new Set<ClauseType>([
  'trip_delay_threshold',
  'trip_delay_limit',
  'baggage_liability_limit',
  'carrier_liability_cap',
  'hotel_cancellation_window',
  'claim_deadline_days',
  'medical_emergency_coverage_limit',
  'emergency_evacuation_limit',
  'dental_emergency_limit',
  'rental_car_damage_limit',
  'personal_accident_coverage_limit',
  'personal_effects_coverage_limit',
  'supplemental_liability_limit',
  'cruise_cancellation_window',
  'deposit_requirement',
  'final_payment_deadline',
  'baggage_delay_threshold',
  'medical_evacuation_cost_estimate',
  'repatriation_remains_limit',
  'missed_connection_threshold',
  'check_in_deadline',
  'trip_cancellation_limit',
  'trip_interruption_limit',
]);

function isNumericOperationalRule(candidate: ClauseCandidate): boolean {
  if (!NUMERIC_OPERATIONAL_TYPES.has(candidate.clauseType)) {
    return false;
  }

  // Must have a clear numeric value
  const valueType = candidate.value?.type;
  return valueType === 'currency' ||
         valueType === 'sdr' ||
         valueType === 'duration' ||
         valueType === 'days';
}

export function scoreConfidence(candidate: ClauseCandidate): ConfidenceTier {
  if (candidate.conflictFlags.length > 0) {
    return 'CONFLICT_PRESENT';
  }

  if (candidate.ambiguityFlags.length > 0) {
    return 'AMBIGUOUS';
  }

  const matchScore = candidate.matchedPhrases.length;

  const hasValue = candidate.value !== null;
  const hasStrongMatch = matchScore >= 2;
  const hasContext = candidate.sourceSection !== null;

  // Standard HIGH confidence criteria
  if (hasValue && hasStrongMatch && hasContext) {
    return 'HIGH';
  }

  // For numeric operational rules, be more lenient:
  // If we have a clear numeric value + context, promote even with 1 matched phrase
  if (isNumericOperationalRule(candidate)) {
    if (hasValue && hasContext && matchScore >= 1) {
      return 'HIGH';
    }
  }

  if (hasValue && hasStrongMatch) {
    return 'CONDITIONAL';
  }

  if (hasValue) {
    return 'DOCUMENTATION_INCOMPLETE';
  }

  return 'INSUFFICIENT_DATA';
}

export function assignConfidenceToCandidates(
  candidates: ClauseCandidate[]
): ClauseCandidate[] {
  const candidatesWithConfidence = candidates.map((candidate) => ({
    ...candidate,
    confidence: scoreConfidence(candidate),
  }));

  return candidatesWithConfidence;
}

function detectConflicts(candidates: ClauseCandidate[]): void {
  const byType = new Map<string, ClauseCandidate[]>();

  for (const candidate of candidates) {
    const existing = byType.get(candidate.clauseType) || [];
    existing.push(candidate);
    byType.set(candidate.clauseType, existing);
  }

  Array.from(byType.entries()).forEach(([clauseType, groupedCandidates]) => {
    if (groupedCandidates.length < 2) return;

    const conflictMap = new Map<number, number[]>();

    for (let i = 0; i < groupedCandidates.length; i++) {
      for (let j = i + 1; j < groupedCandidates.length; j++) {
        if (isTrueConflict(groupedCandidates[i], groupedCandidates[j])) {
          if (!conflictMap.has(i)) conflictMap.set(i, []);
          if (!conflictMap.has(j)) conflictMap.set(j, []);
          conflictMap.get(i)!.push(j);
          conflictMap.get(j)!.push(i);
        }
      }
    }

    for (const [idx, conflictsWith] of Array.from(conflictMap.entries())) {
      const candidate = groupedCandidates[idx];
      const conflictFlag = `true_conflict_detected_for_${clauseType}`;
      if (!candidate.conflictFlags.includes(conflictFlag)) {
        candidate.conflictFlags.push(conflictFlag);
      }
      if (candidate.confidence !== 'CONFLICT_PRESENT') {
        candidate.confidence = 'CONFLICT_PRESENT';
      }
    }
  });
}
