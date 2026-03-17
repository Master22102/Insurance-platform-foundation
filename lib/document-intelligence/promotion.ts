import { ClauseCandidate, PromotedRule, DocumentRuleRow } from './types';
import { isEligibleForPromotion } from './clause-taxonomy';

export function promoteRules(candidates: ClauseCandidate[]): PromotedRule[] {
  const promoted: PromotedRule[] = [];

  for (const candidate of candidates) {
    if (canPromote(candidate)) {
      promoted.push({
        clauseType: candidate.clauseType,
        value: candidate.value,
        sourceSnippet: candidate.sourceSnippet,
        sourceSection: candidate.sourceSection,
        confidence: candidate.confidence,
        promotedAt: new Date().toISOString(),
      });
    }
  }

  return promoted;
}

function canPromote(candidate: ClauseCandidate): boolean {
  if (!isEligibleForPromotion(candidate.clauseType)) {
    return false;
  }

  if (candidate.confidence !== 'HIGH') {
    return false;
  }

  if (candidate.ambiguityFlags.length > 0) {
    return false;
  }

  if (candidate.conflictFlags.length > 0) {
    return false;
  }

  if (!candidate.value) {
    return false;
  }

  return true;
}

export function createDocumentRuleRows(
  promotedRules: PromotedRule[],
  documentId: string
): DocumentRuleRow[] {
  return promotedRules.map((rule, index) => ({
    ruleId: `${documentId}-rule-${index + 1}`,
    clauseType: rule.clauseType,
    value: rule.value,
    sourceSnippet: rule.sourceSnippet,
    confidence: rule.confidence,
    metadata: {
      promotedAt: rule.promotedAt,
      documentId,
    },
  }));
}
