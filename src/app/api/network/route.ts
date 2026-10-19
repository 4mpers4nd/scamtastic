import { NextResponse, type NextRequest } from 'next/server';
import { parseNeuralSnapshot } from '@/lib/neural/types';
import { supabaseServer } from '@/lib/server';

function queryInteger(value: string | null, fallback: number) {
  if (value === null) return fallback;
  if (!/^\d{1,8}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const limit = queryInteger(request.nextUrl.searchParams.get('limit'), 150);
  const offset = queryInteger(request.nextUrl.searchParams.get('offset'), 0);
  if (limit === null || offset === null || offset > 1000000) {
    return NextResponse.json({ error: 'Invalid network page.' }, { status: 400 });
  }

  try {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('public_neural_snapshot', {
      p_limit: Math.min(limit, 300),
      p_offset: offset,
      p_connection_limit: 2000,
    });
    if (error) throw error;

    const snapshot = parseNeuralSnapshot(data);
    if (!snapshot) throw new Error('Neural snapshot returned an invalid shape');

    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=45' },
    });
  } catch (error) {
    console.error('Public neural snapshot failed:', error);
    return NextResponse.json(
      { error: 'The neural network is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
