import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminPlayerInvitationCredits from '@/components/AdminPlayerInvitationCredits';
import { PlayerAccessForm, PlayerEditForm } from '@/components/AdminActionForms';
import { profileHref } from '@/lib/profile-route.mjs';
import { supabaseServer } from '@/lib/server';

type Player = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_banned: boolean;
  is_founder: boolean;
  is_admin: boolean;
  created_at: string;
};

type InvitationSummary = {
  id: string;
  username: string;
  credits: number;
  invitations: number;
  recruited: number;
};

export default async function AdminPlayerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = await supabaseServer();
  const { data, error } = await db.rpc('admin_list_players', { p_search: '' });
  if (error) throw error;
  const player = ((data ?? []) as Player[]).find((candidate) => candidate.id === id);
  if (!player) notFound();

  let invitationSummary: InvitationSummary | undefined;
  if (!player.is_banned) {
    const { data: invitationData, error: invitationError } = await db.rpc(
      'admin_list_invitation_players',
      { p_search: player.username },
    );
    if (invitationError) throw invitationError;
    invitationSummary = ((invitationData ?? []) as InvitationSummary[]).find(
      (candidate) => candidate.id === player.id,
    );
  }

  return (
    <>
      <div className="adminPageHeading">
        <Link href="/admin/players">← Back to players</Link>
        <div className="tag">// PLAYER RECORD</div>
        <h1>{player.display_name || player.username}</h1>
        <p>
          <Link href={profileHref(player.username)}>@{player.username}</Link>
        </p>
        <div className="badgeGroup">
          {player.is_founder && <span className="statusBadge approved">Founder</span>}
          {player.is_admin && <span className="statusBadge">Administrator</span>}
          <span className={`statusBadge ${player.is_banned ? 'rejected' : 'approved'}`}>
            {player.is_banned ? 'Suspended' : 'Active'}
          </span>
        </div>
      </div>

      <section className="adminPanel">
        <div className="tag">// ACCOUNT DETAILS</div>
        <dl className="detailList">
          <div>
            <dt>Username</dt>
            <dd>@{player.username}</dd>
          </div>
          <div>
            <dt>Registered</dt>
            <dd>
              <time dateTime={player.created_at}>
                {new Date(player.created_at).toLocaleDateString()}
              </time>
            </dd>
          </div>
          <div>
            <dt>Invitations issued</dt>
            <dd>{invitationSummary?.invitations ?? 0}</dd>
          </div>
          <div>
            <dt>Players recruited</dt>
            <dd>{invitationSummary?.recruited ?? 0}</dd>
          </div>
          {invitationSummary && (
            <div>
              <dt>Available invites</dt>
              <dd>{invitationSummary.credits}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="adminPanel">
        <div className="tag">// PROFILE</div>
        <h2>Edit public profile</h2>
        <PlayerEditForm
          id={player.id}
          displayName={player.display_name}
          bio={player.bio}
        />
      </section>

      <section className="adminPanel">
        <div className="tag">// INVITATION CREDITS</div>
        <h2>Manage player invites</h2>
        <AdminPlayerInvitationCredits playerId={player.id} username={player.username} />
      </section>

      <section className="adminPanel">
        <div className="tag">// ACCOUNT ACCESS</div>
        <h2>{player.is_banned ? 'Restore access' : 'Suspend access'}</h2>
        <PlayerAccessForm id={player.id} suspended={player.is_banned} />
      </section>
    </>
  );
}
