import { ClauseCandidate } from './types';
import { NormalizedCandidate } from './normalizer';

type RuleCandidate = ClauseCandidate & Partial<NormalizedCandidate>;

export type ConflictCategory =
  | 'DUPLICATE_EQUIVALENT'
  | 'COMPATIBLE_REFINEMENT'
  | 'SCOPE_DIFFERENCE'
  | 'EXCEPTION_CLAUSE'
  | 'TRUE_CONFLICT'
  | 'NO_CONFLICT';

export interface ConflictPair {
  candidate1: RuleCandidate;
  candidate2: RuleCandidate;
  category: ConflictCategory;
  reason: string;
  blockingConflict: boolean;
}

export interface ConflictResolutionResult {
  candidates: RuleCandidate[];
  conflicts: ConflictPair[];
  resolutionMetrics: {
    totalPairs: number;
    duplicateEquivalent: number;
    compatibleRefinement: number;
    scopeDifference: number;
    exceptionClause: number;
    trueConflict: number;
    noConflict: number;
    blockingConflictsBefore: number;
    blockingConflictsAfter: number;
  };
}

function normalizeForComparison(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNumericValue(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function extractCurrencyAmount(text: string): { amount: number; currency: string } | null {
  const patterns = [
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    /(USD|EUR|GBP|CAD)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(USD|EUR|GBP|CAD)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      const currency = match[2] || 'USD';
      return { amount, currency };
    }
  }

  return null;
}

function isSimilarText(text1: string, text2: string, threshold: number = 0.8): boolean {
  if (!text1 || !text2) return false;

  const normalized1 = normalizeForComparison(text1);
  const normalized2 = normalizeForComparison(text2);

  if (normalized1 === normalized2) return true;

  const words1 = normalized1.split(' ').filter(w => w.length > 0);
  const words2 = normalized2.split(' ').filter(w => w.length > 0);

  if (words1.length === 0 || words2.length === 0) return false;

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set(Array.from(set1).concat(Array.from(set2)));

  const similarity = intersection.size / union.size;
  return similarity >= threshold;
}

function detectDuplicateEquivalent(c1: RuleCandidate, c2: RuleCandidate): ConflictCategory | null {
  if (c1.normalizedValue && c2.normalizedValue) {
    const val1 = c1.normalizedValue.value;
    const val2 = c2.normalizedValue.value;

    if (val1 === val2) {
      return 'DUPLICATE_EQUIVALENT';
    }

    const num1 = typeof val1 === 'number' ? val1 : null;
    const num2 = typeof val2 === 'number' ? val2 : null;

    if (num1 !== null && num2 !== null && num1 === num2) {
      return 'DUPLICATE_EQUIVALENT';
    }
  }

  if (isSimilarText(c1.sourceSnippet, c2.sourceSnippet, 0.9)) {
    return 'DUPLICATE_EQUIVALENT';
  }

  return null;
}

function detectCompatibleRefinement(c1: RuleCandidate, c2: RuleCandidate): ConflictCategory | null {
  const text1 = normalizeForComparison(c1.sourceSnippet);
  const text2 = normalizeForComparison(c2.sourceSnippet);

  if (text1.includes(text2) || text2.includes(text1)) {
    const longer = text1.length > text2.length ? c1 : c2;
    const shorter = text1.length > text2.length ? c2 : c1;

    const longerWords = normalizeForComparison(longer.sourceSnippet).split(' ');
    const shorterWords = normalizeForComparison(shorter.sourceSnippet).split(' ');

    const additionalWords = longerWords.filter(w => !shorterWords.includes(w));

    const refinementKeywords = [
      'provided', 'unless', 'except', 'however', 'additional', 'also',
      'including', 'specifically', 'particular', 'certain', 'subject to',
      'limited to', 'restricted to', 'applies to', 'only if', 'when',
    ];

    const hasRefinementLanguage = additionalWords.some(word =>
      refinementKeywords.some(keyword => word.includes(keyword))
    );

    if (hasRefinementLanguage) {
      return 'COMPATIBLE_REFINEMENT';
    }

    if (longer.normalizedValue && shorter.normalizedValue &&
        longer.normalizedValue.value === shorter.normalizedValue.value) {
      return 'COMPATIBLE_REFINEMENT';
    }
  }

  return null;
}

function detectScopeDifference(c1: RuleCandidate, c2: RuleCandidate): ConflictCategory | null {
  const scopeKeywords = [
    { keyword: 'domestic', opposite: 'international' },
    { keyword: 'economy', opposite: 'business' },
    { keyword: 'first class', opposite: 'economy' },
    { keyword: 'checked baggage', opposite: 'carry on' },
    { keyword: 'adult', opposite: 'child' },
    { keyword: 'resident', opposite: 'non resident' },
    { keyword: 'member', opposite: 'non member' },
    { keyword: 'advance', opposite: 'same day' },
    { keyword: 'online', opposite: 'in person' },
    { keyword: 'voluntary', opposite: 'involuntary' },
  ];

  const text1Lower = c1.sourceSnippet.toLowerCase();
  const text2Lower = c2.sourceSnippet.toLowerCase();

  for (const { keyword, opposite } of scopeKeywords) {
    const has1Keyword = text1Lower.includes(keyword);
    const has1Opposite = text1Lower.includes(opposite);
    const has2Keyword = text2Lower.includes(keyword);
    const has2Opposite = text2Lower.includes(opposite);

    if ((has1Keyword && has2Opposite) || (has1Opposite && has2Keyword)) {
      return 'SCOPE_DIFFERENCE';
    }
  }

  if (c1.sourceSection && c2.sourceSection && c1.sourceSection !== c2.sourceSection) {
    const sectionDistance = Math.abs(
      parseInt(c1.sourceSection.split('.')[0] || '0') -
      parseInt(c2.sourceSection.split('.')[0] || '0')
    );

    if (sectionDistance > 10) {
      if (c1.normalizedValue && c2.normalizedValue &&
          c1.normalizedValue.value !== c2.normalizedValue.value) {
        return 'SCOPE_DIFFERENCE';
      }
    }
  }

  return null;
}

function detectExceptionClause(c1: RuleCandidate, c2: RuleCandidate): ConflictCategory | null {
  const exceptionKeywords = [
    'except', 'unless', 'excluding', 'does not apply', 'not applicable',
    'with the exception', 'other than', 'but not', 'however',
    'notwithstanding', 'despite', 'regardless', 'save for',
  ];

  const text1Lower = c1.sourceSnippet.toLowerCase();
  const text2Lower = c2.sourceSnippet.toLowerCase();

  const has1Exception = exceptionKeywords.some(kw => text1Lower.includes(kw));
  const has2Exception = exceptionKeywords.some(kw => text2Lower.includes(kw));

  if (has1Exception !== has2Exception) {
    if (isSimilarText(c1.sourceSnippet, c2.sourceSnippet, 0.6)) {
      return 'EXCEPTION_CLAUSE';
    }
  }

  return null;
}

function detectTrueConflict(c1: RuleCandidate, c2: RuleCandidate): ConflictCategory | null {
  if (!c1.normalizedValue || !c2.normalizedValue) {
    return null;
  }

  const val1 = c1.normalizedValue.value;
  const val2 = c2.normalizedValue.value;

  if (typeof val1 === 'number' && typeof val2 === 'number') {
    if (val1 !== val2) {
      const percentDiff = Math.abs(val1 - val2) / Math.max(val1, val2);

      if (percentDiff > 0.1) {
        return 'TRUE_CONFLICT';
      }
    }
  }

  if (typeof val1 === 'boolean' && typeof val2 === 'boolean') {
    if (val1 !== val2) {
      return 'TRUE_CONFLICT';
    }
  }

  if (typeof val1 === 'string' && typeof val2 === 'string') {
    if (!isSimilarText(val1, val2, 0.7)) {
      return 'TRUE_CONFLICT';
    }
  }

  const currency1 = extractCurrencyAmount(c1.sourceSnippet);
  const currency2 = extractCurrencyAmount(c2.sourceSnippet);

  if (currency1 && currency2) {
    if (currency1.currency === currency2.currency && currency1.amount !== currency2.amount) {
      const percentDiff = Math.abs(currency1.amount - currency2.amount) /
        Math.max(currency1.amount, currency2.amount);

      if (percentDiff > 0.1) {
        return 'TRUE_CONFLICT';
      }
    }
  }

  return null;
}

function categorizeConflict(c1: RuleCandidate, c2: RuleCandidate): {
  category: ConflictCategory;
  reason: string;
  blocking: boolean;
} {
  let category = detectDuplicateEquivalent(c1, c2);
  if (category) {
    return {
      category,
      reason: 'Same meaning expressed differently',
      blocking: false,
    };
  }

  category = detectCompatibleRefinement(c1, c2);
  if (category) {
    return {
      category,
      reason: 'One clause refines or adds detail to the other',
      blocking: false,
    };
  }

  category = detectScopeDifference(c1, c2);
  if (category) {
    return {
      category,
      reason: 'Different scope or context',
      blocking: false,
    };
  }

  category = detectExceptionClause(c1, c2);
  if (category) {
    return {
      category,
      reason: 'One clause is an exception to the other',
      blocking: false,
    };
  }

  category = detectTrueConflict(c1, c2);
  if (category) {
    return {
      category,
      reason: 'Materially different values or meanings',
      blocking: true,
    };
  }

  return {
    category: 'NO_CONFLICT',
    reason: 'No significant conflict detected',
    blocking: false,
  };
}

export function resolveConflicts(candidates: RuleCandidate[]): ConflictResolutionResult {
  const conflicts: ConflictPair[] = [];
  const metrics = {
    totalPairs: 0,
    duplicateEquivalent: 0,
    compatibleRefinement: 0,
    scopeDifference: 0,
    exceptionClause: 0,
    trueConflict: 0,
    noConflict: 0,
    blockingConflictsBefore: 0,
    blockingConflictsAfter: 0,
  };

  const byClauseFamily: Record<string, RuleCandidate[]> = {};
  for (const candidate of candidates) {
    if (!byClauseFamily[candidate.clauseType]) {
      byClauseFamily[candidate.clauseType] = [];
    }
    byClauseFamily[candidate.clauseType].push(candidate);
  }

  for (const family of Object.keys(byClauseFamily)) {
    const familyCandidates = byClauseFamily[family];

    if (familyCandidates.length < 2) continue;

    for (let i = 0; i < familyCandidates.length; i++) {
      for (let j = i + 1; j < familyCandidates.length; j++) {
        const c1 = familyCandidates[i];
        const c2 = familyCandidates[j];

        metrics.totalPairs++;

        const { category, reason, blocking } = categorizeConflict(c1, c2);

        conflicts.push({
          candidate1: c1,
          candidate2: c2,
          category,
          reason,
          blockingConflict: blocking,
        });

        switch (category) {
          case 'DUPLICATE_EQUIVALENT':
            metrics.duplicateEquivalent++;
            break;
          case 'COMPATIBLE_REFINEMENT':
            metrics.compatibleRefinement++;
            break;
          case 'SCOPE_DIFFERENCE':
            metrics.scopeDifference++;
            break;
          case 'EXCEPTION_CLAUSE':
            metrics.exceptionClause++;
            break;
          case 'TRUE_CONFLICT':
            metrics.trueConflict++;
            break;
          case 'NO_CONFLICT':
            metrics.noConflict++;
            break;
        }
      }
    }
  }

  const conflictedCandidateIds = new Set<string>();
  for (const conflict of conflicts.filter(c => c.blockingConflict)) {
    conflictedCandidateIds.add(
      `${conflict.candidate1.clauseType}-${conflict.candidate1.sourceSection || 'unknown'}-${conflict.candidate1.sourceSnippet.substring(0, 50)}`
    );
    conflictedCandidateIds.add(
      `${conflict.candidate2.clauseType}-${conflict.candidate2.sourceSection || 'unknown'}-${conflict.candidate2.sourceSnippet.substring(0, 50)}`
    );
  }

  const updatedCandidates = candidates.map(candidate => {
    const candidateId = `${candidate.clauseType}-${candidate.sourceSection || 'unknown'}-${candidate.sourceSnippet.substring(0, 50)}`;

    const isInTrueConflict = conflictedCandidateIds.has(candidateId);

    const wasPreviouslyConflicted = candidate.confidence === 'CONFLICT_PRESENT';

    if (wasPreviouslyConflicted) {
      metrics.blockingConflictsBefore++;
    }

    if (wasPreviouslyConflicted && !isInTrueConflict) {
      const typedCandidate = candidate as RuleCandidate;
      return {
        ...candidate,
        confidence: candidate.confidence === 'CONFLICT_PRESENT'
          ? (typedCandidate.normalizedValue ? 'HIGH' : 'DOCUMENTATION_INCOMPLETE')
          : candidate.confidence,
      };
    }

    return candidate;
  });

  metrics.blockingConflictsAfter = 0;
  for (const candidate of updatedCandidates) {
    if (candidate.confidence === 'CONFLICT_PRESENT') {
      metrics.blockingConflictsAfter++;
    }
  }

  return {
    candidates: updatedCandidates,
    conflicts,
    resolutionMetrics: metrics,
  };
}

export function generateConflictReport(result: ConflictResolutionResult): string[] {
  const lines: string[] = [];
  const { resolutionMetrics } = result;

  lines.push('Conflict Resolution Analysis');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  lines.push('Summary:');
  lines.push(`  Total candidate pairs analyzed: ${resolutionMetrics.totalPairs}`);
  lines.push('');

  lines.push('Conflict Categories:');
  lines.push(`  • Duplicate/Equivalent: ${resolutionMetrics.duplicateEquivalent} (non-blocking)`);
  lines.push(`  • Compatible Refinement: ${resolutionMetrics.compatibleRefinement} (non-blocking)`);
  lines.push(`  • Scope Difference: ${resolutionMetrics.scopeDifference} (non-blocking)`);
  lines.push(`  • Exception Clause: ${resolutionMetrics.exceptionClause} (non-blocking)`);
  lines.push(`  • True Conflict: ${resolutionMetrics.trueConflict} (BLOCKING)`);
  lines.push(`  • No Conflict: ${resolutionMetrics.noConflict}`);
  lines.push('');

  const nonBlocking =
    resolutionMetrics.duplicateEquivalent +
    resolutionMetrics.compatibleRefinement +
    resolutionMetrics.scopeDifference +
    resolutionMetrics.exceptionClause;

  lines.push('Impact:');
  lines.push(`  Blocking conflicts BEFORE resolution: ${resolutionMetrics.blockingConflictsBefore}`);
  lines.push(`  Blocking conflicts AFTER resolution: ${resolutionMetrics.blockingConflictsAfter}`);

  const resolved = resolutionMetrics.blockingConflictsBefore - resolutionMetrics.blockingConflictsAfter;
  const resolvedPct = resolutionMetrics.blockingConflictsBefore > 0
    ? Math.round((resolved / resolutionMetrics.blockingConflictsBefore) * 100)
    : 0;

  lines.push(`  Conflicts resolved: ${resolved} (${resolvedPct}%)`);
  lines.push('');

  if (result.conflicts.length > 0) {
    const trueConflicts = result.conflicts.filter(c => c.category === 'TRUE_CONFLICT');

    if (trueConflicts.length > 0) {
      lines.push('Remaining True Conflicts (samples):');
      trueConflicts.slice(0, 5).forEach((conflict, idx) => {
        lines.push(`  ${idx + 1}. ${conflict.candidate1.clauseType}`);
        lines.push(`     Candidate A: "${conflict.candidate1.sourceSnippet.substring(0, 80)}..."`);
        lines.push(`     Candidate B: "${conflict.candidate2.sourceSnippet.substring(0, 80)}..."`);
        lines.push(`     Reason: ${conflict.reason}`);
        lines.push('');
      });
    }
  }

  return lines;
}
