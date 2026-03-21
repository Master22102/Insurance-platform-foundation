export const CONFIDENCE_VERSION = '9.2.v1';

export const CANONICAL_CONFIDENCE_LABELS = {
  HIGH_STRUCTURAL_ALIGNMENT: 'HIGH_STRUCTURAL_ALIGNMENT',
  CONDITIONAL_ALIGNMENT: 'CONDITIONAL_ALIGNMENT',
  DOCUMENTATION_INCOMPLETE: 'DOCUMENTATION_INCOMPLETE',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
} as const;

export type CanonicalConfidenceLabel =
  typeof CANONICAL_CONFIDENCE_LABELS[keyof typeof CANONICAL_CONFIDENCE_LABELS];

export function normalizeConfidenceLabel(input: string | null | undefined): CanonicalConfidenceLabel {
  const value = String(input || '').trim().toUpperCase();
  if (value === 'HIGH_STRUCTURAL_ALIGNMENT' || value === 'HIGH') {
    return CANONICAL_CONFIDENCE_LABELS.HIGH_STRUCTURAL_ALIGNMENT;
  }
  if (value === 'CONDITIONAL_ALIGNMENT' || value === 'CONDITIONAL' || value === 'AMBIGUOUS') {
    return CANONICAL_CONFIDENCE_LABELS.CONDITIONAL_ALIGNMENT;
  }
  if (value === 'INSUFFICIENT_DATA') {
    return CANONICAL_CONFIDENCE_LABELS.INSUFFICIENT_DATA;
  }
  return CANONICAL_CONFIDENCE_LABELS.DOCUMENTATION_INCOMPLETE;
}

export function statusToConfidenceLabel(documentStatus: string): CanonicalConfidenceLabel {
  if (documentStatus === 'complete') {
    return CANONICAL_CONFIDENCE_LABELS.HIGH_STRUCTURAL_ALIGNMENT;
  }
  if (documentStatus === 'failed') {
    return CANONICAL_CONFIDENCE_LABELS.INSUFFICIENT_DATA;
  }
  return CANONICAL_CONFIDENCE_LABELS.DOCUMENTATION_INCOMPLETE;
}
