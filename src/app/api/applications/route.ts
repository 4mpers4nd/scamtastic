import { createHmac } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseService } from '@/lib/server';

type ApplicationInput = {
  username?: unknown;
  email?: unknown;
  reason?: unknown;
  referralCode?: unknown;
  comments?: unknown;
};

function validString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

export async function POST(request: NextRequest) {
  const size = Number(request.headers.get('content-length') ?? 0);
  if (size > 8192) {
    return NextResponse.json({ error: 'Application is too large.' }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid application data.' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Invalid application data.' }, { status: 400 });
  }
  const input = payload as ApplicationInput;

  const username = input.username;
  const email = input.email;
  const reason = input.reason;
  const referralCode = input.referralCode;
  const comments = input.comments;

  if (
    !validString(username, 3, 24) ||
    !/^[A-Za-z0-9_&-]{3,24}$/.test(username.trim()) ||
    !validString(email, 3, 254) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    !validString(reason, 10, 2000) ||
    (referralCode !== undefined &&
      referralCode !== '' &&
      !validString(referralCode, 1, 64)) ||
    (comments !== undefined && comments !== '' && !validString(comments, 0, 2000))
  ) {
    return NextResponse.json(
      { error: 'Check the username, email, reason, and optional fields.' },
      { status: 400 },
    );
  }

  const pepper = process.env.APPLICATION_RATE_LIMIT_SECRET;
  if (!pepper || pepper.length < 32) {
    console.error('Application submissions are disabled: rate-limit secret is not configured.');
    return NextResponse.json(
      { error: 'Applications are temporarily unavailable. Please try again later.' },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const rateKey = createHmac('sha256', pepper).update(ip).digest('hex');

  try {
    const db = supabaseService();
    const { data, error } = await db.rpc('submit_scamtastic_application', {
      p_rate_key: rateKey,
      p_username: username.trim(),
      p_email: email.trim().toLowerCase(),
      p_reason: reason.trim(),
      p_referral_code:
        typeof referralCode === 'string' ? referralCode.trim().toUpperCase() || null : null,
      p_comments: typeof comments === 'string' ? comments.trim() || null : null,
    });

    if (error) {
      if (error.message.includes('Rate limit exceeded')) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait before trying again.' },
          { status: 429 },
        );
      }
      if (error.message.includes('Invalid referral code')) {
        return NextResponse.json(
          { error: 'That referral code is invalid, revoked, or fully used.' },
          { status: 400 },
        );
      }
      if (error.code === '22023') {
        return NextResponse.json({ error: 'Check your application details.' }, { status: 400 });
      }
      console.error('Application submission RPC failed:', error.code);
      return NextResponse.json(
        { error: 'Unable to submit your request right now. Please try again later.' },
        { status: 503 },
      );
    }

    if (data === 'username_unavailable') {
      return NextResponse.json(
        { error: 'That username is unavailable. Choose another username.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('Application submission unavailable:', error);
    return NextResponse.json(
      { error: 'Unable to submit your request right now. Please try again later.' },
      { status: 503 },
    );
  }
}
