import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { processDocument } from '@/lib/document-intelligence';
import { createServerClient } from '@supabase/ssr';

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

function toTitleCase(input: string): string {
  return input
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function formatRuleValue(rule: any): string | null {
  if (!rule?.value) return null;
  const value = rule.value.value;
  const unit = rule.value.unit;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return unit ? `${value} ${unit}` : String(value);
}

function buildActionPlan(promotedRules: any[]): string[] {
  const plan: string[] = [];

  const delayThreshold = promotedRules.find((r) => r.clauseType === 'trip_delay_threshold');
  const delayLimit = promotedRules.find((r) => r.clauseType === 'trip_delay_limit');
  if (delayThreshold || delayLimit) {
    const thresholdText = formatRuleValue(delayThreshold);
    const limitText = formatRuleValue(delayLimit);
    const details = [
      thresholdText ? `delay threshold ${thresholdText}` : null,
      limitText ? `coverage limit ${limitText}` : null,
    ].filter(Boolean).join(', ');
    plan.push(
      details
        ? `For trip delays, check if your event crosses the ${details}.`
        : 'For trip delays, verify the delay threshold and maximum benefit amount before spending.',
    );
  }

  const evidenceMap: Record<string, string> = {
    requires_receipts: 'Keep itemized receipts for covered expenses.',
    requires_carrier_delay_letter: 'Request a carrier delay letter as soon as possible.',
    requires_itinerary: 'Save your itinerary and booking confirmations.',
    requires_payment_proof: 'Keep card statements or payment confirmations.',
    requires_baggage_pir: 'Get a Property Irregularity Report (PIR) from the airline.',
    requires_medical_certificate: 'Obtain a medical certificate if illness/injury is involved.',
    requires_police_report: 'File a police report where required by the policy.',
  };

  for (const rule of promotedRules) {
    if (rule.value?.value === true && evidenceMap[rule.clauseType]) {
      plan.push(evidenceMap[rule.clauseType]);
    }
  }

  const claimDeadline = promotedRules.find((r) => r.clauseType === 'claim_deadline_days');
  if (claimDeadline) {
    const deadlineText = formatRuleValue(claimDeadline);
    if (deadlineText) {
      plan.push(`Start the claim packet now. Your filing window appears to be ${deadlineText}.`);
    }
  }

  return Array.from(new Set(plan)).slice(0, 5);
}

function buildClaimRouting(promotedRules: any[]): string[] {
  const hasCardSignals = promotedRules.some(
    (r) =>
      r.clauseType === 'payment_method_requirement' ||
      r.clauseType === 'common_carrier_requirement',
  );
  const hasCarrierSignals = promotedRules.some(
    (r) =>
      r.clauseType === 'carrier_liability_cap' ||
      r.clauseType === 'eu_delay_compensation_threshold' ||
      r.clauseType === 'eu_denied_boarding_compensation',
  );
  const hasPolicySignals = promotedRules.some(
    (r) =>
      r.clauseType.startsWith('trip_') ||
      r.clauseType.startsWith('medical_') ||
      r.clauseType === 'rental_car_damage_limit',
  );

  const routing: string[] = [];
  if (hasCardSignals) routing.push('1) Card benefits administrator (if paid with eligible card)');
  if (hasCarrierSignals) routing.push('2) Airline/carrier channel for delay or baggage obligations');
  if (hasPolicySignals) routing.push('3) Primary travel insurer with your full evidence packet');
  if (routing.length === 0) {
    routing.push('1) Policy insurer (primary)');
    routing.push('2) Card benefits administrator (if card terms apply)');
    routing.push('3) Carrier channel where legal obligations exist');
  }
  return routing.slice(0, 3);
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        // No-op setters: this endpoint doesn't need to refresh tokens for our flows.
        set: () => {},
        remove: () => {},
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('scan_credits_remaining')
      .eq('user_id', user.id)
      .maybeSingle();

    const creditsRemaining = (profile as any)?.scan_credits_remaining ?? 0;
    if (creditsRemaining <= 0) {
      return NextResponse.json({ error: 'No scan credits remaining.' }, { status: 403 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'tmp';
    const tmpPath = join('/tmp', `${randomUUID()}.${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
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
      .eq('user_id', user.id);

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

    const actionPlan = buildActionPlan(promotedRules);
    const claimRouting = buildClaimRouting(promotedRules);
    const strongestRule = promotedRules[0];
    const advisorySummary = strongestRule
      ? `${toTitleCase(strongestRule.clauseType)} detected${formatRuleValue(strongestRule) ? ` (${formatRuleValue(strongestRule)})` : ''}.`
      : 'No strong coverage rules were promoted from this document.';

    return NextResponse.json({
      document_name: file.name,
      quality,
      coverage_categories: coverageCategories,
      highlights: highlights.filter(Boolean),
      documentation_hints: docHints.filter(Boolean),
      advisory_summary: advisorySummary,
      action_plan: actionPlan,
      claim_routing: claimRouting,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      raw_rule_count: promotedRules.length,
    });
  } catch (err) {
    console.error('[quick-scan]', err);
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }
}
