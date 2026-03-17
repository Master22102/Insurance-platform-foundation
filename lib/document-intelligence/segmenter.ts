import { TextSection } from './types';

export function segmentText(text: string): TextSection[] {
  const lines = text.split('\n');
  const sections: TextSection[] = [];
  let currentSection: { heading: string | null; content: string[]; startIndex: number; level: number } | null = null;
  let charIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const isHeading = detectHeading(trimmed, i > 0 ? lines[i - 1] : null);

    if (isHeading) {
      if (currentSection && currentSection.content.length > 0) {
        const content = currentSection.content.join('\n');
        sections.push({
          heading: currentSection.heading,
          content,
          startIndex: currentSection.startIndex,
          endIndex: charIndex,
          level: currentSection.level,
        });
      }

      currentSection = {
        heading: trimmed,
        content: [],
        startIndex: charIndex,
        level: isHeading.level,
      };
    } else if (trimmed.length > 0) {
      if (!currentSection) {
        currentSection = {
          heading: null,
          content: [],
          startIndex: charIndex,
          level: 0,
        };
      }
      currentSection.content.push(line);
    }

    charIndex += line.length + 1;
  }

  if (currentSection && currentSection.content.length > 0) {
    const content = currentSection.content.join('\n');
    sections.push({
      heading: currentSection.heading,
      content,
      startIndex: currentSection.startIndex,
      endIndex: charIndex,
      level: currentSection.level,
    });
  }

  return sections;
}

function detectHeading(
  line: string,
  prevLine: string | null
): { level: number } | null {
  if (line.length === 0) return null;

  if (/^[IVX]+\.\s+[A-Z]/.test(line)) {
    return { level: 1 };
  }

  if (/^\d+\.\s+[A-Z][A-Za-z\s]+$/.test(line) && line.length < 100) {
    return { level: 2 };
  }

  if (/^\d+\.\d+\s+[A-Z]/.test(line)) {
    return { level: 3 };
  }

  if (/^\d+\.\d+\.\d+\s+[A-Z]/.test(line)) {
    return { level: 4 };
  }

  if (/^[A-Z][A-Z\s]{3,}$/.test(line) && line.length < 80) {
    return { level: 1 };
  }

  if (/^(ARTICLE|SECTION|CHAPTER|PART|RULE|CLAUSE)\s+[IVX\d]+/i.test(line)) {
    return { level: 1 };
  }

  const legalHeadings = [
    'baggage',
    'liability',
    'refund',
    'cancellation',
    'damages',
    'compensation',
    'delay',
    'denied boarding',
    'carriage',
    'ticket',
    'fare',
    'reservation',
    'booking',
    'payment',
    'documentation',
    'conditions of',
    'terms of',
    'checked baggage',
    'carry-on',
  ];

  const lowerLine = line.toLowerCase();
  for (const legalTerm of legalHeadings) {
    if (lowerLine.includes(legalTerm) && line.length < 100 && /^[A-Z0-9]/.test(line)) {
      return { level: 2 };
    }
  }

  if (/^[a-z]\.\s+[A-Z]/.test(line)) {
    return { level: 4 };
  }

  if (
    /^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,6}$/.test(line) &&
    line.length < 80 &&
    line.split(' ').length <= 7 &&
    prevLine?.trim().length === 0
  ) {
    return { level: 2 };
  }

  return null;
}
