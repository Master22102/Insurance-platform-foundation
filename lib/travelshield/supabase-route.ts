import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Cookie-bound Supabase client for Route Handlers (read session only). */
export function createSupabaseRouteClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createServerClient(url, anon, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });
}

export async function getRouteUser(request: NextRequest) {
  const supabase = createSupabaseRouteClient(request);
  if (!supabase) return { supabase: null, user: null as { id: string } | null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user: user?.id ? { id: user.id } : null };
}
