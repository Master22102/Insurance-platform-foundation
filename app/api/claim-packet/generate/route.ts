import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { assembleClaimPacketForPdf } from '@/lib/claim-packet/assemble-claim-packet-data';
import { renderClaimPacketPdfBuffer } from '@/lib/claim-packet/generate-pdf';
import { userRateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/claim-packet/generate?packet_id=<uuid>
 * F-6.5.14 — authenticated PDF download for claim preparation packet.
 */
export async function GET(request: NextRequest) {
  const packetId = request.nextUrl.searchParams.get('packet_id')?.trim();
  if (!packetId) {
    return NextResponse.json({ error: 'packet_id is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = userRateLimitedJsonResponse(user.id, 'claim-packet-generate', 10, 60 * 60 * 1000);
  if (limited) return limited;

  const assembled = await assembleClaimPacketForPdf(supabase, packetId);
  if (!assembled.ok) {
    return NextResponse.json(
      { error: assembled.error },
      { status: assembled.status ?? 400 },
    );
  }

  try {
    const pdf = await renderClaimPacketPdfBuffer(assembled.data);
    const filename = `wayfarer-claim-packet-WFR-${assembled.data.wayfarerRefShort}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[claim-packet/generate] PDF render failed', e);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
