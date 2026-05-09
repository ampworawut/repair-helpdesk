import { createClient as supabaseCreateClient } from '@supabase/supabase-js';

export function createClient(useServiceRole = false) {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    useServiceRole
      ? process.env.SUPABASE_SERVICE_ROLE_KEY!
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
