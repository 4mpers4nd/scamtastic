import { notFound, redirect } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { administratorUser } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await administratorUser();
  if (!user) redirect('/login?error=admin');
  if (!isAdmin) notFound();

  return <AdminShell>{children}</AdminShell>;
}
