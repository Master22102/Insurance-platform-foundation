import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { data, error } = await admin
    .from('personal_documents')
    .select('*')
    .eq('account_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data || [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const payload = {
    account_id: user.id,
    document_type: String(body.document_type || 'other'),
    label: String(body.label || '').trim(),
    description: body.description ? String(body.description) : null,
    country_code: body.country_code ? String(body.country_code).toUpperCase() : null,
    expires_at: body.expires_at ? String(body.expires_at) : null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  };
  if (!payload.label) return NextResponse.json({ error: 'label required' }, { status: 400 });

  const { data, error } = await admin.from('personal_documents').insert(payload).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await emitTravelShieldEvent(admin, {
    eventType: 'personal_document_uploaded',
    featureId: 'F-EMERGENCY-VAULT',
    scopeType: 'user',
    scopeId: user.id,
    actorId: user.id,
    metadata: { account_id: user.id, document_type: payload.document_type, document_id: data?.document_id || null },
    idempotencyKey: `personal_document_uploaded:${user.id}:${data?.document_id || Date.now()}`,
  });

  return NextResponse.json({ ok: true, document: data });
}
