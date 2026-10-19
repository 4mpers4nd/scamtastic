import { NextResponse, type NextRequest } from 'next/server';
import { parseNeuralSearchResults } from '@/lib/neural/types';
import { supabaseServer } from '@/lib/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 24 || !/^[A-Za-z0-9_&-]+$/.test(query)) {
    return NextResponse.json(
      { error: 'Enter at least two valid username characters.' },
      { status: 400 },
    );
  }

  try {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('public_neural_search', {
      p_query: query,
      p_limit: 20,
    });
    if (error) throw error;

    const results = parseNeuralSearchResults(data);
    if (!results) throw new Error('Neural search returned an invalid shape');

    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=45' },
    });
  } catch (error) {
    console.error('Public neural search failed:', error);
    return NextResponse.json(
      { error: 'Player search is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
