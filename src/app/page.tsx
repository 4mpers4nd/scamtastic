import PlayerAccessNotice from '@/components/dashboard/PlayerAccessNotice';
import NetworkCommandCenter from '@/components/dashboard/NetworkCommandCenter';
import PublicLanding from '@/components/dashboard/PublicLanding';
import { parseNetworkDashboard } from '@/lib/network-dashboard.mjs';
import { authenticatedUser } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { db, user } = await authenticatedUser();
  if (!user) return <PublicLanding />;

  const { data: profile, error } = await db
    .from('profiles')
    .select('username,display_name,avatar_seed,avatar_generator_version,is_banned')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile || profile.is_banned) {
    return <PlayerAccessNotice suspended={profile?.is_banned === true} />;
  }

  const { data, error: dashboardError } = await db.rpc('public_network_dashboard');
  if (dashboardError) throw dashboardError;
  const dashboard = parseNetworkDashboard(data);
  if (!dashboard) throw new Error('Network command center data returned an invalid shape');

  return <NetworkCommandCenter data={dashboard} />;
}
