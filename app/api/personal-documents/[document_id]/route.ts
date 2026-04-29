import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { document_id: string } },
) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const { data, error } = await admin
    .from('personal_documents')
    .update({
      label: body.label ? String(body.label) : undefined,
      description: body.description !== undefined ? body.description : undefined,
      country_code: body.country_code ? String(body.country_code).toUpperCase() : undefined,
      expires_at: body.expires_at !== undefined ? body.expires_at : undefined,
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('document_id', params.document_id)
    .eq('account_id', user.id)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, document: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { document_id: string } },
) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  const { error } = await admin
    .from('personal_documents')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('document_id', params.document_id)
    .eq('account_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
