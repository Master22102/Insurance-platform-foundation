type VisaRule = 'visa_free' | 'visa_required' | 'unknown';

const COUNTRY_TO_CODE: Record<string, string> = {
  japan: 'JP',
  'united states': 'US',
  usa: 'US',
  canada: 'CA',
  'united kingdom': 'GB',
  uk: 'GB',
  france: 'FR',
  germany: 'DE',
  italy: 'IT',
  spain: 'ES',
  portugal: 'PT',
  greece: 'GR',
  thailand: 'TH',
  singapore: 'SG',
  australia: 'AU',
  mexico: 'MX',
  brazil: 'BR',
  india: 'IN',
  china: 'CN',
  'south korea': 'KR',
};

// Seed matrix: enough to drive adaptive UX now; can be replaced by live provider.
const VISA_MATRIX: Record<string, Record<string, VisaRule>> = {
  JP: {
    US: 'visa_free',
    CA: 'visa_free',
    GB: 'visa_free',
    FR: 'visa_free',
    DE: 'visa_free',
    IT: 'visa_free',
    ES: 'visa_free',
    PT: 'visa_free',
    GR: 'visa_free',
    SG: 'visa_free',
    TH: 'visa_free',
    AU: 'visa_free',
    IN: 'visa_required',
    CN: 'visa_required',
  },
  US: {
    JP: 'visa_free',
    GB: 'visa_free',
    FR: 'visa_free',
    DE: 'visa_free',
    IT: 'visa_free',
    ES: 'visa_free',
    PT: 'visa_free',
    GR: 'visa_free',
    CA: 'visa_free',
    SG: 'visa_free',
    TH: 'visa_free',
    AU: 'visa_free',
    IN: 'visa_required',
    CN: 'visa_required',
  },
};

export function normalizeCountryToCode(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();
  if (/^[A-Z]{2}$/.test(clean)) return clean;
  const mapped = COUNTRY_TO_CODE[clean.toLowerCase()];
  return mapped || null;
}

export function evaluateVisaRule(originCode: string | null, destinationCode: string | null): VisaRule {
  if (!originCode || !destinationCode) return 'unknown';
  if (originCode === destinationCode) return 'visa_free';
  const rule = VISA_MATRIX[originCode]?.[destinationCode];
  return rule || 'unknown';
}

export function summarizeVisaRules(
  originCode: string | null,
  destinations: Array<{ name: string; code: string | null }>,
): { label: string; severity: 'ok' | 'warn' | 'info' }[] {
  if (!originCode || destinations.length === 0) {
    return [{
      label: 'Add nationality and destination details to auto-check entry requirements.',
      severity: 'info',
    }];
  }

  const out: { label: string; severity: 'ok' | 'warn' | 'info' }[] = [];
  for (const d of destinations) {
    const rule = evaluateVisaRule(originCode, d.code);
    if (rule === 'visa_free') {
      out.push({ label: `${d.name}: likely visa-free for your profile nationality.`, severity: 'ok' });
    } else if (rule === 'visa_required') {
      out.push({ label: `${d.name}: visa may be required. Verify entry timing and documentation now.`, severity: 'warn' });
    } else {
      out.push({ label: `${d.name}: entry requirement unclear from current data. Manual verification recommended.`, severity: 'info' });
    }
  }
  return out.slice(0, 6);
}

