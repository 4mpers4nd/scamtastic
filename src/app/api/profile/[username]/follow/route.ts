import { NextResponse, type NextRequest } from 'next/server';
import { profileUsernameFromRouteParam } from '@/lib/profile-route.mjs';
import { authenticatedUser } from '@/lib/server';

async function updateFollow(
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
  action: 'follow_player' | 'unfollow_player',
) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 });
  }

  const { username: routeUsername } = await context.params;
  const username = profileUsernameFromRouteParam(routeUsername);
  if (!username) {
    return NextResponse.json({ error: 'Invalid player username.' }, { status: 400 });
  }

  try {
    const { db, user } = await authenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to follow players.' }, { status: 401 });
    }
    const { error } = await db.rpc(action, { p_username: username });
    if (error) {
      if (error.code === 'P0002') {
        return NextResponse.json({ error: 'Active player profile not found.' }, { status: 404 });
      }
      if (error.code === '22023') {
        return NextResponse.json({ error: 'You cannot follow your own profile.' }, { status: 400 });
      }
      if (error.code === '42501') {
        return NextResponse.json({ error: 'Active player access is required.' }, { status: 403 });
      }
      console.error('Player follow update failed:', error.code);
      return NextResponse.json({ error: 'Unable to update this follow right now.' }, { status: 503 });
    }
    return NextResponse.json({ following: action === 'follow_player' });
  } catch (error) {
    console.error(
      'Player follow request failed:',
      error instanceof Error ? error.name : 'Unknown error',
    );
    return NextResponse.json({ error: 'Unable to update this follow right now.' }, { status: 503 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
) {
  return updateFollow(request, context, 'follow_player');
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
) {
  return updateFollow(request, context, 'unfollow_player');
}
