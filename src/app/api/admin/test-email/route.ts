import { NextResponse, type NextRequest } from 'next/server';
import { consumeEmailRateLimit } from '@/lib/email-rate-limit.mjs';
import { sendTestEmail } from '@/lib/activation';
import { authenticatedUser } from '@/lib/server';

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: 'Same-origin request required.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const { db, user } = await authenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Administrator sign-in required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (!user.email || !user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'A verified administrator email address is required.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: isAdmin, error: adminError } = await db.rpc('is_scamtastic_admin');
    if (adminError) {
      throw new Error(`Administrator verification failed (${adminError.code ?? 'unknown'}).`);
    }
    if (isAdmin !== true) {
      return NextResponse.json(
        { error: 'Administrator access required.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const limit = consumeEmailRateLimit(user.id);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Please wait ${limit.retryAfterSeconds} seconds before sending another test email.` },
        {
          status: 429,
          headers: {
            'Retry-After': String(limit.retryAfterSeconds),
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    await sendTestEmail(user.email);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : 'Unknown email delivery error.';
    console.error('Administrator test email failed:', diagnostic);
    return NextResponse.json(
      { error: 'The test email could not be sent. Check the server configuration and logs.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
