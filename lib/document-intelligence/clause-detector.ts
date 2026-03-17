import { ClauseCandidate, TextSection, ExtractedValue, ValueType } from './types';
import { getAllPhraseClusters, PhraseCluster } from './phrase-clusters';

export function detectClauses(sections: TextSection[]): ClauseCandidate[] {
  const candidates: ClauseCandidate[] = [];
  const phraseClusters = getAllPhraseClusters();

  for (const section of sections) {
    const sectionText = section.content.toLowerCase();

    for (const cluster of phraseClusters) {
      const matches = findPhraseMatches(sectionText, cluster);

      if (matches.matchedPhrases.length > 0) {
        const snippet = extractSnippet(section.content, matches.bestMatchIndex, 300);
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
            matchedPhrases: matches.matchedPhrases,
            ambiguityFlags: hasNegation ? ['negation_present'] : [],
            conflictFlags: [],
          });
        }
      }
    }
  }

  return deduplicateCandidates(candidates);
}

interface PhraseMatches {
  matchedPhrases: string[];
  bestMatchIndex: number;
  score: number;
}

function findPhraseMatches(text: string, cluster: PhraseCluster): PhraseMatches {
  const matchedPhrases: string[] = [];
  let bestMatchIndex = -1;
  let score = 0;

  for (const phrase of cluster.primaryPhrases) {
    const index = text.indexOf(phrase.toLowerCase());
    if (index !== -1) {
      matchedPhrases.push(phrase);
      score += 10;
      if (bestMatchIndex === -1 || index < bestMatchIndex) {
        bestMatchIndex = index;
      }
    }
  }

  for (const phrase of cluster.secondaryPhrases) {
    if (text.includes(phrase.toLowerCase())) {
      matchedPhrases.push(phrase);
      score += 5;
    }
  }

  for (const phrase of cluster.contextPhrases) {
    if (text.includes(phrase.toLowerCase())) {
      score += 2;
    }
  }

  return { matchedPhrases, bestMatchIndex, score };
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

function verifyPrimaryPhraseProximity(
  snippet: string,
  cluster: PhraseCluster,
  value: ExtractedValue
): boolean {
  const lowerSnippet = snippet.toLowerCase();

  // STRICT CHECK: The snippet MUST contain at least one primary phrase
  const hasPrimaryPhrase = cluster.primaryPhrases.some(phrase =>
    lowerSnippet.includes(phrase.toLowerCase())
  );

  if (!hasPrimaryPhrase) {
    // No primary phrase in snippet at all - definite false positive
    return false;
  }

  // Find where the value appears in the snippet
  const valueStr = String(value.raw || value.value);
  const valueIndex = lowerSnippet.indexOf(valueStr.toLowerCase());

  if (valueIndex === -1) {
    // Value not found in snippet - shouldn't happen but allow it
    return true;
  }

  // Check if ANY primary phrase is within 80 characters of the value
  for (const phrase of cluster.primaryPhrases) {
    const phraseIndex = lowerSnippet.indexOf(phrase.toLowerCase());
    if (phraseIndex !== -1) {
      const distance = Math.abs(phraseIndex - valueIndex);
      if (distance < 80) {
        return true; // Primary phrase is close enough
      }
    }
  }

  // Primary phrase exists but too far from value - likely false positive
  return false;
}

function extractValue(text: string, clauseType: string): ExtractedValue | null {
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
      return extractBoolean(text, clauseType);

    case 'payment_method_requirement':
    case 'refund_eligibility_rule':
      return extractTextRule(text);

    default:
      return null;
  }
}

function extractDuration(text: string): ExtractedValue | null {
  const candidates = extractAllNumbers(text);
  const hourCandidates = candidates.filter(c => c.unit === 'hours');

  const best = selectBestNumber(hourCandidates, text, 'trip_delay_threshold');
  if (!best) return null;

  return {
    type: 'duration',
    value: best.value,
    raw: best.raw,
    unit: 'hours',
  };
}

function extractDays(text: string): ExtractedValue | null {
  const candidates = extractAllNumbers(text);
  const dayCandidates = candidates.filter(c => c.unit === 'days');

  const best = selectBestNumber(dayCandidates, text, 'claim_deadline_days');
  if (!best) return null;

  return {
    type: 'duration',
    value: best.value,
    raw: best.raw,
    unit: 'days',
  };
}

