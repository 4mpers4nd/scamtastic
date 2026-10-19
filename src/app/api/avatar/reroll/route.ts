import { NextResponse, type NextRequest } from 'next/server';
import { getUserOrNull } from '@/lib/auth-state.mjs';
import { supabaseServer } from '@/lib/server';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Same-origin requests only.' }, { status: 403 });
  }

  try {
    const db = await supabaseServer();
    const user = await getUserOrNull(db.auth);
    if (!user) {
      return NextResponse.json({ error: 'Sign in to reroll your avatar.' }, { status: 401 });
    }

    const { data, error } = await db.rpc('reroll_own_avatar');
    if (error) {
      if (error.code === '42501') {
        return NextResponse.json(
          { error: 'Only active approved players can reroll their avatar.' },
          { status: 403 },
        );
      }
      console.error('Avatar reroll RPC failed:', error.code);
      return NextResponse.json({ error: 'Unable to reroll your avatar.' }, { status: 500 });
    }

    const result = data as { avatar_seed?: unknown; avatar_generator_version?: unknown };
    if (
      typeof result?.avatar_seed !== 'string' ||
      typeof result.avatar_generator_version !== 'number'
    ) {
      console.error('Avatar reroll RPC returned an unexpected result.');
      return NextResponse.json({ error: 'Unable to reroll your avatar.' }, { status: 500 });
    }

    return NextResponse.json({
      avatarSeed: result.avatar_seed,
      avatarVersion: result.avatar_generator_version,
    });
  } catch (error) {
    console.error('Avatar reroll failed:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ error: 'Unable to reroll your avatar.' }, { status: 500 });
  }
}
