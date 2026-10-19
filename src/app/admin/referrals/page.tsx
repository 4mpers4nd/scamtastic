import { supabaseServer } from '@/lib/server';
import { ReferralRevokeForm } from '@/components/AdminActionForms';

type Referral = {
  id: string;
  code: string;
  creator_username: string;
  usage_limit: number;
  uses: number;
  referred_players: Array<{ username: string; status: string; submitted_at: string }>;
  revoked_at: string | null;
  created_at: string;
};

export default async function AdminReferrals() {
  const db = await supabaseServer();
  const { data, error } = await db.rpc('admin_list_referrals');
  if (error) throw error;
  const referrals = data as Referral[];

  return (
    <>
      <div className="adminPageHeading">
        <div className="tag">// NETWORK GROWTH</div>
        <h1>Referral codes</h1>
        <p>Track invites without granting access or gameplay benefits.</p>
      </div>
      {referrals.length === 0 ? (
        <p className="emptyState adminPanel">No referral codes have been created.</p>
      ) : (
        <div className="tableWrap">
          <table className="adminTable">
            <thead>
              <tr>
                <th>Code</th>
                <th>Creator</th>
                <th>Uses</th>
                <th>Created</th>
                <th>Status</th>
                <th><span className="visuallyHidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((referral) => (
                <tr key={referral.id}>
                  <td>
                    <code>{referral.code}</code>
                    {referral.referred_players.length > 0 && (
                      <details className="referralHistory">
                        <summary>View referred applicants</summary>
                        <ul>
                          {referral.referred_players.map((player) => (
                            <li key={`${player.username}-${player.submitted_at}`}>
                              {player.username} · {player.status}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td>{referral.creator_username}</td>
                  <td>{referral.uses} / {referral.usage_limit}</td>
                  <td><time dateTime={referral.created_at}>{new Date(referral.created_at).toLocaleDateString()}</time></td>
                  <td>{referral.revoked_at ? 'Revoked' : referral.uses >= referral.usage_limit ? 'Used' : 'Active'}</td>
                  <td>{!referral.revoked_at && <ReferralRevokeForm id={referral.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
