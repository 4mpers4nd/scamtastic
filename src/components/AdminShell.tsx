import Link from 'next/link';
import Header from '@/components/Header';

const links = [
  ['Overview', '/admin'],
  ['Applications', '/admin/applications'],
  ['Players', '/admin/players'],
  ['Referrals', '/admin/referrals'],
  ['Audit Logs', '/admin/audit-logs'],
  ['Settings', '/admin/settings'],
] as const;

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="adminLayout">
        <aside className="adminSidebar" aria-label="Administration">
          <p className="tag">// CONTROL PANEL</p>
          <nav>
            {links.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <details className="adminMobileNav">
          <summary>Administration menu</summary>
          <nav aria-label="Administration">
            {links.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </details>
        <main className="adminMain">{children}</main>
      </div>
    </>
  );
}
