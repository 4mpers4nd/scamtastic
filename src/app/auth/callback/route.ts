import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/server';

function safeDestination(value: string | null) {
  if (value === '/game') return '/dashboard';
  if (value === '/dashboard' || value === '/settings' || value === '/activate') return value;
  if (value && /^\/invite\/[a-f0-9]{64}$/.test(value)) return value;
  return '/dashboard';
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  if (code || (tokenHash && (type === 'invite' || type === 'magiclink'))) {
    try {
      const db = await supabaseServer();
      if (code) {
        const { error: exchangeError } = await db.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else if (tokenHash && (type === 'invite' || type === 'magiclink')) {
        const { error: verifyError } = await db.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (verifyError) throw verifyError;
      }
      const destination = safeDestination(url.searchParams.get('next'));
      if (!destination.startsWith('/invite/')) {
        const { error: claimError } = await db.rpc('claim_approved_application');
        if (claimError) throw claimError;
      }
      return NextResponse.redirect(new URL(destination, url.origin));
    } catch (error) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : 'unknown';
      console.error('Authentication callback failed:', code);
    }
  }

  return NextResponse.redirect(new URL('/login?error=callback', url.origin));
}
