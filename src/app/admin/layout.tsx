import { notFound, redirect } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { getAccessDecision } from '@/lib/auth-state.mjs';
import { administratorUser } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await administratorUser();
  const access = getAccessDecision(user, { adminOnly: true, isAdmin });
  if (access === 'login') redirect('/login?error=admin');
  if (access === 'forbidden') notFound();

  return <AdminShell>{children}</AdminShell>;
}
