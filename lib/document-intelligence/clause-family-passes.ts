import { ClauseCandidate, TextSection, ExtractedValue, ClauseType } from './types';
import { PhraseCluster } from './phrase-clusters';

export type ClauseFamilyPass =
  | 'delay-threshold-pass'
  | 'liability-pass'
  | 'refund-cancellation-pass'
  | 'documentation-requirements-pass'
  | 'payment-eligibility-pass'
  | 'medical-insurance-pass'
  | 'rental-car-pass'
  | 'cruise-booking-pass'
  | 'additional-insurance-pass'
  | 'eu-passenger-rights-pass';

interface PassConfig {
  name: ClauseFamilyPass;
  targetClauseTypes: ClauseType[];
  phraseClusters: PhraseCluster[];
}

function findPhraseMatches(text: string, cluster: PhraseCluster): { matched: string[]; score: number; index: number } {
  const matched: string[] = [];
  let score = 0;
  let bestIndex = -1;

  for (const phrase of cluster.primaryPhrases) {
    const index = text.indexOf(phrase.toLowerCase());
    if (index !== -1) {
      matched.push(phrase);
      score += 10;
      if (bestIndex === -1 || index < bestIndex) {
        bestIndex = index;
      }
    }
  }

  for (const phrase of cluster.secondaryPhrases) {
    if (text.includes(phrase.toLowerCase())) {
      matched.push(phrase);
      score += 5;
    }
  }

  for (const phrase of cluster.contextPhrases) {
    if (text.includes(phrase.toLowerCase())) {
      score += 2;
    }
  }

  return { matched, score, index: bestIndex };
}

function extractSnippet(text: string, startIndex: number, maxLength: number): string {
  if (startIndex === -1) {
    return text.substring(0, Math.min(maxLength, text.length));
  }

  const start = Math.max(0, startIndex - 100);
  const end = Math.min(text.length, startIndex + maxLength);
  let snippet = text.substring(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet.trim();
}

function extractValue(text: string, clauseType: ClauseType): ExtractedValue | null {
  switch (clauseType) {
    case 'trip_delay_threshold':
    case 'trip_delay_limit':
    case 'hotel_cancellation_window':
      return extractDuration(text);

    case 'claim_deadline_days':
      return extractDays(text);

    case 'baggage_liability_limit':
    case 'carrier_liability_cap':
      return extractCurrency(text) || extractSDR(text);

    case 'requires_receipts':
    case 'requires_police_report':
    case 'requires_medical_certificate':
    case 'requires_carrier_delay_letter':
    case 'requires_baggage_pir':
    case 'requires_itinerary':
    case 'requires_payment_proof':
      return extractBoolean(text, clauseType);

    case 'payment_method_requirement':
    case 'refund_eligibility_rule':
    case 'common_carrier_requirement':
    case 'round_trip_requirement':
    case 'eu_care_obligation':
    case 'eu_rerouting_obligation':
      return extractTextRule(text);

    case 'eu_delay_compensation_threshold':
    case 'eu_denied_boarding_compensation':
    case 'eu_cancellation_compensation':
      return extractCurrency(text) || extractTextRule(text);

    case 'eu_refund_deadline':
      return extractDays(text) || extractTextRule(text);

    default:
      return extractTextRule(text);
  }
}

function extractDuration(text: string): ExtractedValue | null {
  const hourPatterns = [
    /(\d+)\s*(?:consecutive\s+)?hours?/i,
    /(?:delay|delayed)\s+(?:of|for|exceeds?)\s+(\d+)\s*(?:consecutive\s+)?hours?/i,
    /(?:at least|minimum of|more than)\s+(\d+)\s*hours?/i,
  ];

  for (const pattern of hourPatterns) {
    const match = text.match(pattern);
    if (match) {
      const hours = parseInt(match[1]);
      if (!isNaN(hours) && hours > 0 && hours < 1000) {
        return {
          type: 'duration',
          value: hours,
          raw: match[0],
          unit: 'hours',
        };
      }
    }
  }

  return null;
}

function extractDays(text: string): ExtractedValue | null {
  const dayPatterns = [
    /(\d+)\s*(?:calendar\s+|business\s+)?days?/i,
    /within\s+(\d+)\s*(?:calendar\s+|business\s+)?days?/i,
    /no later than\s+(\d+)\s*(?:calendar\s+|business\s+)?days?/i,
  ];

  for (const pattern of dayPatterns) {
    const match = text.match(pattern);
    if (match) {
      const days = parseInt(match[1]);
      if (!isNaN(days) && days > 0 && days < 3650) {
        return {
          type: 'days',
          value: days,
          raw: match[0],
          unit: 'days',
        };
      }
    }
  }

  return null;
}

function extractCurrency(text: string): ExtractedValue | null {
  // EUR patterns first (so they take priority when EUR is present)
  const eurPatterns = [
    /€\s*([\d,]+(?:\.\d{2})?)/,
    /EUR\s*([\d,]+(?:\.\d{2})?)/i,
    /([\d,]+(?:\.\d{2})?)\s*(?:euros?|EUR)/i,
  ];
  for (const pattern of eurPatterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1].replace(/,/g, '');
      const amount = parseFloat(numStr);
      if (!isNaN(amount) && amount > 0) {
        return { type: 'currency', value: amount, raw: match[0], unit: 'EUR' };
      }
    }
  }

  // USD patterns
  const usdPatterns = [
    /\$\s*([\d,]+(?:\.\d{2})?)/,
    /USD\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /([\d,]+(?:\.\d{2})?)\s*(?:dollars?|USD)/i,
    /(?:limit|liability|maximum|up to|not exceed)\s+\$\s*([\d,]+(?:\.\d{2})?)/i,
    /\$\s*([\d,]+)\s+per\s+(?:bag|passenger|item|person)/i,
  ];
  for (const pattern of usdPatterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1].replace(/,/g, '');
      const amount = parseFloat(numStr);
      if (!isNaN(amount) && amount > 0) {
        return { type: 'currency', value: amount, raw: match[0], unit: 'USD' };
      }
    }
  }

  return null;
}

