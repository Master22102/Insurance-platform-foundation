import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://glgoolvfnnejmneprbms.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZ29vbHZmbm5lam1uZXByYm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTExMDUsImV4cCI6MjA4NzE4NzEwNX0.MSlnt7sUfrF4Moc1ly1fo0QzMC7t7UXlVLdSJk11k18';

export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });
}
