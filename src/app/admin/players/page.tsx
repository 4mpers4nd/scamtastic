import Link from 'next/link';
import { supabaseServer } from '@/lib/server';

type Player = {
  id: string;
  username: string;
  display_name: string | null;
  is_banned: boolean;
  is_founder: boolean;
  is_admin: boolean;
  created_at: string;
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
  const { data, error } = await db.rpc('admin_list_players', { p_search: query });
  if (error) throw error;
  const players = (data ?? []) as Player[];
  const pageCount = Math.max(1, Math.ceil(players.length / pageSize));
  const page = Math.min(requestedPageNumber, pageCount);
  const visiblePlayers = players.slice((page - 1) * pageSize, page * pageSize);

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
      {players.length === 0 ? (
        <p className="emptyState adminPanel">No players match this search.</p>
      ) : (
        <>
          <div className="tableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col"><span className="visuallyHidden">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((player) => (
                  <tr key={player.id}>
                    <th scope="row">
                      {player.display_name || player.username}
                      <div className="muted">@{player.username}</div>
                    </th>
                    <td>{player.is_admin ? 'Administrator' : player.is_founder ? 'Founder' : 'Player'}</td>
                    <td>
                      <span className={`statusBadge ${player.is_banned ? 'rejected' : 'approved'}`}>
                        {player.is_banned ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <time dateTime={player.created_at}>
                        {new Date(player.created_at).toLocaleDateString()}
                      </time>
                    </td>
                    <td>
                      <Link className="button secondary" href={`/admin/players/${encodeURIComponent(player.id)}`}>
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="Player directory pages">
            <span className="muted">
              Page {page} of {pageCount} · {players.length} {players.length === 1 ? 'player' : 'players'}
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
