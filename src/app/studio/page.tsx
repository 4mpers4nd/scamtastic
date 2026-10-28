import { redirect } from 'next/navigation';
import StudioEditor from '@/components/studio/StudioEditor';
import { authenticatedUser } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const { user } = await authenticatedUser();
  if (!user) redirect('/login');
  return <StudioEditor />;
}
