import { NextResponse, type NextRequest } from 'next/server';
import { profileUsernameFromRouteParam } from '@/lib/profile-route.mjs';
import { supabaseServer } from '@/lib/server';
import { parsePublicNeuralProfile } from '@/lib/neural/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: routeUsername } = await params;
  const username = profileUsernameFromRouteParam(routeUsername);
  if (!username) return NextResponse.json({ error: 'Invalid player username.' }, { status: 400 });

  try {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('public_neural_profile', {
      p_username: username,
      p_limit: 100,
    });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    const profile = parsePublicNeuralProfile(data);
    if (!profile) throw new Error('Neural profile returned an invalid shape');

    return NextResponse.json(profile, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=45' },
    });
  } catch (error) {
    console.error('Public neural profile lookup failed:', error);
    return NextResponse.json(
      { error: 'The player profile is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