interface NumberCandidate {
  value: number;
  index: number;
  raw: string;
  unit: 'USD' | 'EUR' | 'SDR' | 'hours' | 'days' | 'percent' | 'none';
  scope?: string;
}

function extractAllNumbers(text: string): NumberCandidate[] {
  const candidates: NumberCandidate[] = [];

  // Currency patterns with scope detection
  const currencyPatterns = [
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+(person|passenger|family|trip|occurrence|claim|day|bag|item|piece))?/gi,
    /USD\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+(person|passenger|family|trip|occurrence|claim|day))?/gi,
    /€\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+(person|passenger|family|trip|occurrence|claim|day))?/gi,
    /EUR\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+(person|passenger|family|trip|occurrence|claim|day))?/gi,
    /([\d,]+(?:\.\d{2})?)\s*(?:dollars?|USD)\s*(?:per\s+(person|passenger|family|trip|occurrence|claim|day))?/gi,
  ];

  for (const pattern of currencyPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const numStr = match[1].replace(/,/g, '');
      const amount = parseFloat(numStr);
      if (!isNaN(amount) && amount > 0 && amount < 10000000) {
        const unit = pattern.source.includes('€') || pattern.source.includes('EUR') ? 'EUR' : 'USD';
        candidates.push({
          value: amount,
          index: match.index,
          raw: match[0],
          unit,
          scope: match[2] ? `per_${match[2]}` : undefined,
        });
      }
    }
  }

  // SDR patterns with scope
  const sdrPatterns = [
    /([\d,]+(?:\.\d{2})?)\s*SDRs?\s*(?:per\s+(person|passenger|family|trip|occurrence))?/gi,
    /SDRs?\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+(person|passenger|family|trip|occurrence))?/gi,
  ];

  for (const pattern of sdrPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const numStr = match[1].replace(/,/g, '');
      const amount = parseFloat(numStr);
      if (!isNaN(amount) && amount > 0) {
        candidates.push({
          value: amount,
          index: match.index,
          raw: match[0],
          unit: 'SDR',
          scope: match[2] ? `per_${match[2]}` : undefined,
        });
      }
    }
  }

  // Hours patterns
  const hourPattern = /(\d+)\s*(?:consecutive\s+)?hours?/gi;
  let match;
  while ((match = hourPattern.exec(text)) !== null) {
    const hours = parseInt(match[1]);
    if (!isNaN(hours) && hours > 0 && hours <= 72) {
      candidates.push({
        value: hours,
        index: match.index,
        raw: match[0],
        unit: 'hours',
      });
    }
  }

  // Days patterns
  const dayPattern = /(\d+)\s*(?:calendar\s+|business\s+)?days?/gi;
  while ((match = dayPattern.exec(text)) !== null) {
    const days = parseInt(match[1]);
    if (!isNaN(days) && days > 0 && days <= 365) {
      candidates.push({
        value: days,
        index: match.index,
        raw: match[0],
        unit: 'days',
      });
    }
  }

  // Percentage patterns
  const percentPattern = /(\d+(?:\.\d+)?)\s*%/g;
  while ((match = percentPattern.exec(text)) !== null) {
    const pct = parseFloat(match[1]);
    if (!isNaN(pct) && pct > 0 && pct <= 100) {
      candidates.push({
        value: pct,
        index: match.index,
        raw: match[0],
        unit: 'percent',
      });
    }
  }

  return candidates;
}

