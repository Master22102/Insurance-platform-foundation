import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, getRouteUser } from '@/lib/travelshield/supabase-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RateCacheEntry = { at: number; payload: unknown };
const rateCache = new Map<string, RateCacheEntry>();
const ONE_HOUR_MS = 60 * 60 * 1000;

async function frankfurterRate(from: string, to: string): Promise<{ rate: number; date: string | null } | null> {
  const key = `${from}_${to}`.toUpperCase();
  const now = Date.now();
  const hit = rateCache.get(key);
  if (hit && now - hit.at < ONE_HOUR_MS) {
    return hit.payload as { rate: number; date: string | null };
  }
  if (from === to) {
    const payload = { rate: 1, date: null };
    rateCache.set(key, { at: now, payload });
    return payload;
  }
  try {
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number>; date?: string };
    const r = data.rates?.[to.toUpperCase()];
    if (typeof r !== 'number') return null;
    const payload = { rate: r, date: data.date || null };
    rateCache.set(key, { at: now, payload });
    return payload;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseRouteClient(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const countryCode = (request.nextUrl.searchParams.get('country_code') || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return NextResponse.json({ error: 'country_code must be ISO-3166 alpha-2' }, { status: 400 });
  }

  const baseCurrency = (request.nextUrl.searchParams.get('base_currency') || 'USD').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(baseCurrency)) {
    return NextResponse.json({ error: 'base_currency must be ISO-4217 alpha-3' }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from('country_reference_data')
    .select('*')
    .eq('country_code', countryCode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Unknown country' }, { status: 404 });
  }

  const localCurrency = String((row as { currency_code?: string }).currency_code || baseCurrency).toUpperCase();
  const fx = await frankfurterRate(localCurrency, baseCurrency);

  return NextResponse.json({
    country: row,
    exchange: fx
      ? {
          base_currency: baseCurrency,
          quote_currency: localCurrency,
          rate: fx.rate,
          date: fx.date,
          label:
            localCurrency === baseCurrency
              ? `1 ${localCurrency} = 1 ${baseCurrency}`
              : `1 ${localCurrency} ≈ ${fx.rate.toFixed(4)} ${baseCurrency}`,
        }
      : null,
  });
}
