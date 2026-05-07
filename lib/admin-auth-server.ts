import 'server-only';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';

export interface ServerAdminUser {
  id: string;
  email: string;
  full_name: string | null;
}

export async function requireAdminServer(): Promise<ServerAdminUser> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/admin/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single<{ id: string; email: string; full_name: string | null; role: 'admin' | 'customer' }>();

  if (profileError || !profile || profile.role !== 'admin') {
    redirect('/admin/login');
  }

  return {
    id: profile.id,
    email: profile.email || user.email || '',
    full_name: profile.full_name,
  };
}
