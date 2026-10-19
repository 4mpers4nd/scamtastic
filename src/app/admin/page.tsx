import Link from 'next/link';
import { supabaseServer } from '@/lib/server';

type Overview = {
  players: number;
  pending: number;
  approved: number;
  rejected: number;
  referral_codes: number;
  recent_activity: Array<{
    action: string;
    target_type: string;
    target_id: string;
    created_at: string;
  }>;
};

export default async function AdminOverview() {
  const db = await supabaseServer();
  const { data, error } = await db.rpc('admin_overview');
  if (error) throw error;
  const stats = data as Overview;
  const values = [
    ['Registered players', stats.players, '/admin/players'],
    ['Pending applications', stats.pending, '/admin/applications?status=pending'],
    ['Approved applications', stats.approved, '/admin/applications?status=approved'],
    ['Rejected applications', stats.rejected, '/admin/applications?status=rejected'],
    ['Referral codes', stats.referral_codes, '/admin/referrals'],
  ] as const;

  return (
    <>
      <div className="adminPageHeading">
        <div className="tag">// ADMINISTRATION</div>
        <h1>System overview</h1>
        <p>Live account, application, referral, and moderation activity.</p>
      </div>
      <section className="adminStats" aria-label="Current statistics">
        {values.map(([label, value, href]) => (
          <Link className="adminStat card" href={href} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </Link>
        ))}
      </section>
      <section className="adminPanel">
        <div className="panelHeading">
          <h2>Recent administrative activity</h2>
          <Link href="/admin/audit-logs">View audit log →</Link>
        </div>
        {stats.recent_activity.length === 0 ? (
          <p className="emptyState">No administrative actions have been recorded.</p>
        ) : (
          <div className="activityList">
            {stats.recent_activity.map((activity, index) => (
              <article className="activityRow" key={`${activity.created_at}-${index}`}>
                <strong>{activity.action}</strong>
                <span>
                  {activity.target_type} · {activity.target_id}
                </span>
                <time dateTime={activity.created_at}>
                  {new Date(activity.created_at).toLocaleString()}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
