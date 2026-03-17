export type CaptureStatus =
  | 'READY_FOR_PARSE'
  | 'ANTI_BOT_BLOCKED'
  | 'LOW_LEGAL_DENSITY'
  | 'SHELL_ONLY'
  | 'PARTIAL_CAPTURE'
  | 'PDF_PREFERRED';

export interface QualityMetrics {
  textLength: number;
  normalizedTextLength: number;
  legalKeywordCount: number;
  legalPhraseCount: number;
  legalKeywordDensity: number;
  uiKeywordCount: number;
  uiKeywordDensity: number;
  headingCount: number;
  headingDensity: number;
  antiBotIndicators: string[];
  antiBotDetected: boolean;
  qualityScore: number;
  status: CaptureStatus;
  warnings: string[];
  debugInfo: {
    matchedLegalKeywords: string[];
    matchedLegalPhrases: string[];
    matchedUIKeywords: string[];
    scoringTextLength: number;
  };
}

const LEGAL_KEYWORDS = [
  'contract',
  'carriage',
  'liability',
  'baggage',
  'refund',
  'cancellation',
  'claim',
  'policy',
  'policies',
  'terms',
  'conditions',
  'agreement',
  'passenger',
  'compensation',
  'damage',
  'delay',
  'insurance',
  'regulation',
  'shall',
  'herein',
  'thereof',
  'warranty',
  'indemnify',
  'indemnification',
  'limitation',
  'jurisdiction',
  'governing',
  'dispute',
  'ticket',
  'fare',
  'reservation',
  'booking',
];

const LEGAL_PHRASES = [
  'contract of carriage',
  'terms and conditions',
  'terms of use',
  'conditions of carriage',
  'general conditions',
  'baggage liability',
  'limited liability',
  'liability limitation',
  'refund policy',
  'cancellation policy',
  'force majeure',
  'applicable law',
  'dispute resolution',
  'arbitration clause',
  'checked baggage',
  'carry-on baggage',
  'passenger rights',
  'booking conditions',
  'fare rules',
  'ticket validity',
];

const UI_KEYWORDS = [
  'navigation',
  'menu',
  'sidebar',
  'cookie',
  'consent',
  'accept',
  'dismiss',
  'login',
  'sign in',
  'sign up',
  'search',
  'filter',
  'sort',
  'cart',
  'checkout',
  'subscribe',
  'newsletter',
];

const ANTI_BOT_PHRASES = [
  'access denied',
  'verify you are human',
  'unusual traffic',
  'captcha',
  'blocked',
  'forbidden',
  'not authorized',
  'security check',
  'bot detected',
  'automated access',
  'ddos protection',
  'cloudflare',
  'rate limit',
  'suspicious activity',
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .trim();
}

function extractMainContentText(html: string): string {
  const scriptAndStyleRegex = /<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi;
  const cleanHtml = html.replace(scriptAndStyleRegex, ' ');

  const tagRegex = /<[^>]+>/g;
  const text = cleanHtml.replace(tagRegex, ' ');

  const decoded = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return decoded;
}

function countKeywords(text: string, keywords: string[]): { count: number; matches: string[] } {
  const normalizedText = normalizeText(text);
  let count = 0;
  const matches: string[] = [];

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    const keywordMatches = normalizedText.match(regex);
    if (keywordMatches) {
      count += keywordMatches.length;
      if (!matches.includes(keyword)) {
        matches.push(keyword);
      }
    }
  }

  return { count, matches };
}

function countPhrases(text: string, phrases: string[]): { count: number; matches: string[] } {
  const normalizedText = normalizeText(text);
  let count = 0;
  const matches: string[] = [];

  for (const phrase of phrases) {
    const normalizedPhrase = normalizeText(phrase);
    const regex = new RegExp(normalizedPhrase, 'g');
    const phraseMatches = normalizedText.match(regex);
    if (phraseMatches) {
      count += phraseMatches.length;
      if (!matches.includes(phrase)) {
        matches.push(phrase);
      }
    }
  }

  return { count, matches };
}

function detectAntiBotIndicators(text: string): string[] {
  const lowerText = text.toLowerCase();
  const detected: string[] = [];

  for (const phrase of ANTI_BOT_PHRASES) {
    if (lowerText.includes(phrase)) {
      detected.push(phrase);
    }
  }

  return detected;
}

function countHeadings(html: string): number {
  const headingMatches = html.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi);
  return headingMatches ? headingMatches.length : 0;
}

function extractHeadingText(html: string): string {
  const headingMatches = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi);
  if (!headingMatches) return '';

  return headingMatches
    .map(h => h.replace(/<[^>]+>/g, ' '))
    .join(' ');
}

function calculateQualityScore(
  normalizedTextLength: number,
  legalKeywordCount: number,
  legalPhraseCount: number,
  legalDensity: number,
  uiDensity: number,
  headingDensity: number,
  antiBotDetected: boolean
): number {
  if (antiBotDetected) {
    return 0;
  }

  if (normalizedTextLength < 100) {
    return 0;
  }

  let score = 0;

  if (normalizedTextLength >= 10000) {
    score += 25;
  } else if (normalizedTextLength >= 5000) {
    score += 20;
  } else if (normalizedTextLength >= 1000) {
    score += 15;
  } else if (normalizedTextLength >= 500) {
    score += 10;
  }

  if (legalDensity >= 0.02) {
    score += 40;
  } else if (legalDensity >= 0.01) {
    score += 35;
  } else if (legalDensity >= 0.005) {
    score += 25;
  } else if (legalDensity >= 0.002) {
    score += 15;
  }

  if (legalPhraseCount >= 5) {
    score += 15;
  } else if (legalPhraseCount >= 3) {
    score += 10;
  } else if (legalPhraseCount >= 1) {
    score += 5;
  }

  if (uiDensity < 0.005) {
    score += 10;
  } else if (uiDensity < 0.01) {
    score += 5;
  }

  if (headingDensity >= 0.0001 && headingDensity <= 0.01) {
    score += 10;
  } else if (headingDensity > 0.01 && headingDensity <= 0.02) {
    score += 5;
  }

  return Math.min(100, score);
}

