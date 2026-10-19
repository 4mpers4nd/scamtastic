import Link from 'next/link';
import { authenticatedUser } from '@/lib/server';
import HeaderAccount from '@/components/HeaderAccount';

export default async function Header() {
  const { db, user } = await authenticatedUser();
  let username: string | null = null;
  let displayName: string | null = null;
  let avatarSeed: string | null = null;
  let avatarVersion: number | null = null;
  let isAdmin = false;

  if (user) {
    const [{ data: profile, error: profileError }, { data: admin, error: adminError }] =
      await Promise.all([
        db
          .from('profiles')
          .select('username,display_name,avatar_seed,avatar_generator_version')
          .eq('id', user.id)
          .maybeSingle(),
        db.rpc('is_scamtastic_admin'),
      ]);

    if (profileError) throw profileError;
    if (adminError) throw adminError;
    username = profile?.username ?? null;
    displayName = profile?.display_name ?? null;
    avatarSeed = profile?.avatar_seed ?? null;
    avatarVersion = profile?.avatar_generator_version ?? null;
    isAdmin = admin === true;
  }

  const primaryLinks = user
    ? [['Network', '/network'], ['Activity', '/activity'], ['Dashboard', '/game']]
    : [['About', '/#about'], ['Network', '/network']];
  return (
    <header className="header">
      <Link className="brand" href="/">
        <span className="logo">S</span>
        <span>
          SCAMTASTIC<span className="dot">.</span>
        </span>
      </Link>
      <nav className="headerNav" aria-label="Main navigation">
        <div className="headerPrimaryLinks">
          {primaryLinks.map(([label, href]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </div>
        {user ? (
          <HeaderAccount
            displayName={displayName}
            username={username}
            avatarSeed={avatarSeed}
            avatarVersion={avatarVersion}
            isAdmin={isAdmin}
          />
        ) : (
          <div className="headerGuestActions">
            <Link className="button primary" href="/apply">Request Access</Link>
            <Link className="button secondary" href="/login">Log In</Link>
          </div>
        )}
        <details className="mobileNavigation">
          <summary className="button secondary" aria-label="Open mobile navigation">Menu</summary>
          <div className="mobileNavigationPanel">
            {primaryLinks.map(([label, href]) => (
              <Link key={href} href={href}>{label}</Link>
            ))}
            {!user && (
              <>
                <Link href="/apply">Request Access</Link>
                <Link href="/login">Log In</Link>
              </>
            )}
          </div>
        </details>
      </nav>
    </header>
  );
}
