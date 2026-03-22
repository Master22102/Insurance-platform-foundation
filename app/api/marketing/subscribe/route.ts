import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clientIpFromRequest, rateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req);
    const max = Number(process.env.MARKETING_SUBSCRIBE_RATE_LIMIT_MAX ?? 5);
    const windowMs = Number(process.env.MARKETING_SUBSCRIBE_RATE_LIMIT_WINDOW_MS ?? 3_600_000);
    const limited = rateLimitedJsonResponse(`marketing_subscribe:${ip}`, max, windowMs);
    if (limited) return limited;

    const { email, source = 'footer' } = await req.json();
    if (
      !email ||
      typeof email !== 'string' ||
      !email.includes('@') ||
      email.length > 254 ||
      email.trim().length < 3
    ) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    await supabase.from('marketing_subscribers').upsert(
      { email: email.toLowerCase().trim(), source },
      { onConflict: 'email' },
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
