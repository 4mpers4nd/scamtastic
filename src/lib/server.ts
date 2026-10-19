import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getUserOrNull } from '@/lib/auth-state.mjs';

export async function supabaseServer() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) throw new Error('Supabase environment variables missing');

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(values: { name: string; value: string; options: CookieOptions }[]) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server components cannot write cookies; middleware handles session refresh.
        }
      },
    },
  });
}

export function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for secure server-side operations');
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function authenticatedUser() {
  const db = await supabaseServer();
  const user = await getUserOrNull(db.auth);
  return { db, user };
}

export async function administratorUser() {
  const { db, user } = await authenticatedUser();
  if (!user) return { db, user: null, isAdmin: false };

  const { data, error } = await db.rpc('is_scamtastic_admin');
  if (error) throw error;
  return { db, user, isAdmin: data === true };
}
