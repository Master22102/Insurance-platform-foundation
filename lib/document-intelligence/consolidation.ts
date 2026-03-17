import { ClauseCandidate, ClauseType, ExtractedValue } from './types';

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

export interface ConsolidatedCandidate extends ClauseCandidate {
  supportingSnippets: string[];
  sourceSections: string[];
  passOrigins: string[];
  conflictDetected: boolean;
  consolidatedFrom: number;
}

interface CandidateGroup {
  clauseType: ClauseType;
  candidates: ClauseCandidate[];
}

interface CandidateCluster {
  candidates: ClauseCandidate[];
  canonicalValue: ExtractedValue;
  hasConflict: boolean;
}

export interface ConsolidationMetrics {
  beforeCount: number;
  afterCount: number;
  reductionCount: number;
  reductionPercent: number;
  conflictsDetected: number;
  byClauseType: Record<string, {
    before: number;
    after: number;
    reduced: number;
    conflicts: number;
  }>;
}

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

function groupByClauseType(candidates: ClauseCandidate[]): CandidateGroup[] {
  const groups = new Map<ClauseType, ClauseCandidate[]>();
  for (const candidate of candidates) {
    const existing = groups.get(candidate.clauseType) || [];
    existing.push(candidate);
    groups.set(candidate.clauseType, existing);
  }
  return Array.from(groups.entries()).map(([clauseType, cands]) => ({ clauseType, candidates: cands }));
}

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
    if (str1.includes(str2) || str2.includes(str1)) {
      const shorter = str1.length < str2.length ? str1 : str2;
      const longer = str1.length < str2.length ? str2 : str1;
      return longer.length / shorter.length < 1.5;
    }
    return false;
  }

  return String(v1.value).toLowerCase() === String(v2.value).toLowerCase();
}

function sectionsOverlap(section1: string | null, section2: string | null): boolean {
  if (!section1 || !section2) return false;
  const s1 = section1.toLowerCase().trim();
  const s2 = section2.toLowerCase().trim();
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  return false;
}

function snippetsOverlap(snippet1: string, snippet2: string): boolean {
  const s1 = snippet1.toLowerCase().trim();
  const s2 = snippet2.toLowerCase().trim();
  if (s1.length < 20 || s2.length < 20) return false;
  const shorter = s1.length < s2.length ? s1 : s2;
  const longer = s1.length < s2.length ? s2 : s1;
  const overlapLength = Math.min(shorter.length, 100);
  const shortSnippet = shorter.substring(0, overlapLength);
  return longer.includes(shortSnippet);
}