function scoreNumberCandidate(
  candidate: NumberCandidate,
  text: string,
  clauseType: string
): number {
  let score = 0;
  const lowerText = text.toLowerCase();

  // Unit priority scoring
  if (candidate.unit === 'USD' || candidate.unit === 'EUR' || candidate.unit === 'SDR') {
    score += 100; // Currency values get highest priority
  } else if (candidate.unit === 'days') {
    score += 80;
  } else if (candidate.unit === 'hours') {
    score += 70;
  } else if (candidate.unit === 'percent') {
    score += 50;
  }

  // Extract context around the number (50 chars before and after)
  const contextStart = Math.max(0, candidate.index - 50);
  const contextEnd = Math.min(text.length, candidate.index + candidate.raw.length + 50);
  const context = lowerText.substring(contextStart, contextEnd);

  // Positive keywords - indicates this is likely the target value
  const positiveKeywords = [
    'maximum', 'limit', 'benefit', 'coverage', 'up to', 'cap', 'capped at',
    'not exceed', 'shall not exceed', 'limited to', 'maximum of', 'limit of',
    'reimburse', 'reimbursement', 'pay', 'payment', 'compensate', 'compensation'
  ];

  for (const keyword of positiveKeywords) {
    const keywordIndex = context.indexOf(keyword);
    if (keywordIndex !== -1) {
      // Score based on proximity - closer is better
      const distance = Math.abs(keywordIndex - 50); // 50 is the offset to candidate position
      const proximityScore = Math.max(0, 50 - distance);
      score += proximityScore;
    }
  }

  // Negative keywords - indicates this is NOT the target value
  const negativeKeywords = [
    'hours', 'example', 'illustration', 'e.g.', 'for example', 'such as',
    'sample', 'minimum', 'deductible', 'fee', 'charge', 'penalty'
  ];

  // Only apply negative keywords for non-duration clauses
  if (!clauseType.includes('threshold') && !clauseType.includes('delay') && !clauseType.includes('deadline')) {
    for (const keyword of negativeKeywords) {
      if (context.includes(keyword)) {
        score -= 30;
      }
    }
  }

  // Bonus for scope detection (per person, per family, etc.)
  if (candidate.scope) {
    score += 20;
  }

  return score;
}

function selectBestNumber(
  candidates: NumberCandidate[],
  text: string,
  clauseType: string
): NumberCandidate | null {
  if (candidates.length === 0) return null;

  // Score all candidates
  const scored = candidates.map(candidate => ({
    candidate,
    score: scoreNumberCandidate(candidate, text, clauseType),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored[0].candidate;
}

function extractCurrency(text: string): ExtractedValue | null {
  const candidates = extractAllNumbers(text);
  const currencyCandidates = candidates.filter(
    c => c.unit === 'USD' || c.unit === 'EUR' || c.unit === 'SDR'
  );

  const best = selectBestNumber(currencyCandidates, text, 'currency');
  if (!best) return null;

  return {
    type: best.unit === 'SDR' ? 'sdr' : 'currency',
    value: best.value,
    raw: best.raw,
    unit: best.unit,
    ...(best.scope && { scope: best.scope }),
  } as ExtractedValue;
}

function extractSDR(text: string): ExtractedValue | null {
  const candidates = extractAllNumbers(text);
  const sdrCandidates = candidates.filter(c => c.unit === 'SDR');

  const best = selectBestNumber(sdrCandidates, text, 'sdr');
  if (!best) return null;

  return {
    type: 'sdr',
    value: best.value,
    raw: best.raw,
    unit: 'SDR',
    ...(best.scope && { scope: best.scope }),
  } as ExtractedValue;
}

function extractBoolean(text: string, clauseType: string): ExtractedValue | null {
  const lowerText = text.toLowerCase();

  const positiveIndicators = ['required', 'must', 'shall', 'need to', 'necessary'];
  const negativeIndicators = ['not required', 'optional', 'not necessary', 'no need'];

  const hasNegative = negativeIndicators.some((ind) => lowerText.includes(ind));
  const hasPositive = positiveIndicators.some((ind) => lowerText.includes(ind));

  if (hasNegative) {
    return {
      type: 'boolean',
      value: false,
      raw: text.substring(0, 100),
    };
  }

  if (hasPositive) {
    return {
      type: 'boolean',
      value: true,
      raw: text.substring(0, 100),
    };
  }

  return null;
}

function extractTextRule(text: string): ExtractedValue | null {
  const cleanText = text.replace(/\s+/g, ' ').substring(0, 200);

  return {
    type: 'text',
    value: cleanText,
    raw: cleanText,
  };
}

function deduplicateCandidates(candidates: ClauseCandidate[]): ClauseCandidate[] {
  const seen = new Map<string, ClauseCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.clauseType}:${JSON.stringify(candidate.value.value)}`;
    const existing = seen.get(key);

    if (!existing || candidate.matchedPhrases.length > existing.matchedPhrases.length) {
      seen.set(key, candidate);
    }
  }

  return Array.from(seen.values());
}
