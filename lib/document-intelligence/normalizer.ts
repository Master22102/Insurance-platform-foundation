import { ClauseCandidate, ExtractedValue, ClauseType } from './types';
import { ConsolidatedCandidate } from './consolidation';

export interface NormalizedCandidate extends ConsolidatedCandidate {
  normalizedValue: ExtractedValue;
  normalizationApplied: boolean;
  normalizationReason?: string;
  originalValue: ExtractedValue;
}

export interface NormalizationMetrics {
  beforeCount: number;
  afterCount: number;
  normalizedCount: number;
  normalizationRate: number;
  byClauseType: Record<string, {
    total: number;
    normalized: number;
    examples: Array<{
      original: string;
      normalized: string;
      reason: string;
    }>;
  }>;
}

interface NormalizationRule {
  clauseType: ClauseType;
  patterns: RegExp[];
  normalizer: (value: ExtractedValue, match: RegExpMatchArray | null) => ExtractedValue | null;
  description: string;
}

function extractNumericValue(text: string): number | null {
  const numberWords: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000,
  };

  const lowerText = text.toLowerCase().trim();

  for (const [word, value] of Object.entries(numberWords)) {
    if (lowerText.includes(word)) {
      return value;
    }
  }

  const numMatch = text.match(/\d+(?:[.,]\d+)?/);
  if (numMatch) {
    return parseFloat(numMatch[0].replace(',', ''));
  }

  return null;
}

function normalizeDeadline(value: ExtractedValue, match: RegExpMatchArray | null): ExtractedValue | null {
  const text = String(value.value).toLowerCase();

  const days = extractNumericValue(text);
  if (days === null) {
    return null;
  }

  if (text.includes('hour')) {
    return {
      type: 'duration',
      value: days,
      raw: value.raw,
      unit: 'hours',
    };
  }

  if (text.includes('month')) {
    return {
      type: 'duration',
      value: days * 30,
      raw: value.raw,
      unit: 'days',
    };
  }

  if (text.includes('year')) {
    return {
      type: 'duration',
      value: days * 365,
      raw: value.raw,
      unit: 'days',
    };
  }

  return {
    type: 'duration',
    value: days,
    raw: value.raw,
    unit: 'days',
  };
}

function normalizeThreshold(value: ExtractedValue, match: RegExpMatchArray | null): ExtractedValue | null {
  const text = String(value.value).toLowerCase();

  const amount = extractNumericValue(text);
  if (amount === null) {
    return null;
  }

  if (text.includes('hour')) {
    return {
      type: 'duration',
      value: amount,
      raw: value.raw,
      unit: 'hours',
    };
  }

  if (text.includes('day')) {
    return {
      type: 'duration',
      value: amount,
      raw: value.raw,
      unit: 'days',
    };
  }

  if (text.includes('minute')) {
    return {
      type: 'duration',
      value: amount,
      raw: value.raw,
      unit: 'minutes',
    };
  }

  return {
    type: 'duration',
    value: amount,
    raw: value.raw,
    unit: 'hours',
  };
}

function normalizeCurrency(value: ExtractedValue, match: RegExpMatchArray | null): ExtractedValue | null {
  const text = String(value.value);

  const amountMatch = text.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  if (!amountMatch) {
    return null;
  }

  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

  let unit = 'USD';
  if (text.includes('EUR') || text.includes('€')) {
    unit = 'EUR';
  } else if (text.includes('GBP') || text.includes('£')) {
    unit = 'GBP';
  } else if (text.includes('SDR')) {
    unit = 'SDR';
  }

  return {
    type: 'currency',
    value: amount,
    raw: value.raw,
    unit,
  };
}

function normalizeLiabilityLimit(value: ExtractedValue, match: RegExpMatchArray | null): ExtractedValue | null {
  return normalizeCurrency(value, match);
}