function extractSDR(text: string): ExtractedValue | null {
  const sdrPatterns = [
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*SDR/i,
    /SDR\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /Special Drawing Rights?.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /(?:limit|liability|maximum)\s+(?:of\s+)?(\d{1,3}(?:,\d{3})*)\s*SDR/i,
  ];

  for (const pattern of sdrPatterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1].replace(/,/g, '');
      const amount = parseFloat(numStr);
      if (!isNaN(amount) && amount > 0) {
        return {
          type: 'sdr',
          value: amount,
          raw: match[0],
          unit: 'SDR',
        };
      }
    }
  }

  return null;
}

function extractBoolean(text: string, clauseType: string): ExtractedValue | null {
  const lowerText = text.toLowerCase();

  const positiveIndicators = ['required', 'must', 'shall', 'need to', 'necessary'];
  const negativeIndicators = ['not required', 'optional', 'not necessary', 'no need'];

  const hasNegative = negativeIndicators.some((ind) => lowerText.includes(ind));
  const hasPositive = positiveIndicators.some((ind) => lowerText.includes(ind));

  if (hasNegative && !hasPositive) {
    return {
      type: 'boolean',
      value: false,
      raw: text.substring(0, 100),
      unit: '',
    };
  }

  if (hasPositive) {
    return {
      type: 'boolean',
      value: true,
      raw: text.substring(0, 100),
      unit: '',
    };
  }

  return null;
}

function extractTextRule(text: string): ExtractedValue | null {
  const excerpt = text.substring(0, 200).trim();
  if (excerpt.length > 10) {
    return {
      type: 'text_rule',
      value: excerpt,
      raw: excerpt,
      unit: '',
    };
  }
  return null;
}

export function runClauseFamilyPass(
  passName: ClauseFamilyPass,
  phraseClusters: PhraseCluster[],
  sections: TextSection[]
): ClauseCandidate[] {
  const candidates: ClauseCandidate[] = [];

  for (const section of sections) {
    const sectionText = section.content.toLowerCase();
    const heading = section.heading?.toLowerCase() || '';

    for (const cluster of phraseClusters) {
      const contentMatches = findPhraseMatches(sectionText, cluster);
      const headingMatches = heading ? findPhraseMatches(heading, cluster) : { matched: [], score: 0, index: -1 };

      const totalScore = contentMatches.score + (headingMatches.score * 1.5);
      const allMatched = [...contentMatches.matched, ...headingMatches.matched];

      if (allMatched.length > 0 && totalScore >= 10) {
        const snippet = extractSnippet(section.content, contentMatches.index, 300);
        const value = extractValue(snippet, cluster.clauseType);

        if (value) {
          const hasNegation = cluster.negationPhrases.some((neg) =>
            sectionText.includes(neg.toLowerCase())
          );

          candidates.push({
            clauseType: cluster.clauseType,
            value,
            confidence: 'INSUFFICIENT_DATA',
            sourceSnippet: snippet,
            sourceSection: section.heading,
            matchedPhrases: allMatched,
            ambiguityFlags: hasNegation ? ['negation_present'] : [],
            conflictFlags: [],
            detectedByPass: passName,
          } as ClauseCandidate & { detectedByPass: ClauseFamilyPass });
        }
      }
    }
  }

  return candidates;
}
