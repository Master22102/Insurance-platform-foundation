import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mustEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return null;
  return { url, anon, service };
}

async function requireFounder(request: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
  const env = mustEnv();
  if (!env) return { ok: false, res: NextResponse.json({ error: 'Server configuration missing' }, { status: 500 }) };
  const auth = createServerClient(env.url, env.anon, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });
  const { data } = await auth.auth.getUser();
  const user = data.user;
  if (!user?.id) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: prof } = await auth.from('user_profiles').select('membership_tier').eq('user_id', user.id).maybeSingle();
  if (prof?.membership_tier !== 'FOUNDER') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}

export async function POST(request: NextRequest) {
  const env = mustEnv();
  if (!env) return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  const gate = await requireFounder(request);
  if (!gate.ok) return gate.res;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const taskId = String(body.task_id || '');
  const title = String(body.title || 'FOCL task overdue');
  const dueDate = String(body.due_date || '');
  if (!taskId) return NextResponse.json({ error: 'task_id required' }, { status: 400 });

  const admin = createClient(env.url, env.service);
  const idempotencyKey = `focl_task_overdue:${taskId}`;

  const { data, error } = await admin
    .from('action_inbox_items')
    .insert({
      feature_id: 'F-FOCL-TASKS',
      incident_id: null,
      source_event_id: null,
      item_type: 'alert',
      status: 'open',
      priority: 'high',
      title: `FOCL task overdue: ${title}`,
      body: dueDate ? `This recurring governance task is overdue (due ${dueDate}).` : 'This recurring governance task is overdue.',
      reason_code: 'focl_task_overdue',
      next_step_hint: 'Review the task and either mark complete, adjust due date, or skip with notes.',
      idempotency_key: idempotencyKey,
      metadata: { task_id: taskId, due_date: dueDate },
    })
    .select('item_id')
    .maybeSingle();

  if (error) {
    // If idempotency key constraint isn't present, or row exists, treat as ok.
    if (String(error.message || '').toLowerCase().includes('duplicate')) {
      return NextResponse.json({ ok: true, item_id: null, idempotent: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item_id: data?.item_id || null, idempotent: false });
}

