import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Browser Supabase client using cookies compatible with @supabase/ssr.
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

// Admin check helper
export const isAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single<{ role: 'admin' | 'customer' }>();

  if (error || !data) return false;
  return data.role === 'admin';
};
