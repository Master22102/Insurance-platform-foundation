import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    url_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    key_set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    url_prefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) || 'NOT SET',
    key_prefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20) || 'NOT SET',
  });
}
