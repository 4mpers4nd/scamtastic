import Link from 'next/link';
import { supabaseServer } from '@/lib/server';
import { PlayerAccessForm, PlayerEditForm } from '@/components/AdminActionForms';
import { profileHref } from '@/lib/profile-route.mjs';

type Player = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_banned: boolean;
  is_founder: boolean;
  is_admin: boolean;
  created_at: string;
  referral_count: number;
};

export default async function AdminPlayers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (requestedQuery ?? '').trim().slice(0, 100);
  const db = await supabaseServer();
  const { data, error } = await db.rpc('admin_list_players', { p_search: query });
  if (error) throw error;
  const players = data as Player[];

  return (
    <>
      <div className="adminPageHeading">
        <div className="tag">// PLAYER MANAGEMENT</div>
        <h1>Players</h1>
        <p>Review public profile details, account status, and referral activity.</p>
      </div>
      <form className="searchForm" action="/admin/players">
        <label className="visuallyHidden" htmlFor="player-search">Search players</label>
        <input id="player-search" name="q" type="search" maxLength={100} defaultValue={query} placeholder="Search username or display name" />
        <button className="button secondary">Search</button>
      </form>
      {players.length === 0 ? (
        <p className="emptyState adminPanel">No players match this search.</p>
      ) : (
        <section className="adminCards">
          {players.map((player) => (
            <details className="adminPanel playerCard" key={player.id}>
              <summary className="panelHeading applicationSummary">
                <div>
                  <h2>{player.display_name || player.username}</h2>
                  <p>
                    <Link href={profileHref(player.username)}>
                      @{player.username}
                    </Link>
                  </p>
                </div>
                <div className="badgeGroup">
                  {player.is_founder && <span className="statusBadge approved">Founder</span>}
                  {player.is_admin && <span className="statusBadge">Administrator</span>}
                  <span className={`statusBadge ${player.is_banned ? 'rejected' : 'approved'}`}>
                    {player.is_banned ? 'Suspended' : 'Active'}
                  </span>
                </div>
              </summary>
              <div className="applicationDetails">
                <dl className="detailList">
                  <div><dt>Registered</dt><dd><time dateTime={player.created_at}>{new Date(player.created_at).toLocaleDateString()}</time></dd></div>
                  <div><dt>Referral count</dt><dd>{player.referral_count}</dd></div>
                </dl>
                <PlayerEditForm id={player.id} displayName={player.display_name} bio={player.bio} />
                <PlayerAccessForm id={player.id} suspended={player.is_banned} />
              </div>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
