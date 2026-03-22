import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  /* Never echo env prefixes — even in dev — to reduce accidental disclosure in screenshots/logs. */
  return NextResponse.json({
    url_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    key_set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
