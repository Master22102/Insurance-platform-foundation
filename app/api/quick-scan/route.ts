import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { processDocument } from '@/lib/document-intelligence';
import { createServerClient } from '@/lib/supabase/server';
import { computeItineraryHash, fingerprintBuffer } from '@/lib/itinerary-hash';

const FAMILY_CATEGORY_MAP: Record<string, string> = {
  'delay-threshold-pass':       'Trip Delay',
  'liability-pass':             'Liability',
  'refund-cancellation-pass':   'Trip Cancellation',
  'documentation-requirements-pass': 'Documentation Requirements',
  'payment-eligibility-pass':   'Payment Eligibility',
  'medical-insurance-pass':     'Medical Insurance',
  'rental-car-pass':            'Rental Car Coverage',
  'cruise-booking-pass':        'Cruise Booking Protection',
  'additional-insurance-pass':  'Additional Insurance',
  'eu-passenger-rights-pass':   'EU Passenger Rights',
};

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tripId = (formData.get('trip_id') as string | null) || null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const docFingerprint = fingerprintBuffer(buffer);

    let tripParts: any = {};
    if (tripId) {
      const { data: tripRow } = await supabase
        .from('trips')
        .select('destination_summary, departure_date, return_date, travel_mode_primary, adults_count, children_count, infant_count')
        .eq('trip_id', tripId)
        .maybeSingle();
      tripParts = tripRow || {};
    }

    const itineraryHash = computeItineraryHash({
      destination: tripParts.destination_summary,
      departure_date: tripParts.departure_date,
      return_date: tripParts.return_date,
      travel_mode: tripParts.travel_mode_primary,
      adults_count: tripParts.adults_count,
      children_count: tripParts.children_count,
      infant_count: tripParts.infant_count,
      document_fingerprint: docFingerprint,
    });

    const hashKey = `${user.id}:${itineraryHash}`;
    const { data: cached } = await supabase
      .from('quick_scan_results')
      .select('computed_payload, computed_at')
      .eq('hash_key', hashKey)
      .maybeSingle();

    if (cached?.computed_payload) {
      return NextResponse.json({
        ...(cached.computed_payload as any),
        cache_hit: true,
        computed_at: cached.computed_at,
        itinerary_hash: itineraryHash,
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('scan_credits_remaining')
      .eq('id', user.id)
      .maybeSingle();
    const creditsRemaining = (profile as any)?.scan_credits_remaining ?? 0;
    if (creditsRemaining <= 0) {
      return NextResponse.json({ error: 'No scan credits remaining.' }, { status: 403 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'tmp';
    const tmpPath = join('/tmp', `${randomUUID()}.${ext}`);
    await writeFile(tmpPath, buffer);

    let result;
    try {
      result = await processDocument(tmpPath, file.name);
    } finally {
      await unlink(tmpPath).catch(() => {});
    }

    await supabase
      .from('user_profiles')
      .update({ scan_credits_remaining: Math.max(0, creditsRemaining - 1) })
      .eq('id', user.id);

    await supabase.from('scan_credit_ledger').insert({
      account_id: user.id,
      delta: -1,
      reason: 'quick_scan_used',
      scan_type: 'basic',
    });

    const promotedRules = result.promotedRules || [];
    const candidates = result.candidates || [];

    const familyCounts: Record<string, number> = {};
    for (const rule of promotedRules) {
      const fam = (rule as any).familyPass || 'unknown';
      familyCounts[fam] = (familyCounts[fam] || 0) + 1;
    }

    const coverageCategories = Object.entries(familyCounts).map(([pass, count]) => ({
      category: FAMILY_CATEGORY_MAP[pass] || pass.replace(/-pass$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: `${count} clause${count !== 1 ? 's' : ''} found`,
    }));

    const highlights: string[] = [];
    for (const rule of promotedRules.slice(0, 5)) {
      const r = rule as any;
      if (r.value && r.unit) {
        highlights.push(`${r.clauseType?.replace(/_/g, ' ') || 'Coverage'}: ${r.value} ${r.unit}`);
      } else if (r.canonicalText) {
        highlights.push(r.canonicalText.slice(0, 120));
      }
    }

    const docHints = candidates
      .filter((c: any) => (c.familyPass || '').includes('documentation'))
      .slice(0, 4)
      .map((c: any) => c.canonicalText?.slice(0, 100) || '');

    const quality: 'high' | 'medium' | 'low' =
      promotedRules.length >= 5 ? 'high' :
      promotedRules.length >= 2 ? 'medium' : 'low';

    const payload = {
      document_name: file.name,
      quality,
      coverage_categories: coverageCategories,
      highlights: highlights.filter(Boolean),
      documentation_hints: docHints.filter(Boolean),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      raw_rule_count: promotedRules.length,
    };

    await supabase.rpc('upsert_quick_scan_result', {
      p_account_id: user.id,
      p_itinerary_hash: itineraryHash,
      p_payload: payload,
      p_trip_id: tripId,
    });

    return NextResponse.json({
      ...payload,
      cache_hit: false,
      itinerary_hash: itineraryHash,
    });
  } catch (err) {
    console.error('[quick-scan]', err);
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }
}
