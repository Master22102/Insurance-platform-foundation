import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc('emit_elapsed_clause_timers');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ emitted: data ?? 0 });
  } catch (err) {
    console.error('[clause-timers:tick]', err);
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
