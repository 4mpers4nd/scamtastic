import { redirect } from 'next/navigation';
import PlayerAccessNotice from '@/components/dashboard/PlayerAccessNotice';
import PlayerCommandCenter from '@/components/dashboard/PlayerCommandCenter';
import { authenticatedUser } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { db, user } = await authenticatedUser();
  if (!user) redirect('/login');

  const { data: profile, error } = await db
    .from('profiles')
    .select('username,display_name,avatar_seed,avatar_generator_version,is_banned')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile || profile.is_banned) {
    return <PlayerAccessNotice suspended={profile?.is_banned === true} />;
  }

  return <PlayerCommandCenter profile={profile} />;
}
