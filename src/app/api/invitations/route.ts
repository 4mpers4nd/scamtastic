import { NextResponse, type NextRequest } from 'next/server';
import { createInvitationCode, invitationCodeHash } from '@/lib/invitation-code.mjs';
import { supabaseServer } from '@/lib/server';

export async function GET() {
  try {
    const db = await supabaseServer();
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Sign in to manage invitations.' }, { status: 401 });
    }
    const { data, error } = await db.rpc('my_invitation_dashboard');
    if (error) throw error;
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Player invitation dashboard failed:', error);
    return NextResponse.json({ error: 'Invitation data is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid invitation request.' }, { status: 400 });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Invalid invitation request.' }, { status: 400 });
  }
  const payload = input as Record<string, unknown>;
  try {
    const db = await supabaseServer();
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Sign in to manage invitations.' }, { status: 401 });
    }

    if (payload.action === 'create') {
      const code = createInvitationCode();
      const { data, error } = await db.rpc('create_player_invitation', {
        p_code_hash: invitationCodeHash(code),
      });
      if (error) throw error;
      return NextResponse.json({ code, ...(data as object) }, { status: 201 });
    }
    if (payload.action === 'request') {
      const requested = Number(payload.requested);
      const explanation = typeof payload.explanation === 'string' ? payload.explanation : null;
      if (!Number.isInteger(requested) || requested < 1 || requested > 20 ||
        (explanation !== null && explanation.length > 1000)) {
        return NextResponse.json({ error: 'Choose 1–20 credits and keep the explanation under 1000 characters.' }, { status: 400 });
      }
      const { error } = await db.rpc('request_invitation_credits', {
        p_requested: requested,
        p_explanation: explanation,
      });
      if (error) {
        if (error.message.includes('rate limit') || error.message.includes('pending')) {
          return NextResponse.json({ error: 'A recent credit request is already pending or was submitted this week.' }, { status: 429 });
        }
        throw error;
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    return NextResponse.json({ error: 'Unknown invitation action.' }, { status: 400 });
  } catch (error) {
    console.error('Player invitation action failed:', error);
    return NextResponse.json({ error: 'Unable to complete the invitation request.' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid invitation request.' }, { status: 400 });
  }
  const id =
    typeof input === 'object' && input !== null && !Array.isArray(input) &&
    'id' in input && typeof input.id === 'string' ? input.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid invitation identifier.' }, { status: 400 });
  }
  try {
    const db = await supabaseServer();
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Sign in to manage invitations.' }, { status: 401 });
    }
    const { data, error } = await db.rpc('revoke_player_invitation', {
      p_invitation_id: id,
    });
    if (error) throw error;
    if (data !== true) {
      return NextResponse.json({ error: 'That invitation is no longer pending.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Player invitation revoke failed:', error);
    return NextResponse.json({ error: 'Unable to revoke that invitation.' }, { status: 503 });
  }
}