function determineStatus(
  normalizedTextLength: number,
  legalDensity: number,
  legalPhraseCount: number,
  qualityScore: number,
  antiBotDetected: boolean
): CaptureStatus {
  if (antiBotDetected) {
    return 'ANTI_BOT_BLOCKED';
  }

  if (normalizedTextLength < 500) {
    return 'SHELL_ONLY';
  }

  if (legalPhraseCount >= 3 && legalDensity >= 0.005) {
    if (qualityScore >= 70) {
      return 'READY_FOR_PARSE';
    }
    if (qualityScore >= 50) {
      return 'PARTIAL_CAPTURE';
    }
  }

  if (legalDensity < 0.002 && legalPhraseCount < 2) {
    return 'LOW_LEGAL_DENSITY';
  }

  if (qualityScore >= 70) {
    return 'READY_FOR_PARSE';
  }

  if (qualityScore >= 50) {
    return 'PARTIAL_CAPTURE';
  }

  if (normalizedTextLength > 5000 && legalDensity < 0.005) {
    return 'PDF_PREFERRED';
  }

  return 'LOW_LEGAL_DENSITY';
}

export function evaluateQuality(html: string, text: string): QualityMetrics {
  const mainContentText = extractMainContentText(html);
  const normalizedText = normalizeText(mainContentText);
  const normalizedTextLength = normalizedText.length;

  const headingText = extractHeadingText(html);
  const combinedScoringText = headingText + ' ' + mainContentText;

  const legalKeywordResult = countKeywords(combinedScoringText, LEGAL_KEYWORDS);
  const legalPhraseResult = countPhrases(combinedScoringText, LEGAL_PHRASES);
  const uiKeywordResult = countKeywords(mainContentText, UI_KEYWORDS);

  const headingCount = countHeadings(html);
  const antiBotIndicators = detectAntiBotIndicators(text);
  const antiBotDetected = antiBotIndicators.length > 0;

  const scoringTextLength = normalizedText.length;
  const legalKeywordCount = legalKeywordResult.count;
  const legalPhraseCount = legalPhraseResult.count;
  const uiKeywordCount = uiKeywordResult.count;

  const legalKeywordDensity = scoringTextLength > 0 ? legalKeywordCount / scoringTextLength : 0;
  const uiKeywordDensity = scoringTextLength > 0 ? uiKeywordCount / scoringTextLength : 0;
  const headingDensity = scoringTextLength > 0 ? headingCount / scoringTextLength : 0;

  const qualityScore = calculateQualityScore(
    normalizedTextLength,
    legalKeywordCount,
    legalPhraseCount,
    legalKeywordDensity,
    uiKeywordDensity,
    headingDensity,
    antiBotDetected
  );

  const status = determineStatus(
    normalizedTextLength,
    legalKeywordDensity,
    legalPhraseCount,
    qualityScore,
    antiBotDetected
  );

  const warnings: string[] = [];

  if (status === 'ANTI_BOT_BLOCKED') {
    warnings.push(`Anti-bot protection detected: ${antiBotIndicators.join(', ')}`);
  }

  if (normalizedTextLength < 1000) {
    warnings.push('Very short content, may be incomplete');
  }

  if (legalKeywordDensity < 0.002 && legalPhraseCount < 2 && status !== 'ANTI_BOT_BLOCKED') {
    warnings.push('Low legal keyword density, may not be legal document');
  }

  if (uiKeywordDensity > 0.02) {
    warnings.push('High UI keyword density, may include significant navigation/chrome');
  }

  if (headingCount === 0) {
    warnings.push('No headings detected, may lack structure');
  }

  return {
    textLength: text.length,
    normalizedTextLength,
    legalKeywordCount,
    legalPhraseCount,
    legalKeywordDensity,
    uiKeywordCount,
    uiKeywordDensity,
    headingCount,
    headingDensity,
    antiBotIndicators,
    antiBotDetected,
    qualityScore,
    status,
    warnings,
    debugInfo: {
      matchedLegalKeywords: legalKeywordResult.matches,
      matchedLegalPhrases: legalPhraseResult.matches,
      matchedUIKeywords: uiKeywordResult.matches,
      scoringTextLength,
    },
  };
}

export function recommendParserMode(status: CaptureStatus, qualityScore: number): string {
  switch (status) {
    case 'READY_FOR_PARSE':
      return 'document-intelligence';
    case 'ANTI_BOT_BLOCKED':
      return 'manual-review-required';
    case 'LOW_LEGAL_DENSITY':
      return 'verify-content-type';
    case 'SHELL_ONLY':
      return 'retry-with-different-method';
    case 'PARTIAL_CAPTURE':
      return qualityScore >= 50 ? 'document-intelligence' : 'pdf-fallback';
    case 'PDF_PREFERRED':
      return 'pdf-fallback';
    default:
      return 'unknown';
  }
}
