import { NextResponse, type NextRequest } from 'next/server';
import { emailHtmlToText, sanitizeEmailHtml } from '@/lib/email-content.mjs';
import { sendAdministrativeEmail } from '@/lib/activation';
import { administratorUser } from '@/lib/server';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function GET(request: NextRequest) {
  try {
    const { db, user, isAdmin } = await administratorUser();
    if (!user || !isAdmin || !user.email_confirmed_at) {
      return NextResponse.json({ error: 'Verified administrator access required.' }, { status: 403 });
    }
    const search = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
    const [{ data: resources, error }, { data: recipients, error: recipientError }] =
      await Promise.all([
        db.rpc('admin_list_email_resources'),
        db.rpc('admin_email_recipient_candidates', { p_search: search }),
      ]);
    if (error) throw error;
    if (recipientError) throw recipientError;
    return NextResponse.json({ ...(resources as object), recipients }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Administrator email resources failed:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'Email tools are temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const size = Number(request.headers.get('content-length') ?? 0);
  if (size > 32_768) return NextResponse.json({ error: 'Email request is too large.' }, { status: 413 });
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid email request.' }, { status: 400 });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Invalid email request.' }, { status: 400 });
  }
  const payload = input as Record<string, unknown>;
  try {
    const { db, user, isAdmin } = await administratorUser();
    if (!user || !isAdmin || !user.email_confirmed_at) {
      return NextResponse.json({ error: 'Verified administrator access required.' }, { status: 403 });
    }

    const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
    const htmlBody = typeof payload.htmlBody === 'string' ? payload.htmlBody : '';
    const safeBody = sanitizeEmailHtml(htmlBody);
    if (!subject || subject.length > 200 || /[\r\n]/.test(subject) ||
      !emailHtmlToText(htmlBody).trim()) {
      return NextResponse.json({ error: 'Provide a subject and message under the size limit.' }, { status: 400 });
    }

    if (payload.action === 'save-template') {
      const name = typeof payload.name === 'string' ? payload.name.trim() : '';
      const id = payload.id === null || payload.id === undefined || payload.id === ''
        ? null
        : typeof payload.id === 'string' && UUID_PATTERN.test(payload.id) ? payload.id : 'invalid';
      if (!name || name.length > 80 || id === 'invalid') {
        return NextResponse.json({ error: 'Provide a valid template name.' }, { status: 400 });
      }
      const { data, error } = await db.rpc('admin_save_email_template', {
        p_id: id,
        p_name: name,
        p_subject: subject,
        p_html: safeBody,
        p_text: emailHtmlToText(htmlBody),
      });
      if (error) throw error;
      return NextResponse.json({ id: data });
    }

    if (payload.action !== 'send') {
      return NextResponse.json({ error: 'Unknown email action.' }, { status: 400 });
    }

    const playerIds = Array.isArray(payload.playerIds)
      ? payload.playerIds.filter((value): value is string => typeof value === 'string')
      : [];
    const customEmails = Array.isArray(payload.customEmails)
      ? payload.customEmails.filter((value): value is string => typeof value === 'string')
      : [];
    if (
      playerIds.length > 10 ||
      playerIds.some((id) => !UUID_PATTERN.test(id)) ||
      customEmails.length > 10 ||
      customEmails.some((email) => email.length > 254 || !EMAIL_PATTERN.test(email.trim()))
    ) {
      return NextResponse.json({ error: 'Select at most 10 valid recipients.' }, { status: 400 });
    }
    let selectedEmails: string[] = [];
    if (playerIds.length) {
      const { data, error } = await db.rpc('admin_email_recipient_emails', {
        p_user_ids: playerIds,
      });
      if (error) throw error;
      selectedEmails = (data ?? []) as string[];
    }
    const recipients = [...new Set([
      ...selectedEmails.map((email) => email.toLowerCase()),
      ...customEmails.map((email) => email.trim().toLowerCase()),
    ])];
    if (recipients.length < 1 || recipients.length > 10) {
      return NextResponse.json({ error: 'Select between 1 and 10 recipients.' }, { status: 400 });
    }

    const { data: deliveryId, error: reserveError } = await db.rpc('admin_begin_email_delivery', {
      p_subject: subject,
      p_recipient_count: recipients.length,
    });
    if (reserveError) {
      if (reserveError.message.includes('rate limit')) {
        return NextResponse.json({ error: 'Email rate limit reached. Try again later.' }, { status: 429 });
      }
      throw reserveError;
    }

    try {
      await sendAdministrativeEmail({ recipients, subject, html: safeBody });
    } catch (deliveryError) {
      const { error: finishError } = await db.rpc('admin_finish_email_delivery', {
        p_delivery_id: deliveryId,
        p_status: 'failed',
      });
      if (finishError) console.error('Failed to record email delivery failure:', finishError.code);
      console.error('Administrator email delivery failed:', deliveryError instanceof Error ? deliveryError.message : 'Unknown error');
      return NextResponse.json({ error: 'Email delivery failed. Review the sender configuration before retrying.' }, { status: 503 });
    }

    const { error: finishError } = await db.rpc('admin_finish_email_delivery', {
      p_delivery_id: deliveryId,
      p_status: 'sent',
    });
    if (finishError) {
      console.error('Sent administrator email but could not record delivery status:', finishError.code);
      return NextResponse.json({ error: 'Email was sent, but delivery status could not be recorded. Do not retry without checking history.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error &&
      typeof error.code === 'string' ? error.code : 'unknown';
    console.error('Administrator email request failed:', code);
    return NextResponse.json({ error: 'Unable to complete the email request.' }, { status: 503 });
  }
}
