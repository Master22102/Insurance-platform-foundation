import { AxisProvider } from '../types';

async function fetchJsonWithTimeout(url: string, timeoutMs = 6000): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export const frankfurterCurrencyProvider: AxisProvider = {
  id: 'frankfurter.financial-currency',
  axis: 'financial_currency',
  enabled: true,
  async fetch(context) {
    if (!context.isInternational) {
      return {
        axis: 'financial_currency',
        source: 'frankfurter',
        status: 'unavailable',
        summary: 'Currency intelligence is only shown for international trips.',
        fetchedAt: new Date().toISOString(),
      };
    }

    try {
      const data = await fetchJsonWithTimeout('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CAD');
      const rates = data?.rates || {};
      const bits = ['EUR', 'GBP', 'JPY', 'CAD']
        .filter((k) => typeof rates[k] === 'number')
        .map((k) => `USD/${k} ${Number(rates[k]).toFixed(3)}`);
      return {
        axis: 'financial_currency',
        source: 'frankfurter',
        status: bits.length > 0 ? 'ok' : 'degraded',
        summary: bits.length > 0
          ? `Recent currency reference: ${bits.join(' · ')}`
          : 'Currency feed returned limited data.',
        details: {
          base: data?.base || 'USD',
          date: data?.date || null,
          rates,
        },
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return {
        axis: 'financial_currency',
        source: 'frankfurter',
        status: 'degraded',
        summary: 'Currency provider unavailable. Showing fallback guidance only.',
        fetchedAt: new Date().toISOString(),
      };
    }
  },
};