function candidatesAreSimilar(c1: ClauseCandidate, c2: ClauseCandidate): boolean {
  const valuesSimilar = valuesAreSimilar(c1.value, c2.value);
  const sectionsOverlapFlag = sectionsOverlap(c1.sourceSection, c2.sourceSection);
  const snippetsOverlapFlag = snippetsOverlap(c1.sourceSnippet, c2.sourceSnippet);
  return (valuesSimilar && sectionsOverlapFlag) || snippetsOverlapFlag;
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

function isTrueValueConflict(c1: ClauseCandidate, c2: ClauseCandidate): boolean {
  const v1 = c1.value;
  const v2 = c2.value;

  if (valuesAreSimilar(v1, v2)) return false;

  if (hasDistinctScope(c1.sourceSnippet, c2.sourceSnippet)) return false;

  if (hasExceptionLanguage(c1.sourceSnippet) !== hasExceptionLanguage(c2.sourceSnippet)) return false;

  if (c1.sourceSection && c2.sourceSection) {
    const sec1Top = parseInt(c1.sourceSection.split(/[.\s]+/)[0] || '0', 10);
    const sec2Top = parseInt(c2.sourceSection.split(/[.\s]+/)[0] || '0', 10);
    if (Math.abs(sec1Top - sec2Top) > 10) return false;
  }

  if (REQUIREMENT_CLAUSE_TYPES.has(c1.clauseType)) {
    return hasNegation(c1.sourceSnippet) !== hasNegation(c2.sourceSnippet);
  }

  const num1 = extractNumericValue(v1);
  const num2 = extractNumericValue(v2);
  if (num1 !== null && num2 !== null) {
    const pctDiff = Math.abs(num1 - num2) / Math.max(num1, num2);
    if (pctDiff <= 0.1) return false;
    return true;
  }

  if (v1.type === 'boolean' && v2.type === 'boolean') {
    return v1.value !== v2.value;
  }

  if (v1.type === 'text_rule' || v1.type === 'text') {
    const str1 = String(v1.value).toLowerCase().trim();
    const str2 = String(v2.value).toLowerCase().trim();
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

function clusterCandidates(candidates: ClauseCandidate[]): CandidateCluster[] {
  const clusters: CandidateCluster[] = [];

  for (const candidate of candidates) {
    let addedToCluster = false;
    for (const cluster of clusters) {
      if (candidatesAreSimilar(candidate, cluster.candidates[0])) {
        cluster.candidates.push(candidate);
        addedToCluster = true;
        break;
      }
    }
    if (!addedToCluster) {
      clusters.push({
        candidates: [candidate],
        canonicalValue: candidate.value,
        hasConflict: false,
      });
    }
  }

  for (const cluster of clusters) {
    if (cluster.candidates.length > 1) {
      const hasTrueConflict = cluster.candidates.some((c1, i) =>
        cluster.candidates.slice(i + 1).some(c2 => isTrueValueConflict(c1, c2))
      );
      cluster.hasConflict = hasTrueConflict;
    }
  }

  return clusters;
}

function selectBestCandidate(candidates: ClauseCandidate[]): ClauseCandidate {
  let best = candidates[0];
  let bestScore = 0;

  for (const candidate of candidates) {
    let score = 0;
    score += candidate.matchedPhrases.length * 10;
    if (candidate.ambiguityFlags.length === 0) score += 20;
    if (candidate.conflictFlags.length === 0) score += 20;
    const numValue = extractNumericValue(candidate.value);
    if (numValue !== null && numValue > 0) score += 15;
    if (candidate.sourceSection) score += 10;
    if (candidate.sourceSnippet.length > 50 && candidate.sourceSnippet.length < 400) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function consolidateCluster(cluster: CandidateCluster): ConsolidatedCandidate {
  const best = selectBestCandidate(cluster.candidates);

  const supportingSnippets: string[] = [];
  const sourceSections: string[] = [];
  const passOrigins: string[] = [];
  const allMatchedPhrases = new Set<string>();
  const allAmbiguityFlags = new Set<string>();
  const allConflictFlags = new Set<string>();

  for (const candidate of cluster.candidates) {
    if (!supportingSnippets.includes(candidate.sourceSnippet)) {
      supportingSnippets.push(candidate.sourceSnippet);
    }
    if (candidate.sourceSection && !sourceSections.includes(candidate.sourceSection)) {
      sourceSections.push(candidate.sourceSection);
    }
    const passOrigin = candidate.detectedByPass || 'unknown';
    if (!passOrigins.includes(passOrigin)) passOrigins.push(passOrigin);
    for (const phrase of candidate.matchedPhrases) allMatchedPhrases.add(phrase);
    for (const flag of candidate.ambiguityFlags) allAmbiguityFlags.add(flag);
    for (const flag of candidate.conflictFlags) allConflictFlags.add(flag);
  }

  if (cluster.hasConflict) {
    allConflictFlags.add('value_conflict_in_cluster');
  }

  return {
    clauseType: best.clauseType,
    value: best.value,
    confidence: best.confidence,
    sourceSnippet: best.sourceSnippet,
    sourceSection: best.sourceSection,
    matchedPhrases: Array.from(allMatchedPhrases),
    ambiguityFlags: Array.from(allAmbiguityFlags),
    conflictFlags: Array.from(allConflictFlags),
    detectedByPass: best.detectedByPass,
    supportingSnippets,
    sourceSections,
    passOrigins,
    conflictDetected: cluster.hasConflict,
    consolidatedFrom: cluster.candidates.length,
  };
}

export function deduplicateByValue<T extends ClauseCandidate>(
  candidates: T[]
): { deduplicated: T[]; removed: number } {
  const uniqueMap = new Map<string, T>();

  for (const candidate of candidates) {
    // Create a deduplication key: clauseType + normalized value
    const normalizedValue = extractNumericValue(candidate.value) || String(candidate.value.value);
    const key = `${candidate.clauseType}:${normalizedValue}:${candidate.value.unit || ''}`;

    const existing = uniqueMap.get(key);

    if (!existing) {
      // First occurrence - add it
      uniqueMap.set(key, candidate);
    } else {
      // Duplicate detected - keep the one with better quality
      const candidateScore = calculateCandidateQuality(candidate);
      const existingScore = calculateCandidateQuality(existing);

      if (candidateScore > existingScore) {
        uniqueMap.set(key, candidate);
      }
    }
  }

  const deduplicated = Array.from(uniqueMap.values());
  const removed = candidates.length - deduplicated.length;

  return { deduplicated, removed };
}

function calculateCandidateQuality(candidate: ClauseCandidate): number {
  let score = 0;

  // More matched phrases = better
  score += candidate.matchedPhrases.length * 10;

  // Fewer ambiguity flags = better
  score -= candidate.ambiguityFlags.length * 5;

  // Fewer conflict flags = better
  score -= candidate.conflictFlags.length * 10;

  // Longer source snippet (up to a point) = more context
  if (candidate.sourceSnippet.length > 50 && candidate.sourceSnippet.length < 500) {
    score += 5;
  }

  // Has section heading = better
  if (candidate.sourceSection) {
    score += 10;
  }

  return score;
}

export function consolidateCandidates(
  candidates: ClauseCandidate[]
): { consolidated: ConsolidatedCandidate[]; metrics: ConsolidationMetrics } {
  const groups = groupByClauseType(candidates);
  const consolidated: ConsolidatedCandidate[] = [];
  const byClauseType: Record<string, { before: number; after: number; reduced: number; conflicts: number }> = {};

  let totalConflicts = 0;

  for (const group of groups) {
    const clusters = clusterCandidates(group.candidates);
    const beforeCount = group.candidates.length;
    const afterCount = clusters.length;
    const conflicts = clusters.filter(c => c.hasConflict).length;

    byClauseType[group.clauseType] = {
      before: beforeCount,
      after: afterCount,
      reduced: beforeCount - afterCount,
      conflicts,
    };

    totalConflicts += conflicts;

    for (const cluster of clusters) {
      consolidated.push(consolidateCluster(cluster));
    }
  }

  // Apply final deduplication pass
  const { deduplicated, removed } = deduplicateByValue(consolidated);

  const metrics: ConsolidationMetrics = {
    beforeCount: candidates.length,
    afterCount: deduplicated.length,
    reductionCount: candidates.length - deduplicated.length,
    reductionPercent: candidates.length > 0
      ? Math.round((1 - deduplicated.length / candidates.length) * 100)
      : 0,
    conflictsDetected: totalConflicts,
    byClauseType,
  };

  return { consolidated: deduplicated, metrics };
}
