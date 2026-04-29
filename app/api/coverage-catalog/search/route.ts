import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { clientIpFromRequest, rateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';

const CATALOG_TYPES = [
  'credit_card_benefit',
  'airline_contract',
  'travel_insurance',
  'car_rental',
  'other',
] as const;

/**
 * GET /api/coverage-catalog/search?q=&type=
 * F-6.5.17 v3 — uses RPC `search_coverage_catalog` (ILIKE, spec-aligned types).
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  const catalogType = request.nextUrl.searchParams.get('type') || '';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
  }

  let response = NextResponse.json({ ok: true, items: [] as unknown[] });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: (name, value, options) => {
        response.cookies.set({ name, value, ...options });
      },
      remove: (name, options) => {
        response.cookies.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = clientIpFromRequest(request);
  const catLimited = rateLimitedJsonResponse(`coverage-catalog-search:${ip}`, 100, 15 * 60 * 1000);
  if (catLimited) return catLimited;

  const typeFilter =
    catalogType && (CATALOG_TYPES as readonly string[]).includes(catalogType) ? catalogType : null;

  const { data, error } = await supabase.rpc('search_coverage_catalog', {
    p_query: q,
    p_catalog_type: typeFilter,
    p_limit: 20,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, hint: 'Apply migration 20260330100300 for search_coverage_catalog.' },
      { status: 400 },
    );
  }

  response = NextResponse.json({ ok: true, items: data ?? [] });
  return response;
}
