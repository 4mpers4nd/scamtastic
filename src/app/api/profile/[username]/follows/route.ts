import { NextResponse, type NextRequest } from 'next/server';
import { parsePublicFollowPage } from '@/lib/profile-follows.mjs';
import { profileUsernameFromRouteParam } from '@/lib/profile-route.mjs';
import { authenticatedUser } from '@/lib/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
) {
  const { username: routeUsername } = await context.params;
  const username = profileUsernameFromRouteParam(routeUsername);
  const direction = request.nextUrl.searchParams.get('direction');
  const offsetText = request.nextUrl.searchParams.get('offset') ?? '0';
  const offset = Number(offsetText);
  if (
    !username ||
    (direction !== 'followers' && direction !== 'following') ||
    !/^\d{1,7}$/.test(offsetText) ||
    offset > 1_000_000
  ) {
    return NextResponse.json({ error: 'Invalid follow-list request.' }, { status: 400 });
  }

  try {
    const { db } = await authenticatedUser();
    const { data, error } = await db.rpc('public_player_follow_page', {
      p_username: username,
      p_direction: direction,
      p_offset: offset,
      p_limit: 20,
    });
    if (error) throw error;
    if (data === null) {
      return NextResponse.json({ error: 'Active player profile not found.' }, { status: 404 });
    }
    const page = parsePublicFollowPage(data);
    if (!page) throw new Error('Public follow page returned an invalid shape');
    return NextResponse.json(page, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error(
      'Public follow-list request failed:',
      error instanceof Error ? error.name : 'Unknown error',
    );
    return NextResponse.json(
      { error: 'Unable to load this follow list right now.' },
      { status: 503 },
    );
  }
}
