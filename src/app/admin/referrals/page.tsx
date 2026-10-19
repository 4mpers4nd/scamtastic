import { redirect } from 'next/navigation';

export default async function AdminReferrals() {
  redirect('/admin/invitations');
}
