import Link from 'next/link';
import ProceduralAvatar from '@/components/ProceduralAvatar';
import { supabaseServer } from '@/lib/server';

type Player = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_seed: string;
  avatar_generator_version: number;
  is_banned: boolean;
  is_founder: boolean;
  is_admin: boolean;
  created_at: string;
  invitation_credits: number;
  invitation_count: number;
  recruited_count: number;
};

type PlayerPage = {
  players: Player[];
  total: number;
};

const pageSize = 25;

export default async function AdminPlayers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const requestedPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const query = (requestedQuery ?? '').trim().slice(0, 100);
  const parsedPage = Number(requestedPage ?? 1);
  const requestedPageNumber = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const db = await supabaseServer();
  const { data, error } = await db.rpc('admin_list_players_page', {
    p_search: query,
    p_limit: pageSize,
    p_offset: Math.min((requestedPageNumber - 1) * pageSize, 1_000_000),
  });
  if (error) throw error;
  let result = data as PlayerPage | null;
  if (
    !result ||
    !Array.isArray(result.players) ||
    !Number.isSafeInteger(result.total) ||
    result.total < 0
  ) {
    throw new Error('Admin player page returned an invalid shape');
  }
  let players = result.players;
  const pageCount = Math.max(1, Math.ceil(result.total / pageSize));
  const page = Math.min(requestedPageNumber, pageCount);
  if ((page - 1) * pageSize !== Math.min((requestedPageNumber - 1) * pageSize, 1_000_000)) {
    const corrected = await db.rpc('admin_list_players_page', {
      p_search: query,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });
    if (corrected.error) throw corrected.error;
    result = corrected.data as PlayerPage | null;
    if (!result || !Array.isArray(result.players) || !Number.isSafeInteger(result.total)) {
      throw new Error('Admin player page returned an invalid shape');
    }
    players = result.players;
  }

  function pageHref(pageNumber: number) {
    const search = new URLSearchParams();
    if (query) search.set('q', query);
    search.set('page', String(pageNumber));
    return `/admin/players?${search.toString()}`;
  }

  return (
    <>
      <div className="adminPageHeading">
        <div className="tag">// PLAYER MANAGEMENT</div>
        <h1>Players</h1>
        <p>Search the directory and open a player record to manage their account.</p>
      </div>
      <form className="searchForm" action="/admin/players">
        <label className="visuallyHidden" htmlFor="player-search">Search players</label>
        <input
          id="player-search"
          name="q"
          type="search"
          maxLength={100}
          defaultValue={query}
          placeholder="Search username or display name"
        />
        <button className="button secondary">Search</button>
      </form>
      {result.total === 0 ? (
        <p className="emptyState adminPanel">No players match this search.</p>
      ) : (
        <>
          <div className="adminPlayerRows" aria-label="Player directory">
            {players.map((player) => (
              <Link
                className="adminPlayerRow"
                href={`/admin/players/${encodeURIComponent(player.id)}`}
                key={player.id}
              >
                <span className="adminPlayerIdentity">
                  <ProceduralAvatar
                    className="adminPlayerAvatar"
                    seed={player.avatar_seed}
                    version={player.avatar_generator_version}
                    label=""
                  />
                  <span>
                    <strong>{player.display_name || player.username}</strong>
                    <span className="muted">@{player.username}</span>
                  </span>
                </span>
                <span className="adminPlayerSummary">
                  <span className={`statusBadge ${player.is_banned ? 'rejected' : 'approved'}`}>
                    {player.is_banned ? 'Suspended' : 'Active'}
                  </span>
                  <span>{player.invitation_count} invites · {player.recruited_count} recruited</span>
                  <span>{player.invitation_credits} available</span>
                  <span className="muted">
                    {player.is_admin ? 'Administrator' : player.is_founder ? 'Founder' : 'Player'}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <nav className="pagination" aria-label="Player directory pages">
            <span className="muted">
              Page {page} of {pageCount} · {result.total} {result.total === 1 ? 'player' : 'players'}
            </span>
            <div className="actionButtons">
              {page > 1 && <Link className="button secondary" href={pageHref(page - 1)}>Previous</Link>}
              {page < pageCount && <Link className="button secondary" href={pageHref(page + 1)}>Next</Link>}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