function normalizeRefundEligibility(value: ExtractedValue, match: RegExpMatchArray | null): ExtractedValue | null {
  const text = String(value.value).toLowerCase();

  if (text.includes('nonrefundable') ||
      text.includes('not refundable') ||
      text.includes('not eligible for refund') ||
      text.includes('forfeited') ||
      text.includes('no refund')) {
    return {
      type: 'boolean',
      value: false,
      raw: value.raw,
    };
  }

  if (text.includes('refundable') ||
      text.includes('eligible for refund') ||
      text.includes('may be refunded')) {
    return {
      type: 'boolean',
      value: true,
      raw: value.raw,
    };
  }

  if (text.includes('within') && text.includes('hours')) {
    const hours = extractNumericValue(text);
    if (hours !== null) {
      return {
        type: 'text_rule',
        value: `refundable_within_${hours}_hours`,
        raw: value.raw,
      };
    }
  }

  return null;
}

function normalizeDocumentRequirement(value: ExtractedValue, match: RegExpMatchArray | null): ExtractedValue | null {
  const text = String(value.value).toLowerCase();

  const requirementTypes = [
    { pattern: /receipt|proof of purchase/i, type: 'receipts' },
    { pattern: /police report|law enforcement/i, type: 'police_report' },
    { pattern: /medical certificate|doctor|physician/i, type: 'medical_certificate' },
    { pattern: /pir|property irregularity|baggage claim/i, type: 'baggage_pir' },
    { pattern: /original|originals/i, type: 'original_documents' },
    { pattern: /written|in writing/i, type: 'written_notification' },
  ];

  for (const req of requirementTypes) {
    if (req.pattern.test(text)) {
      return {
        type: 'boolean',
        value: true,
        raw: value.raw,
      };
    }
  }

  return {
    type: 'boolean',
    value: true,
    raw: value.raw,
  };
}

const NORMALIZATION_RULES: NormalizationRule[] = [
  {
    clauseType: 'claim_deadline_days',
    patterns: [
      /within\s+(\d+|\w+)\s+days?/i,
      /no\s+later\s+than\s+(\d+|\w+)\s+days?/i,
      /must\s+notify\s+within\s+(\d+|\w+)\s+days?/i,
      /(\d+|\w+)\s+days?\s+(?:of|from|after)/i,
    ],
    normalizer: normalizeDeadline,
    description: 'Normalize claim deadline to days',
  },
  {
    clauseType: 'trip_delay_threshold',
    patterns: [
      /after\s+(\d+|\w+)\s+hours?/i,
      /if\s+delayed\s+(?:for\s+)?(?:at\s+least\s+)?(\d+|\w+)\s+hours?/i,
      /delays?\s+exceeding\s+(\d+|\w+)\s+hours?/i,
      /(\d+|\w+)\s+hours?\s+(?:or\s+more|delay)/i,
    ],
    normalizer: normalizeThreshold,
    description: 'Normalize delay threshold to hours',
  },
  {
    clauseType: 'baggage_liability_limit',
    patterns: [
      /liability\s+limited\s+to/i,
      /maximum\s+liability/i,
      /shall\s+not\s+exceed/i,
      /limit\s+of\s+liability/i,
    ],
    normalizer: normalizeLiabilityLimit,
    description: 'Normalize baggage liability limit to currency',
  },
  {
    clauseType: 'carrier_liability_cap',
    patterns: [
      /liability\s+limited\s+to/i,
      /maximum\s+liability/i,
      /shall\s+not\s+exceed/i,
      /limit\s+of\s+liability/i,
    ],
    normalizer: normalizeLiabilityLimit,
    description: 'Normalize carrier liability cap to currency',
  },
  {
    clauseType: 'trip_cancellation_limit',
    patterns: [
      /maximum\s+(?:of\s+)?/i,
      /up\s+to/i,
      /not\s+to\s+exceed/i,
    ],
    normalizer: normalizeCurrency,
    description: 'Normalize trip cancellation limit to currency',
  },
  {
    clauseType: 'refund_eligibility_rule',
    patterns: [
      /nonrefundable/i,
      /not\s+refundable/i,
      /refundable/i,
      /eligible\s+for\s+refund/i,
      /within\s+\d+\s+hours/i,
    ],
    normalizer: normalizeRefundEligibility,
    description: 'Normalize refund eligibility to boolean or conditional',
  },
  {
    clauseType: 'requires_receipts',
    patterns: [
      /receipt|proof\s+of\s+purchase/i,
      /original/i,
    ],
    normalizer: normalizeDocumentRequirement,
    description: 'Normalize receipt requirement to boolean',
  },
  {
    clauseType: 'requires_medical_certificate',
    patterns: [
      /medical\s+certificate/i,
      /doctor|physician/i,
    ],
    normalizer: normalizeDocumentRequirement,
    description: 'Normalize medical certificate requirement to boolean',
  },
  {
    clauseType: 'requires_police_report',
    patterns: [
      /police\s+report/i,
      /law\s+enforcement/i,
    ],
    normalizer: normalizeDocumentRequirement,
    description: 'Normalize police report requirement to boolean',
  },
  {
    clauseType: 'requires_baggage_pir',
    patterns: [
      /pir|property\s+irregularity/i,
      /baggage\s+claim/i,
    ],
    normalizer: normalizeDocumentRequirement,
    description: 'Normalize PIR requirement to boolean',
  },
];

