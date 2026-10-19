import { NextResponse, type NextRequest } from 'next/server';
import { createInvitationCode, invitationCodeHash } from '@/lib/invitation-code.mjs';
import { sendAdministratorInvitationEmail } from '@/lib/activation';
import { administratorUser } from '@/lib/server';

export async function GET(request: NextRequest) {
  try {
    const { db, user, isAdmin } = await administratorUser();
    if (!user || !isAdmin || !user.email_confirmed_at) {
      return NextResponse.json({ error: 'Verified administrator access required.' }, { status: 403 });
    }
    const search = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
    const requestedStatus = request.nextUrl.searchParams.get('status');
    const status = requestedStatus && [
      'pending', 'submitted', 'approved', 'rejected', 'redeemed', 'revoked', 'expired',
    ].includes(requestedStatus) ? requestedStatus : null;
    const [{ data, error }, { data: players, error: playersError }] = await Promise.all([
      db.rpc('admin_invitation_overview', {
        p_search: search,
        p_status: status || null,
        p_limit: 200,
      }),
      db.rpc('admin_list_invitation_players', { p_search: search }),
    ]);
    if (error) throw error;
    if (playersError) throw playersError;
    return NextResponse.json({ ...(data as object), players }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Administrator invitation overview failed:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'Invitation management is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid administrator request.' }, { status: 400 });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Invalid administrator request.' }, { status: 400 });
  }
  const payload = input as Record<string, unknown>;

  try {
    const { db, user, isAdmin } = await administratorUser();
    if (!user || !isAdmin || !user.email_confirmed_at) {
      return NextResponse.json({ error: 'Verified administrator access required.' }, { status: 403 });
    }
    if (payload.action === 'issue') {
      const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
      const expiresDays = Number(payload.expiresDays ?? 14);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        !Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 90) {
        return NextResponse.json({ error: 'Enter a valid email and expiry between 1 and 90 days.' }, { status: 400 });
      }
      const code = createInvitationCode();
      const { data, error } = await db.rpc('admin_issue_invitation', {
        p_code_hash: invitationCodeHash(code),
        p_email: email,
        p_expires_days: expiresDays,
      });
      if (error) throw error;
      try {
        await sendAdministratorInvitationEmail(email, code);
      } catch (deliveryError) {
        const invitationId =
          typeof data === 'object' && data !== null && 'id' in data && typeof data.id === 'string'
            ? data.id
            : null;
        if (invitationId) {
          const { error: revokeError } = await db.rpc('admin_revoke_invitation', {
            p_invitation_id: invitationId,
          });
          if (revokeError) console.error('Failed invitation revoke after delivery failure:', revokeError.code);
        }
        console.error('Administrator invitation delivery failed:', deliveryError instanceof Error ? deliveryError.message : 'Unknown error');
        return NextResponse.json({ error: 'Invitation could not be delivered. No active invitation was left behind; retry after checking email configuration.' }, { status: 503 });
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (payload.action === 'revoke') {
      const id = typeof payload.id === 'string' ? payload.id : '';
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return NextResponse.json({ error: 'Invalid invitation identifier.' }, { status: 400 });
      }
      const { data, error } = await db.rpc('admin_revoke_invitation', { p_invitation_id: id });
      if (error) throw error;
      return NextResponse.json({ ok: data === true });
    }

    if (payload.action === 'review-request') {
      const id = typeof payload.id === 'string' ? payload.id : '';
      const status = payload.status;
      const granted = payload.granted === undefined ? null : Number(payload.granted);
      if (!/^[0-9a-f-]{36}$/i.test(id) || (status !== 'approved' && status !== 'denied') ||
        (granted !== null && (!Number.isInteger(granted) || granted < 1 || granted > 20))) {
        return NextResponse.json({ error: 'Invalid credit request review.' }, { status: 400 });
      }
      const { data, error } = await db.rpc('admin_review_credit_request', {
        p_request_id: id,
        p_status: status,
        p_granted: granted,
      });
      if (error) throw error;
      return NextResponse.json({ ok: data === true });
    }

    if (payload.action === 'adjust-credits') {
      const playerId = typeof payload.playerId === 'string' ? payload.playerId : '';
      const operation = payload.operation;
      const amount = Number(payload.amount);
      const operationKey = typeof payload.operationKey === 'string' ? payload.operationKey : '';
      if (!/^[0-9a-f-]{36}$/i.test(playerId) ||
        (operation !== 'grant' && operation !== 'set') ||
        !Number.isInteger(amount) || amount < 0 || amount > 10000 ||
        !/^[0-9a-f-]{36}$/i.test(operationKey) ||
        (operation === 'grant' && amount < 1)) {
        return NextResponse.json({ error: 'Invalid credit adjustment.' }, { status: 400 });
      }
      const { data, error } = await db.rpc('admin_adjust_invitation_credits', {
        p_player_id: playerId,
        p_amount: amount,
        p_operation: operation,
        p_operation_key: operationKey,
      });
      if (error) throw error;
      return NextResponse.json({ balance: data });
    }

    return NextResponse.json({ error: 'Unknown administrator action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('rate limit')) {
      return NextResponse.json({ error: 'Administrator invitation rate limit reached. Try again later.' }, { status: 429 });
    }
    const code =
      typeof error === 'object' && error !== null && 'code' in error &&
      typeof error.code === 'string' ? error.code : 'unknown';
    console.error('Administrator invitation action failed:', code);
    return NextResponse.json({ error: 'Unable to complete the administrator action.' }, { status: 503 });
  }
}
