import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase public environment variables');
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
}

function createTokenClient(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createRequestClient(accessToken: string | null | undefined) {
  return accessToken ? createTokenClient(accessToken) : createSupabaseServerClient();
}

export async function requireAdmin(accessToken?: string | null): Promise<AdminUser> {
  const authClient = createRequestClient(accessToken);

  const {
    data: { user },
    error: userError,
  } = accessToken ? await authClient.auth.getUser(accessToken) : await authClient.auth.getUser();

  if (userError || !user) {
    throw new Error('UNAUTHORIZED');
  }

  const { data: profile, error: profileError } = await authClient
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single<{ id: string; email: string; full_name: string | null; role: 'admin' | 'customer' }>();

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }

  return {
    id: profile.id,
    email: profile.email || user.email || '',
    full_name: profile.full_name,
  };
}

export async function createAdminActionClient(accessToken?: string | null) {
  await requireAdmin(accessToken);
  return createRequestClient(accessToken);
}