function findNormalizationRule(candidate: ConsolidatedCandidate): NormalizationRule | null {
  const rules = NORMALIZATION_RULES.filter(r => r.clauseType === candidate.clauseType);

  if (rules.length === 0) {
    return null;
  }

  const text = String(candidate.value.value);

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return rule;
      }
    }
  }

  return rules[0];
}

function normalizeCandidate(candidate: ConsolidatedCandidate): NormalizedCandidate {
  const rule = findNormalizationRule(candidate);

  if (!rule) {
    return {
      ...candidate,
      normalizedValue: candidate.value,
      normalizationApplied: false,
      originalValue: candidate.value,
    };
  }

  const text = String(candidate.value.value);
  let match: RegExpMatchArray | null = null;

  for (const pattern of rule.patterns) {
    match = text.match(pattern);
    if (match) break;
  }

  const normalized = rule.normalizer(candidate.value, match);

  if (!normalized) {
    return {
      ...candidate,
      normalizedValue: candidate.value,
      normalizationApplied: false,
      originalValue: candidate.value,
    };
  }

  return {
    ...candidate,
    normalizedValue: normalized,
    normalizationApplied: true,
    normalizationReason: rule.description,
    originalValue: candidate.value,
    value: normalized,
  };
}

function formatValueForDisplay(value: ExtractedValue): string {
  if (typeof value.value === 'boolean') {
    return value.value ? 'true' : 'false';
  }

  if (value.type === 'duration' && value.unit) {
    return `${value.value} ${value.unit}`;
  }

  if (value.type === 'currency' && value.unit) {
    return `${value.value} ${value.unit}`;
  }

  return String(value.value);
}

export function normalizeCandidates(
  candidates: ConsolidatedCandidate[]
): { normalized: NormalizedCandidate[]; metrics: NormalizationMetrics } {
  const normalized: NormalizedCandidate[] = [];
  const byClauseType: Record<string, {
    total: number;
    normalized: number;
    examples: Array<{ original: string; normalized: string; reason: string }>;
  }> = {};

  for (const candidate of candidates) {
    const result = normalizeCandidate(candidate);
    normalized.push(result);

    if (!byClauseType[candidate.clauseType]) {
      byClauseType[candidate.clauseType] = {
        total: 0,
        normalized: 0,
        examples: [],
      };
    }

    byClauseType[candidate.clauseType].total += 1;

    if (result.normalizationApplied) {
      byClauseType[candidate.clauseType].normalized += 1;

      if (byClauseType[candidate.clauseType].examples.length < 3) {
        byClauseType[candidate.clauseType].examples.push({
          original: formatValueForDisplay(result.originalValue),
          normalized: formatValueForDisplay(result.normalizedValue),
          reason: result.normalizationReason || 'normalization applied',
        });
      }
    }
  }

  const totalNormalized = normalized.filter(c => c.normalizationApplied).length;

  const metrics: NormalizationMetrics = {
    beforeCount: candidates.length,
    afterCount: normalized.length,
    normalizedCount: totalNormalized,
    normalizationRate: candidates.length > 0
      ? Math.round((totalNormalized / candidates.length) * 100)
      : 0,
    byClauseType,
  };

  return { normalized, metrics };
}
